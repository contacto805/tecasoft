'use client';

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function BrokersPage() {
  // Master corredores management (add/edit/delete in Gestión de Corredores)
  const [masterCorredores, setMasterCorredores] = useState([]);
  const [showMasterForm, setShowMasterForm] = useState(false);
  const [editingMaster, setEditingMaster] = useState(null);
  const [masterForm, setMasterForm] = useState({ name: '', phone: '', notes: '' });

  // Comprehensive audit logging system for broker CRUD
  const AUDIT_USER = { id: 'admin', name: 'Administrador', role: 'superadmin' };
  const [auditLogs, setAuditLogs] = useState([]);
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const initialReadRef = useRef(false);

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-log?module=brokers&limit=20');
      if (res.ok) {
        const data = await res.json();
        let logsArr = data.logs || data || [];
        // Re-fetch last 20 and re-sort by timestamp descending (newest first) for most recent broker CRUD operations
        logsArr = [...logsArr].sort((a, b) => {
          const ta = new Date(a.timestamp || a.created_at || 0).getTime();
          const tb = new Date(b.timestamp || b.created_at || 0).getTime();
          return tb - ta;
        }).slice(0, 20);
        setAuditLogs(logsArr);
        // Reset to timestamp desc so table displays most recent first
        setSortKey('timestamp');
        setSortDir('desc');
      }
    } catch (e) {}
  };

  const logAudit = async (action, entityId, oldData, newData, description) => {
    try {
      await fetch('/api/admin/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: AUDIT_USER.id,
          userName: AUDIT_USER.name,
          userRole: AUDIT_USER.role,
          module: 'brokers',
          action: String(action).toUpperCase(),
          entityType: 'broker',
          entityId: entityId || null,
          oldValue: oldData ? JSON.stringify(oldData) : null,
          newValue: newData ? JSON.stringify(newData) : null,
          description: description || '',
          status: 'exitoso'
        })
      });
    } catch (e) {
      console.error('Error logging audit for brokers:', e);
    }
  };

  const getSortedAuditLogs = () => {
    const arr = [...auditLogs];
    arr.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'timestamp' || sortKey === 'created_at') {
        va = new Date(va || a.timestamp || a.created_at || 0).getTime();
        vb = new Date(vb || b.timestamp || b.created_at || 0).getTime();
      } else if (typeof va === 'string') {
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr.slice(0, 20);
  };

  const handleAuditSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const loadMasterCorredores = async () => {
    try {
      const res = await fetch('/api/brokers?masters=true');
      if (res.ok) {
        const data = await res.json();
        setMasterCorredores(data);
        // Log initial read once to track READ operation (comprehensive audit)
        if (!initialReadRef.current) {
          logAudit('read', null, null, { count: data.length }, `Consulta inicial de lista de corredores (${data.length} registros)`);
          initialReadRef.current = true;
        }
      }
    } catch {}
  };

  // Load master corredores for management + audit logs
  useEffect(() => {
    loadMasterCorredores();
    loadAuditLogs();
  }, []);

  const openAddMaster = () => {
    setEditingMaster(null);
    setMasterForm({ name: '', phone: '', notes: '' });
    setShowMasterForm(true);
  };
  const openEditMaster = (c) => {
    setEditingMaster(c);
    setMasterForm({ name: c.broker_name || c.name || '', phone: c.phone || '', notes: c.notes || '' });
    // Track READ operation for specific broker
    logAudit('read', c.id, null, c, `Lectura de detalles de corredor: ${c.broker_name || c.name || c.id}`);
    setShowMasterForm(true);
  };
  const saveMaster = async () => {
    if (!masterForm.name?.trim()) return;
    const isUpdate = !!editingMaster;
    const oldData = isUpdate ? { ...editingMaster } : null;
    try {
      let resData = null;
      if (isUpdate) {
        const r = await fetch('/api/brokers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingMaster.id, ...masterForm })
        });
        if (r.ok) resData = await r.json();
      } else {
        const r = await fetch('/api/brokers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(masterForm)
        });
        if (r.ok) resData = await r.json();
      }
      const entityId = resData?.id || editingMaster?.id;
      await logAudit(
        isUpdate ? 'update' : 'create',
        entityId,
        oldData,
        { ...masterForm, id: entityId },
        isUpdate
          ? `Actualización de corredor: ${masterForm.name} (ID: ${entityId})`
          : `Creación de corredor: ${masterForm.name}`
      );
      setShowMasterForm(false);
      setEditingMaster(null);
      loadMasterCorredores();
      loadAuditLogs();
    } catch {}
  };
  const deleteMaster = async (id) => {
    if (!confirm('¿Eliminar este corredor?')) return;
    const oldData = masterCorredores.find(c => String(c.id) === String(id)) || { id };
    try {
      await fetch(`/api/brokers?id=${id}`, { method: 'DELETE' });
      await logAudit(
        'delete',
        id,
        oldData,
        null,
        `Eliminación de corredor: ${oldData.broker_name || oldData.name || 'ID ' + id}`
      );
      loadMasterCorredores();
      loadAuditLogs();
    } catch {}
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Lista de Corredores', 14, 20);
    const rows = masterCorredores.map((c, idx) => [
      idx + 1,
      c.broker_name || c.name || '',
      c.phone || '',
      c.notes || ''
    ]);
    doc.autoTable({
      startY: 28,
      head: [['#', 'Nombre', 'Teléfono', 'Notas']],
      body: rows,
      styles: { fontSize: 10 }
    });
    doc.save('corredores.pdf');
  };

  const exportExcel = () => {
    const data = masterCorredores.map(c => ({
      Nombre: c.broker_name || c.name || '',
      Teléfono: c.phone || '',
      Notas: c.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corredores');
    XLSX.writeFile(wb, 'corredores.xlsx');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Top Navigation - consistent on all modules */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="text-emerald-800 font-semibold ml-2 flex items-center gap-1.5">
              <i className="ph ph-handshake"></i> Gestión de Corredores
            </div>
          </div>


        </div>
      </header>

      <main className="flex-1 pt-14 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <section className="mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Corredores</h1>
              <p className="text-slate-500 mt-1">Agregar, editar y eliminar corredores maestros</p>
            </div>
          </section>

          {/* Only the brokers management card - no other modules */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">Corredores</div>
              <div className="flex gap-2">
                <button onClick={exportPDF} className="px-3 py-1 text-sm border border-slate-300 rounded-lg">PDF</button>
                <button onClick={exportExcel} className="px-3 py-1 text-sm border border-slate-300 rounded-lg">Excel</button>
                <button onClick={openAddMaster} className="px-3 py-1 text-sm bg-emerald-700 text-white rounded-lg flex items-center gap-1">+ Agregar</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {masterCorredores.length === 0 && <div className="text-xs text-slate-400">Sin corredores. Agrega para que aparezcan en acopios y otros módulos.</div>}
              {masterCorredores.map((c, i) => {
                const nm = c.broker_name || c.name;
                return (
                  <div key={i} className="flex items-center justify-between border rounded-lg px-3 py-1.5 bg-slate-50">
                    <div>
                      <span className="font-medium">{nm}</span>
                      {c.phone && <span className="text-xs text-slate-500 ml-2">{c.phone}</span>}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => openEditMaster(c)} className="px-2 py-0.5 border rounded">Editar</button>
                      <button onClick={() => deleteMaster(c.id)} className="px-2 py-0.5 border rounded text-red-600">Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comprehensive Audit Trail Component - Last 20 transactions, sortable */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2">
                <i className="ph ph-shield-check"></i> Bitácora de Auditoría - Corredores
              </div>
              <button onClick={loadAuditLogs} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Actualizar</button>
            </div>
            <p className="text-[10px] text-slate-500 mb-2">Últimas 20 transacciones (create, read, update, delete). Haz clic en encabezados para ordenar.</p>
            <div className="overflow-x-auto max-h-80 border rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    {['timestamp', 'action', 'user_name', 'entity_id', 'description'].map((col) => {
                      const labelMap = { timestamp: 'Fecha/Hora', action: 'Acción', user_name: 'Usuario', entity_id: 'ID', description: 'Descripción' };
                      const label = labelMap[col] || col;
                      return (
                        <th 
                          key={col} 
                          onClick={() => handleAuditSort(col)}
                          className="text-left p-2 border-b cursor-pointer hover:bg-slate-200 select-none font-medium"
                        >
                          {label} {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      );
                    })}
                    <th className="text-left p-2 border-b font-medium">Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedAuditLogs().length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-center text-slate-400">No hay registros de auditoría aún para este módulo.</td></tr>
                  ) : (
                    getSortedAuditLogs().map((log, index) => {
                      const ts = log.timestamp || log.created_at;
                      const formattedTime = ts ? new Date(ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : '-';
                      return (
                        <tr key={index} className="border-b hover:bg-slate-50 last:border-0">
                          <td className="p-2 font-mono text-[10px] whitespace-nowrap">{formattedTime}</td>
                          <td className="p-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                              log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                              log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                              log.action === 'READ' ? 'bg-slate-200 text-slate-600' : 'bg-slate-100'
                            }`}>{log.action}</span>
                          </td>
                          <td className="p-2">{log.user_name || log.user_id || '-'}</td>
                          <td className="p-2 font-mono text-[10px]">{log.entity_id || '-'}</td>
                          <td className="p-2 max-w-[160px] truncate text-slate-600" title={log.description}>{log.description || '-'}</td>
                          <td className="p-2 text-[10px] text-slate-500 max-w-[200px] truncate" title={(log.old_value || '') + (log.new_value || '')}>
                            {log.old_value && <span className="text-red-600">old</span>}
                            {log.new_value && <span className={log.old_value ? 'ml-1 text-emerald-600' : 'text-emerald-600'}>new</span>}
                            {!(log.old_value || log.new_value) && '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">Trazabilidad completa. Los datos se almacenan en system_audit_log con timestamps, usuario y detalles de cambios.</div>
          </div>






        </div>
      </main>



      {/* Master Corredor Add/Edit Modal */}
      {showMasterForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">{editingMaster ? 'Editar Corredor' : 'Agregar Corredor'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nombre</label>
                <input value={masterForm.name} onChange={e=>setMasterForm({...masterForm, name:e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border" placeholder="Nombre del corredor" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Teléfono</label>
                <input value={masterForm.phone} onChange={e=>setMasterForm({...masterForm, phone:e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border" placeholder="Teléfono" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notas</label>
                <input value={masterForm.notes} onChange={e=>setMasterForm({...masterForm, notes:e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border" placeholder="Notas" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>{setShowMasterForm(false); setEditingMaster(null);}} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200">Cancelar</button>
              <button onClick={saveMaster} className="flex-1 px-4 py-2.5 bg-emerald-700 text-white font-medium rounded-xl hover:bg-emerald-800">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
