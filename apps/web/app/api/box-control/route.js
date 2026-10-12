import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Full support: movements, summary, by states (spec locations), filters, history, full resumen
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const operationalState = searchParams.get('operationalState');
    const cuttingOrderId = searchParams.get('cuttingOrderId');
    const folio = searchParams.get('folio');
    const includeSummary = searchParams.get('includeSummary') !== 'false';
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const report = searchParams.get('report') === 'true';

    let filters = sql``;
    if (status) filters = sql`${filters} AND status = ${status}`;
    if (operationalState) filters = sql`${filters} AND operational_state = ${operationalState}`;
    if (cuttingOrderId) filters = sql`${filters} AND cutting_order_id = ${parseInt(cuttingOrderId)}`;
    if (folio) filters = sql`${filters} AND folio ILIKE ${'%' + folio + '%'}`;

    const movements = await sql`
      SELECT * FROM box_control_movements
      WHERE 1=1 ${filters}
      ORDER BY created_at DESC LIMIT 400
    `;

    let summary = null;
    if (includeSummary) {
      const s = await sql`SELECT * FROM box_inventory_summary ORDER BY id DESC LIMIT 1`;
      summary = s[0] || null;
    }

    let history = null;
    if (includeHistory) {
      history = await sql`SELECT * FROM box_movement_history ORDER BY event_date DESC LIMIT 150`;
    }

    // SPEC REPORT: full resumen
    let resumen = null;
    if (report || includeSummary) {
      const totals = await sql`
        SELECT
          COALESCE(SUM(CASE WHEN operational_state = 'ALMACEN' OR operational_state = 'Disponible' OR operational_state LIKE '%Almac%' THEN boxes_quantity ELSE 0 END), 0) as en_almacen,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%CORTE%' OR operational_state = 'EN CORTE' OR operational_state = 'Asignada a Orden' OR operational_state = 'En Campo' THEN boxes_quantity ELSE 0 END), 0) as en_corte,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%CUARENTENA%' THEN boxes_quantity ELSE 0 END), 0) as en_cuarentena,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%PRODUCCION%' OR operational_state = 'EN PRODUCCION' THEN boxes_quantity ELSE 0 END), 0) as en_produccion,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%PROCESO%' THEN boxes_quantity ELSE 0 END), 0) as en_proceso,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%DESECHO%' THEN boxes_quantity ELSE 0 END), 0) as en_desecho,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%FRIO%' OR operational_state = 'CUARTO FRIO' THEN boxes_quantity ELSE 0 END), 0) as en_cuarto_frio,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%PERDID%' OR operational_state = 'Extraviada' THEN boxes_quantity ELSE 0 END), 0) as perdidas,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%DAÑ%' OR operational_state = 'Dañada' THEN boxes_quantity ELSE 0 END), 0) as danadas,
          COALESCE(SUM(CASE WHEN operational_state LIKE '%REPAR%' THEN boxes_quantity ELSE 0 END), 0) as en_reparacion,
          COALESCE(SUM(boxes_quantity), 0) as total_activas
        FROM box_control_movements WHERE status = 'active' OR status IS NULL
      `;

      const incidentsLost = await sql`
        SELECT COALESCE(SUM(boxes_difference),0) as lost_from_incidents,
               COALESCE(SUM(penalty_amount),0) as penalties_total
        FROM box_control_incidents WHERE status IN ('open','pending') OR penalty_applied = true
      `;

      const byResp = await sql`
        SELECT responsible_type, responsible_name, SUM(boxes_quantity) as cajas,
               SUM(CASE WHEN operational_state LIKE '%PERDID%' OR operational_state = 'Extraviada' THEN boxes_quantity ELSE 0 END) as perdidas,
               SUM(penalty_amount) as penalizaciones
        FROM box_control_movements
        WHERE responsible_name IS NOT NULL 
        GROUP BY responsible_type, responsible_name ORDER BY penalizaciones DESC LIMIT 25
      `;

      resumen = {
        inventario: {
          cajas_totales: parseInt(totals[0]?.total_activas || 0),
          en_almacen: parseInt(totals[0]?.en_almacen || 0),
          en_corte: parseInt(totals[0]?.en_corte || 0),
          en_cuarentena: parseInt(totals[0]?.en_cuarentena || 0),
          en_produccion: parseInt(totals[0]?.en_produccion || 0),
          en_proceso: parseInt(totals[0]?.en_proceso || 0),
          en_desecho: parseInt(totals[0]?.en_desecho || 0),
          en_cuarto_frio: parseInt(totals[0]?.en_cuarto_frio || 0),
          perdidas: parseInt(totals[0]?.perdidas || 0),
          danadas: parseInt(totals[0]?.danadas || 0),
          en_reparacion: parseInt(totals[0]?.en_reparacion || 0)
        },
        incidencias: {
          perdidas: parseInt(incidentsLost[0]?.lost_from_incidents || totals[0]?.perdidas || 0),
          danadas: parseInt(totals[0]?.danadas || 0),
          total_penalties: parseFloat(incidentsLost[0]?.penalties_total || 0)
        },
        responsabilidades: byResp,
        valorizacion: {
          perdidas_valor: parseFloat((totals[0]?.perdidas || 0) * 100),
          danadas_valor: parseFloat((totals[0]?.danadas || 0) * 100),
          total_perdidas: parseFloat(((totals[0]?.perdidas || 0) + (totals[0]?.danadas || 0)) * 100)
        }
      };
    }

    return NextResponse.json({ success: true, movements, summary, history, resumen });
  } catch (error) {
    console.error('Error GET box-control:', error);
    return NextResponse.json({ success: true, movements: [], summary: null, history: null, resumen: null });
  }
}

// POST - rich actions for full spec flow
export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action || 'generic';

    if (action === 'salida_corte' || action === 'cargar_cajas_corte') {
      // From Orden de Corte integration: full data + deduct warehouse + state EN CORTE
      const {
        cutting_order_id, producer_name, orchard_name, crew_chief_name,
        driver_name, fletero, cuadrilla, boxes_quantity, date_out, hora,
        responsible_name, responsible_phone, lot_id,
        salida_sin_lote, no_va_a_corte, destino
      } = body;

      if (!boxes_quantity || boxes_quantity < 1) {
        return NextResponse.json({ error: 'boxes_quantity requerido' }, { status: 400 });
      }

      const ts = Date.now();
      const folio = `SAL-CORTE-${new Date().getFullYear()}-${ts.toString().slice(-8)}`;

      const isOtherExit = !!(salida_sin_lote || no_va_a_corte);
      const targetState = isOtherExit ? 'EN CAMPO' : 'EN CORTE';
      const targetMovement = isOtherExit ? 'SALIDA SIN LOTE' : 'SALIDA A CAMPO';
      const targetLocation = isOtherExit ? (destino || 'CAMPO / OTRO') : 'CAMPO';

      const tipoSalidaStr = body.tipo_salida || (isOtherExit ? 'Acopio' : 'A Corte');
      const baseNotes = 'Tipo: ' + tipoSalidaStr + ' | Orden/Lote: ' + (cutting_order_id || (isOtherExit ? 'SIN LOTE' : '')) 
        + ' | Productor: ' + (producer_name||'') 
        + ' | Huerta: ' + (orchard_name||'') 
        + ' | Camionero: ' + (body.camionero || '') + ' | Cuadrilla: ' + (cuadrilla || crew_chief_name || '');
      const extraNotes = isOtherExit 
        ? ' | SALIDA_SIN_LOTE: true | DESTINO: ' + (destino || 'no especificado') 
        : '';

      const [mov] = await sql`
        INSERT INTO box_control_movements (
          folio, cutting_order_id, lot_id, operational_state, movement_type,
          movement_date, location, boxes_quantity, responsible_type, responsible_name, responsible_phone,
          notes, status, created_by
        ) VALUES (
          ${folio}, ${cutting_order_id || null}, ${lot_id || null}, ${targetState}, ${targetMovement},
          ${date_out ? new Date(date_out + (hora ? 'T'+hora : '')) : sql`CURRENT_TIMESTAMP`}, ${targetLocation},
          ${parseInt(boxes_quantity)},
          ${fletero ? 'Fletero' : 'Cuadrilla'}, ${responsible_name || driver_name || fletero || 'Sin responsable'},
          ${responsible_phone || null},
          ${baseNotes + extraNotes},
          'active', 'sistema'
        ) RETURNING *
      `;

      await sql`
        INSERT INTO box_movement_history (movement_id, event_type, event_date, to_state, to_responsible_name, to_location, user_name, related_document_type, related_document_id, notes)
        VALUES (${mov.id}, ${targetMovement}, CURRENT_TIMESTAMP, ${targetState}, ${responsible_name || driver_name}, ${targetLocation}, 'Sistema', ${isOtherExit ? 'otro_motivo' : 'cutting_order'}, ${cutting_order_id || null}, ${isOtherExit ? ('Salida empaque otro destino: ' + (destino||'')) : 'Ticket salida generado'})
      `;

      await updateInventorySummary();
      await syncCajasToMaterials();

      return NextResponse.json({ success: true, movement: mov, ticket_type: 'salida' });
    }

    if (action === 'recepcion') {
      const { folio_salida, boxes_sent, boxes_received, cajas_con_fruta, cajas_vacias, cajas_extraviadas, cajas_rotas, date_received, hora, responsible_fletero, responsible_crew, notes } = body;

      if (!folio_salida || boxes_sent == null) {
        return NextResponse.json({ error: 'folio_salida y boxes_sent requeridos' }, { status: 400 });
      }

      const cFruta = parseInt(cajas_con_fruta || 0);
      const cVacias = parseInt(cajas_vacias || 0);
      const cExtr = parseInt(cajas_extraviadas || 0);
      const cRot = parseInt(cajas_rotas || 0);
      const recib = parseInt(boxes_received || (cFruta + cVacias));

      const original = await sql`SELECT * FROM box_control_movements WHERE folio = ${folio_salida} LIMIT 1`;
      const origMov = original[0] || null;

      const diff = Math.max(0, parseInt(boxes_sent) - recib);
      const penalty = ((cExtr + cRot) || diff) * 100;

      let updatedOrig = origMov;
      if (origMov) {
        const [u] = await sql`
          UPDATE box_control_movements 
          SET operational_state = 'CUARENTENA', 
              boxes_quantity = ${recib},
              cajas_fruta = ${cFruta},
              cajas_vacias = ${cVacias},
              cajas_rotas = ${cRot},
              cajas_extraviadas = ${cExtr},
              previous_state = ${origMov.operational_state},
              notes = ${'Recepcionado: fruta='+cFruta+' vacias='+cVacias+' ext='+cExtr+' rot='+cRot+' total desc ' + penalty} ,
              penalty_amount = ${penalty},
              penalty_applied = ${penalty > 0},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${origMov.id}
          RETURNING *
        `;
        updatedOrig = u;

        await sql`
          INSERT INTO box_movement_history (movement_id, event_type, event_date, from_state, to_state, user_name, related_document_type, notes)
          VALUES (${origMov.id}, 'RECEPCION', CURRENT_TIMESTAMP, ${origMov.operational_state}, 'CUARENTENA', 'Recepcion', 'box_reception', ${'Regreso detallado fruta='+cFruta+' vac='+cVacias+' ext='+cExtr+' rot='+cRot})
        `;
      }

      const folioRec = `REC-${Date.now()}`;
      const recRes = await sql`
        INSERT INTO box_control_movements (folio, cutting_order_id, lot_id, operational_state, movement_type, movement_date, location, boxes_quantity, cajas_fruta, cajas_vacias, cajas_rotas, cajas_extraviadas, responsible_type, responsible_name, notes, status, penalty_amount, penalty_applied)
        VALUES (${folioRec}, ${origMov ? origMov.cutting_order_id : null}, ${origMov ? origMov.lot_id : null}, 'CUARENTENA', 'RECEPCION', CURRENT_TIMESTAMP, 'CUARENTENA', ${recib}, ${cFruta}, ${cVacias}, ${cRot}, ${cExtr}, 'Fletero/Cuadrilla', ${responsible_fletero || responsible_crew || 'Recepcion'}, ${notes || 'Recepcion trazabilidad completa'}, 'active', ${penalty}, ${ (cExtr+cRot)>0 })
        RETURNING *
      `;
      const newRec = recRes[0];

      let lostMov = null;
      const perdidasEnRec = cExtr + cRot;
      if (perdidasEnRec > 0) {
        const lostFolio = `EXT-${Date.now()}`;
        const lostRes = await sql`
          INSERT INTO box_control_movements (folio, cutting_order_id, lot_id, operational_state, movement_type, movement_date, location, boxes_quantity, penalty_amount, penalty_applied, status, responsible_name, notes)
          VALUES (${lostFolio}, ${origMov?.cutting_order_id || null}, ${origMov?.lot_id}, 'EXTRAVIADA', 'REPORTE EXTRAVIO', CURRENT_TIMESTAMP, 'PERDIDA', ${perdidasEnRec}, ${penalty}, true, 'active', ${responsible_fletero || responsible_crew || 'Responsable'}, 'Cargo trazabilidad regreso cajas')
          RETURNING *
        `;
        lostMov = lostRes[0];

        await sql`
          INSERT INTO box_lost_records (movement_id, folio, date, responsible_fletero, responsible_crew, quantity, penalty_amount, applied)
          VALUES (${lostMov.id || null}, ${lostFolio}, CURRENT_DATE, ${responsible_fletero}, ${responsible_crew}, ${perdidasEnRec}, ${penalty}, true)
        `;

        await sql`
          INSERT INTO payroll_deductions (deduction_type, payroll_period_id, employee_id, employee_name, concept, amount, deduction_date, week_start_date, week_end_date, authorized_by, status, notes)
          VALUES 
          ('cajas_extraviadas', null, null, ${responsible_fletero || 'Fletero'}, ${'Descuento Cajas ' + folio_salida}, ${Math.ceil(penalty/2)}, CURRENT_DATE, CURRENT_DATE, (CURRENT_DATE + interval '7 days'), 'SISTEMA', 'pendiente', ${'Folio: ' + folio_salida + ' | Trazabilidad caja de campo'}),
          ('cajas_extraviadas', null, null, ${responsible_crew || 'Cuadrilla'}, ${'Descuento Cajas ' + folio_salida}, ${Math.ceil(penalty/2)}, CURRENT_DATE, CURRENT_DATE, (CURRENT_DATE + interval '7 days'), 'SISTEMA', 'pendiente', ${'Folio: ' + folio_salida + ' | Trazabilidad caja de campo'})
        `;

        // Log central movement + audit
        await sql`
          INSERT INTO movements (entity_type, entity_id, lot_id, movement_type, qty_before, qty, qty_after, unit, module, reference, notes, created_at)
          VALUES ('caja_campo', ${lostMov?.id || null}, ${origMov?.lot_id || null}, 'PERDIDA_CAJA', ${boxes_sent||0}, ${perdidasEnRec}, 0, 'cajas', 'box-control', ${folio_salida}, ${'Penalización $100 x caja - ' + perdidasEnRec + ' cajas'})
        `;
      }

      await updateInventorySummary();
      await syncCajasToMaterials();

      return NextResponse.json({ success: true, reception: newRec, original: updatedOrig, extraviadas: lostMov, penalty, tickets: ['recepcion', perdidasEnRec>0 ? 'extraviadas' : null].filter(Boolean) });
    }

    if (action === 'movimiento_interno' || action === 'cambiar_estado') {
      const { id, to_state, responsible_name, quantity, location, reason, created_by } = body;
      if (!id || !to_state) return NextResponse.json({ error: 'id y to_state requeridos' }, { status: 400 });

      const [current] = await sql`SELECT * FROM box_control_movements WHERE id = ${parseInt(id)}`;
      if (!current) return NextResponse.json({ error: 'No existe movimiento' }, { status: 404 });

      const usedQty = quantity ? parseInt(quantity) : current.boxes_quantity;

      const [updated] = await sql`
        UPDATE box_control_movements
        SET operational_state = ${to_state},
            previous_state = ${current.operational_state},
            previous_responsible_name = ${current.responsible_name},
            responsible_name = ${responsible_name || current.responsible_name},
            location = ${location || to_state},
            boxes_quantity = ${usedQty},
            notes = ${reason ? (current.notes || '') + ' | ' + reason : current.notes},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;

      await sql`
        INSERT INTO box_movement_history (movement_id, event_type, event_date, from_state, to_state, to_responsible_name, to_location, user_name, notes)
        VALUES (${id}, 'MOVIMIENTO INTERNO', CURRENT_TIMESTAMP, ${current.operational_state}, ${to_state}, ${responsible_name}, ${location || to_state}, ${created_by || 'Operador'}, ${reason || ''})
      `;

      await updateInventorySummary();
      await syncCajasToMaterials();

      return NextResponse.json(updated);
    }

    // Raw generic movement creation
    const {
      cutting_order_id, lot_id, operational_state, responsible_type, responsible_name,
      responsible_phone, boxes_quantity, movement_type, location, notes, created_by
    } = body;

    if (!operational_state || !boxes_quantity || !movement_type) {
      return NextResponse.json({ error: 'Campos faltantes' }, { status: 400 });
    }

    const folio = `BOX-${new Date().getFullYear()}-${Date.now()}`;

    const [movement] = await sql`
      INSERT INTO box_control_movements (folio, cutting_order_id, lot_id, operational_state, responsible_type, responsible_name, responsible_phone, boxes_quantity, movement_type, movement_date, location, notes, status, created_by)
      VALUES (${folio}, ${cutting_order_id||null}, ${lot_id||null}, ${operational_state}, ${responsible_type||null}, ${responsible_name||null}, ${responsible_phone||null}, ${parseInt(boxes_quantity)}, ${movement_type}, CURRENT_TIMESTAMP, ${location||null}, ${notes||null}, 'active', ${created_by||'Sistema'})
      RETURNING *
    `;

    await sql`
      INSERT INTO box_movement_history (movement_id, event_type, event_date, to_state, to_responsible_name, to_location, user_name, notes)
      VALUES (${movement.id}, ${movement_type}, CURRENT_TIMESTAMP, ${operational_state}, ${responsible_name}, ${location}, ${created_by||'Sistema'}, ${notes})
    `;

    await updateInventorySummary();
    await syncCajasToMaterials();

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('Error POST box-control:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: state/responsible adjustment (authorized) + never delete
export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, operational_state, responsible_name, responsible_phone, location, notes, penalty_amount, penalty_applied, status, updated_by, reason } = data;

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const [cur] = await sql`SELECT * FROM box_control_movements WHERE id = ${id}`;
    if (!cur) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const [updated] = await sql`
      UPDATE box_control_movements
      SET 
        operational_state = ${operational_state || cur.operational_state},
        previous_state = ${cur.operational_state},
        responsible_name = ${responsible_name || cur.responsible_name},
        responsible_phone = ${responsible_phone || cur.responsible_phone},
        location = ${location || cur.location},
        notes = ${notes != null ? notes : cur.notes},
        penalty_amount = ${penalty_amount !== undefined ? penalty_amount : cur.penalty_amount},
        penalty_applied = ${penalty_applied !== undefined ? penalty_applied : cur.penalty_applied},
        status = ${status || cur.status},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    await sql`
      INSERT INTO box_movement_history (movement_id, event_type, event_date, from_state, to_state, user_name, notes)
      VALUES (${id}, 'AJUSTE AUTORIZADO', CURRENT_TIMESTAMP, ${cur.operational_state}, ${operational_state || cur.operational_state}, ${updated_by || 'Admin'}, ${reason || notes || 'Ajuste de trazabilidad'})
    `;

    await updateInventorySummary();
    await syncCajasToMaterials();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT box-control error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE is DISABLED permanently (per spec: ningún movimiento se elimina). Only audit logs allowed.
export async function DELETE() {
  return NextResponse.json({ error: 'Operación no permitida. Los movimientos de cajas son trazables y permanentes. Utilice Ajuste Autorizado.' }, { status: 405 });
}

// HELPERS
async function updateInventorySummary() {
  try {
    const st = await sql`SELECT * FROM box_control_settings`;
    const mp = {}; st.forEach(s => mp[s.setting_key] = s.setting_value);
    const val = parseFloat(mp.box_penalty_value || 100);

    const totalsQ = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%ALMAC%' OR operational_state ILIKE '%DISPONIBLE%' THEN boxes_quantity ELSE 0 END), 0) en_almacen,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%CORTE%' OR operational_state ILIKE '%CAMPO%' THEN boxes_quantity ELSE 0 END), 0) en_corte,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%CUARENT%' THEN boxes_quantity ELSE 0 END), 0) en_cuarentena,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%PRODUCCION%' THEN boxes_quantity ELSE 0 END), 0) en_produccion,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%PROCESO%' THEN boxes_quantity ELSE 0 END), 0) en_proceso,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%DESECHO%' THEN boxes_quantity ELSE 0 END), 0) en_desecho,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%FRIO%' THEN boxes_quantity ELSE 0 END), 0) en_cuarto_frio,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%PERDID%' OR operational_state ILIKE 'EXTRAVI%' THEN boxes_quantity ELSE 0 END), 0) perdidas,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%DAÑ%' THEN boxes_quantity ELSE 0 END), 0) danadas,
        COALESCE(SUM(CASE WHEN operational_state ILIKE '%REPAR%' THEN boxes_quantity ELSE 0 END), 0) reparacion,
        COALESCE(SUM(boxes_quantity),0) total
      FROM box_control_movements WHERE (status='active' OR status IS NULL)
    `;

    const t = totalsQ[0] || {};
    const pendQ = await sql`SELECT COALESCE(SUM(penalty_amount),0) as pending FROM box_control_movements WHERE penalty_applied=false AND penalty_amount>0 AND (status='active' OR status IS NULL)`;
    const pendingPen = parseFloat(pendQ[0]?.pending || 0);

    // ensure row 1 exists for summary
    const existsSum = await sql`SELECT id FROM box_inventory_summary WHERE id=1 LIMIT 1`;
    if (!existsSum.length) {
      await sql`INSERT INTO box_inventory_summary (id, total_boxes) VALUES (1, 0)`;
    }

    await sql`
      UPDATE box_inventory_summary SET
        total_boxes = ${parseInt(t.total||0)},
        available_boxes = ${parseInt(t.en_almacen||0)},
        in_field = ${parseInt(t.en_corte||0)},
        in_quarantine = ${parseInt(t.en_cuarentena||0)},
        in_production = ${parseInt(t.en_produccion||0)},
        with_process = ${parseInt(t.en_proceso||0)},
        with_waste = ${parseInt(t.en_desecho||0)},
        lost = ${parseInt(t.perdidas||0)},
        damaged = ${parseInt(t.danadas||0)},
        pending_return = ${parseInt(t.reparacion||0)},
        lost_value = ${parseInt(t.perdidas||0) * val},
        damaged_value = ${parseInt(t.danadas||0) * val},
        pending_penalties = ${pendingPen},
        last_calculated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `;
  } catch(e){ console.error('updateInventorySummary failed', e); }
}

// Sync current aggregate counts to materials_inventory as "CAJAS DE CAMPO"
async function syncCajasToMaterials() {
  try {
    const sum = await sql`SELECT * FROM box_inventory_summary ORDER BY last_calculated DESC LIMIT 1`;
    const s = sum[0] || { en_almacen:0, in_quarantine:0, in_production:0, with_process:0, with_waste:0, in_cuarto_frio:0, lost:0, damaged:0 };
    
    const entries = [
      { sub: 'Disponibles', qty: s.en_almacen || s.available_boxes || 0 },
      { sub: 'En uso / Corte / Campo', qty: s.in_field || 0 },
      { sub: 'En cuarentena', qty: s.in_quarantine || 0 },
      { sub: 'En producción', qty: s.in_production || s.en_produccion || 0 },
      { sub: 'En cuarto frío', qty: s.en_cuarto_frio || 0 },
      { sub: 'Proceso', qty: s.with_process || 0 },
      { sub: 'Desecho', qty: s.with_waste || 0 },
      { sub: 'Perdidas', qty: s.lost || 0 },
      { sub: 'Dañadas', qty: s.damaged || 0 }
    ];

    const parentName = 'CAJAS DE CAMPO';
    const existsParent = await sql`SELECT id FROM materials_inventory WHERE material_name = ${parentName} LIMIT 1`;
    let parentId;
    if (!existsParent.length) {
      const ins = await sql`INSERT INTO materials_inventory (material_name, category, quantity_available, unit, minimum_stock, cost_per_unit) VALUES (${parentName}, 'CAJAS', 0, 'cajas', 100, 100) RETURNING id`;
      parentId = ins[0].id;
    } else parentId = existsParent[0].id;

    for (let e of entries) {
      const matName = `CAJAS ${e.sub}`;
      const ex = await sql`SELECT id FROM materials_inventory WHERE category = 'CAJAS DE CAMPO' AND material_name = ${matName} LIMIT 1`;
      if (ex.length) {
        await sql`UPDATE materials_inventory SET quantity_available = ${e.qty}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ex[0].id}`;
      } else {
        await sql`INSERT INTO materials_inventory (material_name, category, quantity_available, unit, minimum_stock, cost_per_unit) VALUES (${matName}, 'CAJAS DE CAMPO', ${e.qty}, 'cajas', 0, 100)`;
      }
    }
  } catch(e){ console.error('syncCajasToMaterials error', e); }
}
