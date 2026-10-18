import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import {
  calculateIntegralLotCost,
  calculateNetIncome,
  calculateUtility,
  calculateMargin,
  bidirectionalPriceCalculator,
} from "@/app/api/utils/financial-engine";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    if (action === "bidireccional") {
      const res = await bidirectionalPriceCalculator(params);
      return NextResponse.json({ ...res, fuente: "financial-engine", estado: "calculado" });
    }

    if (action === "rentabilidad" || action === "lot_cost") {
      let costo = 0;
      let ingresoNeto = 0;
      if (params.lotId) {
        const c = await calculateIntegralLotCost(params.lotId);
        costo = c?.costo_integral || 0;
        const ni = await calculateNetIncome({ lotId: params.lotId });
        ingresoNeto = ni?.ingreso_neto || 0;
      }
      const bruta = await calculateUtility(ingresoNeto, { costo_integral: costo }, "bruta");
      const op = await calculateUtility(ingresoNeto, { costo_integral: costo }, "operativa");
      const neta = await calculateUtility(ingresoNeto, { costo_integral: costo }, "neta");
      const margen = calculateMargin(bruta, ingresoNeto);
      return NextResponse.json({
        ingreso_neto: ingresoNeto,
        costo_integral: costo,
        utilidad_bruta: bruta,
        utilidad_operativa: op,
        utilidad_neta: neta,
        margen,
        fuente: "financial-engine (motor centralizado)",
        calculo: "UTILIDAD = INGRESO_NETO - COSTOS (bruta/operativa/neta). MARGEN validado.",
        estado: "confirmado"
      });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  if (lotId) {
    const c = await calculateIntegralLotCost(lotId);
    return NextResponse.json(c || { error: "No calculable" });
  }
  return NextResponse.json({ ok: true, info: "POST con action: bidireccional | rentabilidad" });
}
