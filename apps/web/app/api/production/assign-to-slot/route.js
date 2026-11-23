import { NextResponse } from "next/server";
import {movePhysicalPallet} from "@/app/api/utils/pallet-location";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:'Inicia sesión para asignar tarimas.'},{status:401});
    const {pallet_output_id,slot_id} = await request.json();
    const {status,...result} = await movePhysicalPallet({id:pallet_output_id,
      target:String(slot_id || '').trim().toUpperCase(),allowTrailer:false,user});
    return NextResponse.json({success:status===200,...result},{status});
  } catch (error) {
    console.error('Asignación de tarima:',error.message);
    return NextResponse.json({error:'No se pudo asignar la tarima.'},{status:500});
  }
}
