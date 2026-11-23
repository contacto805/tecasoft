import sql from "@/app/api/utils/sql";
import {NextResponse} from "next/server";
import {getCustomerLedger} from "@/app/api/utils/customer-account-ledger";

export async function GET(request) {
  try {
    const customerId=new URL(request.url).searchParams.get('customerId');
    if (!/^\d+$/.test(customerId || '')) return NextResponse.json({error:'Cliente inválido.'},{status:400});
    const [ledger,attachments] = await Promise.all([
      getCustomerLedger(customerId),
      sql`SELECT 'CFDI adjunto' AS tipo,folio_interno AS folio,fecha_timbrado AS fecha
        FROM cfdi_facturas WHERE customer_id=${customerId}
        UNION ALL
        SELECT 'Aplicación' AS tipo,'AP-'||ap.id,ap.fecha_aplicacion
        FROM abono_aplicaciones ap JOIN notas n ON n.id=ap.nota_id WHERE n.customer_id=${customerId}`,
    ]);
    const movements = [...ledger.movimientos.map(row=>({
      fecha:row.fecha,tipo:row.tipo==='CARGO'?'Nota':'Depósito',folio:row.folio,
      cargo:row.cargo,abono:row.abono
    })),...attachments.map(row=>({...row,cargo:0,abono:0}))];
    movements.sort((a,b)=>String(a.fecha || '').localeCompare(String(b.fecha || '')) || b.cargo-a.cargo);
    let balance=0;
    const out=movements.map(row=>{
      balance+=row.cargo-row.abono;
      return {...row,saldo_running:Math.round(balance*100)/100};
    });
    return NextResponse.json({movimientos:out,resumen:{
      total_cargo_usd:ledger.resumen.total_cargos_usd,
      total_abono_usd:ledger.resumen.total_abonos_usd,
      saldo_pendiente_usd:ledger.resumen.saldo_por_pagar_usd,
      total_abonos:ledger.movimientos.filter(row=>row.tipo==='ABONO').length
    }});
  } catch (error) {
    console.error('Estado de cuenta:',error.message);
    return NextResponse.json({error:'No se pudo consultar el estado de cuenta.'},{status:500});
  }
}
