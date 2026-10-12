import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pedidos = await sql`SELECT * FROM pedidos ORDER BY fecha_salida DESC, created_at DESC`;
    return NextResponse.json(pedidos);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const b = await request.json();
    const rows = Array.isArray(b.rows) ? b.rows : [];
    const total = rows.reduce((s, r) => s + (parseInt(r.num_tarimas) || 0), 0);
    const res = await sql`
      INSERT INTO pedidos (fecha_salida, customer_id, cliente_nombre, fruta_requerida, total_tarimas, estado, rows)
      VALUES (${b.fechaSalida || null}, ${b.customerId || null}, ${b.clienteNombre || ''}, ${b.frutaRequerida || ''}, ${total}, ${b.estado || 'pendiente'}, ${JSON.stringify(rows)}::jsonb)
      RETURNING *
    `;
    return NextResponse.json(res[0]);
  } catch (e) {
    return NextResponse.json({ error: 'create failed' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const b = await request.json();
    if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const rows = Array.isArray(b.rows) ? b.rows : undefined;
    let total = b.total_tarimas;
    if (rows) total = rows.reduce((s, r) => s + (parseInt(r.num_tarimas) || 0), 0);
    let setParts = [];
    if (b.fechaSalida !== undefined) setParts.push(sql`fecha_salida = ${b.fechaSalida}`);
    if (b.customerId !== undefined) setParts.push(sql`customer_id = ${b.customerId}`);
    if (b.clienteNombre !== undefined) setParts.push(sql`cliente_nombre = ${b.clienteNombre}`);
    if (b.frutaRequerida !== undefined) setParts.push(sql`fruta_requerida = ${b.frutaRequerida}`);
    if (b.estado !== undefined) setParts.push(sql`estado = ${b.estado}`);
    if (total !== undefined) setParts.push(sql`total_tarimas = ${total}`);
    if (rows !== undefined) setParts.push(sql`rows = ${JSON.stringify(rows)}::jsonb`);
    if (setParts.length === 0) setParts.push(sql`updated_at = ${new Date().toISOString()}`);
    else setParts.push(sql`updated_at = ${new Date().toISOString()}`);
    let setFrag = setParts[0];
    for (let i = 1; i < setParts.length; i++) setFrag = sql`${setFrag}, ${setParts[i]}`;
    const res = await sql`UPDATE pedidos SET ${setFrag} WHERE id = ${b.id} RETURNING *`;
    return NextResponse.json(res[0] || null);
  } catch (e) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) await sql`DELETE FROM pedidos WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
