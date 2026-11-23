/*
**Objetivo de la reestructuración de TECAVO SOFT**

Revisar los módulos existentes y **eliminar o fusionar los que repitan capturas, información o funciones**, para que el sistema siga el flujo real de la empacadora y reduzca el trabajo operativo.

**Los puntos siguientes describen funciones y etapas del proceso; no significa que deba crearse un módulo independiente para cada punto.** Deben integrarse dentro de las áreas correspondientes.

**1. Una sola captura por operación**

Cada dato debe registrarse una sola vez, en el área donde se origina. Los demás procesos deben recuperarlo automáticamente mediante su relación con la operación.

Por ejemplo, productor, huerta y condiciones acordadas se registran desde campo; la orden de corte los hereda; recepción agrega los pesos reales; producción registra el resultado; Administración utiliza esa misma información para costos y pagos.

**2. Fusionar funciones repetidas**

Identificar pantallas, formularios, catálogos y registros que representen la misma operación. Consolidarlos en un único registro con las vistas necesarias para cada área.

En particular:

- **Producción, selección, lotificación y rendimiento:** deben formar un mismo proceso integrado, con captura del resultado y cálculo automático del rendimiento.
- **Inventario de producto terminado y cuarto frío:** deben compartir las mismas existencias; el mapa de frío muestra su ubicación.
- **Compras de fruta y cuenta del productor:** deben alimentarse del ingreso y las condiciones autorizadas.
- **Embarques, notas de venta y cuentas por cobrar:** deben permanecer enlazados, reutilizando los datos de la carga.
- **Pagos y gastos:** deben reflejar sus operaciones de origen, evitando registrarlos nuevamente en Administración.

**3. Organizar el sistema en áreas claras**

| Área principal | Funciones integradas |
|---|---|
| **Acopios** | Productores, huertas, visitas a campo, porcentajes estimados, negociación, acuerdos y programación de corte. |
| **Operaciones** | Órdenes de corte, cuadrillas, cajas, transporte, ingreso y pesaje, lotes, producción y rendimiento. |
| **Inventarios y embarques** | Fruta disponible, materiales, cajas empacadas, tarimas, ubicación en frío, cargas y salidas. |
| **Administración** | Compras y obligaciones generadas, proveedores, clientes, gastos, nómina, pagos, cobranza, bancos, costos y cierre semanal. |

Los catálogos, documentos, reportes y tableros deben ser compartidos o accesibles desde la operación correspondiente, sin exigir una captura adicional.

**4. Automatizar el avance del flujo**

- Al confirmar el acuerdo y programar el corte, generar la orden con folio automático.
- Al confirmar la recepción, generar el ingreso y el lote automáticamente.
- Al registrar producción, actualizar rendimiento, existencias y consumo de materiales.
- Al confirmar el embarque, actualizar inventario y generar la información de venta correspondiente.
- Al registrar pagos o cobros, actualizar los saldos relacionados.
- El cierre semanal debe reunir y conciliar estos movimientos automáticamente.

Cada etapa agrega únicamente la información nueva que le corresponde.

**5. Administración recibe información de toda la operación**

Administración debe revisar, complementar documentos, autorizar, pagar, cobrar y conciliar sobre los registros ya existentes. No debe volver a capturar cortes, kilos, lotes, producción, cargas o compras registradas por otras áreas.

**6. Simplificar sin perder información**

Antes de retirar un módulo repetido, trasladar sus datos y relaciones al registro definitivo. Conservar folios, documentos, historial, permisos y trazabilidad. Actualizar las pantallas que dependan de él para que utilicen la información consolidada.

**Criterio de aceptación:** una operación debe poder avanzar de campo a Administración sin volver a escribir información previamente registrada. Cada módulo debe aportar una función concreta; si únicamente repite datos o captura, debe fusionarse con el proceso correspondiente.
*/

/* DIRECTIVA PERSISTENTE PARA APPGEN — Usar siempre esta guía al revisar o modificar el sistema. */

'use client';
// polished startup flow for clean preview loads

import "./globals.css";
import dynamic from "next/dynamic";
const AppGenProvider = dynamic(() => import("@/components/appgen-provider").then(module => module.AppGenProvider));
import MaterialAlertsPanel from "@/components/MaterialAlertsPanel";
import Script from "next/script";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useBranding } from "@/hooks/useBranding";

function LayoutContent({ children }) {
  const { settings } = useSettings();
  const { branding } = useBranding();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mxDisplay, setMxDisplay] = useState('');
  // TECAVO IA floating assistant (global single instance, real backend, context aware)
  const [iaOpen, setIaOpen] = useState(false);
  const [iaMinimized, setIaMinimized] = useState(false);
  const [iaMessages, setIaMessages] = useState([]);
  const [iaInput, setIaInput] = useState('');
  const [iaLoading, setIaLoading] = useState(false);

  // Friendly group navigation — modules exactly as configured in Administración / Super
  const [currentGroupModules, setCurrentGroupModules] = useState([]);
  const [currentGroupLabel, setCurrentGroupLabel] = useState('');

  const getGroupDashboard = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('groupDashboard');
      if (stored) return stored;
    }
    const p = (pathname || '').toLowerCase();
    if (p.includes('/acopios') || p.includes('corte') || p.includes('orchard') || p.includes('huerta') || p.includes('visita')) return '/acopios';
    if (p.includes('/embarques') || p.includes('produccion') || p.includes('lote') || p.includes('combustible') || p.includes('cuadrilla') || p.includes('box')) return '/embarques';
    if (p.includes('/administracion') || p.includes('nomina') || p.includes('cartera') || p.includes('gasto') || p.includes('cierre') || p.includes('expense')) return '/administracion';
    if (p.includes('superadministrador') || p.includes('administracion')) return p.includes('super') ? '/superadministrador' : '/administracion';
    return '/acopios';
  };

  // Load color scheme on client side + live refresh on focus so Superadmin color/branding changes apply immediately
  const loadColorScheme = async () => {
    try {
      const response = await fetch('/api/color-schemes');
      if (response.ok) {
        const schemesRaw = await response.json().catch(() => []);
        const schemesArr = Array.isArray(schemesRaw) ? schemesRaw : [];
        const primaryScheme = schemesArr.find(s => s.module_name === 'dashboard') || schemesArr[0];
        if (primaryScheme) {
          document.documentElement.style.setProperty('--brand-primary', primaryScheme.primary_color || '#024D32');
          document.documentElement.style.setProperty('--brand-secondary', primaryScheme.secondary_color || '#9E4633');
          document.documentElement.style.setProperty('--brand-accent', primaryScheme.accent_color || '#E8D547');
          document.documentElement.style.setProperty('--brand-text', primaryScheme.text_color || '#0A3020');
          document.documentElement.style.setProperty('--brand-border', primaryScheme.border_color || '#E8D547');
        }
        const modScheme = schemesArr.find(s => s.module_name === 'module-tabs') || {};
        document.documentElement.style.setProperty('--mod-tab-bg', modScheme.primary_color || (primaryScheme?.primary_color || '#3E2723'));
        document.documentElement.style.setProperty('--mod-tab-text', modScheme.text_color || '#ffffff');
      }
    } catch (e) {
      if (e?.message && e?.message !== 'Failed to fetch') {
        console.error('Color scheme load:', e?.message || 'skipped');
      }
    }
  };

  useEffect(() => {
    loadColorScheme();
    const onFocus = () => loadColorScheme();
    const onVis = () => { if (!document.hidden) loadColorScheme(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(loadColorScheme, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Check if user has session cookie
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        setIsAuthenticated(!!data?.authenticated);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (err?.message !== 'Failed to fetch') {
          console.error('Auth check issue:', err?.message || 'Check failed');
        }
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    return () => controller.abort();
  }, []);

  // Load modules for current group (from admin configuration) — friendly horizontal nav
  useEffect(() => {
    if (!isAuthenticated) { setCurrentGroupModules([]); setCurrentGroupLabel(''); return; }
    const loadGroupNav = async () => {
      try {
        let cred = 'operaciones';
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('groupDashboard') || '';
          const p = (pathname || '').toLowerCase();
          if (stored.includes('acop') || p.includes('acop') || p.includes('campo')) cred = 'campo';
          else if (stored.includes('admin') || p.includes('admin')) cred = 'administrador';
          else if (stored.includes('embar') || p.includes('embar') || p.includes('produccion')) cred = 'operaciones';
        }
        const res = await fetch(`/api/menu?credential=${cred}`, { credentials: 'include' });
        const groups = res.ok ? await res.json().catch(()=>[]) : [];
        const flat = (groups || []).flatMap(g => (g.modules || []).filter(m => m && m.is_active !== false).map(m => ({...m, _group: g.group_name})));
        setCurrentGroupModules(flat.slice(0, 12)); // limit for clean UI
        // pick a nice label
        const first = flat[0];
        setCurrentGroupLabel(first?._group || (cred === 'campo' ? 'ACOPIOS' : cred === 'administrador' ? 'ADMINISTRACIÓN' : 'OPERACIONES'));
      } catch (_) { setCurrentGroupModules([]); }
    };
    loadGroupNav();
    const onF = () => loadGroupNav();
    window.addEventListener('focus', onF);
    return () => window.removeEventListener('focus', onF);
  }, [isAuthenticated, pathname]);

  // Live Mexico City official reference clock — authoritative source for all system timestamps/records
  useEffect(() => {
    let baseData = null;
    const syncFromServer = async () => {
      try {
        const res = await fetch('/api/server-time');
        if (res.ok) {
          baseData = await res.json().catch(() => null);
        }
      } catch (_) {}
    };
    const computeDisplay = () => {
      if (!baseData || !baseData.date) return 'Ciudad de México • sincronizando...';
      try {
        const d = new Date(baseData.timestamp || Date.now());
        const fmt = new Intl.DateTimeFormat('es-MX', {
          timeZone: 'America/Mexico_City',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(d);
        const wk = baseData.week || 1;
        return `Ciudad de México • ${fmt.replace(',', '')} • Semana ${wk}`;
      } catch {
        const wk = baseData.week || 1;
        return `${baseData.label || 'Ciudad de México'} • ${baseData.date} ${baseData.time} • Semana ${wk}`;
      }
    };
    syncFromServer();
    const id = setInterval(syncFromServer, 45000);
    const t = setInterval(() => setMxDisplay(computeDisplay()), 1000);
    setMxDisplay(computeDisplay());
    return () => { clearInterval(id); clearInterval(t); };
  }, []);

  // TECAVO IA - real chat using existing backend (no duplicate integration)
  const sendIaMessage = async () => {
    const q = iaInput.trim();
    if (!q) return;
    setIaLoading(true);
    const newMsgs = [...iaMessages, { role: 'user', content: q }];
    setIaMessages(newMsgs);
    setIaInput('');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message: `Estoy en la pantalla: ${pathname}. ${q}`, 
          history: newMsgs.slice(-6) 
        })
      });
      const data = await res.json();
      setIaMessages([...newMsgs, { role: 'assistant', content: data.reply || 'Respuesta no disponible.' }]);
    } catch {
      setIaMessages([...newMsgs, { role: 'assistant', content: 'Error al consultar TECAVO IA.' }]);
    }
    setIaLoading(false);
  };

  // Redirect disabled to ensure the app always loads visible for all users/sessions.

  return (
    <>
      {isAuthenticated && (
        <div className="fixed bottom-3 right-3 z-[250] flex items-center shadow-xl border rounded-2xl overflow-hidden text-xs" style={{ backgroundColor: 'var(--mod-tab-bg, #3E2723)', color: 'var(--mod-tab-text, #ffffff)', borderColor: '#5C4035' }}>
          <button 
            onClick={() => router.back()} 
            className="px-2.5 py-2 hover:opacity-80 transition flex items-center" 
            title="Ir hacia atrás"
            style={{ color: 'inherit' }}
          >
            <i className="ph ph-arrow-left text-lg"></i>
          </button>
          <button 
            onClick={() => window.history.forward()} 
            className="px-2.5 py-2 hover:opacity-80 transition flex items-center" 
            title="Ir hacia adelante"
            style={{ color: 'inherit' }}
          >
            <i className="ph ph-arrow-right text-lg"></i>
          </button>
          <button 
            onClick={() => router.push('/')} 
            className="px-3 py-2 hover:opacity-80 flex items-center gap-1 border-l" 
            title="Ir a Inicio (acceso a grupos)"
            style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <i className="ph ph-house text-base"></i>
            <span className="font-medium" style={{ color: 'inherit' }}>Inicio</span>
          </button>
          <button 
            onClick={() => router.push(getGroupDashboard())} 
            className="px-3 py-2 hover:opacity-80 flex items-center gap-1 border-l" 
            title="Ir al panel principal de tu grupo"
            style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <i className="ph ph-layout text-base"></i>
            <span className="font-medium" style={{ color: 'inherit' }}>Mi Grupo</span>
          </button>
          <a href="/portal-productores" className="px-3 py-2 hover:opacity-80 flex items-center gap-1 border-l text-[10px]" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}>Portal</a>
        </div>
      )}
      {isAuthenticated && mxDisplay && (
        <div className="fixed top-3 left-3 z-[160] px-3 py-1 bg-white/95 border border-emerald-800 text-emerald-900 rounded-full shadow text-[10px] font-semibold flex items-center gap-1.5" title="Hora, fecha y semana oficial Ciudad de México. Referencia autorizada para todos los registros del sistema.">
          <i className="ph ph-globe text-sm"></i>
          <span>{mxDisplay}</span>
        </div>
      )}

      {/* Navegación amigable e intuitiva DENTRO del grupo — solo módulos configurados en Administración */}
      {isAuthenticated && currentGroupModules.length > 0 && (
        <div className="fixed top-9 left-1/2 -translate-x-1/2 z-[140] max-w-[92%] px-3 py-1 bg-white/95 border border-emerald-200 shadow-sm rounded-2xl text-[11px] flex items-center gap-2 overflow-hidden">
          <span className="font-semibold text-emerald-800 pr-1 whitespace-nowrap">{currentGroupLabel || 'GRUPO'}</span>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {currentGroupModules.map((mod, i) => (
              <button
                key={i}
                onClick={() => router.push(mod.module_route || '/')}
                className="px-2.5 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 whitespace-nowrap flex items-center gap-1"
                title={mod.module_name}
              >
                <i className={`ph ${mod.module_icon || 'ph-cube'} text-[12px]`}></i>
                <span className="text-[10px] font-medium">{(mod.display_name || mod.module_name || '').slice(0, 18)}</span>
              </button>
            ))}
          </div>
          <span className="text-[9px] text-emerald-600 pl-1">• Configurado en Admin</span>
        </div>
      )}

      {/* TECAVO IA - Asistente flotante global (logo original estilo, una sola instancia, respeta permisos) */}
      {isAuthenticated && (
        <>
          <button
            onClick={() => { setIaOpen(!iaOpen); setIaMinimized(false); }}
            className="fixed bottom-20 right-4 z-[140] w-12 h-12 rounded-full bg-emerald-900 text-white shadow-xl flex items-center justify-center border-2 border-emerald-600 hover:bg-emerald-800 transition-all"
            title="TECAVO IA - Asistente Virtual"
          >
            <img src="https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1781494570784_ici2sv.png" alt="TECAVO IA" className="w-8 h-8 object-contain" />
          </button>

          {iaOpen && (
            <div className="fixed bottom-20 right-4 z-[145] w-80 bg-white border border-emerald-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: iaMinimized ? '42px' : '420px' }}>
              <div className="bg-emerald-900 text-white px-3 py-1.5 text-xs font-semibold flex items-center justify-between">
                <span>TECAVO IA — Asistente de Tecavo Fruits</span>
                <div className="flex gap-1">
                  <button onClick={() => setIaMinimized(!iaMinimized)} className="px-1.5 hover:bg-white/20 rounded">_</button>
                  <button onClick={() => { setIaOpen(false); setIaMinimized(false); }} className="px-1.5 hover:bg-white/20 rounded">×</button>
                </div>
              </div>
              {!iaMinimized && (
                <>
                  <div className="flex-1 p-3 overflow-auto text-sm bg-slate-50 min-h-[180px] space-y-2" style={{ maxHeight: '280px' }}>
                    {iaMessages.length === 0 && (
                      <div className="text-[10px] text-slate-500">Pregunta sobre datos reales del ERP (ingresos, lotes, cajas, pagos, etc). Ej: ¿Cuántos kilos ingresaron hoy? ¿Qué órdenes faltan por recibir?</div>
                    )}
                    {iaMessages.map((m, i) => (
                      <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                        <span className={`inline-block px-2 py-1 rounded-xl text-xs ${m.role === 'user' ? 'bg-emerald-800 text-white' : 'bg-white border'}`}>
                          {m.content}
                        </span>
                      </div>
                    ))}
                    {iaLoading && <div className="text-xs text-emerald-600">Consultando fuentes reales...</div>}
                  </div>
                  <div className="p-2 border-t flex gap-1">
                    <input 
                      value={iaInput} 
                      onChange={e => setIaInput(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') sendIaMessage(); }}
                      placeholder="Pregunta a TECAVO IA..."
                      className="flex-1 text-xs border rounded px-2 py-1" 
                    />
                    <button onClick={sendIaMessage} disabled={iaLoading || !iaInput.trim()} className="text-xs px-3 bg-emerald-800 text-white rounded">Enviar</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {children}
      {isAuthenticated && <MaterialAlertsPanel />}
      {isAuthenticated && (
        <footer className="bg-slate-900 text-slate-200 py-8 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <img src="https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1781494570784_ici2sv.png" alt="Tecavo Fruits" className="h-10 object-contain" />
                </div>
                <p className="text-sm text-slate-400">{settings?.footer_text || 'Tecavo Fruits S de RL de CV - Todos los derechos reservados'}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-white mb-4">Contacto</h4>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <i className="ph ph-phone text-brand-400"></i>
                    {settings?.company_phone || '+52 459 134 4576'}
                  </p>
                  <p className="flex items-center gap-2">
                    <i className="ph ph-envelope text-brand-400"></i>
                    {settings?.company_email || 'contacto@tecavofruits.com'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-4">Sistema</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-400">Versión 1.0.0</p>
                  <p className="text-slate-400">© 2024 {settings?.company_name || 'Tecavo Fruits S de RL de CV'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
              <p>{settings?.footer_text || 'Tecavo Fruits S de RL de CV - Todos los derechos reservados'}</p>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}

function DashboardShell({ children }) {
  const pathname = usePathname() || "";
  if (pathname === "/portal-productores" || /^\/(lot|trazabilidad)\/[^/]+$/.test(pathname)) {
    return children;
  }
  return (
    <AppGenProvider>
      <Script src="https://unpkg.com/@phosphor-icons/web" />
      <LayoutContent>{children}</LayoutContent>
    </AppGenProvider>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Tecavo Fruits Soft</title>
        <meta name="description" content="Sistema de gestión de aguacate - ERP listo para celulares" />
        <meta name="theme-color" content="#166534" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Poppins:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&display=swap" />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        {/* Fondo de toda la aplicación: patrón TECAVO (global para toda la app) */}
        <div
          className="fixed inset-0 z-[-20] pointer-events-none"
          style={{
            backgroundImage: `url('https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1782756166049_o1hv7.png')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '180px',
            opacity: 0.15,
            backgroundPosition: '0 0',
            backgroundColor: '#f8fafc'
          }}
        />
        <div className="flex-1 relative z-0">
          <DashboardShell>{children}</DashboardShell>
        </div>
      </body>
    </html>
  );
}
