import { NextResponse } from "next/server";
import { requireTransporterSession } from "@/app/api/utils/customer-portal-auth";
import sql from "@/app/api/utils/sql";

export async function GET() {
  const auth = await requireTransporterSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const name = auth.session.transporterName;
  try {
    const freights = await sql`SELECT * FROM foreign_freights WHERE driver_name ILIKE ${'%' + name + '%'} ORDER BY freight_date DESC LIMIT 20`;
    const viajes = await sql`SELECT * FROM viajes WHERE transportista ILIKE ${'%' + name + '%'} ORDER BY fecha_salida DESC LIMIT 20`;
    const loads = await sql`SELECT * FROM load_history WHERE driver_name ILIKE ${'%' + name + '%'} ORDER BY load_date DESC LIMIT 10`;
    return NextResponse.json({ transporter: name, freights, viajes, loads, actualizado: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo consultar" }, { status: 500 });
  }
}
