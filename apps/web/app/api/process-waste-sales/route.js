import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";
import { mexicoToday,validDate } from "@/utils/closing-period";

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:"Inicia sesión para registrar la venta."},{status:401});
    const {lot_id,customer_id,sale_type,caliber,quantity_kg,price_per_kg,sale_date,currency="MXN",exchange_rate,notes,idempotency_key} = await request.json();
    const lot=Number(lot_id), customer=Number(customer_id);
    const qty=Number(quantity_kg), price=Number(price_per_kg);
    const ccy=String(currency).toUpperCase();
    const fx=ccy==="USD"?Number(exchange_rate):1;
    const date=sale_date||mexicoToday();
    if (![lot,customer].every(id=>Number.isSafeInteger(id)&&id>0) || !["process","waste"].includes(sale_type) ||
      ![qty,price,fx].every(Number.isFinite) || qty<=0 || price<0 || fx<=0 || !validDate(date)) {
      return NextResponse.json({error:"Verifica lote, cliente, fecha, kilos, precio y tipo de cambio."},{status:400});
    }
    const key=String(request.headers.get("Idempotency-Key")||idempotency_key||JSON.stringify([user.id,lot,customer,sale_type,caliber,qty,price,date,ccy,fx]));
    const [row] = await sql`SELECT erp_sell_subproduct(${lot},${customer},${sale_type},${caliber||null},
      ${qty},${price},${date},${ccy},${fx},${notes||null},${user.id},${key}) AS result`;
    return NextResponse.json(row.result);
  } catch (error) {
    const status={P0002:404,23514:422,23505:409}[error.code];
    if (status) return NextResponse.json({error:error.message},{status});
    console.error("Error al registrar venta de subproducto",error);
    return NextResponse.json({error:"No se pudo registrar la venta."},{status:500});
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get('lotId');
    const saleType = searchParams.get('type');

    if (!lotId) {
      return NextResponse.json({ error: "lotId required" }, { status: 400 });
    }

    let query = sql`
      SELECT * FROM sales_of_process_and_waste
      WHERE lot_id = ${parseInt(lotId)}
    `;

    if (saleType === 'process') {
      query = sql`
        SELECT * FROM sales_of_process_and_waste
        WHERE lot_id = ${parseInt(lotId)} AND process_kg > 0
      `;
    } else if (saleType === 'waste') {
      query = sql`
        SELECT * FROM sales_of_process_and_waste
        WHERE lot_id = ${parseInt(lotId)} AND waste_kg > 0
      `;
    }

    const sales = await query;
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Error in GET /api/process-waste-sales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
