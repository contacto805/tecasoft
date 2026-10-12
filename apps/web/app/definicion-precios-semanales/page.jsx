'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Copy, Send, History, Download, Upload } from 'lucide-react';

const CALIBERS = ['SUPER', 'EXTRA', 'PRIMERA', 'MEDIANO', 'TERCERA', 'CUARTA', 'PROCESO', 'DESECHO'];
const COLORS = {
  black: '#111111',
  green: '#1F6B3A',
  darkGreen: '#124A29',
  lightGreen: '#E8F3EC',
  white: '#FFFFFF',
  gray: '#F3F4F6'
};

export default function DefinicionPreciosSemanales() {
  const [activeTab, setActiveTab] = useState('actual');
  const [weeks, setWeeks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exchange, setExchange] = useState(17.5);
  const [market, setMarket] = useState('USA');
  const [year, setYear] = useState(2025);
  const [weekNum, setWeekNum] = useState(42);
  const [dateFrom, setDateFrom] = useState('2025-10-13');
  const [dateTo, setDateTo] = useState('2025-10-19');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('BORRADOR');

  const [historyFilters, setHistoryFilters] = useState({ year: '', market: '', status: '' });

  // Load weeks
  async function loadWeeks() {
    setLoading(true);
    try {
      const res = await fetch('/api/price-weeks');
      const data = await res.json();
      setWeeks(Array.isArray(data) ? data : []);
      // auto select latest draft or published
      const draftOrPub = (Array.isArray(data) ? data : []).find(w => w.status === 'BORRADOR' || w.status === 'PUBLICADO');
      if (draftOrPub && !currentWeek) {
        await selectWeek(draftOrPub.id);
      }
    } catch (e) {}
    setLoading(false);
  }

  async function selectWeek(id) {
    try {
      const res = await fetch(`/api/price-weeks?id=${id}`);
      const data = await res.json();
      setCurrentWeek(data);
      setExchange(data.exchange_rate_mxn_usd || 17.5);
      setMarket(data.market || 'USA');
      setYear(data.week_year);
      setWeekNum(data.week_number);
      setDateFrom(data.date_from || '');
      setDateTo(data.date_to || '');
      setNotes(data.notes || '');
      setStatus(data.status || 'BORRADOR');

      const itRes = await fetch(`/api/price-week-items?price_week_id=${id}`);
      let its = await itRes.json();
      // ensure all calibers present
      const map = {};
      (its || []).forEach(i => { map[i.caliber_code] = i; });
      const full = CALIBERS.map(c => {
        const ex = map[c] || {};
        return {
          caliber_code: c,
          purchase_mxn_kg: ex.purchase_mxn_kg || 0,
          sale_usd_box_6kg: ex.sale_usd_box_6kg || 0,
          sale_usd_box_10kg: ex.sale_usd_box_10kg || 0,
          id: ex.id || null
        };
      });
      setItems(full);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadWeeks(); }, []);

  // live calculations
  const computed = items.map(it => {
    const p = parseFloat(it.purchase_mxn_kg) || 0;
    const s6 = parseFloat(it.sale_usd_box_6kg) || 0;
    const s10 = parseFloat(it.sale_usd_box_10kg) || 0;
    const ex = Number(exchange) || 17.5;
    const eq6 = s6 > 0 ? (s6 * ex) / 6 : 0;
    const eq10 = s10 > 0 ? (s10 * ex) / 10 : 0;
    const m6 = eq6 - p;
    const m10 = eq10 - p;
    return {
      ...it,
      equiv6: parseFloat(eq6.toFixed(4)),
      equiv10: parseFloat(eq10.toFixed(4)),
      margin6: parseFloat(m6.toFixed(4)),
      margin10: parseFloat(m10.toFixed(4)),
      max6: parseFloat(eq6.toFixed(4)),
      max10: parseFloat(eq10.toFixed(4))
    };
  });

  const avgCompra = computed.length ? (computed.reduce((s, r) => s + (parseFloat(r.purchase_mxn_kg)||0), 0) / computed.length).toFixed(2) : '0.00';
  const avgVenta6 = computed.length ? (computed.reduce((s, r) => s + (parseFloat(r.sale_usd_box_6kg)||0), 0) / computed.length).toFixed(2) : '0.00';
  const avgVenta10 = computed.length ? (computed.reduce((s, r) => s + (parseFloat(r.sale_usd_box_10kg)||0), 0) / computed.length).toFixed(2) : '0.00';

  async function saveWeek() {
    if (!currentWeek) {
      // create
      const payload = {
        week_year: year, week_number: weekNum, date_from: dateFrom, date_to: dateTo,
        market, exchange_rate_mxn_usd: exchange, notes, status,
        items: items.map(i => ({ caliber_code: i.caliber_code, purchase_mxn_kg: i.purchase_mxn_kg, sale_usd_box_6kg: i.sale_usd_box_6kg, sale_usd_box_10kg: i.sale_usd_box_10kg }))
      };
      const res = await fetch('/api/price-weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        alert('Semana creada');
        await loadWeeks();
      }
    } else {
      await fetch('/api/price-weeks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentWeek.id, week_year: year, week_number: weekNum, date_from: dateFrom, date_to: dateTo, market, exchange_rate_mxn_usd: exchange, notes, status }) });
      // save items
      for (const it of items) {
        if (it.id) {
          await fetch('/api/price-week-items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, purchase_mxn_kg: it.purchase_mxn_kg, sale_usd_box_6kg: it.sale_usd_box_6kg, sale_usd_box_10kg: it.sale_usd_box_10kg }) });
        } else {
          await fetch('/api/price-week-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price_week_id: currentWeek.id, caliber_code: it.caliber_code, purchase_mxn_kg: it.purchase_mxn_kg, sale_usd_box_6kg: it.sale_usd_box_6kg, sale_usd_box_10kg: it.sale_usd_box_10kg }) });
        }
      }
      alert('Guardado');
      await selectWeek(currentWeek.id);
      await loadWeeks();
    }
  }

  async function duplicateWeek() {
    if (!currentWeek) return alert('Seleccione una semana');
    const res = await fetch('/api/price-weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', source_week_id: currentWeek.id }) });
    if (res.ok) {
      const nw = await res.json();
      alert('Semana duplicada como borrador');
      await loadWeeks();
      await selectWeek(nw.id);
    }
  }

  async function publish() {
    if (!currentWeek) return alert('Seleccione semana');
    if (!confirm('¿Publicar estos precios como oficiales de la semana?')) return;
    const res = await fetch('/api/price-weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish', week_id: currentWeek.id }) });
    if (res.ok) {
      alert('Precios publicados. Ahora son fuente única del sistema.');
      await loadWeeks();
      await selectWeek(currentWeek.id);
    } else {
      const err = await res.json().catch(()=>({}));
      alert(err.error || 'Error al publicar');
    }
  }

  async function createNewDraft() {
    const payload = { week_year: year, week_number: weekNum, date_from: dateFrom, date_to: dateTo, market, exchange_rate_mxn_usd: exchange, notes: 'Nueva semana', status: 'BORRADOR', items: CALIBERS.map(c => ({ caliber_code: c, purchase_mxn_kg: 0, sale_usd_box_6kg: 0, sale_usd_box_10kg: 0 })) };
    const res = await fetch('/api/price-weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      const nw = await res.json();
      await loadWeeks();
      await selectWeek(nw.id);
    }
  }

  // Simple export
  function exportCSV() {
    if (!currentWeek) return;
    let csv = 'CALIBRE,COMPRA CAMPO MXN/KG,VENTA USD CAJA 6KG,VENTA USD CAJA 10KG\n';
    computed.forEach(r => {
      csv += `${r.caliber_code},${r.purchase_mxn_kg},${r.sale_usd_box_6kg},${r.sale_usd_box_10kg}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `precios_semana_${currentWeek.week_year}_W${currentWeek.week_number}.csv`; a.click();
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.gray, color: COLORS.black }}>
      <div className="max-w-[1280px] mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full" style={{ background: COLORS.green }} />
            <div>
              <div className="text-2xl font-bold tracking-tight" style={{ color: COLORS.black }}>TECAVO FRUITS</div>
              <div className="text-sm" style={{ color: COLORS.darkGreen }}>Definición de Precios Semanales — Del campo con amor</div>
            </div>
          </div>
          <div className="text-xs mt-1 text-gray-500">FUENTE ÚNICA DE PRECIOS • Todos los módulos consultan aquí</div>
        </div>

        {/* Dashboard indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Semana Activa</div>
            <div className="text-2xl font-semibold">{currentWeek ? `${currentWeek.week_year}-W${currentWeek.week_number}` : '—'}</div>
            <div className="text-xs mt-1">{currentWeek?.status || ''}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Tipo de Cambio</div>
            <div className="text-2xl font-semibold">{exchange}</div>
            <div className="text-xs">MXN/USD</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Mercado</div>
            <div className="text-xl font-semibold">{market || '—'}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Calibres con precio</div>
            <div className="text-2xl font-semibold">{computed.filter(c => (parseFloat(c.purchase_mxn_kg) || 0) > 0).length}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Prom. Compra</div>
            <div className="text-2xl font-semibold text-emerald-700">${avgCompra}</div>
            <div className="text-xs">MXN/kg</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Prom. Venta 6kg</div>
            <div className="text-2xl font-semibold">${avgVenta6}</div>
            <div className="text-xs">USD/caja</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: COLORS.lightGreen }}>
            <div className="text-xs text-gray-500">Prom. Venta 10kg</div>
            <div className="text-2xl font-semibold">${avgVenta10}</div>
            <div className="text-xs">USD/caja</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('actual')} className={`px-4 py-1.5 rounded-xl text-sm font-medium ${activeTab === 'actual' ? 'bg-black text-white' : 'bg-white border'}`}>Definición Actual</button>
          <button onClick={() => setActiveTab('historico')} className={`px-4 py-1.5 rounded-xl text-sm font-medium ${activeTab === 'historico' ? 'bg-black text-white' : 'bg-white border'}`}>Histórico de Precios</button>
          <button onClick={loadWeeks} className="ml-auto px-3 py-1.5 rounded-xl border bg-white flex items-center gap-1 text-sm"><RefreshCw size={14} /> Actualizar</button>
        </div>

        {activeTab === 'actual' && (
          <div className="bg-white rounded-3xl border p-6" style={{ borderColor: COLORS.lightGreen }}>
            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <div className="text-xs text-gray-500">Año</div>
                <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="border px-3 py-1.5 rounded-xl w-24" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Semana</div>
                <input type="number" value={weekNum} onChange={e => setWeekNum(parseInt(e.target.value))} className="border px-3 py-1.5 rounded-xl w-20" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Fecha inicio</div>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border px-3 py-1.5 rounded-xl" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Fecha fin</div>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border px-3 py-1.5 rounded-xl" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Mercado</div>
                <input value={market} onChange={e => setMarket(e.target.value)} className="border px-3 py-1.5 rounded-xl w-28" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Tipo cambio</div>
                <input type="number" step="0.01" value={exchange} onChange={e => setExchange(parseFloat(e.target.value))} className="border px-3 py-1.5 rounded-xl w-24" />
              </div>
              <div className="flex-1" />
              <button onClick={createNewDraft} className="px-4 py-2 rounded-2xl border flex items-center gap-2 text-sm"><Plus size={16} /> Nueva semana</button>
              <button onClick={saveWeek} className="px-5 py-2 rounded-2xl bg-[#1F6B3A] text-white text-sm font-medium">Guardar</button>
              <button onClick={duplicateWeek} className="px-4 py-2 rounded-2xl border flex items-center gap-2 text-sm"><Copy size={16} /> Duplicar anterior</button>
              <button onClick={publish} className="px-5 py-2 rounded-2xl bg-black text-white text-sm font-medium flex items-center gap-2"><Send size={16} /> PUBLICAR PRECIOS</button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#E8F3EC] text-left">
                    <th className="p-3 font-semibold">CALIBRE</th>
                    <th className="p-3 font-semibold text-right">COMPRA CAMPO MXN/KG</th>
                    <th className="p-3 font-semibold text-right">VENTA USD CAJA 6 KG</th>
                    <th className="p-3 font-semibold text-right">VENTA USD CAJA 10 KG</th>
                    <th className="p-3 font-semibold text-right">EQUIV. MXN/KG 6KG</th>
                    <th className="p-3 font-semibold text-right">EQUIV. MXN/KG 10KG</th>
                    <th className="p-3 font-semibold text-right">MARGEN 6KG</th>
                    <th className="p-3 font-semibold text-right">MARGEN 10KG</th>
                    <th className="p-3 font-semibold text-right">MÁX COMPRA 6KG</th>
                    <th className="p-3 font-semibold text-right">MÁX COMPRA 10KG</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold">{row.caliber_code}</td>
                      <td className="p-3 text-right">
                        <input type="number" step="0.01" value={row.purchase_mxn_kg} onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setItems(prev => prev.map((it, i) => i === idx ? { ...it, purchase_mxn_kg: v } : it));
                        }} className="w-28 text-right border rounded px-2 py-1" />
                      </td>
                      <td className="p-3 text-right">
                        <input type="number" step="0.01" value={row.sale_usd_box_6kg} onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setItems(prev => prev.map((it, i) => i === idx ? { ...it, sale_usd_box_6kg: v } : it));
                        }} className="w-24 text-right border rounded px-2 py-1" />
                      </td>
                      <td className="p-3 text-right">
                        <input type="number" step="0.01" value={row.sale_usd_box_10kg} onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setItems(prev => prev.map((it, i) => i === idx ? { ...it, sale_usd_box_10kg: v } : it));
                        }} className="w-24 text-right border rounded px-2 py-1" />
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium text-emerald-700">{row.equiv6}</td>
                      <td className="p-3 text-right tabular-nums font-medium text-emerald-700">{row.equiv10}</td>
                      <td className="p-3 text-right tabular-nums">{row.margin6}</td>
                      <td className="p-3 text-right tabular-nums">{row.margin10}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{row.max6}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{row.max10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500">Los valores calculados se actualizan en tiempo real. Solo las tres primeras columnas son editables. Publicar hace estos precios oficiales para todo el sistema.</div>

            <div className="mt-4 flex gap-2">
              <button onClick={exportCSV} className="px-4 py-1.5 rounded-xl border text-sm flex items-center gap-2"><Download size={14} /> Exportar CSV</button>
              <button onClick={() => alert('Importar: suba un CSV con las columnas CALIBRE,COMPRA,VENTA6,VENTA10 (funcionalidad básica lista para extensión).')} className="px-4 py-1.5 rounded-xl border text-sm flex items-center gap-2"><Upload size={14} /> Importar plantilla</button>
            </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="bg-white rounded-3xl border p-6" style={{ borderColor: COLORS.lightGreen }}>
            <div className="flex gap-2 mb-4">
              <input placeholder="Año" className="border px-3 py-1 rounded" value={historyFilters.year} onChange={e => setHistoryFilters({ ...historyFilters, year: e.target.value })} />
              <input placeholder="Mercado" className="border px-3 py-1 rounded" value={historyFilters.market} onChange={e => setHistoryFilters({ ...historyFilters, market: e.target.value })} />
              <select className="border px-3 py-1 rounded" value={historyFilters.status} onChange={e => setHistoryFilters({ ...historyFilters, status: e.target.value })}>
                <option value="">Todos estados</option>
                <option>BORRADOR</option><option>PUBLICADO</option><option>CERRADO</option>
              </select>
              <button onClick={loadWeeks} className="px-4 py-1 border rounded text-sm">Filtrar</button>
            </div>

            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100"><th className="p-2 text-left">Semana</th><th>Periodo</th><th>Mercado</th><th>T.C.</th><th>Estado</th><th>Versión</th><th>Acción</th></tr></thead>
              <tbody>
                {weeks.filter(w => (!historyFilters.year || String(w.week_year) === historyFilters.year) && (!historyFilters.market || (w.market || '').includes(historyFilters.market)) && (!historyFilters.status || w.status === historyFilters.status)).map(w => (
                  <tr key={w.id} className="border-b">
                    <td className="p-2 font-medium">{w.week_year}-S{w.week_number}</td>
                    <td className="p-2 text-xs">{w.date_from} → {w.date_to}</td>
                    <td className="p-2">{w.market || '—'}</td>
                    <td className="p-2">{w.exchange_rate_mxn_usd}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${w.status === 'PUBLICADO' ? 'bg-emerald-100 text-emerald-700' : w.status === 'CERRADO' ? 'bg-gray-200' : 'bg-amber-100'}`}>{w.status}</span></td>
                    <td className="p-2">v{w.version}</td>
                    <td className="p-2"><button onClick={() => selectWeek(w.id)} className="px-3 py-1 text-xs border rounded">Abrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
