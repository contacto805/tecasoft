import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { recalculateLot } from "@/app/api/utils/recalculate";

export async function POST(request,{params}) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:"Inicia sesión para confirmar la corrida."},{status:401});
    const {id} = await params;
    const batch = Number(id);
    if (!Number.isSafeInteger(batch)||batch<=0) return NextResponse.json({error:"Corrida inválida."},{status:400});
    const {idempotency_key,notes} = await request.json();
    const [row] = await sql`SELECT erp_confirm_production(${batch},${user.id},${idempotency_key||null},${notes||null}) AS result`;
    await recalculateLot(row.result.batch.lot_id).catch(error=>console.error("Resumen de lote",error.message));
    return NextResponse.json({success:true,...row.result});
  } catch (error) {
    if (error.code === "P0002") return NextResponse.json({error:error.message},{status:404});
    if (error.code === "23514") return NextResponse.json({error:error.message},{status:422});
    console.error("Error al confirmar corrida",error);
    return NextResponse.json({error:"No se pudo confirmar la corrida."},{status:500});
  }
}
