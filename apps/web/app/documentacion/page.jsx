'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Key, Upload, Search, ExternalLink, RefreshCw, Users, CheckCircle, AlertCircle } from 'lucide-react';

export default function DocumentacionPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [pinData, setPinData] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [docsStatus, setDocsStatus] = useState({});

  useEffect(() => {
    loadLots();
  }, []);

  const loadLots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setLots(list);

      // Load existing accountant codes / tokens status
      const status = {};
      for (const lot of list.slice(0, 50)) { // limit for perf
        if (lot.accountant_code) {
          status[lot.id] = { pin: lot.accountant_code, hasPin: true };
          // Try to get doc count
          try {
            const dres = await fetch(`/api/contador/${lot.accountant_code}/documents`);
            if (dres.ok) {
              const d = await dres.json();
              status[lot.id].docCount = (d.documents || []).length;
            }
          } catch (_) {}
        }
      }
      setDocsStatus(status);
    } catch (e) {
      setLots([]);
    } finally {
      setLoading(false);
    }
  };

  const generatePinForLot = async (lot) => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/lots/${lot.id}/accountant-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferFourDigit: true })
      });
      const data = await res.json();
      const code = data.code4 || data.pin || data.token || lot.accountant_code;

      const newPinData = {
        lot,
        code,
        link: `/contador/${code}`
      };
      setPinData(newPinData);
      setSelectedLot(lot);
      setShowPinModal(true);

      // update list
      setLots(prev => prev.map(l => l.id === lot.id ? { ...l, accountant_code: code } : l));
      setDocsStatus(prev => ({ ...prev, [lot.id]: { pin: code, hasPin: true, docCount: prev[lot.id]?.docCount || 0 } }));

      // reload status docs if possible
      try {
        const dres = await fetch(`/api/contador/${code}/documents`);
        if (dres.ok) {
          const d = await dres.json();
          setDocsStatus(prev => ({ ...prev, [lot.id]: { ...prev[lot.id], docCount: (d.documents || []).length } }));
        }
      } catch (_) {}
    } catch (e) {
      alert('Error generando PIN. Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const openContadorAccess = (code) => {
    if (code) {
      router.push(`/contador/${code}`);
    } else {
      alert('Primero genera el PIN para este lote.');
    }
  };

  const copyPin = (code) => {
    navigator.clipboard.writeText(code);
    alert('PIN copiado al portapapeles');
  };

  const filteredLots = lots.filter(l =>
    (l.lot_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.producer || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.orchard_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalLots = lots.length;
  const withPin = lots.filter(l => l.accountant_code).length;
  const pending = totalLots - withPin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Documentación</h1>
                <p className="text-slate-600">Dashboard para accesos de contadores • Subida de documentos para cobro</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/contador')} className="px-4 py-2 border border-emerald-600 text-emerald-700 rounded-xl flex items-center gap-2 hover:bg-emerald-50">
              <Key className="w-4 h-4" /> Acceso Contador (PIN)
            </button>
            <button onClick={loadLots} className="px-4 py-2 bg-white border rounded-xl flex items-center gap-2 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
            <button onClick={() => router.push('/expedientes')} className="px-4 py-2 bg-emerald-700 text-white rounded-xl flex items-center gap-2">
              Expedientes
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-sm text-slate-500">Total Lotes</div>
            <div className="text-4xl font-bold text-slate-900 mt-1">{totalLots}</div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Con PIN de Acceso</div>
            <div className="text-4xl font-bold text-emerald-700 mt-1">{withPin}</div>
            <div className="text-xs text-emerald-600 mt-1">Listos para que el contador suba documentos</div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-sm text-amber-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Pendientes de PIN</div>
            <div className="text-4xl font-bold text-amber-600 mt-1">{pending}</div>
            <div className="text-xs text-amber-600 mt-1">Genera PIN para permitir subida de docs de cobro</div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-sm text-slate-500">Acceso Directo</div>
            <button onClick={() => router.push('/contador')} className="mt-2 w-full px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> Ir al Módulo de Subida de Documentos
            </button>
            <p className="text-[10px] text-slate-500 mt-2">Los contadores usan su PIN único por lote para subir los requisitos de cobro.</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-3.5 text-slate-400 w-4 h-4" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por lote, productor o huerta..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none"
            />
          </div>
          <button onClick={() => { setSearch(''); }} className="px-5 py-3 border rounded-2xl text-sm">Limpiar</button>
        </div>

        {/* Lots Table */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50">
            <div className="font-semibold text-slate-900">Lotes • Accesos para Documentación de Cobro</div>
            <div className="text-xs text-slate-500">PIN único por lote • Subida de docs desde /contador/[PIN]</div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Cargando lotes...</div>
          ) : filteredLots.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No hay lotes que coincidan.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="px-4 py-3 font-medium">Lote</th>
                    <th className="px-4 py-3 font-medium">Productor / Corredor</th>
                    <th className="px-4 py-3 font-medium">Huerta</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium text-right">Kg</th>
                    <th className="px-4 py-3 font-medium">PIN Acceso Contador</th>
                    <th className="px-4 py-3 font-medium">Docs Subidos</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLots.map(lot => {
                    const pin = lot.accountant_code || docsStatus[lot.id]?.pin;
                    const docCount = docsStatus[lot.id]?.docCount || 0;
                    return (
                      <tr key={lot.id} className="hover:bg-emerald-50/30">
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-800">{lot.lot_number}</td>
                        <td className="px-4 py-3">{lot.producer || lot.broker_name || lot.collector_name || '-'}</td>
                        <td className="px-4 py-3">{lot.orchard_name || '-'}</td>
                        <td className="px-4 py-3 tabular-nums text-xs">{lot.date ? String(lot.date).slice(0,10) : '-'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{Number(lot.total_kg_received || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {pin ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs tracking-widest">{pin}</span>
                              <button onClick={() => copyPin(pin)} className="text-emerald-600 text-xs underline">Copiar</button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600">Sin PIN</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {pin ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${docCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {docCount} docs
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => generatePinForLot(lot)}
                              disabled={generating}
                              className="px-3 py-1.5 text-xs rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {pin ? 'Ver / Regenerar PIN' : 'Generar PIN'}
                            </button>
                            {pin && (
                              <button
                                onClick={() => openContadorAccess(pin)}
                                className="px-3 py-1.5 text-xs rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <Upload className="w-3 h-3" /> Subir Docs
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Los contadores acceden con el PIN único de cada lote a <span className="font-mono">/contador/[PIN]</span> para descargar contrato y subir los documentos obligatorios para cobro. Los datos son los mismos que en Ingreso de Fruta y Expedientes.
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && pinData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPinModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-semibold text-xl flex items-center gap-2"><Key className="w-5 h-5 text-emerald-600" /> PIN para Contador</div>
                <div className="text-sm text-slate-600">Lote {pinData.lot.lot_number} • {pinData.lot.producer || pinData.lot.broker_name}</div>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-xl">✕</button>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
              <div className="text-xs uppercase tracking-widest text-emerald-700 mb-1">Código PIN (copia y envía al contador)</div>
              <div className="font-mono text-4xl tracking-[6px] text-emerald-900 text-center py-2">{pinData.code}</div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => copyPin(pinData.code)} className="flex-1 py-2 rounded-xl bg-white border text-sm">Copiar PIN</button>
                <button onClick={() => openContadorAccess(pinData.code)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Abrir acceso para subir documentos
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Este PIN permite al contador externo ingresar a subir los documentos requeridos para el cobro de este lote (constancia fiscal, identificación, estado de cuenta, contrato firmado, etc). El acceso es por lote y solo muestra la información de ese trámite.
            </div>

            <button onClick={() => setShowPinModal(false)} className="mt-4 w-full py-2.5 rounded-xl border">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
