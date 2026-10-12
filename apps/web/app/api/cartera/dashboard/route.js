import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7*86400000).toISOString().slice(0,10);
    const d15 = new Date(now.getTime() - 15*86400000).toISOString().slice(0,10);
    const d30 = new Date(now.getTime() - 30*86400000).toISOString().slice(0,10);
    const d60 = new Date(now.getTime() - 60*86400000).toISOString().slice(0,10);

    const totalPorCobrar = await sql`
      SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE estatus IN ('Pendiente','Parcial','Vencida')
    `;
    const totalCobrado = await sql`
      SELECT COALESCE(SUM(total_abonado_usd),0) as s FROM notas
    `;
    const anticipos = await sql`
      SELECT COALESCE(SUM(equivalente_usd - COALESCE((SELECT SUM(monto_aplicado_usd) FROM abono_aplicaciones WHERE abono_id=a.id),0)),0) as s 
      FROM abonos a
    `;
    const clientesConSaldo = await sql`SELECT COUNT(DISTINCT customer_id) as c FROM notas WHERE saldo_usd > 0.5`;

    const porAntiguedad = {
      "0-7": (await sql`SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE fecha >= ${d7} AND saldo_usd > 0`)[0].s,
      "8-15": (await sql`SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE fecha >= ${d15} AND fecha < ${d7} AND saldo_usd > 0`)[0].s,
      "16-30": (await sql`SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE fecha >= ${d30} AND fecha < ${d15} AND saldo_usd > 0`)[0].s,
      "31-60": (await sql`SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE fecha >= ${d60} AND fecha < ${d30} AND saldo_usd > 0`)[0].s,
      ">60": (await sql`SELECT COALESCE(SUM(saldo_usd),0) as s FROM notas WHERE fecha < ${d60} AND saldo_usd > 0`)[0].s,
    };

    const topClientes = await sql`
      SELECT c.customer_name, SUM(n.saldo_usd) as saldo
      FROM notas n JOIN customers c ON n.customer_id = c.id
      WHERE n.saldo_usd > 0 GROUP BY c.customer_name ORDER BY saldo DESC LIMIT 8
    `;

    return NextResponse.json({
      total_por_cobrar_usd: Math.round((totalPorCobrar[0]?.s || 0) * 100) / 100,
      total_cobrado_usd: Math.round((totalCobrado[0]?.s || 0) * 100) / 100,
      anticipos_usd: Math.round((anticipos[0]?.s || 0) * 100) / 100,
      clientes_con_saldo: parseInt(clientesConSaldo[0]?.c || 0),
      cartera_por_antiguedad: Object.fromEntries(Object.entries(porAntiguedad).map(([k,v]) => [k, Math.round((v||0)*100)/100])),
      top_clientes_saldo: topClientes.map(r => ({ name: r.customer_name, saldo: Math.round((r.saldo||0)*100)/100 }))
    });
  } catch (e) {
    return NextResponse.json({ total_por_cobrar_usd: 0, total_cobrado_usd: 0, anticipos_usd: 0, clientes_con_saldo: 0, cartera_por_antiguedad: {}, top_clientes_saldo: [] });
  }
}
