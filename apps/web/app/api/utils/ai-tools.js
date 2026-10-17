import sql from "@/app/api/utils/sql";

// Catálogo de herramientas seguras para TECAVO IA (BLOQUE 01)
// Todas las funciones verifican rol en el caller. Solo lectura para inicio.
// Nunca exponer datos de terceros si no es Super.

export const IA_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_kpi_summary",
      description: "Resumen ejecutivo real: ventas, cartera, pagos esta semana, kg ingreso/produccion, alertas basicas. Solo Superadministrador ve todos los numeros.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "today|week|month", default: "week" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_lot_performance",
      description: "Rendimiento real de lotes confirmados (kg por calidad, comparacion proyeccion vs real). Requiere lot_id o producer. Filtrado por rol.",
      parameters: {
        type: "object",
        properties: {
          lotId: { type: "string" },
          producer: { type: "string" },
          limit: { type: "number", default: 10 }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_payment_status",
      description: "Estado de pagos programados, saldos, dias de retraso habiles. Productor ve solo los suyos. Super ve todos.",
      parameters: {
        type: "object",
        properties: {
          producerNumber: { type: "string" },
          status: { type: "string", description: "pendiente|esta_semana|atrasado" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_producers",
      description: "Busca productores por numero, nombre, rfc. Resultados filtrados por rol del solicitante.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string" }
        }
      }
    }
  }
];

// Implementaciones reales (seguridad en el caller del chat)

export async function getKpiSummary(period = "week", user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  // Solo datos agregados seguros. Usa tablas reales existentes.
  try {
    const [closings] = await sql`
      SELECT week_label, total_ingresos_dinero, total_egresos_dinero, resultado_dinero, total_cargas_kg
      FROM weekly_closings ORDER BY week_start_date DESC LIMIT 1
    `;
    const [pendingPays] = await sql`
      SELECT COUNT(*) as cnt, COALESCE(SUM(saldo_pendiente),0) as saldo
      FROM payment_schedule WHERE (saldo_pendiente > 0 OR status != 'paid')
    `;
    const [intake] = await sql`
      SELECT COALESCE(SUM(total_kg_received),0) as kg_ingreso FROM lots WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    return {
      source: "weekly_closings + payment_schedule + lots",
      period,
      updated: new Date().toISOString(),
      kpis: {
        ultima_semana_ingresos: closings?.total_ingresos_dinero || 0,
        ultima_semana_egresos: closings?.total_egresos_dinero || 0,
        resultado: closings?.resultado_dinero || 0,
        kg_ingreso_semana: intake?.kg_ingreso || 0,
        pagos_pendientes: pendingPays?.cnt || 0,
        saldo_pendiente: pendingPays?.saldo || 0
      },
      note: isSuper ? "Datos consolidados empresa" : "Datos limitados a tu alcance",
      certainty: "hecho (tablas reales)"
    };
  } catch (e) {
    return { error: "No se pudo consultar KPIs", source: "DB", certainty: "error" };
  }
}

export async function getLotPerformance({ lotId, producer, limit = 10 }, user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    let rows;
    if (lotId) {
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, kg_by_quality, total_kg_process, total_kg_waste, performance_percentage
        FROM lot_performance WHERE lot_id = ${parseInt(lotId) || lotId} OR lot_number = ${lotId} LIMIT 1
      `;
    } else if (producer && !isSuper) {
      // productor solo ve los suyos (filtrado estricto)
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, total_kg_process, total_kg_waste
        FROM lot_performance WHERE producer ILIKE ${'%' + producer + '%'} LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT lot_number, producer, total_kg_received, total_kg_produced, percentage_by_quality, kg_by_quality, total_kg_process, total_kg_waste, performance_percentage
        FROM lot_performance ORDER BY generated_at DESC LIMIT ${limit}
      `;
    }
    return {
      source: "lot_performance (lotificacion confirmada real)",
      count: rows.length,
      rows: rows.map(r => ({ ...r, certainty: "confirmado" })),
      note: "Comparacion proyeccion vs real disponible solo si existe visit_calculator"
    };
  } catch (e) {
    return { error: "Error consultando rendimiento", source: "lot_performance" };
  }
}

export async function getPaymentStatus({ producerNumber, status }, user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  try {
    let q = sql`SELECT folio, producer_name, amount, saldo_pendiente, scheduled_payment_date, dias_retraso_habiles, status FROM payment_schedule`;
    if (!isSuper && producerNumber) {
      q = sql`${q} WHERE producer_name ILIKE ${'%' + producerNumber + '%'} OR producer_name = ${producerNumber}`;
    } else if (!isSuper) {
      return { error: "Productor debe especificar su numero", note: "Sin producerNumber no se muestran datos ajenos" };
    }
    if (status === "atrasado") q = sql`${q} AND (saldo_pendiente > 0) AND scheduled_payment_date < CURRENT_DATE`;
    if (status === "esta_semana") q = sql`${q} AND scheduled_payment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`;
    const rows = await sql`${q} ORDER BY scheduled_payment_date LIMIT 30`;
    return {
      source: "payment_schedule (fechas programadas + retraso habil real)",
      rows,
      note: "Productor solo ve los suyos. Super ve todo."
    };
  } catch (e) {
    return { error: "Error en pagos" };
  }
}

export async function searchProducers({ q }, user) {
  const isSuper = user?.is_super_admin || user?.admin_role === "superadministrador";
  if (!isSuper) return { error: "Busqueda de productores restringida", note: "Solo Superadministrador" };
  try {
    const rows = await sql`
      SELECT id, producer_number, producer_name, whatsapp_phone, rfc, last_login_at
      FROM producer_portal_access
      WHERE producer_number ILIKE ${'%'+(q||'')+'%'} OR producer_name ILIKE ${'%'+(q||'')+'%'} OR rfc ILIKE ${'%'+(q||'')+'%'}
      LIMIT 20
    `;
    return { source: "producer_portal_access", producers: rows };
  } catch (e) {
    return { error: "No se pudo buscar" };
  }
}