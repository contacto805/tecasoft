import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getMexicoCityTime } from "@/app/api/utils/mexico-time";
import { logMovement } from "@/app/api/utils/recalculate";

async function getSessionUser() {
  // Reuse pattern from menu
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/auth/user`, { credentials: 'include' });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { id: 'sistema', name: 'Sistema', admin_role: '' };
}

async function generateUniqueFolio() {
  // Global ascending sequence per spec: COMB-000001 (no year in visible folio)
  // Uses transactional lock on anio=0 row for concurrency safety
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let [row] = await sql`SELECT ultimo_consecutivo FROM combustible_folios WHERE anio = 0 FOR UPDATE`;
      if (!row) {
        await sql`INSERT INTO combustible_folios (anio, ultimo_consecutivo) VALUES (0, 0) ON CONFLICT (anio) DO NOTHING`;
        row = { ultimo_consecutivo: 0 };
      }
      const next = (row.ultimo_consecutivo || 0) + 1;
      const folio = `COMB-${String(next).padStart(6, '0')}`;
      // Double check uniqueness before commit
      const exists = await sql`SELECT 1 FROM combustible_cargas WHERE folio = ${folio} LIMIT 1`;
      if (exists.length === 0) {
        await sql`UPDATE combustible_folios SET ultimo_consecutivo = ${next}, actualizado_en = CURRENT_TIMESTAMP WHERE anio = 0`;
        return { folio, folio_anio: 0, folio_consecutivo: next };
      }
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
    }
  }
  throw new Error('No se pudo generar folio único');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const folio = searchParams.get('folio');
    const estatus = searchParams.get('estatus');
    const corredor = searchParams.get('corredor');
    const vehiculo = searchParams.get('vehiculo');
    const vehiculoId = searchParams.get('vehiculo_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const pendientes = searchParams.get('pendientes') === 'true';

    if (id) {
      const [c] = await sql`
        SELECT c.*, 
          l.lot_number as linked_lot_number, l.producer as linked_producer,
          o.name as linked_orchard_name
        FROM combustible_cargas c
        LEFT JOIN lots l ON c.lote_id = l.id
        LEFT JOIN orchards o ON c.huerta_id = o.id
        WHERE c.id = ${parseInt(id)} LIMIT 1
      `;
      return NextResponse.json(c || null);
    }

    let where = sql`WHERE 1=1`;
    if (folio) where = sql`${where} AND c.folio ILIKE ${'%' + folio + '%'}`;
    if (estatus) where = sql`${where} AND c.estatus = ${estatus}`;
    if (corredor) where = sql`${where} AND c.corredor_nombre ILIKE ${'%' + corredor + '%'}`;
    if (vehiculo) where = sql`${where} AND (c.vehiculo_nombre ILIKE ${'%' + vehiculo + '%'} OR c.placas_capturadas ILIKE ${'%' + vehiculo + '%'})`;
    if (vehiculoId) where = sql`${where} AND c.vehiculo_id = ${parseInt(vehiculoId)}`;
    if (from) where = sql`${where} AND c.fecha_carga >= ${from}`;
    if (to) where = sql`${where} AND c.fecha_carga <= ${to}`;
    if (pendientes) where = sql`${where} AND c.estatus = 'pendiente'`;
    const ed = searchParams.get('estado_documental');
    if (ed) where = sql`${where} AND c.estado_documental = ${ed}`;

    const cargas = await sql`
      SELECT c.*, 
        l.lot_number as linked_lot_number, l.producer as linked_producer, l.fruit_type as linked_fruit_type,
        o.name as linked_orchard_name, o.producer as linked_orchard_producer
      FROM combustible_cargas c
      LEFT JOIN lots l ON c.lote_id = l.id
      LEFT JOIN orchards o ON c.huerta_id = o.id
      ${where}
      ORDER BY c.fecha_carga DESC, c.id DESC
      LIMIT 500
    `;
    return NextResponse.json(cargas);
  } catch (e) {
    console.error('GET cargas error', e);
    return NextResponse.json({ error: 'Error al consultar cargas' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await getSessionUser();
    const creadoPor = body.creado_por || user?.name || user?.email || 'usuario';

    // Validate required
    if (!body.vehiculo_id && !body.vehiculo_nombre) {
      return NextResponse.json({ error: 'Vehículo requerido' }, { status: 400 });
    }
    if (!body.corredor_nombre && !body.corredor_id) {
      return NextResponse.json({ error: 'Corredor requerido' }, { status: 400 });
    }
    const litros = parseFloat(body.litros);
    const precio = parseFloat(body.precio_litro);
    const importeTicket = parseFloat(body.importe_ticket);
    if (!litros || litros <= 0) return NextResponse.json({ error: 'Litros debe ser mayor a 0' }, { status: 400 });
    if (!precio || precio <= 0) return NextResponse.json({ error: 'Precio por litro debe ser mayor a 0' }, { status: 400 });
    if (!importeTicket || importeTicket < 0) return NextResponse.json({ error: 'Importe ticket requerido' }, { status: 400 });

    // Generate folio server side
    const folioData = await generateUniqueFolio();

    // Compute server side
    const importeCalculado = Math.round(litros * precio * 100) / 100;
    const diferencia = Math.round((importeCalculado - importeTicket) * 100) / 100;

    // Get vehicle info
    let vName = body.vehiculo_nombre || '';
    let vPlacas = body.placas_capturadas || '';
    if (body.vehiculo_id) {
      const [v] = await sql`SELECT name, plates, tipo_combustible, capacidad_tanque FROM vehicles WHERE id = ${parseInt(body.vehiculo_id)} LIMIT 1`;
      if (v) {
        vName = v.name || vName;
        vPlacas = v.placas || vPlacas;
      }
    }

    // Auto-fill Km anterior from the previous record of the SAME vehicle (enables rendimiento calculation)
    // If frontend provided a value, respect it (user override); otherwise lookup last record
    let kmCargaAnterior = body.kilometraje_carga_anterior ? parseFloat(body.kilometraje_carga_anterior) : null;
    if ((kmCargaAnterior == null || kmCargaAnterior === 0) && body.vehiculo_id) {
      try {
        const [last] = await sql`
          SELECT kilometraje_actual 
          FROM combustible_cargas 
          WHERE vehiculo_id = ${parseInt(body.vehiculo_id)} 
            AND kilometraje_actual IS NOT NULL 
          ORDER BY fecha_carga DESC, id DESC 
          LIMIT 1
        `;
        if (last && last.kilometraje_actual != null) {
          kmCargaAnterior = parseFloat(last.kilometraje_actual);
        }
      } catch (_) {}
    }

    const [created] = await sql`
      INSERT INTO combustible_cargas (
        folio, folio_anio, folio_consecutivo,
        fecha_carga, hora_carga,
        corredor_id, corredor_nombre,
        vehiculo_id, vehiculo_nombre, placas_capturadas,
        kilometraje_actual, kilometraje_carga_anterior, km_al_cargar,
        tanque_lleno, carga_comparable,
        litros, precio_litro, importe_calculado, importe_ticket, diferencia_importe,
        combustible_tipo, gasolinera_id, gasolinera_nombre,
        numero_ticket, numero_factura, metodo_pago,
        ruta_origen, ruta_destino, huerta_id, productor_id, lote_id, orden_corte_id,
        motivo_viaje, observaciones,
        comprobante_url, odometro_foto_url,
        estatus, creado_por, creado_en, version_registro,
        documentacion_completa, estado_documental
      ) VALUES (
        ${folioData.folio}, ${folioData.folio_anio}, ${folioData.folio_consecutivo},
        ${body.fecha_carga || new Date().toISOString().slice(0,10)}, ${body.hora_carga || null},
        ${body.corredor_id || null}, ${body.corredor_nombre || 'Sin nombre'},
        ${body.vehiculo_id ? parseInt(body.vehiculo_id) : null}, ${vName}, ${vPlacas},
        ${parseFloat(body.kilometraje_actual) || 0}, ${kmCargaAnterior}, ${parseFloat(body.km_al_cargar) || null},
        ${!!body.tanque_lleno}, ${body.carga_comparable !== false},
        ${litros}, ${precio}, ${importeCalculado}, ${importeTicket}, ${diferencia},
        ${body.combustible_tipo || 'Magna'}, ${body.gasolinera_id ? parseInt(body.gasolinera_id) : null}, ${body.gasolinera_nombre || null},
        ${body.numero_ticket || null}, ${body.numero_factura || null}, ${body.metodo_pago || 'efectivo'},
        ${body.ruta_origen || null}, ${body.ruta_destino || null}, ${body.huerta_id ? parseInt(body.huerta_id) : null},
        ${body.productor_id ? parseInt(body.productor_id) : null}, ${body.lote_id ? parseInt(body.lote_id) : null}, ${body.orden_corte_id ? parseInt(body.orden_corte_id) : null},
        ${body.motivo_viaje || null}, ${body.observaciones || null},
        ${body.comprobante_url || null}, ${body.odometro_foto_url || null},
        ${body.estatus || 'borrador'}, ${creadoPor}, CURRENT_TIMESTAMP, 1,
        false, ${body.numero_factura ? 'PENDIENTE_MULTIPLE' : 'PENDIENTE_TOTAL'}
      ) RETURNING *
    `;

    // Audit
    await sql`
      INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo)
      VALUES (${created.id}, ${created.folio}, 'CREADO', ${creadoPor}, 'Registro inicial de carga')
    `;

    // Traceability: log link to lot for cross-module consistency
    if (body.lote_id) {
      await logMovement({
        entity_type: 'combustible_carga', entity_id: created.id, lot_id: parseInt(body.lote_id),
        movement_type: 'COMBUSTIBLE_LINK', qty: parseFloat(body.litros) || 0, unit: 'L',
        module: 'combustible', reference: created.folio,
        notes: `Carga vinculada a lote desde combustible`
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, carga: created, folio: created.folio });
  } catch (e) {
    console.error('POST carga error', e);
    return NextResponse.json({ error: e.message || 'Error al guardar carga' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const user = await getSessionUser();
    const actualizadoPor = body.actualizado_por || user?.name || user?.email || 'usuario';
    const id = parseInt(body.id);
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const [current] = await sql`SELECT * FROM combustible_cargas WHERE id = ${id} LIMIT 1`;
    if (!current) return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 });

    const action = body.action || 'update';

    if (action === 'authorize') {
      if (current.estatus === 'autorizado') {
        return NextResponse.json({ error: 'Ya está autorizada' }, { status: 400 });
      }
      // Nota: ya no se requiere foto del ticket; se usa número de ticket manual en Evidencia

      const [updated] = await sql`
        UPDATE combustible_cargas SET
          estatus = 'autorizado',
          autorizado_por = ${actualizadoPor},
          fecha_autorizacion = CURRENT_TIMESTAMP,
          actualizado_por = ${actualizadoPor},
          actualizado_en = CURRENT_TIMESTAMP,
          version_registro = version_registro + 1
        WHERE id = ${id} RETURNING *
      `;

      // Create expense if not exists (unique by related)
      const existingExpense = await sql`
        SELECT id FROM expense_records 
        WHERE related_module = 'combustible' AND related_entity_id = ${id} LIMIT 1
      `;
      if (existingExpense.length === 0) {
        const mx = getMexicoCityTime();
        const w = parseInt(mx.week || 1);
        const y = parseInt(mx.date.split('-')[0]);
        await sql`
          INSERT INTO expense_records (
            folio, expense_date, week_number, week_year,
            user_id, user_name, concept, description, amount, currency,
            receipt_number, receipt_file_url, photo_evidence_url,
            status, related_module, related_entity_id, created_from
          ) VALUES (
            ${updated.folio}, ${updated.fecha_carga}, ${w}, ${y},
            ${user?.id || 'sistema'}, ${actualizadoPor},
            ${'Combustible - ' + updated.folio},
            ${'Carga ' + updated.folio + ' | ' + (updated.vehiculo_nombre || '') + ' | ' + (updated.corredor_nombre || '')},
            ${updated.importe_ticket},
            'MXN',
            ${updated.numero_ticket},
            ${updated.comprobante_url},
            ${updated.odometro_foto_url},
            'pendiente',
            'combustible', ${id}, 'combustible-autorizacion'
          )
        `;
      }

      await sql`
        INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo)
        VALUES (${id}, ${updated.folio}, 'AUTORIZADO', ${actualizadoPor}, 'Autorización de carga + generación de gasto')
      `;

      return NextResponse.json({ success: true, carga: updated });
    }

    if (action === 'reject') {
      const [updated] = await sql`
        UPDATE combustible_cargas SET
          estatus = 'rechazado',
          motivo_rechazo = ${body.motivo || ''},
          actualizado_por = ${actualizadoPor},
          actualizado_en = CURRENT_TIMESTAMP,
          version_registro = version_registro + 1
        WHERE id = ${id} RETURNING *
      `;
      await sql`INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo) VALUES (${id}, ${updated.folio}, 'RECHAZADO', ${actualizadoPor}, ${body.motivo || 'Rechazo'})`;
      return NextResponse.json({ success: true, carga: updated });
    }

    if (action === 'cancel') {
      const [updated] = await sql`
        UPDATE combustible_cargas SET
          estatus = 'cancelado',
          motivo_cancelacion = ${body.motivo || ''},
          cancelado_por = ${actualizadoPor},
          cancelado_en = CURRENT_TIMESTAMP,
          actualizado_por = ${actualizadoPor},
          actualizado_en = CURRENT_TIMESTAMP,
          version_registro = version_registro + 1
        WHERE id = ${id} RETURNING *
      `;
      // Optionally cancel related expense
      await sql`
        UPDATE expense_records SET status = 'cancelado', observations = COALESCE(observations,'') || ' | Cancelado por combustible ' || ${updated.folio}
        WHERE related_module = 'combustible' AND related_entity_id = ${id}
      `;
      await sql`INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo) VALUES (${id}, ${updated.folio}, 'CANCELADO', ${actualizadoPor}, ${body.motivo || 'Cancelación'})`;
      return NextResponse.json({ success: true, carga: updated });
    }

    // Normal update (only drafts or own)
    if (current.estatus === 'autorizado' && !body.force_admin) {
      return NextResponse.json({ error: 'No se puede modificar registro autorizado sin permiso especial' }, { status: 403 });
    }

    const fields = [];
    if (body.fecha_carga !== undefined) fields.push(sql`fecha_carga = ${body.fecha_carga}`);
    if (body.hora_carga !== undefined) fields.push(sql`hora_carga = ${body.hora_carga}`);
    if (body.kilometraje_actual !== undefined) fields.push(sql`kilometraje_actual = ${parseFloat(body.kilometraje_actual)}`);
    if (body.km_al_cargar !== undefined) fields.push(sql`km_al_cargar = ${parseFloat(body.km_al_cargar) || null}`);
    if (body.litros !== undefined) fields.push(sql`litros = ${parseFloat(body.litros)}`);
    if (body.precio_litro !== undefined) fields.push(sql`precio_litro = ${parseFloat(body.precio_litro)}`);
    if (body.importe_ticket !== undefined) fields.push(sql`importe_ticket = ${parseFloat(body.importe_ticket)}`);
    if (body.observaciones !== undefined) fields.push(sql`observaciones = ${body.observaciones}`);
    if (body.comprobante_url !== undefined) fields.push(sql`comprobante_url = ${body.comprobante_url}`);
    if (body.odometro_foto_url !== undefined) fields.push(sql`odometro_foto_url = ${body.odometro_foto_url}`);
    if (body.estatus !== undefined) fields.push(sql`estatus = ${body.estatus}`);
    if (body.numero_factura !== undefined) fields.push(sql`numero_factura = ${body.numero_factura}`);
    if (body.numero_ticket !== undefined) fields.push(sql`numero_ticket = ${body.numero_ticket}`);

    if (fields.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    // recalc if needed
    const newLitros = body.litros !== undefined ? parseFloat(body.litros) : current.litros;
    const newPrecio = body.precio_litro !== undefined ? parseFloat(body.precio_litro) : current.precio_litro;
    const newTicket = body.importe_ticket !== undefined ? parseFloat(body.importe_ticket) : current.importe_ticket;
    const newCalc = Math.round(newLitros * newPrecio * 100) / 100;
    const newDiff = Math.round((newCalc - newTicket) * 100) / 100;

    await sql`
      UPDATE combustible_cargas SET
        ${sql.join(fields, ', ')},
        importe_calculado = ${newCalc},
        diferencia_importe = ${newDiff},
        actualizado_por = ${actualizadoPor},
        actualizado_en = CURRENT_TIMESTAMP,
        version_registro = version_registro + 1
      WHERE id = ${id}
    `;

    const [updated] = await sql`SELECT * FROM combustible_cargas WHERE id = ${id}`;

    await sql`
      INSERT INTO combustible_auditoria (carga_id, folio, accion, usuario, motivo)
      VALUES (${id}, ${updated.folio}, 'ACTUALIZADO', ${actualizadoPor}, ${body.motivo || 'Edición'})
    `;

    if (body.numero_factura !== undefined || body.numero_ticket !== undefined) {
      const [fresh] = await sql`SELECT numero_factura, estado_documental FROM combustible_cargas WHERE id = ${id}`;
      if (fresh.estado_documental !== 'COMPLETO') {
        const nuevoEst = fresh.numero_factura ? 'PENDIENTE_MULTIPLE' : 'PENDIENTE_TOTAL';
        await sql`UPDATE combustible_cargas SET estado_documental = ${nuevoEst} WHERE id = ${id}`;
      }
    }

    const [finalUpdated] = await sql`SELECT * FROM combustible_cargas WHERE id = ${id}`;
    return NextResponse.json({ success: true, carga: finalUpdated });
  } catch (e) {
    console.error('PUT carga error', e);
    return NextResponse.json({ error: e.message || 'Error al actualizar' }, { status: 500 });
  }
}
