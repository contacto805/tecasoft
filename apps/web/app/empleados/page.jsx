'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function EmpleadosPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    employeeNumber: '',
    nombre: '',
    apellido: '',
    hireDate: '',
    weeklySalary: '',
    department: '',
    position: '',
    notes: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employees?withBalances=true');
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      alert('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  // Split employee_name into nombre/apellido for display
  const getNameParts = (fullName) => {
    if (!fullName) return { nombre: '', apellido: '' };
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { nombre: parts[0], apellido: '' };
    const apellido = parts.pop();
    const nombre = parts.join(' ');
    return { nombre, apellido };
  };

  const filteredEmployees = employees.filter(emp => {
    const full = (emp.employee_name || '').toLowerCase();
    const num = (emp.employee_number || emp.employee_id || '').toLowerCase();
    const s = searchTerm.toLowerCase();
    return full.includes(s) || num.includes(s);
  });

  const openAdd = () => {
    setEditingEmployee(null);
    setFormData({
      employeeNumber: '',
      nombre: '',
      apellido: '',
      hireDate: '',
      weeklySalary: '',
      department: '',
      position: '',
      notes: ''
    });
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    const parts = getNameParts(emp.employee_name);
    setEditingEmployee(emp);
    setFormData({
      employeeNumber: emp.employee_number || emp.employee_id || '',
      nombre: parts.nombre,
      apellido: parts.apellido,
      hireDate: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      weeklySalary: emp.weekly_salary || '',
      department: emp.department || '',
      position: emp.position || '',
      notes: emp.notes || ''
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEmployee(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('Nombre es obligatorio');
      return;
    }
    setSaving(true);

    const employeeName = `${formData.nombre.trim()} ${formData.apellido.trim()}`.trim();
    const employeeId = formData.employeeNumber.trim() || (editingEmployee?.employee_id) || `EMP${Date.now()}`;

    const payload = {
      employeeId: editingEmployee ? editingEmployee.employee_id : employeeId,
      employeeName,
      employeeNumber: formData.employeeNumber || employeeId,
      hireDate: formData.hireDate || null,
      weeklySalary: parseFloat(formData.weeklySalary) || 0,
      department: formData.department || 'General',
      position: formData.position || '',
      notes: formData.notes || ''
    };

    try {
      const method = editingEmployee ? 'PUT' : 'POST';
      const body = editingEmployee 
        ? JSON.stringify(payload) 
        : JSON.stringify(payload);
      
      const res = await fetch('/api/employees', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Error al guardar');
      }

      closeModal();
      await loadEmployees();
      alert(editingEmployee ? 'Cambios guardados correctamente' : 'Empleado creado correctamente');
    } catch (err) {
      alert('Error: ' + (err.message || 'No se pudo guardar el empleado'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp) => {
    if (!confirm(`¿Desactivar al empleado "${emp.employee_name}"?`)) return;

    try {
      const res = await fetch(`/api/employees?employeeId=${encodeURIComponent(emp.employee_id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadEmployees();
      } else {
        alert('No se pudo eliminar');
      }
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  const formatCurrency = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Empleados</h1>
            <p className="text-slate-600 mt-1">Catálogo de personal • Altas, ediciones y bajas</p>
          </div>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.985] text-white font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
          >
            <i className="ph ph-user-plus text-lg"></i>
            Agregar Empleado
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs uppercase text-slate-500 mb-1">Total Activos</div>
            <div className="text-2xl font-semibold text-slate-900">{employees.filter(e => e.is_active !== false).length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs uppercase text-slate-500 mb-1">Con Préstamo Activo</div>
            <div className="text-2xl font-semibold text-slate-900">{employees.filter(e => (e.loan_count || 0) > 0).length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs uppercase text-slate-500 mb-1">Saldo Total Pendiente</div>
            <div className="text-2xl font-semibold text-slate-900">
              {formatCurrency(employees.reduce((sum, e) => sum + (e.loan_balance || 0), 0))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs uppercase text-slate-500 mb-1">Préstamos Activos</div>
            <div className="text-2xl font-semibold text-slate-900">
              {employees.reduce((sum, e) => sum + (e.loan_count || 0), 0)}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o número..."
              className="w-full border border-slate-300 rounded-xl pl-9 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
            />
            <i className="ph ph-magnifying-glass absolute left-3 top-3 text-slate-400"></i>
          </div>
          <button 
            onClick={loadEmployees} 
            className="px-4 py-2 text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center gap-2">
            <i className="ph ph-arrow-clockwise"></i> Actualizar
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Id</th>
                  <th className="px-5 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-5 py-3 text-left font-semibold">Apellido</th>
                  <th className="px-5 py-3 text-left font-semibold">Fecha de inicio</th>
                  <th className="px-5 py-3 text-right font-semibold">Sueldo</th>
                  <th className="px-5 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-5 py-3 text-center font-semibold">Solicitados</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">Cargando empleados...</td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No se encontraron empleados
                      <div className="mt-1 text-xs">Haz clic en "Agregar Empleado" para registrar el primero.</div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const parts = getNameParts(emp.employee_name);
                    const idDisplay = emp.employee_number || emp.employee_id || emp.id;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-sm">{idDisplay}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">{parts.nombre || '-'}</td>
                        <td className="px-5 py-3.5 text-slate-800">{parts.apellido || '-'}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(emp.hire_date)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(emp.weekly_salary)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-900">
                          {formatCurrency(emp.loan_balance || 0)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full text-xs font-semibold ${ (emp.loan_count || 0) > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600' }`}>
                            {emp.loan_count || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => openEdit(emp)} 
                              className="px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 text-xs rounded-lg flex items-center gap-1"
                              title="Editar"
                            >
                              <i className="ph ph-pencil-simple"></i>
                              <span className="hidden md:inline">Editar</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(emp)} 
                              className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs rounded-lg flex items-center gap-1"
                              title="Eliminar (desactivar)"
                            >
                              <i className="ph ph-trash"></i>
                              <span className="hidden md:inline">Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500 px-1">
          Los saldos y solicitados se calculan en tiempo real a partir de los préstamos activos registrados.
        </div>
      </div>

      {/* Modal Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-5">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-slate-200">
            <div className="px-5 pt-5 pb-4 border-b flex items-center">
              <div className="font-semibold text-lg text-slate-900">
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </div>
              <button onClick={closeModal} className="ml-auto text-xl text-slate-400 hover:text-slate-700">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">ID / Número de Empleado</label>
                  <input
                    type="text"
                    name="employeeNumber"
                    value={formData.employeeNumber}
                    onChange={handleInputChange}
                    disabled={!!editingEmployee}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400 disabled:bg-slate-50"
                    placeholder="EMP001 o código"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Sueldo Semanal (MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="weeklySalary"
                    value={formData.weeklySalary}
                    onChange={handleInputChange}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Apellido</label>
                  <input
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                    placeholder="Pérez"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha de inicio</label>
                  <input
                    type="date"
                    name="hireDate"
                    value={formData.hireDate}
                    onChange={handleInputChange}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Departamento</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                    placeholder="Campo / Empaque / Oficinas"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Puesto</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2.5 focus:outline-emerald-400"
                  placeholder="Cortador / Ayudante / Supervisor"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Observaciones</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={2}
                  className="border text-sm border-slate-300 rounded-xl w-full px-3 py-2 focus:outline-emerald-400 resize-y"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="border-t px-5 py-4 flex items-center gap-3 justify-end bg-slate-50 rounded-b-3xl">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 text-sm rounded-xl border text-slate-700 bg-white hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-70"
              >
                {saving ? 'Guardando...' : (editingEmployee ? 'Guardar Cambios' : 'Crear Empleado')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
