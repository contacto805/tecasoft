import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const limit = searchParams.get('limit') || '100';

    let auditRecords;

    if (documentId) {
      auditRecords = await sql`
        SELECT * FROM payment_document_audit
        WHERE document_id = ${documentId}
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `;
    } else if (userId) {
      auditRecords = await sql`
        SELECT * FROM payment_document_audit
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `;
    } else if (action) {
      auditRecords = await sql`
        SELECT * FROM payment_document_audit
        WHERE action = ${action}
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `;
    } else {
      auditRecords = await sql`
        SELECT * FROM payment_document_audit
        ORDER BY timestamp DESC
        LIMIT ${parseInt(limit)}
      `;
    }

    return NextResponse.json(auditRecords);

  } catch (error) {
    console.error('Error fetching audit records:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
