import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener solicitudes de compra
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const areaId = searchParams.get('areaId');
    const priority = searchParams.get('priority');
    const userId = searchParams.get('userId');

    let where = sql`WHERE 1=1`;
    
    if (status) {
      where = sql`${where} AND status = ${status}`;
    }
    
    if (areaId) {
      where = sql`${where} AND area_id = ${parseInt(areaId)}`;
    }
    
    if (priority) {
      where = sql`${where} AND priority = ${priority}`;
    }
    
    if (userId) {
      where = sql`${where} AND user_id = ${userId}`;
    }

    const requests = await sql`
      SELECT * FROM purchase_requests
      ${where}
      ORDER BY 
        CASE priority
          WHEN 'urgente' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          WHEN 'baja' THEN 4
        END,
        request_date DESC
    `;

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching purchase requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear solicitud de compra
export async function POST(request) {
  try {
    const {
      areaId,
      areaName,
      userId,
      userName,
      supervisorName,
      purchaseType,
      categoryId,
      categoryName,
      productOrService,
      description,
      unitOfMeasure,
      quantityRequired,
      quantityMinimum,
      quantitySuggested,
      priority,
      justification,
      requiredDate,
      attachments
    } = await request.json();

    if (!areaId || !userName || !productOrService || !justification) {
      return NextResponse.json(
        { error: 'Campos requeridos: areaId, userName, productOrService, justification' },
        { status: 400 }
      );
    }

    // Generar folio consecutivo
    const [lastRequest] = await sql`
      SELECT folio FROM purchase_requests
      ORDER BY id DESC
      LIMIT 1
    `;

    let folioNumber = 1;
    if (lastRequest) {
      const match = lastRequest.folio.match(/REQ-\d{4}-(\d+)/);
      if (match) {
        folioNumber = parseInt(match[1]) + 1;
      }
    }

    const year = new Date().getFullYear();
    const folio = `REQ-${year}-${String(folioNumber).padStart(3, '0')}`;

    const [result] = await sql`
      INSERT INTO purchase_requests (
        folio,
        request_date,
        area_id,
        area_name,
        user_id,
        user_name,
        supervisor_name,
        purchase_type,
        category_id,
        category_name,
        product_or_service,
        description,
        unit_of_measure,
        quantity_required,
        quantity_minimum,
        quantity_suggested,
        priority,
        justification,
        required_date,
        attachments,
        status
      )
      VALUES (
        ${folio},
        CURRENT_DATE,
        ${parseInt(areaId)},
        ${areaName || null},
        ${userId || null},
        ${userName},
        ${supervisorName || null},
        ${purchaseType || null},
        ${categoryId ? parseInt(categoryId) : null},
        ${categoryName || null},
        ${productOrService},
        ${description || null},
        ${unitOfMeasure || null},
        ${quantityRequired || null},
        ${quantityMinimum || null},
        ${quantitySuggested || null},
        ${priority || 'media'},
        ${justification},
        ${requiredDate || null},
        ${attachments ? JSON.stringify(attachments) : null},
        'enviada'
      )
      RETURNING *
    `;

    // Registrar en historial de estatus
    await sql`
      INSERT INTO purchase_request_status_history (
        request_id,
        status,
        changed_by,
        comments
      )
      VALUES (
        ${result.id},
        'enviada',
        ${userName},
        'Solicitud creada'
      )
    `;

    // Crear alerta para administración
    await sql`
      INSERT INTO system_alerts (
        alert_type,
        priority,
        module,
        title,
        message,
        entity_type,
        entity_id,
        assigned_to,
        status
      )
      VALUES (
        'nueva_requisicion',
        ${priority || 'media'},
        'compras',
        ${`Nueva requisición ${folio}`},
        ${`${userName} ha creado una nueva solicitud de compra: ${productOrService}`},
        'purchase_request',
        ${result.id},
        ARRAY['super_admin', 'administracion']::TEXT[],
        'activa'
      )
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar solicitud de compra
export async function PUT(request) {
  try {
    const { id, status, comments, changedBy, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    let updateFields = sql``;
    const fields = [];

    if (status) {
      fields.push(sql`status = ${status}`);
    }

    if (updates.priority) {
      fields.push(sql`priority = ${updates.priority}`);
    }

    if (updates.productOrService) {
      fields.push(sql`product_or_service = ${updates.productOrService}`);
    }

    if (updates.description) {
      fields.push(sql`description = ${updates.description}`);
    }

    if (updates.quantityRequired) {
      fields.push(sql`quantity_required = ${updates.quantityRequired}`);
    }

    if (updates.requiredDate) {
      fields.push(sql`required_date = ${updates.requiredDate}`);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    fields.push(sql`updated_at = CURRENT_TIMESTAMP`);

    for (let i = 0; i < fields.length; i++) {
      if (i === 0) {
        updateFields = fields[i];
      } else {
        updateFields = sql`${updateFields}, ${fields[i]}`;
      }
    }

    const [result] = await sql`
      UPDATE purchase_requests
      SET ${updateFields}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Registrar cambio de estatus
    if (status) {
      await sql`
        INSERT INTO purchase_request_status_history (
          request_id,
          status,
          changed_by,
          comments
        )
        VALUES (
          ${result.id},
          ${status},
          ${changedBy || 'Sistema'},
          ${comments || null}
        )
      `;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating purchase request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Cancelar solicitud
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      UPDATE purchase_requests
      SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!result) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Registrar cancelación
    await sql`
      INSERT INTO purchase_request_status_history (
        request_id,
        status,
        changed_by,
        comments
      )
      VALUES (
        ${result.id},
        'cancelado',
        ${userId || 'Sistema'},
        'Solicitud cancelada'
      )
    `;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting purchase request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
