import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const where = status ? sql`WHERE l.status = ${status}` : sql``;

    const lots = await sql`
      SELECT 
        l.*,
        COALESCE(c.folio, '') as cutting_folio,
        COALESCE(fiw.kg, w.total_kg, l.total_kg_received, 0) as total_kg,
        COALESCE(w.total_boxes, 0) as total_boxes
      FROM lots l
      LEFT JOIN (
        SELECT lot_id, SUM(net_weight) as total_kg, SUM(boxes) as total_boxes 
        FROM weighings GROUP BY lot_id
      ) w ON l.id = w.lot_id
      LEFT JOIN (
        SELECT lot_id, SUM(total_kg_weighed) as kg FROM fruit_input_weighings GROUP BY lot_id
      ) fiw ON l.id = fiw.lot_id
      LEFT JOIN cutting_orders c ON c.id = l.cutting_order_id
      ${where}
      ORDER BY l.created_at DESC
    `;
    return NextResponse.json(lots);
  } catch (error) {
    console.error('Error in GET /api/lots:', error);
    return NextResponse.json({ error: 'Error al cargar los lotes. Por favor verifica tu conexión e intenta nuevamente.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const {
      lot_number,
      producer,
      orchard_name,
      fruit_type,
      date,
      fruit_price,
      collector_name,
      commission_amount,
      payment_days = 0,
      is_cut_fruit,
      cutting_order_folio,
      fruit_source = 'acopio',
      cutting_order_id,
      collector_phone,
      broker_name,
      broker_phone,
      freight_paid = false,
      crew_paid = false,
      orchard_registry = '',
      guide_folio = ''
    } = await request.json();
    
    // Validación de campos requeridos
    if (!lot_number || !lot_number.trim()) {
      return NextResponse.json(
        { error: 'El número de lote es requerido' }, 
        { status: 400 }
      );
    }
    
    const trimmedLotNumber = lot_number.trim();
    
    // Validate lot number format (must be TCV-FTS-XXXX format)
    if (!/^TCV-FTS-\d{4}$/.test(trimmedLotNumber)) {
      return NextResponse.json(
        { error: 'El número de lote debe tener el formato TCV-FTS-XXXX (ejemplo: TCV-FTS-0001, TCV-FTS-0002)' }, 
        { status: 400 }
      );
    }
    
    if (!producer || !producer.trim()) {
      return NextResponse.json(
        { error: 'El nombre del productor es requerido' }, 
        { status: 400 }
      );
    }
    
    if (!orchard_name || !orchard_name.trim()) {
      return NextResponse.json(
        { error: 'El nombre de la huerta es requerido' }, 
        { status: 400 }
      );
    }
    
    if (!fruit_type || !fruit_type.trim()) {
      return NextResponse.json(
        { error: 'El tipo de fruta es requerido' }, 
        { status: 400 }
      );
    }
    
    if (!date) {
      return NextResponse.json(
        { error: 'La fecha es requerida' }, 
        { status: 400 }
      );
    }
    
    if (!fruit_price || isNaN(parseFloat(fruit_price)) || parseFloat(fruit_price) <= 0) {
      return NextResponse.json(
        { error: 'El precio de fruta debe ser un número mayor a cero' }, 
        { status: 400 }
      );
    }
    
    if (!collector_name || !collector_name.trim()) {
      return NextResponse.json(
        { error: 'El nombre del acopiador es requerido' }, 
        { status: 400 }
      );
    }
    
    // Check for duplicate lot number with transaction safety
    const existingLot = await sql`
      SELECT id FROM lots WHERE lot_number = ${trimmedLotNumber}
    `;
    
    if (existingLot.length > 0) {
      return NextResponse.json(
        { error: `El número de lote "${trimmedLotNumber}" ya existe. Por favor genera uno nuevo.` }, 
        { status: 409 }
      );
    }

    // Calculate payment_scheduled_date
    let paymentScheduledDate = null;
    if (payment_days && parseInt(payment_days) > 0) {
      const lotDate = new Date(date);
      const paymentDate = new Date(lotDate);
      paymentDate.setDate(paymentDate.getDate() + parseInt(payment_days));
      
      let dayOfWeek = paymentDate.getDay();
      let daysUntilFriday;
      
      if (dayOfWeek === 5) {
        daysUntilFriday = 7;
      } else if (dayOfWeek < 5) {
        daysUntilFriday = 5 - dayOfWeek;
      } else {
        daysUntilFriday = 12 - dayOfWeek;
      }
      
      paymentDate.setDate(paymentDate.getDate() + daysUntilFriday);
      paymentScheduledDate = paymentDate.toISOString().split('T')[0];
    }
    
    // Insert lot with calculated payment_scheduled_date
    const result = await sql`
      INSERT INTO lots (
        lot_number, 
        producer, 
        orchard_name, 
        fruit_type, 
        date, 
        fruit_price, 
        collector_name, 
        commission_amount, 
        payment_days,
        payment_scheduled_date,
        is_cut_fruit,
        status,
        fruit_source,
        cutting_order_id,
        collector_phone,
        broker_name,
        broker_phone,
        freight_paid,
        crew_paid,
        orchard_registry,
        guide_folio
      )
      VALUES (
        ${trimmedLotNumber},
        ${producer.trim()},
        ${orchard_name.trim()},
        ${fruit_type.trim()},
        ${date},
        ${parseFloat(fruit_price)},
        ${collector_name.trim()},
        ${commission_amount ? parseFloat(commission_amount) : 0},
        ${payment_days ? parseInt(payment_days) : 0},
        ${paymentScheduledDate},
        ${is_cut_fruit || false},
        'selection',
        ${fruit_source},
        ${cutting_order_id || null},
        ${collector_phone || null},
        ${broker_name || null},
        ${broker_phone || null},
        ${freight_paid || false},
        ${crew_paid || false},
        ${orchard_registry ? orchard_registry.trim() : null},
        ${guide_folio ? guide_folio.trim() : null}
      )
      RETURNING *
    `;
    
    // If it's cut fruit, create a cutting order
    if (is_cut_fruit && cutting_order_folio) {
      await sql`
        INSERT INTO cutting_orders (folio, lot_id)
        VALUES (${cutting_order_folio}, ${result[0].id})
      `;
    }

    // 🔄 SINCRONIZAR: Registrar en audit log
    await sql`
      INSERT INTO sync_audit_log (entity_type, entity_id, action, new_values, module_name, created_at)
      VALUES ('lot', ${result[0].id}, 'create', ${JSON.stringify(result[0])}, 'fruit-input', CURRENT_TIMESTAMP)
    `;

    // Generar automáticamente QR y token público del lote (para Dashboard público por QR)
    try {
      const [existingLink] = await sql`
        SELECT id FROM public_lot_links WHERE lot_id = ${result[0].id} LIMIT 1
      `;
      if (!existingLink) {
        const publicToken = crypto.randomBytes(16).toString("hex");
        await sql`
          INSERT INTO public_lot_links (lot_id, public_token, is_active, created_at, updated_at)
          VALUES (${result[0].id}, ${publicToken}, true, NOW(), NOW())
        `;
        // Opcional crear entrada básica de dashboard visual
        await sql`
          INSERT INTO lot_dashboard_info (lot_id, public_token, is_active, created_at)
          VALUES (${result[0].id}, ${publicToken}, true, NOW())
          ON CONFLICT DO NOTHING
        `;
      }
    } catch (qrErr) {
      console.error("QR auto-generation warning (continuing):", qrErr.message);
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating lot:', error);
    return NextResponse.json(
      { error: 'Error al crear el lote. Por favor verifica los datos e intenta nuevamente.' }, 
      { status: 500 }
    );
  }
}

// PUT: actualizar datos del lote (incluyendo totales desde ingreso de fruta, para trazabilidad)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, total_kg_received, lot_traceability_status, cutting_order_id } = body;

    if (!id) return NextResponse.json({ error: 'Id de lote requerido' }, { status: 400 });

    const kgs = (total_kg_received !== undefined ? parseFloat(total_kg_received) : null);
    const ts = lot_traceability_status || null;
    const coi = (cutting_order_id !== undefined ? cutting_order_id : null);

    const [result] = await sql`
      UPDATE lots 
      SET 
        total_kg_received = COALESCE(${kgs}, total_kg_received),
        lot_traceability_status = COALESCE(${ts}, lot_traceability_status),
        cutting_order_id = COALESCE(${coi}, cutting_order_id),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    return NextResponse.json(result || { success: true });
  } catch (error) {
    console.error('Error in PUT /api/lots:', error);
    // Hard fallback direct 
    try {
      if (body.id && total_kg_received !== undefined) {
        await sql`UPDATE lots SET total_kg_received = ${parseFloat(body.total_kg_received)}, updated_at = NOW() WHERE id = ${parseInt(body.id)}`;
        return NextResponse.json({ success: true });
      }
    } catch (_) {}
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
