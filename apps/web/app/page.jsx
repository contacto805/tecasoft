'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';

export default function LandingPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuGroups, setMenuGroups] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSuper, setIsSuper] = useState(false);

  // Main selector: Campo / Operaciones / Administrador groups. Superadministrador uses separate full free nav.
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [credEmail, setCredEmail] = useState('');
  const [credPin, setCredPin] = useState('');
  const [credError, setCredError] = useState('');
  const [credLoading, setCredLoading] = useState(false);

  const [weeklyPrices, setWeeklyPrices] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [clientesHome, setClientesHome] = useState([]);
  const [pedidosHome, setPedidosHome] = useState([]);

  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include' })
      .then(r => r.json().catch(() => ({})))
      .then(d => setIsAuthenticated(!!d.authenticated))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const refreshMenu = async () => {
    try {
      const userRes = await fetch('/api/auth/user', { credentials: 'include' });
      const user = userRes.ok ? await userRes.json().catch(() => null) : null;
      const supRes = await fetch('/api/auth/check-super-admin', { credentials: 'include' });
      const sup = supRes.ok ? await supRes.json().catch(() => ({isSuperAdmin: false})) : {isSuperAdmin: false};
      const sIsSuper = !!(sup?.isSuperAdmin || user?.is_super_admin);
      setCurrentUser(user);
      setIsSuper(sIsSuper);

      const uName = (user?.name || user?.email || '').toLowerCase();
      const cred = sIsSuper ? null : (uName.includes('oper') ? 'operaciones' : (uName.includes('acop') || uName.includes('campo') ? 'accopio' : 'administracion_general'));
      const menuUrl = (cred && !sIsSuper) ? `/api/menu?credential=${cred}` : '/api/menu';
      const mRes = await fetch(menuUrl, { credentials: 'include' });
      const menu = mRes.ok ? await mRes.json().catch(() => []) : [];
      setMenuGroups(Array.isArray(menu) ? menu : []);
    } catch {
      // keep previous
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshMenu();

    // real-time prices etc only once on auth
    (async () => {
      try {
        const pRes = await fetch('/api/precios-fruta/publicados');
        const p = pRes.ok ? await pRes.json().catch(() => null) : null;
        setWeeklyPrices(Array.isArray(p) ? (p[0] || null) : p);

        const oRes = await fetch('/api/load-history');
        const ord = oRes.ok ? await oRes.json().catch(() => []) : [];
        setRecentOrders(Array.isArray(ord) ? ord.slice(0, 4) : []);

        const cRes = await fetch('/api/customers');
        const cs = cRes.ok ? await cRes.json().catch(()=>[]) : [];
        setClientesHome(Array.isArray(cs) ? cs : []);

        const pdRes = await fetch('/api/pedidos');
        const pd = pdRes.ok ? await pdRes.json().catch(()=>[]) : [];
        setPedidosHome(Array.isArray(pd) ? pd : []);
      } catch {}
    })();

    // Live refresh of menu/groups when Superadministrador toggles modules or access (for Operaciones, Campo, Admin selectors)
    const onFocus = () => refreshMenu();
    const onVis = () => { if (!document.hidden) refreshMenu(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(refreshMenu, 26000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, [isAuthenticated]);

  const logoUrl = branding?.logo_url || branding?.logo || 'https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1781494570784_ici2sv.png';

  const goToLogin = () => router.push('/login');

  const userName = (currentUser?.name || currentUser?.email || '').toLowerCase();
  const targetCredential = isSuper ? null : (userName.includes('oper') ? 'operaciones' : (userName.includes('acop') ? 'accopio' : 'administracion_general'));

  const getManifiesto = (order) => {
    if (!order) return '';
    const match = (clientesHome || []).find(cc => (cc.customer_name || '').toLowerCase().trim() === (order.customer_name || '').toLowerCase().trim());
    if (match) {
      const code = match.manifest_code || '';
      const req = match.manifest_requirements != null ? String(match.manifest_requirements) : '';
      return [code, req].filter(Boolean).join(' — ');
    }
    return '';
  };

  const shownModules = (menuGroups || [])
    .flatMap(g => (g.modules || []).filter(m => m && m.is_active !== false).map(m => ({
      ...m,
      _group: g.group_name
    })));

  const moduleAccessOptions = [
    { key: 'campo', label: 'ACOPIOS', desc: 'Fruta, productores, huertas, precios, cortes, cuadrillas, fletes e ingreso', icon: '🌱' },
    { key: 'operaciones', label: 'OPERACIONES', desc: 'Producción, lotes, tarimas, cámaras frías, inventarios, cargas y trazabilidad', icon: '📦' },
    { key: 'administrador', label: 'ADMINISTRACIÓN', desc: 'Productores por pagar, documentación, clientes, ventas, gastos, nómina, costos, cierres y reportes', icon: '📋' }
  ];

  const dashboardRoutes = {
    campo: '/acopios',
    operaciones: '/embarques',
    administrador: '/administracion',
    superadministrador: '/superadministrador'
  };

  const credentialByGroup = {
    campo: 'campo',
    operaciones: 'operaciones',
    administrador: 'administrador',
    superadministrador: 'superadministrador'
  };

  const openCredentialPrompt = (access) => {
    setSelectedCredential(access);
    setCredEmail((currentUser?.email || '').toLowerCase());
    setCredPin('');
    setCredError('');
    setShowCredentialModal(true);
  };

  const handleCredentialLogin = async () => {
    if (!credEmail.trim() || credPin.length !== 4) {
      setCredError('Ingresa tu correo y el PIN de 4 dígitos asignado');
      return;
    }
    setCredLoading(true);
    setCredError('');
    try {
      const res = await fetch('/api/auth/login-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credEmail.trim().toLowerCase(), pin: credPin }),
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const k = selectedCredential.key;
        const loggedUser = data.user || {};
        const loggedIsSuper = !!(loggedUser.is_super_admin || loggedUser.admin_role === 'superadministrador');

        if (k === 'superadministrador' && !loggedIsSuper) {
          setCredError('Estas credenciales no tienen acceso de Superadministrador');
          return;
        }

        const credential = credentialByGroup[k] || k;
        const mRes = await fetch(`/api/menu?credential=${credential}`, { credentials: 'include' });
        const groups = mRes.ok ? await mRes.json().catch(() => []) : [];
        const mods = Array.isArray(groups) ? groups.flatMap(g => (g.modules || []).filter(mm => mm.is_active !== false)) : [];

        if (k !== 'superadministrador' && mods.length === 0) {
          setCredError('Este usuario no tiene módulos asignados para esta área');
          return;
        }

        const target = dashboardRoutes[k] || mods[0]?.module_route || '/';
        if (typeof window !== 'undefined') localStorage.setItem('groupDashboard', target);
        setShowCredentialModal(false);
        setIsAuthenticated(true);
        setCurrentUser(loggedUser);
        setIsSuper(loggedIsSuper);
        router.push(target);
      } else {
        setCredError(data.error || 'Credenciales no válidas. Verifica email y PIN asignados');
      }
    } catch (e) {
      setCredError('No se pudo verificar las credenciales');
    } finally {
      setCredLoading(false);
    }
  };

  // PRINCIPAL SCREEN: Always show the group selector (the screenshot is the main screen).
  // Clicking any group (Campo / Operaciones / Administrador / Superadministrador) opens the shared credential modal.
  // Superadministrador gets full unrestricted navigation after login.
  return (
    <div className="min-h-screen bg-white pt-10">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <img 
            src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785010951159_ri7p2.png" 
            alt="Tecavo Fruits" 
            className="mx-auto h-10 sm:h-12 md:h-14 object-contain mb-2" 
          />
          <div className="text-emerald-700 text-sm font-semibold tracking-[2px] mb-1">TECAVO FRUITS</div>
          <h1 className="text-4xl font-semibold tracking-tighter">Acceso a Módulos</h1>
          <p className="text-slate-500 mt-2">Elige tu área. Ingresa las credenciales que se te asignaron en Superadministrador</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {moduleAccessOptions.map((m) => (
            <button
              key={m.key}
              onClick={() => openCredentialPrompt(m)}
              className="group bg-white rounded-3xl p-7 border border-slate-100 hover:border-emerald-700 hover:shadow-xl transition text-left flex flex-col h-[210px]"
            >
              <div className="text-5xl mb-4">{m.icon}</div>
              <div className="font-semibold text-2xl tracking-tight text-slate-900 group-hover:text-emerald-700">{m.label}</div>
              <div className="mt-auto text-sm text-slate-500">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Central: Del Campo con Amor + SUPERADMINISTRADOR (full access freely) */}
        <div className="mt-8 text-center">
          <img 
            src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785362498521_qyfd2.jpeg" 
            alt="Del Campo con Amor" 
            className="mx-auto h-16 sm:h-20 object-contain mb-1" 
          />
          <div className="text-emerald-800 font-medium tracking-[1.5px] text-sm mb-2">Del Campo con Amor</div>

          <button
            onClick={() => openCredentialPrompt({ key: 'superadministrador', label: 'Superadministrador', desc: 'Navegación completa y libre en todo el sistema' })}
            className="px-6 py-1.5 text-xs font-semibold tracking-[2px] text-white bg-emerald-800 hover:bg-emerald-900 rounded-full transition shadow"
          >
            SUPERADMINISTRADOR
          </button>
          <p className="text-[10px] text-slate-500 mt-2 tracking-wide">Acceso total al sistema • navega libremente por todo</p>
          <a href="/portal-productores" className="inline-block mt-2 text-xs text-emerald-700 underline">Acceso para productores (folio de orden)</a>
          <a href="/portal-cliente" className="inline-block mt-1 text-xs text-emerald-700 underline">Portal de Clientes (Número + PIN)</a>
        </div>

        {isAuthenticated && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => { if (typeof window !== 'undefined') localStorage.removeItem('groupDashboard'); setIsAuthenticated(false); setCurrentUser(null); setMenuGroups([]); router.push('/'); }}
              className="text-xs px-4 py-1.5 border rounded-full text-slate-600 hover:bg-slate-50"
            >
              CAMBIAR DE ÁREA
            </button>
            <div className="text-[10px] text-slate-400 mt-1">Acceso a otro grupo autorizado</div>
          </div>
        )}
      </div>

      {/* Shared credential modal for all groups (login triggered on press) */}
      {showCredentialModal && selectedCredential && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <div className="mb-5">
              <div className="text-2xl font-semibold tracking-tight">{selectedCredential.label}</div>
              <p className="text-sm text-slate-500 mt-1">
                {selectedCredential.key === 'superadministrador' 
                  ? 'Ingresa credenciales de Superadministrador. Acceso completo y libre a todo el sistema.' 
                  : 'Ingresa correo y PIN (4 dígitos) asignado en Superadministrador para este grupo.'}
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                placeholder="Correo electrónico asignado"
                value={credEmail}
                onChange={(e) => setCredEmail(e.target.value)}
                className="w-full border px-4 py-3 rounded-2xl text-sm"
                required
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN (4 dígitos)"
                value={credPin}
                onChange={(e) => setCredPin(e.target.value.replace(/\D/g, ''))}
                className="w-full border px-4 py-3 rounded-2xl text-center font-mono tracking-[6px] text-xl"
              />
            </div>

            {credError && <div className="text-xs text-red-600 mt-3">{credError}</div>}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowCredentialModal(false); setCredPin(''); setCredError(''); }}
                className="flex-1 py-3 rounded-2xl border text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCredentialLogin}
                disabled={credLoading}
                className="flex-1 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:bg-emerald-300 text-white rounded-2xl text-sm font-semibold"
              >
                {credLoading ? 'Verificando...' : `Ingresar a ${selectedCredential.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
