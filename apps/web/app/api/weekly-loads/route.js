import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    console.log("📦 [Weekly Loads API] GET request received");
    
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');

    console.log("🔍 Query params:", { weekStart, weekEnd });

    let loads;
    if (weekStart && weekEnd) {
      console.log("📅 Fetching loads for date range:", weekStart, "to", weekEnd);
      loads = await sql`
        SELECT * FROM weekly_loads 
        WHERE load_date >= ${weekStart}::date AND load_date <= ${weekEnd}::date
        ORDER BY load_date ASC, load_name ASC, caliber ASC
      `;
    } else {
      console.log("📅 Fetching current week's loads (last 7 days)");
      loads = await sql`
        SELECT * FROM weekly_loads 
        WHERE load_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY load_date ASC, load_name ASC, caliber ASC
      `;
    }

    console.log("✅ [Weekly Loads API] Found", loads.length, "loads");
    return NextResponse.json(loads);
  } catch (error) {
    console.error("❌ [Weekly Loads API] Error:", error.message);
    console.error("Stack:", error.stack);
    return NextResponse.json({ 
      error: error.message,
      details: error.toString() 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      load_name,
      load_date,
      customer_name,
      destination,
      caliber,
      presentation_kg,
      pallets_count,
      boxes_count,
      total_kg,
      status
    } = body;

    const result = await sql`
      INSERT INTO weekly_loads (
        load_name, load_date, customer_name, destination, caliber, 
        presentation_kg, pallets_count, boxes_count, total_kg, status
      )
      VALUES (
        ${load_name}, ${load_date}, ${customer_name}, ${destination}, ${caliber},
        ${presentation_kg}, ${pallets_count || 0}, ${boxes_count || 0}, ${total_kg || 0}, ${status || 'Pendiente'}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating weekly load:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const result = await sql`
      UPDATE weekly_loads 
      SET 
        load_name = COALESCE(${updates.load_name}, load_name),
        load_date = COALESCE(${updates.load_date}::date, load_date),
        customer_name = COALESCE(${updates.customer_name}, customer_name),
        destination = COALESCE(${updates.destination}, destination),
        caliber = COALESCE(${updates.caliber}, caliber),
        presentation_kg = COALESCE(${updates.presentation_kg}, presentation_kg),
        pallets_count = COALESCE(${updates.pallets_count}, pallets_count),
        boxes_count = COALESCE(${updates.boxes_count}, boxes_count),
        total_kg = COALESCE(${updates.total_kg}, total_kg),
        status = COALESCE(${updates.status}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating weekly load:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM weekly_loads WHERE id = ${id} RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly load:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
