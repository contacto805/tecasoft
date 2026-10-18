import { NextResponse } from "next/server";
import { bidirectionalPriceCalculator } from "@/app/api/utils/financial-engine";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await bidirectionalPriceCalculator(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const input = {
    direction: searchParams.get("direction") || "destino_a_campo",
    precioDestinoPorKg: parseFloat(searchParams.get("p_destino") || 0),
    precioCampoActual: parseFloat(searchParams.get("p_campo") || 0),
    costosNoFrutaPorKg: parseFloat(searchParams.get("costos_no_fruta") || 4.5),
    utilidadObjetivoPorKg: parseFloat(searchParams.get("util_obj") || 2),
    margenMinimo: parseFloat(searchParams.get("margen_min") || 0.15),
  };
  const res = await bidirectionalPriceCalculator(input);
  return NextResponse.json(res);
}
