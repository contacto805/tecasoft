import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// CENTRAL DESTINATION COST ENGINE - Single source of truth
function computeDestinationCost(destino, valores, precioFrutaOrigenKg = 0, utilidadKg = 0, utilidadPorcentaje = 0) {
  const pallets = Number(destino.pallets) || 24;
  const cajasPorPallet = Number(destino.cajas_por_pallet) || 156;
  const kgPorCaja = Number(destino.kg_por_caja) || 6;
  const tipoCambio = Number(destino.tipo_cambio) || 17.2;

  const totalCajas = pallets * cajasPorPallet;
  const kgPorPallet = cajasPorPallet * kgPorCaja;
  const kgTotales = totalCajas * kgPorCaja; // main denominator 22464

  let costoOperativoKg = 0;
  const desglose = [];
  let subtotalTransporte = 0;
  let subtotalEmpaque = 0;
  let subtotalOperacion = 0;

  for (const v of (valores || [])) {
    const concepto = v.concepto || {};
    const cant = Number(v.cantidad) || 0;
    const pu = Number(v.precio_unitario || concepto.precio_unitario) || 0;
    const tipo = v.tipo_calculo_override || concepto.tipo_calculo || 'POR_UNIDAD';
    const cat = concepto.categoria || '';

    let costoKg = 0;
    let importe = 0;

    if (tipo === 'GLOBAL_EMBARQUE') {
      importe = pu;
      costoKg = kgTotales > 0 ? importe / kgTotales : 0;
    } else if (tipo === 'POR_UNIDAD') {
      importe = cant * pu;
      costoKg = kgTotales > 0 ? importe / kgTotales : 0;
    } else if (tipo === 'POR_KG') {
      costoKg = pu;
      importe = pu * kgTotales;
    } else if (tipo === 'PORCENTAJE') {
      // Apply % on fruit origin price (or could be on subtotal, default to fruit price)
      const base = Number(precioFrutaOrigenKg) || 0;
      costoKg = base * (pu || 0);
      importe = costoKg * kgTotales;
    }

    costoOperativoKg += costoKg;

    if (cat.includes('TRANSPORTE')) subtotalTransporte += costoKg;
    if (cat.includes('EMPAQUE')) subtotalEmpaque += costoKg;
    if (cat.includes('OPERACIÓN')) subtotalOperacion += costoKg;

    desglose.push({
      id: v.id || concepto.id,
      nombre: concepto.nombre || v.nombre,
      categoria: cat,
      tipo,
      cantidad: cant,
      precio_unitario: pu,
      importe: Number(importe.toFixed(4)),
      costo_kg: Number(costoKg.toFixed(8))
    });
  }

  const costoFrutaPuesto = (Number(precioFrutaOrigenKg) || 0) + costoOperativoKg;

  // Utilidad
  let utilidadFinalKg = Number(utilidadKg) || 0;
  if (utilidadPorcentaje > 0) {
    utilidadFinalKg += costoFrutaPuesto * (Number(utilidadPorcentaje) / 100);
  }

  const precioObjetivo = costoFrutaPuesto + utilidadFinalKg;

  // USD conversions (avoid div0)
  const toUsd = (mxn) => (tipoCambio > 0 ? Number((mxn / tipoCambio).toFixed(6)) : null);

  return {
    destino_id: destino.id,
    nombre_destino: destino.nombre,
    pallets,
    cajas_por_pallet: cajasPorPallet,
    kg_por_caja: kgPorCaja,
    total_cajas: totalCajas,
    kg_por_pallet: Number(kgPorPallet.toFixed(2)),
    kg_totales: Number(kgTotales.toFixed(2)),
    tipo_cambio: tipoCambio,
    costo_operativo_kg: Number(costoOperativoKg.toFixed(8)),
    subtotal_transporte_kg: Number(subtotalTransporte.toFixed(8)),
    subtotal_empaque_kg: Number(subtotalEmpaque.toFixed(8)),
    subtotal_operacion_kg: Number(subtotalOperacion.toFixed(8)),
    costo_total_puesto_destino_kg: Number(costoFrutaPuesto.toFixed(8)),
    utilidad_kg: Number(utilidadFinalKg.toFixed(8)),
    precio_objetivo_kg: Number(precioObjetivo.toFixed(8)),
    costo_operativo_usd: toUsd(costoOperativoKg),
    precio_objetivo_usd: toUsd(precioObjetivo),
    desglose,
    // validation reference
    validation_kg: 22464
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const destinoId = searchParams.get("destino_id");
    const precioFruta = parseFloat(searchParams.get("precio_fruta") || "0");
    const utilidad = parseFloat(searchParams.get("utilidad") || "0");

    if (!destinoId) {
      return NextResponse.json({ error: "destino_id requerido" }, { status: 400 });
    }

    const [dest] = await sql`SELECT * FROM fruta_destinos WHERE id = ${parseInt(destinoId)} LIMIT 1`;
    if (!dest) return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });

    // load valores + conceptos
    const valoresRaw = await sql`
      SELECT v.*, c.nombre, c.categoria, c.tipo_calculo, c.precio_unitario as concepto_precio
      FROM destino_costos_valores v
      JOIN costo_conceptos c ON c.id = v.concepto_id
      WHERE v.destino_id = ${dest.id} AND v.activo = true
      ORDER BY c.orden ASC
    `;

    const valores = valoresRaw.map(r => ({
      ...r,
      precio_unitario: r.precio_unitario || r.concepto_precio || 0,
      concepto: { nombre: r.nombre, categoria: r.categoria, tipo_calculo: r.tipo_calculo }
    }));

    const result = computeDestinationCost(dest, valores, precioFruta, utilidad, 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { destino_id, precio_fruta_kg = 0, utilidad_kg = 0, utilidad_pct = 0, overrides = null } = body;

    if (!destino_id) return NextResponse.json({ error: "destino_id requerido" }, { status: 400 });

    const [dest] = await sql`SELECT * FROM fruta_destinos WHERE id = ${parseInt(destino_id)} LIMIT 1`;
    if (!dest) return NextResponse.json({ error: "Destino no encontrado" }, { status: 404 });

    let valores;
    if (overrides && Array.isArray(overrides)) {
      // simulator mode: use provided overrides
      valores = overrides.map(o => ({ ...o, concepto: o.concepto || { nombre: o.nombre, categoria: o.categoria, tipo_calculo: o.tipo } }));
    } else {
      const valoresRaw = await sql`
        SELECT v.*, c.nombre, c.categoria, c.tipo_calculo, c.precio_unitario as concepto_precio
        FROM destino_costos_valores v
        JOIN costo_conceptos c ON c.id = v.concepto_id
        WHERE v.destino_id = ${dest.id} AND v.activo = true
        ORDER BY c.orden ASC
      `;
      valores = valoresRaw.map(r => ({
        ...r,
        precio_unitario: r.precio_unitario || r.concepto_precio || 0,
        concepto: { nombre: r.nombre, categoria: r.categoria, tipo_calculo: r.tipo_calculo }
      }));
    }

    const result = computeDestinationCost(dest, valores, precio_fruta_kg, utilidad_kg, utilidad_pct);

    // Save snapshot to historico for traceability (non blocking)
    try {
      await sql`
        INSERT INTO destino_costos_historico (destino, semana, rows, total_costo_mxn, total_kg, costo_promedio_kg, notas)
        VALUES (${dest.nombre}, 0, ${JSON.stringify(result.desglose)}, ${result.costo_total_puesto_destino_kg * result.kg_totales}, ${result.kg_totales}, ${result.costo_total_puesto_destino_kg}, 'Engine calculation')
      `;
    } catch (_) {}

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}