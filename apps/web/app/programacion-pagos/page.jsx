"use client";

import { useState, useEffect } from "react";
import { Calendar, DollarSign, AlertTriangle, Plus, FileText, Download, Filter, Search, Clock, CheckCircle, XCircle, Edit, Trash2, Upload, Eye, Check, X } from "lucide-react";

export default function PaymentSchedulePage() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form, setForm] = useState({
    producer_name: '', beneficiary_name: '', bank_name: '', account_number: '', clabe: '',
    concept: '', amount: '', fruit_reception_date: new Date().toISOString().split('T')[0],
    payment_days: 22, priority: 'normal', observations: '', cutting_order_id: '', bank_account_id: null
  });
  const [customerBanks, setCustomerBanks] = useState([]);

  // Load banks from customer expediente when producer name matches (FASE 06)
  useEffect(() => {
    if (!form.producer_name || form.producer_name.length < 3) { setCustomerBanks([]); return; }
    (async () => {
      try {
        const res = await fetch('/api/customers');
        const list = await res.json();
        const match = (list || []).find(c => (c.customer_name || '').toLowerCase().includes(form.producer_name.toLowerCase().slice(0, 8)));
        setCustomerBanks((match && match.bank_accounts) || []);
      } catch { setCustomerBanks([]); }
    })();
  }, [form.producer_name]);
  const [datePreview, setDatePreview] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // AI document extraction state
  const [aiUploading, setAiUploading] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(null);
  const [aiDocumentUrl, setAiDocumentUrl] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Monthly calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Fruta próxima a pagar from integration
  const [frutaProxima, setFrutaProxima] = useState([]);

  // Holiday catalog (Superadmin administrable)
  const [holidays, setHolidays] = useState([]);
  const [showHolidays, setShowHolidays] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ year: new Date().getFullYear(), holiday_date: '', description: '' });

  useEffect(() => {
    fetchPayments();
    checkAdmin();
    fetchFrutaAlerts();
    if (isSuperAdmin) fetchHolidays();
  }, [filter, isSuperAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [calendarMonth, calendarYear]);

  const checkAdmin = async () => {
    try {
      const res = await fetch('/api/auth/check-super-admin');
      if (res.ok) {
        const d = await res.json();
        setIsSuperAdmin(!!d.isSuperAdmin);
      }
    } catch {}
  };

  const fetchPayments = async () => {
    try {
      const url = filter === 'all' 
        ? '/api/payment-schedule' 
        : filter === 'urgent'
        ? '/api/payment-schedule?urgent=true'
        : `/api/payment-schedule?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (signal) => {
    try {
      const res = await fetch(`/api/payment-schedule/stats?month=${calendarMonth}&year=${calendarYear}`, { signal });
      if (!res.ok) throw new Error('No se pudieron consultar las estadísticas de pagos');
      const report = await res.json();
      if (!signal?.aborted) setStats(report);
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error fetching payment stats:', error);
      setStats(null);
    }
  };

  const fetchFrutaAlerts = async () => {
    try {
      // Use lots + schedule data for alerta fruta próxima (<=13 days) for acopio context
      const [lotsRes, schedRes] = await Promise.all([
        fetch('/api/lots'),
        fetch('/api/payment-schedule?status=scheduled')
      ]);
      const lots = await lotsRes.json();
      const scheds = await schedRes.json();
      const lotsList = Array.isArray(lots) ? lots : [];
      const schedList = Array.isArray(scheds) ? scheds : [];

      const alertList = [];
      const today = new Date();

      lotsList.forEach(lot => {
        if (!lot.payment_scheduled_date && !lot.payment_days) return;
        const reception = lot.date ? new Date(lot.date) : today;
        const days = lot.payment_days || 15;
        const due = new Date(reception);
        due.setDate(due.getDate() + days);
        const daysLeft = Math.floor((Number(due.getTime()) - Number(today.getTime())) / 86400000);
        if (daysLeft <= 13 && (lot.status !== 'cancelado')) {
          const relatedSched = schedList.find(s => s.lot_id === lot.id) || {};
          alertList.push({
            producer: lot.producer || lot.producer_name,
            huerta: lot.orchard_name || '—',
            lote: lot.lot_number || lot.id,
            fecha_ingreso: lot.date,
            dias_pactados: days,
            fecha_vencimiento: due.toISOString().split('T')[0],
            fecha_programada: relatedSched.scheduled_payment_date || due.toISOString().split('T')[0],
            kilogramos: lot.total_kg_received || lot.total_kg_cut || 0,
            monto_estimado: (lot.total_kg_received || 0) * (lot.fruit_price || 18), // fallback average MXN
            semaforo: daysLeft < 0 ? 'rojo' : (daysLeft <= 13 ? 'amarillo' : 'verde')
          });
        }
      });
      setFrutaProxima(alertList.slice(0, 12));
    } catch (e) {
      setFrutaProxima([]);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await fetch('/api/corporate-holidays?active=true');
      const data = await res.json();
      setHolidays(Array.isArray(data) ? data : []);
    } catch { setHolidays([]); }
  };

  const addHoliday = async () => {
    if (!newHoliday.holiday_date) return;
    try {
      await fetch('/api/corporate-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newHoliday, created_by: 'super-admin' })
      });
      setNewHoliday({ year: new Date().getFullYear(), holiday_date: '', description: '' });
      fetchHolidays();
    } catch {}
  };

  const toggleHoliday = async (h) => {
    try {
      await fetch('/api/corporate-holidays', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, is_active: !h.is_active })
      });
      fetchHolidays();
    } catch {}
  };

  const removeHoliday = async (id) => {
    if (!confirm('Eliminar festivo?')) return;
    try {
      await fetch(`/api/corporate-holidays?id=${id}`, { method: 'DELETE' });
      fetchHolidays();
    } catch {}
  };

  const resetForm = () => {
    setForm({
      producer_name: '', beneficiary_name: '', bank_name: '', account_number: '', clabe: '',
      concept: '', amount: '', fruit_reception_date: new Date().toISOString().split('T')[0],
      payment_days: 22, priority: 'normal', observations: '', cutting_order_id: ''
    });
    setEditingPayment(null);
    setDatePreview(null);
  };

  const openNew = () => {
    resetForm();
    setAiExtracted(null);
    setAiDocumentUrl(null);
    setShowModal(true);
  };

  const openEdit = (payment) => {
    setEditingPayment(payment);
    setAiExtracted(null);
    setAiDocumentUrl(null);
    setForm({
      producer_name: payment.producer_name || '',
      beneficiary_name: payment.beneficiary_name || '',
      bank_name: payment.bank_name || '',
      account_number: payment.account_number || '',
      clabe: payment.clabe || '',
      concept: payment.concept || '',
      amount: payment.amount || '',
      fruit_reception_date: payment.fruit_reception_date ? payment.fruit_reception_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_days: Number(payment.payment_days) || 22,
      priority: payment.priority || 'normal',
      observations: payment.observations || '',
      cutting_order_id: payment.cutting_order_id ? String(payment.cutting_order_id) : ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setAiExtracted(null);
    setAiDocumentUrl(null);
    resetForm();
  };

  // AI DOCUMENT EXTRACTION FLOW
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiUploading(true);
    setAiExtracted(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await up.json();
      if (upData.url) {
        setAiDocumentUrl(upData.url);
        const ext = await fetch('/api/payment-schedule/ai-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_url: upData.url, document_type: file.type.includes('pdf') ? 'pdf' : 'image' })
        });
        const extractedResp = await ext.json();
        if (extractedResp.extracted) {
          setAiExtracted(extractedResp.extracted);
          setShowAiPanel(true);
        }
      }
    } catch (err) {
      alert('Error al subir o extraer documento. Ingresa los datos manualmente.');
    } finally {
      setAiUploading(false);
    }
  };

  const applyExtractedToForm = () => {
    if (!aiExtracted) return;
    setForm(prev => ({
      ...prev,
      producer_name: aiExtracted.producer_name || prev.producer_name,
      beneficiary_name: aiExtracted.beneficiary_name || prev.beneficiary_name,
      bank_name: aiExtracted.bank_name || prev.bank_name,
      clabe: aiExtracted.clabe || prev.clabe,
      account_number: aiExtracted.account_number || prev.account_number,
      amount: aiExtracted.amount ? String(aiExtracted.amount) : prev.amount,
      concept: aiExtracted.concept || prev.concept,
      fruit_reception_date: aiExtracted.document_date || prev.fruit_reception_date,
    }));
    setShowAiPanel(false);
  };

  const savePayment = async () => {
    if (!form.producer_name || !form.beneficiary_name || !form.concept || !form.amount || !form.fruit_reception_date) {
      alert('Completa productor, beneficiario, concepto, monto y fecha de recepción');
      return;
    }
    try {
      const payload = { ...form, amount: parseFloat(form.amount), cutting_order_id: form.cutting_order_id ? parseInt(form.cutting_order_id) : null, bank_account_id: form.bank_account_id || null };
      let res;
      if (editingPayment) {
        res = await fetch('/api/payment-schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPayment.id, ...payload, updated_by: isSuperAdmin ? 'super-admin' : 'admin-egreso', audit_reason: 'Modificación desde módulo Programación de Pagos' })
        });
      } else {
        res = await fetch('/api/payment-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        await fetchPayments();
        await fetchStats();
        await fetchFrutaAlerts();
        closeModal();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const deletePayment = async (id) => {
    if (!confirm('¿Eliminar este pago programado?')) return;
    try {
      const res = await fetch(`/api/payment-schedule?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPayments();
        await fetchStats();
        await fetchFrutaAlerts();
      }
    } catch (e) {}
  };

  const markAsPaid = async (payment) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/payment-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payment.id, status: 'paid', paid_at: todayStr, paid_by: isSuperAdmin ? 'super-admin' : 'admin', monto_pagado: payment.amount, fecha_liquidacion: todayStr })
      });
      if (res.ok) {
        await fetchPayments();
        await fetchStats();
      }
    } catch (e) {}
  };

  const registrarParcial = async (payment) => {
    const montoStr = prompt('Monto abonado (parcial):', '0');
    if (montoStr === null) return;
    const monto = parseFloat(montoStr);
    if (!monto || monto <= 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const nuevoPagado = (parseFloat(payment.monto_pagado || 0) + monto);
    try {
      const res = await fetch('/api/payment-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payment.id,
          monto_pagado: nuevoPagado,
          paid_at: todayStr,
          autorizado_por: isSuperAdmin ? 'super-admin' : 'admin',
          updated_by: isSuperAdmin ? 'super-admin' : 'admin',
          audit_reason: 'Pago parcial registrado - días de retraso continúan sobre saldo'
        })
      });
      if (res.ok) {
        await fetchPayments();
        await fetchStats();
      }
    } catch (e) {}
  };

  const getComputedStatus = (payment) => {
    if (payment.status === 'paid') return 'paid';
    if (payment.status === 'partial') return 'partial';
    const today = new Date();
    let due = null;
    try { due = payment.due_date ? new Date(payment.due_date) : null; } catch(e){}
    if (!due || isNaN(due.getTime())) return 'scheduled';
    const daysUntilDue = Math.floor((Number(due.getTime()) - Number(today.getTime())) / (1000 * 3600 * 24));
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 13) return 'urgent';
    return 'scheduled';
  };

  const getStatusSemaforo = (daysLeft) => {
    if (daysLeft < 0) return 'bg-red-50 text-red-700 border-red-200';
    if (daysLeft <= 13) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getStatusBadge = (payment) => {
    if (payment.status === 'paid' || (payment.saldo_pendiente || 0) <= 0) {
      return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />Liquidado</span>;
    }
    if (payment.status === 'partial') {
      return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex items-center gap-1">Parcial</span>;
    }
    const st = getComputedStatus(payment);
    if (st === 'overdue') {
      return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" />Vencido</span>;
    }
    if (st === 'urgent') {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Próximo</span>;
    }
    return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full flex items-center gap-1"><Clock className="w-3 h-3" />Programado</span>;
  };

  const filteredPayments = payments.filter(payment => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      payment.producer_name?.toLowerCase().includes(term) ||
      payment.beneficiary_name?.toLowerCase().includes(term) ||
      payment.folio?.toLowerCase().includes(term) ||
      payment.concept?.toLowerCase().includes(term);
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'urgent') return getComputedStatus(payment) === 'urgent' || getComputedStatus(payment) === 'overdue';
    if (filter === 'paid') return payment.status === 'paid';
    if (filter === 'partial') return payment.status === 'partial';
    if (filter === 'overdue') return getComputedStatus(payment) === 'overdue';
    if (filter === 'scheduled') return getComputedStatus(payment) === 'scheduled';
    return true;
  });

  // Simple Friday only calendar based on stats.calendar_data
  const monthCalendar = (stats && stats.calendar_data) || [];

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando programación de pagos...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-700 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Programación de Pagos</h1>
                <p className="text-sm text-gray-500">Administración • Integrado con Acopio, Contabilidad y Tesorería • Pagos únicamente viernes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={openNew} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow text-sm font-medium">
                <Plus className="w-4 h-4" /> Programar Pago
              </button>
            </div>
          </div>
        </div>

        {/* INDICADORES DEL DASHBOARD DE PAGOS (spec) */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Pagos programados semana</div><div className="text-xl font-bold mt-1 text-emerald-700">${(stats.weekly_scheduled||0).toLocaleString('es-MX')}</div></div>
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Pagos programados mes</div><div className="text-xl font-bold mt-1">${(stats.monthly_scheduled||0).toLocaleString('es-MX')}</div></div>
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Productores pendientes</div><div className="text-xl font-bold mt-1">{stats.pending_producers||0}</div></div>
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Fruta próxima a pagar</div><div className="text-xl font-bold mt-1">{frutaProxima.length} lotes • 13 días o menos</div></div>
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Pasivos acumulados</div><div className="text-xl font-bold text-red-600 mt-1">${(stats.total_liabilities||0).toLocaleString('es-MX')}</div></div>
            <div className="bg-white rounded-xl p-4 shadow border"><div className="text-xs text-gray-500">Pagos vencidos</div><div className="text-xl font-bold text-red-700 mt-1">${(stats.overdue_amount||0).toLocaleString('es-MX')}</div></div>
          </div>
        )}

        {/* ALERTA PRIORITARIA: Fruta próxima a programación de pago */}
        <div className="bg-white rounded-2xl shadow border mb-6 overflow-hidden">
          <div className="px-6 py-3 bg-amber-50 border-b flex gap-2 items-center font-medium">
            <AlertTriangle className="text-amber-600" /> Fruta próxima a programación de pago (13 días o menos)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Productor</th><th className="px-4 py-2">Huerta</th><th className="px-4 py-2">Lote</th><th className="px-4 py-2">Ingreso</th><th className="px-4 py-2">Días pactados</th><th className="px-4 py-2">Vencimiento Contractual</th><th className="px-4 py-2">Programado Viernes</th><th className="px-4 py-2">Kg</th><th className="px-4 py-2">Monto est.</th><th className="px-4 py-2">Semáforo</th>
              </tr></thead>
              <tbody>
                {frutaProxima.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Sin fruta próxima a vencer (13 días o menos)</td></tr>}
                {frutaProxima.map((f, i) => {
                  const d1 = new Date(f.fecha_vencimiento).getTime();
                  const d2 = new Date().getTime();
                  const daysLeft = Math.floor((Number(d1) - Number(d2)) / 86400000);
                  return (
                    <tr key={i} className="border-t hover:bg-amber-50">
                      <td className="px-4 py-2.5 font-medium">{f.producer}</td>
                      <td className="px-4 py-2.5">{f.huerta}</td>
                      <td className="px-4 py-2.5 font-mono text-[#334155]">{f.lote}</td>
                      <td className="px-4 py-2.5">{f.fecha_ingreso ? new Date(f.fecha_ingreso).toLocaleDateString('es-MX') : '—'}</td>
                      <td className="px-4 py-2.5 text-center">{f.dias_pactados}</td>
                      <td className="px-4 py-2.5">{new Date(f.fecha_vencimiento).toLocaleDateString('es-MX')}</td>
                      <td className="px-4 py-2.5 text-emerald-700 font-semibold">{new Date(f.fecha_programada).toLocaleDateString('es-MX')}</td>
                      <td className="px-4 py-2.5">{Number(f.kilogramos).toLocaleString('es-MX')}</td>
                      <td className="px-4 py-2.5 font-semibold">${Number(f.monto_estimado).toLocaleString('es-MX')}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] border inline-block ${getStatusSemaforo(daysLeft)}`}>{daysLeft < 0 ? 'VENCIDA' : `${daysLeft} días`}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-1 text-[11px] bg-gray-50 flex justify-end text-amber-700">Semáforo: verde más de 13 días • amarillo 13 días o menos • rojo vencida. Solo viernes.</div>
        </div>

        {/* AI EXTRACTION: Subir documentación contable (facturas / edo cuenta / solicitudes) */}
        <div className="mb-6 bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold flex items-center gap-2"><Upload className="text-emerald-600"/> Extracción automática con IA (Contabilidad / Tesorería)</div>
            <button onClick={() => setShowAiPanel(!showAiPanel)} className="text-xs underline text-emerald-700">Mostrar panel de carga</button>
          </div>
          <p className="text-xs mb-3 text-gray-600">Al subir el documento (PDF o foto), la IA detecta automáticamente beneficiario, productor, banco, CLABE, monto, factura y RFC. Verifica siempre antes de guardar. <strong>Regla: Pago solo viernes.</strong></p>

          {showAiPanel && (
            <div className="bg-zinc-50 border rounded-xl p-5 mb-2">
              <label className="block text-sm font-medium mb-2">Sube factura, estado de cuenta o solicitud de pago</label>
              <input type="file" onChange={handleDocumentUpload} accept="image/*,.pdf" disabled={aiUploading} className="block mb-3" />
              {aiUploading && <div className="text-emerald-600 text-sm mb-2">Procesando documento con AppGen Cloud IA...</div>}
              
              {aiExtracted && (
                <div className="bg-white rounded border p-4 space-y-3 text-xs">
                  <div className="font-semibold flex items-center gap-2"><Eye /> Datos detectados — <span className="text-amber-700 text-[11px]">VERIFICA ANTES DE PROGRAMAR</span></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
                    {Object.entries(aiExtracted).map(([k,v]) => <div key={k}><span className="text-slate-600 capitalize">{k.replace(/_/g,' ')}:</span> <span className="font-medium">{String(v ?? '—')}</span></div>)}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={applyExtractedToForm} className="bg-emerald-600 px-4 rounded py-1 text-white text-sm" disabled={!aiExtracted}>Usar estos datos en el formulario</button>
                    <button onClick={() => { setAiExtracted(null); setAiDocumentUrl(null); }} className="border px-4 rounded py-1 text-sm">Descartar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CATÁLOGO DE FESTIVOS - Administrable por Superadministrador (Bloque 19) */}
        {isSuperAdmin && (
          <div className="mb-6 bg-white rounded-2xl border p-4">
            <button onClick={() => setShowHolidays(!showHolidays)} className="text-sm font-semibold flex items-center gap-2 mb-2">
              📅 Calendario de Festivos Corporativos (para ajuste de viernes) {showHolidays ? '−' : '+'}
            </button>
            {showHolidays && (
              <div className="text-xs">
                <div className="flex gap-2 mb-2">
                  <input type="number" value={newHoliday.year} onChange={e=>setNewHoliday({...newHoliday, year: parseInt(e.target.value)||new Date().getFullYear()})} className="border px-2 py-1 w-20 rounded" />
                  <input type="date" value={newHoliday.holiday_date} onChange={e=>setNewHoliday({...newHoliday, holiday_date: e.target.value})} className="border px-2 py-1 rounded" />
                  <input placeholder="Descripción (ej. Viernes Santo)" value={newHoliday.description} onChange={e=>setNewHoliday({...newHoliday, description: e.target.value})} className="border px-2 py-1 flex-1 rounded" />
                  <button onClick={addHoliday} className="px-3 bg-emerald-600 text-white rounded">Agregar</button>
                </div>
                <div className="max-h-28 overflow-auto border rounded p-2 bg-gray-50">
                  {holidays.length === 0 && <span className="text-gray-400">Sin festivos registrados. Agregue fechas para que el algoritmo las respete.</span>}
                  {holidays.map(h => (
                    <div key={h.id} className="flex items-center justify-between py-0.5">
                      <span>{h.holiday_date} — {h.description || 'Festivo'} ({h.year})</span>
                      <span className="flex gap-1">
                        <button onClick={() => toggleHoliday(h)} className="text-[10px] underline">{h.is_active ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={() => removeHoliday(h.id)} className="text-red-600">×</button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Los viernes calculados que caigan en festivo se mueven al siguiente viernes no festivo. Zona America/Mexico_City.</div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4 mb-6 flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar productor, beneficiario, folio o concepto" className="pl-9 w-full border rounded-lg py-2 text-sm" />
          </div>
          <div className="flex gap-1 text-sm">
            {['all','urgent','scheduled','partial','paid','overdue'].map(v => (
              <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1 rounded ${filter===v ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>{v.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={openNew} className="bg-white text-emerald-600 border border-emerald-600 px-4 py-1 rounded text-sm flex gap-1.5 items-center"><Plus size={15}/> Nuevo</button>
        </div>

        {/* MAIN PAYMENT TABLE */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr className="uppercase text-[10px] text-gray-500 tracking-wider">
              <th className="p-4 text-left">Folio</th>
              <th className="p-4 text-left">Productor / Beneficiario</th>
              <th className="p-4 text-left">Banco / CLABE</th>
              <th className="p-4">Venc. Contractual</th>
              <th className="p-4">Programado Viernes</th>
              <th className="p-4 text-right">Monto</th>
              <th className="p-4 text-center">Días retraso hábiles</th>
              <th className="p-4 text-right">Saldo pendiente</th>
              <th className="p-4">Estado</th>
              <th className="p-4 w-36">Acciones</th>
            </tr></thead>
            <tbody className="divide-y text-sm">
              {filteredPayments.length === 0 && <tr><td className="p-10 text-center text-gray-400" colSpan="8">No hay registros que coincidan</td></tr>}
              {filteredPayments.map(p => {
                const st = getComputedStatus(p);
                const diasRet = (p.dias_retraso_habiles != null ? p.dias_retraso_habiles : 0);
                const saldo = (p.saldo_pendiente != null ? p.saldo_pendiente : Math.max(0, parseFloat(p.amount||0) - parseFloat(p.monto_pagado||0)));
                return <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono font-semibold">{p.folio}</td>
                  <td className="p-4">
                    <div>{p.producer_name}</div>
                    <div className="text-xs text-emerald-800">{p.beneficiary_name}</div>
                    <div className="text-[10px] text-gray-500 truncate max-w-[220px]">{p.concept}</div>
                  </td>
                  <td className="p-4 text-xs">{p.bank_name}<br />{p.clabe}</td>
                  <td className="p-4 text-xs">
                    {p.contractual_due_date || p.due_date ? new Date(p.contractual_due_date || p.due_date).toLocaleDateString('es-MX') : '—'}
                    {p.adjustment_reason && <div className="text-[10px] text-amber-600">{p.adjustment_reason}</div>}
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-emerald-700">{p.scheduled_payment_date ? new Date(p.scheduled_payment_date).toLocaleDateString('es-MX', {weekday:'short'}) : ''}</span><br />
                    <span className="text-xs">{p.scheduled_payment_date ? new Date(p.scheduled_payment_date).toLocaleDateString('es-MX') : '—'}</span>
                    {(p.original_friday && p.original_friday !== p.scheduled_payment_date) && <div className="text-[10px] text-amber-600">orig: {new Date(p.original_friday).toLocaleDateString('es-MX')}</div>}
                  </td>
                  <td className="p-4 text-right font-medium">${parseFloat(p.amount || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded ${diasRet > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{diasRet}</span>
                    {p.contractual_due_date && p.scheduled_payment_date && p.contractual_due_date !== p.scheduled_payment_date && <div className="text-[9px] text-gray-500">vs contractual</div>}
                  </td>
                  <td className="p-4 text-right font-medium text-amber-700">${saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                  <td className="p-4">{getStatusBadge(p)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.status !== 'paid' && <button className="text-xs bg-emerald-700 text-white px-2 py-px rounded" onClick={() => markAsPaid(p)}>Pagar</button>}
                      {p.status !== 'paid' && <button className="text-xs bg-amber-600 text-white px-2 py-px rounded" onClick={() => registrarParcial(p)}>Parcial</button>}
                      <button onClick={() => openEdit(p)}><Edit size={15} className="text-blue-700" /></button>
                      <button onClick={() => deletePayment(p.id)}><Trash2 size={15} className="text-red-700" /></button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        {/* CALENDARIO DE PAGOS — VIERNES ÚNICAMENTE */}
        <div className="bg-white border rounded-2xl p-6 text-sm mb-6">
          <div className="font-semibold mb-3 flex items-center gap-2"><Calendar /> Calendario de Pagos (solo viernes) — Mes {calendarMonth}/{calendarYear}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {monthCalendar.length === 0 && <div className="text-xs text-gray-400 py-3">No hay pagos programados en este mes (selecciona en filtros).</div>}
            {monthCalendar.map((row, i) => (
              <div key={i} className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="font-semibold text-emerald-700">{new Date(`${row.scheduled_payment_date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', month:'short', day:'numeric' })}</div>
                <div className="text-sm mt-0.5">{row.payment_count} pagos • ${parseFloat(row.total_amount||0).toLocaleString('es-MX')}</div>
                <div className="text-[11px] text-emerald-800 mt-1">Productores: {(row.producers||[]).slice(0,3).join(', ')}{(row.producers||[]).length>3?'…':''}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-3">Los pagos vencidos automáticamente se desfasa al viernes más cercano para su liberación. La programación administrativa del viernes NO sustituye la obligación contractual original (fecha de corte + plazo pactado en días naturales). Cuando difieran, se muestran ambos campos para evaluación legal/financiera.</div>
        </div>

        {/* FINALES DE MODAL + AYUDA PERMISOS */}
        <div className="text-[11px] text-gray-500 px-1">Permisos: Contabilidad sube documentos y registra. Encargado Administración programa / modifica / reagenda. Superadministrador autoriza y libera.</div>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden">
          <div className="flex justify-between border-b px-6 py-4">
            <div className="font-bold text-lg">{editingPayment ? 'Editar' : 'Programar'} Pago a Productor / Proveedor</div>
            <button onClick={closeModal} className="text-3xl leading-none">×</button>
          </div>
          <div className="p-6 space-y-3 grid md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div><label className="text-xs block mb-0.5">Productor *</label><input value={form.producer_name} onChange={e=>setForm({...form,producer_name:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div><label className="text-xs block mb-0.5">Beneficiario *</label><input value={form.beneficiary_name} onChange={e=>setForm({...form,beneficiary_name:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div className="md:col-span-2"><label className="text-xs block mb-0.5">Concepto *</label><input value={form.concept} onChange={e=>setForm({...form,concept:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div><label className="text-xs block mb-0.5">Monto *</label><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div><label className="text-xs block mb-0.5">Fecha recepción / corte fruta *</label><input type="date" value={form.fruit_reception_date} onChange={e=>setForm({...form,fruit_reception_date:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div>
              <label className="text-xs block mb-0.5">Plazo pactado (días NATURALES) — default contrato 22/28</label>
              <div className="flex gap-2">
                <select value={form.payment_days} onChange={e=>setForm({...form, payment_days: parseInt(e.target.value)})} className="border px-2 py-1.5 rounded flex-1">
                  <option value={22}>22 días naturales</option>
                  <option value={28}>28 días naturales</option>
                  <option value={7}>7 (prueba)</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                </select>
                <input type="number" value={form.payment_days} onChange={e=>setForm({...form,payment_days:parseInt(e.target.value)||22})} className="w-20 border px-2 py-1.5 rounded" />
              </div>
            </div>
            <div><label className="text-xs block mb-0.5">ID Orden de Corte (enlace único)</label><input type="number" placeholder="Opcional - ID de cutting_orders" value={String(form.cutting_order_id || '')} onChange={e=>setForm({...form,cutting_order_id:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div><label className="text-xs block mb-0.5">Banco</label><input value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})} className="w-full border px-3 py-1.5 rounded" /></div>
            <div><label className="text-xs block mb-0.5">CLABE / Cuenta (o selecciona de expediente del productor)</label><div className="flex gap-1.5"><input value={form.clabe} onChange={e=>setForm({...form,clabe:e.target.value})} placeholder="CLABE" className="flex-1 border px-3 py-1.5 rounded"/><input value={form.account_number} onChange={e=>setForm({...form,account_number:e.target.value})} placeholder="Cuenta" className="flex-1 border px-3 py-1.5 rounded" /></div></div>
            <div className="md:col-span-2"><label className="text-xs block mb-0.5">Vincular a cuenta verificada del productor (recomendado)</label>
              <select value={form.bank_account_id || ''} onChange={e=>setForm({...form, bank_account_id: e.target.value ? parseInt(e.target.value) : null})} className="border px-3 py-1.5 rounded w-full">
                <option value="">Usar datos manuales arriba</option>
                {customerBanks.map(b => <option key={b.id} value={b.id}>{b.bank_name} • {b.is_primary ? 'Principal' : ''} • {b.titular || ''}</option>)}
              </select>
            </div>
            <div><label className="text-xs block mb-0.5">Prioridad</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} className="w-full border px-3 py-1.5 rounded"><option value="normal">Normal</option><option value="urgent">Urgente</option></select></div>
            <div className="md:col-span-2">
              <label className="text-xs block mb-0.5">Observaciones</label>
              <textarea className="w-full border px-3 py-1.5 rounded" rows={2} value={form.observations} onChange={e=>setForm({...form,observations:e.target.value})} />
            </div>
            <div className="md:col-span-2 text-[11px] bg-emerald-50 border border-emerald-100 rounded p-2">
              Vista previa (se recalcula en servidor con festivos): <strong>Vencimiento Contractual</strong> = fecha corte + plazo natural. <strong>Programado Viernes</strong> según algoritmo A/B/C. Si difieren se advierte para evaluación.
              {form.fruit_reception_date && form.payment_days && <span className="ml-2 text-emerald-700">(Usando {form.payment_days} días desde {form.fruit_reception_date})</span>}
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 text-sm flex justify-end gap-3">
            <button className="px-4" onClick={closeModal}>Cancelar</button>
            <button onClick={savePayment} className="px-6 bg-emerald-700 text-white font-medium rounded py-1">Guardar (se moverá a viernes si corresponde)</button>
          </div>
          <div className="px-6 py-1.5 text-xs bg-emerald-50 border-t">Algoritmo V3: contractual = corte + plazo natural. Viernes según reglas A/B + festivos. Si captura tardía ya vencida, se muestra obligación vencida (no se mueve silenciosamente). Historial preservado.</div>
        </div>
      </div> }
    </div>
  );
}
