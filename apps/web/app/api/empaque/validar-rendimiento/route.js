import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Validación de Rendimiento: tolerancia 2.5%
// Kilos_Totales_Salida = Export + Nacional + Canica + Merma + Deshidratacion
// Si |Peso_Bruto_Recibido - Total_Salida| > 2.5% => alerta + requiere PIN supervisor
export async function POST(request) {
  try {
    const { lotId, pesoBrutoRecibido, kilosExport, kilosNacional, kilosCanica, kilosMerma, kilosDeshidratacion, pin, usuario } = await request.json();

    if (!lotId) return NextResponse.json({ error: "lotId requerido" }, { status: 400 });

    const bruto = parseFloat(pesoBrutoRecibido) || 0;
    const salida = (parseFloat(kilosExport)||0) + (parseFloat(kilosNacional)||0) + (parseFloat(kilosCanica)||0) + (parseFloat(kilosMerma)||0) + (parseFloat(kilosDeshidratacion)||0);

    const diff = bruto > 0 ? Math.abs(bruto - salida) : 0;
    const pct = bruto > 0 ? (diff / bruto) * 100 : 0;
    const supera = pct > 2.5;

    let autorizado = true;
    let mensaje = "Rendimiento dentro de tolerancia.";

    if (supera) {
      mensaje = `Descuadre de Kilos superior al permitido (${pct.toFixed(2)}%). Requiere clave de supervisor para autorizar el cierre.`;
      if (!pin) {
        return NextResponse.json({ 
          valid: false, 
          superaTolerancia: true, 
          porcentaje: pct.toFixed(2), 
          mensaje,
          requiresPin: true 
        }, { status: 200 });
      }
      // Verificar PIN
      const base = new URL(request.url).origin;
      const verify = await fetch(`${base}/api/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usuario || 'supervisor', pin, requiredRole: 'SUPERVISOR_CALIDAD' })
      });
      const v = await verify.json();
      if (!v.authorized) {
        return NextResponse.json({ valid: false, superaTolerancia: true, mensaje: "PIN de supervisor inválido", requiresPin: true }, { status: 403 });
      }
      autorizado = true;
      // Log autorización
      await sql`
        INSERT INTO pin_audit_log (user_id, module, entity_type, entity_id, campo_modificado, valor_anterior, valor_nuevo, motivo_ajuste, timestamp)
        VALUES (${usuario || 'supervisor'}, 'empaque', 'rendimiento', ${parseInt(lotId)}, 'descuadre', ${String(bruto)}, ${String(salida)}, 'Autorizado por supervisor (PIN) - tolerancia 2.5%', CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json({
      valid: true,
      superaTolerancia: supera,
      porcentaje: pct.toFixed(2),
      bruto,
      salida,
      mensaje: autorizado ? "Cierre autorizado." : mensaje
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
