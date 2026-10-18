'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TecavoIA() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [activeTab, setActiveTab] = useState('asistente');
  const [notifications, setNotifications] = useState([]);
  const [auditResults, setAuditResults] = useState(null);
  const [simInput, setSimInput] = useState({ direction: 'destino_a_campo', precio: 12.5 });
  const [simResult, setSimResult] = useState(null);
  const [rentParams, setRentParams] = useState({ lotId: '', weekStart: '' });
  const [rentResult, setRentResult] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [proposalForm, setProposalForm] = useState({ tipo: 'ajuste_precio', motivo: '', entidad: '' });
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    checkUser();
    loadNotifications();
    testConnection();
  }, []);

  const checkUser = async () => {
    try {
      const r = await fetch('/api/auth/check-super-admin', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setIsSuper(!!(d.isSuperAdmin || d.adminRole === 'superadministrador'));
    } catch {}
  };

  const testConnection = async () => {
    try {
      const r = await fetch('/api/ai/chat');
      const d = await r.json();
      setConnected(!!d.connected);
    } catch { setConnected(false); }
  };

  const loadNotifications = async () => {
    try {
      const r = await fetch('/api/ia/notifications', { credentials: 'include' });
      if (r.ok) setNotifications(await r.json());
    } catch {}
  };

  const sendMessage = async (preset = null) => {
    const q = preset || input.trim();
    if (!q) return;
    setLoading(true);
    const newMsgs = [...messages, { role: 'user', content: q }];
    setMessages(newMsgs);
    if (!preset) setInput('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: q, history: newMsgs.slice(-8) })
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'Sin respuesta con datos reales.';
      setMessages([...newMsgs, { role: 'assistant', content: reply, meta: data }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Error consultando fuentes reales del ERP.' }]);
    }
    setLoading(false);
  };

  const runQuickQuery = (q) => sendMessage(q);

  // 2. Centro de Notificaciones
  const markNotification = async (id, status) => {
    try {
      await fetch('/api/ia/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      loadNotifications();
    } catch {}
  };

  // 3. Auditoría Inteligente
  const runAudit = async () => {
    try {
      const r = await fetch('/api/ia/audit', { credentials: 'include' });
      const d = await r.json();
      setAuditResults(d);
    } catch { setAuditResults({ issues: [{ tipo: 'Error temporal', cantidad: 0 }] }); }
  };

  // 7. Simulador Financiero (usa motor real)
  const runSimulator = async () => {
    try {
      const r = await fetch('/api/ia/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bidireccional', params: simInput })
      });
      const d = await r.json();
      setSimResult(d);
    } catch {}
  };

  // 5. Análisis de Rentabilidad
  const runRentabilidad = async () => {
    try {
      const r = await fetch('/api/ia/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rentabilidad', params: rentParams })
      });
      const d = await r.json();
      setRentResult(d);
    } catch {}
  };

  // 9. Propuestas de Corrección
  const submitProposal = async () => {
    try {
      const res = await fetch('/api/ia/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...proposalForm, requested_by: 'ia-user' })
      });
      if (res.ok) {
        alert('Propuesta registrada. Espera autorización de Superadministrador.');
        setProposalForm({ tipo: 'ajuste_precio', motivo: '', entidad: '' });
        // recargar lista
        const list = await fetch('/api/ia/proposals').then(r => r.json()).catch(() => []);
        setProposals(list);
      }
    } catch {}
  };

  const tabs = [
    { id: 'asistente', label: '1. Asistente de Dirección' },
    { id: 'notificaciones', label: '2. Centro de Notificaciones' },
    { id: 'auditoria', label: '3. Auditoría Inteligente' },
    { id: 'conciliacion', label: '4. Conciliación Bancaria' },
    { id: 'rentabilidad', label: '5. Análisis de Rentabilidad' },
    { id: 'errores', label: '6. Detección de Errores' },
    { id: 'simulador', label: '7. Simulador Financiero' },
    { id: 'supervision', label: '8. Supervisión del Sistema' },
    { id: 'propuestas', label: '9. Propuestas de Corrección' },
    { id: 'config', label: '10. Configuración de IA' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-emerald-700 text-xs tracking-[3px] font-semibold">TECAVO FRUITS</div>
            <h1 className="text-3xl font-semibold tracking-tight">TECAVO IA — Inteligencia Empresarial</h1>
            <p className="text-slate-600 text-sm mt-1">Consulta datos reales confirmados del ERP • Motor financiero centralizado • Solo respuestas con fuente y estado</p>
          </div>
          <div className="text-xs px-3 py-1 rounded bg-white border">
            {isSuper ? 'SUPERADMINISTRADOR • Visibilidad total' : 'Acceso limitado a tu ámbito'}
            {connected !== null && <span className="ml-2">• {connected ? 'Conectado' : 'Sin conexión IA'}</span>}
          </div>
        </div>

        {/* Chat principal siempre visible */}
        <div className="bg-white border rounded-3xl p-4 mb-6">
          <div className="font-semibold mb-2 text-sm">Chat TECAVO IA (lenguaje natural • respuestas con fuente obligatoria)</div>
          <div className="h-56 overflow-auto border rounded-2xl bg-slate-50 p-3 text-sm mb-3">
            {messages.length === 0 && (
              <div className="text-slate-500 text-xs">Ejemplos: ¿Cuánto costó producir esta semana? • ¿Cuál fue el gasto real en materiales? • ¿Cuánto costó empacar cada tarima? • ¿Qué movimientos no están conciliados?</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : ''}`}>
                <span className={`inline-block max-w-[85%] px-3 py-1.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-emerald-800 text-white' : 'bg-white border'}`}>
                  {m.content}
                </span>
                {m.meta && <div className="text-[9px] text-emerald-600 mt-0.5">herramientas: {m.meta.toolsUsed?.join(', ')}</div>}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Consultando fuentes reales...</div>}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }} placeholder="Pregunta sobre datos reales confirmados..." className="flex-1 border rounded-2xl px-4 py-2 text-sm" />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="px-6 py-2 bg-emerald-800 text-white rounded-2xl text-sm font-medium disabled:bg-slate-300">Enviar</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {['¿Cuánto costó producir esta semana?', '¿Cuál fue el gasto real en materiales?', '¿Cuánto costó empacar cada tarima?', '¿Qué movimientos no están conciliados?', '¿Qué lotes tuvieron pérdidas?', '¿Cuánto inventario tenemos?'].map((q, i) => (
              <button key={i} onClick={() => runQuickQuery(q)} className="text-[10px] px-2 py-0.5 border rounded bg-white hover:bg-emerald-50">{q}</button>
            ))}
          </div>
        </div>

        {/* Tabs de las 10 áreas */}
        <div className="flex flex-wrap gap-1 mb-3 border-b pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-3 py-1 text-xs rounded-t ${activeTab === t.id ? 'bg-emerald-800 text-white' : 'bg-white border hover:bg-emerald-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* SECCIONES */}
        {activeTab === 'asistente' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Asistente de Dirección</div>
            <div className="text-sm text-slate-600">KPIs ejecutivos + chat. Todas las respuestas usan fuentes reales y el motor financiero.</div>
            <button onClick={() => runQuickQuery('Resumen ejecutivo de la semana actual')} className="mt-3 px-4 py-2 bg-emerald-700 text-white text-sm rounded-xl">Obtener Resumen Ejecutivo Real</button>
          </div>
        )}

        {activeTab === 'notificaciones' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-3">Centro de Notificaciones</div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {notifications.length === 0 && <div className="text-xs text-slate-500">Sin alertas. Las detecciones de IA aparecen aquí.</div>}
              {notifications.map((n, i) => (
                <div key={i} className="flex justify-between border rounded p-2 text-sm">
                  <div>{n.title || n.body || JSON.stringify(n).slice(0,80)}</div>
                  <div className="flex gap-1 text-xs">
                    <button onClick={() => markNotification(n.id, 'en_revision')} className="px-2 border rounded">En revisión</button>
                    <button onClick={() => markNotification(n.id, 'resuelto')} className="px-2 border rounded">Resuelto</button>
                    <button onClick={() => markNotification(n.id, 'descartado')} className="px-2 border rounded">Descartar</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={loadNotifications} className="mt-3 text-xs px-3 py-1 border rounded">Actualizar</button>
          </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Auditoría Inteligente</div>
            <button onClick={runAudit} className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm">Ejecutar Auditoría Completa</button>
            {auditResults && (
              <div className="mt-3 text-xs border rounded p-3 bg-slate-50">
                <div>Fuente: {auditResults.source || 'multi-tablas'}</div>
                <div>Estado: {auditResults.estado || 'detectado'}</div>
                {(auditResults.issues || []).map((iss, i) => <div key={i} className="mt-1">• {iss.tipo} — {iss.cantidad || iss.cantidad}</div>)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'conciliacion' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Conciliación Bancaria (IA propone — determinista aplica)</div>
            <button onClick={() => runQuickQuery('¿Qué movimientos no están conciliados?')} className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm">Analizar Movimientos Pendientes</button>
            <div className="mt-2 text-xs text-slate-500">IA identifica y propone relaciones con productores, proveedores, clientes y gastos. Aplicación vía servicios autorizados.</div>
          </div>
        )}

        {activeTab === 'rentabilidad' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-3">Análisis de Rentabilidad (Motor Financiero Centralizado)</div>
            <div className="flex gap-2 mb-3">
              <input placeholder="lotId" value={rentParams.lotId} onChange={e=>setRentParams({...rentParams, lotId: e.target.value})} className="border px-2 py-1 rounded text-sm w-28" />
              <input placeholder="2025-01-01" value={rentParams.weekStart} onChange={e=>setRentParams({...rentParams, weekStart: e.target.value})} className="border px-2 py-1 rounded text-sm" />
              <button onClick={runRentabilidad} className="px-4 py-1 bg-emerald-700 text-white rounded text-sm">Calcular</button>
            </div>
            {rentResult && (
              <div className="text-sm bg-emerald-50 p-3 rounded">
                <div>Ingreso neto: {rentResult.ingreso_neto}</div>
                <div>Utilidad bruta: {rentResult.utilidad_bruta} | Operativa: {rentResult.utilidad_operativa}</div>
                <div>Margen: {rentResult.margen}%</div>
                <div className="text-[10px] mt-1">{rentResult.source} • {rentResult.calculo}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'errores' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Detección de Errores</div>
            <button onClick={() => runQuickQuery('Ejecuta detección de errores del sistema')} className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm">Ejecutar Detección Automática</button>
            <div className="text-xs mt-2">Costos duplicados • Pagos duplicados • Kg inconsistentes • Tarimas descontadas dos veces • Gastos sin soporte • Lotes sin cierre • Errores de fórmulas</div>
          </div>
        )}

        {activeTab === 'simulador' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Simulador Financiero Bidireccional + Costos</div>
            <div className="flex gap-2 mb-3">
              <select value={simInput.direction} onChange={e=>setSimInput({...simInput, direction: e.target.value})} className="border rounded px-2 py-1 text-sm">
                <option value="destino_a_campo">DESTINO → CAMPO (cuánto puedo pagar por fruta)</option>
                <option value="campo_a_destino">CAMPO → DESTINO (qué precio necesito en venta)</option>
              </select>
              <input type="number" step="0.1" value={simInput.precio} onChange={e=>setSimInput({...simInput, precio: parseFloat(e.target.value)})} className="border px-2 py-1 rounded w-24 text-sm" />
              <button onClick={runSimulator} className="px-4 py-1 bg-emerald-700 text-white rounded text-sm">Simular</button>
            </div>
            {simResult && <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(simResult, null, 2)}</pre>}
            <div className="text-xs text-slate-500 mt-2">Calcula usando rendimientos históricos reales y costos del motor centralizado. Compara contra datos reales.</div>
          </div>
        )}

        {activeTab === 'supervision' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Supervisión del Sistema</div>
            <button onClick={runAudit} className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-sm">Supervisar Inconsistencias</button>
            <div className="text-xs mt-2">Revisa costos duplicados, pagos duplicados, kg inconsistentes, tarimas descontadas dos veces, gastos sin soporte, movimientos sin identificar, lotes sin cierre, errores de fórmulas.</div>
          </div>
        )}

        {activeTab === 'propuestas' && (
          <div className="bg-white border rounded-3xl p-6">
            <div className="font-semibold mb-2">Propuestas de Corrección</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 text-sm">
              <select value={proposalForm.tipo} onChange={e=>setProposalForm({...proposalForm, tipo: e.target.value})} className="border rounded px-2 py-1">
                <option value="ajuste_precio">Ajuste precio productor</option>
                <option value="correccion_formula">Corrección de fórmula</option>
                <option value="cambio_plantilla">Cambio plantilla o formulario</option>
              </select>
              <input placeholder="Entidad (lote, semana, etc)" value={proposalForm.entidad} onChange={e=>setProposalForm({...proposalForm, entidad: e.target.value})} className="border rounded px-2 py-1" />
              <input placeholder="Motivo / diagnóstico" value={proposalForm.motivo} onChange={e=>setProposalForm({...proposalForm, motivo: e.target.value})} className="border rounded px-2 py-1" />
            </div>
            <button onClick={submitProposal} className="px-4 py-1 bg-emerald-700 text-white rounded-xl text-sm">Enviar Propuesta (diagnóstico + impacto + riesgos)</button>
            <div className="text-xs mt-2 text-amber-700">La IA propone. Solo Superadministrador autoriza. Se registra con folio y snapshot. No modifica sistema productivo directamente.</div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="bg-white border rounded-3xl p-6 text-sm">
            <div className="font-semibold mb-2">Configuración de IA</div>
            <div>Conexión: {connected ? 'Activa vía AppGen Cloud (1 crédito por consulta)' : 'Verificar .env APPGEN_API_KEY'}</div>
            <div className="mt-1">Permisos: Superadministrador ve todo. Usuarios limitados a su ámbito.</div>
            <div className="mt-1">Cálculos financieros: siempre a través del motor determinista (nunca estimaciones de IA).</div>
            <div className="mt-1">Auditoría: todas las consultas quedan en system_audit_log.</div>
            <div className="mt-2 text-[10px] text-slate-500">No se envían datos bancarios sensibles ni documentos a servicios externos sin controles.</div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => router.push('/administracion')} className="px-4 py-2 text-sm border rounded-xl">Volver a Administración</button>
          <button onClick={() => router.push('/superadministrador')} className="ml-2 px-4 py-2 text-sm border rounded-xl">Superadministrador</button>
        </div>
      </div>
    </div>
  );
}
