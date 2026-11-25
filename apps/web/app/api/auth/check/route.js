import { NextResponse } from "next/server";
import { getVerifiedErpUser } from "@/app/api/utils/erp-session-proof";

export async function GET() {
  try {
    return NextResponse.json({authenticated:!!(await getVerifiedErpUser())});
  } catch {
    return NextResponse.json({authenticated:false});
  }
}
