'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';

export default function ClienteDashboard() {
  const router = useRouter();
  const { branding } = useBranding();
  const primary = branding?.primary_color || '#0E4A22';
  const secondary = branding?.secondary_color || '#963821';

  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState('inicio');
  const [dashboard, setDashboard] = useState(null);
  const [trips, setTrips] = useState([]);
  const [payments, setPayments] = useState([]);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [portalConfig, setPortalConfig] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/client-portal/auth/me', { credentials: 'include' });
        if (!me.ok) {
          router.replace('/portal-cliente');
          return;
        }
        const meData = await me.json();
        setAuth(meData);

        const d = await fetch('/api/client-portal/dashboard', { credentials: 'include' });
        if (d.ok) setDashboard(await d.json());

        const t = await fetch('/api/client-portal/trips', { credentials: 'include' });
        if (t.ok) setTrips(await t.json());

        const p = await fetch('/api/client-portal/payments', { credentials: 'include' });
        if (p.ok) setPayments(await p.json());

        // Cargar config del portal (botones, campos, etc configurados por superadmin)
        try {
          const cfgRes = await fetch('/api/client-portal/admin/access?config=1');
          if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            if (cfg.config) setPortalConfig(cfg.config);
          }
        } catch(_) {}
      } catch (e) {
        router.replace('/portal-cliente');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function loadStatement() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/client-portal/statement?${params}`, { credentials: 'include' });
    if (res.ok) setStatement(await res.json());
    setTab('estado');
  }

  async function downloadPDF() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/client-portal/statement/pdf?${params}`, { credentials: 'include' });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estado_Cuenta_Tecavo_${auth?.customer?.clientNumber || 'CLI'}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  const logout = async () => {
    await fetch('/api/client-portal/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/portal-cliente');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xl" style={{ color: primary }}>Cargando tu información...</div>;
  }

  const saldo = dashboard?.saldo_por_pagar || 0;
  const neto = dashboard?.saldo_neto || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ color: primary }} className="font-bold tracking-tight text-2xl">TECAVO FRUITS</div>
            <div className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">PORTAL DE CLIENTES</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-semibold">{auth?.customer?.name}</div>
              <div className="text-xs text-slate-500">{auth?.customer?.clientNumber}</div>
            </div>
            <button onClick={logout} className="px-3 py-1.5 text-xs border rounded hover:bg-slate-100">Cerrar sesión</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 border-t flex gap-1 text-sm">
          {[
            { k: 'inicio', l: 'Inicio' },
            { k: 'viajes', l: 'Mis Viajes' },
            { k: 'pagos', l: 'Mis Pagos' },
            { k: 'estado', l: 'Estado de Cuenta' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2 border-b-2 ${tab === t.k ? 'border-emerald-700 text-emerald-800 font-semibold' : 'border-transparent text-slate-600'}`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* INICIO / Dashboard */}
        {tab === 'inicio' && dashboard && (
          <div>
            <div className="mb-4 text-xs text-slate-500">Actualizado al momento de la consulta • {new Date(dashboard.actualizado || Date.now()).toLocaleString('es-MX')}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border rounded-2xl p-5">
                <div className="text-xs text-slate-500">SALDO POR PAGAR</div>
                <div className="text-4xl font-bold mt-2 text-red-600">${saldo.toFixed(2)} <span className="text-base font-normal">USD</span></div>
              </div>
              <div className="bg-white border rounded-2xl p-5">
                <div className="text-xs text-slate-500">PAGOS REALIZADOS</div>
                <div className="text-4xl font-bold mt-2 text-emerald-600">${(dashboard.pagos_realizados || 0).toFixed(2)} <span className="text-base font-normal">USD</span></div>
              </div>
              <div className="bg-white border rounded-2xl p-5">
                <div className="text-xs text-slate-500">ANTICIPOS DISPONIBLES</div>
                <div className="text-4xl font-bold mt-2 text-blue-600">${(dashboard.anticipos_disponibles || 0).toFixed(2)} <span className="text-base font-normal">USD</span></div>
              </div>
              <div className="bg-white border rounded-2xl p-5">
                <div className="text-xs text-slate-500">SALDO NETO</div>
                <div className={`text-4xl font-bold mt-2 ${neto < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  ${Math.abs(neto).toFixed(2)} <span className="text-base font-normal">USD</span>
                </div>
                <div className="text-xs mt-1">{neto < 0 ? 'Saldo a favor' : 'Pendiente de pago'}</div>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 text-sm text-slate-600">
              {portalConfig.welcome || 'Bienvenido al Portal de Clientes de Tecavo Fruits. Aquí puedes consultar tus viajes, pagos aplicados y tu estado de cuenta actualizado en tiempo real.'}
              {Array.isArray(portalConfig.extraFields) && portalConfig.extraFields.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">{portalConfig.extraFields.join(' • ')}</div>
              )}
            </div>
          </div>
        )}

        {/* MIS VIAJES */}
        {tab === 'viajes' && (
          <div className="bg-white border rounded-2xl overflow-hidden">
            <div className="p-4 border-b font-semibold">Mis Viajes</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Fecha</th>
                    <th className="p-3 text-left">Folio</th>
                    <th className="p-3 text-left">Destino</th>
                    <th className="p-3 text-right">Cajas</th>
                    <th className="p-3 text-right">Valor USD</th>
                    <th className="p-3 text-left">Estatus</th>
                    <th className="p-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-slate-500">No hay viajes registrados.</td></tr>}
                  {trips.map((v, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{v.fecha_salida ? new Date(v.fecha_salida).toLocaleDateString('es-MX') : '—'}</td>
                      <td className="p-3 font-mono">{v.folio}</td>
                      <td className="p-3">{v.destino}</td>
                      <td className="p-3 text-right">{v.numero_cajas}</td>
                      <td className="p-3 text-right font-semibold">${parseFloat(v.valor_usd || 0).toFixed(2)}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{v.estatus}</span></td>
                      <td className="p-3 text-right font-semibold text-red-700">${parseFloat(v.saldo || v.valor_usd || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MIS PAGOS */}
        {tab === 'pagos' && (
          <div className="bg-white border rounded-2xl overflow-hidden">
            <div className="p-4 border-b font-semibold">Mis Pagos y Aplicaciones</div>
            <div className="p-4 space-y-4">
              {payments.length === 0 && <div className="text-slate-500">No hay pagos registrados.</div>}
              {payments.map((p, idx) => (
                <div key={idx} className="border rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="font-mono font-semibold">{p.folio}</span> • {p.fecha}
                    </div>
                    <div className="font-semibold">${parseFloat(p.equivalente_usd || 0).toFixed(2)} USD</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Disponible: ${(p.disponible_usd || 0).toFixed(2)}</div>

                  {p.aplicaciones && p.aplicaciones.length > 0 && (
                    <div className="mt-3 text-xs">
                      <div className="font-medium mb-1">Aplicado a:</div>
                      {p.aplicaciones.map((a, i) => (
                        <div key={i} className="flex justify-between border-t py-1">
                          <span>{a.nota_folio || a.viaje_folio || '—'}</span>
                          <span className="font-medium">${parseFloat(a.monto_aplicado_usd || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ESTADO DE CUENTA */}
        {tab === 'estado' && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4 items-end">
              <div>
                <div className="text-xs mb-1">Desde</div>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border px-3 py-1.5 rounded" />
              </div>
              <div>
                <div className="text-xs mb-1">Hasta</div>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border px-3 py-1.5 rounded" />
              </div>
              <button onClick={loadStatement} className="px-4 py-2 rounded text-white" style={{ backgroundColor: primary }}>{portalConfig.btnRefresh || 'Actualizar'}</button>
              <button onClick={downloadPDF} className="px-4 py-2 rounded border">{portalConfig.btnDownload || 'Descargar PDF'}</button>
            </div>

            {!statement && (
              <button onClick={loadStatement} className="px-5 py-2 bg-white border rounded">Cargar Estado de Cuenta</button>
            )}

            {statement && (
              <div className="bg-white border rounded-2xl p-4">
                <div className="mb-3 text-sm font-semibold">Estado de Cuenta • {statement.cliente?.nombre} ({statement.cliente?.numero})</div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  <div className="p-2 bg-slate-50 rounded">Saldo por pagar: <b>${(statement.resumen?.saldo_por_pagar_usd || 0).toFixed(2)}</b></div>
                  <div className="p-2 bg-slate-50 rounded">Anticipos: <b>${(statement.resumen?.anticipos_disponibles_usd || 0).toFixed(2)}</b></div>
                  <div className="p-2 bg-slate-50 rounded">Neto: <b className={statement.resumen?.es_saldo_a_favor ? 'text-emerald-700' : ''}>${(statement.resumen?.saldo_neto_usd || 0).toFixed(2)}</b></div>
                  <div className="p-2 bg-slate-50 rounded">Viajes: <b>{statement.resumen?.total_viajes || 0}</b></div>
                </div>

                <div className="overflow-auto max-h-[420px]">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100"><th className="p-2 text-left">Fecha</th><th>Tipo</th><th>Folio</th><th className="text-right">Cargo</th><th className="text-right">Abono</th><th className="text-right">Saldo</th></tr></thead>
                    <tbody>
                      {(statement.movimientos || []).map((m, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{m.fecha}</td>
                          <td className="p-2 text-xs">{m.tipo}</td>
                          <td className="p-2 font-mono text-xs">{m.folio}</td>
                          <td className="p-2 text-right text-red-600">{m.cargo ? `$${m.cargo.toFixed(2)}` : ''}</td>
                          <td className="p-2 text-right text-emerald-600">{m.abono ? `$${m.abono.toFixed(2)}` : ''}</td>
                          <td className="p-2 text-right font-semibold">${(m.saldo_acumulado || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-400 py-6">Documento informativo • La información se actualiza automáticamente con los registros de Soft Tecavo</div>
    </div>
  );
}
