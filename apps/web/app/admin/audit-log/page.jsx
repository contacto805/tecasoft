'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', action: '', limit: 100 });

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.module) params.set('module', filter.module);
      if (filter.action) params.set('action', filter.action);
      params.set('limit', String(filter.limit));
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.push('/administracion')} className="text-sm text-emerald-700 hover:underline">← Volver a Administración</button>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">Registro de Auditoría</h1>
            <p className="text-slate-600 text-sm">Bitácora central del sistema • Vinculada a todos los módulos que generan tickets, notas y documentos</p>
          </div>
          <button onClick={loadLogs} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm">Actualizar</button>
        </div>

        <div className="bg-white border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs block text-slate-600">Módulo</label>
            <input value={filter.module} onChange={e=>setFilter({...filter,module:e.target.value})} placeholder="ej: embarques, tickets" className="border px-3 py-1 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs block text-slate-600">Acción</label>
            <input value={filter.action} onChange={e=>setFilter({...filter,action:e.target.value})} placeholder="ej: CREAR, IMPRIMIR" className="border px-3 py-1 rounded text-sm" />
          </div>
          <button onClick={loadLogs} className="px-4 py-2 bg-slate-900 text-white rounded text-sm">Filtrar</button>
          <button onClick={()=>{setFilter({module:'',action:'',limit:100}); loadLogs();}} className="px-3 py-2 border rounded text-sm">Limpiar</button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Cargando bitácora...</div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-3">Fecha / Hora</th>
                  <th className="text-left p-3">Usuario</th>
                  <th className="text-left p-3">Módulo</th>
                  <th className="text-left p-3">Acción</th>
                  <th className="text-left p-3">Descripción / Folio</th>
                  <th className="text-left p-3">Entidad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay registros de auditoría para los filtros.</td></tr>}
                {logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 text-xs text-slate-500 font-mono">{new Date(log.timestamp || log.created_at).toLocaleString('es-MX')}</td>
                    <td className="p-3 text-sm">{log.user_name || log.user_id || '—'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-slate-200 rounded text-xs">{log.module || '—'}</span></td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">{log.action || '—'}</span></td>
                    <td className="p-3 text-sm text-slate-700">{log.description || log.observaciones || '—'}</td>
                    <td className="p-3 text-xs font-mono text-slate-500">{log.entity_type || ''} {log.entity_id || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">
          Los folios ascendentes generados en Tickets, Notas, Embarques, Órdenes, Pagos, etc. quedan registrados aquí para control central desde Administración.
          Este registro es la fuente única de auditoría vinculada al módulo de Administración.
        </div>
      </div>
    </div>
  );
}
