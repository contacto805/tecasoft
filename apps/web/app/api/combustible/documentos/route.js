import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

async function getSessionUser(request) {
  try {
    const base = new URL(request.url).origin;
    const res = await fetch(`${base}/api/auth/user`, { 
      headers: { cookie: request.headers.get('cookie') || '' } 
    });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { id: 'sistema', name: 'Sistema', admin_role: '' };
}

function calcularHash(str) {
  // Simple hash for duplicate detect
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return 'h' + Math.abs(h).toString(16);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cargaId = searchParams.get('carga_id');
    const folio = searchParams.get('folio');

    if (!cargaId && !folio) {
      return NextResponse.json({ error: 'carga_id o folio requerido' }, { status: 400 });
    }

    let where = sql``;
    if (cargaId) where = sql`WHERE d.carga_id = ${parseInt(cargaId)} AND d.activo = true`;
    else where = sql`WHERE d.folio = ${folio} AND d.activo = true`;

    const docs = await sql`
      SELECT d.* FROM combustible_documentos d
      ${where}
      ORDER BY d.fecha_carga DESC, d.id DESC
    `;
    return NextResponse.json(docs);
  } catch (e) {
    console.error('GET docs error', e);
    return NextResponse.json({ error: 'Error al consultar documentos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await getSessionUser(request);
    const usuario = body.usuario_carga || user?.name || user?.email || 'usuario';

    const { carga_id, folio, tipo_documento, nombre_original, ruta_almacenamiento, mime_type, tamano_bytes, numero_factura } = body;

    if (!carga_id || !tipo_documento || !ruta_almacenamiento) {
      return NextResponse.json({ error: 'Datos de documento incompletos' }, { status: 400 });
    }

    // Find carga
    const [carga] = await sql`SELECT * FROM combustible_cargas WHERE id = ${parseInt(carga_id)} LIMIT 1`;
    if (!carga) return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });

    const hash = calcularHash(ruta_almacenamiento + (nombre_original || ''));

    // Check duplicate
    const dup = await sql`SELECT id FROM combustible_documentos WHERE hash_archivo = ${hash} AND activo = true LIMIT 1`;
    if (dup.length > 0) {
      return NextResponse.json({ error: 'Archivo duplicado ya registrado' }, { status: 409 });
    }

    const [doc] = await sql`
      INSERT INTO combustible_documentos (
        carga_id, folio, tipo_documento, nombre_original, nombre_interno,
        mime_type, tamano_bytes, ruta_almacenamiento, hash_archivo,
        usuario_carga, fecha_carga, version, activo, sincronizado
      ) VALUES (
        ${parseInt(carga_id)}, ${folio || carga.folio}, ${tipo_documento},
        ${nombre_original || 'documento'}, ${nombre_original || 'doc-' + Date.now()},
        ${mime_type || 'application/octet-stream'}, ${tamano_bytes || 0},
        ${ruta_almacenamiento}, ${hash}, ${usuario}, CURRENT_TIMESTAMP, 1, true, true
      ) RETURNING *
    `;

    // Update numero_factura if provided and is factura
    if (numero_factura && (tipo_documento === 'FACTURA_PDF' || tipo_documento === 'FACTURA_XML')) {
      await sql`UPDATE combustible_cargas SET numero_factura = ${numero_factura} WHERE id = ${parseInt(carga_id)}`;
    }

    // Audit
    await sql`
      INSERT INTO combustible_auditoria (carga_id, folio, accion, campo_modificado, valor_nuevo, usuario, fecha_hora, motivo)
      VALUES (${carga.id}, ${carga.folio}, 'DOCUMENTO_AGREGADO', ${tipo_documento}, ${ruta_almacenamiento}, ${usuario}, CURRENT_TIMESTAMP, 'Carga de ' + tipo_documento)
    `;

    // Recalculate estado
    await recalcularEstadoDocumental(parseInt(carga_id), usuario);

    return NextResponse.json({ success: true, documento: doc });
  } catch (e) {
    console.error('POST doc error', e);
    return NextResponse.json({ error: e.message || 'Error al guardar documento' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const user = await getSessionUser(request);
    const usuario = body.usuario || user?.name || user?.email || 'usuario';
    const id = parseInt(body.id);
    const cargaId = parseInt(body.carga_id);

    if (!id || !cargaId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const [current] = await sql`SELECT * FROM combustible_documentos WHERE id = ${id} LIMIT 1`;
    if (!current) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

    // Mark old as replaced
    await sql`
      UPDATE combustible_documentos SET 
        reemplazado = true, 
        activo = false 
      WHERE id = ${id}
    `;

    // Insert new version
    const hash = calcularHash((body.ruta_almacenamiento || current.ruta_almacenamiento) + (body.nombre_original || ''));
    const [nuevo] = await sql`
      INSERT INTO combustible_documentos (
        carga_id, folio, tipo_documento, nombre_original, nombre_interno,
        mime_type, tamano_bytes, ruta_almacenamiento, hash_archivo,
        usuario_carga, fecha_carga, version, activo, sincronizado
      ) VALUES (
        ${current.carga_id}, ${current.folio}, ${current.tipo_documento},
        ${body.nombre_original || current.nombre_original}, ${body.nombre_interno || current.nombre_interno},
        ${body.mime_type || current.mime_type}, ${body.tamano_bytes || current.tamano_bytes},
        ${body.ruta_almacenamiento || current.ruta_almacenamiento}, ${hash},
        ${usuario}, CURRENT_TIMESTAMP, ${ (current.version||1) + 1 }, true, true
      ) RETURNING *
    `;

    // Audit replacement
    await sql`
      INSERT INTO combustible_auditoria (
        carga_id, folio, accion, campo_modificado, valor_anterior, valor_nuevo, usuario, fecha_hora, motivo
      ) VALUES (
        ${current.carga_id}, ${current.folio}, 'DOCUMENTO_REEMPLAZADO', ${current.tipo_documento},
        ${current.ruta_almacenamiento}, ${nuevo.ruta_almacenamiento}, ${usuario}, CURRENT_TIMESTAMP,
        ${body.motivo || 'Reemplazo autorizado'}
      )
    `;

    if (body.numero_factura) {
      await sql`UPDATE combustible_cargas SET numero_factura = ${body.numero_factura} WHERE id = ${current.carga_id}`;
    }

    await recalcularEstadoDocumental(current.carga_id, usuario);

    return NextResponse.json({ success: true, documento: nuevo });
  } catch (e) {
    console.error('PUT doc error', e);
    return NextResponse.json({ error: e.message || 'Error al reemplazar' }, { status: 500 });
  }
}

async function recalcularEstadoDocumental(cargaId, usuario) {
  const [carga] = await sql`SELECT * FROM combustible_cargas WHERE id = ${cargaId} LIMIT 1`;
  if (!carga) return;

  const docs = await sql`
    SELECT * FROM combustible_documentos 
    WHERE carga_id = ${cargaId} AND activo = true
  `;

  const tieneNumeroFactura = !!(carga.numero_factura && String(carga.numero_factura).trim());
  const tieneFotoTicket = docs.some(d => d.tipo_documento === 'FOTO_TICKET');
  const tieneArchivoFactura = docs.some(d => ['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento));

  let estado = 'PENDIENTE_TOTAL';
  let completos = 0;

  if (tieneNumeroFactura) completos++;
  if (tieneFotoTicket) completos++;
  if (tieneArchivoFactura) completos++;

  if (completos === 3) {
    estado = 'COMPLETO';
  } else if (completos === 0) {
    estado = 'PENDIENTE_TOTAL';
  } else if (!tieneNumeroFactura && !tieneFotoTicket && !tieneArchivoFactura) {
    estado = 'PENDIENTE_MULTIPLE';
  } else if (!tieneNumeroFactura) {
    estado = 'PENDIENTE_FACTURA_NUMERO';
  } else if (!tieneFotoTicket) {
    estado = 'PENDIENTE_FOTO_TICKET';
  } else if (!tieneArchivoFactura) {
    estado = 'PENDIENTE_ARCHIVO_FACTURA';
  } else {
    estado = 'PENDIENTE_MULTIPLE';
  }

  const completo = completos === 3;

  await sql`
    UPDATE combustible_cargas SET
      estado_documental = ${estado},
      documentacion_completa = ${completo},
      fecha_completado_documental = ${completo ? 'CURRENT_TIMESTAMP' : null},
      actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ${cargaId}
  `;

  // If changed to complete, audit
  if (completo && carga.estado_documental !== 'COMPLETO') {
    await sql`
      INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo)
      VALUES (${cargaId}, ${carga.folio}, 'EXPEDIENTE_COMPLETO', ${usuario || 'sistema'}, 'Los 3 requisitos documentales completados')
    `;
  }
}
