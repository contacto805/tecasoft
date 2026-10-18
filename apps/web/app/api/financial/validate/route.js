import { NextResponse } from "next/server";
import { validateFinancialConsistency } from "@/app/api/utils/financial-engine";

export async function POST(request) {
  try {
    const body = await request.json();
    const res = await validateFinancialConsistency(body);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
