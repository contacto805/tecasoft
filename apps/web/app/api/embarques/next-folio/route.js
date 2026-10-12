import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET: returns next auto TCV-VTA-00001 style consecutive sales folio for embarques
export async function GET() {
  try {
    const res = await sql`
      SELECT factura_folio FROM load_history 
      WHERE factura_folio LIKE 'TCV-VTA-%' 
      ORDER BY created_at DESC, id DESC 
      LIMIT 1
    `;
    if (!res || res.length === 0) {
      return NextResponse.json({ nextFolio: "TCV-VTA-00001" });
    }
    const last = res[0].factura_folio || "TCV-VTA-00000";
    const numPartMatch = last.match(/TCV-VTA-(\d+)/i);
    const num = numPartMatch ? parseInt(numPartMatch[1], 10) : 0;
    const nextNum = num + 1;
    const nextFolio = `TCV-VTA-${String(nextNum).padStart(5, "0")}`;
    return NextResponse.json({ nextFolio });
  } catch (e) {
    console.error("next-folio embarques error", e);
    return NextResponse.json({ nextFolio: "TCV-VTA-00001" });
  }
}
