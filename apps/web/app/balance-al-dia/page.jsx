'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Calendar, DollarSign, AlertTriangle, Check } from 'lucide-react';

export default function BalanceAlDiaPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');
  const [tab, setTab] = useState('resumen'); // resumen | cobros | pagos
  const [search, setSearch] = useState('');

  const fmt = (n = 0) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch('/api/balance-al-dia');
      const json = await res.json();
      setData(json);
      setLastFetch(new Date().toLocaleString('es-MX'));
    } catch (e) {
      setData({ total_pagos_pendientes: 0, total_cobros_pendientes: 0, balance: 0, detalles: {pagos:[], cobros:[]}, desglose: {} });
      setLastFetch(new Date().toLocaleString('es-MX'));
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const balance = data ? data.balance : 0;
  const esPositivo = balance >= 0;
  const totalPagos = data ? data.total_pagos_pendientes : 0;
  const totalCobros = data ? data.total_cobros_pendientes : 0;

  const pagos = (data?.detalles?.pagos || []).filter(item => {
    const q = search.toLowerCase();
    return !q || (item.descripcion && item.descripcion.toLowerCase().includes(q)) || (item.tipo && item.tipo.toLowerCase().includes(q));
  });
  const cobros = (data?.detalles?.cobros || []).filter(item => {
    const q = search.toLowerCase();
    return !q || (item.descripcion && item.descripcion.toLowerCase().includes(q)) || (item.tipo && item.tipo.toLowerCase().includes(q));
  });

  const d = data?.desglose || {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Balance al día</h1>
              <p className="text-xs text-slate-500 mt-1">Cobros pendientes − (Pagos productores + Fletes + Nómina + Préstamos + Costos op. + Programados) • Actualizado desde los módulos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs px-3 py-1 bg-white rounded-lg border text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Última: {lastFetch}
            </div>
            <button onClick={cargar} className="flex items-center gap-2 px-4 py-2 text-sm bg-white border hover:bg-slate-50 rounded-xl">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
            <button onClick={() => router.push('/')} className="text-sm px-4 py-2 bg-slate-800 text-white rounded-xl">Ir al inicio</button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-xs font-semibold tracking-[1px] text-emerald-700">COBROS PENDIENTES</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{fmt(totalCobros)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Ingresos por cobrar de ventas, cargas, viajes, cuentas</div>
          </div>
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-xs font-semibold tracking-[1px] text-rose-700">PAGOS PENDIENTES</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{fmt(totalPagos)}</div>
            <div className="text-[10px] text-slate-500 mt-1">Productores • Fletes • Nómina • Préstamos • Programados • Costos operativos (gastos registrados al momento se excluyen del balance pendiente)</div>
          </div>
          <div className={`bg-white border rounded-2xl p-5 ${esPositivo ? 'border-emerald-200' : 'border-rose-200'}`}>
            <div className="text-xs font-semibold tracking-[1px] text-slate-600">BALANCE AL DÍA</div>
            <div className={`mt-2 text-4xl font-bold tabular-nums ${esPositivo ? 'text-slate-900' : 'text-rose-700'}`}>
              {fmt(balance)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              {esPositivo ? (
                <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-4 h-4" /> A favor. Cobros superan compromisos.</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-700"><AlertTriangle className="w-4 h-4" /> Compromiso de pago mayor. Revisar liquidez.</span>
              )}
            </div>
          </div>
        </div>

        {/* Desglose compacto */}
        <div className="mb-7 bg-white border rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider font-medium text-slate-600 mb-3">Desglose automático (sin duplicar datos del sistema)</div>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <div>
              <div className="font-semibold mb-1">Pagos pendientes</div>
              <div className="text-xs text-slate-500 space-y-0.5 leading-tight">
                Productores: {fmt(d.pagos?.productores?.total)} ({d.pagos?.productores?.registros || 0})<br/>
                Fletes: {fmt(d.pagos?.fletes?.total)} ({d.pagos?.fletes?.registros || 0})<br/>
                Costos op. pend.: {fmt(d.pagos?.costos_operativos?.total)}<br/>
                Nómina: {fmt(d.pagos?.nomina?.total)} • Préstamos: {fmt(d.pagos?.prestamos?.total)}<br/>
                Programados/schedule: {fmt(d.pagos?.programados?.total)}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1">Cobros pendientes</div>
              <div className="text-xs text-slate-500 space-y-0.5 leading-tight">
                Proceso/Desecho: {fmt(d.cobros?.proceso_desecho?.total)}<br/>
                Cargas / Ventas: {fmt(d.cobros?.cargas_ventas?.total)} ({d.cobros?.cargas_ventas?.registros || 0})<br/>
                Viajes cliente: {fmt(d.cobros?.viajes?.total)}<br/>
                Cuentas de clientes: {fmt(d.cobros?.cuentas_clientes?.total)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-amber-700 mt-2">Los valores pendientes de balance se calculan de: producer_payments • foreign_freights • operating_costs • payroll_periods • employee_loans • payment_schedule • sales_of_process_and_waste • load_history • customer_trips • customer_accounts. Los gastos (expenses) se registran en su fecha y se excluyen del Balance al día (no son flujos pendientes programados).</div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 border-b">
          {['resumen', 'cobros', 'pagos'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
              {t === 'resumen' ? 'Resumen & Trazabilidad' : t === 'cobros' ? `Cobros pendientes (${cobros.length})` : `Pagos pendientes (${pagos.length})`}
            </button>
          ))}
          <div className="flex-1" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por descripción o tipo..." className="px-3 py-1 text-xs border rounded bg-white mb-1" />
        </div>

        {loading && <div className="py-8 text-center text-sm text-slate-500">Actualizando balance…</div>}

        {/* Contenido */}
        {tab === 'resumen' && data && (
          <div>
            <div className="bg-white border rounded-2xl p-5 mb-6">
              <div className="font-semibold mb-2 text-sm">Fórmula aplicada</div>
              <div className="font-mono text-lg bg-slate-50 p-2">Balance al día = Cobros pendientes − (Pagos a productores + Fletes + Nómina + Préstamos + Costos op. pendientes + Programados)</div>
              <div className="mt-1 text-xs text-slate-500">Cualquier movimiento que modifique un módulo (pagar / cobrar / registrar) actualiza inmediatamente este cálculo.</div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Orígenes de cobro (ingresos pendientes)</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Proceso y Desecho</span><span className="font-semibold">{fmt(d.cobros?.proceso_desecho?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Cargas / Ventas</span><span className="font-semibold">{fmt(d.cobros?.cargas_ventas?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Viajes pendientes (clientes)</span><span className="font-semibold">{fmt(d.cobros?.viajes?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Cuentas corrientes clientes</span><span className="font-semibold">{fmt(d.cobros?.cuentas_clientes?.total)}</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-sm mb-2">Orígenes de pagos (egresos pendientes)</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Productores</span><span className="font-semibold">{fmt(d.pagos?.productores?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Fletes</span><span className="font-semibold">{fmt(d.pagos?.fletes?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Costos op. pendientes</span><span className="font-semibold">{fmt((d.pagos?.costos_operativos?.total||0))}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Nómina / Cuadrillas</span><span className="font-semibold">{fmt(d.pagos?.nomina?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Préstamos</span><span className="font-semibold">{fmt(d.pagos?.prestamos?.total)}</span></div>
                  <div className="flex justify-between bg-white border p-3 rounded"><span>Otros programados</span><span className="font-semibold">{fmt(d.pagos?.programados?.total)}</span></div>
                </div>
              </div>
            </div>
            <div className="mt-5 text-xs text-slate-400">Trazabilidad: cada fila en las pestañas Cobros / Pagos contiene origen, lote, fecha, estado y vínculo a módulo fuente. Usa los filtros o pulsa a módulo correspondiente para registrar cobro/pago y actualizar Balance.</div>
          </div>
        )}

        {tab === 'cobros' && (
          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-emerald-50 text-left text-emerald-950 font-medium">
                  <th className="p-3">Tipo / Descripción</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3 text-right">Monto pendiente</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ir al módulo</th>
                </tr>
              </thead>
              <tbody>
                {cobros.length === 0 && <tr><td className="p-5 text-center text-slate-500" colSpan="5">No hay cobros pendientes con los filtros actuales.</td></tr>}
                {cobros.map((item, i) => (
                  <tr key={i} className="border-t hover:bg-emerald-50/60">
                    <td className="p-3">{item.tipo} — {item.descripcion}</td>
                    <td className="p-3 text-slate-500 text-xs">{item.fecha || '—'}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{fmt(item.monto)}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">{item.estado || 'Pendiente'}</span></td>
                    <td className="p-3">
                      <button onClick={() => router.push(item.origen || '/customers')} className="text-emerald-700 text-xs underline">Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-100 font-semibold">
                  <td className="p-3">Total cobros filtrados</td><td /><td className="p-3 text-right tabular-nums">{fmt(cobros.reduce((s, x)=>s + x.monto, 0))}</td><td colSpan="2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'pagos' && (
          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-50 text-left text-rose-950 font-medium">
                  <th className="p-3">Tipo / Descripción</th>
                  <th className="p-3">Fecha / Vencimiento</th>
                  <th className="p-3 text-right">Monto pendiente</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ir al módulo</th>
                </tr>
              </thead>
              <tbody>
                {pagos.length === 0 && <tr><td className="p-5 text-center text-slate-500" colSpan="5">No hay pagos pendientes con los filtros actuales.</td></tr>}
                {pagos.map((item, i) => (
                  <tr key={i} className="border-t hover:bg-rose-50/50">
                    <td className="p-3">{item.tipo} — {item.descripcion}</td>
                    <td className="p-3 text-slate-500 text-xs">{item.fecha || '—'}</td>
                    <td className="p-3 text-right font-semibold tabular-nums text-rose-800">{fmt(item.monto)}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded">{item.estado || 'Pendiente'}</span></td>
                    <td className="p-3">
                      <button onClick={() => router.push(item.origen || '/expenses')} className="text-rose-700 text-xs underline">Abrir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-rose-100 font-semibold">
                  <td className="p-3">Total pagos filtrados</td><td /><td className="p-3 text-right tabular-nums">{fmt(pagos.reduce((s, x)=>s + x.monto, 0))}</td><td colSpan="2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && (
          <div className="mt-6 text-[11px] text-slate-400">Toda la información es calculada en tiempo real. Cuando registres un pago o cobro en cualquiera de los módulos, este balance se recalculará con el dato modificado.</div>
        )}
      </div>
    </div>
  );
}
