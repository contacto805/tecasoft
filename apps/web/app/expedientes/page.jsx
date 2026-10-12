'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExpedientesPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroPago, setFiltroPago] = useState('');
  const [selected, setSelected] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const REQUISITOS_PAGO = [
    { tipo: 'constancia_situacion_fiscal', label: 'Constancia de situación fiscal (Del mes en curso)' },
    { tipo: 'opinion_cumplimiento', label: 'Opinión de cumplimiento POSITIVA (Vigente del mes en curso)' },
    { tipo: 'identificacion_oficial', label: 'Identificación oficial vigente' },
    { tipo: 'caratula_estado_cuenta', label: 'Carátula del Estado de cuenta' }
  ];

  // Fetch admin status - super or explicit encargados
  useEffect(() => {
    const check = async () => {
      try {
        const [superRes, roleRes] = await Promise.all([
          fetch('/api/auth/check-super-admin'),
          fetch('/api/expedientes/access-check')
        ]);
        const s = await superRes.json().catch(() => ({}));
        const role = await roleRes.json().catch(() => ({}));
        setIsAdmin(!!s.isSuperAdmin || !!role.access);
      } catch (_) {
        setIsAdmin(false);
      }
    };
    check();
  }, []);

  // Load list
  async function loadList() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filtroPago) params.set('estado_pago', filtroPago);
      const r = await fetch(`/api/expedientes?${params.toString()}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadList();
  }, [isAdmin, search, filtroPago]);

  async function openExpediente(item) {
    setSelected(item);
    setDetalleLoading(true);
    setDetalle(null);
    try {
      const res = await fetch(`/api/expedientes/${item.id}`);
      if (res.ok) {
        const d = await res.json();
        setDetalle(d);
      } else {
        // Fallback minimal: synthesize from item
        setDetalle({
          lote: item,
          pesajes: [],
          historial: [],
          documentos: [],
          pago: item.estado_pago ? { status: item.estado_pago } : null,
          estados: {
            expediente: item.estado_expediente,
            documentos: item.estado_documentos,
            pago: item.estado_pago,
            fecha_programada_pago: item.fecha_programada_pago
          },
          contrato: { disponible: true, url: `/api/lots/${item.id}/contract` },
          fotos: [],
          nota_entrada: item.kg_recibidos ? { total_kg: item.kg_recibidos } : null
        });
      }
    } catch (_) {
      setDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function uploadDoc(file, docType = 'documento_cobro') {
    if (!file || !selected) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('fallo en almacenamiento');

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.url || uploadData.fileUrl || uploadData.secure_url || '/storage/uploaded';

      // Save to the documents table for traceability in expediente + contador, using metadata
      await fetch(`/api/expedientes/${selected.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: docType,
          file_name: file.name,
          file_url: fileUrl
        })
      });

      alert('Documento subido y registrado.');
      await openExpediente(selected); // refresh
    } catch (e) {
      alert('No se pudo subir correctamente. Pruebe de nuevo.');
    } finally {
      setUploadingDoc(false);
    }
  }

  const generate4DigitAccess = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/lots/${selected.id}/accountant-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferFourDigit: true })
      });
      const d = await res.json();
      if (d.code4 || d.pin) {
        alert(`Código 4 dígitos para contador: ${d.code4 || d.pin}\nLink: /contador/${d.code4 || d.pin}`);
      } else {
        alert('Código generado: ' + (d.pin || d.token));
      }
    } catch (e) {
      alert('Error generando código');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center">
          <h2 className="font-semibold text-lg mb-2">Acceso restringido</h2>
          <p className="text-slate-600 text-sm">Este módulo requiere credenciales de Superadministrador o Encargado de Administración.</p>
          <button className="mt-4 px-4 py-2 border rounded" onClick={() => router.push('/login')}>Ingresar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expedientes de Lotes – Documentación para Cobro</h1>
          <p className="text-sm text-slate-600 mt-1">Acceso especial: Superadministrador y Encargado de Administración</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadList} className="px-4 py-2 border rounded-xl hover:bg-white">Actualizar</button>
          <button onClick={() => router.push('/contador')} className="px-4 py-2 bg-emerald-700 text-white rounded-xl">Ir a Módulo Contador</button>
          <button onClick={() => router.push('/documentacion')} className="px-4 py-2 border border-emerald-600 text-emerald-700 rounded-xl">Módulo Documentación (PINs)</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar por lote, productor o huerta..." 
          className="border px-4 py-2 rounded-xl w-full max-w-xs" 
        />
        <select value={filtroPago} onChange={e=>setFiltroPago(e.target.value)} className="border px-3 py-2 rounded-xl">
          <option value="">Todos los estados de pago</option>
          <option value="pendiente">Pendiente</option>
          <option value="scheduled">Programado</option>
          <option value="pagado">Pagado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <button onClick={()=>{setSearch(''); setFiltroPago('');}} className="px-4 py-2 text-sm underline">Limpiar</button>
      </div>

      {/* LIST TABLE - matches requirements exactly */}
      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="px-4 py-3 font-medium">Núm. Lote</th>
              <th className="px-4 py-3 font-medium">Folio Ingreso</th>
              <th className="px-4 py-3 font-medium">Productor</th>
              <th className="px-4 py-3 font-medium">Huerta</th>
              <th className="px-4 py-3 font-medium">Fecha Ingreso</th>
              <th className="px-4 py-3 font-medium text-right">Kg recibidos</th>
              <th className="px-4 py-3 font-medium">Estado Expediente</th>
              <th className="px-4 py-3 font-medium">Estado Documentos</th>
              <th className="px-4 py-3 font-medium">Estado Pago</th>
              <th className="px-4 py-3 font-medium">Fecha Programada Pago</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={11} className="py-10 text-center text-slate-500">Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} className="py-10 text-center text-slate-400">Sin registros en el rango</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-emerald-50/30">
                <td className="px-4 py-2 font-mono font-semibold">{item.lot_number}</td>
                <td className="px-4 py-2 text-xs font-mono">{item.folio_ingreso}</td>
                <td className="px-4 py-2">{item.producer}</td>
                <td className="px-4 py-2">{item.huerta}</td>
                <td className="px-4 py-2 tabular-nums">{item.fecha_ingreso ? String(item.fecha_ingreso).slice(0,10) : '-'}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{Number(item.kg_recibidos||0).toLocaleString()}</td>
                <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs border">{item.estado_expediente}</span></td>
                <td className="px-4 py-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${item.estado_documentos==='completa'?'bg-emerald-200 text-emerald-800':item.estado_documentos==='parcial'?'bg-amber-100':'bg-red-100'}`}>
                    {item.estado_documentos} ({item.num_docs})
                  </span>
                </td>
                <td className="px-4 py-2"><span className="uppercase text-xs px-2 py-0.5 bg-slate-100 rounded">{item.estado_pago}</span></td>
                <td className="px-4 py-2 text-sm tabular-nums">{item.fecha_programada_pago ? String(item.fecha_programada_pago).slice(0,10) : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={()=>openExpediente(item)} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium">Abrir Expediente</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAIL - Expediente del Lote (all requested info) */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => {setSelected(null); setDetalle(null);}}>
          <div className="w-full max-w-3xl bg-white h-full overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-start bg-white sticky top-0 z-10">
              <div>
                <div className="font-mono tracking-widest text-sm text-slate-500">EXPEDIENTE DEL LOTE</div>
                <div className="text-3xl font-semibold tracking-tighter">{selected.lot_number}</div>
                <div className="textslate-600">{selected.producer} · {selected.huerta}</div>
              </div>
              <button onClick={()=>{setSelected(null);setDetalle(null);}} className="px-3 py-1 text-sm">✕ Cerrar</button>
            </div>

            {detalleLoading ? (
              <div className="p-8">Cargando expediente completo...</div>
            ) : detalle ? (
              <div className="p-6 space-y-8">
                {/* General + producer + huerta + reception */}
                <section>
                  <h3 className="font-semibold mb-2">Datos generales del lote</h3>
                  <div className="grid grid-cols-2 text-sm gap-x-6 gap-y-1 bg-slate-50 p-4 rounded-xl">
                    <div><span className="text-slate-500">Fecha ingreso:</span> {String(detalle.lote.date || detalle.lote.fecha_ingreso||'').slice(0,10)}</div>
                    <div><span className="text-slate-500">Kg recibidos:</span> <span className="font-bold">{Number(detalle.lote.kg_recibidos || detalle.lote.kg_recibidos_real || 0).toLocaleString()}</span></div>
                    <div><span className="text-slate-500">Productor:</span> {detalle.lote.producer}</div>
                    <div><span className="text-slate-500">Huerta:</span> {detalle.lote.orchard_name}</div>
                    <div><span className="text-slate-500">Fruta:</span> {detalle.lote.fruit_type}</div>
                    <div><span className="text-slate-500">Municipio:</span> {detalle.lote.municipality || detalle.lote.origin || '-'}</div>
                  </div>
                </section>

                {/* Pesajes y Nota de Entrada de Fruta */}
                <section>
                  <h3 className="font-semibold mb-2">Pesadas y Nota de Entrada</h3>
                  {detalle.nota_entrada && (
                    <div className="mb-2 text-xs bg-emerald-50 p-2 rounded border border-emerald-200">
                      Peso registrado: <b>{Number(detalle.nota_entrada.total_kg || detalle.nota_entrada.total_kg_weighed || 0).toLocaleString()} kg</b> — Fecha: {String(detalle.nota_entrada.fecha || detalle.nota_entrada.public_scale_date || '').slice(0,10)}
                    </div>
                  )}
                  <div className="text-sm overflow-auto">
                    {detalle.pesajes?.length ? (
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-100"><th className="text-left p-1">Fecha</th><th>Kg neto</th><th>Cajas</th><th>Bruto</th></tr></thead>
                        <tbody>
                          {detalle.pesajes.map((p,i)=> <tr key={i}><td className="p-1">{String(p.timestamp||'').slice(0,16)}</td><td className="text-right tabular-nums">{p.net_weight}</td><td className="text-right">{p.boxes}</td><td className="text-right">{p.gross_weight}</td></tr>)}
                        </tbody>
                      </table>
                    ) : <div className="text-xs text-slate-500">Los datos de pesaje y nota de entrada se muestran automáticamente desde el módulo Ingreso de Fruta.</div>}
                  </div>
                </section>

                {/* Historial / Movimientos */}
                <section>
                  <h3 className="font-semibold mb-2">Historial del lote</h3>
                  <div className="max-h-[160px] overflow-auto text-xs divide-y border rounded">
                    {(detalle.historial||[]).length ? detalle.historial.map((h, i) => (
                      <div key={i} className="px-3 py-1 flex gap-3">
                        <span className="tabular-nums text-slate-400 w-20">{String(h.fecha||'').slice(0,10)}</span>
                        <span>{h.accion || h.estatus || 'Movimiento registrado'}</span>
                      </div>
                    )) : <div className="p-3 text-slate-500">Sin historial adicional.</div>}
                  </div>
                </section>

                {/* Clasificaciones / Lotificación */}
                <section>
                  <h3 className="font-semibold mb-2">Clasificaciones y Lotificación</h3>
                  <div className="text-xs">Datos de rendimiento y calibre incluidos en el detalle automático.</div>
                </section>

                {/* Contrato de Compraventa con Cláusula Especial + DocuSign */}
                <section className="border p-4 rounded-2xl bg-slate-50">
                  <h3 className="font-semibold mb-1 flex gap-1 items-center">Contrato de Compraventa con Cláusula Especial</h3>
                  <p className="text-xs text-slate-500 mb-3">Precargado por defecto. Firma electrónica via DocuSign desde el acceso del contador.</p>
                  <a href={detalle.contrato.url} target="_blank" className="inline-block px-4 py-2 bg-white border text-sm rounded-xl">Descargar contrato base</a>
                  {detalle.contrato?.signature && (
                    <div className="mt-3 text-xs">
                      <div className="font-medium mb-1">Estado firma electrónica:</div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">{detalle.contrato.signature.status || 'pendiente_de_firma'}</span>
                      {detalle.contrato.signature.signer_email && <div className="mt-1">Firmante: {detalle.contrato.signature.signer_name || ''} ({detalle.contrato.signature.signer_email})</div>}
                      {detalle.contrato.signature.signed_at && <div>Fecha: {String(detalle.contrato.signature.signed_at).slice(0,16)}</div>}
                      {detalle.contrato.signature.signed_file_url && <a href={detalle.contrato.signature.signed_file_url} target="_blank" className="text-emerald-700 underline block mt-1">Ver documento firmado</a>}
                    </div>
                  )}
                </section>

                {/* REQUISITOS OBLIGATORIOS PARA PAGO */}
                <section className="border-2 border-green-200 p-4 rounded-2xl bg-white">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      REQUISITOS OBLIGATORIOS PARA PAGO
                    </h3>
                    <button onClick={generate4DigitAccess} className="px-3 py-1 text-sm text-emerald-700 border border-emerald-300 rounded">Generar código 4 dígitos</button>
                  </div>

                  {/* Reference image with exact list */}
                  <img 
                    src="https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1783038702232_r1qy5p.png" 
                    alt="Requisitos obligatorios para pago" 
                    className="w-full rounded-xl mb-4 border"
                  />

                  <div className="text-xs font-medium uppercase tracking-wider text-emerald-700 mb-2">Documentos que debe cargar cada productor:</div>

                  <div className="space-y-3">
                    {REQUISITOS_PAGO.map((req) => {
                      const docMatch = (detalle.documentos || []).find(d => 
                        (d.document_type || '').toLowerCase().includes(req.tipo.split('_')[0]) || 
                        (d.document_type === req.tipo) ||
                        String(d.file_name||'').toLowerCase().includes(req.tipo)
                      );
                      const hasDoc = !!docMatch;
                      return (
                        <div key={req.tipo} className={`p-3 rounded-xl border flex justify-between items-start gap-3 ${hasDoc ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                          <div className="text-sm flex-1">
                            <div className="font-medium">{req.label}</div>
                            {hasDoc && <div className="text-[10px] text-emerald-700 mt-0.5">✓ Subido: {docMatch.file_name || 'Documento cargado'}</div>}
                            {!hasDoc && <div className="text-[11px] text-amber-600">Pendiente de carga</div>}
                          </div>
                          <label className="text-xs px-3 py-1 border cursor-pointer rounded-xl bg-white whitespace-nowrap hover:bg-emerald-50 active:bg-emerald-100">
                            {hasDoc ? 'Reemplazar' : 'Subir'}
                            <input type="file" hidden onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadDoc(f, req.tipo);
                              e.target.value = '';
                            }} />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500">Al cargar aquí, el documento se asocia directamente al expediente del lote para revisión y programación de pago.</p>
                </section>

                {/* Observaciones / Estado del expediente + Pago info */}
                <section>
                  <h3 className="font-semibold mb-2">Estado del Expediente y Programación de Pagos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col p-4 rounded border">
                      <span className="text-xs text-slate-500">Estado del expediente</span>
                      <span className="font-semibold text-lg">{detalle.estados?.expediente || detalle.lote.estado_expediente}</span>
                    </div>
                    <div className="flex flex-col p-4 rounded border">
                      <span className="text-xs text-slate-500">Estado de documentos</span>
                      <span className="font-semibold text-lg">{detalle.estados?.documentos || detalle.lote.estado_documentos}</span>
                    </div>
                    <div className="flex flex-col p-4 rounded border">
                      <span className="text-xs text-slate-500">Estado pago</span>
                      <span className="font-semibold text-lg">{detalle.estados?.pago || detalle.lote.estado_pago}</span>
                      <span className="text-[11px] mt-1">Programado: {detalle.estados?.fecha_programada_pago || selected.fecha_programada_pago || '—'}</span>
                    </div>
                  </div>
                </section>

                <div className="text-xs text-slate-400 border-t pt-4">Todos los datos están vinculados al lote. Modificación restringida. No afecta otros módulos.</div>
              </div>
            ) : (
              <div className="p-8">No se cargó información detallada para este lote.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
