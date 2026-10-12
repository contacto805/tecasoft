'use client';

import { useEffect, useState, useRef } from 'react';
import { Printer, Plus, Trash2, Edit2, Eye, Save } from 'lucide-react';

export default function ThermalLabelsPage() {
  const [lots, setLots] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  // Editable label design state
  const [labelConfig, setLabelConfig] = useState({
    width_mm: 80,
    height_mm: 50,
    bg_color: '#ffffff',
    text_color: '#000000',
    border_color: '#111111',
    title: 'LOTE FRUTA',
    lot_number: '',
    producer: '',
    caliber: '',
    total_kg: '',
    date: '',
    custom_texts: [],
    image_url: ''
  });

  // Add a custom text overlay
  const [newText, setNewText] = useState({ content: 'Texto adicional', x: 10, y: 35, size: 10 });

  useEffect(() => {
    fetchLots();
    fetchPrinters();
    fetchExistingLabels();
  }, []);

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(data || []);
    } catch (e) {}
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/templates/printers');
      const data = await res.json();
      setPrinters(data || []);
      if (data && data.length > 0 && !selectedPrinter) {
        const def = data.find(p => p.is_default) || data[0];
        setSelectedPrinter(def);
      }
    } catch (e) {}
  };

  const fetchExistingLabels = async () => {
    try {
      const res = await fetch('/api/production/thermal-labels');
      const data = await res.json();
      setLabels(data || []);
    } catch (e) {}
  };

  const loadLotIntoLabel = (lot) => {
    if (!lot) return;
    setSelectedLot(lot);
    setLabelConfig(prev => ({
      ...prev,
      lot_number: lot.lot_number || '',
      producer: lot.producer || '',
      total_kg: lot.total_kg || lot.total_kg_received || '',
      date: lot.date ? new Date(lot.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));
  };

  const updateLabelField = (field, val) => {
    setLabelConfig({ ...labelConfig, [field]: val });
  };

  // Live editable area: add custom text
  const addCustomText = () => {
    if (!newText.content.trim()) return;
    const updated = [...labelConfig.custom_texts, { ...newText, id: Date.now() }];
    setLabelConfig({ ...labelConfig, custom_texts: updated });
    setNewText({ content: 'Texto adicional', x: 15, y: 38, size: 10 });
  };

  const removeCustomText = (id) => {
    setLabelConfig({
      ...labelConfig,
      custom_texts: labelConfig.custom_texts.filter(t => t.id !== id)
    });
  };

  const updateCustomText = (id, field, value) => {
    setLabelConfig({
      ...labelConfig,
      custom_texts: labelConfig.custom_texts.map(t =>
        t.id === id ? { ...t, [field]: value } : t
      )
    });
  };

  const insertImage = () => {
    // Will be used from UI input directly via labelConfig.image_url
    alert('Ingresa la URL de imagen arriba. La imagen se muestra automáticamente en la etiqueta.');
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const generatePrintableLabel = () => {
    const cfg = labelConfig;
    const w = cfg.width_mm || 80;
    const h = cfg.height_mm || 50;

    const html = `
      <!doctype html>
      <html><head><title>Etiqueta Térmica ${cfg.lot_number || ''}</title>
      <style>
        @page { size: ${w}mm ${h}mm; margin: 0; }
        body { margin:0; padding:0; background:#fff; }
        .label {
          width:${w}mm; height:${h}mm; box-sizing:border-box;
          border:2px solid ${cfg.border_color}; background:${cfg.bg_color}; color:${cfg.text_color};
          padding:4mm; font-family: Arial, Helvetica, sans-serif; position:relative; overflow:hidden;
        }
        .title { font-size:13px; font-weight:700; margin-bottom:2mm; }
        .line { font-size:11px; line-height:1.15; margin:0.8mm 0; }
        .big { font-size:15px; font-weight:700; }
        .img { max-width:100%; max-height:22mm; object-fit:contain; margin-top:2mm; border:1px solid #ddd; }
        .small { font-size:8px; }
      </style>
      </head><body>
      <div class="label">
        <div class="title">${cfg.title}</div>
        ${cfg.lot_number ? `<div class="line big">LOTE: ${cfg.lot_number}</div>` : ''}
        ${cfg.producer ? `<div class="line">Productor: ${cfg.producer}</div>` : ''}
        ${cfg.caliber ? `<div class="line">Calibre: ${cfg.caliber}</div>` : ''}
        ${cfg.total_kg ? `<div class="line big">Peso: ${cfg.total_kg} kg</div>` : ''}
        ${cfg.date ? `<div class="line small">Fecha: ${cfg.date}</div>` : ''}
        ${cfg.custom_texts.map(t => `<div class="line" style="font-size:${t.size}px;position:absolute;left:${t.x}mm;top:${t.y}mm;">${t.content}</div>`).join('')}
        ${cfg.image_url ? `<img class="img" src="${cfg.image_url}" />` : ''}
      </div>
      <script>window.print(); setTimeout(() => window.close(), 400);</script>
      </body></html>`;

    const wnd = window.open('', '_blank');
    if (wnd) {
      wnd.document.write(html);
      wnd.document.close();
    }
  };

  const handleDirectPrint = async () => {
    if (!labelConfig.lot_number) {
      alert('Completa al menos el Número de Lote');
      return;
    }
    setLoading(true);
    try {
      // Save this thermal label record
      await fetch('/api/production/thermal-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_batch_id: 0,
          lot_id: selectedLot?.id || 0,
          lot_number: labelConfig.lot_number,
          packing_date: labelConfig.date,
          cold_date: labelConfig.date,
          caliber: labelConfig.caliber || 'VAR',
          class_name: 'A',
          total_kg: parseFloat(labelConfig.total_kg) || 0,
          pallets_complete: 1,
          boxes_96: 0,
          boxes_156: 0,
          price_per_kg: 0
        })
      });

      // Log print with printer
      if (selectedPrinter) {
        await fetch('/api/labels/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lot_id: selectedLot?.id || 0,
            template_id: 0,
            quantity,
            printer_id: selectedPrinter.id,
            label_data: {
              type: 'thermal',
              config: labelConfig,
              printer: selectedPrinter.printer_name
            }
          })
        });
      }

      generatePrintableLabel();
      setShowPreview(false);
      fetchExistingLabels();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick edit to label area live
  const editLabelDimension = (dim, val) => updateLabelField(dim, parseInt(val) || 40);

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Etiquetas Térmicas</h1>
          <p className="text-slate-500">Edita área, textos e inserta imágenes. Selecciona impresora PC configurada y imprime directamente.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Lot */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="font-semibold mb-3 flex items-center gap-2">Seleccionar Lote</div>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 mb-3"
                value={selectedLot?.id || ''}
                onChange={e => {
                  const l = lots.find(x => x.id === parseInt(e.target.value));
                  if (l) loadLotIntoLabel(l);
                }}
              >
                <option value="">-- Elegir lote --</option>
                {lots.map(l => <option key={l.id} value={l.id}>{l.lot_number} • {l.producer}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs text-slate-600">Lote #</label>
                  <input value={labelConfig.lot_number} onChange={e => updateLabelField('lot_number', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Productor</label>
                  <input value={labelConfig.producer} onChange={e => updateLabelField('producer', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Calibre</label>
                  <input value={labelConfig.caliber} onChange={e => updateLabelField('caliber', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Peso (kg)</label>
                  <input type="number" value={labelConfig.total_kg} onChange={e => updateLabelField('total_kg', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Fecha</label>
                  <input type="date" value={labelConfig.date} onChange={e => updateLabelField('date', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Título</label>
                  <input value={labelConfig.title} onChange={e => updateLabelField('title', e.target.value)} className="w-full border px-3 py-1.5 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Area & Design Edit */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="font-semibold mb-3">Editar Área de Etiqueta + Diseño</div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs">Ancho (mm)</label>
                  <input type="number" value={labelConfig.width_mm} onChange={e => editLabelDimension('width_mm', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="text-xs">Alto (mm)</label>
                  <input type="number" value={labelConfig.height_mm} onChange={e => editLabelDimension('height_mm', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                <div>
                  <div>Fondo</div>
                  <input type="color" value={labelConfig.bg_color} onChange={e => updateLabelField('bg_color', e.target.value)} className="w-full h-8" />
                </div>
                <div>
                  <div>Texto</div>
                  <input type="color" value={labelConfig.text_color} onChange={e => updateLabelField('text_color', e.target.value)} className="w-full h-8" />
                </div>
                <div>
                  <div>Borde</div>
                  <input type="color" value={labelConfig.border_color} onChange={e => updateLabelField('border_color', e.target.value)} className="w-full h-8" />
                </div>
              </div>

              {/* Text and Area edit live */}
              <div>
                <div className="font-medium text-sm mb-2">Agregar Texto en Área</div>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <input value={newText.content} onChange={e=>setNewText({...newText, content:e.target.value})} placeholder="Texto" className="col-span-3 border px-2 py-1 rounded" />
                  <input type="number" value={newText.x} onChange={e=>setNewText({...newText, x:parseFloat(e.target.value)})} placeholder="X mm" className="border px-1 py-1 text-xs rounded" />
                  <input type="number" value={newText.y} onChange={e=>setNewText({...newText, y:parseFloat(e.target.value)})} placeholder="Y mm" className="border px-1 py-1 text-xs rounded" />
                </div>
                <div className="flex gap-2 mb-3">
                  <input type="number" value={newText.size} onChange={e=>setNewText({...newText, size:parseInt(e.target.value)})} className="w-16 border px-1 py-1 rounded" />
                  <button onClick={addCustomText} className="flex-1 text-sm px-3 py-1 bg-slate-800 text-white rounded hover:bg-black">Agregar Texto</button>
                </div>

                {labelConfig.custom_texts.length > 0 && (
                  <div className="text-xs mb-3">
                    {labelConfig.custom_texts.map((t) => (
                      <div key={t.id} className="flex items-center mb-1 gap-1 bg-slate-50 p-1 rounded">
                        <input className="flex-1 border px-1" value={t.content} onChange={e=>updateCustomText(t.id, 'content', e.target.value)} />
                        <input className="w-12 border px-1 text-xs" type="number" value={t.x} onChange={e=>updateCustomText(t.id,'x',parseFloat(e.target.value))} />
                        <input className="w-12 border px-1 text-xs" type="number" value={t.y} onChange={e=>updateCustomText(t.id,'y',parseFloat(e.target.value))} />
                        <button onClick={() => removeCustomText(t.id)}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Image insertion */}
              <div className="mt-4">
                <label className="text-sm font-medium">Imagen (URL empresaria/logo o foto)</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text" 
                    placeholder="https://.../logo.png"
                    value={labelConfig.image_url}
                    onChange={(e) => updateLabelField('image_url', e.target.value)}
                    className="flex-1 border px-3 py-1 rounded-xl text-sm"
                  />
                  <button onClick={insertImage} className="px-3 rounded bg-slate-700 text-white text-xs"><Plus size={14} /> Insertar</button>
                </div>
                <div className="text-[10px] mt-0.5 text-slate-500">Ingresa la URL y se verá en la etiqueta.</div>
              </div>
            </div>

            {/* Printers Integration */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">Impresoras PC Configuradas</div>
                <a href="/gestor-etiquetas/impresoras" className="text-xs text-brand-600">Configurar →</a>
              </div>
              <select 
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                value={selectedPrinter ? selectedPrinter.id : ''}
                onChange={(e) => {
                  const p = printers.find(pr => pr.id == e.target.value);
                  setSelectedPrinter(p);
                }}
              >
                <option value="">Selecciona impresora</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.printer_name} • {p.printer_type} ({p.connection_type})
                    {p.is_default ? ' · predeterminada' : ''}
                  </option>
                ))}
              </select>
              {selectedPrinter && (
                <div className="mt-2 text-xs text-emerald-600">
                  {selectedPrinter.connection_type === 'network' ? `${selectedPrinter.ip_address}:${selectedPrinter.port}` : selectedPrinter.device_path} — Lista para usar
                </div>
              )}
              <div className="mt-1 text-xs text-slate-500">Las impresoras se selecciona aquí y se registra en cada impresión.</div>
            </div>

            <div className="flex gap-3">
              <button onClick={handlePreview} className="flex-1 flex gap-2 items-center justify-center py-3 border border-slate-300 rounded-2xl text-sm hover:bg-white" disabled={!labelConfig.lot_number}>
                <Eye size={17} /> Vista Previa
              </button>
              <button onClick={handleDirectPrint} disabled={loading || !labelConfig.lot_number || !selectedPrinter} className="flex-1 flex gap-2 items-center justify-center bg-black text-white rounded-2xl text-sm py-3 disabled:opacity-60">
                <Printer size={17} /> {loading ? 'Imprimiendo...' : `Imprimir Directo${selectedPrinter ? ' en '+selectedPrinter.printer_name : ''}`}
              </button>
            </div>

            <div className="text-xs text-center text-slate-400">Al imprimir se guarda el registro en la base de datos para trazabilidad y no requiere programas externos.</div>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b mb-3">
                <div className="font-semibold">Área de Etiqueta (edición en vivo)</div>
                <button onClick={() => setShowPreview(true)} className="text-xs px-3 py-1 flex items-center gap-1 border rounded bg-white hover:bg-slate-100"><Eye size={14} /> Ver a escala</button>
              </div>

              <div 
                style={{ 
                  width: Math.max(260, (labelConfig.width_mm || 80) * 3.2), 
                  height: Math.max(140, (labelConfig.height_mm || 50) * 3.2), 
                  background: labelConfig.bg_color, 
                  color: labelConfig.text_color, 
                  border: `3px solid ${labelConfig.border_color}`
                }} 
                className="relative mx-auto rounded shadow-inner border overflow-hidden flex flex-col p-[9px] text-sm" 
              >
                <div className="font-bold text-center mb-1 tracking-tight">{labelConfig.title}</div>

                {labelConfig.lot_number && <div className="font-semibold text-[15px] text-center leading-none mt-0.5" >LOTE: {labelConfig.lot_number}</div>}
                {labelConfig.producer && <div className="text-center text-[10px] opacity-85">{labelConfig.producer}</div> }
                {labelConfig.caliber && <div className="text-center text-xs mt-px">Calibre {labelConfig.caliber}</div>}
                {labelConfig.total_kg && <div className="font-bold text-lg text-center mt-1">{labelConfig.total_kg} kg</div>}
                {labelConfig.date && <div className="text-[10px] text-center">{labelConfig.date}</div>}

                {/* editable image */}
                {labelConfig.image_url && (
                  <img src={labelConfig.image_url} alt="logo" className="max-h-[36%] object-contain self-center mt-1 border border-black/10" />
                )}

                {/* Text overlays editable directly */}
                {labelConfig.custom_texts.map((txt, i) => (
                  <div
                    key={i}
                    className="absolute px-1 bg-white/70 border text-xs cursor-move"
                    style={{ left: `${(txt.x / (labelConfig.width_mm || 80)) * 100}%`, top: `${(txt.y / (labelConfig.height_mm || 50)) * 100}%`, fontSize: `${txt.size}px` }}
                  >
                    {txt.content}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-center text-slate-500 mt-1">Dimensión exacta en mm: {labelConfig.width_mm} × {labelConfig.height_mm}</p>
            </div>

            {/* Past thermal labels */}
            {labels.length > 0 && (
              <div className="mt-5 bg-white border rounded-2xl p-4">
                <div className="uppercase font-medium text-xs text-slate-600 mb-2">Últimas Etiquetas Térmicas</div>
                <div className="text-sm max-h-[200px] overflow-auto space-y-1">
                  {labels.slice(0, 12).map((l, idx) => (
                    <div key={idx} className="flex gap-3 px-2 py-1 border-b text-xs hover:bg-slate-50">
                      <div>{l.lot_number}</div>
                      <div className="text-slate-500">{l.caliber} • {l.total_kg}kg</div>
                      <div className="text-slate-400 ml-auto">{l.packing_date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow max-w-[720px] w-full overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-bold">Vista Previa (tamaño real mm)</div>
              <button onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className="p-8 flex justify-center bg-slate-200">
              <div ref={printRef} style={{
                width:`${labelConfig.width_mm || 80}mm`,
                height:`${labelConfig.height_mm || 50}mm`,
                background:labelConfig.bg_color,
                color:labelConfig.text_color,
                border:`3px solid ${labelConfig.border_color}`,
                padding:'4mm', fontSize:'11px', position:'relative'
              }} className="shadow">
                <div className="font-bold text-center mb-1">{labelConfig.title}</div>
                {labelConfig.lot_number && <div className="font-bold text-center text-[16px] leading-none">LOTE: {labelConfig.lot_number}</div>}
                {labelConfig.producer && <div className="text-[10px] mt-1 text-center">{labelConfig.producer}</div>}
                {labelConfig.caliber && <div className="text-center mt-px">Calibre: {labelConfig.caliber}</div>}
                {labelConfig.total_kg && <div className="font-bold text-base text-center mt-1.5">{labelConfig.total_kg} kg</div>}
                {labelConfig.date && <div className="text-center text-xs mt-px">{labelConfig.date}</div>}
                {labelConfig.image_url && <img src={labelConfig.image_url} className="mx-auto mt-1 max-h-[26mm]" />}
                {labelConfig.custom_texts.map((t,i)=><div key={i} style={{position:'absolute',left:t.x+'mm',top:t.y+'mm',fontSize:t.size+'px'}}>{t.content}</div>)}
              </div>
            </div>
            <div className="px-4 pb-4 flex gap-3 justify-end border-t pt-4">
              <button onClick={() => setShowPreview(false)} className="px-5 py-2 rounded-xl border">Cerrar</button>
              <button onClick={handleDirectPrint} className="px-5 py-2 bg-black text-white rounded-xl flex items-center gap-2">
                <Printer size={17}/> Imprimir ahora en {selectedPrinter ? selectedPrinter.printer_name : 'impresora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
