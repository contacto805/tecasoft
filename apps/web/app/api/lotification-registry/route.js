import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * XI. MIGRACIÓN CONTROLADA «LOTE REGISTRO» (BLOQUE 12)
 * - Fuente CANÓNICA: production_batches + production_selection_details (ampliados con source_system/source_id)
 * - Tablas legacy: modo SOLO LECTURA para auditoría/histórico. No se duplican corridas.
 * - Mapeo: lotification_registry.selection_date -> production_batches.production_date
 *   lotification_calibers (kilos/caliber/class) -> production_selection_details (caliber/class_name/total_kg/boxes)
 *   Usar source_system='lotification_registry', source_id=registry_id para correspondencia única.
 * - Históricos incompatibles detectados vía queries (múltiples registros/lote=7, diffs kg >5 en lotes como 7008/7009).
 *   Enviados a conciliación (no destruidos, no inventadas equivalencias).
 * - Plan reversión: restaurar writes desde versión anterior + re-habilitar endpoints. Mantener tablas legacy intactas.
 * - Backup verificable insertado en system_backups (id=1, BLOQUE12_LOTE_REGISTRO_INVENTORY_2025).
 */

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
  // XI: ESCRITURA DESHABILITADA - Fuente canónica es /api/production (production_batches + production_selection_details)
  // Histórico legacy preservado en modo solo lectura. Usar corridas confirmadas en Producción.
  // No se aceptan nuevos registros para evitar duplicación de corridas.
  return NextResponse.json({ 
    success: false, 
    error: 'Endpoint de escritura deshabilitado (BLOQUE 12). Fuente CANÓNICA: Producción (/api/production y confirm). Tablas legacy en modo consulta/archivo para auditoría. Datos históricos respetados. Contactar para conciliación de incompatibles.',
    code: 'LEGACY_WRITE_DISABLED'
  }, { status: 410 });
}

export async function PUT(request) {
  // XI: ESCRITURA DESHABILITADA (ver POST)
  return NextResponse.json({ 
    success: false, 
    error: 'PUT deshabilitado. Fuente canónica Producción. Legacy solo lectura.',
    code: 'LEGACY_WRITE_DISABLED'
  }, { status: 410 });
}

export async function DELETE(request) {
  // XI: ESCRITURA DESHABILITADA (ver POST)
  return NextResponse.json({ 
    success: false, 
    error: 'DELETE deshabilitado. Fuente canónica Producción. Legacy solo lectura.',
    code: 'LEGACY_WRITE_DISABLED'
  }, { status: 410 });
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
