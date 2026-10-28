'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { drawCompanyHeader } from '@/lib/company-header';

export default function NominaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('periodos'); // periodos | sincronizar | trazabilidad
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [traces, setTraces] = useState([]);

  // Week selector
  const [selectedWeekStart, setSelectedWeekStart] = useState(getCurrentWeekStart());
  const [selectedWeekEnd, setSelectedWeekEnd] = useState(getCurrentWeekEnd());

  function getCurrentWeekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }
  function getCurrentWeekEnd() {
    const ws = getCurrentWeekStart();
    const d = new Date(ws);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  }

  const [syncResult, setSyncResult] = useState(null);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll');
      if (response.ok) {
        const data = await response.json();
        setPayrollPeriods(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTraces = async (periodId) => {
    if (!periodId) return;
    try {
      const res = await fetch(`/api/payroll/calculate?period_id=${periodId}`);
      if (res.ok) {
        const data = await res.json();
        setTraces(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  useEffect(() => { fetchPeriods(); }, []);

  // Flow nav
  const flow = [
    { label: 'Corredores', path: '/brokers' },
    { label: 'Control Personal', path: '/control-personal-nomina' },
    { label: 'Nómina', path: '/nomina' },
    { label: 'Asistencia + Préstamos', path: '/control-personal-nomina?view=attendance' },
    { label: 'Préstamos / Adelantos', path: '/control-personal-nomina?view=deductions' },
    { label: 'Bonos', path: '/control-personal-nomina?view=bonuses' },
  ];
  const currentIndex = 2;
  const goBack = () => router.push('/');
  const goPrev = () => router.push(flow[(currentIndex - 1 + flow.length) % flow.length].path);
  const goNext = () => router.push(flow[(currentIndex + 1) % flow.length].path);

  // SYNC: Auto link attendance -> payroll
  const handleSyncFromAttendance = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const resp = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: selectedWeekStart,
          week_end_date: selectedWeekEnd,
          userName: 'Nómina'
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al sincronizar');

      setSyncResult(data);
      await fetchPeriods();

      // switch to traceability if had results
      if (data.period_id) {
        await loadTraces(data.period_id);
        setActiveTab('trazabilidad');
      }
    } catch (err) {
      alert('Error en sincronización: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Generate traceability PDF report (with company header)
  const generateTraceReport = async () => {
    if (!traces.length) {
      alert('Sincronice primero o seleccione un período que tenga datos.');
      return;
    }
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      const headerY = drawCompanyHeader(doc, null, 8);
      doc.setFontSize(14);
      doc.setTextColor(30);
      doc.text('REPORTE DE TRAZABILIDAD: ASISTENCIA → NÓMINA', 14, headerY + 8);

      doc.setFontSize(10);
      doc.text('Periodo: ' + selectedWeekStart + ' al ' + selectedWeekEnd, 14, headerY + 14);
      doc.text('Total registros trazados: ' + traces.length, 14, headerY + 19);

      let y = headerY + 28;
      doc.setFillColor(226, 232, 240);
      doc.rect(14, y - 5, pageW - 28, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(20, 30, 50);
      doc.text('Empleado', 16, y);
      doc.text('Trabajados', 70, y);
      doc.text('Faltas', 95, y);
      doc.text('Retardos', 115, y);
      doc.text('Horas Extra', 135, y);
      doc.text('Base Ajustado', 158, y);
      doc.text('Ded. Inasis.', 182, y);
      doc.text('Bono Perf.', 205, y);

      y += 6;
      let totalNet = 0;

      traces.forEach((t) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const net = parseFloat(t.calculated_net_salary || 0);
        totalNet += net;
        const em = (t.employee_name || '').substring(0, 22);
        const workDays = (parseInt(t.days_present) || 0) + (parseInt(t.days_retardo) || 0);
        doc.setFontSize(7.5);
        doc.text(em, 16, y);
        doc.text(String(workDays), 75, y);
        doc.text(String(t.absences || 0), 96, y);
        doc.text(String(t.days_retardo || 0), 117, y);
        doc.text((parseFloat(t.overtime_hours) || 0).toFixed(1), 138, y);
        doc.text('$' + (parseFloat(t.base_salary_calculated) || 0).toFixed(0), 162, y);
        doc.text('$' + (parseFloat(t.inasistencia_deduction) || 0).toFixed(0), 186, y);
        doc.text('$' + (parseFloat(t.perfect_attendance_bonus) || 0).toFixed(0), 207, y);
        y += 6;
      });

      y += 10;
      doc.setFontSize(10);
      doc.text('TOTAL NOMINA DESDE ASISTENCIA: $' + totalNet.toFixed(2), 14, y);
      doc.setFontSize(8);
      y += 8;
      doc.text('Fuente: attendance_records -> payroll_attendance_calculations (nuevo modelo vinculado)', 14, y);

      doc.save('Trazabilidad_Nomina_' + selectedWeekStart + '.pdf');
    } catch (e) {
      alert('No se pudo generar el reporte: ' + (e.message || ''));
    }
  };

  // Load traces when switching to tab and pick a period
  const handleViewTraces = async (periodId) => {
    await loadTraces(periodId);
    setActiveTab('trazabilidad');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-0 pb-12">
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-medium transition-colors">
              ← Volver a Dashboard Principal
            </button>
            <div className="text-emerald-800 font-semibold ml-1 flex items-center gap-1.5">
              <i className="ph ph-currency-dollar"></i> Nómina
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs text-slate-700 font-medium transition-colors">← Atrás</button>
            <button onClick={goNext} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs text-slate-700 font-medium transition-colors">Siguiente →</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Módulo de Nómina</h1>
            <p className="text-slate-600 mt-2">Cálculos alimentados automáticamente por asistencia. Vinculación + Trazabilidad</p>
          </div>
          <button onClick={() => router.push('/nomina')} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors">Refrescar</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button onClick={() => setActiveTab('periodos')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'periodos' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-600'}`}>Períodos de Nómina</button>
          <button onClick={() => setActiveTab('sincronizar')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'sincronizar' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-600'}`}>Sincronizar con Asistencia</button>
          <button onClick={() => setActiveTab('trazabilidad')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'trazabilidad' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-600'}`}>Reporte Trazabilidad</button>
        </div>

        {/* PERIODOS LIST - active always visible when periods tab */}
        {activeTab === 'periodos' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-slate-200 p-4 rounded-lg">
                <div className="text-sm text-slate-500">Períodos generados</div>
                <div className="text-3xl font-bold mt-1">{payrollPeriods.length}</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-lg">
                <div className="text-sm text-slate-500">Total nómina (histórico)</div>
                <div className="text-3xl font-bold mt-1">${payrollPeriods.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0).toLocaleString()}</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-lg">
                <div className="text-xs text-slate-500">Datos de asistencia se vinculan automáticamente vía módulo de cálculos</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8">
              <div className="px-6 py-3 border-b font-semibold text-sm">Listado de Períodos (vinculados con Asistencia)</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs font-semibold">Folio / Semana</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold">Empleados</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold">Monto Total</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold">Estado</th>
                      <th className="px-5 py-2 text-left text-xs font-semibold">Trazabilidad</th>
                      <th className="px-5 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-500">Cargando...</td></tr>
                    ) : payrollPeriods.length === 0 ? (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-500">Sin períodos. Utilice la pestaña "Sincronizar con Asistencia"</td></tr>
                    ) : (
                      payrollPeriods.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-slate-50">
                          <td className="px-5 py-3 text-sm">{r.folio || r.week_start_date}</td>
                          <td className="px-5 py-3 text-sm">{r.total_employees || r.record_count || 0}</td>
                          <td className="px-5 py-3 text-sm font-medium">${parseFloat(r.total_amount || 0).toLocaleString()}</td>
                          <td className="px-5 py-3"><span className="text-xs px-2 py-1 bg-slate-100 rounded">{r.status || 'pendiente'}</span></td>
                          <td className="px-5 py-3 text-sm">
                            <button onClick={() => handleViewTraces(r.id)} className="text-brand-600 hover:underline text-xs">Ver Trazabilidad Asistencia</button>
                          </td>
                          <td className="px-5 py-3 text-xs">
                            <button onClick={() => handleViewTraces(r.id)} className="text-brand-600 hover:underline text-xs">Ver Trazabilidad Asistencia</button>
                          </td>
                          <td className="px-5 py-3 text-xs space-x-1">
                            <button onClick={() => router.push(`/nomina/${r.id}`)} className="text-brand-700 hover:underline">Ver Detalle</button>
                            {(['aprobado','parcial'].includes((r.status||'').toLowerCase()) || (parseFloat(r.paid_amount||0) < parseFloat(r.total_amount||0))) && (
                              <button 
                                onClick={async () => {
                                  if (!confirm('¿Confirmar pago de nómina? (egreso bancario en esta semana, no duplica costo)')) return;
                                  const res = await fetch('/api/payroll/pay', { 
                                    method:'POST', 
                                    headers:{'Content-Type':'application/json'}, 
                                    body: JSON.stringify({ periodId: r.id, paidBy: 'Administración' }) 
                                  });
                                  const d = await res.json();
                                  if (res.ok) { alert('Pago registrado: ' + (d.message || '')); fetchPeriods(); } else alert(d.error || 'Error');
                                }}
                                className="text-emerald-700 hover:underline text-xs border px-1 rounded"
                              >Pagar</button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* SYNC TAB */}
        {activeTab === 'sincronizar' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-lg mb-3">Sincronizar con Registros de Asistencia</h3>
            <p className="text-sm text-slate-600 mb-4">Los días trabajados, faltas, retardos y horas extra de asistencia alimentan automáticamente: salario base ajustado, deducciones por inasistencia y bonificación por asistencia perfecta. Todas las validaciones se registran en el nuevo modelo payroll_attendance_calculations.</p>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <label className="text-sm">Inicio de semana:</label>
              <input type="date" value={selectedWeekStart} onChange={(e) => { setSelectedWeekStart(e.target.value); }} className="border px-3 py-1.5 rounded" />
              <label className="text-sm">Fin:</label>
              <input type="date" value={selectedWeekEnd} onChange={(e) => setSelectedWeekEnd(e.target.value)} className="border px-3 py-1.5 rounded" />
              <button onClick={handleSyncFromAttendance} disabled={syncing} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400">
                {syncing ? 'Sincronizando...' : 'SINCRONIZAR ASISTENCIA → NÓMINA'}
              </button>
            </div>

            {syncResult && (
              <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 rounded text-sm">
                <div className="font-semibold text-emerald-800">✓ Sincronización exitosa. Período ID: {syncResult.period_id}</div>
                <div>Empleados procesados: {syncResult.employee_count}. Monto calculado: ${parseFloat(syncResult.total_amount || 0).toFixed(2)}</div>
                <div className="mt-1 text-xs">Datos almacenados en modelo de trazabilidad vinculado (attendance_records + payroll_attendance_calculations).</div>
              </div>
            )}

            <div className="mt-4 text-xs text-slate-500">Reglas aplicadas: Presente + Retardo = día trabajado. Retardos restan hora equivalente. Faltas injustificadas generan deducción día completo. Bono asistencia perfecta = 1 día de salario si cero faltas y cero retardos.</div>
          </div>
        )}

        {/* TRAZABILIDAD REPORT */}
        {activeTab === 'trazabilidad' && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="font-semibold">Reporte de Trazabilidad: Asistencia a Salario Final</div>
                <div className="text-xs text-slate-500">Datos extraídos del modelo payroll_attendance_calculations vinculado con attendance_records. Validaciones automáticas incluyen registros sin datos o anomalías.</div>
              </div>
              <div className="flex gap-2">
                <button onClick={generateTraceReport} className="text-xs px-3 py-1 rounded border hover:bg-slate-100">Exportar PDF con Header</button>
                <button onClick={() => fetchPeriods()} className="text-xs px-3 py-1 rounded border">Refrescar</button>
              </div>
            </div>

            {traces.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">Sin registros de trazabilidad. Abre la pestaña Sincronizar y ejecuta el cálculo para generar el modelo vinculado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="p-2">Empleado</th>
                      <th className="p-2">Días Trabajados</th>
                      <th className="p-2">Faltas</th>
                      <th className="p-2">Retardos</th>
                      <th className="p-2">H. Extra</th>
                      <th className="p-2">Base Ajustado</th>
                      <th className="p-2">Ded. Inasistencia</th>
                      <th className="p-2">Bono Perfecta</th>
                      <th className="p-2">Neto Final</th>
                      <th className="p-2">Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((t, i) => {
                      const days = (t.days_present || 0) + (t.days_retardo || 0);
                      return (
                        <tr key={i} className="border-b hover:bg-emerald-50/50">
                          <td className="p-2 font-medium">{t.employee_name}</td>
                          <td className="p-2">{days}</td>
                          <td className="p-2 text-red-600">{t.absences || 0}</td>
                          <td className="p-2">{t.days_retardo || 0}</td>
                          <td className="p-2">{parseFloat(t.overtime_hours || 0).toFixed(1)}</td>
                          <td className="p-2"> ${parseFloat(t.base_salary_calculated || 0).toFixed(0)}</td>
                          <td className="p-2 text-orange-600">-${parseFloat(t.inasistencia_deduction || 0).toFixed(0)}</td>
                          <td className="p-2 text-green-700">+${parseFloat(t.perfect_attendance_bonus || 0).toFixed(0)}</td>
                          <td className="p-2 font-semibold"> ${parseFloat(t.calculated_net_salary || 0).toFixed(0)}</td>
                          <td className="p-2 text-xs">{t.validation_status === 'ok' ? '✓ OK' : t.validation_status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs mt-4 text-slate-500">Este reporte demuestra trazabilidad completa entre registros de asistencia y salario final calculado (modelo nuevo vinculado).</div>
          </div>
        )}
      </div>
    </div>
  );
}
