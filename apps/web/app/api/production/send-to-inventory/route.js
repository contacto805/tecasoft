import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { recalculateLot } from "@/app/api/utils/recalculate";

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:"Inicia sesión para generar tarimas."},{status:401});
    const {production_batch_id,lot_id,configurations={}} = await request.json();
    const batch = Number(production_batch_id);
    const lot = Number(lot_id);
    if (![batch,lot].every(id=>Number.isSafeInteger(id)&&id>0)) {
      return NextResponse.json({error:"Selecciona el lote y la corrida confirmada."},{status:400});
    }
    const [row] = await sql`SELECT erp_pack_production(${batch},${lot},${user.id},${JSON.stringify(configurations)}::jsonb) AS result`;
    await recalculateLot(lot).catch(error=>console.error("Resumen de lote",error.message));
    return NextResponse.json({success:true,...row.result});
  } catch (error) {
    if (error.code === "23514") return NextResponse.json({error:error.message},{status:422});
    console.error("Error al generar tarimas",error);
    return NextResponse.json({error:"No se pudo generar el inventario de la corrida."},{status:500});
  }
}
