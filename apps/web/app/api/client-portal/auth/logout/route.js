import { NextResponse } from "next/server";
import { destroyCustomerSession } from "@/app/api/utils/customer-portal-auth";

export async function POST() {
  await destroyCustomerSession();
  return NextResponse.json({ success: true });
}
