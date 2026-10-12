import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import * as CrewService from "@/lib/domain/crew-service";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('week_start');
  const weekEnd = searchParams.get('week_end');
  const crewId = searchParams.get('crew_id');

  try {
    let closings = [];
    if (weekStart && weekEnd) {
      closings = await sql`
        SELECT * FROM crew_weekly_closings 
        WHERE week_start_date = ${weekStart} AND week_end_date = ${weekEnd}
        ORDER BY week_start_date DESC LIMIT 1
      `;
    } else {
      closings = await sql`SELECT * FROM crew_weekly_closings ORDER BY week_start_date DESC LIMIT 12`;
    }

    const result = [];
    for (const closing of closings) {
      const ws = closing.week_start_date;
      const we = closing.week_end_date;

      let cutsRaw = await CrewService.getCutsForWeek(ws, we);
      if (crewId) {
        cutsRaw = cutsRaw.filter(c => String(c.crew_id) === String(crewId));
      }

      const crews = await Promise.all(cutsRaw.map(async (c) => {
        const cost = await CrewService.calculateCutCost(c);
        return {
          ...c,
          id: c.id,
          folio: c.folio,
          cutting_date: c.cutting_date,
          producer_name: c.producer_name,
          orchard_name: c.orchard_name,
          lot_number: c.lot_number,
          lot_id: c.lot_id,
          crew_id: c.crew_id,
          crew_chief_name: c.crew_chief_name || c.crew_nombre,
          real_kg: parseFloat(c.real_kg || c.net_weight || 0),
          total_kg: parseFloat(c.real_kg || c.net_weight || 0),
          payable_kg: parseFloat(c.payable_kg || c.real_kg || c.net_weight || 0),
          adjustment_kg: parseFloat(c.adjustment_kg || 0),
          applied_rate: parseFloat(c.applied_crew_rate || c.crew_default_rate || 0),
          crew_pay: cost.crew_pay,
          freight_cost: cost.freight_cost,
          total_cost: cost.total_cost,
          status_crew: c.status_crew || c.status,
          freight_origin: c.freight_origin,
          freight_destination: c.freight_destination,
          applied_freight_amount: parseFloat(c.applied_freight_amount || c.freight_cost || 0),
          rate_source: c.rate_source
        };
      }));

      const freights = await sql`
        SELECT cf.*, co.folio as cutting_folio, co.orchard_name
        FROM crew_freights cf
        LEFT JOIN cutting_orders co ON co.id = cf.cutting_order_id
        WHERE cf.week_closing_id = ${closing.id}
        ORDER BY cf.created_at ASC
      `;

      const adjustments = await sql`
        SELECT ca.*, co.folio, co.cutting_date, co.orchard_name
        FROM crew_cut_adjustments ca
        JOIN cutting_orders co ON co.id = ca.cutting_order_id
        WHERE co.cutting_date BETWEEN ${ws} AND ${we}
        ORDER BY ca.fecha_hora DESC
      `;

      const daily = await CrewService.getDailySummary(ws, we);
      const crewSummary = await CrewService.getCrewWeeklySummary(ws, we);

      result.push({ 
        ...closing, 
        crews, 
        freights, 
        adjustments,
        daily_summary: daily,
        crew_summary: crewSummary
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching cuadrillas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_closing') {
      const { week_start_date, week_end_date } = body;
      const existing = await sql`
        SELECT id FROM crew_weekly_closings 
        WHERE week_start_date = ${week_start_date} AND week_end_date = ${week_end_date}
        LIMIT 1
      `;
      if (existing.length > 0) return NextResponse.json(existing[0]);
      const [closing] = await sql`
        INSERT INTO crew_weekly_closings (week_start_date, week_end_date, status)
        VALUES (${week_start_date}, ${week_end_date}, 'abierto')
        RETURNING *
      `;
      return NextResponse.json(closing);
    }

    if (action === 'close_week') {
      const { id } = body;
      const [closing] = await sql`
        UPDATE crew_weekly_closings SET status = 'cerrado', updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json(closing);
    }

    if (action === 'reopen_week') {
      const { id } = body;
      const [closing] = await sql`
        UPDATE crew_weekly_closings SET status = 'abierto', updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      return NextResponse.json(closing);
    }

    if (action === 'assign_crew') {
      const res = await CrewService.assignCrewToCut({
        cutting_order_id: body.cutting_order_id,
        crew_id: body.crew_id,
        justification: body.justification,
        user: body.user || 'cuadrillas'
      });
      return NextResponse.json(res);
    }

    if (action === 'adjust_cut') {
      const res = await CrewService.adjustCutKg({
        cutting_order_id: body.cutting_order_id,
        adjustment_kg: body.adjustment_kg,
        tipo_ajuste: body.tipo_ajuste,
        justificacion: body.justificacion,
        evidence_url: body.evidence_url,
        usuario: body.usuario || 'cuadrillas'
      });
      return NextResponse.json(res);
    }

    if (action === 'assign_freight') {
      const res = await CrewService.assignFreightToCut({
        cutting_order_id: body.cutting_order_id,
        freight_rate_id: body.freight_rate_id,
        origin: body.origin,
        destination: body.destination,
        vehicle_type_id: body.vehicle_type_id,
        applied_rate: body.applied_rate,
        manual_reason: body.manual_reason,
        user: body.user || 'cuadrillas'
      });
      return NextResponse.json(res);
    }

    if (action === 'authorize_cut') {
      const res = await CrewService.authorizeCut({
        cutting_order_id: body.cutting_order_id,
        user: body.user || 'cuadrillas'
      });
      return NextResponse.json(res);
    }

    if (action === 'create_payment') {
      const payment = await CrewService.createCrewPayment({
        crew_id: body.crew_id,
        week_start_date: body.week_start_date,
        week_end_date: body.week_end_date,
        user: body.user || 'cuadrillas'
      });
      return NextResponse.json(payment);
    }

    if (action === 'get_tarifario') {
      const rates = await CrewService.getTarifario();
      return NextResponse.json(rates);
    }

    if (action === 'save_tarifario') {
      const { origin, destination, distance_km, vehicle_type_id, rate, valid_from } = body;
      const [row] = await sql`
        INSERT INTO freight_rates (origin, destination, distance_km, vehicle_type_id, rate, currency, valid_from, active, created_by)
        VALUES (${origin}, ${destination}, ${distance_km || 0}, ${vehicle_type_id || null}, ${rate}, 'MXN', ${valid_from || new Date().toISOString().split('T')[0]}, true, 'cuadrillas')
        RETURNING *
      `;
      return NextResponse.json(row);
    }

    if (action === 'add_freight') {
      const { week_closing_id, cutting_order_id, lot_id, freight_type, description, price, freight_date, notes } = body;
      const [freight] = await sql`
        INSERT INTO crew_freights (week_closing_id, cutting_order_id, lot_id, freight_type, description, price, freight_date, notes)
        VALUES (${week_closing_id}, ${cutting_order_id || null}, ${lot_id || null}, ${freight_type || 'extra'}, ${description}, ${price}, ${freight_date}, ${notes || null})
        RETURNING *
      `;
      return NextResponse.json(freight);
    }

    if (action === 'delete_freight') {
      const { id } = body;
      await sql`DELETE FROM crew_freights WHERE id = ${id}`;
      return NextResponse.json({ success: true });
    }

    // Get plain cutting orders in range for dropdowns (source of truth)
    if (action === 'get_cuts') {
      const { week_start, week_end } = body;
      const orders = await sql`
        SELECT co.id, co.folio, co.cutting_date, co.orchard_name, co.producer_name, co.lot_id,
               COALESCE((SELECT fiw.total_kg_weighed FROM fruit_input_weighings fiw WHERE fiw.lot_id = co.lot_id LIMIT 1), co.net_weight) AS real_kg,
               co.crew_id, co.crew_chief_name, co.applied_crew_rate, co.payable_kg, co.adjustment_kg, co.applied_freight_amount,
               co.freight_origin, co.freight_destination, co.status_crew
        FROM cutting_orders co
        WHERE co.cutting_date BETWEEN ${week_start} AND ${week_end}
        ORDER BY co.cutting_date ASC
      `;
      return NextResponse.json(orders);
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error in cuadrillas POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
