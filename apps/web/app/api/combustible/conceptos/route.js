import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    let q = sql`SELECT * FROM combustible_conceptos WHERE activo = true`;
    if (tipo) q = sql`${q} AND tipo = ${tipo}`;
    q = sql`${q} ORDER BY orden ASC, nombre ASC`;
    const rows = await q;
    return NextResponse.json(rows);
  } catch {
    // defaults
    return NextResponse.json([
      {id:1, tipo:'combustible', nombre:'Magna', orden:1, activo:true},
      {id:2, tipo:'combustible', nombre:'Premium', orden:2, activo:true},
      {id:3, tipo:'combustible', nombre:'Diésel', orden:3, activo:true},
      {id:4, tipo:'pago', nombre:'efectivo', orden:1, activo:true},
      {id:5, tipo:'pago', nombre:'tarjeta', orden:2, activo:true},
      {id:6, tipo:'pago', nombre:'transferencia', orden:3, activo:true},
      {id:7, tipo:'pago', nombre:'credito', orden:4, activo:true},
      {id:8, tipo:'pago', nombre:'vale', orden:5, activo:true}
    ]);
  }
}

export async function POST(request) {
  try {
    const { tipo, nombre, orden } = await request.json();
    if (!tipo || !nombre) return NextResponse.json({error:'tipo y nombre requeridos'}, {status:400});
    const [row] = await sql`
      INSERT INTO combustible_conceptos (tipo, nombre, orden, activo, created_by)
      VALUES (${tipo}, ${nombre}, ${orden||99}, true, 'admin')
      RETURNING *
    `;
    return NextResponse.json(row, {status:201});
  } catch (e) {
    return NextResponse.json({error:'Error'}, {status:500});
  }
}
