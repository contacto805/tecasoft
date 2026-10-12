"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, GripVertical, Eye, Palette } from "lucide-react";

const DEFAULT_CONFIG = {
  primary_color: "#0E4A22",
  secondary_color: "#963821",
  accent_color: "#E0DA62",
  header_color: "#1F2937",
  card_color: "#FFFFFF",
  alert_color: "#EF4444",
  notification_color: "#3B82F6",
  chart_color: "#10B981",
  show_week_indicator: true,
  show_fruit_intake_week: true,
  show_fruit_intake_month: true,
  show_inventory_cold: true,
  show_inventory_floor: true,
  show_operational_alerts: true,
  show_calendar: true,
  show_payment_schedule: true,
  widget_order: ["week_indicator","fruit_intake_week","fruit_intake_month","inventory_cold","inventory_floor","operational_alerts","payment_schedule","calendar"],
};

const WIDGETS = [
  { key: "week_indicator", label: "Indicador de Semana Actual", desc: "Semana operativa Lunes-Sábado" },
  { key: "fruit_intake_week", label: "Fruta Ingresada vs Vendida (Semana)", desc: "Kg procesos, desecho y ventas" },
  { key: "fruit_intake_month", label: "Fruta Ingresada vs Vendida (Mes)", desc: "Kg producción, desecho y ventas" },
  { key: "inventory_cold", label: "Inventario de Tarimas en Frio", desc: "Tarimas completas por cliente/calibre/empaque" },
  { key: "inventory_floor", label: "Inventario de Tarimas en Piso", desc: "Pendientes de ingreso a frío" },
  { key: "operational_alerts", label: "Alertas Operativas", desc: "Vencimientos, pendientes de pago, órdenes, embarques" },
  { key: "payment_schedule", label: "Programación de Pagos", desc: "Calendario y vencimientos financieros" },
  { key: "calendar", label: "Calendario de la Semana/Mes", desc: "Vistas por periodo operativo" },
];

export default function DashboardConfigPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [previewConfig, setPreviewConfig] = useState(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConfigAndUser();
  }, []);

  const loadConfigAndUser = async () => {
    setLoading(true);
    try {
      // User & super admin check
      const userRes = await fetch("/api/auth/user", { credentials: "include" });
      if (userRes.ok) {
        const u = await userRes.json();
        setUser(u);
        const adminRes = await fetch("/api/auth/check-super-admin", { credentials: "include" });
        if (adminRes.ok) {
          const adminD = await adminRes.json();
          setIsSuperAdmin(!!adminD.isSuperAdmin);
        }
      }

      // Dashboard config
      const res = await fetch("/api/dashboard-config");
      if (res.ok) {
        const data = await res.json();
        const cfg = { ...DEFAULT_CONFIG, ...data };
        if (typeof cfg.widget_order === "string") {
          try { cfg.widget_order = JSON.parse(cfg.widget_order); } catch(_) { cfg.widget_order = DEFAULT_CONFIG.widget_order; }
        }
        if (!Array.isArray(cfg.widget_order) || cfg.widget_order.length === 0) {
          cfg.widget_order = DEFAULT_CONFIG.widget_order;
        }
        setConfig(cfg);
        setPreviewConfig(cfg);
        setOriginalConfig(JSON.parse(JSON.stringify(cfg)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateColor = (key, value) => {
    const newCfg = { ...previewConfig, [key]: value };
    setPreviewConfig(newCfg);
  };

  const toggleWidget = (key) => {
    const newCfg = { ...previewConfig, [key]: !previewConfig[key] };
    setPreviewConfig(newCfg);
  };

  const reorderWidgets = (fromIndex, toIndex) => {
    const order = [...previewConfig.widget_order];
    const [item] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, item);
    const newCfg = { ...previewConfig, widget_order: order };
    setPreviewConfig(newCfg);
  };

  const resetPreview = () => {
    setPreviewConfig(originalConfig || DEFAULT_CONFIG);
  };

  const applyPreview = () => {
    setConfig(previewConfig);
  };

  const saveConfig = async () => {
    if (!isSuperAdmin) {
      alert("Solo Superadministrador puede guardar la configuración del Dashboard");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        ...previewConfig,
        widget_order: previewConfig.widget_order,
        updated_by: user?.name || "super-admin",
      };
      const res = await fetch("/api/dashboard-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(previewConfig);
        setOriginalConfig(JSON.parse(JSON.stringify(previewConfig)));
        setMessage("Configuración del Dashboard guardada correctamente. Los cambios se reflejan en vivo en el tablero principal.");
        setTimeout(() => setMessage(""), 4000);
      } else {
        const err = await res.json();
        alert(err.error || "Error al guardar");
      }
    } catch (e) {
      alert("Error guardando configuración");
    } finally {
      setSaving(false);
    }
  };

  const userCanEdit = isSuperAdmin;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Cargando configuración de dashboard...</div>
      </div>
    );
  }

  const visibleWidgets = previewConfig.widget_order
    .filter(k => WIDGETS.find(w => w.key === k))
    .map(key => WIDGETS.find(w => w.key === key));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Configuración de Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Personalización visual, indicadores y vistas para el tablero principal • Superadministrador</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex gap-2 items-center">
              Regresar al Dashboard
            </button>
            {userCanEdit ? (
              <>
                <button onClick={resetPreview} className="px-4 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-100" disabled={saving}>
                  <RotateCcw size={16}/> Reiniciar vista previa
                </button>
                <button onClick={saveConfig} disabled={saving} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-60">
                  <Save size={16}/> {saving ? "Guardando..." : "Guardar Configuración"}
                </button>
              </>
            ) : (
              <div className="text-xs px-3 py-1.5 rounded bg-amber-100 text-amber-800">Solo lectura • Solo Superadmin edita</div>
            )}
          </div>
        </div>

        {message && <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{message}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Colores corporativos */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg"><Palette size={18}/> Colores Corporativos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {[
                  ["primary_color", "Color Principal"],
                  ["secondary_color", "Color Secundario"],
                  ["header_color", "Encabezados"],
                  ["card_color", "Tarjetas KPI"],
                  ["alert_color", "Alertas"],
                  ["notification_color", "Notificaciones"],
                  ["chart_color", "Gráficos"],
                ].map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-wider font-medium text-gray-600">{label}</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={previewConfig[key]} 
                        disabled={!userCanEdit}
                        onChange={(e) => updateColor(key, e.target.value)} 
                        className="w-14 h-9 p-0 border rounded cursor-pointer" 
                      />
                      <input 
                        type="text" 
                        value={previewConfig[key]} 
                        disabled={!userCanEdit}
                        onChange={(e) => updateColor(key, e.target.value)} 
                        className="flex-1 border px-3 py-1.5 text-sm rounded font-mono" 
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">Cambios se aplican instantáneamente a la vista previa del lado derecho.</p>
            </div>

            {/* Vistas y Widgets toggles + drag order */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-semibold mb-4 text-lg">Configuración de Vistas y Widgets</h3>
              <div className="space-y-3 mb-6">
                {WIDGETS.map((w) => (
                  <div key={w.key} className="flex items-center justify-between border rounded-xl px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{w.label}</div>
                      <div className="text-xs text-gray-500">{w.desc}</div>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!previewConfig[w.key]} 
                        onChange={() => toggleWidget(w.key)} 
                        disabled={!userCanEdit} 
                        className="h-4 w-4 accent-emerald-600" 
                      />
                    </label>
                  </div>
                ))}
              </div>

              <h4 className="font-medium mb-2 text-sm text-gray-700">Orden de Widgets (arrastra)</h4>
              <div className="border rounded-xl divide-y">
                {visibleWidgets.map((w, idx) => (
                  <div 
                    key={w.key} 
                    className="flex px-4 py-2.5 items-center gap-3 bg-white text-sm select-none"
                    draggable={userCanEdit}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      if (!userCanEdit) return;
                      const from = parseInt(e.dataTransfer.getData("text/plain"));
                      if (from !== idx) reorderWidgets(from, idx);
                    }}
                  >
                    <GripVertical size={16} className="text-gray-400" />
                    <span className="flex-1">{w.label}</span>
                    <span className="text-[10px] text-gray-400">#{idx + 1}</span>
                  </div>
                ))}
                {!visibleWidgets.length && <div className="px-4 py-4 text-gray-500 text-sm">No hay widgets activos (activa algunos arriba).</div>}
              </div>
              {!userCanEdit && <div className="text-xs mt-2 text-amber-700">Edición bloqueada. Solo Superadministrador.</div>}
            </div>
          </div>

          {/* LIVE PREVIEW */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="px-6 py-3 bg-gray-900 text-white flex items-center gap-2 text-sm font-medium">
                <Eye size={16} /> Vista Previa en tiempo real del Dashboard Principal
              </div>
              <div 
                className="p-6 space-y-6" 
                style={{ 
                  "--pc": previewConfig.primary_color, 
                  "--sc": previewConfig.secondary_color, 
                  "--hc": previewConfig.header_color, 
                  "--cc": previewConfig.card_color, 
                }}
              >
                {/* Week indicator */}
                {previewConfig.show_week_indicator && (
                  <div className="rounded-xl border p-4" style={{ background: previewConfig.card_color }}>
                    <div className="uppercase text-xs tracking-widest font-medium" style={{ color: previewConfig.primary_color }}>SEMANA OPERATIVA</div>
                    <div className="text-3xl font-semibold mt-1" style={{ color: previewConfig.header_color }}>Semana 28</div>
                    <div className="text-sm mt-0.5" style={{ color: "#475569" }}>Lunes 06 Julio 2026 — Sábado 11 Julio 2026</div>
                  </div>
                )}

                {/* KPIs sample */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previewConfig.show_fruit_intake_week && (
                    <div className="p-4 rounded-xl shadow-sm border" style={{ background: previewConfig.card_color }}>
                      <div style={{ color: previewConfig.secondary_color }} className="text-xs">SEMANA • KG</div>
                      <div className="text-2xl font-semibold mt-1">148,320 kg ingresados</div>
                      <div className="text-sm text-emerald-700">112,480 vendidos • 26,900 proceso • 8,940 desecho</div>
                    </div>
                  )}
                  {previewConfig.show_fruit_intake_month && (
                    <div className="p-4 rounded-xl shadow-sm border" style={{ background: previewConfig.card_color }}>
                      <div style={{ color: previewConfig.secondary_color }} className="text-xs">MES • KG</div>
                      <div className="text-2xl font-semibold mt-1">612,790 kg ingresados</div>
                      <div className="text-sm text-emerald-700">589,100 vendidos • Existencia 37,840 kg</div>
                    </div>
                  )}
                </div>

                {/* Inventory samples */}
                {(previewConfig.show_inventory_cold || previewConfig.show_inventory_floor) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewConfig.show_inventory_cold && (
                      <div className="bg-white border rounded-xl p-4" style={{ background: previewConfig.card_color, borderColor: previewConfig.primary_color + '33' }}>
                        <div className="font-medium text-sm mb-1" style={{ color: previewConfig.header_color }}>Tarimas en Frio</div>
                        <div className="text-xs">24 tarimas • 3 clientes • 5 calibres</div>
                      </div>
                    )}
                    {previewConfig.show_inventory_floor && (
                      <div className="bg-white border rounded-xl p-4" style={{ background: previewConfig.card_color }}>
                        <div className="font-medium text-sm mb-1" style={{ color: previewConfig.header_color }}>Tarimas en Piso (pendientes frío)</div>
                        <div className="text-xs">14 tarimas • Listas para ingreso</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Alerts */}
                {previewConfig.show_operational_alerts && (
                  <div className="border-l-4 pl-3 text-sm rounded" style={{ borderColor: previewConfig.alert_color }}>
                    7 lotes próximos a vencer pago • 3 órdenes de compra pendientes • 1 embarque en preparación
                  </div>
                )}

                {/* Payment schedule indicator */}
                {previewConfig.show_payment_schedule && (
                  <div className="p-4 bg-white border rounded" style={{ borderColor: previewConfig.secondary_color + '40' }}>
                    <div className="font-medium" style={{ color: previewConfig.header_color }}>Pagos programados esta semana</div>
                    <div className="text-2xl font-semibold mt-0.5" style={{ color: previewConfig.primary_color }}>$842,190.00 • 11 productores</div>
                  </div>
                )}

                <div className="text-[10px] text-gray-400 py-2">Las tarjetas y colores usarán exactamente los valores configurados al guardar.</div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-8">Los cambios en la configuración se aplican inmediatamente para todos los usuarios del sistema.</p>
      </div>
    </div>
  );
}
