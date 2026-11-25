import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";

// GET: available tarimas for reempaque + list of reempaques
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "available";

    if (type === "available") {
      // Available tarimas: not embarked, not reserved/sold
      let rows = await sql`
        SELECT 
          p.id, p.folio_tarima, p.lot_id, p.lot_number, p.caliber, p.class_name,
          p.pallet_count, p.package_kg, p.boxes_count, p.total_kg, p.packing_date, p.cold_date, p.warehouse_slot,
          p.estado, p.ubicacion_actual
        FROM pallet_output_summary p
        WHERE p.embarque_id IS NULL AND p.package_kg IN (6,10)
          AND COALESCE(p.ubicacion_actual,'') NOT LIKE 'TRAILER-%'
          AND UPPER(COALESCE(p.estado,'')) NOT IN ('EMBARCADA','CANCELADA','REEMPACADA')
        ORDER BY p.cold_date DESC NULLS LAST, p.id DESC
        LIMIT 200
      `;
      if (q) {
        const qq = `%${q.toLowerCase()}%`;
        rows = rows.filter(r =>
          (r.folio_tarima || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.lot_number || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.caliber || '').toLowerCase().includes(q.toLowerCase())
        );
      }
      return NextResponse.json(rows);
    }

    // list reempaques
    const ops = await sql`
      SELECT * FROM reempaque_operations ORDER BY created_at DESC LIMIT 50
    `;
    return NextResponse.json(ops);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user) return NextResponse.json({error:"Inicia sesión para registrar el reempaque."},{status:401});
    const body = await request.json();
    const [row] = await sql`SELECT erp_repack(${JSON.stringify(body)}::jsonb,${user.id}) AS result`;
    return NextResponse.json({success:true,op:row.result,folio:row.result.folio});
  } catch (error) {
    if (["23514","22P02","22007"].includes(error.code)) return NextResponse.json({error:error.message},{status:422});
    console.error("Error al reempacar",error);
    return NextResponse.json({error:"No se pudo registrar el reempaque."},{status:500});
  }
}
