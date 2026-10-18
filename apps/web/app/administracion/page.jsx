'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import WeeklySummaryReport from '@/components/weekly-summary-report';
import DownloadReportButton from '@/components/download-report-button';
import { formatCurrency } from '@/utils/currency';

export default function AdministracionPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState({
    totalSalesDay: 0,
    totalSalesWeek: 0,
    totalSalesMonth: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    bankBalance: 0,
    pendingLoans: 0,
    pendingAdvances: 0,
    authorizations: 0
  });

  const [widgets, setWidgets] = useState([
    { key: 'precios_fruta_campo', label: 'PRECIOS DE FRUTA EN CAMPO', enabled: true },
    { key: 'estadisticas_rapidas', label: 'Estadísticas Rápidas', enabled: true },
    { key: 'pagos_pendientes', label: 'Pagos Pendientes', enabled: true },
    { key: 'fletes_semana', label: 'Fletes por Pagar Semana', enabled: true },
    { key: 'compras_programadas', label: 'Compras con Pago Programado', enabled: true },
    { key: 'batch_tracking', label: 'Panel de Seguimiento Lotes', enabled: true },
    { key: 'system_health', label: 'Estado del Sistema', enabled: true },
    { key: 'viajes_semana', label: 'Viajes de la Semana', enabled: true },
    { key: 'accesos_rapidos', label: 'Accesos Directos', enabled: true },
  ]);
  const [newWidgetLabel, setNewWidgetLabel] = useState('');
  const [widgetsSaving, setWidgetsSaving] = useState(false);
  const [liveDivisions, setLiveDivisions] = useState([]);
  const [assignedSections, setAssignedSections] = useState([]);

  const refreshMenuAndConfigs = async () => {
    try {
      const groups = await fetch('/api/menu?credential=administrador', { credentials: 'include' }).then(r => r.json()).catch(() => []);
      const flat = (groups || []).flatMap(g => (g.modules || []).map(mm => ({...mm, _group: g.group_name })));
      setAssignedSections(flat.filter(f => f.module_route));

      // also refresh dashboard widgets and colors when super changes them
      try {
        const dc = await fetch('/api/dashboard-config');
        if (dc.ok) {
          const data = await dc.json();
          if (data.widget_order && Array.isArray(data.widget_order) && data.widget_order.length > 0) {
            const saved = data.widget_order.map(item => {
              if (typeof item === 'string') return { key: item, label: item.replace(/_/g, ' ').toUpperCase(), enabled: true };
              return { key: item.key || item, label: item.label || (item.key || item).replace(/_/g,' ').toUpperCase(), enabled: item.enabled !== false };
            });
            setWidgets(saved);
          }
        }
      } catch (_) {}
      try {
        const cs = await fetch('/api/color-schemes');
        if (cs.ok) {
          const schemes = await cs.json().catch(() => []);
          const mod = (schemes || []).find(s => s.module_name === 'module-tabs');
          if (mod) {
            setModuleColors({
              btnBg: mod.primary_color || '#3E2723',
              btnText: mod.text_color || '#ffffff'
            });
          }
        }
      } catch (_) {}
    } catch (_) {}
  };

  useEffect(() => {
    refreshMenuAndConfigs();
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/api/admin/executive-dashboard');
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      }
    };
    fetchDashboard();
  }, []);

  useEffect(() => {
    const loadWidgetConfig = async () => {
      try {
        const res = await fetch('/api/dashboard-config');
        if (res.ok) {
          const data = await res.json();
          if (data.widget_order && Array.isArray(data.widget_order) && data.widget_order.length > 0) {
            const saved = data.widget_order.map(item => {
              if (typeof item === 'string') return { key: item, label: item.replace(/_/g, ' ').toUpperCase(), enabled: true };
              return { key: item.key || item, label: item.label || (item.key || item).replace(/_/g,' ').toUpperCase(), enabled: item.enabled !== false };
            });
            setWidgets(saved);
          }
        }
      } catch (e) {}
    };
    loadWidgetConfig();
  }, []);

  const toggleWidgetEnabled = (idx) => {
    const copy = [...widgets];
    copy[idx].enabled = !copy[idx].enabled;
    setWidgets(copy);
  };
  const updateWidgetLabel = (idx, val) => {
    const copy = [...widgets];
    copy[idx].label = val;
    setWidgets(copy);
  };
  const moveWidget = (idx, dir) => {
    const copy = [...widgets];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= copy.length) return;
    const [moved] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, moved);
    setWidgets(copy);
  };
  const removeWidget = (idx) => {
    if (!confirm('Quitar este widget del dashboard?')) return;
    const copy = [...widgets];
    copy.splice(idx, 1);
    setWidgets(copy);
  };
  const addNewWidget = () => {
    if (!newWidgetLabel.trim()) return;
    const cleanKey = newWidgetLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (widgets.some(w => w.key === cleanKey)) { alert('Ya existe un widget con ese nombre.'); return; }
    setWidgets([...widgets, { key: cleanKey, label: newWidgetLabel.trim(), enabled: true }]);
    setNewWidgetLabel('');
  };
  const saveWidgetsConfig = async () => {
    setWidgetsSaving(true);
    try {
      const order = widgets.map(w => w);
      const res = await fetch('/api/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_order: order }),
      });
      if (res.ok) {
        alert('Configuración de widgets guardada. Recarga o navega al Dashboard Principal para ver los cambios.');
      } else {
        alert('Error al guardar');
      }
    } catch (e) {
      alert('Error guardando widgets');
    } finally {
      setWidgetsSaving(false);
    }
  };

  const [fruitEntries, setFruitEntries] = useState([]);
  const [fruitSummary, setFruitSummary] = useState({ totalLots: 0, totalKg: 0, totalEst: 0, producersCount: 0 });
  const [fruitProducers, setFruitProducers] = useState([]);
  const [frStart, setFrStart] = useState(() => new Date(Date.now() - 365*24*60*60*1000).toISOString().slice(0, 10));
  const [frEnd, setFrEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [frProducer, setFrProducer] = useState("");
  const [loadingFruit, setLoadingFruit] = useState(false);
  const [showGrouped, setShowGrouped] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Custom colors for module tabs/button (global)
  const [moduleColors, setModuleColors] = useState({ btnBg: '#3E2723', btnText: '#ffffff' });
  const [colorsSaving, setColorsSaving] = useState(false);

  const loadFruitRelations = async () => {
    setLoadingFruit(true);
    try {
      const params = new URLSearchParams();
      params.append("startDate", frStart);
      params.append("endDate", frEnd);
      if (frProducer) params.append("producer", frProducer);
      const res = await fetch(`/api/admin/fruit-relations?${params.toString()}`);
      const data = await res.json() || {};
      setFruitEntries(data.entries || []);
      setFruitSummary(data.summary || { totalLots: 0, totalKg: 0, totalEst: 0, producersCount: 0 });
      setFruitProducers(data.producers || []);
    } catch (e) {
      console.error("Error cargando relaciones:", e);
    } finally {
      setLoadingFruit(false);
    }
  };
  useEffect(() => {
    loadFruitRelations();
  }, [refreshKey]);

  useEffect(() => {
    loadModuleColors();
  }, []);

  // Real-time listeners for Superadministrador config changes (menu, widgets, colors) to reflect immediately in Administración General
  useEffect(() => {
    const onFocus = () => refreshMenuAndConfigs();
    const onVis = () => { if (!document.hidden) refreshMenuAndConfigs(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(refreshMenuAndConfigs, 28000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, []);
  const applyFruitFilters = () => loadFruitRelations();
  const resetFruitFilters = () => {
    const defStart = new Date(Date.now() - 365*24*60*60*1000).toISOString().slice(0, 10);
    const defEnd = new Date().toISOString().slice(0, 10);
    setFrStart(defStart);
    setFrEnd(defEnd);
    setFrProducer("");
    setTimeout(loadFruitRelations, 30);
  };

  // Load module button colors for custom UI
  const loadModuleColors = async () => {
    try {
      const res = await fetch('/api/color-schemes');
      if (res.ok) {
        const schemes = await res.json().catch(() => []);
        const mod = (schemes || []).find(s => s.module_name === 'module-tabs');
        if (mod) {
          setModuleColors({
            btnBg: mod.primary_color || '#3E2723',
            btnText: mod.text_color || '#ffffff'
          });
        }
      }
    } catch (e) {}
  };

  const saveModuleColors = async () => {
    setColorsSaving(true);
    try {
      await fetch('/api/color-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_name: 'module-tabs',
          primary_color: moduleColors.btnBg,
          text_color: moduleColors.btnText,
          secondary_color: moduleColors.btnBg,
          accent_color: '#ffffff'
        })
      });
      // update live CSS vars for instant styling across buttons
      document.documentElement.style.setProperty('--mod-tab-bg', moduleColors.btnBg);
      document.documentElement.style.setProperty('--mod-tab-text', moduleColors.btnText);
      alert('Colores de botones de módulos actualizados. Reflejo global aplicado.');
    } catch (e) {
      alert('Error al guardar colores');
    } finally {
      setColorsSaving(false);
    }
  };

  const groupedEntries = {};
  fruitEntries.forEach((entry) => {
    const key = entry.producer || "Sin productor";
    if (!groupedEntries[key]) groupedEntries[key] = [];
    groupedEntries[key].push(entry);
  });
  const producersInList = Object.keys(groupedEntries);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">ADMINISTRACIÓN — Dashboard Principal</h1>
          <p className="text-slate-600 mt-1">Módulos configurados desde Superadministrador • Control maestro del sistema</p>

          {/* DASHBOARD PRINCIPAL DEL GRUPO: módulos asignados a Administración */}
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[1px] text-slate-500 mb-2">Módulos asignados a este grupo (actualizados en vivo desde Superadministrador)</div>
            {assignedSections.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {assignedSections.map((mod, idx) => (
                  <button
                    key={idx}
                    onClick={() => router.push(mod.module_route)}
                    className="group bg-white border border-slate-200 hover:border-slate-800 rounded-2xl p-4 text-left flex flex-col transition hover:shadow"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center mb-3">
                      <i className={`ph ${mod.module_icon || 'ph-gear'} text-xl text-white`} />
                    </div>
                    <div className="font-semibold text-base tracking-tight text-slate-900 group-hover:text-black">{mod.module_name}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{mod.module_route}</div>
                    <div className="mt-auto pt-2 text-xs text-slate-600 font-medium">Abrir →</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white border p-4 rounded-xl text-sm mb-4 text-slate-500">Sin módulos asignados. Ve a Superadministrador y asigna secciones a "Administración General".</div>
            )}
          </div>

          {/* Accesos rápidos legacy (iconos compactos) */}
          <div className="mt-1 flex flex-wrap gap-2 mb-4">
            {(assignedSections.length ? assignedSections : []).slice(0, 12).map((s, i) => (
              <button key={i} onClick={() => router.push(s.module_route)} className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-[0_6px_0_#00000035] active:translate-y-[2px] active:shadow-md border border-black/10 text-base bg-[#3E2723] text-white" title={s.module_name}>
                <i className={`ph ${s.module_icon || 'ph-gear'} text-xl`} />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Ventas Hoy</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.totalSalesDay || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Ventas Semana</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.totalSalesWeek || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Ventas Mes</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.totalSalesMonth || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Cuentas por Cobrar</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.accountsReceivable || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Cuentas por Pagar</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.accountsPayable || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Saldo Bancario</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.bankBalance || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Préstamos Pendientes</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.pendingLoans || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-2">Anticipos Pendientes</p>
            <p className="text-2xl font-bold text-slate-900">${(dashboardData.pendingAdvances || 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Acciones Rápidas</h2>
            <button onClick={() => router.push('/administracion/tickets-y-documentos')} className="text-sm px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">Abrir Tickets y Documentos →</button>
            <DownloadReportButton moduleName="Administración" title="Resumen Ejecutivo Dashboard" data={[dashboardData]} columns={[{ header: 'Métrica', key: 'metric' }]} format="pdf" includeStats={true} stats={{ 'Ventas Hoy': dashboardData.totalSalesDay }} />
          </div>

          {/* BANCOS - FASE 07 Conciliación Bancaria Inteligente */}
          <div className="mt-4 p-4 bg-white border border-emerald-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-emerald-800">BANCOS → CONCILIACIÓN BANCARIA</div>
                <div className="text-xs text-slate-600">Suba estados de cuenta (PDF/Excel/CSV) • TECAVO IA clasifica contra productores, proveedores, pagos programados y abonos • Integrado con Cierre Semanal • Nunca aplica automáticamente</div>
              </div>
              <button onClick={() => router.push('/administracion/conciliacion-bancaria')} className="px-5 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800">Abrir Conciliación Bancaria →</button>
            </div>
          </div>

          {/* FASE 09 - MOTOR FINANCIERO CENTRALIZADO */}
          <div className="mt-3 p-4 bg-white border border-emerald-900 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-emerald-900">MOTOR FINANCIERO CENTRALIZADO V9</div>
                <div className="text-xs text-slate-600">Única fuente de verdad para COSTO_INTEGRAL_LOTE • INGRESO_NETO • UTILIDAD • MARGEN • Calculadora bidireccional Campo↔Destino • Ajustes con autorización Superadministrador • Sin fórmulas inconsistentes</div>
              </div>
              <button onClick={() => router.push('/motor-financiero')} className="px-5 py-2 bg-emerald-900 text-white rounded-xl text-sm font-medium hover:bg-black">Abrir Motor Financiero →</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button onClick={() => router.push('/admin/authorizations')} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors">Ver Autorizaciones Pendientes</button>
            <button onClick={() => router.push('/admin/audit-log')} className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-medium hover:bg-slate-300 transition-colors">Ver Registro de Auditoría</button>
            <button onClick={() => router.push('/administracion/tickets-y-documentos')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"><span>📄</span> Tickets y Documentos</button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900 to-slate-800 text-white rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div>
              <div className="uppercase tracking-[1px] text-xs opacity-60 mb-1">EXCLUSIVO SUPERADMINISTRADOR</div>
              <div className="font-semibold text-xl">Secciones del Menú</div>
              <div className="text-emerald-200 text-sm">Configura Pestañas, Módulos y Secciones de todo el sistema aquí. Los nombres de las tres pestañas (admindiv, ventas, inventario) se actualizan en vivo y se ven reflejados en la app al instante.</div>
            </div>
            <button onClick={() => router.push('/administracion/secciones')} className="self-start md:self-auto px-6 py-2.5 rounded-lg bg-white text-emerald-900 font-semibold text-sm hover:bg-emerald-100 active:bg-white transition flex items-center gap-2">Abrir Secciones →</button>
          </div>
        </div>



        {/* Color configuration section — visible and functional IN Administracion */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
          <div className="mb-3">
            <div className="font-bold text-lg">Configuración de Colores de Botones y Texto (Global)</div>
            <p className="text-sm text-slate-600">Personaliza globalmente el fondo y texto de todos los botones/tabs de las tres divisiones. Cambios aplican al instante en navegación.</p>
          </div>
          <div className="flex flex-wrap gap-5 items-center mb-3">
            <div>
              <div className="text-xs mb-1 text-slate-600">Fondo botón módulos</div>
              <input type="color" value={moduleColors.btnBg} onChange={(e)=>setModuleColors({...moduleColors, btnBg: e.target.value})} className="w-16 h-9 p-0.5 border rounded" />
              <input type="text" value={moduleColors.btnBg} onChange={(e)=>setModuleColors({...moduleColors, btnBg: e.target.value})} className="ml-2 w-28 border text-sm px-2 py-1 rounded font-mono" />
            </div>
            <div>
              <div className="text-xs mb-1 text-slate-600">Color texto</div>
              <input type="color" value={moduleColors.btnText} onChange={(e)=>setModuleColors({...moduleColors, btnText:e.target.value})} className="w-16 h-9 p-0.5 border rounded" />
              <input type="text" value={moduleColors.btnText} onChange={(e)=>setModuleColors({...moduleColors, btnText: e.target.value})} className="ml-2 w-28 border text-sm px-2 py-1 rounded font-mono" />
            </div>
            <button onClick={saveModuleColors} disabled={colorsSaving} style={{ backgroundColor: '#3E2723', color: '#fff' }} className="mt-3 px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{colorsSaving ? 'Guardando...' : 'Guardar Colores Globales'}</button>
          </div>
          <div className="text-xs text-slate-500">Ejemplo: <span style={{background:moduleColors.btnBg, color:moduleColors.btnText}} className="px-3 py-0.5 rounded inline-block font-medium text-sm">Botón de ejemplo de módulo</span> (aplica a todas las páginas con accesos de navegación).</div>
        </div>

        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl shadow-md p-6 mb-8 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1 flex items-center gap-2"><span>🧮</span> Módulo Contador</h3>
            <p className="text-emerald-100 text-sm">Acceso directo. Para usuarios externos: ingresar con PIN generado al registrar fruta. Interno: control total.</p>
          </div>
          <button onClick={() => router.push('/contador')} className="px-8 py-3 bg-white text-emerald-700 hover:bg-emerald-50 active:bg-white font-semibold rounded-lg text-base transition flex items-center justify-center gap-2 shadow">Abrir Módulo de Contador →</button>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Relación de Frutas Ingresadas</h2>
              <p className="text-sm text-slate-600">Datos del módulo Ingreso de Fruta • Totales por fechas y productores • Estatus documental para pago</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => router.push('/contador')} className="px-4 py-2 text-sm border border-emerald-600 text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 flex items-center gap-1.5">Ir al Contador</button>
              <button onClick={() => router.push('/fruit-input')} className="px-4 py-2 text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium">Nuevo Ingreso Fruta</button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Desde</label>
              <input type="date" value={frStart} onChange={(e)=>setFrStart(e.target.value)} className="border border-slate-300 bg-white rounded px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Hasta</label>
              <input type="date" value={frEnd} onChange={(e)=>setFrEnd(e.target.value)} className="border border-slate-300 bg-white rounded px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Productor</label>
              <select value={frProducer} onChange={(e)=>setFrProducer(e.target.value)} className="border border-slate-300 bg-white rounded px-3 py-2 text-sm w-full">
                <option key="all" value="">Todos los productores</option>
                {fruitProducers.map((p,i)=>(<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
            <div className="flex items-end gap-2 lg:col-span-2">
              <button onClick={applyFruitFilters} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black flex-1 lg:flex-none" disabled={loadingFruit}>{loadingFruit ? "Filtrando..." : "Aplicar filtros"}</button>
              <button onClick={resetFruitFilters} className="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-white">Limpiar</button>
              <button onClick={() => setShowGrouped(!showGrouped)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-white text-slate-700 whitespace-nowrap">{showGrouped ? "Ver lista" : "Agrupar por productor"}</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-emerald-50 rounded-lg p-4"><div className="text-xs uppercase text-emerald-700 font-medium">Lotes Ingresados</div><div className="text-3xl font-bold text-emerald-800 mt-0.5">{fruitSummary.totalLots}</div></div>
            <div className="bg-emerald-50 rounded-lg p-4"><div className="text-xs uppercase text-emerald-700 font-medium">Total Kg</div><div className="text-3xl font-bold text-emerald-800 mt-0.5">{fruitSummary.totalKg.toLocaleString()}</div></div>
                    <div className="bg-emerald-50 rounded-lg p-4"><div className="text-xs uppercase text-emerald-700 font-medium">Monto Estimado</div><div className="text-3xl font-bold text-emerald-800 mt-0.5">{formatCurrency(fruitSummary.totalEst || 0)}</div></div>
            <div className="bg-emerald-50 rounded-lg p-4"><div className="text-xs uppercase text-emerald-700 font-medium">Productores</div><div className="text-3xl font-bold text-emerald-800 mt-0.5">{fruitSummary.producersCount}</div></div>
          </div>

          {loadingFruit ? (
            <div className="py-12 text-center text-slate-500">Cargando relación...</div>
          ) : fruitEntries.length === 0 ? (
            <div className="py-10 bg-slate-50 rounded text-center text-slate-500">No hay lotes en el rango seleccionado. Registre fruta en el módulo Ingreso de Fruta.</div>
          ) : !showGrouped ? (
            <div className="overflow-x-auto rounded border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="px-3 py-2 text-left font-semibold">Fecha</th><th className="px-3 py-2 text-left font-semibold">Folio</th><th className="px-3 py-2 text-left font-semibold">Productor</th><th className="px-3 py-2 text-right font-semibold">Kg</th><th className="px-3 py-2 text-right font-semibold">Estimado</th><th className="px-3 py-2 text-left font-semibold">Estado Documentación</th><th className="px-3 py-2 text-center font-semibold">Acciones</th></tr></thead><tbody className="divide-y">{fruitEntries.map((entry) => (<tr key={entry.id} className="hover:bg-slate-50"><td className="px-3 py-2 font-medium text-slate-700">{String(entry.date||'').slice(0,10)}</td><td className="px-3 py-2 text-slate-800 font-mono text-[13px]">{entry.lot_number}</td><td className="px-3 py-2">{entry.producer}</td><td className="px-3 py-2 text-right tabular-nums">{Number(entry.kg||0).toLocaleString()}</td><td className="px-3 py-2 text-right tabular-nums">{formatCurrency(entry.estAmount||0)}</td><td className="px-3 py-2"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.docStatus==="completa"?"bg-emerald-100 text-emerald-800":entry.docStatus==="parcial"?"bg-amber-100 text-amber-800":"bg-red-100 text-red-700"}`}>{entry.docLabel}</span></td><td className="px-3 py-2"><div className="flex gap-1.5 justify-center"><button onClick={() => router.push('/contador')} className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">Contador</button><button onClick={() => router.push(`/batch-tracking?lotId=${entry.id}`)} className="text-xs px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-100">Detalles</button></div></td></tr>))}</tbody></table></div>
          ) : (
            <div className="space-y-6">{producersInList.map((producerName, idx) => {const items = groupedEntries[producerName];const totKg = items.reduce((s,i)=>s+(i.kg||0),0);const totEst=items.reduce((s,i)=>s+(i.estAmount||0),0);const completos=items.filter(i=>i.docStatus==="completa").length;return (<div key={producerName} className="border border-slate-200 rounded-xl overflow-hidden"><div className="bg-slate-100 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"><span className="text-lg font-semibold text-slate-800">{producerName}</span><span className="text-xs px-2.5 py-0.5 bg-white border rounded-full">{items.length} lotes</span><span className="text-xs text-slate-600">• {totKg.toLocaleString()} kg</span><span className="text-xs text-slate-600">• Est. ${totEst.toLocaleString()}</span><span className="text-xs ml-auto bg-emerald-700 text-white px-2 py-0.5 rounded">Completos: {completos}/{items.length}</span></div><div className="divide-y text-sm">{items.map((entry)=>(<div key={entry.id} className="px-4 py-3 flex flex-wrap md:items-center gap-x-5 gap-y-1 bg-white hover:bg-slate-50"><div className="w-24 text-slate-500 font-mono">{String(entry.date||'').slice(0,10)}</div><div className="font-medium w-28 text-slate-800">{entry.lot_number}</div><div className="tabular-nums text-slate-700">{entry.kg} kg</div><div className="tabular-nums flex-1 min-w-[80px]">Est. {formatCurrency(entry.estAmount)}</div><div><span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${entry.docStatus==="completa"?"bg-emerald-100 text-emerald-800":entry.docStatus==="parcial"?"bg-amber-100 text-amber-800":"bg-red-100 text-red-700"}`}>{entry.docLabel}</span></div><div className="ml-auto flex gap-1.5"><button onClick={() => router.push('/contador')} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded">Contador</button><button onClick={() => router.push(`/batch-tracking?lotId=${entry.id}`)} className="text-xs px-3 py-1 border rounded">Ver traza</button></div></div>))}</div></div>);})}</div>
          )}
          <div className="mt-3 text-[11px] text-slate-500">La documentación necesaria incluye: comprobante de pago al productor, factura/folio y documentos subidos desde Contador. Actualiza en Módulo Ingreso y Contador.</div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <div><h2 className="text-lg font-bold text-slate-900">Widgets del Dashboard Principal</h2><p className="text-sm text-slate-600">Elige, agrega, quita y modifica los widgets que aparecen en el dashboard principal.</p></div>
            <button onClick={saveWidgetsConfig} disabled={widgetsSaving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg">{widgetsSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
          <div className="space-y-2 mb-4">{widgets.map((w, idx) => (<div key={w.key} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-slate-50"><input type="checkbox" checked={w.enabled} onChange={() => toggleWidgetEnabled(idx)} className="w-4 h-4 accent-emerald-600" /><input type="text" value={w.label} onChange={(e) => updateWidgetLabel(idx, e.target.value)} className="flex-1 bg-white border px-3 py-1.5 rounded text-sm font-medium" /><div className="flex gap-1"><button onClick={() => moveWidget(idx, -1)} className="px-2 py-1 border rounded text-sm hover:bg-white" disabled={idx===0}>↑</button><button onClick={() => moveWidget(idx, 1)} className="px-2 py-1 border rounded text-sm hover:bg-white" disabled={idx===widgets.length-1}>↓</button><button onClick={() => removeWidget(idx)} className="px-2 py-1 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50">Quitar</button></div></div>))}</div>
          <div className="flex gap-2"><input type="text" placeholder="Nombre del nuevo widget" value={newWidgetLabel} onChange={(e)=>setNewWidgetLabel(e.target.value)} className="flex-1 border px-3 py-2 rounded-lg text-sm" /><button onClick={addNewWidget} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-black">Agregar Widget</button></div>
          <div className="text-[11px] text-slate-500 mt-2">Los cambios se guardan en la configuración del dashboard y se reflejan al recargar el panel principal.</div>
        </div>

        <WeeklySummaryReport />
      </div>
    </div>
  );
}
