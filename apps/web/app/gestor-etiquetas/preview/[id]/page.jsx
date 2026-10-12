'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function PreviewEtiqueta() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id;

  const [template, setTemplate] = useState(null);
  const [elements, setElements] = useState([]);
  const [sample, setSample] = useState({});
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState('');
  const [zoomPreview, setZoomPreview] = useState(1.5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
    fetchLots();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const res = await fetch(`/api/templates?id=${templateId}`);
      const data = await res.json();
      if (data?.length) {
        const tpl = data[0];
        setTemplate(tpl);
        if (tpl.design_config?.elements) setElements(tpl.design_config.elements);
      }
    } catch (e) {}
    setLoading(false);
  };

  const fetchLots = async () => {
    try {
      const r = await fetch('/api/lots');
      setLots(await r.json());
    } catch {}
  };

  const loadLotData = async (lid) => {
    setSelectedLot(lid);
    if (!lid) { setSample({}); return; }
    try {
      const [lot] = await (await fetch(`/api/lots/${lid}`)).json();
      const inv = await (await fetch(`/api/lot-inventory?lot_id=${lid}`)).json();

      setSample({
        lote: lot?.lot_number || '',
        lote_numero: lot?.lot_number || '',
        producto: lot?.fruit_type || 'Aguacate',
        productor: lot?.producer || '',
        huerto: lot?.orchard_name || lot?.origin || '',
        origen: lot?.origin || '',
        destino: lot?.destination || '',
        cliente: lot?.client_name || '',
        peso: lot?.total_kg_packed || lot?.net_weight || 0,
        cajas: lot?.boxes_count || 50,
        tarimas: lot?.pallets_count || 1,
        calibre: inv?.[0]?.caliber || '48',
        clase: inv?.[0]?.class_name || 'Extra',
        fecha_empaque: lot?.date ? new Date(lot.date).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
        fecha_actual: new Date().toLocaleDateString('es-MX'),
      });
    } catch {
      setSample({ lote: 'L-0001', cliente: 'Cliente demo', peso: '320' });
    }
  };

  const getVal = (el) => {
    if (el.type === 'variable' && el.variable) {
      const rawKey = el.variable.replace(/[{}]/g, '');
      if (sample[rawKey]) return sample[rawKey];
      return el.variable;
    }
    let txt = el.content || '';
    Object.keys(sample || {}).forEach(k => {
      txt = txt.replace(new RegExp(`\\{${k}\\}`, 'g'), sample[k] || '');
    });
    return txt;
  };

  const mmToPx = (n) => n * 3.78 * zoomPreview;

  const doPrint = () => {
    window.print();
  };

  const renderContent = (el) => {
    const val = getVal(el);
    const wpx = mmToPx(el.width);
    const hpx = mmToPx(el.height);
    if (el.type === 'qr') {
      return <div className="bg-white flex items-center justify-center" style={{ width: wpx, height: hpx }}><QRCodeCanvas value={val || 'DEMO'} size={Math.min(wpx, hpx)-6} /></div>;
    }
    if (el.type === 'barcode') {
      return <div className="border border-black bg-white overflow-hidden flex items-center" style={{ width: wpx, height: hpx, fontSize: '9px', fontFamily: 'monospace', justifyContent: 'center' }}>{'|||| ' + (val || '')}</div>;
    }
    if (el.type === 'image') return <div className="bg-slate-100 border" style={{ width: wpx, height: hpx, backgroundImage: el.content ? `url(${el.content})` : '', backgroundSize: 'contain', backgroundPosition: 'center' }} />;
    if (el.type === 'line') return <div className="bg-black" style={{ width: wpx, height: hpx }} />;
    if (el.type === 'rectangle') return <div style={{ width: wpx, height: hpx, background: el.backgroundColor, border: `${el.borderWidth}px solid ${el.borderColor}` }} />;
    // text/variable final render
    return <div style={{ fontSize: ((el.fontSize || 11) * zoomPreview) + 'px', color: el.color, fontWeight: el.fontWeight, textAlign: el.textAlign, whiteSpace: 'pre-wrap', lineHeight: '1.12', width: '100%', height: '100%', padding: 2, display: 'flex', alignItems: 'center', justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'end' : 'start' }}>{val}</div>;
  };

  if (loading || !template) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><div className="animate-pulse">Cargando vista previa...</div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Static clean header only visible on screen */}
      <div className="print:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center px-4 justify-between z-50">
        <div className="flex items-center">
          <button onClick={() => router.push('/gestor-etiquetas')} className="mr-3 px-3 py-1 text-sm hover:bg-slate-100 rounded">← Volver</button>
          <span className="font-semibold">{template.template_name}</span>
          <span className="text-xs ml-3 px-1.5 py-px bg-slate-100 rounded text-slate-500">{template.width_mm}×{template.height_mm} mm</span>
        </div>
        <div className="flex items-center gap-2">
          <select onChange={e => loadLotData(e.target.value)} value={selectedLot} className="px-2 py-1 text-xs rounded border">
            <option value="">Sin datos de lote reales (muestra general)</option>
            {lots.map(l => <option value={l.id} key={l.id}>{l.lot_number} ({l.producer})</option>)}
          </select>
          <button onClick={() => setZoomPreview(Math.max(0.8, zoomPreview - 0.2))} className="px-3 py-1 border rounded text-sm">−</button>
          <span className="px-1 text-xs">{Math.round(zoomPreview * 100)}%</span>
          <button onClick={() => setZoomPreview(Math.min(4, zoomPreview + 0.2))} className="px-3 py-1 border rounded text-sm">+</button>
          <button onClick={doPrint} className="ml-2 bg-emerald-600 text-white px-5 py-1.5 text-sm rounded font-semibold flex gap-2 items-center"><i className="ph ph-printer" /> IMPRIMIR / EXPORTAR PDF</button>
          <button onClick={() => router.push(`/gestor-etiquetas/editor/${templateId}`)} className="px-4 py-1.5 border text-sm rounded hover:bg-slate-50">Editar Diseño</button>
        </div>
      </div>

      {/* Preview area */}
      <div className="pt-16 pb-12 flex justify-center print:pt-0 print:pb-0 bg-slate-200 print:bg-white">
        <div>
          <div className="print:hidden text-center text-xs text-slate-400 mb-2 tracking-wide">PREVIEW PROFESIONAL • Compatible con impresoras térmicas y PDF</div>

          <div 
            className="shadow print:shadow-none bg-white relative border print:border print:m-0 border-slate-300 overflow-hidden"
            style={{ 
              width: template.width_mm * 3.78 * zoomPreview, 
              height: template.height_mm * 3.78 * zoomPreview 
            }}
          >
            {elements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(el => (
              <div
                key={el.id}
                className="absolute"
                style={{
                  left: el.x * 3.78 * zoomPreview + 'px',
                  top: el.y * 3.78 * zoomPreview + 'px',
                  width: el.width * 3.78 * zoomPreview + 'px',
                  height: el.height * 3.78 * zoomPreview + 'px',
                  fontWeight: el.fontWeight,
                  textAlign: el.textAlign,
                  color: el.color,
                  background: el.backgroundColor === 'transparent' ? 'transparent' : el.backgroundColor,
                  border: el.borderWidth + 'px solid ' + el.borderColor,
                  overflow: 'hidden',
                  zIndex: el.zIndex || 1,
                }}
              >
                {renderContent(el)}
              </div>
            ))}
          </div>
          <div className="print:hidden text-center mt-2 text-[10px] text-slate-500">
            Tamaño físico: {template.width_mm} x {template.height_mm} mm • Zoom: {zoomPreview.toFixed(1)}x
          </div>
        </div>
      </div>

      {/* Helpful note */}
      <div className="print:hidden text-xs text-center text-slate-500 max-w-md mx-auto pb-10">
        Usa “Imprimir” para generar PDF o enviar a la impresora instalada. Selecciona un lote arriba para sustituir las variables por datos reales.
      </div>
    </div>
  );
}
