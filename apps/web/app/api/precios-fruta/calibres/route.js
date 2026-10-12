import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM precios_fruta_calibres ORDER BY orden ASC, id ASC`;
    return NextResponse.json(rows || []);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}