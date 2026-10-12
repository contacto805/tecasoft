import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = await sql`
      SELECT * FROM dashboard_configuration
      ORDER BY id DESC
      LIMIT 1
    `;

    // Default full widget set for dashboard principal
    const defaultWidgetOrder = [
      { key: 'precios_fruta_campo', label: 'PRECIOS DE FRUTA EN CAMPO', enabled: true },
      { key: 'estadisticas_rapidas', label: 'Estadísticas Rápidas', enabled: true },
      { key: 'pagos_pendientes', label: 'Pagos Pendientes', enabled: true },
      { key: 'fletes_semana', label: 'Fletes por Pagar Semana', enabled: true },
      { key: 'compras_programadas', label: 'Compras con Pago Programado', enabled: true },
      { key: 'batch_tracking', label: 'Panel de Seguimiento Lotes', enabled: true },
      { key: 'system_health', label: 'Estado del Sistema', enabled: true },
      { key: 'viajes_semana', label: 'Viajes de la Semana', enabled: true },
      { key: 'accesos_rapidos', label: 'Accesos Directos', enabled: true },
    ];

    if (config.length === 0) {
      // Return default configuration including all widgets for admin section and dashboard
      return NextResponse.json({
        primary_color: '#0E4A22',
        secondary_color: '#963821',
        accent_color: '#E0DA62',
        header_color: '#1F2937',
        card_color: '#FFFFFF',
        alert_color: '#EF4444',
        notification_color: '#3B82F6',
        chart_color: '#10B981',
        show_week_indicator: true,
        show_fruit_intake_week: true,
        show_fruit_intake_month: true,
        show_inventory_cold: true,
        show_inventory_floor: true,
        show_operational_alerts: true,
        show_calendar: true,
        show_payment_schedule: true,
        widget_order: defaultWidgetOrder
      });
    }

    const row = config[0];
    // Ensure widget_order has full info if empty
    if (!row.widget_order || (Array.isArray(row.widget_order) && row.widget_order.length === 0)) {
      row.widget_order = defaultWidgetOrder;
    }
    return NextResponse.json(row);
  } catch (error) {
    console.error("Error fetching dashboard config:", error);
    // Robust fallback with widgets
    return NextResponse.json({
      primary_color: '#0E4A22',
      secondary_color: '#963821',
      accent_color: '#E0DA62',
      header_color: '#1F2937',
      card_color: '#FFFFFF',
      alert_color: '#EF4444',
      notification_color: '#3B82F6',
      chart_color: '#10B981',
      show_week_indicator: true,
      show_fruit_intake_week: true,
      show_fruit_intake_month: true,
      show_inventory_cold: true,
      show_inventory_floor: true,
      show_operational_alerts: true,
      show_calendar: true,
      show_payment_schedule: true,
      widget_order: [
        { key: 'precios_fruta_campo', label: 'PRECIOS DE FRUTA EN CAMPO', enabled: true },
        { key: 'estadisticas_rapidas', label: 'Estadísticas Rápidas', enabled: true },
        { key: 'pagos_pendientes', label: 'Pagos Pendientes', enabled: true },
        { key: 'fletes_semana', label: 'Fletes por Pagar Semana', enabled: true },
        { key: 'compras_programadas', label: 'Compras con Pago Programado', enabled: true },
        { key: 'batch_tracking', label: 'Panel de Seguimiento Lotes', enabled: true },
        { key: 'system_health', label: 'Estado del Sistema', enabled: true },
        { key: 'viajes_semana', label: 'Viajes de la Semana', enabled: true },
        { key: 'accesos_rapidos', label: 'Accesos Directos', enabled: true },
      ]
    });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    
    const {
      primary_color,
      secondary_color,
      accent_color,
      header_color,
      card_color,
      alert_color,
      notification_color,
      chart_color,
      show_week_indicator,
      show_fruit_intake_week,
      show_fruit_intake_month,
      show_inventory_cold,
      show_inventory_floor,
      show_operational_alerts,
      show_calendar,
      show_payment_schedule,
      widget_order,
      updated_by
    } = data;

    // Check if config exists
    const existing = await sql`
      SELECT id FROM dashboard_configuration
      ORDER BY id DESC
      LIMIT 1
    `;

    let result;
    if (existing.length > 0) {
      // Update existing
      result = await sql`
        UPDATE dashboard_configuration SET
          primary_color = ${primary_color || '#0E4A22'},
          secondary_color = ${secondary_color || '#963821'},
          accent_color = ${accent_color || '#E0DA62'},
          header_color = ${header_color || '#1F2937'},
          card_color = ${card_color || '#FFFFFF'},
          alert_color = ${alert_color || '#EF4444'},
          notification_color = ${notification_color || '#3B82F6'},
          chart_color = ${chart_color || '#10B981'},
          show_week_indicator = ${show_week_indicator !== undefined ? show_week_indicator : true},
          show_fruit_intake_week = ${show_fruit_intake_week !== undefined ? show_fruit_intake_week : true},
          show_fruit_intake_month = ${show_fruit_intake_month !== undefined ? show_fruit_intake_month : true},
          show_inventory_cold = ${show_inventory_cold !== undefined ? show_inventory_cold : true},
          show_inventory_floor = ${show_inventory_floor !== undefined ? show_inventory_floor : true},
          show_operational_alerts = ${show_operational_alerts !== undefined ? show_operational_alerts : true},
          show_calendar = ${show_calendar !== undefined ? show_calendar : true},
          show_payment_schedule = ${show_payment_schedule !== undefined ? show_payment_schedule : true},
          widget_order = ${widget_order ? JSON.stringify(widget_order) : '[]'},
          updated_by = ${updated_by || 'system'},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
    } else {
      // Insert new
      result = await sql`
        INSERT INTO dashboard_configuration (
          primary_color,
          secondary_color,
          accent_color,
          header_color,
          card_color,
          alert_color,
          notification_color,
          chart_color,
          show_week_indicator,
          show_fruit_intake_week,
          show_fruit_intake_month,
          show_inventory_cold,
          show_inventory_floor,
          show_operational_alerts,
          show_calendar,
          show_payment_schedule,
          widget_order,
          updated_by
        ) VALUES (
          ${primary_color || '#0E4A22'},
          ${secondary_color || '#963821'},
          ${accent_color || '#E0DA62'},
          ${header_color || '#1F2937'},
          ${card_color || '#FFFFFF'},
          ${alert_color || '#EF4444'},
          ${notification_color || '#3B82F6'},
          ${chart_color || '#10B981'},
          ${show_week_indicator !== undefined ? show_week_indicator : true},
          ${show_fruit_intake_week !== undefined ? show_fruit_intake_week : true},
          ${show_fruit_intake_month !== undefined ? show_fruit_intake_month : true},
          ${show_inventory_cold !== undefined ? show_inventory_cold : true},
          ${show_inventory_floor !== undefined ? show_inventory_floor : true},
          ${show_operational_alerts !== undefined ? show_operational_alerts : true},
          ${show_calendar !== undefined ? show_calendar : true},
          ${show_payment_schedule !== undefined ? show_payment_schedule : true},
          ${widget_order ? JSON.stringify(widget_order) : '[]'},
          ${updated_by || 'system'}
        )
        RETURNING *
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada exitosamente',
      data: result[0]
    });
  } catch (error) {
    console.error("Error saving dashboard config:", error);
    return NextResponse.json(
      { error: "Error al guardar configuración" },
      { status: 500 }
    );
  }
}
