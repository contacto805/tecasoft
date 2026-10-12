'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { drawCompanyHeader } from '@/lib/company-header';
import * as XLSX from 'xlsx';

const fmt = (n) =>
  `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getWeekBounds(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

const EMPTY_FORM = {
  weekStartDate: '',
  weekEndDate: '',
  weekLabel: '',
  // Ingresos - dinero
  totalCargasDinero: '',
  totalVentasDesechoDinero: '',
  totalVentasProcesoDinero: '',
  valorInventarioMateriales: '',
  bancos: '',
  efectivoDisponible: '',
  // Inventario tarimas por calibre (se llenará dinámicamente)
  inventarioTarimas: {},
  // Egresos - dinero
  totalGastos: '',
  totalEntradasFrutaDinero: '',
  totalCuadrillaDinero: '',
  totalBrokerNotes: '',
  nominaSemanal: '',
  porcentajeRenta: '15000',
  porcentajeLuz: '10000',
  totalFletes: '',
  // Ingreso de Fruta detalle (por lote automático)
  ingresoFrutaDetalle: [],
  // Cargas (Embarques / Notas de Venta) detalle automatica
  cargasDetalle: [],
  // KG
  totalCargasKg: '',
  totalCuadrillaKg: '',
  totalEntradasFrutaKg: '',
  totalDesechoKg: '',
  totalProcesoKg: '',
  notes: '',
  status: 'abierto',
  recordedBy: '',
  approvedBy: '',
};

export default function CierresPage() {
  const router = useRouter();
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => { fetchClosings(); }, []);

  const fetchClosings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/weekly-closings');
      const data = await res.json();
      setClosings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    const { start, end } = getWeekBounds(0);
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      weekStartDate: start,
      weekEndDate: end,
      weekLabel: `Semana ${start}`,
      inventarioTarimas: {},
      ingresoFrutaDetalle: [],
      cargasDetalle: [],
      recordedBy: '',
      approvedBy: '',
    });
    setShowForm(true);
    setSelected(null);
    setIsEditable(false);
    setTimeout(() => fetchRelatedModuleData(start, end), 10);
  };

  const openEdit = (c) => {
    setEditing(c);
    const invTarimas = {};
    try {
      if (c.inventario_tarimas) {
        const parsed = typeof c.inventario_tarimas === 'string' ? JSON.parse(c.inventario_tarimas) : c.inventario_tarimas;
        Object.assign(invTarimas, parsed);
      }
    } catch (e) {
      console.error('Error parsing inventario_tarimas:', e);
    }
    setForm({
      weekStartDate: c.week_start_date?.split('T')[0] || '',
      weekEndDate: c.week_end_date?.split('T')[0] || '',
      weekLabel: c.week_label || '',
      totalCargasDinero: c.total_cargas_dinero || '',
      totalVentasDesechoDinero: c.total_ventas_desecho_dinero || '',
      totalVentasProcesoDinero: c.total_ventas_proceso_dinero || '',
      valorInventarioMateriales: c.valor_inventario_materiales || '',
      bancos: c.bancos || '',
      efectivoDisponible: c.efectivo_disponible || '',
      inventarioTarimas: invTarimas,
      totalGastos: c.total_gastos || '',
      totalEntradasFrutaDinero: c.total_entradas_fruta_dinero || '',
      totalCuadrillaDinero: c.total_cuadrilla_dinero || '',
      totalBrokerNotes: c.total_broker_notes || '',
      nominaSemanal: c.nomina_semanal || '',
      porcentajeRenta: c.porcentaje_renta || '',
      porcentajeLuz: c.porcentaje_luz || '',
      totalCargasKg: c.total_cargas_kg || '',
      totalCuadrillaKg: c.total_cuadrilla_kg || '',
      totalEntradasFrutaKg: c.total_entradas_fruta_kg || '',
      totalDesechoKg: c.total_desecho_kg || '',
      totalProcesoKg: c.total_proceso_kg || '',
      notes: c.notes || '',
      status: c.status || 'abierto',
      recordedBy: c.recorded_by || '',
      approvedBy: c.approved_by || '',
      // Ingreso de fruta detalle por lote
      ingresoFrutaDetalle: (() => {
        try {
          if (!c.ingreso_fruta_detalle) return [];
          return typeof c.ingreso_fruta_detalle === 'string'
            ? JSON.parse(c.ingreso_fruta_detalle)
            : c.ingreso_fruta_detalle;
        } catch { return []; }
      })(),
      // Cargas (embarques) detalle por nota de venta
      cargasDetalle: (() => {
        try {
          if (!c.cargas_detalle) return [];
          return typeof c.cargas_detalle === 'string'
            ? JSON.parse(c.cargas_detalle)
            : c.cargas_detalle;
        } catch { return []; }
      })(),
    });
    setShowForm(true);
    setSelected(null);
    setIsEditable(false);
  };

  const fetchRelatedModuleData = async (startOverride = null, endOverride = null) => {
    const start = startOverride || form.weekStartDate;
    const end = endOverride || form.weekEndDate;
    if (!start || !end) return;
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/weekly-closings?summary=true&startDate=${start}&endDate=${end}`
      );
      const data = await res.json();
      const detalle = Array.isArray(data.ingreso_fruta_detalle) ? data.ingreso_fruta_detalle : [];
      const cargasDet = Array.isArray(data.cargas_detalle) ? data.cargas_detalle : [];
      // recalcular totales desde detalle si existe
      let autoKg = parseFloat(data.total_entradas_fruta_kg) || 0;
      let autoDin = parseFloat(data.total_entradas_fruta_dinero) || 0;
      if (detalle.length > 0) {
        autoKg = detalle.reduce((s, r) => s + (parseFloat(r.kg) || 0), 0);
        autoDin = detalle.reduce((s, r) => s + (parseFloat(r.dinero) || 0), 0);
      }
      // recalcular cargas desde detalle embarques si existe
      let cargasKgCalc = parseFloat(data.total_cargas_kg) || 0;
      let cargasDinCalc = parseFloat(data.total_cargas_dinero) || 0;
      if (cargasDet.length > 0) {
        cargasKgCalc = cargasDet.reduce((s, r) => s + (parseFloat(r.kg) || 0), 0);
        cargasDinCalc = cargasDet.reduce((s, r) => s + (parseFloat(r.dinero) || 0), 0);
      }
      setForm((f) => ({
        ...f,
        // Solo sobrescribir campos automáticos del sistema; preservar manuales (bancos, efectivo, porcentajes, notas, recorded)
        totalCargasDinero: cargasDinCalc.toFixed(2),
        totalVentasDesechoDinero: data.total_ventas_desecho_dinero?.toFixed(2) || '0',
        totalVentasProcesoDinero: data.total_ventas_proceso_dinero?.toFixed(2) || '0',
        valorInventarioMateriales: data.valor_inventario_materiales?.toFixed(2) || '0',
        inventarioTarimas: data.inventario_tarimas_por_calibre || {},
        totalGastos: data.total_gastos?.toFixed(2) || '0',
        totalEntradasFrutaDinero: autoDin.toFixed(2),
        totalCuadrillaDinero: data.total_cuadrilla_dinero?.toFixed(2) || '0',
        totalBrokerNotes: data.total_broker_notes?.toFixed(2) || '0',
        totalFletes: data.total_fletes_dinero?.toFixed(2) || '0',
        nominaSemanal: (data.nomina_semanal || data.nominaSemanal || 0).toFixed(2),
        totalCargasKg: cargasKgCalc.toFixed(2),
        totalCuadrillaKg: data.total_cuadrilla_kg?.toFixed(2) || '0',
        totalEntradasFrutaKg: autoKg.toFixed(2),
        totalDesechoKg: data.total_desecho_kg?.toFixed(2) || '0',
        totalProcesoKg: data.total_proceso_kg?.toFixed(2) || '0',
        // Auto detalles
        ingresoFrutaDetalle: detalle,
        cargasDetalle: cargasDet,
      }));
      setIsEditable(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await fetch('/api/weekly-closings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        fetchClosings();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Lógica de flujo de cierre (senior): estados completos + acciones rápidas
  const quickStatusChange = async (newStatus) => {
    if (!editing) return;
    const body = { ...form, id: editing.id, status: newStatus };
    try {
      await fetch('/api/weekly-closings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForm(f => ({ ...f, status: newStatus }));
      fetchClosings();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cierre?')) return;
    await fetch(`/api/weekly-closings?id=${id}`, { method: 'DELETE' });
    fetchClosings();
    if (selected?.id === id) setSelected(null);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Two-level approval workflow actions (senior logic)
  const performApprovalAction = async (action) => {
    if (!editing && !form.weekStartDate) return;
    const targetId = editing?.id;
    if (!targetId) {
      // If creating new, save first then approve
      await handleSave();
      return;
    }
    const payload = {
      id: targetId,
      action,
      status: form.status,
      recordedBy: form.recordedBy || null,
      approvedBy: action === 'aprobar' ? (form.approvedBy || 'admin-general') : form.approvedBy || null,
      notes: form.notes,
    };
    try {
      const res = await fetch('/api/weekly-closings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setForm((f) => ({ ...f, status: updated.status, approvedBy: updated.approved_by || f.approvedBy }));
        fetchClosings();
        alert(action === 'aprobar' ? 'Cierre aprobado por segundo admin.' : 'Estado actualizado.');
      }
    } catch (e) { console.error(e); }
  };

  const setInventarioTarimaCalibre = (caliber, value) => {
    setForm(f => ({
      ...f,
      inventarioTarimas: { ...f.inventarioTarimas, [caliber]: value }
    }));
  };

  // Calculated totals from form
  const totalIngresosDinero =
    (parseFloat(form.totalCargasDinero) || 0) +
    (parseFloat(form.totalVentasDesechoDinero) || 0) +
    (parseFloat(form.totalVentasProcesoDinero) || 0) +
    (parseFloat(form.valorInventarioMateriales) || 0) +
    (parseFloat(form.bancos) || 0);

  const totalEgresosDinero =
    (parseFloat(form.totalEntradasFrutaDinero) || 0) +
    (parseFloat(form.totalGastos) || 0) +
    (parseFloat(form.totalCuadrillaDinero) || 0) +
    (parseFloat(form.totalBrokerNotes) || 0) +
    (parseFloat(form.nominaSemanal) || 0) +
    (parseFloat(form.totalFletes) || 0) +
    (parseFloat(form.porcentajeRenta) || 0) +
    (parseFloat(form.porcentajeLuz) || 0);

  const resultadoDinero = totalIngresosDinero - totalEgresosDinero;
  const totalIngresosKg = (parseFloat(form.totalCargasKg) || 0);

  const totalEgresosKg =
    (parseFloat(form.totalCuadrillaKg) || 0) +
    (parseFloat(form.totalDesechoKg) || 0) +
    (parseFloat(form.totalProcesoKg) || 0);

  // Kg de la semana: Entrada - (Proceso + Desecho + Inventario + Venta Empacado)
  const kgDeLaSemana = 
    (parseFloat(form.totalEntradasFrutaKg) || 0) - 
    (parseFloat(form.totalProcesoKg) || 0) - 
    (parseFloat(form.totalDesechoKg) || 0) - 
    (Object.values(form.inventarioTarimas || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)) -
    (parseFloat(form.totalCargasKg) || 0);

  const resultadoKg = totalIngresosKg - totalEgresosKg;

  const esUtilidad = resultadoDinero >= 0;

  // Exportar PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = drawCompanyHeader(doc, { companyName: 'TECAVO FRUITS' }); // uses current branding if loaded
    doc.text('CIERRE SEMANAL', 14, y);
    doc.text('TECAVO FRUITS', 14, 15);
    doc.setFontSize(10);
    doc.text('RFC: TFR230302EU5', 14, 22);
    doc.setFontSize(16);
    doc.text('Cierre Semanal', 14, 32);
    doc.setFontSize(12);
    doc.text(`${form.weekLabel || 'Semana'}`, 14, 40);
    doc.text(`${form.weekStartDate} - ${form.weekEndDate}`, 14, 46);

    let yPos = 55;

    // INGRESOS
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 0);
    doc.text('INGRESOS', 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const ingresosData = [
      ['Proc. y Desecho (Dinero)', fmt(form.totalVentasProcesoDinero)],
      ['Inventario Materiales', fmt(form.valorInventarioMateriales)],
      ['Bancos', fmt(form.bancos)],
      ['Cargas (Dinero)', fmt(form.totalCargasDinero)],
      ['Cargas (KG)', form.totalCargasKg || '0'],
      ['TOTAL INGRESOS', fmt(totalIngresosDinero)],
    ];
    doc.autoTable({
      startY: yPos,
      head: [],
      body: ingresosData,
      theme: 'grid',
      margin: { left: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // EGRESOS
    doc.setFontSize(14);
    doc.setTextColor(128, 0, 0);
    doc.text('EGRESOS', 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const egresosData = [
      ['Cuadrillas (KG cortados)', form.totalCuadrillaKg || '0'],
      ['Cuadrillas (Dinero)', fmt(form.totalCuadrillaDinero)],
      ['Monto de Fletes', fmt(form.totalFletes)],
      ['Gastos', fmt(form.totalGastos)],
      ['Nómina', fmt(form.nominaSemanal)],
      ['Luz y Renta', fmt((parseFloat(form.porcentajeLuz) || 0) + (parseFloat(form.porcentajeRenta) || 0))],
      ['Ingreso Fruta (KG)', form.totalEntradasFrutaKg || '0'],
      ['Ingreso Fruta (Dinero)', fmt(form.totalEntradasFrutaDinero)],
      ['TOTAL EGRESOS', fmt(totalEgresosDinero)],
    ];
    doc.autoTable({
      startY: yPos,
      head: [],
      body: egresosData,
      theme: 'grid',
      margin: { left: 14 }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // RESULTADOS
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 128);
    doc.text('RESULTADOS', 14, yPos);
    yPos += 8;
    const resultadosData = [
      ['Kg de la Semana', kgDeLaSemana.toFixed(2)],
      ['Utilidad/Pérdida', fmt(resultadoDinero)],
    ];
    doc.autoTable({
      startY: yPos,
      head: [],
      body: resultadosData,
      theme: 'grid',
      margin: { left: 14 }
    });

    doc.save(`cierre_semanal_${form.weekStartDate}.pdf`);
  };

  // Exportar Excel
  const exportExcel = () => {
    const data = [
      ['CIERRE SEMANAL'],
      [form.weekLabel || 'Semana'],
      [`${form.weekStartDate} - ${form.weekEndDate}`],
      [],
      ['INGRESOS'],
      ['Concepto', 'Monto'],
      ['Proc. y Desecho (KG)', form.totalProcesoKg],
      ['Proc. y Desecho (Dinero)', form.totalVentasProcesoDinero],
      ['Inventario Materiales', form.valorInventarioMateriales],
      ['Bancos', form.bancos],
      ['Cargas (KG)', form.totalCargasKg],
      ['Cargas (Dinero)', form.totalCargasDinero],
      ['TOTAL INGRESOS', totalIngresosDinero],
      [],
      ['EGRESOS'],
      ['Concepto', 'Monto'],
      ['Cuadrillas (KG)', form.totalCuadrillaKg],
      ['Cuadrillas (Dinero)', form.totalCuadrillaDinero],
      ['Monto de Fletes', form.totalFletes],
      ['Gastos', form.totalGastos],
      ['Nómina', form.nominaSemanal],
      ['Luz', form.porcentajeLuz],
      ['Renta', form.porcentajeRenta],
      ['Ingreso Fruta (KG)', form.totalEntradasFrutaKg],
      ['Ingreso Fruta (Dinero)', form.totalEntradasFrutaDinero],
      ['TOTAL EGRESOS', totalEgresosDinero],
      [],
      [],
      ['RESULTADOS'],
      ['Kg de la Semana', kgDeLaSemana],
      ['Utilidad/Pérdida', resultadoDinero],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre Semanal');
    XLSX.writeFile(wb, `cierre_semanal_${form.weekStartDate}.xlsx`);
  };

  // Exportar CSV
  const exportCSV = () => {
    const data = [
      ['CIERRE SEMANAL'],
      [form.weekLabel || 'Semana'],
      [`${form.weekStartDate} - ${form.weekEndDate}`],
      [],
      ['INGRESOS'],
      ['Concepto', 'Monto'],
      ['Proc. y Desecho (KG)', form.totalProcesoKg],
      ['Proc. y Desecho (Dinero)', form.totalVentasProcesoDinero],
      ['Inventario Materiales', form.valorInventarioMateriales],
      ['Bancos', form.bancos],
      ['Cargas (KG)', form.totalCargasKg],
      ['Cargas (Dinero)', form.totalCargasDinero],
      ['TOTAL INGRESOS', totalIngresosDinero],
      [],
      ['EGRESOS'],
      ['Concepto', 'Monto'],
      ['Cuadrillas (KG)', form.totalCuadrillaKg],
      ['Cuadrillas (Dinero)', form.totalCuadrillaDinero],
      ['Monto de Fletes', form.totalFletes],
      ['Gastos', form.totalGastos],
      ['Nómina', form.nominaSemanal],
      ['Luz', form.porcentajeLuz],
      ['Renta', form.porcentajeRenta],
      ['Ingreso Fruta (KG)', form.totalEntradasFrutaKg],
      ['Ingreso Fruta (Dinero)', form.totalEntradasFrutaDinero],
      ['TOTAL EGRESOS', totalEgresosDinero],
      [],
      [],
      ['RESULTADOS'],
      ['Kg de la Semana', kgDeLaSemana],
      ['Utilidad/Pérdida', resultadoDinero],
    ];

    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cierre_semanal_${form.weekStartDate}.csv`;
    link.click();
  };

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
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <i className="ph-fill ph-calculator text-xl text-emerald-600"></i>
              </div>
              <div>
                <h1 className="font-bold text-slate-900 leading-none">Cierres Semanales</h1>
                <p className="text-xs text-slate-500">Resumen financiero por semana</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin-general')}
              className="ml-2 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 text-slate-700"
            >
              <i className="ph ph-layout text-sm"></i>
              Dashboard del Grupo
            </button>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <i className="ph ph-plus-circle"></i>
            Nuevo Cierre
          </button>
        </div>
      </header>

      <main className="flex-1 pt-20 max-w-7xl mx-auto w-full px-4 py-8">

        {/* Closings List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando cierres...</div>
        ) : closings.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <i className="ph ph-calculator text-6xl mb-4"></i>
            <p className="text-lg font-medium">No hay cierres registrados</p>
            <p className="text-sm mt-1 mb-6">Crea el primer cierre semanal</p>
            <button
              onClick={openNew}
              className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Crear Cierre
            </button>
          </div>
        ) : (
          !showForm && (
            <div className="space-y-4">
              {closings.map((c) => {
                const utilidad = parseFloat(c.resultado_dinero || c.resultado || 0);
                const esUtil = utilidad >= 0;
                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    <div
                      className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${esUtil ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            <i className={`ph-fill ${esUtil ? 'ph-trend-up text-emerald-600' : 'ph-trend-down text-red-600'} text-2xl`}></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{c.week_label || `Semana ${c.week_start_date?.split('T')[0]}`}</p>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {new Date(c.week_start_date).toLocaleDateString('es-MX')} – {new Date(c.week_end_date).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500">Resultado</p>
                            <p className={`font-bold text-lg ${esUtil ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(utilidad)}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            c.status === 'cerrado' ? 'bg-slate-100 text-slate-600' : 
                            c.status === 'aprobado' ? 'bg-emerald-100 text-emerald-700' :
                            c.status === 'pendiente_aprobacion' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {c.status === 'cerrado' ? 'Cerrado' : c.status === 'aprobado' ? 'Aprobado' : c.status === 'pendiente_aprobacion' ? 'Pendiente Aprob.' : 'Abierto'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                              <i className="ph ph-pencil-simple"></i>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <i className="ph ph-trash"></i>
                            </button>
                          </div>
                          {(c.recorded_by || c.approved_by) && (
                            <div className="text-[10px] text-slate-500 text-right hidden md:block">
                              {c.recorded_by && <>Reg: {c.recorded_by}<br/></>}
                              {c.approved_by && <>Apr: {c.approved_by}</>}
                            </div>
                          )}
                          <i className={`ph ph-caret-down text-slate-400 transition-transform ${selected?.id === c.id ? 'rotate-180' : ''}`}></i>
                        </div>
                      </div>
                    </div>

                    {/* Detail panel */}
                    {selected?.id === c.id && (
                      <div className="border-t border-slate-100 p-6 bg-slate-50">
                        <div className="text-center mb-4">
                          <p className="text-sm text-slate-500 mb-1">RESULTADO DE LA SEMANA</p>
                          <p className={`text-4xl font-black ${esUtil ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(utilidad)}</p>
                          <p className={`text-lg font-bold mt-2 ${esUtil ? 'text-emerald-600' : 'text-red-600'}`}>
                            {esUtil ? '✓ UTILIDAD' : '✗ PÉRDIDA'}
                          </p>
                          {(c.recorded_by || c.approved_by) && (
                            <p className="text-xs mt-3 text-slate-500">
                              Registrado por: {c.recorded_by || '-'} • Aprobado por: {c.approved_by || '-'}
                            </p>
                          )}
                          <p className="text-xs mt-1 text-slate-400">Estado: {c.status}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            {/* Form Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">
                {editing ? 'Editar Cierre' : 'Nuevo Cierre Semanal'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <i className="ph ph-x text-lg"></i>
              </button>
            </div>
            {form.status === 'cerrado' && (
              <div className="mx-6 mt-4 p-3 bg-slate-100 text-slate-600 text-sm rounded-xl flex items-center gap-2">
                <i className="ph ph-lock text-base"></i>
                Este cierre está CERRADO. Los datos están bloqueados para preservar el registro contable. Reabre para editar.
              </div>
            )}

            <div className="p-6 space-y-8">
              {/* Periodo */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <i className="ph ph-calendar-blank text-brand-600"></i> Periodo de la Semana
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Inicio de semana</label>
                    <input type="date" value={form.weekStartDate} onChange={(e) => setField('weekStartDate', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Fin de semana</label>
                    <input type="date" value={form.weekEndDate} onChange={(e) => setField('weekEndDate', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Etiqueta de semana</label>
                    <input type="text" value={form.weekLabel} onChange={(e) => setField('weekLabel', e.target.value)}
                      placeholder="Ej. Semana 28" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                  </div>
                </div>
                <button
                  onClick={() => fetchRelatedModuleData()}
                  disabled={loadingData || !form.weekStartDate || !form.weekEndDate}
                  className="mt-4 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {loadingData ? <><i className="ph ph-spinner animate-spin"></i> Cargando...</> : <><i className="ph ph-arrows-clockwise"></i> Cargar datos del sistema</>}
                </button>
                <button
                  onClick={() => setIsEditable(!isEditable)}
                  className="mt-4 ml-3 px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                  <i className={`ph ph-${isEditable ? 'lock' : 'pencil-simple'}`}></i>
                  {isEditable ? 'Bloquear' : 'Editar valores'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* INGRESOS */}
                <div>
                  <h3 className="font-semibold text-emerald-700 mb-4 flex items-center gap-2 text-lg">
                    <i className="ph-fill ph-arrow-circle-up"></i> INGRESOS
                  </h3>
                  <div className="space-y-3">
                    {/* Proc y Desecho */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Proc. y Desecho</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">KG</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalProcesoKg}
                            onChange={(e) => setField('totalProcesoKg', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Dinero</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalVentasProcesoDinero}
                            onChange={(e) => setField('totalVentasProcesoDinero', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Inventarios - Tarimas por calibre */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Inventario Tarimas</p>
                      {Object.keys(form.inventarioTarimas).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(form.inventarioTarimas).map(([caliber, tarimas]) => (
                            <div key={caliber} className="flex items-center justify-between gap-2">
                              <label className="text-xs text-slate-600">{caliber}</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="1"
                                  value={tarimas}
                                  onChange={(e) => setInventarioTarimaCalibre(caliber, e.target.value)}
                                  disabled={!isEditable}
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-sm"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Precio"
                                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-sm"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Cargar datos del sistema para ver calibres</p>
                      )}
                    </div>

                    {/* Materiales */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Valor Inventario Materiales</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.valorInventarioMateriales}
                        onChange={(e) => setField('valorInventarioMateriales', e.target.value)}
                        disabled={!isEditable}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>

                    {/* Bancos */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Bancos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.bancos}
                        onChange={(e) => setField('bancos', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>

                    {/* Efectivo Disponible */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Efectivo Disponible</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.efectivoDisponible}
                        onChange={(e) => setField('efectivoDisponible', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>

                    {/* Cargas */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Cargas</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">KG Enviados</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalCargasKg}
                            onChange={(e) => setField('totalCargasKg', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Valor de Viajes</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalCargasDinero}
                            onChange={(e) => setField('totalCargasDinero', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      </div>

                      {/* Lista automática de embarques / Notas de Venta - integración con Ingreso de Embarques */}
                      {form.cargasDetalle && form.cargasDetalle.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-600 mb-1.5">Registros automáticos por Nota de Venta (del período)</p>
                          <div className="max-h-44 overflow-auto border border-slate-200 rounded-lg bg-white">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-100 text-slate-600">
                                  <th className="px-2 py-1.5 text-left font-medium">Nota</th>
                                  <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                                  <th className="px-2 py-1.5 text-left font-medium">Lote</th>
                                  <th className="px-2 py-1.5 text-left font-medium">Cliente</th>
                                  <th className="px-2 py-1.5 text-right font-medium">Kg</th>
                                  <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(form.cargasDetalle || []).map((row, idx) => (
                                  <tr key={idx} className="border-t border-slate-100">
                                    <td className="px-2 py-1 font-medium text-slate-900">{row.nota || '-'}</td>
                                    <td className="px-2 py-1 text-slate-600">{row.fecha ? String(row.fecha).split('T')[0] : '-'}</td>
                                    <td className="px-2 py-1 text-slate-600">{row.lote || '-'}</td>
                                    <td className="px-2 py-1 text-slate-600 truncate max-w-[90px]">{row.cliente || '-'}</td>
                                    <td className="px-2 py-1 text-right">{parseFloat(row.kg || 0).toFixed(2)}</td>
                                    <td className="px-2 py-1 text-right font-medium">{fmt(row.dinero || 0)}</td>
                                  </tr>
                                ))}
                                <tr className="border-t bg-emerald-50 font-semibold text-emerald-800">
                                  <td className="px-2 py-1 text-right" colSpan="4">Total período</td>
                                  <td className="px-2 py-1 text-right">{parseFloat(form.totalCargasKg || 0).toFixed(2)}</td>
                                  <td className="px-2 py-1 text-right">{fmt(form.totalCargasDinero)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-1">Cargado automáticamente desde Ingreso de Embarques (Notas de Venta) del período.</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Presiona “Cargar datos del sistema” para integrar automáticamente los embarques/ Notas de Venta.</p>
                      )}
                    </div>

                    {/* Total Ingresos */}
                    <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-800">TOTAL INGRESOS</span>
                        <span className="font-black text-xl text-emerald-800">{fmt(totalIngresosDinero)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EGRESOS */}
                <div>
                  <h3 className="font-semibold text-red-700 mb-4 flex items-center gap-2 text-lg">
                    <i className="ph-fill ph-arrow-circle-down"></i> EGRESOS
                  </h3>
                  <div className="space-y-3">
                    {/* Cuadrillas */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Cuadrillas</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">KG cortados</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalCuadrillaKg}
                            onChange={(e) => setField('totalCuadrillaKg', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Dinero</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalCuadrillaDinero}
                            onChange={(e) => setField('totalCuadrillaDinero', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Monto de Fletes (auto desde Cuadrillas y Fletes - período) */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Monto de Fletes</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.totalFletes}
                        onChange={(e) => setField('totalFletes', e.target.value)}
                        disabled={!isEditable}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        placeholder="Se carga automáticamente desde fletes del período"
                      />
                    </div>

                    {/* Gastos */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Gastos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.totalGastos}
                        onChange={(e) => setField('totalGastos', e.target.value)}
                        disabled={!isEditable}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>

                    {/* Nómina */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600">Nómina Semanal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.nominaSemanal}
                        onChange={(e) => setField('nominaSemanal', e.target.value)}
                        disabled={!isEditable}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>

                    {/* Luz y Renta */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-600">Luz</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.porcentajeLuz}
                          onChange={(e) => setField('porcentajeLuz', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-600">Renta</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.porcentajeRenta}
                          onChange={(e) => setField('porcentajeRenta', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                        />
                      </div>
                    </div>

                    {/* Ingreso de fruta */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Ingreso de Fruta</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">KG (total)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalEntradasFrutaKg}
                            onChange={(e) => setField('totalEntradasFrutaKg', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Dinero (total)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.totalEntradasFrutaDinero}
                            onChange={(e) => setField('totalEntradasFrutaDinero', e.target.value)}
                            disabled={!isEditable}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      </div>

                      {/* Lista automática de lotes - integración con Ingreso de Fruta */}
                      {form.ingresoFrutaDetalle && form.ingresoFrutaDetalle.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-600 mb-1.5">Registros automáticos por lote (del período)</p>
                          <div className="max-h-44 overflow-auto border border-slate-200 rounded-lg bg-white">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-100 text-slate-600">
                                  <th className="px-2 py-1.5 text-left font-medium">Lote</th>
                                  <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                                  <th className="px-2 py-1.5 text-left font-medium">Productor</th>
                                  <th className="px-2 py-1.5 text-right font-medium">Kg</th>
                                  <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(form.ingresoFrutaDetalle || []).map((row, idx) => (
                                  <tr key={idx} className="border-t border-slate-100">
                                    <td className="px-2 py-1 font-medium text-slate-900">{row.lot_number || '-'}</td>
                                    <td className="px-2 py-1 text-slate-600">{row.fecha ? String(row.fecha).split('T')[0] : '-'}</td>
                                    <td className="px-2 py-1 text-slate-600 truncate max-w-[110px]">{row.productor || '-'}</td>
                                    <td className="px-2 py-1 text-right">{parseFloat(row.kg || 0).toFixed(2)}</td>
                                    <td className="px-2 py-1 text-right font-medium">{fmt(row.dinero || 0)}</td>
                                  </tr>
                                ))}
                                <tr className="border-t bg-emerald-50 font-semibold text-emerald-800">
                                  <td className="px-2 py-1 text-right" colSpan="3">Total período</td>
                                  <td className="px-2 py-1 text-right">{parseFloat(form.totalEntradasFrutaKg || 0).toFixed(2)}</td>
                                  <td className="px-2 py-1 text-right">{fmt(form.totalEntradasFrutaDinero)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-1">Cargado automáticamente desde Ingreso de Fruta del período (no requiere captura manual).</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Presiona “Cargar datos del sistema” para integrar automáticamente los lotes de Ingreso de Fruta.</p>
                      )}
                    </div>

                    {/* Total Egresos */}
                    <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-red-800">TOTAL EGRESOS</span>
                        <span className="font-black text-xl text-red-800">{fmt(totalEgresosDinero)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RESULTADOS */}
              <div className="bg-slate-100 p-6 rounded-2xl">
                <h3 className="font-semibold text-slate-800 mb-4 text-lg text-center">RESULTADOS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Kg de la Semana</p>
                    <p className={`text-2xl font-bold ${resultadoKg >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {kgDeLaSemana.toFixed(2)} kg
                    </p>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${esUtilidad ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                    <p className="text-sm text-slate-600 mb-1">Utilidad / Pérdida</p>
                    <p className={`text-3xl font-black ${esUtilidad ? 'text-emerald-700' : 'text-red-700'}`}>
                      {fmt(resultadoDinero)}
                    </p>
                    <p className={`text-sm font-bold mt-1 ${esUtilidad ? 'text-emerald-600' : 'text-red-600'}`}>
                      {esUtilidad ? '✓ UTILIDAD' : '✗ PÉRDIDA'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 resize-none"
                  placeholder="Observaciones..."
                />
              </div>

              {/* Estado + Flujo de Aprobación (Lógica senior: dos niveles) */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  disabled={form.status === 'cerrado'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                >
                  <option value="abierto">Abierto (borrador)</option>
                  <option value="pendiente_aprobacion">Pendiente Aprobación</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="cerrado">Cerrado (final)</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">Registrado por (primer admin)</label>
                  <input
                    type="text"
                    value={form.recordedBy}
                    onChange={(e) => setField('recordedBy', e.target.value)}
                    placeholder="Nombre del admin que captura"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                    disabled={form.status === 'cerrado'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-600">Aprobado por (segundo admin general)</label>
                  <input
                    type="text"
                    value={form.approvedBy}
                    onChange={(e) => setField('approvedBy', e.target.value)}
                    placeholder="Nombre del admin que aprueba"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                    disabled={form.status === 'cerrado'}
                  />
                </div>
              </div>

              {/* Botones de flujo de aprobación (requiere dos admins) */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => performApprovalAction('solicitar_aprobacion')}
                  disabled={form.status === 'cerrado' || !editing}
                  className="px-4 py-2 text-sm rounded-xl border border-amber-600 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Enviar a Aprobación
                </button>
                <button
                  type="button"
                  onClick={() => performApprovalAction('aprobar')}
                  disabled={form.status === 'cerrado' || !editing}
                  className="px-4 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Aprobar (2do Admin)
                </button>
                <button
                  type="button"
                  onClick={() => performApprovalAction('cerrar')}
                  disabled={!editing}
                  className="px-4 py-2 text-sm rounded-xl bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Cerrar Cierre
                </button>
                <button
                  type="button"
                  onClick={() => performApprovalAction('reabrir')}
                  disabled={!editing}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-400 hover:bg-slate-100 disabled:opacity-50"
                >
                  Reabrir
                </button>
              </div>

              {/* Botones de exportación y guardado */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportPDF}
                  className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <i className="ph ph-file-pdf"></i>
                  Exportar PDF
                </button>
                <button
                  onClick={exportExcel}
                  className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <i className="ph ph-file-xls"></i>
                  Exportar Excel
                </button>
                <button
                  onClick={exportCSV}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <i className="ph ph-file-csv"></i>
                  Exportar CSV
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving ? <><i className="ph ph-spinner animate-spin"></i> Guardando...</> : <><i className="ph ph-floppy-disk"></i> Guardar Cierre</>}
                </button>
              </div>

              {/* Flujo de cierre: botones de acción senior */}
              {editing && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-sm">
                  <span className="text-slate-500 self-center mr-2">Flujo de Cierre:</span>
                  <button onClick={() => quickStatusChange('abierto')} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50">Reabrir</button>
                  <button onClick={() => quickStatusChange('pendiente_aprobacion')} className="px-3 py-1.5 rounded-lg border hover:bg-amber-50 text-amber-700">Enviar a Aprobación</button>
                  <button onClick={() => quickStatusChange('aprobado')} className="px-3 py-1.5 rounded-lg border hover:bg-emerald-50 text-emerald-700">Aprobar</button>
                  <button onClick={() => quickStatusChange('cerrado')} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-black">Cerrar Semana (bloquear)</button>
                  <span className="text-[10px] text-slate-400 self-center ml-2">Estado actual: {form.status}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
