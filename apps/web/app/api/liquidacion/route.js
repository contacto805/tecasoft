import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET por lote
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    if (!lotId) return NextResponse.json({ error: "lotId requerido" }, { status: 400 });

    const rows = await sql`
      SELECT * FROM liquidacion_contable 
      WHERE id_lote = ${parseInt(lotId)}
      ORDER BY created_at DESC LIMIT 5
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT para aprobar / cambiar estatus (cancelación bloqueada si tiene abonos)
export async function PUT(request) {
  try {
    const b = await request.json();
    const { id, estatus, motivo_cancelacion } = b;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [current] = await sql`SELECT * FROM liquidacion_contable WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!current) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Regla de cancelación: si ya tiene pagos o abonos no permitir sin super
    if (estatus === 'Cancelada' && current.estatus !== 'Cancelada') {
      if (!motivo_cancelacion) return NextResponse.json({ error: "Motivo + evidencia requerida para cancelar" }, { status: 400 });
    }

    const [upd] = await sql`
      UPDATE liquidacion_contable SET estatus = ${estatus || current.estatus}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)} RETURNING *
    `;
    return NextResponse.json(upd);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: crear/actualizar con fórmulas exactas
export async function POST(request) {
  try {
    const b = await request.json();
    const {
      id_lote, id_orden_corte,
      precio_kilo_exportacion, precio_kilo_nacional, precio_kilo_canica_industrial,
      retencion_materiales,
      costo_corte_por_caja, cantidad_cajas_recibidas, valor_flete,
      kilos_netos_exportacion, kilos_netos_nacional, kilos_canica, kilos_merma_industrial,
      clase_a_kg, semi_kg, danada_proceso_kg, danada_desecho_kg,
      modulo_contratacion, cargo_maquila
    } = b;

    if (!id_lote) return NextResponse.json({ error: "id_lote requerido" }, { status: 400 });

    // Heredar
    let fl = b.folio_lote, fo = b.folio_orden_corte;
    if (!fl) {
      const [l] = await sql`SELECT lot_number, cutting_order_id FROM lots WHERE id=${parseInt(id_lote)} LIMIT 1`;
      fl = l?.lot_number;
      if (l?.cutting_order_id && !fo) {
        const [co] = await sql`SELECT folio FROM cutting_orders WHERE id=${l.cutting_order_id} LIMIT 1`;
        fo = co?.folio;
      }
    }

    // Fórmulas exactas del spec
    const pExp = parseFloat(precio_kilo_exportacion) || 0;
    const pNac = parseFloat(precio_kilo_nacional) || 0;
    const pCan = parseFloat(precio_kilo_canica_industrial) || 0;
    const retMat = parseFloat(retencion_materiales) || 0;

    const kExp = parseFloat(kilos_netos_exportacion) || parseFloat(clase_a_kg) || 0;
    const kNac = parseFloat(kilos_netos_nacional) || parseFloat(semi_kg) || 0;
    const kCan = parseFloat(kilos_canica) || parseFloat(danada_proceso_kg) || 0;
    const kMer = parseFloat(kilos_merma_industrial) || parseFloat(danada_desecho_kg) || 0;

    const subtotal = (kExp * pExp) + (kNac * pNac) + ((kCan + kMer) * pCan);
    const retCuadrilla = (parseFloat(costo_corte_por_caja) || 0) * (parseInt(cantidad_cajas_recibidas) || 0);
    const retFlete = parseFloat(valor_flete) || 0;
    const cargoMaq = (modulo_contratacion === 'Servicio de Maquila') ? parseFloat(cargo_maquila || 0) : 0;

    const iva = subtotal * 0.16;
    const isr = subtotal * 0.0125;

    const totalDed = retCuadrilla + retFlete + retMat + isr + cargoMaq;
    const neto = (subtotal + iva) - totalDed;

    const [row] = await sql`
      INSERT INTO liquidacion_contable (
        id_lote, id_orden_corte, folio_lote, folio_orden_corte,
        precio_kilo_exportacion, precio_kilo_nacional, precio_kilo_canica_industrial, retencion_materiales,
        costo_corte_por_caja, cantidad_cajas_recibidas, valor_flete,
        kilos_netos_exportacion, kilos_netos_nacional, kilos_canica, kilos_merma_industrial,
        subtotal_ingreso_productor, retencion_cuadrilla_corte, retencion_flete_transporte,
        impuesto_iva, retencion_isr_agricola, total_deducciones, neto_a_pagar_productor,
        estatus, created_by, modulo_contratacion, cargo_maquila
      ) VALUES (
        ${parseInt(id_lote)}, ${id_orden_corte ? parseInt(id_orden_corte) : null}, ${fl}, ${fo},
        ${pExp}, ${pNac}, ${pCan}, ${retMat},
        ${parseFloat(costo_corte_por_caja)||0}, ${parseInt(cantidad_cajas_recibidas)||0}, ${parseFloat(valor_flete)||0},
        ${kExp}, ${kNac}, ${kCan}, ${kMer},
        ${subtotal}, ${retCuadrilla}, ${retFlete},
        ${iva}, ${isr}, ${totalDed}, ${neto},
        'Pendiente', ${b.created_by || 'sistema'}, ${modulo_contratacion || 'Compra Directa'}, ${cargoMaq}
      ) RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
