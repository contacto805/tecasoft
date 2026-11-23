'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CarteraClientes() {
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [viajes, setViajes] = useState([]);
  const [notas, setNotas] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [estado, setEstado] = useState(null);

  const [viajeForm, setViajeForm] = useState({ customer_id: '', destino: '', valor_usd: '', estatus: 'Preparación', fecha_salida: new Date().toISOString().slice(0,10) });
  const [abonoForm, setAbonoForm] = useState({ customer_id: '', moneda_recibida: 'USD', importe_recibido: '', tipo_cambio: '18.5', banco_receptor: '' });
  const [facturaForm, setFacturaForm] = useState({ customer_id: '', uso_factura: 'SOLO TIMBRADA PARA DEPÓSITO', importe_usd: '', uuid: '' });
  const [applyForm, setApplyForm] = useState({ abono_id: '', aplicaciones: [] });

  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, n, f, a, d, cl] = await Promise.all([
        fetch('/api/viajes').then(r => r.json()),
        fetch('/api/notas').then(r => r.json()),
        fetch('/api/cfdi-facturas').then(r => r.json()),
        fetch('/api/abonos').then(r => r.json()),
        fetch('/api/cartera/dashboard').then(r => r.json()),
        fetch('/api/cartera/clientes').then(r => r.json())
      ]);
      setViajes(Array.isArray(v) ? v : []);
      setNotas(Array.isArray(n) ? n : []);
      setFacturas(Array.isArray(f) ? f : []);
      setAbonos(Array.isArray(a) ? a : []);
      setDashboard(d || {});
      setClientes(Array.isArray(cl) ? cl : []);
    } catch (_) {}
    setLoading(false);
  }

  useEffect(() => { loadAll(); window.addEventListener('focus',loadAll);return () => window.removeEventListener('focus',loadAll); }, []);

  async function loadEstado(cid) {
    const res = await fetch(`/api/cartera/estado-cuenta?customerId=${cid}`);
    const data = await res.json();
    setEstado(data);
    setSelectedCustomer(cid);
    setTab('estado');
  }

  async function crearViaje() {
    if (!viajeForm.customer_id) return alert('Selecciona cliente');
    await fetch('/api/viajes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(viajeForm) });
    setViajeForm({ customer_id: '', destino: '', valor_usd: '', estatus: 'Preparación', fecha_salida: new Date().toISOString().slice(0,10) });
    await loadAll();
  }

  async function crearAbono() {
    if (!abonoForm.customer_id) return alert('Cliente requerido');
    const payload = { ...abonoForm, customerId: abonoForm.customer_id };
    await fetch('/api/abonos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setAbonoForm({ customer_id: '', moneda_recibida: 'USD', importe_recibido: '', tipo_cambio: '18.5', banco_receptor: '' });
    await loadAll();
  }

  async function crearFactura() {
    if (!facturaForm.customer_id) return;
    await fetch('/api/cfdi-facturas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...facturaForm, customerId: facturaForm.customer_id }) });
    setFacturaForm({ customer_id: '', uso_factura: 'SOLO TIMBRADA PARA DEPÓSITO', importe_usd: '', uuid: '' });
    await loadAll();
  }

  // Real Senhub timbrado (full flow with confirmation + proper data)
  // MODO SEGURO: NO crea ventas ni ingresos. Solo timbra operación autorizada existente (viaje/nota/carga). Requiere configuración Senhub.
  async function timbrarConSenhub() {
    if (!facturaForm.customer_id) return alert('Selecciona cliente');

    const cliente = clientes.find(c => String(c.id) === String(facturaForm.customer_id));
    if (!cliente) return alert('Cliente no encontrado');

    // Guard: fiscal data completeness (block 15)
    const hasFiscal = cliente.fiscal_rfc || cliente.rfc;
    if (!hasFiscal) {
      alert('El cliente no tiene RFC fiscal configurado. Ve a Clientes y completa datos fiscales antes de timbrar.');
      return;
    }

    // Confirmation dialog (required by spec)
    const resumen = `CLIENTE: ${cliente.customer_name}
RFC: ${cliente.fiscal_rfc || cliente.rfc}
IMPORTE: $${facturaForm.importe_usd || 0}
USO: ${cliente.fiscal_uso_cfdi || 'G03'}

¿CONFIRMAR Y TIMBRAR CFDI REAL CON SENHUB?

NOTA: Requiere credenciales Senhub configuradas (solo Superadmin). Una operación = un CFDI.`;
    if (!confirm(resumen)) return;

    // Build rich payload from existing data only (no sale creation)
    const payload = {
      action: 'timbrar',
      customer_id: facturaForm.customer_id,
      customer_rfc: cliente.fiscal_rfc || cliente.rfc,
      customer_name: cliente.fiscal_razon_social || cliente.commercial_name || cliente.customer_name,
      fiscal_razon_social: cliente.fiscal_razon_social,
      domicilio_fiscal_receptor: cliente.fiscal_codigo_postal,
      regimen_fiscal_receptor: cliente.fiscal_regimen_fiscal,
      uso_cfdi: cliente.fiscal_uso_cfdi || 'G03',
      forma_pago: cliente.fiscal_forma_pago || '03',
      metodo_pago: cliente.fiscal_metodo_pago || 'PUE',
      importe_total: facturaForm.importe_usd || 0,
      moneda: 'USD',
      uso_factura: facturaForm.uso_factura,
      conceptos: [{
        clave_prod_serv: '01010101',
        cantidad: 1,
        clave_unidad: 'E48',
        descripcion: `Servicio de transporte / fruta - ${facturaForm.uso_factura || 'CFDI'}`,
        valor_unitario: parseFloat(facturaForm.importe_usd) || 1000,
        objeto_imp: '02',
        traslados: [{ impuesto: '002', tipo_factor: 'Tasa', tasa_o_cuota: '0.160000' }]
      }]
    };

    const res = await fetch('/api/cfdi-facturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success || data.cfdi) {
      alert('✅ CFDI TIMBRADO\nUUID: ' + (data.cfdi?.uuid || data.senhub?.uuid) + '\n\nDescarga PDF/XML desde el historial o SenHub. No se crearon ventas nuevas.');
      setFacturaForm({ customer_id: '', uso_factura: 'SOLO TIMBRADA PARA DEPÓSITO', importe_usd: '', uuid: '' });
      await loadAll();
    } else {
      alert((data.error || 'Error al timbrar') + (data.retry_with_same_idempotency ? '\n(Reintenta con la misma operación para evitar duplicados)' : ''));
    }
  }

  async function aplicarAbono() {
    if (!applyForm.abono_id) return;
    await fetch('/api/aplicaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonoId: applyForm.abono_id, aplicaciones: applyForm.aplicaciones }) });
    setApplyForm({ abono_id: '', aplicaciones: [] });
    await loadAll();
  }

  // Simple apply UI helper
  function addApplyRow(notaId, monto) {
    setApplyForm(prev => ({
      ...prev,
      aplicaciones: [...(prev.aplicaciones || []), { nota_id: notaId, monto_usd: monto }]
    }));
  }

  const saldoTotal = (dashboard?.total_por_cobrar_usd || 0);
  const cobrado = (dashboard?.total_cobrado_usd || 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-emerald-700 text-xs font-bold tracking-widest">TECAVO SOFT</div>
            <h1 className="text-3xl font-bold">Control de Viajes, Facturación y Cartera de Clientes</h1>
          </div>
          <button onClick={() => router.push('/customers')} className="px-4 py-2 rounded bg-white border text-sm">Ir a Clientes</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 border-b pb-2">
          {['dashboard','viajes','notas','facturas','abonos','aplicar','clientes','estado'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${tab === t ? 'bg-emerald-700 text-white' : 'bg-white border'}`}>
              {t === 'dashboard' && 'Dashboard Cartera'}
              {t === 'viajes' && 'Viajes'}
              {t === 'notas' && 'Notas / Cuentas'}
              {t === 'facturas' && 'Facturas CFDI'}
              {t === 'abonos' && 'Abonos / Depósitos'}
              {t === 'aplicar' && 'Aplicar Abono'}
              {t === 'clientes' && 'Vista Clientes'}
              {t === 'estado' && 'Estado de Cuenta'}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-4 rounded border"><div className="text-xs text-slate-500">Total por cobrar USD</div><div className="text-3xl font-bold text-red-600">${(dashboard.total_por_cobrar_usd || 0).toFixed(2)}</div></div>
            <div className="bg-white p-4 rounded border"><div className="text-xs text-slate-500">Cobrado USD</div><div className="text-3xl font-bold text-emerald-600">${(dashboard.total_cobrado_usd || 0).toFixed(2)}</div></div>
            <div className="bg-white p-4 rounded border"><div className="text-xs text-slate-500">Anticipos disponibles</div><div className="text-3xl font-bold text-blue-600">${(dashboard.anticipos_usd || 0).toFixed(2)}</div></div>
            <div className="bg-white p-4 rounded border"><div className="text-xs text-slate-500">Clientes con saldo</div><div className="text-3xl font-bold">{dashboard.clientes_con_saldo || 0}</div></div>

            <div className="md:col-span-4 bg-white p-4 rounded border">
              <div className="font-semibold mb-2">Cartera por antigüedad (USD)</div>
              <div className="grid grid-cols-5 gap-2 text-sm">
                {Object.entries(dashboard.cartera_por_antiguedad || {}).map(([k, v]) => (
                  <div key={k} className="p-2 bg-slate-50 rounded"><span className="text-xs text-slate-500">{k} días</span><div className="font-bold">${(v || 0).toFixed(0)}</div></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'viajes' && (
          <div>
            <div className="bg-white p-4 rounded border mb-3">
              <div className="font-semibold mb-2">Nuevo Viaje (folio V- auto)</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <select value={viajeForm.customer_id} onChange={e => setViajeForm({ ...viajeForm, customer_id: e.target.value })} className="border p-2 rounded">
                  <option value="">Cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                </select>
                <input placeholder="Destino" value={viajeForm.destino} onChange={e=>setViajeForm({...viajeForm,destino:e.target.value})} className="border p-2 rounded" />
                <input type="number" placeholder="Valor USD" value={viajeForm.valor_usd} onChange={e=>setViajeForm({...viajeForm,valor_usd:e.target.value})} className="border p-2 rounded" />
                <input type="date" value={viajeForm.fecha_salida} onChange={e=>setViajeForm({...viajeForm,fecha_salida:e.target.value})} className="border p-2 rounded" />
                <button onClick={crearViaje} className="bg-emerald-700 text-white rounded px-4">Crear Viaje</button>
              </div>
            </div>
            <table className="w-full bg-white border text-sm">
              <thead><tr className="bg-slate-100"><th className="p-2 text-left">Folio</th><th>Cliente</th><th>Fecha</th><th>Valor USD</th><th>Estatus</th><th></th></tr></thead>
              <tbody>
                {viajes.map(v => (
                  <tr key={v.id} className="border-t">
                    <td className="p-2 font-mono">{v.folio}</td>
                    <td className="p-2">{v.customer_name}</td>
                    <td className="p-2">{v.fecha_salida}</td>
                    <td className="p-2 font-semibold">${parseFloat(v.valor_usd || 0).toFixed(2)}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${v.estatus === 'Pagado' ? 'bg-green-100' : v.estatus === 'Pendiente de pago' ? 'bg-yellow-100' : 'bg-slate-100'}`}>{v.estatus}</span></td>
                    <td className="p-2"><button onClick={() => loadEstado(v.customer_id)} className="text-xs underline">Ver estado</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'notas' && <div className="overflow-auto rounded-xl border bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-brand-50"><tr><th className="p-3">Nota</th><th>Cliente</th><th>Kilos</th><th>Total de la nota</th><th>Cargo USD</th><th>Saldo USD</th><th>Estado</th></tr></thead>
            <tbody>{notas.map(note=><tr key={note.id} className="border-t">
              <td className="p-3"><strong>{note.folio}</strong><span className="block text-xs text-slate-500">{note.viaje_folio || '—'}</span></td>
              <td>{note.customer_name}</td><td>{note.kilos ?? '—'}</td>
              <td>{note.importe == null ? '—' : Number(note.importe).toLocaleString('es-MX',{style:'currency',currency:note.moneda}) + ' ' + note.moneda}</td>
              <td>{Number(note.importe_original_usd || 0).toFixed(2)}</td>
              <td>{Number(note.saldo_usd || 0).toFixed(2)}</td><td>{note.estatus}</td>
            </tr>)}</tbody>
          </table>
          {!notas.length && <p className="p-3 text-sm text-slate-600">Sin notas registradas.</p>}
        </div>}

        {tab === 'abonos' && (
          <div>
            <div className="bg-white p-4 rounded border mb-3">
              <div className="font-semibold mb-2">Registrar Depósito / Abono (folio AB- auto + conversión MXN)</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <select value={abonoForm.customer_id} onChange={e=>setAbonoForm({...abonoForm,customer_id:e.target.value})} className="border p-2 rounded"><option value="">Cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.customer_name}</option>)}</select>
                <select value={abonoForm.moneda_recibida} onChange={e=>setAbonoForm({...abonoForm,moneda_recibida:e.target.value})} className="border p-2 rounded"><option>USD</option><option>MXN</option></select>
                <input type="number" placeholder="Importe recibido" value={abonoForm.importe_recibido} onChange={e=>setAbonoForm({...abonoForm,importe_recibido:e.target.value})} className="border p-2 rounded" />
                <input type="number" step="0.01" placeholder="Tipo cambio (si MXN)" value={abonoForm.tipo_cambio} onChange={e=>setAbonoForm({...abonoForm,tipo_cambio:e.target.value})} className="border p-2 rounded" />
                <input placeholder="Banco" value={abonoForm.banco_receptor} onChange={e=>setAbonoForm({...abonoForm,banco_receptor:e.target.value})} className="border p-2 rounded" />
                <button onClick={crearAbono} className="bg-emerald-700 text-white px-4 rounded">Registrar Abono</button>
              </div>
              <div className="text-xs mt-1 text-slate-500">USD directo. MXN → USD = Importe ÷ Tipo de cambio. Se guarda el TC de la operación.</div>
            </div>
            <table className="w-full bg-white text-sm border"><thead><tr className="bg-slate-100"><th className="p-2">Folio</th><th>Cliente</th><th>Moneda</th><th>Recibido</th><th>Equiv. USD</th><th>Disponible</th></tr></thead>
            <tbody>{abonos.map(a => <tr key={a.id} className="border-t"><td className="p-2 font-mono">{a.folio}</td><td>{a.customer_name}</td><td>{a.moneda_recibida}</td><td>{a.importe_recibido}</td><td className="font-semibold">${parseFloat(a.equivalente_usd||0).toFixed(2)}</td><td className="text-emerald-700">${parseFloat(a.disponible_usd||0).toFixed(2)}</td></tr>)}</tbody></table>
          </div>
        )}

        {tab === 'aplicar' && (
          <div className="bg-white p-4 rounded border">
            <div className="font-semibold mb-2">Aplicar Abono a Notas</div>
            <select value={applyForm.abono_id} onChange={e=>setApplyForm({...applyForm, abono_id: e.target.value})} className="border p-2 rounded mb-3">
              <option value="">Selecciona abono...</option>
              {abonos.map(a => <option key={a.id} value={a.id}>{a.folio} • {a.customer_name} • Disp: ${parseFloat(a.disponible_usd||0).toFixed(2)}</option>)}
            </select>

            <div className="text-sm mb-2">Notas pendientes del cliente del abono seleccionado:</div>
            <div className="space-y-2 mb-3">
              {notas.filter(n => parseFloat(n.saldo_usd||0) > 0.5 && (!applyForm.abono_id || abonos.find(a => String(a.id) === String(applyForm.abono_id))?.customer_id == n.customer_id)).slice(0,8).map(n => (
                <div key={n.id} className="flex gap-2 items-center border p-2 rounded">
                  <div className="flex-1 text-sm">{n.folio} • {n.customer_name} • Saldo ${parseFloat(n.saldo_usd||0).toFixed(2)}</div>
                  <input type="number" placeholder="Monto USD" className="border px-2 py-1 w-28 rounded text-sm" id={`m-${n.id}`} />
                  <button onClick={() => {
                    const val = parseFloat(document.getElementById(`m-${n.id}`)?.value || 0);
                    if (val > 0) addApplyRow(n.id, val);
                  }} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Agregar</button>
                </div>
              ))}
            </div>

            <div className="mb-2 text-xs">Aplicaciones a realizar: {applyForm.aplicaciones.length}</div>
            <button onClick={aplicarAbono} className="px-5 py-2 bg-emerald-700 text-white rounded">Confirmar Aplicación</button>
            <div className="text-xs mt-2 text-slate-500">Un abono puede aplicarse a una o varias notas. Saldo se actualiza automáticamente. No se permite exceder disponible.</div>
          </div>
        )}

        {tab === 'clientes' && (
          <table className="w-full bg-white border text-sm">
            <thead><tr className="bg-slate-100"><th className="p-2">Cliente</th><th>Viajes</th><th>Vendido USD</th><th>Pagado</th><th>Saldo</th><th>Pendientes</th><th></th></tr></thead>
            <tbody>{clientes.map(c => <tr key={c.id} className="border-t"><td className="p-2 font-medium">{c.customer_name}</td><td>{c.viajes}</td><td>${parseFloat(c.total_vendido||0).toFixed(0)}</td><td>${parseFloat(c.total_pagado||0).toFixed(0)}</td><td className="font-bold text-red-600">${parseFloat(c.saldo||0).toFixed(2)}</td><td>{c.facturas_pendientes}</td><td><button onClick={() => loadEstado(c.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Estado de Cuenta</button></td></tr>)}</tbody>
          </table>
        )}

        {tab === 'estado' && selectedCustomer && estado && (
          <div className="bg-white p-4 rounded border">
            <div className="flex justify-between mb-3">
              <div className="font-semibold">Estado de Cuenta • Cliente #{selectedCustomer}</div>
              <button onClick={() => setTab('clientes')} className="text-sm underline">Cerrar</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
              <div>Total cargo: <b>${(estado.resumen?.total_cargo_usd || 0).toFixed(2)}</b></div>
              <div>Total abono: <b>${(estado.resumen?.total_abono_usd || 0).toFixed(2)}</b></div>
              <div className="font-bold text-red-600">Saldo pendiente: ${(estado.resumen?.saldo_pendiente_usd || 0).toFixed(2)}</div>
            </div>
            <table className="w-full text-xs border">
              <thead><tr className="bg-slate-100"><th className="p-1">Fecha</th><th>Tipo</th><th>Folio</th><th>Cargo</th><th>Abono</th><th>Saldo</th></tr></thead>
              <tbody>
                {(estado.movimientos || []).map((m,i) => (
                  <tr key={i} className="border-t"><td className="p-1">{m.fecha}</td><td>{m.tipo}</td><td>{m.folio}</td><td className="text-red-600">${(m.cargo||0).toFixed(2)}</td><td className="text-emerald-600">${(m.abono||0).toFixed(2)}</td><td className="font-semibold">${(m.saldo_running||0).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'facturas' && (
          <div>
            <div className="bg-white p-4 rounded border mb-3">
              <div className="font-semibold mb-2">Facturación CFDI — Timbrado con Senhub</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <select value={facturaForm.customer_id} onChange={e=>setFacturaForm({...facturaForm,customer_id:e.target.value})} className="border p-2 rounded"><option>Cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.customer_name}</option>)}</select>
                <select value={facturaForm.uso_factura} onChange={e=>setFacturaForm({...facturaForm,uso_factura:e.target.value})} className="border p-2 rounded"><option>SOLO TIMBRADA PARA DEPÓSITO</option><option>ADUANA</option><option>AMBOS</option></select>
                <input type="number" placeholder="Importe USD" value={facturaForm.importe_usd} onChange={e=>setFacturaForm({...facturaForm,importe_usd:e.target.value})} className="border p-2 rounded" />
                <button onClick={crearFactura} className="bg-slate-700 text-white px-4 rounded text-sm">Registrar manual</button>
                <button onClick={timbrarConSenhub} className="bg-emerald-700 text-white px-4 rounded text-sm font-medium">Timbrar con Senhub</button>
              </div>
              <div className="text-[10px] mt-1 text-slate-500">Timbrar con Senhub genera CFDI real vía API oficial, guarda UUID + PDF/XML automáticamente. Configura credenciales en Configuraciones → Facturación / Senhub.</div>
            </div>
            <table className="w-full text-sm bg-white border"><thead><tr className="bg-slate-100"><th className="p-2">Folio</th><th>Cliente</th><th>Uso</th><th>Importe USD</th><th>UUID</th></tr></thead>
            <tbody>{facturas.map(f => <tr key={f.id} className="border-t"><td>{f.folio_interno}</td><td>{f.customer_name}</td><td className="text-xs">{f.uso_factura}</td><td>${parseFloat(f.importe_usd||0).toFixed(2)}</td><td className="font-mono text-[10px]">{f.uuid}</td></tr>)}</tbody></table>
          </div>
        )}

        <div className="text-xs text-slate-500 mt-6">Módulo integral integrado a clientes existentes. Saldos calculados desde transacciones reales. Moneda principal: USD.</div>
      </div>
    </div>
  );
}
