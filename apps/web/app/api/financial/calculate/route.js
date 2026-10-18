import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import {
  calculateIntegralLotCost,
  calculateNetIncome,
  calculateUtility,
  calculateMargin,
  bidirectionalPriceCalculator,
  validateFinancialConsistency,
} from "@/app/api/utils/financial-engine";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    if (action === "lot_cost") {
      const result = await calculateIntegralLotCost(params.lotId);
      return NextResponse.json(result || { error: "No se pudo calcular" });
    }

    if (action === "net_income") {
      const res = await calculateNetIncome(params);
      return NextResponse.json(res);
    }

    if (action === "utility") {
      const util = await calculateUtility(params.ingresoNeto, params.costos, params.tipo || "bruta");
      const margen = calculateMargin(util, params.ingresoNeto);
      return NextResponse.json({ utilidad: util, margen });
    }

    if (action === "bidireccional") {
      const res = await bidirectionalPriceCalculator(params);
      return NextResponse.json(res);
    }

    if (action === "validate") {
      const res = await validateFinancialConsistency(params);
      return NextResponse.json(res);
    }

    // Default: cálculo integral completo para cierre o lote
    if (params.lotId) {
      const cost = await calculateIntegralLotCost(params.lotId);
      return NextResponse.json({ costo_integral: cost });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (e) {
    console.error("financial/calculate error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  const action = searchParams.get("action");

  if (action === "lot_cost" && lotId) {
    const result = await calculateIntegralLotCost(lotId);
    return NextResponse.json(result);
  }

  if (action === "bidireccional") {
    const input = {
      direction: searchParams.get("direction") || "destino_a_campo",
      precioDestinoPorKg: parseFloat(searchParams.get("precioDestino") || 0),
      precioCampoActual: parseFloat(searchParams.get("precioCampo") || 0),
    };
    const res = await bidirectionalPriceCalculator(input);
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: true, info: "Motor Financiero Centralizado V9 - usa POST con action" });
}
