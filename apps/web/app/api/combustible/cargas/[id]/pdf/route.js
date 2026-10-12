import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

async function getSessionUser() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/auth/user`, { credentials: 'include' });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { id: 'sistema', name: 'Sistema', admin_role: '' };
}

function formatDateMX(d) {
  if (!d) return 'No registrado';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return 'No registrado'; }
}
function formatDateTimeMX(d, h) {
  const date = formatDateMX(d);
  if (!h) return date;
  return `${date} ${h}`;
}
function money(v) {
  if (v === null || v === undefined || isNaN(parseFloat(v))) return 'No calculable';
  const n = parseFloat(v);
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num2(v, def = 'No registrado') {
  if (v === null || v === undefined || isNaN(parseFloat(v))) return def;
  return parseFloat(v).toFixed(2);
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cargaId = parseInt(id);
    if (!cargaId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const user = await getSessionUser();

    // Fetch full record
    const [carga] = await sql`SELECT * FROM combustible_cargas WHERE id = ${cargaId} LIMIT 1`;
    if (!carga) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    // Fetch docs
    const docs = await sql`SELECT * FROM combustible_documentos WHERE carga_id = ${cargaId} AND activo = true ORDER BY fecha_carga DESC`;

    // Config
    const cfgRows = await sql`SELECT config_key, config_value FROM combustible_configuracion`;
    const config = {};
    cfgRows.forEach(r => { config[r.config_key] = r.config_value; });

    const company = {
      razon_social: config.razon_social || 'Comercializadora de Frutas de Tacámbaro, S.A. de C.V.',
      nombre_comercial: config.company_name || config.nombre_comercial || 'Tecavo Fruits',
      eslogan: config.slogan || config.eslogan || 'Del campo con amor',
      ubicacion: config.ubicacion || 'Tacámbaro, Michoacán, México',
      correo: config.correo || config.email || 'jorge.perezvelez@tecavofruits.com',
      telefono: config.telefono || config.whatsapp || '459 104 55 66',
      logo_url: config.logo_url || ''
    };

    // Snapshot if not present (save current for historical fidelity)
    let snapshot = carga.company_snapshot;
    if (!snapshot) {
      snapshot = company;
      await sql`UPDATE combustible_cargas SET company_snapshot = ${JSON.stringify(snapshot)} WHERE id = ${cargaId}`;
    }

    // Use snapshot for the document
    const usedCompany = snapshot || company;

    // Calculations (server authoritative)
    const litros = parseFloat(carga.litros) || 0;
    const precio = parseFloat(carga.precio_litro) || 0;
    const ticket = parseFloat(carga.importe_ticket) || 0;
    const importeCalculado = Math.round(litros * precio * 100) / 100;
    const diferencia = Math.round((importeCalculado - ticket) * 100) / 100;

    const kmAnt = parseFloat(carga.kilometraje_carga_anterior || carga.kilometraje_anterior) || 0;
    const kmAct = parseFloat(carga.kilometraje_actual) || 0;
    const kmRecorridos = Math.max(0, kmAct - kmAnt);

    let rendimiento = null;
    let costoKm = null;
    let rendNote = null;

    const prevFull = carga.tanque_lleno && (carga.carga_comparable !== false);
    if (carga.tanque_lleno && prevFull && kmRecorridos > 0 && litros > 0) {
      rendimiento = Math.round((kmRecorridos / litros) * 100) / 100;
      if (kmRecorridos > 0) costoKm = Math.round((ticket / kmRecorridos) * 100) / 100;
    } else {
      rendNote = 'No calculable (requiere tanque lleno en carga actual y anterior, mismo vehículo, sin cargas intermedias, km y litros válidos)';
    }

    // Estado documental
    const hasFacturaNum = !!(carga.numero_factura && String(carga.numero_factura).trim());
    const hasFotoTicket = !!(carga.comprobante_url) || docs.some(d => d.tipo_documento === 'FOTO_TICKET');
    const hasArchivoFactura = docs.some(d => ['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento));

    let comp = 0;
    if (hasFacturaNum) comp++;
    if (hasFotoTicket) comp++;
    if (hasArchivoFactura) comp++;

    let estadoDoc = 'PENDIENTE_TOTAL';
    if (comp === 3) estadoDoc = 'COMPLETO';
    else if (comp === 0) estadoDoc = 'PENDIENTE_TOTAL';
    else if (!hasFacturaNum && !hasFotoTicket && !hasArchivoFactura) estadoDoc = 'PENDIENTE_MULTIPLE';
    else if (!hasFacturaNum) estadoDoc = 'PENDIENTE_FACTURA_NUMERO';
    else if (!hasFotoTicket) estadoDoc = 'PENDIENTE_FOTO_TICKET';
    else if (!hasArchivoFactura) estadoDoc = 'PENDIENTE_ARCHIVO_FACTURA';
    else estadoDoc = 'PENDIENTE_MULTIPLE';

    // Estatus label
    const estatusLabel = (carga.estatus || 'borrador').toUpperCase();

    // Build display values per spec (all server computed, no client values trusted)
    const data = {
      id: carga.id,
      folio: carga.folio || 'SIN FOLIO',
      estatus: estatusLabel,
      fecha_impresion: new Date().toLocaleString('es-MX'),
      fecha_hora: formatDateTimeMX(carga.fecha_carga, carga.hora_carga),
      corredor: carga.corredor_nombre || 'No registrado',
      vehiculo: carga.vehiculo_nombre || 'No registrado',
      placas: carga.placas_capturadas || 'No registrado',
      origen: carga.ruta_origen || 'No registrado',
      destino: carga.ruta_destino || 'No registrado',
      motivo: carga.motivo_viaje || 'No registrado',
      km_anterior: num2(kmAnt, 'No registrado'),
      km_actual: num2(kmAct, 'No registrado'),
      gasolinera: carga.gasolinera_nombre || 'No registrado',
      combustible: carga.combustible_tipo || 'No registrado',
      metodo_pago: carga.metodo_pago || 'No registrado',
      tanque_lleno: carga.tanque_lleno ? 'Sí' : 'No',
      numero_ticket: carga.numero_ticket || 'No registrado',
      litros: num2(litros),
      precio_litro: num2(precio),
      importe_calculado: money(importeCalculado),
      total_ticket: money(ticket),
      diferencia: money(diferencia),
      km_recorridos: num2(kmRecorridos, 'No calculable'),
      rendimiento: rendimiento !== null ? num2(rendimiento) : (rendNote || 'No calculable'),
      costo_km: costoKm !== null ? money(costoKm) : 'No calculable',
      huerta_productor: 'No relacionado',
      lote: 'No relacionado',
      orden_corte: 'No relacionado',
      centro_costo: 'No aplica',
      numero_factura: carga.numero_factura || 'No registrado',
      estado_ticket: hasFotoTicket ? 'CARGADO' : 'PENDIENTE',
      estado_factura: hasArchivoFactura ? 'CARGADO' : 'PENDIENTE',
      estado_documental: estadoDoc,
      documentos_completos: `${comp} de 3`,
      observaciones: carga.observaciones || 'No registrado',
      usuario_registro: carga.creado_por || 'Sistema',
      usuario_autorizacion: carga.autorizado_por || (carga.estatus === 'autorizado' ? 'No registrado' : 'No aplica'),
      motivo_rechazo: carga.motivo_rechazo || null,
      motivo_cancelacion: carga.motivo_cancelacion || null,
      cancelado_por: carga.cancelado_por || null,
      cancelado_en: carga.cancelado_en ? formatDateMX(carga.cancelado_en) : null,
    };

    // QR
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.tecavo.com';
    const qrTarget = `${base}/combustible?folio=${encodeURIComponent(carga.folio)}`;
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(qrTarget, { width: 180, margin: 1, errorCorrectionLevel: 'M' });
    } catch (e) {
      qrDataUrl = null;
    }

    // Audit the generation (reimpresion or first)
    await sql`
      INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo, fecha_hora)
      VALUES (${cargaId}, ${carga.folio}, 'IMPRESO_PDF', ${user?.name || user?.email || 'usuario'}, 'Generación de comprobante PDF', CURRENT_TIMESTAMP)
    `;

    // Update last printed
    await sql`UPDATE combustible_cargas SET last_printed_at = CURRENT_TIMESTAMP, last_printed_by = ${user?.name || 'sistema'} WHERE id = ${cargaId}`;

    return NextResponse.json({
      success: true,
      data,
      company: usedCompany,
      config: {
        primary: config.primary_color || '#0B4F2B',
        accent: config.accent_color || '#E9E45A',
        terracota: config.terracota || '#A73D20'
      },
      qr: qrDataUrl,
      qr_url: qrTarget,
      isDraft: false,
      isCancelado: carga.estatus === 'cancelado',
      isRechazado: carga.estatus === 'rechazado'
    });
  } catch (e) {
    console.error('PDF data error', e);
    return NextResponse.json({ error: 'Error generando datos del PDF' }, { status: 500 });
  }
}
