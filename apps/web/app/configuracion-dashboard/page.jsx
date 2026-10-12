"use client";

import { useState, useEffect } from "react";
import { Settings, Palette, Eye, EyeOff, Save, RotateCcw } from "lucide-react";

export default function DashboardConfigPage() {
  const [config, setConfig] = useState({
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
    widget_order: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/dashboard-config');
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, updated_by: 'superadmin' })
      });

      if (res.ok) {
        alert('Configuración guardada exitosamente');
      } else {
        alert('Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('¿Estás seguro de restaurar los valores predeterminados?')) {
      setConfig({
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
        widget_order: []
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración del Dashboard</h1>
                <p className="text-sm text-gray-500">Personaliza la apariencia y contenido del dashboard principal</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restaurar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Color Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Colores Corporativos</h2>
            </div>

            <div className="space-y-4">
              {[
                { key: 'primary_color', label: 'Color Principal', description: 'Color primario del sistema' },
                { key: 'secondary_color', label: 'Color Secundario', description: 'Color de acentos secundarios' },
                { key: 'accent_color', label: 'Color de Acento', description: 'Color de elementos destacados' },
                { key: 'header_color', label: 'Color de Encabezados', description: 'Color de títulos y encabezados' },
                { key: 'card_color', label: 'Color de Tarjetas', description: 'Color de fondo de tarjetas KPI' },
                { key: 'alert_color', label: 'Color de Alertas', description: 'Color de notificaciones urgentes' },
                { key: 'notification_color', label: 'Color de Notificaciones', description: 'Color de notificaciones generales' },
                { key: 'chart_color', label: 'Color de Gráficos', description: 'Color principal de gráficas' }
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{label}</div>
                    <div className="text-xs text-gray-500">{description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer border-2 border-gray-200"
                    />
                    <input
                      type="text"
                      value={config[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Widget Visibility */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Eye className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Widgets Visibles</h2>
            </div>

            <div className="space-y-3">
              {[
                { key: 'show_week_indicator', label: 'Indicador de Semana', description: 'Muestra la semana operativa actual' },
                { key: 'show_fruit_intake_week', label: 'Fruta Ingresada vs Vendida (Semana)', description: 'Estadísticas semanales' },
                { key: 'show_fruit_intake_month', label: 'Fruta Ingresada vs Vendida (Mes)', description: 'Estadísticas mensuales' },
                { key: 'show_inventory_cold', label: 'Inventario en Frío', description: 'Tarimas en cámaras' },
                { key: 'show_inventory_floor', label: 'Inventario en Piso', description: 'Tarimas pendientes de ingreso' },
                { key: 'show_operational_alerts', label: 'Alertas Operativas', description: 'Notificaciones importantes' },
                { key: 'show_calendar', label: 'Calendario', description: 'Vista de calendario de eventos' },
                { key: 'show_payment_schedule', label: 'Programación de Pagos', description: 'Próximos pagos programados' }
              ].map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {config[key] ? (
                      <Eye className="w-5 h-5 text-green-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{label}</div>
                      <div className="text-xs text-gray-500">{description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config[key] ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vista Previa</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg text-white text-center" style={{ backgroundColor: config.primary_color }}>
              <div className="text-sm font-medium">Principal</div>
              <div className="text-xs opacity-80 mt-1">{config.primary_color}</div>
            </div>
            <div className="p-4 rounded-lg text-white text-center" style={{ backgroundColor: config.secondary_color }}>
              <div className="text-sm font-medium">Secundario</div>
              <div className="text-xs opacity-80 mt-1">{config.secondary_color}</div>
            </div>
            <div className="p-4 rounded-lg text-gray-900 text-center" style={{ backgroundColor: config.accent_color }}>
              <div className="text-sm font-medium">Acento</div>
              <div className="text-xs opacity-80 mt-1">{config.accent_color}</div>
            </div>
            <div className="p-4 rounded-lg text-white text-center" style={{ backgroundColor: config.header_color }}>
              <div className="text-sm font-medium">Encabezado</div>
              <div className="text-xs opacity-80 mt-1">{config.header_color}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
