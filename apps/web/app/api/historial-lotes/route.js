import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const records = await sql`
      SELECT 
        hl.*,
        l.producer,
        l.fruit_type
      FROM historial_lotes hl
      LEFT JOIN lots l ON hl.lot_id = l.id
      ORDER BY hl.created_at DESC
      LIMIT 200
    `;
    return NextResponse.json(records);
  } catch (e) {
    console.error('historial GET error', e);
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      lotId,
      lotNumber,
      fecha,
      productor,
      producto,
      totalKg,
      clasificaciones,
      totalClaseA,
      totalClaseB,
      usuario,
      calidad,
      procesoKg,
      desechoKg,
      totalRecibidos,
      mermaKg,
      precioReal
    } = body;

    const [created] = await sql`
      INSERT INTO historial_lotes (
        lot_id, lot_number, fecha, productor, producto, 
        total_kg, clasificaciones, total_kg_clase_a, total_kg_clase_b, usuario, estatus,
        calidad, proceso_kg, desecho_kg, total_kilos_recibidos, merma_kg, precio_real
      ) VALUES (
        ${lotId}, ${lotNumber}, ${fecha}, ${productor}, ${producto || 'Aguacate'},
        ${totalKg || 0}, ${JSON.stringify(clasificaciones || {})}, 
        ${totalClaseA || 0}, ${totalClaseB || 0}, ${usuario || 'Operador'},
        'Registrado',
        ${calidad || 'Calidad A'},
        ${procesoKg || 0}, ${desechoKg || 0},
        ${totalRecibidos || 0}, ${mermaKg || 0}, ${precioReal || 0}
      )
      RETURNING *
    `;
    return NextResponse.json({ success: true, record: created });
  } catch (e) {
    console.error('historial POST error', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
