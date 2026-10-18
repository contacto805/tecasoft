import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { 
  getKpiSummary, getLotPerformance, getPaymentStatus, searchProducers, IA_TOOLS,
  getWeeklyClosing, getMaterialConsumption, getPackingCostPerTarima, getProducerPaymentsDue,
  getBankPayments, getUnreconciledMovements, getLotsWithLosses, getInventorySummary,
  getClientPendingBalances, getRentabilidadAnalysis, runErrorDetection, getFinancialSimulator
} from "@/app/api/utils/ai-tools";

// Helper: obtener usuario real de la sesion (reutiliza logica existente)
async function getAuthenticatedUser(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/user`, {
      headers: { cookie },
      credentials: "include"
    });
    if (res.ok) {
      const u = await res.json().catch(() => ({}));
      return u;
    }
    // fallback super check
    const sup = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/check-super-admin`, {
      headers: { cookie },
      credentials: "include"
    });
    if (sup.ok) {
      const s = await sup.json().catch(() => ({}));
      return { is_super_admin: s.isSuperAdmin, admin_role: s.adminRole, id: s.userId };
    }
  } catch (e) {}
  return null;
}

const openai = new OpenAI({
  apiKey: process.env.APPGEN_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://appgen.com/api/cloud/openai/v1",
  defaultHeaders: { "X-AppGen-App-Id": process.env.APP_ID || "" }
});

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isSuper = !!(user.is_super_admin || user.admin_role === "superadministrador");
    const body = await request.json();
    const { message, history = [] } = body || {};

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 });
    }

    // Catálogo de herramientas (solo las permitidas por rol)
    const availableTools = IA_TOOLS; // el caller filtra internamente

    // Ensure literal type for OpenAI SDK
    const toolsForCall = availableTools.map(t => ({ type: "function", function: t.function }));

    const systemPrompt = `Eres TECAVO IA - Inteligencia Empresarial de TECAVO FRUITS (ERP real).
REGLA OBLIGATORIA EN CADA RESPUESTA (nunca omitir):
• Periodo consultado
• Fuente exacta (tabla/API)
• Estado de los datos: CONFIRMADO | DETECTADO | CALCULADO
• Fecha de actualización
• Cálculo realizado (usa motor financiero cuando aplique)
• Registros relacionados (folios o ids)
• Nunca inventes cantidades. Usa SOLO resultados de herramientas.
• Distingue utilidad bruta / operativa / neta y valida denominadores.
• Para conciliación: propone relaciones pero no las aplica automáticamente.
El usuario actual es ${isSuper ? "Superadministrador (visibilidad total)" : "usuario con acceso limitado"}.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6),
      { role: "user", content: message }
    ];

    // Primera llamada con tools
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // proxy resolvera al equivalente disponible
      messages,
      tools: toolsForCall,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 800
    });

    const choice = completion.choices?.[0];
    let finalText = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls || [];

    const toolResults = [];

    for (const tc of toolCalls) {
      const fn = tc?.function || {};
      const name = fn.name;
      let args = {};
      try { args = JSON.parse(fn.arguments || "{}"); } catch {}

      let result;
      if (name === "get_kpi_summary") {
        result = await getKpiSummary(args.period || "week", user);
      } else if (name === "get_lot_performance") {
        result = await getLotPerformance(args || {}, user);
      } else if (name === "get_payment_status") {
        result = await getPaymentStatus(args || {}, user);
      } else if (name === "search_producers") {
        result = await searchProducers(args || {}, user);
      } else if (name === "get_weekly_closing") {
        result = await getWeeklyClosing(args || {}, user);
      } else if (name === "get_material_consumption") {
        result = await getMaterialConsumption(args || {}, user);
      } else if (name === "get_packing_cost_per_tarima") {
        result = await getPackingCostPerTarima(args || {}, user);
      } else if (name === "get_producer_payments_due") {
        result = await getProducerPaymentsDue(args || {}, user);
      } else if (name === "get_bank_payments") {
        result = await getBankPayments(args || {}, user);
      } else if (name === "get_unreconciled_movements") {
        result = await getUnreconciledMovements(args || {}, user);
      } else if (name === "get_lots_with_losses") {
        result = await getLotsWithLosses(args || {}, user);
      } else if (name === "get_inventory_summary") {
        result = await getInventorySummary(args || {}, user);
      } else if (name === "get_client_pending_balances") {
        result = await getClientPendingBalances(args || {}, user);
      } else if (name === "get_rentabilidad_analysis") {
        result = await getRentabilidadAnalysis(args || {}, user);
      } else if (name === "run_error_detection") {
        result = await runErrorDetection(args || {}, user);
      } else if (name === "get_financial_simulator") {
        result = await getFinancialSimulator(args || {}, user);
      } else {
        result = { error: "Herramienta no permitida" };
      }

      toolResults.push({ name, result });

      // Agregar resultado de tool al historial para segunda pasada si es necesario
      messages.push({ role: "assistant", content: null, tool_calls: [tc] });
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }

    if (toolResults.length > 0) {
      // Segunda llamada para que el modelo sintetice
      const final = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        max_tokens: 700
      });
      finalText = final.choices?.[0]?.message?.content || finalText;
    }

    // Registrar en auditoria (reutiliza tabla existente)
    try {
      await sql`
        INSERT INTO system_audit_log (user_id, user_name, module, action, entity_type, description, status, timestamp)
        VALUES (${user.id || "unknown"}, ${user.name || user.email || "ia-user"}, "teca-vo-ia", "consulta", "chat", ${message.slice(0,200)}, "exitoso", NOW())
      `;
    } catch {}

    return NextResponse.json({
      reply: finalText || "No pude generar respuesta con los datos disponibles.",
      toolsUsed: toolResults.map(t => t.name),
      userRole: isSuper ? "superadministrador" : "limitado",
      timestamp: new Date().toISOString(),
      source: "datos reales de la base via herramientas seguras"
    });
  } catch (err) {
    console.error("TECAVO IA chat error:", err);
    return NextResponse.json({
      error: "Error en TECAVO IA",
      detail: String(err.message || err),
      note: "Si OpenAI no esta disponible, el resto del sistema sigue funcionando."
    }, { status: 500 });
  }
}

// Test de conexion simple (para config)
export async function GET() {
  try {
    if (!process.env.APPGEN_API_KEY) {
      return NextResponse.json({ connected: false, error: "APPGEN_API_KEY no configurada" });
    }
    // Llamada minima sin tools
    const test = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Responde solo: OK" }],
      max_tokens: 5
    });
    return NextResponse.json({ connected: true, model: "openai-proxy", reply: test.choices?.[0]?.message?.content });
  } catch (e) {
    return NextResponse.json({ connected: false, error: String(e.message || e) });
  }
}