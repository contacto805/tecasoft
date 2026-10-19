'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = ['presente', 'retardo', 'falta_justificada', 'falta_injustificada', 'ausente', 'descanso', 'vacaciones', 'incapacidad', 'permiso'];

const STATUS_LABELS = {
  presente: 'Presente',
  retardo: 'Retardo',
  falta_justificada: 'Falta Justificada',
  falta_injustificada: 'Falta Injustificada',
  ausente: 'Ausente',
  descanso: 'Descanso',
  vacaciones: 'Vacaciones',
  incapacidad: 'Incapacidad',
  permiso: 'Permiso'
};

const STATUS_COLORS = {
  presente: 'bg-green-100 text-green-700',
  retardo: 'bg-yellow-100 text-orange-700',
  falta_justificada: 'bg-yellow-100 text-yellow-700',
  falta_injustificada: 'bg-red-100 text-red-700',
  ausente: 'bg-gray-100 text-gray-700',
  descanso: 'bg-blue-100 text-blue-700',
  vacaciones: 'bg-purple-100 text-purple-700',
  incapacidad: 'bg-orange-100 text-orange-700',
  permiso: 'bg-gray-100 text-gray-700'
};

export default function ControlPersonalNominaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({
    activeEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    weekHours: 0,
    weekPayroll: 0,
    weekBonuses: 0,
    weekDeductions: 0
  });
  const [viewMode, setViewMode] = useState('attendance'); // 'attendance', 'bonuses', 'deductions', 'payroll'
  const [biometricDevices, setBiometricDevices] = useState([]);
  const [showBiometricGuide, setShowBiometricGuide] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    deviceName: '', deviceModel: '', deviceSerial: '', connectionType: 'network', ipAddress: '', port: ''
  });

  // UNIFIED: Préstamos y Adelantos (asistencia + prestamos + adelantos in one module)
  const [loans, setLoans] = useState([]);
  const [loanLoading, setLoanLoading] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [newLoan, setNewLoan] = useState({
    employee_id: '', employee_name: '', amount: '', type: 'prestamo', reason: '', descuento_semanal: '', num_semanas: '', fecha_prestamo: new Date().toISOString().split('T')[0]
  });
  const [loanActionLoading, setLoanActionLoading] = useState(false);

  // Initialize viewMode from URL query if coming from nav (Atrás/Siguiente contextual) 
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const v = sp.get('view');
      if (v === 'bonuses' || v === 'bonos') setViewMode('bonuses');
      else if (v === 'payroll' || v === 'nomina') setViewMode('payroll');
      else if (v === 'attendance' || v === 'asistencia') setViewMode('attendance');
    }
  }, []);

  // Helpers: compute Monday-Sunday for the selected date (bonos semanales)
  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const ws = new Date(d.setDate(diff));
    return ws.toISOString().split('T')[0];
  };
  const getWeekEnd = (dateStr) => {
    const ws = getWeekStart(dateStr);
    const d = new Date(ws);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  };

  // Use new engine fields (effective_hours + jornada_pagable + discount_amount)
  const getEffectivePayment = (emp) => {
    const daily = Number(emp.daily_salary || 0) || 0;
    if (emp.jornada_pagable === 'turno_completo') return daily;
    if (emp.jornada_pagable === 'medio_turno') return daily * 0.5;
    const eff = Number(emp.effective_hours || emp.hours_worked || 0);
    if (eff >= 7.8) return daily;
    if (eff >= 3.8) return daily * 0.5;
    return 0;
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const loadBiometricDevices = async () => {
    try {
      const res = await fetch('/api/biometric/devices');
      if (res.ok) {
        const data = await res.json();
        setBiometricDevices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // silent
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch employees
      const empRes = await fetch('/api/employees');
      const empData = await empRes.ok ? await empRes.json() : [];
      setEmployees(Array.isArray(empData) ? empData : []);

      // Fetch today's attendance
      const attRes = await fetch(`/api/attendance?date=${selectedDate}`);
      const attData = await attRes.ok ? await attRes.json() : [];

      loadBiometricDevices();
      
      // Fetch existing bonos extra for the week (sumados a la semana)
      const weekStart = getWeekStart(selectedDate);
      const bonRes = await fetch(`/api/payroll/bonuses?week_start=${weekStart}&bonus_type=extra`);
      const bonData = bonRes.ok ? await bonRes.json() : [];

      // Merge with new engine fields (schedule, effective, jornada, discount)
      const merged = empData.map(emp => {
        const record = attData.find(a => a.employee_id === emp.employee_id);
        const bonusRec = bonData.find(b => b.employee_id === emp.employee_id);
        return {
          ...emp,
          attendance_id: record?.id || null,
          check_in_time: record?.check_in_time || null,
          check_out_time: record?.check_out_time || null,
          hours_worked: record?.hours_worked || 0,
          effective_hours: record?.effective_hours || record?.hours_worked || 0,
          overtime_hours: record?.overtime_hours || 0,
          late_minutes: record?.late_minutes || 0,
          retardo_minutes: record?.retardo_minutes || 0,
          early_exit_minutes: record?.early_exit_minutes || 0,
          discount_amount: Number(record?.discount_amount || 0),
          jornada_pagable: record?.jornada_pagable || null,
          schedule_type: record?.schedule_type || emp.schedule_type || 'fijo',
          jornada_type: record?.jornada_type || emp.jornada_type || 'completa',
          status: record?.status || 'ausente',
          observations: record?.observations || '',
          extra_bonus: Number(bonusRec?.amount || 0)
        };
      });
      
      // Calculate stats with weekly extra bonuses
      const present = merged.filter(e => ['presente', 'retardo'].includes(e.status)).length;
      const absent = merged.filter(e => !e.attendance_id || ['falta_justificada', 'falta_injustificada', 'ausente'].includes(e.status)).length;
      const weekHours = merged.reduce((sum, e) => sum + Number(e.hours_worked || 0), 0);
      const weekPayroll = merged.reduce((sum, e) => sum + getEffectivePayment(e), 0);
      const weekBonuses = merged.reduce((sum, e) => sum + (Number(e.extra_bonus || 0)), 0);

      // Load loans and compute weekly deductions from Préstamos y Adelantos section
      const loansRes = await fetch('/api/prestamos');
      const loansData = loansRes.ok ? await loansRes.json() : [];
      const activeLoansData = Array.isArray(loansData) ? loansData : [];

      const weekLoanMap = {};
      let totalWeekLoanDeds = 0;
      activeLoansData.forEach(l => {
        const st = (l.estado || l.status || '').toLowerCase();
        if (['liquidado','pagado','rechazado'].includes(st)) return;
        const ded = Number(l.descuento_semanal || l.descuento_semanal_aplicado || 0);
        if (ded > 0 && l.employee_id) {
          weekLoanMap[l.employee_id] = (weekLoanMap[l.employee_id] || 0) + ded;
          totalWeekLoanDeds += ded;
        }
      });

      // Merge loan deductions into attendance for preview (deduct from pago semanal)
      const mergedWithLoans = merged.map(emp => ({
        ...emp,
        loan_deduction: weekLoanMap[emp.employee_id] || 0
      }));

      setAttendance(mergedWithLoans);
      setLoans(activeLoansData);

      setStats({
        activeEmployees: empData.length,
        presentToday: present,
        absentToday: absent,
        weekHours: weekHours,
        weekPayroll: weekPayroll,
        weekBonuses: weekBonuses,
        weekDeductions: Math.round(totalWeekLoanDeds * 100) / 100
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('No fue posible cargar la información. Verifique su conexión.');
    } finally {
      setLoading(false);
    }
  };

  const loadLoans = async () => {
    try {
      setLoanLoading(true);
      const res = await fetch('/api/prestamos');
      const data = res.ok ? await res.json() : [];
      setLoans(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoans([]);
    } finally {
      setLoanLoading(false);
    }
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    try {
      const employee = attendance.find(e => e.employee_id === employeeId);
      if (!employee) return;

      const isRetardo = newStatus === 'retardo';
      let updatedLocal = { ...employee, status: newStatus };
      if (isRetardo) {
        const curH = Number(employee.hours_worked || 0) || 8;
        updatedLocal.hours_worked = Math.max(0, (curH - 1)).toFixed(2);
        updatedLocal.late_minutes = 60;
      } else if (employee.status === 'retardo' && newStatus !== 'retardo') {
        updatedLocal.late_minutes = 0;
      }

      // Update local state immediately
      setAttendance(prev => prev.map(e => 
        e.employee_id === employeeId ? updatedLocal : e
      ));

      // Save to backend - include retardo adjustments
      const payload = {
        employeeId: updatedLocal.employee_id,
        employeeName: updatedLocal.employee_name,
        date: selectedDate,
        status: newStatus,
        hours_worked: updatedLocal.hours_worked,
        late_minutes: isRetardo ? 60 : 0,
        isManual: true,
        manualEntryReason: `Estatus cambiado a ${STATUS_LABELS[newStatus] || newStatus}`,
        manualEntryBy: 'Administración'
      };

      if (employee.attendance_id) {
        // Update existing record
        await fetch('/api/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: employee.attendance_id,
            status: newStatus,
            late_minutes: isRetardo ? 60 : undefined,
            hours_worked: updatedLocal.hours_worked,
            manualEntryReason: payload.manualEntryReason,
            authorizedBy: payload.manualEntryBy
          })
        });
      } else {
        // Create new record
        await fetch('/api/attendance/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

    } catch (error) {
      console.error('Error updating status:', error);
      alert('No se pudo actualizar el estatus');
      fetchData(); // Reload data
    }
  };

  const handleTimeChange = async (employeeId, field, value) => {
    try {
      const employee = attendance.find(e => e.employee_id === employeeId);
      if (!employee || !employee.attendance_id) return;

      // Update local state
      setAttendance(prev => prev.map(e => {
        if (e.employee_id === employeeId) {
          const updated = { ...e, [field]: value };
          // Recalculate hours if both times exist
          if (updated.check_in_time && updated.check_out_time) {
            const checkIn = new Date(`${selectedDate}T${updated.check_in_time}`);
            const checkOut = new Date(`${selectedDate}T${updated.check_out_time}`);
            const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            updated.hours_worked = Math.max(0, hours).toFixed(2);
          }
          return updated;
        }
        return e;
      }));

      // Save to backend - use current value or provided
      const useCheckIn = field === 'check_in_time' ? `${selectedDate}T${value}:00` : (employee.check_in_time || null);
      const useCheckOut = field === 'check_out_time' ? `${selectedDate}T${value}:00` : (employee.check_out_time || null);
      await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: employee.attendance_id,
          checkInTime: useCheckIn,
          checkOutTime: useCheckOut,
          manualEntryReason: 'Ajuste manual de horario',
          authorizedBy: 'Administración'
        })
      });

    } catch (error) {
      console.error('Error updating time:', error);
    }
  };

  const handleObservationsChange = async (employeeId, observations) => {
    try {
      const employee = attendance.find(e => e.employee_id === employeeId);
      if (!employee || !employee.attendance_id) return;

      await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: employee.attendance_id,
          observations,
          authorizedBy: 'Administración'
        })
      });

    } catch (error) {
      console.error('Error updating observations:', error);
    }
  };

  // Gestión de Bono Extra (por empleado - se suma a la semana)
  const updateLocalBonus = (employeeId, amount) => {
    const parsed = Math.max(0, Number(amount) || 0);
    setAttendance(prev => prev.map(e =>
      e.employee_id === employeeId ? { ...e, extra_bonus: parsed } : e
    ));
  };

  const saveExtraBonus = async (employeeId, employeeName, department, amount) => {
    try {
      const weekStart = getWeekStart(selectedDate);
      const weekEnd = getWeekEnd(selectedDate);
      await fetch('/api/payroll/bonuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          employee_name: employeeName,
          department: department || '',
          amount: amount || 0,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          bonus_type: 'extra',
          concept: 'Bono Extra',
          authorized_by: 'Administración'
        })
      });
      // refresh to sync estatísticas
      await fetchData();
    } catch (error) {
      console.error('Error saving bono:', error);
      alert('No se pudo guardar el bono extra');
    }
  };

  const saveAllBonuses = async () => {
    try {
      setSaving(true);
      const weekStart = getWeekStart(selectedDate);
      const weekEnd = getWeekEnd(selectedDate);

      for (const emp of attendance) {
        await fetch('/api/payroll/bonuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: emp.employee_id,
            employee_name: emp.employee_name,
            department: emp.department || '',
            amount: emp.extra_bonus || 0,
            week_start_date: weekStart,
            week_end_date: weekEnd,
            bonus_type: 'extra',
            concept: 'Bono Extra',
            authorized_by: 'Administración'
          })
        });
      }
      await fetchData();
    } catch (error) {
      console.error('Error saving all bonuses:', error);
      alert('Ocurrió un problema al guardar bonos');
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    alert('Funcionalidad de exportar a Excel próximamente');
  };

  const generatePayroll = () => {
    router.push('/nomina');
  };

  // PROGRAMACIÓN HORARIOS MAÑANA (per spec: un día antes, flexible)
  const [progDate, setProgDate] = useState(new Date(Date.now()+86400000).toISOString().split('T')[0]);
  const [progList, setProgList] = useState([]);

  const loadProg = async () => {
    const res = await fetch(`/api/attendance?date=${progDate}`);
    const data = await res.json();
    setProgList(Array.isArray(data) ? data : []);
  };

  const programarManana = async (emp, tipo) => {
    const hora = prompt(`Hora entrada programada para ${emp.employee_name} (HH:MM)`, tipo === 'media' ? '08:00' : '07:00');
    if (!hora) return;
    // Save as manual schedule note via attendance record or schedule assignment (simplified)
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: emp.employee_id,
        employeeName: emp.employee_name,
        date: progDate,
        type: 'check_in',
        isManual: true,
        manualEntryReason: `Programación ${tipo} mañana ${hora}`,
        manualEntryBy: 'Encargado Empaque'
      })
    });
    alert('Programación guardada. El cálculo usará el horario al registrar entrada real.');
    await loadProg();
  };

  // Navigation helpers (consistent across modules)
  const goBack = () => router.push('/');
  const goPrev = () => router.push('/brokers');
  const goNext = () => router.push('/nomina');

  // Marcado rápido manual; para datos reales de BioTime Cloud 2.0 usa "Sincronizar" con URL + credenciales admin
  const markBiometric = async (employee, type = 'check_in') => {
    try {
      const activeNet = biometricDevices.find(d => d.is_active && d.ip_address);
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.employee_id,
          employeeName: employee.employee_name,
          type,
          isManual: !activeNet,
          deviceId: activeNet?.id || null,
          manualEntryBy: activeNet ? 'BioTime Cloud' : 'Biométrico',
          manualEntryReason: activeNet ? 'Sincronizado vía IP Bio Time Cloud' : 'Marcado biométrico rápido'
        })
      });
      const data = await res.json();
      if (res.ok) {
        fetchData();
      } else {
        alert(data.error || 'No se pudo registrar');
      }
    } catch (err) {
      alert('Error al marcar');
    }
  };

  const registerFingerprint = async (employee) => {
    try {
      const template = 'sim-' + btoa(String(employee.employee_id) + Date.now());
      const res = await fetch('/api/biometric/fingerprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.employee_id,
          employeeName: employee.employee_name,
          fingerprintTemplate: template,
          fingerPosition: 'index_right',
          registeredBy: 'Administración'
        })
      });
      if (res.ok) {
        alert('Huella registrada. Para huellas reales desde el lector, use la sincronización del Bio Time Cloud o el servicio de su modelo de lector.');
      } else {
        const err = await res.json();
        alert(err.error || 'Ya registrada u error');
      }
    } catch (e) {
      alert('Error registrando huella');
    }
  };

  const saveBiometricDevice = async () => {
    if (!deviceForm.deviceName) {
      alert('Nombre del dispositivo es obligatorio');
      return;
    }
    try {
      await fetch('/api/biometric/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: deviceForm.deviceName,
          deviceModel: deviceForm.deviceModel,
          deviceSerial: deviceForm.deviceSerial,
          connectionType: deviceForm.connectionType,
          ipAddress: (deviceForm.connectionType === 'network' || deviceForm.connectionType === 'cloud') ? deviceForm.ipAddress : null,
          port: deviceForm.port ? parseInt(deviceForm.port) : null
        })
      });
      await loadBiometricDevices();
      setDeviceForm({ deviceName: '', deviceModel: '', deviceSerial: '', connectionType: 'network', ipAddress: '', port: '' });
      alert('Lector registrado. Usa Sincronizar y proporciona URL + usuario/contraseña admin de BioTime Cloud.');
    } catch (e) {
      alert('Error al registrar dispositivo');
    }
  };

  // Sync real attendance punches from Bio Time Cloud 2.0 via IP/URL of the reader cloud service
  const syncFromBioTimeCloud = async (specificDevice = null) => {
    const activeDevices = biometricDevices.filter(d => d.is_active);
    let target = specificDevice || activeDevices.find(d => d.ip_address) || activeDevices[0];
    
    let bioTimeUrl = target?.ip_address;
    if (!bioTimeUrl) {
      bioTimeUrl = prompt('URL base de tu Bio Time Cloud 2.0 (ej: https://tuempresa.biotimecloud.com o http://IP-del-cloud):', '');
      if (!bioTimeUrl) return;
    }

    // Información que subes para enlazar: usuario y contraseña de administrador de BioTime Cloud (para obtener token)
    const user = prompt('Usuario administrador de Bio Time Cloud (el de la consola):', '') || '';
    const pass = user ? (prompt('Contraseña del administrador:', '') || '') : '';

    try {
      const res = await fetch('/api/payroll/biotime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all',
          bioTimeUrl,
          username: user || undefined,
          password: pass || undefined,
          weekStart: getWeekStart(selectedDate),
          weekEnd: getWeekEnd(selectedDate)
        })
      });
      const data = await res.json();
      if (res.ok) {
        const syncedAtt = data.attendance?.synced || data.synced || 0;
        alert(`BioTime Cloud: empleados + ${syncedAtt} checadas reales importadas (emp_code + punch).`);
        if (target?.id) {
          await fetch('/api/biometric/devices', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: target.id, deviceName: target.device_name, lastSync: new Date().toISOString() })
          });
          await loadBiometricDevices();
        }
        await fetchData();
      } else {
        alert(data.error || 'Verifica la URL base + usuario/contraseña admin de BioTime Cloud.');
      }
    } catch (e) {
      alert('Error conectando al Bio Time Cloud por IP.');
    }
  };

  const toggleDeviceActive = async (dev) => {
    try {
      await fetch('/api/biometric/devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dev.id,
          deviceName: dev.device_name,
          isActive: !dev.is_active
        })
      });
      await loadBiometricDevices();
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-0 pb-12">
      {/* Top Navigation - always accessible */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={goBack}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-medium transition-colors"
            >
              ← Volver a Dashboard Principal
            </button>
            <div className="text-emerald-800 font-semibold ml-1 flex items-center gap-1.5">
              <i className="ph ph-users"></i> Control de Personal y Nómina
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs text-slate-700 font-medium transition-colors">
              ← Atrás
            </button>
            <button onClick={goNext} className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs text-slate-700 font-medium transition-colors">
              Siguiente →
            </button>
          </div>
        </div>
      </header>

      {/* Programación de personal mañana - requisito clave del módulo */}
      <div className="max-w-7xl mx-auto px-4 mt-2 mb-4 bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Programación de Personal de Mañana (Flexible)</div>
          <div className="text-xs text-slate-500">Registra un día antes • Copia del día anterior • El sistema calcula salida + 40min ventana</div>
        </div>
        <div className="flex gap-2 items-center mb-2">
          <input type="date" value={progDate} onChange={e=>setProgDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={loadProg} className="px-3 py-1 text-sm border rounded">Cargar</button>
          <button onClick={() => employees.slice(0,6).forEach(e => programarManana(e, 'completa'))} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Copiar horarios día anterior (demo)</button>
        </div>
        <div className="text-[11px] text-slate-500">Por cada trabajador: No trabaja / Turno completo (9h permanencia, 8 efectivas -1h comida) / Medio turno (4h). Autorización extra al día siguiente por Encargado.</div>
      </div>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-16">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Asistencia • Préstamos y Adelantos</h1>
              <p className="text-slate-600 mt-2">Módulo unificado. Un dato se captura una vez y fluye a nómina, gastos, balance y cierres automáticamente.</p>
            </div>
            <div className="flex gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button 
                onClick={() => router.push('/empleados')}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800"
              >
                Editar Empleados
              </button>
              <button 
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Exportar Excel
              </button>
              <button 
                onClick={generatePayroll}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700"
              >
                Generar Nómina
              </button>
              <button 
                onClick={async () => { 
                  for (const e of attendance) { 
                    await fetch('/api/attendance/calculate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({employeeId: e.employee_id, date: selectedDate}) }); 
                  } 
                  fetchData(); 
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 text-sm"
              >
                Recalcular motor
              </button>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('attendance')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'attendance'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Asistencia
            </button>
            <button
              onClick={() => setViewMode('bonuses')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'bonuses'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Bonos
            </button>
            <button
              onClick={() => setViewMode('deductions')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'deductions'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Préstamos y Adelantos
            </button>
            <button
              onClick={() => setViewMode('payroll')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'payroll'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Pre-Nómina
            </button>
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Personal Activo</p>
              <p className="text-3xl font-bold text-slate-900">{stats.activeEmployees}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Presente Hoy</p>
              <p className="text-3xl font-bold text-green-600">{stats.presentToday}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ausente</p>
              <p className="text-3xl font-bold text-red-600">{stats.absentToday}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Horas Semana</p>
              <p className="text-3xl font-bold text-slate-900">{stats.weekHours}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Costo Nómina</p>
              <p className="text-3xl font-bold text-brand-600">${Number(stats.weekPayroll || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bonos</p>
              <p className="text-3xl font-bold text-green-600">${Number(stats.weekBonuses || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Descuentos</p>
              <p className="text-3xl font-bold text-orange-600">${Number(stats.weekDeductions || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        {viewMode === 'attendance' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-900">Registro de Asistencia - {new Date(selectedDate).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowBiometricGuide(true)}
                    className="px-4 py-2 bg-blue-700 text-white text-sm rounded-lg font-medium hover:bg-blue-800 flex items-center gap-2"
                  >
                    Conectar lector (IP / Bio Time Cloud)
                  </button>
                  <button 
                    onClick={() => router.push('/empleados')}
                    className="px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg font-medium hover:bg-emerald-800 flex items-center gap-2"
                  >
                    Editar Empleados
                  </button>
                </div>
              </div>

              {/* Dispositivos Biométricos Configurados */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-700">Lectores biométricos registrados ({biometricDevices.length})</div>
                  <button 
                    onClick={() => syncFromBioTimeCloud()} 
                    className="px-3 py-1 bg-emerald-700 text-white text-xs rounded hover:bg-emerald-800"
                  >
                    Sincronizar BioTime Cloud (IP)
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 items-start">
                  {biometricDevices.length > 0 ? biometricDevices.map(d => (
                    <div key={d.id} className="bg-white px-3 py-1 rounded border text-xs flex items-center gap-2">
                      <span className={d.is_active ? 'text-green-600' : 'text-gray-400'}>●</span>
                      <span>{d.device_name}</span>
                      {d.ip_address && <span className="text-emerald-700 font-mono">{d.ip_address}</span>}
                      <span className="text-slate-500">({d.connection_type})</span>
                      <button onClick={() => toggleDeviceActive(d)} className="text-[10px] underline hover:no-underline">{(d.is_active ? 'Desactivar' : 'Activar')}</button>
                      {d.ip_address && <button onClick={() => syncFromBioTimeCloud(d)} className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white rounded">Sync</button>}
                    </div>
                  )) : <span className="text-xs text-slate-400">Ningún lector registrado. Regístrelo abajo (usa Red/IP para Bio Time Cloud).</span>}
                </div>

                {/* Form rápido para agregar dispositivo */}
                <div className="mt-3 pt-3 border-t flex flex-wrap items-end gap-2 text-xs">
                  <input 
                    type="text" 
                    placeholder="Nombre del lector" 
                    value={deviceForm.deviceName} 
                    onChange={e => setDeviceForm({...deviceForm, deviceName: e.target.value})} 
                    className="border px-2 py-1 rounded w-40" 
                  />
                  <input 
                    type="text" 
                    placeholder="Modelo (ej. ZK4500)" 
                    value={deviceForm.deviceModel} 
                    onChange={e => setDeviceForm({...deviceForm, deviceModel: e.target.value})} 
                    className="border px-2 py-1 rounded w-28" 
                  />
                  <select 
                    value={deviceForm.connectionType} 
                    onChange={e => setDeviceForm({...deviceForm, connectionType: e.target.value})}
                    className="border px-2 py-1 rounded"
                  >
                    <option value="network">Red / IP (Bio Time Cloud)</option>
                    <option value="usb">USB (local)</option>
                    <option value="cloud">Cloud URL</option>
                    <option value="serial">Serial</option>
                  </select>
                  {deviceForm.connectionType === 'network' && (
                    <>
                      <input type="text" placeholder="IP" value={deviceForm.ipAddress} onChange={e => setDeviceForm({...deviceForm, ipAddress: e.target.value})} className="border px-2 py-1 rounded w-28"/>
                      <input type="text" placeholder="Puerto" value={deviceForm.port} onChange={e => setDeviceForm({...deviceForm, port: e.target.value})} className="border px-2 py-1 rounded w-16"/>
                    </>
                  )}
                  <button onClick={saveBiometricDevice} className="px-4 py-1 bg-slate-800 text-white rounded text-xs">+ Agregar lector</button>
                  <div className="text-[10px] text-slate-400 ml-1 mt-0.5">Registra URL/IP de BioTime Cloud • al Sync proporciona tu usuario y contraseña admin de la nube</div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brand-50 border-b border-brand-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Foto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">No.</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Área</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Puesto</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Entrada</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Salida</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Efectivas</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Jornada</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Desc.</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Estatus</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-green-700 uppercase tracking-wider">Bono Extra</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-blue-700 uppercase tracking-wider">Asistencia Biométrica</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-brand-900 uppercase tracking-wider">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((emp) => (
                    <tr key={emp.employee_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <img 
                          src={emp.photo_url || 'https://via.placeholder.com/40'} 
                          alt={emp.employee_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{emp.employee_number}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{emp.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{emp.department}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{emp.position}</td>
                      <td className="px-4 py-3">
                        <input
                          type="time"
                          value={emp.check_in_time ? new Date(emp.check_in_time).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => handleTimeChange(emp.employee_id, 'check_in_time', e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="time"
                          value={emp.check_out_time ? new Date(emp.check_out_time).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => handleTimeChange(emp.employee_id, 'check_out_time', e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{Number(emp.effective_hours || emp.hours_worked || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs">{emp.jornada_pagable || emp.jornada_type || '-'}</td>
                      <td className="px-4 py-3 text-xs text-orange-700 font-medium">{emp.discount_amount > 0 ? '-$' + Number(emp.discount_amount || 0).toFixed(0) : ''}</td>
                      <td className="px-4 py-3">
                        <input
                           type="number"
                           step={0.01}
                           min={0}
                           value={Number(emp.extra_bonus || 0)}
                          onChange={(e) => updateLocalBonus(emp.employee_id, e.target.value)}
                          onBlur={() => saveExtraBonus(emp.employee_id, emp.employee_name, emp.department, emp.extra_bonus)}
                          className="w-20 px-2 py-0.5 text-right border border-slate-300 rounded text-xs text-green-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <button onClick={() => markBiometric(emp, 'check_in')} className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700">Entrada</button>
                          <button onClick={() => markBiometric(emp, 'check_out')} className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-medium hover:bg-rose-700">Salida</button>
                          <button onClick={() => registerFingerprint(emp)} className="text-[10px] px-2 py-0.5 rounded bg-indigo-700 text-white font-medium hover:bg-indigo-800" title="Registra huella de prueba. Las marcas reales vienen del Bio Time Cloud vía IP.">+ Huella</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={emp.observations || ''}
                          onChange={(ev) => {
                            setAttendance(prev => prev.map(item => 
                              item.employee_id === emp.employee_id ? { ...item, observations: ev.target.value } : item
                            ));
                          }}
                          onBlur={(e) => handleObservationsChange(emp.employee_id, e.target.value)}
                          placeholder="Observaciones..."
                          className="px-2 py-1 border border-slate-300 rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bonuses View: Bono Extra por Empleado (suma a semana) */}
        {viewMode === 'bonuses' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Bono Extra por Empleado - Semana del {getWeekStart(selectedDate)} al {getWeekEnd(selectedDate)}</h2>
                <p className="text-sm text-slate-600 mt-1">Este monto se suma automáticamente al cálculo de nómina semanal del trabajador.</p>
              </div>
              <button 
                onClick={saveAllBonuses} 
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar todos los bonos'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Área / Puesto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Salario Diario</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-green-700">Bono Extra (MXN)</th>
                    <th className="px-4 py-3 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((emp) => (
                    <tr key={emp.employee_id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{emp.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{emp.department || '-'} / {emp.position || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">${Number(emp.daily_salary || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                         <input 
                           type="number" 
                           step={0.01} 
                           min={0} 
                           value={emp.extra_bonus || 0}
                          onChange={(e) => updateLocalBonus(emp.employee_id, e.target.value)}
                          onBlur={() => saveExtraBonus(emp.employee_id, emp.employee_name, emp.department, emp.extra_bonus)}
                          className="w-full px-3 py-1.5 text-right border border-slate-300 rounded-lg text-green-700 font-medium focus:ring-brand-500"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => saveExtraBonus(emp.employee_id, emp.employee_name, emp.department, emp.extra_bonus)}
                          className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                        >
                          Guardar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600">No hay empleados activos.</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold" colSpan={3}>Total Bonos Extra Semana</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      ${attendance.reduce((s, e) => s + Number(e.extra_bonus || 0), 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Deductions View - FULLY UNIFIED with Asistencia: Préstamos + Adelantos (single source, automatic flow) */}
        {viewMode === 'deductions' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Préstamos y Adelantos • Descuentos de Nómina</h2>
                <p className="text-sm text-slate-600">Unificado con Asistencia. Los descuentos semanales se aplican automáticamente al sincronizar nómina.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowLoanForm(!showLoanForm)} className="px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg">+ Nuevo Préstamo / Adelanto</button>
                <button onClick={loadLoans} className="px-3 py-2 border text-sm rounded-lg">Refrescar</button>
                <button 
                  onClick={async () => {
                    const ws = getWeekStart(selectedDate);
                    const we = getWeekEnd(selectedDate);
                    try {
                      await fetch('/api/payroll/calculate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ week_start_date: ws, week_end_date: we })
                      });
                      await loadLoans();
                      await fetchData();
                      alert('Descuentos semanales aplicados a Préstamos y Adelantos. Saldos actualizados y historial conservado.');
                    } catch(e){ alert('No se pudo aplicar'); }
                  }}
                  className="px-3 py-2 bg-orange-600 text-white text-sm rounded-lg"
                >
                  Aplicar desc. semanales (actualiza saldos)
                </button>
              </div>
            </div>

            {/* Quick New Loan Form */}
            {showLoanForm && (
              <div className="p-6 bg-slate-50 border-b">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <select value={newLoan.employee_id} onChange={e => {
                    const emp = employees.find(en => en.employee_id === e.target.value);
                    setNewLoan({...newLoan, employee_id: e.target.value, employee_name: emp ? emp.employee_name : newLoan.employee_name});
                  }} className="border p-2 rounded text-sm">
                    <option value="">Empleado...</option>
                    {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee_name}</option>)}
                  </select>
                  <input type="number" placeholder="Monto" value={newLoan.amount} onChange={e=>setNewLoan({...newLoan, amount:e.target.value})} className="border p-2 rounded text-sm" />
                  <select value={newLoan.type} onChange={e=>setNewLoan({...newLoan, type:e.target.value})} className="border p-2 rounded text-sm">
                    <option value="prestamo">Préstamo</option>
                    <option value="adelanto">Adelanto</option>
                  </select>
                  <input placeholder="Desc. semanal" type="number" value={newLoan.descuento_semanal} onChange={e=>setNewLoan({...newLoan, descuento_semanal:e.target.value})} className="border p-2 rounded text-sm" />
                  <input placeholder="Semanas" type="number" value={newLoan.num_semanas} onChange={e=>setNewLoan({...newLoan, num_semanas:e.target.value})} className="border p-2 rounded text-sm" />
                </div>
                <input placeholder="Motivo / concepto" value={newLoan.reason} onChange={e=>setNewLoan({...newLoan, reason:e.target.value})} className="border p-2 rounded text-sm w-full mt-3" />
                <div className="flex gap-2 mt-3">
                  <button disabled={loanActionLoading} onClick={async () => {
                    if (!newLoan.employee_id || !newLoan.amount) return alert('Empleado y monto requeridos');
                    setLoanActionLoading(true);
                    try {
                      await fetch('/api/prestamos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                        employee_id: newLoan.employee_id, employee_name: newLoan.employee_name || 'Empleado',
                        amount: Number(newLoan.amount), type: newLoan.type, reason: newLoan.reason || 'Préstamo/adelanto desde Asistencia',
                        fecha_prestamo: newLoan.fecha_prestamo, descuento_semanal: Number(newLoan.descuento_semanal)||0, num_semanas: parseInt(newLoan.num_semanas)||4
                      })});
                      setShowLoanForm(false);
                      setNewLoan({employee_id:'',employee_name:'',amount:'',type:'prestamo',reason:'',descuento_semanal:'',num_semanas:'',fecha_prestamo:new Date().toISOString().split('T')[0]});
                      await loadLoans();
                      await fetchData();
                    } catch(e){ alert('Error al registrar'); } finally { setLoanActionLoading(false); }
                  }} className="px-4 py-2 bg-emerald-700 text-white text-sm rounded">Registrar</button>
                  <button onClick={()=>setShowLoanForm(false)} className="px-4 py-2 border text-sm rounded">Cancelar</button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Al aprobar se genera egreso automático en Gastos y fluye a Balance y Cierres. Al sincronizar nómina se descuenta automáticamente.</div>
              </div>
            )}

            {/* Loans list - unified view */}
            <div className="p-4">
              <div className="text-sm font-semibold mb-2">Préstamos / Adelantos Activos ({loans.filter(l => !['liquidado','pagado','rechazado'].includes((l.estado||l.status||'').toLowerCase())).length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Folio</th>
                      <th className="p-2 text-left">Empleado</th>
                      <th className="p-2 text-right">Monto</th>
                      <th className="p-2 text-right">Desc. Sem.</th>
                      <th className="p-2 text-right">Saldo</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanLoading ? <tr><td colSpan={7} className="p-3 text-center text-xs">Cargando...</td></tr> : loans.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-slate-500 text-xs">Sin préstamos registrados. Usa el formulario arriba.</td></tr> : loans.slice(0,12).map((ln) => {
                      const monto = Number(ln.monto_original || ln.amount || 0);
                      const desc = Number(ln.descuento_semanal || ln.descuento_semanal_aplicado || 0);
                      const saldo = Number(ln.saldo_pendiente || ln.remaining_balance || 0);
                      const st = (ln.estado || ln.status || 'pendiente').toLowerCase();
                      const isPend = st.includes('pend');
                      return (
                        <tr key={ln.id || ln.folio || Math.random()} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-mono text-xs">{ln.folio || `PR-${ln.id}`}</td>
                          <td className="p-2">{ln.employee_name}</td>
                          <td className="p-2 text-right">${monto.toLocaleString('es-MX')}</td>
                          <td className="p-2 text-right text-emerald-700">${desc.toLocaleString('es-MX')}</td>
                          <td className="p-2 text-right font-semibold">${saldo.toLocaleString('es-MX')}</td>
                          <td className="p-2 text-center"><span className={`px-2 py-0.5 text-xs rounded ${st.includes('aprob')||st.includes('activo')?'bg-emerald-100 text-emerald-700':st.includes('rech')?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{ln.estado || ln.status || 'Pendiente'}</span></td>
                          <td className="p-2 text-right space-x-1">
                            {isPend && <button onClick={async()=>{ setLoanActionLoading(true); await fetch(`/api/prestamos/${ln.id}/approve`,{method:'POST'}); await loadLoans(); setLoanActionLoading(false); }} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded">Aprobar</button>}
                            {isPend && <button onClick={async()=>{ if(!confirm('Rechazar?'))return; await fetch(`/api/prestamos/${ln.id}/reject`,{method:'POST'}); await loadLoans(); }} className="text-xs px-2 py-1 border rounded">Rechazar</button>}
                            <button onClick={() => router.push(`/prestamos/${ln.id}`)} className="text-xs px-2 py-1 border rounded">Ver</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">Los descuentos semanales activos se restan automáticamente al calcular/sincronizar la nómina (ver pestaña Pre-Nómina y Sincronizar en Nómina). Abonos registrados aquí actualizan el saldo en tiempo real.</div>
            </div>
          </div>
        )}

        {/* Modal: Guía precisa de conexión de lector biométrico */}
        {showBiometricGuide && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={() => setShowBiometricGuide(false)}>
            <div className="bg-white max-w-3xl w-full rounded-xl shadow-xl p-6 max-h-[90vh] overflow-auto text-sm" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Cómo conectar un lector biométrico real</h3>
                <button onClick={() => setShowBiometricGuide(false)} className="text-xl leading-none px-3 py-1 hover:bg-slate-100 rounded">×</button>
              </div>

              <div className="space-y-5 text-slate-700">
                <div>
                  <div className="font-semibold mb-1 text-emerald-700">Conexión por IP / URL a Bio Time Cloud 2.0</div>
                  <p>Registre la URL base de BioTime Cloud 2.0 (tipo Red/IP). Al sincronizar ingrese el usuario y contraseña de administrador para obtener el token y extraer checadas reales (emp_code + punch_time).</p>
                </div>

                <div>
                  <div className="font-semibold mb-1 text-blue-700">Información que debes subir para enlazar</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li><strong>URL base</strong> de tu instancia (ej. https://biotimecloud.com o https://tuempresa.biotimecloud.com o la IP del cloud)</li>
                    <li><strong>Usuario administrador</strong> creado en la consola de BioTime Cloud</li>
                    <li><strong>Contraseña</strong> de ese usuario (se usa solo para obtener token JWT en el backend)</li>
                  </ul>
                  <p className="text-xs mt-1">El sistema hace POST para token, luego GET /personnel/api/employees/ y /iclock/api/transactions/ filtrando por fechas. Emp_code debe coincidir con el ID de empleado en tu nómina.</p>
                </div>

                <div>
                  <div className="font-semibold mb-1 text-blue-700">Pasos</div>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    <li>Agrega lector con tipo Red/IP y pon la URL base en el campo IP.</li>
                    <li>Presiona Sincronizar BioTime Cloud — ingresa usuario y contraseña admin cuando te pida.</li>
                    <li>El sistema obtiene token, descarga empleados (por emp_code) y checadas reales (punch_time + punch_state).</li>
                  </ol>
                </div>

                <div>
                  <div className="font-semibold mb-1 text-blue-700">Botones Entrada/Salida rápidos</div>
                  <p>Los botones verdes/rojos siguen funcionando para marcajes manuales inmediatos. Para datos reales del lector utilice siempre la sincronización por IP/Cloud.</p>
                </div>

                <div className="bg-emerald-50 p-3 rounded border">
                  <div className="font-semibold mb-1">Estado actual</div>
                  <ul className="text-xs pl-4">
                    <li>✓ Tablas biometric_devices y employee_fingerprints listas.</li>
                    <li>✓ /api/payroll/biotime usa autenticación POST + endpoints exactos de BioTime Cloud 2.0 (/personnel/api/employees/, /iclock/api/transactions/)</li>
                    <li>✓ Sincroniza checadas reales con emp_code, punch_time y punch_state.</li>
                    <li>✓ device_id + is_manual=false en attendance_records.</li>
                  </ul>
                </div>

                <div className="text-xs text-slate-500">
                  Proporciona URL + usuario admin + contraseña admin de BioTime Cloud al sincronizar. Las marcas llegan en tiempo real desde los relojes a la nube.
                </div>
              </div>

              <div className="mt-6 text-right text-xs text-slate-400">
                Proporciona URL + usuario admin + contraseña admin de BioTime Cloud al sincronizar. Las marcas llegan en tiempo real desde los relojes a la nube.
              </div>
              <div className="text-right mt-3">
                <button onClick={() => setShowBiometricGuide(false)} className="px-4 py-1 bg-slate-900 text-white rounded text-sm font-medium">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Payroll Preview - Pre-Nómina con bono extra */}
        {viewMode === 'payroll' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Pre-Nómina Semanal (con Préstamos y Adelantos)</h2>
              <p className="text-sm text-slate-600">Resumen de la semana {getWeekStart(selectedDate)} - {getWeekEnd(selectedDate)}. Se descuentan automáticamente los préstamos/adelantos acordados según la sección de Préstamos y Adelantos. El historial de pagos se conserva.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">No.</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Área</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700">Salario Diario</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-700">Estado Hoy</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700">Base Día</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-green-700">+ Bono Extra</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-orange-700">- Préstamo/ Adelanto</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700">Neto Semana</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((emp) => {
                    const daily = Number(emp.daily_salary || 0);
                    const paidToday = getEffectivePayment(emp);
                    const bono = Number(emp.extra_bonus || 0);
                    const loanDed = Number(emp.loan_deduction || 0);
                    const net = Math.max(0, paidToday + bono - loanDed);
                    const isRetardo = emp.status === 'retardo';
                    return (
                      <tr key={emp.employee_id} className="border-b last:border-none">
                        <td className="px-4 py-3 text-sm">{emp.employee_number || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium">{emp.employee_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{emp.department}</td>
                        <td className="px-4 py-3 text-sm text-right">${daily.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={['presente', 'retardo'].includes(emp.status) ? 'px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded' : 'px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded'}>
                            {emp.status || 'ausente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          ${paidToday.toFixed(2)}
                          {isRetardo && <span className="ml-1 text-[10px] text-orange-600 font-normal">-1h</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">+ ${bono.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-700 font-medium">- ${loanDed.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">${net.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-50">
                     <td colSpan={5} className="px-4 py-3 font-semibold text-right text-sm">Totales Pre-Nómina (con descuentos de Préstamos y Adelantos):</td>
                    <td className="px-4 py-3 text-right font-bold">
                      ${attendance.reduce((s, e) => s + getEffectivePayment(e), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      + ${Number(stats.weekBonuses || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-orange-700">
                      - ${Number(stats.weekDeductions || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-lg">
                      ${(attendance.reduce((s, e) => s + getEffectivePayment(e), 0) + Number(stats.weekBonuses || 0) - Number(stats.weekDeductions || 0)).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button onClick={generatePayroll} className="px-6 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 text-sm">
                Ir a Generar Nómina Completa
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
