'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { drawCompanyHeader } from '@/lib/company-header';
import * as XLSX from 'xlsx';
import {closingWeek, validDate, validWeek, closingTotals} from '@/utils/closing-period';
import ClosingTrace from '@/components/closing-trace';

const TABS = [
  { id: 'resumen', label: '1. RESUMEN EJECUTIVO' },
  { id: 'produccion', label: '2. PRODUCCIÓN' },
  { id: 'inventarios', label: '3. INVENTARIOS' },
  { id: 'ingresos', label: '4. INGRESOS Y VENTAS' },
  { id: 'costos', label: '5. COSTOS Y GASTOS' },
  { id: 'bancos', label: '6. BANCOS Y TESORERÍA' },
  { id: 'rentabilidad', label: '7. RENTABILIDAD (CONTABLE + GERENCIAL)' },
  { id: 'conciliacion', label: '8. CONCILIACIONES' },
];

const fmt = (n) =>
  `$${parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  porcentajeRenta: '',
  porcentajeLuz: '',
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
  const [listError,setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  // Reestructurado - 8 secciones (formato integral + distinción contable/origen)
  const [activeTab, setActiveTab] = useState('resumen');
  const [integralData, setIntegralData] = useState(null);
  const [conciliacionStatus, setConciliacionStatus] = useState('borrador');

  useEffect(() => { fetchClosings(); }, []);

  const fetchClosings = async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await fetch('/api/weekly-closings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClosings(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    const { start, end } = closingWeek();
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
    setIntegralData(null);
  };

  const openEdit = (c) => {
    if (c.virtual) { openNew(); return; }
    setIntegralData(null);
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
      porcentajeRenta: c.detalle_integral && Object.hasOwn(c.detalle_integral,'renta_manual') ? c.detalle_integral.renta_manual ?? '' : c.porcentaje_renta || '',
      porcentajeLuz: c.porcentaje_luz || '',
      totalCargasKg: c.total_cargas_kg || '',
      totalCuadrillaKg: c.total_cuadrilla_kg || '',
      totalEntradasFrutaKg: c.total_entradas_fruta_kg || '',
      totalDesechoKg: c.total_desecho_kg || '',
      totalProcesoKg: c.total_proceso_kg || '',
      totalFletes: c.total_fletes_dinero || '',
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
  };

  const [summaryError,setSummaryError] = useState('');
  const [refreshVersion,setRefreshVersion] = useState(0);

  useEffect(() => {
    const {weekStartDate:start,weekEndDate:end} = form;
    if (!showForm || !validWeek(start,end)) return;
    const controller = new AbortController();
    let busy = false;
    async function read(full) {
      if (busy) return;
      busy = true;
      if (full) setLoadingData(true);
      try {
        const res = await fetch(`/api/weekly-closings?summary=true&startDate=${start}&endDate=${end}&live=${!full}`,
          {cache:'no-store',signal:controller.signal});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setSummaryError('');
        setIntegralData(prior => full ? data : {...prior,...data});
        setConciliacionStatus(data.conciliacion.estado_general);
        setForm(f => ({
          ...f, totalCargasDinero:data.total_cargas_dinero, totalVentasDesechoDinero:data.total_ventas_desecho_dinero,
          totalVentasProcesoDinero:data.total_ventas_proceso_dinero, valorInventarioMateriales:data.valor_inventario_materiales,
          inventarioTarimas:data.inventario_tarimas_por_calibre, totalGastos:data.total_gastos, totalEntradasFrutaDinero:data.total_entradas_fruta_dinero,
          totalCuadrillaDinero:data.total_cuadrilla_dinero, totalBrokerNotes:data.total_broker_notes,
          nominaSemanal:data.nomina_semanal, porcentajeLuz:data.luz_automatica, otrosFijos:data.otros_fijos,
          totalCargasKg:data.total_cargas_kg, totalEntradasFrutaKg:data.total_entradas_fruta_kg,
          totalDesechoKg:data.total_desecho_kg,totalProcesoKg:data.total_proceso_kg, mermaKg:data.merma_kg,
          frioKg:data.frio_kg, totalFletes:data.total_fletes_dinero, ingresoFrutaDetalle:data.ingreso_fruta_detalle,
          cargasDetalle:data.cargas_detalle,
        }));
      } catch (error) {
        if (!controller.signal.aborted) setSummaryError(error.message || 'No se pudo actualizar el cierre.');
      } finally {
        if (!controller.signal.aborted) setLoadingData(false);
        busy = false;
      }
    }
    read(false).then(() => {if (!controller.signal.aborted) read(true);});
    const timer = setInterval(() => {if (!document.hidden) read(false);},15000);
    const focus = () => read(false);
    window.addEventListener('focus',focus);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus',focus);
    };
  }, [showForm,form.weekStartDate,form.weekEndDate,refreshVersion]);

  const fetchRelatedModuleData = () => setRefreshVersion(v=>v+1);

  const handleSave = async (extra = {}) => {
    setSaving(true);
    setSummaryError('');
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = {
        ...form,
        id: editing?.id,
        detalle_integral: integralData,
        estado_conciliacion: conciliacionStatus,
        ...extra,
      };
      const res = await fetch('/api/weekly-closings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const saved = await res.json();
        setEditing(saved);
        fetchClosings();
        return true;
      }
      const error = await res.json();
      setSummaryError(error.error || 'No se pudo guardar el cierre.');
    } catch (e) {
      setSummaryError(e.message);
    } finally {
      setSaving(false);
    }
    return false;
  };

  // Lógica V8: flujo completo de cierre integral
  const quickStatusChange = async (newStatus) => {
    if (!editing) return;
    const newConc = newStatus === 'cerrado' ? 'cerrado' : (newStatus === 'aprobado' ? 'pendiente_autorizacion' : 'borrador');
    const body = { 
      ...form, 
      id: editing.id, 
      status: newStatus,
      estado_conciliacion: newConc,
      detalle_integral: integralData 
    };
    try {
      await fetch('/api/weekly-closings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForm(f => ({ ...f, status: newStatus }));
      setConciliacionStatus(newConc);
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
      await handleSave();
      return;
    }

    let newStatus = form.status;
    let newConc = conciliacionStatus;

    if (action === 'aprobar') { newStatus = 'aprobado'; newConc = 'pendiente_autorizacion'; }
    if (action === 'cerrar') { newStatus = 'cerrado'; newConc = 'cerrado'; }
    if (action === 'reabrir') { newStatus = 'abierto'; newConc = 'borrador'; }

    const payload = {
      id: targetId,
      status: newStatus,
      estado_conciliacion: newConc,
      recordedBy: form.recordedBy || null,
      approvedBy: action === 'aprobar' ? (form.approvedBy || 'admin-general') : form.approvedBy || null,
      notes: form.notes,
      detalle_integral: integralData,
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
        setConciliacionStatus(newConc);
        fetchClosings();
        alert(action === 'cerrar' ? 'Cierre cerrado (snapshot guardado).' : 'Estado actualizado.');
      }
    } catch (e) { console.error(e); }
  };

  const totals = closingTotals({
    ...form, rentaAplicada:form.porcentajeRenta === '' ? integralData?.renta_automatica : form.porcentajeRenta
  });
  const totalIngresosDinero = totals.ingresos;
  const totalEgresosDinero = totals.egresos;
  const resultadoDinero = totals.resultado;
  const kgDeLaSemana = totals.kilosPendientes;

  const esUtilidad = resultadoDinero >= 0;

  // Exportar PDF V8 - multi pestaña + conciliación
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = drawCompanyHeader(doc, { companyName: 'TECAVO FRUITS' });
    doc.text('CIERRE SEMANAL INTEGRAL V7', 14, y + 8);
    doc.setFontSize(11);
    doc.text(`${form.weekLabel} | ${form.weekStartDate} - ${form.weekEndDate}`, 14, y + 16);
    doc.setFontSize(10);

    let yPos = y + 26;

    // Resumen rápido
    doc.text(`INGRESOS: ${fmt(totalIngresosDinero)}   EGRESOS: ${fmt(totalEgresosDinero)}   RESULTADO: ${fmt(resultadoDinero)}`, 14, yPos);
    yPos += 10;

    // PRODUCCIÓN
    doc.setFontSize(12); doc.text('1. PRODUCCIÓN', 14, yPos); yPos += 6;
    doc.setFontSize(9);
    doc.text(`Recibidos: ${(integralData?.produccion?.kg_recibidos || 0).toFixed(0)} | Lotif: ${(integralData?.produccion?.kg_lotificados || 0).toFixed(0)} | A:${(integralData?.produccion?.calidad_a||0).toFixed(0)} B:${(integralData?.produccion?.calidad_b||0).toFixed(0)} Proceso:${(integralData?.produccion?.proceso||0).toFixed(0)}`, 14, yPos);
    yPos += 8;

    // INVENTARIOS
    doc.setFontSize(12); doc.text('2. INVENTARIOS', 14, yPos); yPos += 6;
    doc.setFontSize(9);
    doc.text(`Fruta Final: ${(integralData?.inventarios?.fruta_final || 0).toFixed(0)} kg | Mat Final: ${(integralData?.inventarios?.materiales_final || 0).toFixed(2)}`, 14, yPos);
    yPos += 8;

    // COSTOS
    doc.setFontSize(12); doc.text('3. COSTOS Y GASTOS', 14, yPos); yPos += 6;
    doc.setFontSize(9);
    doc.text(`Cuadrilla: ${(integralData?.costos_gastos?.cuadrillas || 0).toFixed(2)} | Nómina: ${(integralData?.costos_gastos?.nomina || 0).toFixed(2)} | Fletes: ${(integralData?.costos_gastos?.fletes_comerciales || 0).toFixed(2)}`, 14, yPos);
    yPos += 8;

    // BANCOS
    doc.setFontSize(12); doc.text('4. BANCOS Y COBRANZA', 14, yPos); yPos += 6;
    doc.setFontSize(9);
    doc.text(`Abonos: ${(integralData?.bancos_cobranza?.abonos_banco || 0).toFixed(2)} | Cobros Clientes: ${(integralData?.bancos_cobranza?.cobros_clientes || 0).toFixed(2)}`, 14, yPos);
    yPos += 8;

    // RENTABILIDAD + CONC
    doc.setFontSize(12); doc.text('5-6. RENTABILIDAD + CONCILIACIÓN', 14, yPos); yPos += 6;
    doc.setFontSize(9);
    doc.text(`Utilidad Bruta: ${(integralData?.rentabilidad?.utilidad_bruta || 0).toFixed(2)} | Estado Conc.: ${conciliacionStatus}`, 14, yPos);

    doc.save(`cierre_semanal_integral_${form.weekStartDate}.pdf`);
  };

  // Exportar Excel V8
  const exportExcel = () => {
    const data = [
      ['CIERRE SEMANAL INTEGRAL V7'],
      [form.weekLabel || 'Semana'],
      [`${form.weekStartDate} - ${form.weekEndDate}`],
      [],
      ['1. PRODUCCIÓN'],
      ['KG Recibidos', integralData?.produccion?.kg_recibidos || 0],
      ['KG Lotificados', integralData?.produccion?.kg_lotificados || 0],
      ['Calidad A', integralData?.produccion?.calidad_a || 0],
      ['Proceso', integralData?.produccion?.proceso || 0],
      ['Desecho', integralData?.produccion?.desecho || 0],
      [],
      ['2. INVENTARIOS'],
      ['Materiales Final (fórmula)', integralData?.inventarios?.materiales_final || form.valorInventarioMateriales],
      [],
      ['3. COSTOS'],
      ['Cuadrillas', integralData?.costos_gastos?.cuadrillas || 0],
      ['Nómina', integralData?.costos_gastos?.nomina || 0],
      [],
      ['4. BANCOS'],
      ['Abonos Banco', integralData?.bancos_cobranza?.abonos_banco || 0],
      [],
      ['5. RENTABILIDAD'],
      ['Ingresos Netos', integralData?.rentabilidad?.ingresos_netos || 0],
      ['Utilidad Bruta', integralData?.rentabilidad?.utilidad_bruta || 0],
      [],
      ['6. CONCILIACIÓN'],
      ['Estado', conciliacionStatus],
      [],
      ['RESULTADO'],
      ['Utilidad/Pérdida', resultadoDinero],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre');
    if (integralData?.origen) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(integralData.origen.ventas.map(sale => ({
        ...sale, detail_ids:sale.detail_ids?.join(', '),
        tarimas:sale.tarimas.map(pallet=>pallet.folio || pallet.id).join(', ')
      }))), 'Embarques por lote');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(integralData.conceptos_fijos.details),'Gastos fijos');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(integralData.movimientos_mxn),'Otros egresos');
    }
    XLSX.writeFile(wb, `cierre_integral_${form.weekStartDate}.xlsx`);
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

        {listError && <p role="alert" className="text-red-700 mb-4">{listError}</p>}
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
                    key={c.id ?? c.week_start_date}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    <div
                      className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => c.virtual ? openNew() : setSelected(selected?.id === c.id ? null : c)}
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
                            <p className="text-xs text-slate-500">{c.recalculado ? "Resultado vivo" : "Resultado guardado"}</p>
                            <p className={`font-bold text-lg ${esUtil ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(utilidad)}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.status === 'cerrado' ? 'bg-slate-100 text-slate-600' : c.status === 'aprobado' ? 'bg-emerald-100 text-emerald-700' : c.status === 'pendiente_aprobacion' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {c.virtual ? 'Disponible en vivo' : c.estado_conciliacion || c.status || 'borrador'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                              <i className="ph ph-pencil-simple"></i>
                            </button>
                            {!c.virtual && <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <i className="ph ph-trash"></i>
                            </button>}
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
                Este cierre conserva la captura aprobada. Ventas y gastos posteriores aparecen en la vista viva.
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Periodo + Calcular V8 */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <i className="ph ph-calendar-blank text-brand-600"></i> Periodo de la Semana (Lunes a Domingo)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Inicio (Lunes)</label>
                    <input type="date" readOnly={!!editing} value={form.weekStartDate} onChange={(e) => setForm(f => ({...f,weekStartDate:validDate(e.target.value) ? closingWeek(e.target.value).start : '',weekEndDate:validDate(e.target.value) ? closingWeek(e.target.value).end : ''}))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Fin (Domingo)</label>
                    <input type="date" value={form.weekEndDate} readOnly
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600">Etiqueta</label>
                    <input type="text" value={form.weekLabel} onChange={(e) => setField('weekLabel', e.target.value)} placeholder="Semana X" className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={() => fetchRelatedModuleData()}
                    disabled={loadingData || !form.weekStartDate || !form.weekEndDate}
                    className="px-6 py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingData ? <><i className="ph ph-spinner animate-spin"></i> Calculando...</> : <><i className="ph ph-arrows-clockwise"></i> Actualizar fuentes</>}
                  </button>
                  <button onClick={() => router.push('/administracion/conciliacion-bancaria')} className="px-4 py-2.5 border rounded-xl text-sm">Ir a Conciliación Bancaria (IA)</button>
                </div>
              </div>

              {summaryError && <p role="alert" className="text-sm text-red-700">{summaryError}</p>}
              {!validWeek(form.weekStartDate,form.weekEndDate) && <p className="text-sm text-amber-800">Selecciona un período de lunes a domingo.</p>}
              <ClosingTrace data={integralData} form={form} setField={setField}/>
              {/* TABS V8 */}
              <div className="border-b border-slate-200">
                <div className="flex flex-wrap gap-1 -mb-px">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${activeTab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONTENIDO DE LAS 8 SECCIONES (nuevo formato integral) */}
              <div className="pt-2 min-h-[420px]">
                {/* 1. RESUMEN EJECUTIVO - Contable + Flujo + Capital de trabajo */}
                {activeTab === 'resumen' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border p-4 rounded-xl">
                        <div className="text-xs uppercase tracking-widest text-slate-500">Utilidad Contable (Semana Operación)</div>
                        <div className="text-3xl font-black mt-1">{fmt(integralData?.rentabilidad?.utilidad_bruta || 0)}</div>
                        <div className="text-xs mt-1">Ventas convertibles a MXN menos costo de ventas, antes de descuentos</div>
                      </div>
                      <div className="bg-white border p-4 rounded-xl">
                        <div className="text-xs uppercase tracking-widest text-slate-500">Flujo de Efectivo Semana</div>
                        <div className="text-3xl font-black mt-1">{fmt((integralData?.bancos_cobranza?.abonos_banco||0) - (integralData?.bancos_cobranza?.cargos_banco||0))}</div>
                        <div className="text-xs mt-1">Cobros reales - Pagos reales (no devengo)</div>
                      </div>
                      <div className="bg-emerald-50 border p-4 rounded-xl">
                        <div className="text-xs uppercase tracking-widest text-emerald-600">Inventario de materiales (MXN)</div>
                        <div className="text-3xl font-black mt-1">{fmt(form.valorInventarioMateriales)}</div>
                        <div className="text-xs mt-1">Saldo de materiales al momento de la consulta</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">El cierre explica dónde está el dinero: utilidad contable ≠ flujo ≠ capital de trabajo. Fruta en cámara es activo, no pérdida.</div>
                    {integralData?.rentabilidad?.costo_ventas_pendiente && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">⚠ {integralData?.rentabilidad?.costo_ventas_label || 'COSTO PENDIENTE DE DETERMINACIÓN'} — Algunos lotes vendidos carecen de costo histórico calculado. No se usaron estimaciones automáticas.</div>
                    )}
                  </div>
                )}

                {/* 2. PRODUCCIÓN (renumerada) */}
                {activeTab === 'produccion' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">KG Recibidos</div><div className="text-2xl font-bold">{(integralData?.produccion?.kg_recibidos || form.totalEntradasFrutaKg || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">KG Lotificados</div><div className="text-2xl font-bold">{(integralData?.produccion?.kg_lotificados || form.totalCargasKg || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Calidad A</div><div className="text-2xl font-bold text-emerald-700">{(integralData?.produccion?.calidad_a || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Calidad B</div><div className="text-2xl font-bold">{(integralData?.produccion?.calidad_b || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Proceso</div><div className="text-2xl font-bold">{(integralData?.produccion?.proceso || form.totalProcesoKg || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Desecho</div><div className="text-2xl font-bold">{(integralData?.produccion?.desecho || form.totalDesechoKg || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Merma</div><div className="text-2xl font-bold text-amber-700">{(integralData?.produccion?.merma || 0).toLocaleString()}</div></div>
                      <div className="bg-white border rounded-xl p-3"><div className="text-xs text-slate-500">Tarimas Producidas</div><div className="text-2xl font-bold">{(integralData?.produccion?.tarimas_producidas || 0)}</div></div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-2">Rendimiento por Lote (confirmado)</div>
                      <div className="overflow-auto max-h-64 border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100"><tr><th className="p-1 text-left">Lote</th><th>Productor</th><th className="text-right">Recibidos</th><th className="text-right">Lotif.</th><th className="text-right">A</th><th className="text-right">Proceso</th><th className="text-right">Merma</th></tr></thead>
                          <tbody>
                            {(integralData?.produccion?.rendimiento_lotes || []).slice(0,12).map((r,i) => (
                              <tr key={i} className="border-t"><td className="p-1">{r.lot_number}</td><td>{r.producer}</td><td className="text-right">{parseFloat(r.kg_recibidos||0).toFixed(0)}</td><td className="text-right">{parseFloat(r.kg_lotificado||0).toFixed(0)}</td><td className="text-right">{parseFloat(r.a||0).toFixed(0)}</td><td className="text-right">{parseFloat(r.proceso||0).toFixed(0)}</td><td className="text-right text-amber-600">{parseFloat(r.merma||0).toFixed(0)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. INVENTARIOS */}
                {activeTab === 'inventarios' && (
                  <div className="space-y-4">
                    <div className="text-xs text-emerald-700 font-medium">Fórmula Materiales: INICIAL + ENTRADAS - CONSUMOS + AJUSTES_AUTORIZADOS</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Recibidos en la semana</div><div className="font-bold">{Number(form.totalEntradasFrutaKg || 0).toFixed(0)} kg</div></div>
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Saldo en frío de esos lotes</div><div className="font-bold">{Number(form.frioKg || 0).toFixed(0)} kg</div></div>
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Tarimas Disponibles / Embarcadas</div><div className="font-bold">{(integralData?.inventarios?.tarimas_disponibles || 0)} / {(integralData?.inventarios?.tarimas_embarcadas || 0)}</div></div>
                      <div className="bg-emerald-50 p-3 border rounded col-span-2 md:col-span-3">
                        <div>Materiales Final = { Number(form.valorInventarioMateriales || 0).toFixed(2) }</div>
                        <div className="text-[10px] mt-1">Entradas (aunque no pagadas): {(integralData?.inventarios?.materiales_entradas||0).toFixed(2)} • Consumos: {(integralData?.inventarios?.materiales_consumidos||0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. COSTOS Y GASTOS */}
                {activeTab === 'costos' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      ['Costo efectivo fruta', integralData?.costos_gastos?.costo_efectivo_fruta],
                      ['Cuadrillas', integralData?.costos_gastos?.cuadrillas],
                      ['Fletes comerciales', integralData?.costos_gastos?.fletes_comerciales],
                      ['Materiales consumidos', integralData?.costos_gastos?.materiales_consumidos],
                      ['Nómina', integralData?.costos_gastos?.nomina],
                      ['Gastos bancarios', integralData?.costos_gastos?.gastos_bancarios],
                      ['Otros', integralData?.costos_gastos?.otros],
                    ].map(([label, val], i) => (
                      <div key={i} className="bg-white border p-3 rounded"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{parseFloat(val || 0).toLocaleString()}</div></div>
                    ))}
                    <div className="text-xs col-span-2 text-slate-500">Los materiales en inventario no se registran como gasto de producción hasta su consumo (salvo autorización contable).</div>
                  </div>
                )}

                {/* 4. BANCOS Y COBRANZA */}
                {activeTab === 'bancos' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Abonos (banco)</div><div className="font-bold text-emerald-700">{(integralData?.bancos_cobranza?.abonos_banco || 0).toFixed(2)}</div></div>
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Cargos (banco)</div><div className="font-bold text-red-600">{(integralData?.bancos_cobranza?.cargos_banco || 0).toFixed(2)}</div></div>
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Cobros Clientes</div><div className="font-bold">{(integralData?.bancos_cobranza?.cobros_clientes || 0).toFixed(2)}</div></div>
                      <div className="bg-white p-3 border rounded"><div className="text-xs">Pagos Productores</div><div className="font-bold">{(integralData?.bancos_cobranza?.pagos_productores || 0).toFixed(2)}</div></div>
                    </div>
                    <button onClick={() => router.push('/administracion/conciliacion-bancaria')} className="text-sm px-4 py-1.5 bg-slate-800 text-white rounded">Revisar movimientos bancarios con TECAVO IA →</button>
                    <div className="text-xs mt-2 text-slate-500">Los cobros actualizan cuentas por cobrar. Los pagos cancelan obligaciones (no generan nuevo gasto).</div>
                  </div>
                )}

                {/* 4. INGRESOS Y VENTAS (nuevo bloque) */}
                {activeTab === 'ingresos' && (
                  <div className="space-y-3 text-sm">
                    <div className="font-semibold">Ventas Reconocidas (load_history - fruta empacada) + Ventas Proceso/Desecho (separadas)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border p-3 rounded">Cargas (empacado) ${parseFloat(integralData?.total_cargas_dinero || 0).toFixed(2)} / {parseFloat(integralData?.total_cargas_kg || 0).toFixed(0)} kg</div>
                      <div className="bg-white border p-3 rounded">Proceso ${parseFloat(integralData?.total_ventas_proceso_dinero || 0).toFixed(2)} • Desecho ${parseFloat(integralData?.total_ventas_desecho_dinero || 0).toFixed(2)}</div>
                    </div>
                    <div className="text-xs">Proceso y desecho se muestran por separado. No se suman a ventas de fruta empacada. Merma física no genera ingreso.</div>
                  </div>
                )}

                {/* 7. RENTABILIDAD - Distinción obligatoria: Contable (operación) vs Gerencial (semana de origen del lote) */}
                {activeTab === 'rentabilidad' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Contable */}
                      <div className="bg-white border p-4 rounded-xl">
                        <div className="uppercase text-xs tracking-widest text-slate-500 mb-1">RENTABILIDAD CONTABLE (Semana de Operación / Reconocimiento)</div>
                        <div>Ventas con importe MXN (antes de descuentos): <span className="font-bold">{(integralData?.rentabilidad?.ingresos_netos || 0).toFixed(2)}</span></div>
                        {!!integralData?.rentabilidad?.ventas_sin_conversion && <p className="text-xs text-amber-800">Hay embarques sin tipo de cambio registrado.</p>}
                        <div>Costo de ventas: <span className="font-bold text-red-700">{(integralData?.rentabilidad?.costo_ventas || 0).toFixed(2)} {integralData?.rentabilidad?.costo_ventas_pendiente ? '(PENDIENTE DE DETERMINACIÓN)' : ''}</span></div>
                        <div className="mt-2 text-xl font-black">Utilidad Bruta: {(integralData?.rentabilidad?.utilidad_bruta || 0).toFixed(2)}</div>
                        <div className="text-[10px] mt-2 text-slate-500">Se registra en la semana en que ocurrió la venta/embarque (load_date). No duplica con origen.</div>
                      </div>
                      {/* Gerencial por origen */}
                      <div className="bg-emerald-50 border p-4 rounded-xl">
                        <div className="uppercase text-xs tracking-widest text-emerald-600 mb-1">RENTABILIDAD GERENCIAL (Semana de Origen del Lote)</div>
                        <div className="text-sm">Los lotes de esta semana de producción muestran su resultado definitivo cuando se venden (aunque la venta sea en semana posterior).</div>
                        <div className="mt-2 text-xs">Costo histórico lote → venta posterior actualiza indicadores de su semana de origen.</div>
                        <div className="mt-3 text-xs bg-white p-2 rounded">Fuente: fecha de recepción física y partida del embarque por lote.</div>
                        {integralData?.rentabilidad?.costo_ventas_pendiente && <div className="mt-2 text-amber-700 text-xs">{integralData?.rentabilidad?.costo_ventas_label}</div>}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Una misma venta de tarimas de 3 semanas diferentes distribuye el ingreso y el costo histórico a cada semana de origen correspondiente. No se duplican los importes en reportes consolidados.</div>
                  </div>
                )}

                {/* 6. CONCILIACIÓN */}
                {activeTab === 'conciliacion' && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-semibold">Comparaciones automáticas (no modifica otros módulos)</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${conciliacionStatus === 'conciliado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{conciliacionStatus}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      {(integralData?.conciliacion?.diferencias || []).map((d, idx) => (
                        <div key={idx} className="flex justify-between border p-2 rounded bg-white">
                          <span>{d.clave}</span>
                          <span className={Math.abs(d.valor) > 100 ? 'text-red-600 font-medium' : ''}>{parseFloat(d.valor || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs mt-3">Asigne incidencias al departamento responsable. Cierre definitivo requiere autorización si hay diferencias materiales.</div>
                  </div>
                )}
              </div>

              {/* RESULTADOS RÁPIDOS (siempre visibles) */}
              <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap gap-6 items-center">
                <div>
                  <div className="text-xs text-slate-500">Total Ingresos</div>
                  <div className="font-bold text-lg text-emerald-700">{fmt(totalIngresosDinero)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Total Egresos</div>
                  <div className="font-bold text-lg text-red-700">{fmt(totalEgresosDinero)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Resultado</div>
                  <div className={`font-black text-xl ${esUtilidad ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(resultadoDinero)}</div>
                </div>
                <div className="text-xs text-slate-500">Estado: {conciliacionStatus} • {form.status}</div>
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

              {/* V8 FLUJO DE CIERRE INTEGRAL */}
              {editing && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-sm">
                  <span className="text-slate-500 self-center mr-2">Flujo V7/V8:</span>
                  <button onClick={() => { setConciliacionStatus('borrador'); quickStatusChange('abierto'); }} className="px-3 py-1.5 rounded-lg border">Borrador</button>
                  <button onClick={() => { setConciliacionStatus('en_conciliacion'); quickStatusChange('pendiente_aprobacion'); }} className="px-3 py-1.5 rounded-lg border hover:bg-amber-50">En Conciliación</button>
                  <button onClick={() => performApprovalAction('aprobar')} className="px-3 py-1.5 rounded-lg border hover:bg-emerald-50 text-emerald-700">Pendiente Autorización</button>
                  <button onClick={() => performApprovalAction('cerrar')} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white">CERRAR (guardar snapshot)</button>
                  <button onClick={() => performApprovalAction('reabrir')} className="px-3 py-1.5 rounded-lg border">Reabrir</button>
                  <span className="text-[10px] text-slate-400 self-center ml-2">Estado: {form.status} • {conciliacionStatus}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
