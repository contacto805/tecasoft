'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MotorFinancieroPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('costos');
  const [isSuper, setIsSuper] = useState(false);

  // Estado para Costo Integral por Lote
  const [lotId, setLotId] = useState('');
  const [costoData, setCostoData] = useState(null);
  const [loadingCosto, setLoadingCosto] = useState(false);

  // Estado para Calculadora Bidireccional
  const [direccion, setDireccion] = useState('destino_a_campo');
  const [pDestino, setPDestino] = useState(42);
  const [pCampo, setPCampo] = useState(32);
  const [bidResult, setBidResult] = useState(null);
  const [loadingBid, setLoadingBid] = useState(false);

  // Estado para Ajustes
  const [ajustes, setAjustes] = useState([]);
  const [ajusteForm, setAjusteForm] = useState({
    entity_type: 'lot',
    entity_id: '',
    adjustment_type: 'producer_purchase_price',
    original_value: '',
    new_value: '',
    reason: '',
  });
  const [loadingAjustes, setLoadingAjustes] = useState(false);

  // Validaciones
  const [validacion, setValidacion] = useState(null);

  useEffect(() => {
    checkSuper();
    loadAjustes();
  }, []);

  async function checkSuper() {
    try {
      const r = await fetch('/api/auth/check-super-admin');
      if (r.ok) {
        const j = await r.json();
        setIsSuper(!!j.isSuperAdmin);
      }
    } catch (_) {}
  }

  async function calcularCostoLote() {
    if (!lotId) return alert('Ingresa ID de lote');
    setLoadingCosto(true);
    try {
      const res = await fetch('/api/financial/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lot_cost', params: { lotId } }),
      });
      const data = await res.json();
      setCostoData(data);
    } catch (e) {
      alert('Error calculando: ' + e.message);
    }
    setLoadingCosto(false);
  }

  async function calcularBidireccional() {
    setLoadingBid(true);
    try {
      const res = await fetch('/api/financial/bidireccional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: direccion,
          precioDestinoPorKg: parseFloat(pDestino),
          precioCampoActual: parseFloat(pCampo),
          costosNoFrutaPorKg: 4.5,
          utilidadObjetivoPorKg: 2.0,
          margenMinimo: 0.15,
        }),
      });
      setBidResult(await res.json());
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoadingBid(false);
  }

  async function loadAjustes() {
    setLoadingAjustes(true);
    try {
      const r = await fetch('/api/financial/adjustments');
      const data = await r.json();
      setAjustes(Array.isArray(data) ? data : []);
    } catch (_) {}
    setLoadingAjustes(false);
  }

  async function crearAjuste() {
    if (!ajusteForm.entity_id || !ajusteForm.new_value) return alert('Datos incompletos');
    try {
      const res = await fetch('/api/financial/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ajusteForm,
          original_value: parseFloat(ajusteForm.original_value),
          new_value: parseFloat(ajusteForm.new_value),
          requested_by: 'usuario',
        }),
      });
      if (res.ok) {
        alert('Ajuste registrado. Pendiente de autorización si aplica.');
        setAjusteForm({ ...ajusteForm, entity_id: '', original_value: '', new_value: '', reason: '' });
        await loadAjustes();
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function autorizarAjuste(id) {
    if (!isSuper) return alert('Solo Superadministrador');
    try {
      await fetch('/api/financial/adjustments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'authorize', user: { name: 'super', is_super_admin: true } }),
      });
      await loadAjustes();
      alert('Ajuste autorizado y aplicado.');
    } catch (e) {
      alert('Error autorizando');
    }
  }

  async function correrValidacion() {
    const res = await fetch('/api/financial/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart: '2025-01-01', weekEnd: '2025-01-07' }),
    });
    setValidacion(await res.json());
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Motor Financiero Centralizado</h1>
            <p className="text-slate-600 mt-1">Única fuente de verdad • V9 • Sin fórmulas inconsistentes entre módulos</p>
          </div>
          <button onClick={() => router.push('/administracion')} className="px-4 py-2 border rounded-xl text-sm">← Administración</button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b mb-6">
          {[
            { id: 'costos', label: 'Costos por Lote' },
            { id: 'bidireccional', label: 'Calculadora Bidireccional' },
            { id: 'ajustes', label: 'Ajustes y Versiones' },
            { id: 'validaciones', label: 'Pruebas y Validaciones' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2 text-sm font-medium border-b-2 ${activeTab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 1. COSTOS INTEGRALES */}
        {activeTab === 'costos' && (
          <div className="bg-white border rounded-2xl p-6">
            <h2 className="font-semibold text-xl mb-4">Cálculo de Costo Integral por Lote</h2>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="ID del lote (ej. 123)"
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="border px-4 py-2 rounded-xl w-48"
              />
              <button onClick={calcularCostoLote} disabled={loadingCosto} className="px-6 py-2 bg-emerald-700 text-white rounded-xl">
                {loadingCosto ? 'Calculando...' : 'CALCULAR COSTO INTEGRAL'}
              </button>
            </div>

            {costoData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 border rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">KG RECIBIDOS</div>
                    <div className="text-2xl font-bold">{costoData.kg_recibidos}</div>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <div className="text-xs text-slate-500">COSTO INTEGRAL</div>
                    <div className="text-2xl font-black text-emerald-700">${costoData.costo_integral}</div>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <div className="text-xs text-slate-500">COSTO / KG RECIBIDO</div>
                    <div className="text-xl font-bold">${costoData.costo_kg_recibido}</div>
                  </div>
                  <div className="p-4 border rounded-xl">
                    <div className="text-xs text-slate-500">COSTO / KG COMERCIALIZABLE</div>
                    <div className="text-xl font-bold">${costoData.costo_kg_comercializable}</div>
                  </div>
                </div>

                <div className="border rounded-xl p-4">
                  <div className="font-semibold mb-2">Desglose (únicas fuentes confirmadas)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {Object.entries(costoData.desglose || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b py-1">
                        <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-mono font-semibold">${v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-3">Fuente: {costoData.fuente}</div>
                </div>
              </div>
            )}
            <div className="text-xs text-slate-500 mt-4">Fórmula oficial: COSTO_INTEGRAL_LOTE = SUMA(COSTOS_UNICOS_ASIGNADOS). Nunca duplica gastos ni pagos bancarios.</div>
          </div>
        )}

        {/* 2. BIDIRECCIONAL */}
        {activeTab === 'bidireccional' && (
          <div className="bg-white border rounded-2xl p-6">
            <h2 className="font-semibold text-xl mb-1">Calculadora Bidireccional Precios</h2>
            <p className="text-sm text-slate-600 mb-4">Campo ↔ Destino. Compara contra rendimientos históricos y reales.</p>

            <div className="flex gap-4 mb-4">
              <select value={direccion} onChange={(e) => setDireccion(e.target.value)} className="border px-3 py-2 rounded-xl">
                <option value="destino_a_campo">DESTINO → CAMPO (qué puedo pagar)</option>
                <option value="campo_a_destino">CAMPO → DESTINO (qué precio necesito)</option>
              </select>
              <input type="number" step="0.01" value={pDestino} onChange={(e) => setPDestino(e.target.value)} className="border px-3 py-2 rounded-xl w-32" placeholder="Precio destino" />
              <input type="number" step="0.01" value={pCampo} onChange={(e) => setPCampo(e.target.value)} className="border px-3 py-2 rounded-xl w-32" placeholder="Precio campo" />
              <button onClick={calcularBidireccional} disabled={loadingBid} className="px-6 py-2 bg-black text-white rounded-xl">Calcular</button>
            </div>

            {bidResult && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-sm">
                <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(bidResult, null, 2)}</pre>
              </div>
            )}
            <div className="mt-3 text-xs text-slate-500">Nunca inventa datos. Usa rendimientos reales de lot_performance y producción confirmada.</div>
          </div>
        )}

        {/* 3. AJUSTES */}
        {activeTab === 'ajustes' && (
          <div className="space-y-6">
            <div className="bg-white border rounded-2xl p-6">
              <h2 className="font-semibold mb-3">Registrar Ajuste de Precio / Descuento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="ID Entidad (lote, etc)" value={ajusteForm.entity_id} onChange={(e) => setAjusteForm({ ...ajusteForm, entity_id: e.target.value })} className="border px-3 py-2 rounded" />
                <select value={ajusteForm.adjustment_type} onChange={(e) => setAjusteForm({ ...ajusteForm, adjustment_type: e.target.value })} className="border px-3 py-2 rounded">
                  <option value="producer_purchase_price">Precio compra productor (solo Super)</option>
                  <option value="client_discount">Descuento cliente</option>
                  <option value="internal">Ajuste interno autorizado</option>
                </select>
                <input placeholder="Valor original" value={ajusteForm.original_value} onChange={(e) => setAjusteForm({ ...ajusteForm, original_value: e.target.value })} className="border px-3 py-2 rounded" />
                <input placeholder="Nuevo valor" value={ajusteForm.new_value} onChange={(e) => setAjusteForm({ ...ajusteForm, new_value: e.target.value })} className="border px-3 py-2 rounded" />
                <input placeholder="Motivo / Folio" value={ajusteForm.reason} onChange={(e) => setAjusteForm({ ...ajusteForm, reason: e.target.value })} className="border px-3 py-2 rounded col-span-2" />
              </div>
              <button onClick={crearAjuste} className="mt-4 px-6 py-2 bg-emerald-700 text-white rounded-xl">Registrar Ajuste</button>
              <div className="text-xs mt-2 text-amber-600">Los cambios al precio de compra del productor quedan pendientes hasta autorización de Superadministrador. Se genera folio y snapshot.</div>
            </div>

            <div className="bg-white border rounded-2xl p-6">
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold">Historial de Ajustes</h3>
                <button onClick={loadAjustes} className="text-sm">Actualizar</button>
              </div>
              <div className="overflow-auto max-h-80 text-sm">
                <table className="w-full">
                  <thead><tr className="text-left border-b"><th>Folio</th><th>Tipo</th><th>Delta</th><th>Estado</th><th>Acción</th></tr></thead>
                  <tbody>
                    {ajustes.map(a => (
                      <tr key={a.id} className="border-b">
                        <td className="font-mono text-xs">{a.folio}</td>
                        <td>{a.adjustment_type}</td>
                        <td className={a.delta > 0 ? 'text-emerald-600' : 'text-red-600'}>{a.delta}</td>
                        <td><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{a.status}</span></td>
                        <td>
                          {a.status === 'pending_authorization' && isSuper && (
                            <button onClick={() => autorizarAjuste(a.id)} className="text-xs px-2 py-1 bg-black text-white rounded">Autorizar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. VALIDACIONES Y PRUEBAS */}
        {activeTab === 'validaciones' && (
          <div className="bg-white border rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Pruebas Financieras y Consistencia</h2>
            <button onClick={correrValidacion} className="px-6 py-2 bg-slate-800 text-white rounded-xl mb-4">Ejecutar Validación de Consistencia</button>

            {validacion && (
              <div className="p-4 bg-slate-50 rounded border text-sm font-mono">
                {JSON.stringify(validacion, null, 2)}
              </div>
            )}

            <div className="text-xs text-slate-500 mt-6">
              Reglas activas:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>Denominadores validados (no división por cero)</li>
                <li>Utilidad bruta / operativa / neta separadas</li>
                <li>No se mezclan pagos bancarios con costos devengados</li>
                <li>Ajustes de precio de productor requieren autorización explícita</li>
                <li>Todo cálculo se registra con versión y auditoría</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 text-xs text-center text-slate-400">Motor Financiero Centralizado • Todos los módulos deben usar /api/financial/calculate • Cambios auditados</div>
      </div>
    </div>
  );
}
