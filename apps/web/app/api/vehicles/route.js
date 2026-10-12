import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const withHistory = searchParams.get("history") === "true";

  try {
    if (id) {
      const [vehicle] = await sql`
        SELECT * FROM vehicles WHERE id = ${parseInt(id)}
      `;
      if (!vehicle) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });

      if (withHistory) {
        const history = await sql`
          SELECT * FROM vehicle_price_history 
          WHERE vehicle_id = ${parseInt(id)} 
          ORDER BY changed_at DESC
        `;
        return NextResponse.json({ ...vehicle, price_history: history });
      }
      return NextResponse.json(vehicle);
    }

    const vehicles = await sql`
      SELECT v.*, 
             (SELECT COUNT(*) FROM vehicle_price_history h WHERE h.vehicle_id = v.id) as price_changes_count
      FROM vehicles v 
      ORDER BY v.name ASC
    `;
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("Error GET vehicles:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, plates, assigned_operator, capacity, current_price_per_trip, valid_from, status, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Nombre de camioneta requerido" }, { status: 400 });
    }

    const [created] = await sql`
      INSERT INTO vehicles (name, plates, assigned_operator, capacity, current_price_per_trip, valid_from, status, notes)
      VALUES (${name}, ${plates || ""}, ${assigned_operator || ""}, ${parseFloat(capacity) || 0}, ${parseFloat(current_price_per_trip) || 0}, ${valid_from || new Date().toISOString().slice(0,10)}, ${status || "activo"}, ${notes || ""})
      RETURNING *
    `;
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error POST vehicle:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, action, changed_by, reason, ...data } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    if (action === "update_price") {
      const newPrice = parseFloat(data.current_price_per_trip);
      if (!newPrice && newPrice !== 0) return NextResponse.json({ error: "Precio nuevo requerido" }, { status: 400 });

      const [currentVehicle] = await sql`SELECT current_price_per_trip FROM vehicles WHERE id = ${parseInt(id)}`;
      const oldPrice = parseFloat(currentVehicle?.current_price_per_trip || 0);

      // Log history
      await sql`
        INSERT INTO vehicle_price_history (vehicle_id, old_price, new_price, changed_by, reason)
        VALUES (${parseInt(id)}, ${oldPrice}, ${newPrice}, ${changed_by || "Usuario"}, ${reason || "Ajuste de tarifa"})
      `;

      // Update current only for future (no history rewrite)
      await sql`
        UPDATE vehicles 
        SET current_price_per_trip = ${newPrice}, 
            valid_from = COALESCE(${data.valid_from || null}, valid_from), 
            updated_at = NOW() 
        WHERE id = ${parseInt(id)}
      `;

      const [updated] = await sql`SELECT * FROM vehicles WHERE id = ${parseInt(id)}`;
      return NextResponse.json({ success: true, vehicle: updated, change: { old: oldPrice, new: newPrice } });
    }

    // Regular field update
    const fields = [];
    if (data.name !== undefined) fields.push(sql`name = ${data.name}`);
    if (data.plates !== undefined) fields.push(sql`plates = ${data.plates}`);
    if (data.assigned_operator !== undefined) fields.push(sql`assigned_operator = ${data.assigned_operator}`);
    if (data.capacity !== undefined) fields.push(sql`capacity = ${parseFloat(data.capacity)}`);
    if (data.status !== undefined) fields.push(sql`status = ${data.status}`);
    if (data.notes !== undefined) fields.push(sql`notes = ${data.notes}`);
    if (data.valid_from !== undefined) fields.push(sql`valid_from = ${data.valid_from}`);

    if (fields.length === 0) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });

    await sql`UPDATE vehicles SET ${sql.join(fields, ", ")}, updated_at = NOW() WHERE id = ${parseInt(id)}`;
    const [updated] = await sql`SELECT * FROM vehicles WHERE id = ${parseInt(id)}`;
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error PUT vehicle:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await sql`UPDATE vehicles SET status = 'inactivo', updated_at = NOW() WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE vehicle:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
