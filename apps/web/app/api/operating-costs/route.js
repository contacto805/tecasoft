import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const lotId = searchParams.get('lotId');
    const weekNumber = searchParams.get('weekNumber');
    const weekYear = searchParams.get('weekYear');
    const costType = searchParams.get('costType');
    const status = searchParams.get('status');
    const summary = searchParams.get('summary');

    if (id) {
      const [cost] = await sql`
        SELECT oc.*,
          l.lot_number,
          c.customer_name
        FROM operating_costs oc
        LEFT JOIN lots l ON oc.lot_id = l.id
        LEFT JOIN customers c ON oc.customer_id = c.id
        WHERE oc.id = ${id}
      `;
      return NextResponse.json(cost || {});
    }

    if (summary === 'true') {
      const costs = await sql`
        SELECT 
          cost_type,
          COUNT(*) as count,
          SUM(amount_mxn) as total_amount,
          AVG(amount_mxn) as avg_amount
        FROM operating_costs
        WHERE status = 'aprobado'
        GROUP BY cost_type
        ORDER BY total_amount DESC
      `;
      return NextResponse.json(costs);
    }

    let where = sql`WHERE 1=1`;

    if (lotId) {
      where = sql`${where} AND oc.lot_id = ${lotId}`;
    }
    if (weekNumber && weekYear) {
      where = sql`${where} AND oc.week_number = ${weekNumber} AND oc.week_year = ${weekYear}`;
    }
    if (costType) {
      where = sql`${where} AND oc.cost_type = ${costType}`;
    }
    if (status) {
      where = sql`${where} AND oc.status = ${status}`;
    }

    const costs = await sql`
      SELECT oc.*,
        l.lot_number,
        c.customer_name
      FROM operating_costs oc
      LEFT JOIN lots l ON oc.lot_id = l.id
      LEFT JOIN customers c ON oc.customer_id = c.id
      ${where}
      ORDER BY oc.cost_date DESC, oc.created_at DESC
      LIMIT 500
    `;

    return NextResponse.json(costs);
  } catch (error) {
    console.error('Error fetching operating costs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      cost_date,
      cost_type,
      cost_category,
      cost_concept,
      description,
      amount,
      currency = 'MXN',
      exchange_rate = 1.00,
      area_related,
      module_origin,
      lot_id,
      cutting_order_id,
      production_batch_id,
      load_history_id,
      customer_id,
      provider_id,
      distribution_method,
      calculation_base,
      base_kg,
      registered_by,
      notes,
      receipt_url
    } = body;

    const costDate = new Date(cost_date);
    const weekNumber = getWeekNumber(costDate);
    const weekYear = costDate.getFullYear();
    const amountMxn = amount * exchange_rate;

    // Generate folio
    const [lastCost] = await sql`
      SELECT folio FROM operating_costs 
      ORDER BY id DESC 
      LIMIT 1
    `;
    let folioNumber = 1;
    if (lastCost?.folio) {
      const match = lastCost.folio.match(/COST-\d+-(\d+)$/);
      if (match) folioNumber = parseInt(match[1]) + 1;
    }
    const folio = `COST-${weekYear}-${String(folioNumber).padStart(3, '0')}`;

    const [newCost] = await sql`
      INSERT INTO operating_costs (
        folio, cost_date, week_number, week_year,
        cost_type, cost_category, cost_concept, description,
        amount, currency, exchange_rate, amount_mxn,
        area_related, module_origin,
        lot_id, cutting_order_id, production_batch_id, load_history_id,
        customer_id, provider_id,
        distribution_method, calculation_base, base_kg,
        registered_by, notes, receipt_url, status
      ) VALUES (
        ${folio}, ${cost_date}, ${weekNumber}, ${weekYear},
        ${cost_type}, ${cost_category}, ${cost_concept}, ${description},
        ${amount}, ${currency}, ${exchange_rate}, ${amountMxn},
        ${area_related}, ${module_origin},
        ${lot_id}, ${cutting_order_id}, ${production_batch_id}, ${load_history_id},
        ${customer_id}, ${provider_id},
        ${distribution_method}, ${calculation_base}, ${base_kg},
        ${registered_by}, ${notes}, ${receipt_url}, 'pendiente'
      )
      RETURNING *
    `;

    // Check for duplicates
    const duplicates = await sql`
      SELECT * FROM operating_costs
      WHERE cost_concept = ${cost_concept}
        AND cost_date = ${cost_date}
        AND amount = ${amount}
        AND id != ${newCost.id}
        AND created_at > NOW() - INTERVAL '7 days'
    `;

    if (duplicates.length > 0) {
      await sql`
        INSERT INTO cost_alerts (alert_type, cost_id, severity, message)
        VALUES ('duplicate_warning', ${newCost.id}, 'warning', 
          'Posible duplicado detectado: concepto similar registrado recientemente')
      `;
    }

    // Create audit log
    await sql`
      INSERT INTO operating_costs_audit (cost_id, action, user_name, new_data)
      VALUES (${newCost.id}, 'created', ${registered_by}, ${JSON.stringify(newCost)})
    `;

    return NextResponse.json(newCost);
  } catch (error) {
    console.error('Error creating operating cost:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    // Get old data for audit
    const [oldCost] = await sql`SELECT * FROM operating_costs WHERE id = ${id}`;

    if (!oldCost) {
      return NextResponse.json({ error: 'Costo no encontrado' }, { status: 404 });
    }

    // Recalculate amount_mxn if amount or exchange_rate changed
    const amountMxn = (updates.amount || oldCost.amount) * (updates.exchange_rate || oldCost.exchange_rate);

    const [updated] = await sql`
      UPDATE operating_costs
      SET
        cost_date = COALESCE(${updates.cost_date}, cost_date),
        cost_type = COALESCE(${updates.cost_type}, cost_type),
        cost_category = COALESCE(${updates.cost_category}, cost_category),
        cost_concept = COALESCE(${updates.cost_concept}, cost_concept),
        description = COALESCE(${updates.description}, description),
        amount = COALESCE(${updates.amount}, amount),
        currency = COALESCE(${updates.currency}, currency),
        exchange_rate = COALESCE(${updates.exchange_rate}, exchange_rate),
        amount_mxn = ${amountMxn},
        area_related = COALESCE(${updates.area_related}, area_related),
        lot_id = COALESCE(${updates.lot_id}, lot_id),
        distribution_method = COALESCE(${updates.distribution_method}, distribution_method),
        calculation_base = COALESCE(${updates.calculation_base}, calculation_base),
        base_kg = COALESCE(${updates.base_kg}, base_kg),
        notes = COALESCE(${updates.notes}, notes),
        receipt_url = COALESCE(${updates.receipt_url}, receipt_url),
        status = COALESCE(${updates.status}, status),
        authorized_by = COALESCE(${updates.authorized_by}, authorized_by),
        authorized_at = COALESCE(${updates.authorized_at}, authorized_at),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Create audit log
    await sql`
      INSERT INTO operating_costs_audit (cost_id, action, user_name, old_data, new_data)
      VALUES (${id}, 'updated', ${updates.authorized_by || 'System'}, 
        ${JSON.stringify(oldCost)}, ${JSON.stringify(updated)})
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating operating cost:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Check if cost is approved
    const [cost] = await sql`SELECT * FROM operating_costs WHERE id = ${id}`;
    if (cost?.status === 'aprobado') {
      return NextResponse.json({ 
        error: 'No se puede eliminar un costo aprobado. Requiere autorización del Superadministrador.' 
      }, { status: 403 });
    }

    await sql`DELETE FROM operating_costs WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting operating cost:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
