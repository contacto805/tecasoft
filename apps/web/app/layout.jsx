'use client';

import "./globals.css";
import "@/utils/route-change-detector";
import { AppGenProvider } from "@/components/appgen-provider";
import MaterialAlertsPanel from "@/components/MaterialAlertsPanel";
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

  const getGroupDashboard = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('groupDashboard');
      if (stored) return stored;
    }
    const p = (pathname || '').toLowerCase();
    if (p.includes('/acopios') || p.includes('corte') || p.includes('orchard') || p.includes('huerta') || p.includes('visita')) return '/acopios';
    if (p.includes('/embarques') || p.includes('produccion') || p.includes('lote') || p.includes('combustible') || p.includes('cuadrilla') || p.includes('box')) return '/embarques';
    if (p.includes('/administracion') || p.includes('nomina') || p.includes('cartera') || p.includes('gasto') || p.includes('cierre') || p.includes('expense')) return '/administracion';
    if (p.includes('superadministrador')) return '/superadministrador';
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
        const txt = await response.text();
        const data = txt ? JSON.parse(txt) : {};
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

  // Live Mexico City official reference clock — authoritative source for all system timestamps/records
  useEffect(() => {
    let baseData = null;
    const syncFromServer = async () => {
      try {
        const res = await fetch('/api/server-time');
        if (res.ok) {
          const txt = await res.text();
          baseData = txt ? JSON.parse(txt) : null;
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

  // Redirect disabled to ensure the app always loads visible for all users/sessions.

  return (
    <>
      {isAuthenticated && (
        <div className="fixed bottom-3 right-3 z-[120] flex items-center shadow-xl border rounded-2xl overflow-hidden text-xs" style={{ backgroundColor: 'var(--mod-tab-bg, #3E2723)', color: 'var(--mod-tab-text, #ffffff)', borderColor: '#5C4035' }}>
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
            title="Ir a Home"
            style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <i className="ph ph-house text-base"></i>
            <span className="font-medium" style={{ color: 'inherit' }}>Home</span>
          </button>
          <button 
            onClick={() => router.push(getGroupDashboard())} 
            className="px-3 py-2 hover:opacity-80 flex items-center gap-1 border-l" 
            title="Ir al Dashboard del Grupo"
            style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}
          >
            <i className="ph ph-layout text-base"></i>
            <span className="font-medium" style={{ color: 'inherit' }}>Dashboard Grupo</span>
          </button>
          <a href="/portal-productores" className="px-3 py-2 hover:opacity-80 flex items-center gap-1 border-l text-[10px]" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}>Portal Productor</a>
        </div>
      )}
      {isAuthenticated && mxDisplay && (
        <div className="fixed top-3 left-3 z-[160] px-3 py-1 bg-white/95 border border-emerald-800 text-emerald-900 rounded-full shadow text-[10px] font-semibold flex items-center gap-1.5" title="Hora, fecha y semana oficial Ciudad de México. Referencia autorizada para todos los registros del sistema.">
          <i className="ph ph-globe text-sm"></i>
          <span>{mxDisplay}</span>
        </div>
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
        <script src="https://unpkg.com/@phosphor-icons/web"></script>
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
        <AppGenProvider>
          <div className="flex-1 relative z-0">
            <LayoutContent>{children}</LayoutContent>
          </div>
        </AppGenProvider>
      </body>
    </html>
  );
}
