'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COST_TYPES = {
  'directo_lote': 'Directo a Lote',
  'empacado': 'Empacado',
  'indirecto': 'Indirecto',
  'venta_carga': 'Venta/Carga',
  'proceso_desecho': 'Proceso/Desecho'
};

const DISTRIBUTION_METHODS = {
  'directo_lote': 'Directo a Lote',
  'directo_produccion': 'Directo a Producción',
  'directo_carga': 'Directo a Carga',
  'prorrateado_kg_ingresados': 'Prorrateado por KG Ingresados',
  'prorrateado_kg_empacados': 'Prorrateado por KG Empacados',
  'prorrateado_cajas': 'Prorrateado por Cajas',
  'prorrateado_kg_vendidos': 'Prorrateado por KG Vendidos',
  'prorrateado_semanal': 'Prorrateado Semanal',
  'costo_fijo_semanal': 'Costo Fijo Semanal',
  'costo_unitario_caja': 'Costo Unitario por Caja',
  'costo_unitario_kilo': 'Costo Unitario por Kilo',
  'manual': 'Manual'
};

const STATUS_MAP = {
  'pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  'aprobado': { label: 'Aprobado', color: 'bg-green-100 text-green-700' },
  'rechazado': { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  'aplicado': { label: 'Aplicado', color: 'bg-blue-100 text-blue-700' }
};

const fmt = (n) => `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CostosOperativosPage() {
  const router = useRouter();
  const [costs, setCosts] = useState([]);
  const [lots, setLots] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ costType: '', status: '' });
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const [form, setForm] = useState({
    cost_date: new Date().toISOString().split('T')[0],
    cost_type: 'directo_lote',
    cost_category: '',
    cost_concept: '',
    description: '',
    amount: '',
    currency: 'MXN',
    exchange_rate: 1.00,
    area_related: '',
    module_origin: '',
    lot_id: '',
    customer_id: '',
    distribution_method: 'directo_lote',
    calculation_base: '',
    base_kg: '',
    notes: '',
    receipt_url: ''
  });

  useEffect(() => {
    fetchCosts();
    fetchLots();
    fetchCustomers();
    fetchSummary();
    fetchAlerts();
  }, [filter]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.costType) params.set('costType', filter.costType);
      if (filter.status) params.set('status', filter.status);

      const res = await fetch(`/api/operating-costs?${params}`);
      const data = await res.json();
      setCosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/operating-costs?summary=true');
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/operating-costs/alerts?isRead=false');
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { ...form, id: editing.id } : form;

      const res = await fetch('/api/operating-costs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, registered_by: 'Admin' })
      });

      if (res.ok) {
        setShowForm(false);
        setEditing(null);
        resetForm();
        fetchCosts();
        fetchSummary();
        fetchAlerts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id) => {
    if (!confirm('¿Aprobar este costo?')) return;
    try {
      const res = await fetch('/api/operating-costs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approved_by: 'Admin' })
      });
      if (res.ok) {
        fetchCosts();
        fetchSummary();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este costo?')) return;
    try {
      const res = await fetch(`/api/operating-costs?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCosts();
        fetchSummary();
      } else {
        const error = await res.json();
        alert(error.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openNew = () => {
    resetForm();
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (cost) => {
    setForm({
      cost_date: cost.cost_date?.split('T')[0] || '',
      cost_type: cost.cost_type || 'directo_lote',
      cost_category: cost.cost_category || '',
      cost_concept: cost.cost_concept || '',
      description: cost.description || '',
      amount: cost.amount || '',
      currency: cost.currency || 'MXN',
      exchange_rate: cost.exchange_rate || 1.00,
      area_related: cost.area_related || '',
      module_origin: cost.module_origin || '',
      lot_id: cost.lot_id || '',
      customer_id: cost.customer_id || '',
      distribution_method: cost.distribution_method || 'directo_lote',
      calculation_base: cost.calculation_base || '',
      base_kg: cost.base_kg || '',
      notes: cost.notes || '',
      receipt_url: cost.receipt_url || ''
    });
    setEditing(cost);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      cost_date: new Date().toISOString().split('T')[0],
      cost_type: 'directo_lote',
      cost_category: '',
      cost_concept: '',
      description: '',
      amount: '',
      currency: 'MXN',
      exchange_rate: 1.00,
      area_related: '',
      module_origin: '',
      lot_id: '',
      customer_id: '',
      distribution_method: 'directo_lote',
      calculation_base: '',
      base_kg: '',
      notes: '',
      receipt_url: ''
    });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Costos Operativos', 14, 20);
    
    const tableData = costs.map(c => [
      c.folio || '',
      new Date(c.cost_date).toLocaleDateString('es-MX'),
      COST_TYPES[c.cost_type] || c.cost_type,
      c.cost_concept || '',
      fmt(c.amount_mxn),
      STATUS_MAP[c.status]?.label || c.status
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Folio', 'Fecha', 'Tipo', 'Concepto', 'Monto', 'Estado']],
      body: tableData,
      theme: 'grid'
    });

    doc.save('costos_operativos.pdf');
  };

  const exportExcel = () => {
    const data = costs.map(c => ({
      Folio: c.folio || '',
      Fecha: new Date(c.cost_date).toLocaleDateString('es-MX'),
      Tipo: COST_TYPES[c.cost_type] || c.cost_type,
      Categoría: c.cost_category || '',
      Concepto: c.cost_concept || '',
      Monto: parseFloat(c.amount_mxn || 0),
      Moneda: c.currency || '',
      Estado: STATUS_MAP[c.status]?.label || c.status,
      Lote: c.lot_number || '',
      'Método Distribución': DISTRIBUTION_METHODS[c.distribution_method] || '',
      Notas: c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Costos');
    XLSX.writeFile(wb, 'costos_operativos.xlsx');
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <i className="ph ph-arrow-left text-lg"></i>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <i className="ph-fill ph-coins text-xl text-indigo-600"></i>
              </div>
              <div>
                <h1 className="font-bold text-slate-900 leading-none">Costos Operativos</h1>
                <p className="text-xs text-slate-500">Control total de costos</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="ph ph-file-pdf"></i>
            </button>
            <button
              onClick={exportExcel}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="ph ph-file-xls"></i>
            </button>
            <button
              onClick={openNew}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <i className="ph ph-plus-circle"></i>
              Nuevo Costo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <i className="ph-fill ph-warning text-yellow-600 text-xl"></i>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">{alert.message}</p>
                  {alert.folio && <p className="text-xs text-yellow-700 mt-1">Folio: {alert.folio}</p>}
                </div>
                <button className="text-yellow-600 hover:text-yellow-800">
                  <i className="ph ph-x"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {summary.map((s, idx) => {
              const icons = {
                'directo_lote': 'ph-package',
                'empacado': 'ph-factory',
                'indirecto': 'ph-buildings',
                'venta_carga': 'ph-truck',
                'proceso_desecho': 'ph-trash'
              };
              const colors = {
                'directo_lote': 'emerald',
                'empacado': 'blue',
                'indirecto': 'purple',
                'venta_carga': 'orange',
                'proceso_desecho': 'red'
              };
              const color = colors[s.cost_type] || 'slate';
              return (
                <div key={idx} className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                      <i className={`ph-fill ${icons[s.cost_type] || 'ph-coin'} text-${color}-600`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">{COST_TYPES[s.cost_type]}</p>
                      <p className="font-bold text-slate-900">{fmt(s.total_amount)}</p>
                      <p className="text-xs text-slate-400">{s.count} registros</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
          <select
            value={filter.costType}
            onChange={(e) => setFilter(f => ({ ...f, costType: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(COST_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => setFilter({ costType: '', status: '' })}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Limpiar filtros
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editing ? 'Editar Costo' : 'Nuevo Costo'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.cost_date}
                  onChange={(e) => setField('cost_date', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Costo</label>
                <select
                  value={form.cost_type}
                  onChange={(e) => setField('cost_type', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  {Object.entries(COST_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <input
                  type="text"
                  value={form.cost_category}
                  onChange={(e) => setField('cost_category', e.target.value)}
                  placeholder="Ej: Material de empaque"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Concepto *</label>
                <input
                  type="text"
                  value={form.cost_concept}
                  onChange={(e) => setField('cost_concept', e.target.value)}
                  placeholder="Ej: Cajas de cartón"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                <select
                  value={form.currency}
                  onChange={(e) => setField('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lote (si aplica)</label>
                <select
                  value={form.lot_id}
                  onChange={(e) => setField('lot_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">Ninguno</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>{l.lot_number} - {l.producer}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Método de Distribución</label>
                <select
                  value={form.distribution_method}
                  onChange={(e) => setField('distribution_method', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  {Object.entries(DISTRIBUTION_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.cost_concept || !form.amount}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditing(null); resetForm(); }}
                className="px-6 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Costs List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando costos...</div>
        ) : costs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <i className="ph ph-coins text-6xl mb-4"></i>
            <p className="text-lg font-medium">No hay costos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {costs.map(cost => {
              const statusInfo = STATUS_MAP[cost.status] || { label: cost.status, color: 'bg-slate-100 text-slate-700' };
              return (
                <div key={cost.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-slate-500">{cost.folio}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {COST_TYPES[cost.cost_type]}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg">{cost.cost_concept}</h3>
                      {cost.description && <p className="text-sm text-slate-600 mt-1">{cost.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                        <span><i className="ph ph-calendar-blank mr-1"></i>{new Date(cost.cost_date).toLocaleDateString('es-MX')}</span>
                        {cost.lot_number && <span><i className="ph ph-package mr-1"></i>{cost.lot_number}</span>}
                        {cost.cost_category && <span><i className="ph ph-tag mr-1"></i>{cost.cost_category}</span>}
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">{fmt(cost.amount_mxn)}</p>
                        <p className="text-xs text-slate-500 mt-1">{DISTRIBUTION_METHODS[cost.distribution_method] || 'Sin método'}</p>
                      </div>
                      <div className="flex gap-2">
                        {cost.status === 'pendiente' && (
                          <button
                            onClick={() => handleApprove(cost.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Aprobar"
                          >
                            <i className="ph ph-check-circle"></i>
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(cost)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <i className="ph ph-pencil-simple"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(cost.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <i className="ph ph-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
