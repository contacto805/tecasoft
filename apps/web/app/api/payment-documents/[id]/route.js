import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const [document] = await sql`
      SELECT * FROM payment_documents
      WHERE id = ${id}
      AND is_active = true
    `;

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(document);

  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, observations, userId, userName } = body;

    const [document] = await sql`
      UPDATE payment_documents
      SET 
        status = COALESCE(${status}, status),
        observations = COALESCE(${observations}, observations),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    // Registrar en auditoría
    await sql`
      INSERT INTO payment_document_audit (
        document_id,
        user_id,
        user_name,
        action,
        document_name
      ) VALUES (
        ${id},
        ${userId || 'system'},
        ${userName || 'Sistema'},
        'updated',
        ${document.original_file_name}
      )
    `;

    return NextResponse.json({ success: true, document });

  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');

    // Obtener documento antes de marcarlo como eliminado
    const [document] = await sql`
      SELECT * FROM payment_documents
      WHERE id = ${id}
      AND is_active = true
    `;

    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    // Marcar como inactivo (soft delete)
    await sql`
      UPDATE payment_documents
      SET 
        is_active = false,
        deleted_at = NOW(),
        deleted_by = ${userId || 'system'}
      WHERE id = ${id}
    `;

    // Registrar en auditoría
    await sql`
      INSERT INTO payment_document_audit (
        document_id,
        user_id,
        user_name,
        action,
        document_name
      ) VALUES (
        ${id},
        ${userId || 'system'},
        ${userName || 'Sistema'},
        'deleted',
        ${document.original_file_name}
      )
    `;

    return NextResponse.json({ 
      success: true,
      message: 'Documento eliminado correctamente'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
