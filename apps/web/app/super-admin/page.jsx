'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminPage() {
  const router = useRouter();
  const [pendingChanges, setPendingChanges] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentCredential, setCurrentCredential] = useState('superadministrador');
  const [dynamicMenu, setDynamicMenu] = useState([]);
  const [apks, setApks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [scanCode, setScanCode] = useState('');
  const [currentBatch, setCurrentBatch] = useState(null);
  const [recuento, setRecuento] = useState({ pallets_complete: 0, boxes_96: 0, boxes_156: 0, total_kg: 0, notes: '' });
  const [syncStatus, setSyncStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const credentials = [
    { key: 'campo', label: 'Campo / Acopios' },
    { key: 'operaciones', label: 'Operaciones' },
    { key: 'administrador', label: 'Administrador' },
    { key: 'superadministrador', label: 'Superadministrador' }
  ];

  useEffect(() => {
    loadData();
    fetchDynamicMenu(currentCredential);
    fetchApks();
    loadBatches();
    const iv = setInterval(() => loadBatches(), 4500);
    return () => clearInterval(iv);
  }, []);

  const loadData = async () => {
    try {
      const changesRes = await fetch('/api/pending-changes?status=pending');
      setPendingChanges(await changesRes.json().catch(() => []));

      const notifRes = await fetch('/api/notifications?userId=super-admin-user-id');
      setNotifications(await notifRes.json().catch(() => []));
    } catch (_) {}
    finally { setLoading(false); }
  };

  const fetchDynamicMenu = async (credential) => {
    try {
      const url = credential ? `/api/menu?credential=${credential}` : '/api/menu';
      const res = await fetch(url, { credentials: 'include' });
      const data = res.ok ? await res.json() : [];
      setDynamicMenu(Array.isArray(data) ? data : []);
    } catch (_) { setDynamicMenu([]); }
  };

  const fetchApks = async () => {
    try {
      const res = await fetch('/api/superadmin/apps');
      if (res.ok) {
        const all = await res.json();
        setApks((all || []).filter(a => (a.tipo && (a.tipo.toLowerCase().includes('m') || a.tipo.toLowerCase().includes('apk'))) || true ));
      }
    } catch (_) {}
  };

  const loadBatches = async () => {
    try {
      const res = await fetch('/api/batch-bands');
      const data = res.ok ? await res.json() : [];
      setBatches(Array.isArray(data) ? data : []);
    } catch (_) {}
  };

  const changeCredential = (key) => {
    setCurrentCredential(key);
    fetchDynamicMenu(key);
  };

  const handleApkDownload = async (apk) => {
    if (!apk?.id) {
      alert('APK real no disponible. Compila APK Android firmado y súbelo con URL verificada. Requiere conexión externa.');
      return;
    }
    try {
      const r = await fetch(`/api/superadmin/apps/download?appId=${apk.id}`);
      const d = await r.json();
      if (d.allowed && d.download_url) {
        const link = document.createElement('a');
        link.href = d.download_url;
        link.download = d.filename || `${apk.nombre}.apk`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      alert(d.error || 'APK real verificado no disponible. Solo archivos con apk_url real son permitidos. Usa Superadministrador para subir build real.');
    } catch {
      alert('APK real no disponible. Solo descargas verificadas permitidas.');
    }
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (_) {
      alert('No se pudo acceder a la cámara del dispositivo');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const processScan = async () => {
    if (!scanCode.trim()) return;
    setSyncStatus('Procesando escaneo...');
    try {
      const code = scanCode.trim();
      let loaded = null;
      // Try batch tracking (lot)
      try {
        const tr = await fetch(`/api/batch-tracking?lotId=${encodeURIComponent(code)}`);
        if (tr.ok) {
          const td = await tr.json();
          loaded = td.lot || td;
        }
      } catch (_) {}

      if (!loaded) {
        try {
          const br = await fetch(`/api/batch-bands?lotId=${encodeURIComponent(code)}`);
          if (br.ok) {
            const bd = await br.json();
            loaded = Array.isArray(bd) ? bd[0] : bd;
          }
        } catch (_) {}
      }

      if (loaded) {
        setCurrentBatch(loaded);
        // Load recuento data
        const bid = loaded.lot_id || loaded.id;
        try {
          const bandRes = await fetch(`/api/batch-bands${bid ? '?lotId=' + bid : ''}`);
          const bands = bandRes.ok ? await bandRes.json() : [];
          const b = Array.isArray(bands) && bands.length ? bands[0] : loaded;
          setRecuento({
            pallets_complete: b.pallets_complete || 0,
            boxes_96: b.boxes_96 || 0,
            boxes_156: b.boxes_156 || 0,
            total_kg: b.total_kg || 0,
            notes: b.notes || ''
          });
        } catch (_) {}
        setSyncStatus('Lote procesado desde escaneo');
      } else {
        setCurrentBatch({ id: null, lot_id: parseInt(code) || null, lot_number: code });
        setSyncStatus('Código leído. Listo para recuento');
      }
    } catch (_) { 
      setSyncStatus('No se encontró lote para el código');
    }
  };

  const registerScan = async () => {
    if (!scanCode.trim()) return;
    try {
      await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'batch-scan',
          lot_id: parseInt(scanCode) || null,
          description: `Escaneo QR registrado en SuperAdmin: ${scanCode}`
        })
      });
      setSyncStatus('Escaneo QR sincronizado al backend');
    } catch (_) {}
  };

  const updateRecuento = (key, value) => {
    setRecuento(prev => ({ ...prev, [key]: value === '' ? 0 : parseFloat(value) || 0 }));
  };

  const incRec = (key, delta) => {
    setRecuento(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) }));
  };

  const syncRecuento = async () => {
    if (!currentBatch) return;
    setSyncStatus('Sincronizando recuento con backend...');
    try {
      const lotId = currentBatch.lot_id || currentBatch.id || currentBatch.bandId;
      const payload = {
        id: currentBatch.id || currentBatch.bandId || undefined,
        lot_id: lotId,
        lot_number: currentBatch.lot_number || `L-${lotId}`,
        producer_name: currentBatch.producer_name || currentBatch.producer || 'Sin productor',
        lot_date: currentBatch.lot_date || currentBatch.date || new Date().toISOString().split('T')[0],
        ...recuento,
        caliber: currentBatch.caliber || null,
        class_name: currentBatch.class_name || 'A'
      };

      const hasId = currentBatch.bandId || currentBatch.lot_id || currentBatch.id;
      const method = hasId ? 'PUT' : 'POST';
      const url = hasId ? '/api/batch-bands' : '/api/batch-bands';
      if (hasId) payload.id = currentBatch.bandId || currentBatch.lot_id || currentBatch.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSyncStatus('Recuento sincronizado en tiempo real');
        loadBatches();
        // reload latest data
        setTimeout(async () => {
          const fresh = await fetch(`/api/batch-bands${lotId ? '?lotId=' + lotId : ''}`);
          if (fresh.ok) {
            const bData = await fresh.json();
            const latest = Array.isArray(bData) ? bData[0] : bData;
            if (latest) {
              setCurrentBatch(latest);
              setRecuento({
                pallets_complete: latest.pallets_complete || 0,
                boxes_96: latest.boxes_96 || 0,
                boxes_156: latest.boxes_156 || 0,
                total_kg: latest.total_kg || 0,
                notes: latest.notes || ''
              });
            }
          }
        }, 400);
      } else {
        setSyncStatus('Error sincronizando');
      }
    } catch (_) {
      setSyncStatus('Error al sincronizar datos');
    }
  };

  const loadBatchForRecuento = (b) => {
    setCurrentBatch(b);
    setScanCode((b.lot_id || b.id || '').toString());
    setRecuento({
      pallets_complete: b.pallets_complete || 0,
      boxes_96: b.boxes_96 || 0,
      boxes_156: b.boxes_156 || 0,
      total_kg: b.total_kg || 0,
      notes: b.notes || ''
    });
    setSyncStatus('Lote cargado para edición');
  };

  // Flat modules for credential preview
  const shownModules = (dynamicMenu || []).flatMap(g => (g.modules || []).filter(m => m && (m.is_active !== false)).map(m => ({ ...m, _group: g.group_name })));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 rounded-3xl p-8 mb-8 text-white shadow">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Super Administrador</h1>
              <p className="text-emerald-200 mt-1">Navegación dinámica por credenciales • Descargas APK Android • Procesamiento con QR y recuento en tiempo real</p>
            </div>
            <div className="text-right text-sm">
              <div className="uppercase tracking-[3px] text-emerald-400 text-xs">MÓDULO CONTROL TOTAL</div>
              <div className="font-medium mt-0.5">{currentCredential.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation by Credentials */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-lg text-slate-800">Navegación Dinámica según Credenciales</div>
            <div className="text-xs text-slate-500">Vista previa filtrada por rol del usuario</div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {credentials.map(c => (
              <button
                key={c.key}
                onClick={() => changeCredential(c.key)}
                className={`px-5 py-2 rounded-2xl text-sm font-semibold transition shadow-sm border ${currentCredential === c.key ? 'bg-emerald-700 text-white border-emerald-800 shadow' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {shownModules.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {shownModules.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(m.module_route || '/')}
                  className="w-24 h-24 rounded-3xl flex flex-col items-center justify-center bg-[#1F3C2F] text-white shadow-[0_8px_0_#11182722] active:shadow-[0_2px_0_#11182722] hover:brightness-110 active:translate-y-px border border-black/20 transition"
                  title={`${m.module_name} · ${m._group || ''}`}
                >
                  <i className={`ph ${m.module_icon || 'ph-cube'} text-4xl mb-1`} />
                  <div className="text-[10px] opacity-80 truncate px-1">{m.module_name}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm italic bg-white border p-4 rounded-2xl">No se encontraron módulos para esta credencial. Configúralos en /menu-config.</div>
          )}
        </div>

        {/* APK Downloads - Android generated */}
        <div className="mb-8">
          <div className="rounded-3xl bg-white border p-6 mb-3 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <i className="ph ph-android-logo text-3xl text-emerald-700" />
              <div>
                <div className="font-semibold text-xl text-slate-900">Descargas de App Móvil (APK generado)</div>
                <div className="text-sm text-slate-500">Enlaces directos a archivos .apk generados. Compatible con Android. Descarga sólo si estás autorizado.</div>
              </div>
            </div>

            {/* Hidden other APK sections - only production-ready Orden de Corte shown */}
            {apks.filter(a => (a.nombre||'').toLowerCase().includes('corte')).length > 0 ? (
              apks.filter(a => (a.nombre||'').toLowerCase().includes('corte')).slice(0,1).map((apk, i) => (
                <div key={i} className="border-2 border-emerald-600 rounded-3xl p-6">
                  <div className="font-bold text-xl text-emerald-800">Orden de Corte - APK Producción</div>
                  <div className="text-sm">Único módulo con APK funcional de producción disponible.</div>
                  <button onClick={() => handleApkDownload(apk)} className="mt-4 w-full px-6 py-3 bg-emerald-700 text-white rounded-2xl text-sm font-semibold">DESCARGAR APK ORDEN DE CORTE</button>
                </div>
              ))
            ) : (
              <div className="text-sm bg-slate-50 p-3 rounded-xl text-slate-600">Solo el módulo Orden de Corte tiene APK de producción. Use Superadministrador para generar el enlace.</div>
            )}
            ) : (
              <div className="text-sm bg-slate-50 p-3 rounded-xl text-slate-600">No hay APKs generadas todavía. Sube archivos APK vía API o módulo de apps generadas.</div>
            )}
          </div>
        </div>

        {/* Real-time Batch + QR + Recuento panels */}
        <div className="mb-3">
          <div className="font-semibold text-xl text-slate-900 mb-1">Procesamiento por Lotes • Escaneo QR + Recuento</div>
          <div className="text-sm text-slate-500 mb-4">Los datos se sincronizan automáticamente cada pocos segundos con el backend usando APIs batch-bands, batch-tracking y qr-codes.</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* QR SCAN PANEL */}
          <div className="bg-white rounded-3xl p-6 border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold flex items-center gap-2 text-slate-900">
                <i className="ph ph-qr-code text-2xl" /> Escaneo de Códigos QR
              </div>
              {cameraActive && <button onClick={stopCamera} className="text-xs px-3 py-1 bg-slate-100 rounded-full">Detener cámara</button>}
            </div>

            <div className="mb-3">
              <button onClick={startCamera} className="w-full mb-2 py-2 flex justify-center items-center gap-2 rounded-2xl border text-sm font-medium bg-white hover:bg-slate-50 active:bg-slate-100">
                <i className="ph ph-camera" /> {cameraActive ? 'Cámara activa (escanea con celular si es necesario)' : 'Activar cámara para escaneo QR'}
              </button>
              {cameraActive && (
                <video ref={videoRef} className="w-full rounded-xl border bg-black" style={{ maxHeight: 180 }} autoPlay playsInline />
              )}
            </div>

            <input
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Código QR o ID de lote (ej: 123 o LOT-ABC)"
              className="w-full border px-4 py-2.5 rounded-2xl text-sm mb-2"
            />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={processScan} className="bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-2xl text-sm font-semibold">Procesar Escaneo</button>
              <button onClick={registerScan} className="border py-2.5 rounded-2xl text-sm hover:bg-slate-50">Registrar QR en Backend</button>
            </div>

            <div className="mt-3 text-xs text-emerald-700">{syncStatus}</div>
            {currentBatch && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-2xl text-sm">
                Lote activo: <span className="font-semibold">{currentBatch.lot_number || currentBatch.lot_id || currentBatch.id}</span>
                <br />{currentBatch.producer_name || currentBatch.producer || ''}
              </div>
            )}
          </div>

          {/* RECUENTO PANEL */}
          <div className="bg-white rounded-3xl p-6 border shadow-sm">
            <div className="font-semibold mb-3 text-slate-900">Panel de Recuento (sincroniza al backend)</div>

            {!currentBatch && <div className="text-sm opacity-60">Escanea un código o selecciona un lote de la lista abajo para editar recuento.</div>}

            {currentBatch && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  {[
                    {k:'pallets_complete', l:'Pallets completos'},
                    {k:'boxes_96', l:'Cajas 96'},
                    {k:'boxes_156', l:'Cajas 156'},
                    {k:'total_kg', l:'Total kg'}
                  ].map(f => (
                    <div key={f.k} className="">
                      <div className="text-xs text-slate-500 mb-1">{f.l}</div>
                      <div className="flex gap-1">
                        <button onClick={() => incRec(f.k, -1)} className="px-3 border rounded-xl active:bg-slate-100">-</button>
                        <input type="number" step="0.01" value={recuento[f.k]} onChange={e => updateRecuento(f.k, e.target.value)} className="flex-1 border px-3 py-1.5 rounded-xl text-center" />
                        <button onClick={() => incRec(f.k, 1)} className="px-3 border rounded-xl active:bg-slate-100">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <textarea value={recuento.notes} onChange={e => setRecuento({...recuento, notes: e.target.value})} placeholder="Notas..." className="w-full text-sm border px-3 py-2 rounded-2xl mb-3" />

                <button onClick={syncRecuento} className="w-full py-3 bg-emerald-800 text-white text-sm font-semibold rounded-3xl">
                  SINCRONIZAR RECUENTO AL BACKEND (TIEMPO REAL)
                </button>
                <div className="text-[10px] text-center mt-1 text-emerald-700">{syncStatus}</div>
              </>
            )}
          </div>
        </div>

        {/* Live batches */}
        <div className="bg-white rounded-3xl border p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Lotes / Bandas en tiempo real (auto-refresco)</div>
            <button onClick={loadBatches} className="text-xs px-3 py-1 border rounded-full">Actualizar ahora</button>
          </div>
          {batches.length === 0 && <div className="text-sm text-slate-500">Sin registros de lotes por el momento. Los datos que crees se mostrarán aquí inmediatamente.</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2 max-h-[240px] overflow-auto pr-1 text-sm">
            {batches.slice(0, 18).map((b, i) => (
              <div key={i} onClick={() => loadBatchForRecuento(b)} className="cursor-pointer border rounded-2xl px-3 py-2 hover:border-emerald-600 hover:bg-emerald-50/40 flex items-center justify-between">
                <div>
                  <div className="font-medium">{b.lot_number} · {b.producer_name || ''}</div>
                  <div className="text-xs opacity-70">{b.lot_date} | {b.caliber || ''} {b.class_name || ''}</div>
                </div>
                <div className="text-right text-xs">
                  {b.pallets_complete || 0}P / {b.total_kg || 0}kg
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Haz clic en un lote para cargarlo directamente en el panel de recuento. Todos los cambios se guardan en tiempo real en el backend.</div>
        </div>
      </div>
    </div>
  );
}