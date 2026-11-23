import {NextResponse} from "next/server";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
import {movePhysicalPallet} from "@/app/api/utils/pallet-location";

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:'Inicia sesión para mover tarimas.'},{status:401});
    const {id,target,expected} = await request.json();
    if (!id || !expected) return NextResponse.json({error:'Selecciona una tarima y su ubicación.'},{status:400});
    const {status,...result} = await movePhysicalPallet({id,target,expected,user});
    return NextResponse.json(result,{status});
  } catch (error) {
    console.error('Movimiento de Embarques:',error.message);
    return NextResponse.json({error:'No se pudo mover la tarima.'},{status:500});
  }
}
