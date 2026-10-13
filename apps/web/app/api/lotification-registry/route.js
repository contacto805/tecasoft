import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');

    if (lotId) {
      // CONSOLIDATED: return all valid registries for the lot (no single LIMIT 1) so comparison can use full history or sum
      const records = await sql`
        SELECT * FROM lotification_registry 
        WHERE lot_id = ${parseInt(lotId)}
        ORDER BY created_at DESC
      `;

      if (records.length === 0) {
        return NextResponse.json(null);
      }

      // Attach calibers to each
      const full = [];
      for (const r of records) {
        const cals = await sql`
          SELECT * FROM lotification_calibers WHERE registry_id = ${r.id} ORDER BY caliber
        `;
        full.push({ ...r, calibers: cals });
      }

      // Return the list; client decides consolidation (sum active, latest confirmed, or all parts)
      return NextResponse.json(full);
    }

    // Get all lotification registries with lot details
    const records = await sql`
      SELECT 
        lr.*,
        l.lot_number,
        l.producer,
        l.origin,
        l.fruit_type,
        l.date as lot_date
      FROM lotification_registry lr
      LEFT JOIN lots l ON lr.lot_id = l.id
      ORDER BY lr.created_at DESC
    `;

    return NextResponse.json(records);
  } catch (error) {
    console.error('Error in GET /api/lotification-registry:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lotId,
      selectionDate,
      totalKilosReceived,
      calibers,
      processKg,
      wasteKg,
      qualityType,
      claseBKilos,
      desechoCapturado: desechoInput,
      procesoKg: incomingProcesoKg
    } = body;

    console.log('🔍 API: Recibiendo datos de lotificación...');
    console.log('Lot ID:', lotId);
    console.log('Quality Type:', qualityType);
    console.log('Clase B Kilos:', claseBKilos);

    // Validaciones
    if (!lotId) {
      console.error('❌ Error: Falta lot_id');
      return NextResponse.json({ success: false, error: 'Falta el ID del lote' }, { status: 400 });
    }

    if (!selectionDate) {
      console.error('❌ Error: Falta fecha de selección');
      return NextResponse.json({ success: false, error: 'Falta la fecha de selección' }, { status: 400 });
    }

    if (!totalKilosReceived || totalKilosReceived <= 0) {
      console.error('❌ Error: Total de kilos inválido');
      return NextResponse.json({ success: false, error: 'El total de kilos recibidos debe ser mayor a 0' }, { status: 400 });
    }

    const selectedQuality = qualityType || 'Calidad A';
    const desechoCapturado = parseFloat(desechoInput || wasteKg) || 0;
    const claseBKilosVal = parseFloat(claseBKilos || 0);
    const procesoKgVal = parseFloat(incomingProcesoKg || processKg) || 0;

    let totalKilosByCaliber = 0;
    let realPricePerLot = 0;
    let shrinkageKg = 0;

    if (selectedQuality === 'Proceso' || selectedQuality === 'Desecho') {
      const totalProcessWaste = (parseFloat(processKg) || 0) + desechoCapturado;
      shrinkageKg = totalKilosReceived - totalProcessWaste;
      totalKilosByCaliber = totalProcessWaste;
    } else if (selectedQuality === 'Clase B') {
      const claseKg = claseBKilosVal || (parseFloat(processKg) || 0);
      shrinkageKg = totalKilosReceived - claseKg - desechoCapturado;
      totalKilosByCaliber = claseKg;
    } else {
      if (!calibers || calibers.length === 0) {
        console.error('❌ Error: No hay calibres');
        return NextResponse.json({ success: false, error: 'Debe ingresar al menos un calibre con kilos' }, { status: 400 });
      }
      totalKilosByCaliber = calibers.reduce((sum, c) => sum + (parseFloat(c.kilos) || 0), 0);
      realPricePerLot = calibers.reduce((sum, c) => sum + ((parseFloat(c.percentage) || 0 / 100) * (parseFloat(c.price) || 0)), 0);
      shrinkageKg = totalKilosReceived - totalKilosByCaliber - desechoCapturado;
    }

    // Insert registry record  + new fields 
    const result = await sql`
      INSERT INTO lotification_registry (
        lot_id,
        selection_date,
        total_kilos_received,
        total_kilos_by_caliber,
        real_price_per_lot,
        calidad,
        desecho_capturado,
        clase_b_kg,
        proceso_kg
      ) VALUES (
        ${parseInt(lotId)},
        ${selectionDate},
        ${parseFloat(totalKilosReceived)},
        ${parseFloat(totalKilosByCaliber)},
        ${parseFloat(realPricePerLot)},
        ${selectedQuality},
        ${desechoCapturado},
        ${claseBKilosVal},
        ${procesoKgVal}
      )
      RETURNING *
    `;

    if (!result || result.length === 0) {
      console.error('❌ Error: No se pudo insertar el registro principal');
      return NextResponse.json({ success: false, error: 'Error al insertar el registro principal' }, { status: 500 });
    }

    const registryId = result[0].id;
    console.log('✅ Registro principal creado con ID:', registryId);

    // Insert caliber details
    if (selectedQuality === 'Proceso' || selectedQuality === 'Desecho') {
      // For Proceso/Desecho, create a single entry
      await sql`
        INSERT INTO lotification_calibers (
          registry_id,
          caliber,
          kilos,
          price,
          percentage,
          process_kg,
          waste_kg,
          shrinkage_kg
        ) VALUES (
          ${registryId},
          ${selectedQuality},
          ${totalKilosByCaliber},
          0,
          100,
          ${procesoKgVal},
          ${desechoCapturado},
          ${shrinkageKg}
        )
      `;
    } else if (selectedQuality === 'Clase B') {
      // Special entry for Clase B
      await sql`
        INSERT INTO lotification_calibers (
          registry_id,
          caliber,
          kilos,
          price,
          percentage,
          process_kg,
          waste_kg,
          shrinkage_kg
        ) VALUES (
          ${registryId},
          'Clase B',
          ${totalKilosByCaliber},
          0,
          100,
          ${procesoKgVal},
          ${desechoCapturado},
          ${shrinkageKg}
        )
      `;
    } else {
      // For regular qualities, insert each caliber
      for (const caliber of calibers) {
        await sql`
          INSERT INTO lotification_calibers (
            registry_id,
            caliber,
            kilos,
            price,
            percentage,
            shrinkage_kg
          ) VALUES (
            ${registryId},
            ${caliber.caliber},
            ${parseFloat(caliber.kilos) || 0},
            ${parseFloat(caliber.price) || 0},
            ${parseFloat(caliber.percentage) || 0},
            0
          )
        `;
      }
    }

    console.log('✅ Registro de lotificación guardado exitosamente');

    // VII: SEPARACIÓN PROCESO/DESECHO DE VENTA
    // Clasificación física genera categoría de inventario trazable.
    // NO genera venta automática aquí. La venta comercial se registra SOLO en el módulo Ventas de Proceso y Desecho
    // cuando realmente se venda. No se crean registros de venta desde lotificación.
    // Transferencia a inventario de subproducto (si aplica) debe venir de evento de producción confirmado con referencia única.
    
    // Send notification to super admin
    await sendNotificationToSuperAdmin({
      type: 'create',
      module: 'Lotificación',
      registryId: registryId,
      lotId
    });
    
    return NextResponse.json({
      success: true,
      registry: result[0]
    });
  } catch (error) {
    console.error('❌ Error en API lotification-registry:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al guardar el registro: ' + error.message 
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      id,
      selectionDate,
      totalKilosReceived,
      calibers,
      calidad,
      desecho_capturado,
      clase_b_kg,
      proceso_kg: putProcesoKg
    } = body;

    // Calculate totals
    let totalKilosByCaliber = 0;
    let realPricePerLot = 0;
    if (calibers && calibers.length > 0) {
      totalKilosByCaliber = calibers.reduce((sum, c) => sum + (parseFloat(c.kilos) || 0), 0);
      realPricePerLot = calibers.reduce((sum, c) => sum + (((parseFloat(c.percentage) || 0) / 100) * (parseFloat(c.price) || 0)), 0);
    }

    // Update main registry record - include new fields
    const result = await sql`
      UPDATE lotification_registry
      SET
        selection_date = ${selectionDate},
        total_kilos_received = ${parseFloat(totalKilosReceived)},
        total_kilos_by_caliber = ${parseFloat(totalKilosByCaliber)},
        real_price_per_lot = ${parseFloat(realPricePerLot)},
        calidad = COALESCE(${calidad}, calidad),
        desecho_capturado = ${parseFloat(desecho_capturado) || 0},
        clase_b_kg = ${parseFloat(clase_b_kg) || 0},
        proceso_kg = ${parseFloat(putProcesoKg) || 0},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Delete old caliber details
    await sql`DELETE FROM lotification_calibers WHERE registry_id = ${parseInt(id)}`;

    // Insert new caliber details
    for (const caliber of calibers) {
      await sql`
        INSERT INTO lotification_calibers (
          registry_id,
          caliber,
          kilos,
          price,
          percentage,
          process_kg,
          waste_kg,
          shrinkage_kg
        ) VALUES (
          ${parseInt(id)},
          ${caliber.caliber},
          ${parseFloat(caliber.kilos)},
          ${parseFloat(caliber.price)},
          ${parseFloat(caliber.percentage)},
          ${parseFloat(caliber.process_kg) || 0},
          ${parseFloat(caliber.waste_kg) || 0},
          ${parseFloat(caliber.shrinkage_kg) || 0}
        )
      `;
    }

    // Send notification to super admin about update
    await sendNotificationToSuperAdmin({
      type: 'update',
      module: 'Lotificación',
      registryId: parseInt(id)
    });
    
    return NextResponse.json({
      success: true,
      registry: result[0]
    });
  } catch (error) {
    console.error('❌ Error en API PUT lotification-registry:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al actualizar el registro: ' + error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    // Send notification to super admin about deletion
    await sendNotificationToSuperAdmin({
      type: 'delete',
      module: 'Lotificación',
      registryId: parseInt(id)
    });

    // Delete caliber details first (foreign key constraint)
    await sql`DELETE FROM lotification_calibers WHERE registry_id = ${parseInt(id)}`;
    
    // Delete main registry
    await sql`DELETE FROM lotification_registry WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error en API DELETE lotification-registry:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al eliminar el registro: ' + error.message 
    }, { status: 500 });
  }
}

async function sendNotificationToSuperAdmin({ type, module, registryId, lotId }) {
  try {
    // Get super admin users
    const superAdmins = await sql`
      SELECT id FROM "user" WHERE is_super_admin = true
    `;

    if (superAdmins.length === 0) return;

    const typeLabels = {
      create: 'registro',
      update: 'modificación',
      delete: 'eliminación'
    };

    const title = `Nuevo ${typeLabels[type]} en ${module}`;
    const body = `Se ha realizado un ${typeLabels[type]} en el módulo de ${module}`;

    // Log notification for each super admin
    for (const admin of superAdmins) {
      await sql`
        INSERT INTO notification_log (
          user_id,
          notification_type,
          title,
          body,
          data
        ) VALUES (
          ${admin.id},
          'lotification_${type}',
          ${title},
          ${body},
          ${JSON.stringify({ registryId, lotId, module, type })}
        )
      `;
    }

    // Send push notification
    await sendPushNotification(superAdmins.map(a => a.id), {
      title,
      body,
      data: { registryId, lotId, module, type }
    });
  } catch (error) {
    console.error('Error sending notification to super admin:', error);
  }
}

async function sendPushNotification(userIds, notification) {
  try {
    // Get push tokens for users
    const tokens = await sql`
      SELECT push_token 
      FROM push_notifications 
      WHERE user_id = ANY(${userIds}) 
      AND is_active = true
    `;

    if (tokens.length === 0) return;

    // Send push notifications using Expo Push API
    const messages = tokens.map(({ push_token }) => ({
      to: push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: 'high'
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages)
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
