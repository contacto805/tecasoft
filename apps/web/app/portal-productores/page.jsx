'use client';

import React, { useState } from 'react';

const REQUIRED_DOCS = [
  'Contrato firmado',
  'Constancia de Situación Fiscal',
  'Identificación',
  'Carátula bancaria',
  'Opinión de cumplimiento',
  'Documento de huerta'
];

export default function PortalProductores() {
  const [folio, setFolio] = useState('');
  const [pin, setPin] = useState('');
  const [orden, setOrden] = useState(null);
  const [orders, setOrders] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState('Contrato firmado');
  const [uploading, setUploading] = useState(false);

  const calcularFechaPago = (o) => {
    if (!o) return 'Por definir';
    if (o.scheduled_payment_date) return o.scheduled_payment_date;
    if (o.entrega_estimada) return o.entrega_estimada;
    if (o.payment_scheduled_date) return o.payment_scheduled_date;
    if (o.cutting_date && (o.plazo_dias || o.payment_days)) {
      const d = new Date(o.cutting_date);
      d.setDate(d.getDate() + (parseInt(o.plazo_dias || o.payment_days || 0)));
      return d.toISOString().slice(0, 10);
    }
    return 'Por definir';
  };

  const cargarOrden = async (orderFolio) => {
    const res = await fetch(`/api/producer-portal/auth/me?folio=${encodeURIComponent(orderFolio)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setOrden(data.order);
    setPaymentInfo(data.paymentInfo);
    setDocs(data.docs);
  };

  const buscarOrden = async () => {
    setLoading(true);
    setError('');
    try {
      const loginRes = await fetch('/api/producer-portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producerNumber: folio.trim(), pin })
      });
      const login = await loginRes.json();
      if (!loginRes.ok) throw new Error(login.error);
      setPin('');
      const res = await fetch('/api/producer-portal/auth/me');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
      if (login.folio) await cargarOrden(login.folio);
    } catch (problem) {
      setError(problem.message || 'No se pudo consultar.');
    } finally {
      setLoading(false);
    }
  };

  const seleccionarOrden = async (orderFolio) => {
    if (!orderFolio) return;
    setError('');
    setDocFile(null);
    setOrden(null);
    try {
      await cargarOrden(orderFolio);
    } catch (problem) {
      setError(problem.message || 'No se pudo consultar la orden.');
    }
  };

  const salir = async () => {
    try {
      const response = await fetch('/api/producer-portal/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setOrden(null);
      setFolio('');
      setPin('');
      setOrders(null);
      setPaymentInfo(null);
      setDocs([]);
      setDocFile(null);
      setError('');
    } catch {
      setError('No se pudo cerrar la sesión. Intenta de nuevo.');
    }
  };

  const descargarContrato = async () => {
    if (!orden?.hasContract) return;
    try {
      const res = await fetch(`/api/producer-portal/contract?folio=${encodeURIComponent(orden.folio)}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `Contrato-${orden.folio}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('No se pudo descargar el contrato.');
    }
  };

  const subirDocumento = async () => {
    if (!docFile || !orden) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', docFile);
    fd.append('folio', orden.folio);
    fd.append('documentType', docType);
    try {
      const res = await fetch('/api/producer-portal/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocFile(null);
      await cargarOrden(orden.folio);
    } catch (problem) {
      setError(problem.message || 'No se pudo guardar el documento.');
    } finally {
      setUploading(false);
    }
  };

  const getDocStatus = (type) => {
    const found = docs.find(d => (d.document_type || '').toLowerCase().includes(type.toLowerCase().slice(0,6)));
    if (!found) return '☐';
    const st = (found.status || '').toLowerCase();
    if (st.includes('acept') || st.includes('aprob')) return '✅';
    if (st.includes('rechaz')) return '❌';
    return '📄';
  };

  const getProgressIndex = () => {
    if (!orden) return 0;
    const hasDocs = docs.length > 0;
    const payStatus = (paymentInfo?.status || orden.payment_status || '').toLowerCase();
    if (payStatus.includes('pagado') || payStatus.includes('paid')) return 6;
    if (payStatus.includes('autoriz')) return 5;
    if (payStatus.includes('program') || orden.entrega_estimada) return 4;
    if (hasDocs && docs.length >= 3) return 3;
    if (hasDocs) return 2;
    return 1;
  };

  const estados = ['CORTE REGISTRADO', 'DOCUMENTACIÓN PENDIENTE', 'DOCUMENTACIÓN EN REVISIÓN', 'DOCUMENTACIÓN COMPLETA', 'PROGRAMADO PARA PAGO', 'PAGO AUTORIZADO', 'PAGADO'];
  const prog = getProgressIndex();

  const fechaPago = paymentInfo?.scheduled_payment_date || calcularFechaPago(orden);
  const importe = ((orden?.net_weight || orden?.gross_weight || 0) * (orden?.agreed_price_per_kg || 0)).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6 pt-8">
          <div className="text-emerald-700 text-xs tracking-[3px] font-semibold">TECAVO FRUITS</div>
          <div className="text-2xl font-semibold tracking-tighter mt-1">Portal de Productores</div>
          <div className="text-sm text-slate-500 mt-1">Consulta tus órdenes con tu número de productor o folio y PIN</div>
        </div>

        {!orders && (
          <div className="bg-white rounded-3xl border p-6">
            <input
              value={folio}
              onChange={e => setFolio(e.target.value.toUpperCase())}
              placeholder="Número de productor o folio"
              className="w-full border px-4 py-3 rounded-2xl text-center font-mono text-lg tracking-widest"
            />
            <input
              value={pin}
              type="password"
              inputMode="numeric"
              onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder="PIN (6 dígitos) - acceso seguro"
              className="w-full border px-4 py-3 mt-2 rounded-2xl text-center font-mono text-lg tracking-[6px]"
              maxLength={6}
            />
            <button
              onClick={buscarOrden}
              disabled={loading || !folio.trim() || pin.length !== 6}
              className="mt-3 w-full py-3 bg-emerald-800 text-white rounded-2xl font-medium disabled:bg-slate-300"
            >
              {loading ? 'Verificando...' : 'INGRESAR CON PIN SEGURO'}
            </button>
            <div className="text-[10px] text-center text-slate-400 mt-4">Acceso con PIN + folio según esquema seguro existente. Solo tus datos.</div>
          </div>
        )}

        {error && <p role="alert" className="text-red-700 text-sm my-3">{error}</p>}
        {orders && (
          <div className="bg-white rounded-3xl border p-4 mb-4 flex items-center gap-3">
            {orders.length ? (
              <select aria-label="Tus órdenes de corte" value={orden?.folio || ""} onChange={e => seleccionarOrden(e.target.value)} className="min-w-0 flex-1 border rounded-lg p-2">
                <option value="">Elige una orden</option>
                {orders.map(item => <option key={item.folio} value={item.folio}>{item.folio} · {item.orchard_name}</option>)}
              </select>
            ) : <p className="flex-1">Todavía no tienes órdenes registradas.</p>}
            <button onClick={salir} className="rounded-lg border p-2 text-sm">Cerrar sesión</button>
          </div>
        )}
        {orden && (
          <div className="space-y-4">
            {/* Datos del productor */}
            <div className="bg-white rounded-3xl border p-5">
              <div className="text-xs text-emerald-700">DATOS DEL PRODUCTOR</div>
              <div className="text-xl font-semibold mt-1">{orden.producer_name || '—'}</div>
              <div className="text-sm text-slate-600 mt-0.5">Huerta: {orden.orchard_name || '—'}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
                <div>Orden: <span className="font-mono">{orden.folio}</span></div>
                <div>Fecha corte: {orden.cutting_date || '—'}</div>
                <div>Kilos: <span className="font-semibold">{orden.net_weight || orden.gross_weight || '—'}</span></div>
                <div>Precio pactado: <span className="font-semibold">${orden.agreed_price_per_kg || '—'}</span></div>
                <div className="col-span-2 mt-1">Importe estimado: <span className="font-semibold">${importe}</span></div>
                <div className="col-span-2">Pago programado: <span className="font-semibold">{fechaPago}</span></div>
              </div>
            </div>

            {/* Estado del cobro con línea de progreso real */}
            <div className="bg-white rounded-3xl border p-5">
              <div className="text-xs uppercase tracking-widest text-emerald-700 mb-2">ESTADO DEL COBRO</div>
              <div className="space-y-1 text-sm">
                {estados.map((e, i) => (
                  <div key={i} className={`px-3 py-1 rounded flex items-center gap-2 ${i <= prog ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100'}`}>
                    {i <= prog ? '●' : '○'} {e}
                  </div>
                ))}
              </div>
              <div className="text-[10px] mt-2 text-slate-500">Actualizado con datos de documentos y programación de pago.</div>
            </div>

            {/* Documentos + subida */}
            <div className="bg-white rounded-3xl border p-5">
              <div className="font-semibold mb-2">Documentos necesarios para cobrar</div>
              <div className="text-sm space-y-1 mb-3">
                {REQUIRED_DOCS.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">{getDocStatus(d)} {d}</div>
                ))}
              </div>

              <div className="mt-3">
                <div className="text-xs mb-1">Subir documento (PDF / JPG / PNG)</div>
                <select value={docType} onChange={e=>setDocType(e.target.value)} className="border text-sm rounded px-2 py-1 mb-1 w-full">
                  {REQUIRED_DOCS.map(d => <option key={d}>{d}</option>)}
                </select>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setDocFile(e.target.files?.[0]||null)} className="text-sm" />
                <button onClick={subirDocumento} disabled={!docFile || uploading} className="mt-2 w-full py-2 bg-emerald-800 text-white rounded-xl text-sm disabled:bg-slate-300">
                  {uploading ? 'Subiendo...' : 'SUBIR DOCUMENTO'}
                </button>
              </div>
              {docs.length > 0 && <div className="text-[10px] mt-2 text-emerald-700">{docs.length} documento(s) recibido(s)</div>}
            </div>

            <div className="flex gap-2">
              <button onClick={descargarContrato} disabled={!orden.hasContract} className="flex-1 py-3 border rounded-2xl text-sm font-medium">DESCARGAR CONTRATO</button>
            </div>

            <div className="text-center text-[10px] text-slate-400">Toda la información está ligada a tu Orden de Corte. Contacta Administración para dudas.</div>
          </div>
        )}
      </div>
    </div>
  );
}