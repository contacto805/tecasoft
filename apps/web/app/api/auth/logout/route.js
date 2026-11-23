import { ERP_PROOF_COOKIE } from "@/app/api/utils/erp-session-proof";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("better-auth.session_token");
    cookieStore.delete("tecavo_session_token");
    cookieStore.delete(ERP_PROOF_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
