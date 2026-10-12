'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function EditorEtiquetasPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id;
  
  const [template, setTemplate] = useState(null);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState('design'); // 'design' | 'preview'
  const [showGrid, setShowGrid] = useState(true);
  const [sampleData, setSampleData] = useState({});
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [showZplModal, setShowZplModal] = useState(false);
  const [zplCode, setZplCode] = useState('');
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [showLayers, setShowLayers] = useState(true);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchTemplate();
    fetchVariables();
    fetchLots();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates?id=${templateId}`);
      const data = await response.json();
      if (data.length > 0) {
        const tpl = data[0];
        setTemplate(tpl);
        if (tpl.design_config && tpl.design_config.elements) {
          setElements(tpl.design_config.elements);
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVariables = async () => {
    try {
      const response = await fetch('/api/templates/variables');
      const data = await response.json();
      setVariables(data || []);
    } catch (error) {
      console.error('Error fetching variables:', error);
    }
  };

  const fetchLots = async () => {
    try {
      const res = await fetch('/api/lots');
      const data = await res.json();
      setLots(data || []);
    } catch {}
  };

  const loadSampleFromLot = async (lotId) => {
    if (!lotId) {
      setSampleData({});
      return;
    }
    try {
      const lotRes = await fetch(`/api/lots/${lotId}`);
      const lot = await lotRes.json();

      const invRes = await fetch(`/api/lot-inventory?lot_id=${lotId}`);
      const inventory = await invRes.json();

      const sample = {
        lote: lot.lot_number || '',
        lote_numero: lot.lot_number || '',
        producto: lot.fruit_type || 'Aguacate',
        productor: lot.producer || '',
        huerto: lot.orchard_name || lot.origin || '',
        origen: lot.origin || '',
        destino: lot.destination || '',
        cliente: lot.client_name || 'Cliente',
        peso: lot.total_kg_packed || lot.net_weight || 400,
        cajas: lot.boxes_count || 50,
        tarimas: lot.pallets_count || 2,
        calibre: inventory?.[0]?.caliber || '48',
        clase: inventory?.[0]?.class_name || 'Extra',
        fecha_empaque: lot.date ? new Date(lot.date).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
        fecha_actual: new Date().toLocaleDateString('es-MX'),
        hora_actual: new Date().toLocaleTimeString('es-MX').slice(0,5),
        transportista: '',
      };
      setSampleData(sample);
    } catch (e) {
      // fallback min data
      setSampleData({
        lote: 'L-0001',
        producto: 'Aguacate',
        productor: 'Productor',
        peso: 420,
        cajas: 60,
        calibre: '40',
        clase: 'Extra',
        fecha_empaque: new Date().toLocaleDateString('es-MX')
      });
    }
  };

  const getDisplayValue = (el) => {
    if (mode !== 'preview') {
      if (el.type === 'variable') return el.variable || '{variable}';
      return el.content || '';
    }
    let val = el.content || '';
    if (el.type === 'variable' && el.variable) {
      const key = el.variable.replace(/[{}]/g, '');
      if (sampleData[key]) val = sampleData[key];
      else val = el.variable;
    }
    // allow text with inline vars too
    if (typeof val === 'string') {
      Object.keys(sampleData).forEach(k => {
        val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), sampleData[k]);
      });
    }
    return val;
  };

  const baseScale = 3.78; // px per mm at zoom=1

  const canvasWidth = (template?.width_mm || 100) * baseScale * zoom;
  const canvasHeight = (template?.height_mm || 60) * baseScale * zoom;

  const addElement = (type) => {
    const baseW = type === 'text' || type === 'variable' ? 140 : (type === 'barcode' || type === 'qr') ? 70 : 80;
    const baseH = type === 'text' || type === 'variable' ? 28 : (type === 'qr') ? 70 : 26;
    const newElement = {
      id: Date.now(),
      type,
      x: 12,
      y: 12,
      width: baseW,
      height: baseH,
      content: type === 'text' ? 'Texto nuevo' : '',
      variable: type === 'variable' ? '{lote}' : '',
      fontSize: type === 'text' || type === 'variable' ? 14 : 11,
      fontWeight: type === 'text' ? 'normal' : 'bold',
      textAlign: 'left',
      color: '#1f2937',
      backgroundColor: type === 'rectangle' ? '#e0f2fe' : 'transparent',
      borderWidth: 0,
      borderColor: '#64748b',
      zIndex: Math.max(0, ...elements.map(e => e.zIndex || 0)) + 1,
      rotation: 0,
    };
    const updated = [...elements, newElement];
    setElements(updated);
    setSelectedElement(newElement.id);
  };

  const updateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  };

  const duplicateElement = (id) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const copy = { ...el, id: Date.now(), x: el.x + 8, y: el.y + 8, zIndex: (el.zIndex || 0) + 10 };
    const upd = [...elements, copy];
    setElements(upd);
    setSelectedElement(copy.id);
  };

  const changeLayer = (id, dir) => {
    const ordered = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const idx = ordered.findIndex(e => e.id === id);
    if (idx < 0) return;
    if (dir === 'up' && idx < ordered.length - 1) {
      const tmpZ = ordered[idx].zIndex || 0;
      ordered[idx].zIndex = ordered[idx + 1].zIndex || 0;
      ordered[idx + 1].zIndex = tmpZ;
    } else if (dir === 'down' && idx > 0) {
      const tmpZ = ordered[idx].zIndex || 0;
      ordered[idx].zIndex = ordered[idx - 1].zIndex || 0;
      ordered[idx - 1].zIndex = tmpZ;
    }
    setElements(ordered);
  };

  // Drag movement on canvas
  const startDrag = (e, el) => {
    e.stopPropagation();
    setSelectedElement(el.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    setDragging({ id: el.id, startX, startY, origX, origY });
  };

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / (baseScale * zoom);
      const dy = (e.clientY - dragging.startY) / (baseScale * zoom);
      let nx = Math.round((dragging.origX + dx) * 10) / 10;
      let ny = Math.round((dragging.origY + dy) * 10) / 10;
      if (showGrid) {
        nx = Math.round(nx / 2) * 2;
        ny = Math.round(ny / 2) * 2;
      }
      updateElement(dragging.id, { x: Math.max(2, nx), y: Math.max(2, ny) });
    }
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / (baseScale * zoom);
      const dy = (e.clientY - resizing.startY) / (baseScale * zoom);
      let nw = Math.round((resizing.origW + dx) * 10) / 10;
      let nh = Math.round((resizing.origH + dy) * 10) / 10;
      if (showGrid) {
        nw = Math.max(12, Math.round(nw / 2) * 2);
        nh = Math.max(12, Math.round(nh / 2) * 2);
      } else {
        nw = Math.max(12, nw);
        nh = Math.max(12, nh);
      }
      updateElement(resizing.id, { width: nw, height: nh });
    }
  }, [dragging, resizing, zoom, showGrid]);

  const stopAll = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopAll);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopAll);
    };
  }, [onMouseMove, stopAll]);

  // Resize start
  const startResize = (e, el, corner) => {
    e.stopPropagation();
    setSelectedElement(el.id);
    setResizing({
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: el.width,
      origH: el.height,
      corner,
    });
  };

  // Alignment helpers: align selected or center on group
  const alignSelected = (type) => {
    if (!selectedElement) return;
    const el = elements.find(e => e.id === selectedElement);
    if (!el) return;
    let wx = template?.width_mm || 100;
    let hy = template?.height_mm || 60;
    let nx = el.x;
    let ny = el.y;
    if (type === 'left') nx = 4;
    if (type === 'center') nx = Math.round((wx - el.width) / 2);
    if (type === 'right') nx = Math.round(wx - el.width - 4);
    if (type === 'top') ny = 3;
    if (type === 'middle') ny = Math.round((hy - el.height) / 2);
    if (type === 'bottom') ny = Math.round(hy - el.height - 3);
    updateElement(el.id, { x: Math.max(0, nx), y: Math.max(0, ny) });
  };

  const autoAlignGrid = () => {
    const upd = elements.map(el => ({
      ...el,
      x: Math.round(el.x / 4) * 4,
      y: Math.round(el.y / 4) * 4
    }));
    setElements(upd);
  };

  // Render helpers for visuals
  const renderBarcode = (value, w, h) => {
    // Very simple visual bars emulator (Code 39 like) sufficient for preview / design eval
    const bars = String(value || '000').toUpperCase().split('').map((ch, idx) => (ch.charCodeAt(0) % 3) + 1);
    return (
      <div style={{ width: `${w}px`, height: `${h}px`, display: 'flex', alignItems: 'center', background: '#fff', overflow: 'hidden', border: '1px solid #111' }}>
        {bars.map((wbar, i) => (
          <div key={i} style={{
            display: 'inline-block',
            width: `${(wbar + 1) * (w / (bars.length * 5)) }px`,
            height: '100%',
            background: i % 2 === 0 ? '#111' : '#fff',
            flexShrink: 0
          }} />
        ))}
      </div>
    );
  };

  const renderElementVisual = (el, pxW, pxH) => {
    const displayText = getDisplayValue(el);

    if (el.type === 'qr') {
      const qval = mode === 'preview' ? (sampleData.lote || sampleData.lote_numero || 'SAMPLE-001') : (el.variable || 'PREVIEW');
      return (
        <div style={{ width: pxW, height: pxH, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
          <QRCodeCanvas value={qval} size={Math.min(pxW, pxH) - 4} level="M" includeMargin={false} />
        </div>
      );
    }
    if (el.type === 'barcode') {
      return renderBarcode(displayText || el.content || '{lote}', pxW, pxH);
    }
    if (el.type === 'image') {
      return (
        <div style={{
          width: pxW, height: pxH, background: el.content ? `url(${el.content}) center/contain no-repeat #f8fafc` : '#f1f5f9',
          border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b'
        }}>
          {!el.content && 'IMG'}
        </div>
      );
    }
    if (el.type === 'line') {
      return <div style={{ width: pxW, height: pxH, background: el.color || '#111', display: 'block' }} />;
    }
    if (el.type === 'rectangle') {
      return <div style={{ width: pxW, height: pxH, background: el.backgroundColor, border: `${el.borderWidth || 1}px solid ${el.borderColor}` }} />;
    }
    // text / variable
    const fs = (el.fontSize || 12) * zoom;
    return (
      <div style={{
        width: '100%', height: '100%', padding: '1px 3px', boxSizing: 'border-box',
        display: 'flex', alignItems: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
        justifyContent: el.textAlign || 'left',
        fontSize: `${fs}px`, fontWeight: el.fontWeight || 'normal',
        color: el.color || '#111827',
        whiteSpace: 'pre-wrap', overflow: 'hidden', lineHeight: 1.15
      }}>
        {displayText || (el.type === 'variable' ? el.variable : 'Texto')}
      </div>
    );
  };

  const selectedElementData = elements.find(el => el.id === selectedElement) || null;

  const saveTemplate = async () => {
    if (!template) return;
    try {
      const variables_used = elements.filter(el => el.variable).map(el => el.variable);
      const design_config = {
        elements,
        canvasWidth: template.width_mm,
        canvasHeight: template.height_mm,
      };
      await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateId,
          template_name: template.template_name,
          category_id: template.category_id,
          template_type: template.template_type,
          description: template.description,
          width_mm: template.width_mm,
          height_mm: template.height_mm,
          orientation: template.orientation,
          design_config,
          variables_used,
          updated_by: 'Admin',
          change_description: 'Actualización de diseño profesional'
        })
      });
      alert('Plantilla guardada correctamente');
    } catch (e) {
      alert('Error guardando');
    }
  };

  // Professional Zebra Designer export: produce real usable ZPL
  const generateZPL = () => {
    const dpi = 203;
    const scale = dpi / 25.4; // dots / mm
    const wDots = Math.round((template?.width_mm || 100) * scale);
    const hDots = Math.round((template?.height_mm || 60) * scale);

    let zpl = '^XA\n';
    zpl += '^PW' + wDots + '\n'; 
    zpl += '^LL' + hDots + '\n';
    zpl += '^LH0,0\n';

    const orderedEls = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    orderedEls.forEach((el) => {
      const xDot = Math.round(el.x * scale);
      const yDot = Math.round(el.y * scale);
      const wDot = Math.round(el.width * scale);
      const hDot = Math.round(el.height * scale);
      const val = (mode === 'preview' && sampleData) ? getDisplayValue(el) : (el.variable || el.content || '');

      if (el.type === 'text' || el.type === 'variable') {
        const fs = Math.max(12, Math.round((el.fontSize || 12) * 1.6));
        const fnt = el.fontWeight === 'bold' ? 'A0N' : 'A0N';
        zpl += `^FO${xDot},${yDot}^A${fnt},${fs}^FD${val}^FS\n`;
      }
      if (el.type === 'barcode') {
        zpl += `^FO${xDot},${yDot}^BY2^B3N,N,${hDot},Y,N^FD${val}^FS\n`;
      }
      if (el.type === 'qr') {
        zpl += `^FO${xDot},${yDot}^BQN,2,${Math.floor(Math.min(wDot, hDot) / 18)}^FDQA,${val}^FS\n`;
      }
      if (el.type === 'line') {
        zpl += `^FO${xDot},${yDot}^GB${wDot},${hDot || 2},2^FS\n`;
      }
      if (el.type === 'rectangle') {
        zpl += `^FO${xDot},${yDot}^GB${wDot},${hDot},2^FS\n`;
      }
      // images and rectangles complex in ZPL — primitive approx above ok
    });

    zpl += '^XZ\n';
    return zpl;
  };

  const exportZPL = () => {
    const code = generateZPL();
    setZplCode(code);
    setShowZplModal(true);
  };

  const downloadZPL = () => {
    const code = zplCode || generateZPL();
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template?.template_code || 'template'}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick print preview: uses jsPDF + html capture but here direct browser print with mm sized
  const doPrintPreview = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const mmW = template?.width_mm || 100;
    const mmH = template?.height_mm || 60;
    const title = template?.template_name || 'Etiqueta';

    let html = `<!doctype html><html><head><title>${title}</title>
      <style>
        @page { size: ${mmW}mm ${mmH}mm; margin:0; }
        body { margin:0; padding:0; background:#fff; }
        .print-label { width: ${mmW}mm; height: ${mmH}mm; position:relative; background:#fff; overflow:hidden; box-sizing:border-box; border:1px solid #ccc; }
        .el { position:absolute; display:flex; align-items:center; justify-content:center; box-sizing:border-box; overflow:hidden; }
      </style></head><body>`;
    
    html += `<div class="print-label">`;
    elements.sort((a,b) => (a.zIndex||0) - (b.zIndex||0)).forEach(el => {
      const fs = (el.fontSize || 11);
      let style = `left:${el.x}mm;top:${el.y}mm;width:${el.width}mm;height:${el.height}mm;font-size:${fs}px;font-weight:${el.fontWeight};color:${el.color};text-align:${el.textAlign};
      background:${el.backgroundColor || 'transparent'};border:${el.borderWidth||0}px solid ${el.borderColor||'transparent'};`;
      let content = `<span>${getDisplayValue(el)}</span>`;
      if (el.type === 'qr') {
        // Use SVG placeholder for print window simplicity
        content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:7px;border:1px solid #222;background:#fff">QR:${sampleData.lote||el.variable||''}</div>`;
      } else if (el.type === 'barcode') {
        content = `<div style="width:100%;height:100%;background:#fff;font-family:monospace;font-size:7px;border:1px solid #111;letter-spacing:1.5px;display:flex;align-items:center;justify-content:center;">|||||${getDisplayValue(el)}</div>`;
      } else if (el.type === 'line') {
        content = `<div style="background:#111;height:2px;width:100%;"></div>`;
      } else if (el.type === 'rectangle') {
        content = '';
      }
      html += `<div class="el" style="${style}">${content}</div>`;
    });
    html += `</div><script>window.print();window.close();</script></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Draw the canvas element with interactive logic
  const renderCanvasContent = () => (
    elements.slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((el) => {
      const isSel = el.id === selectedElement;
      const pxX = el.x * baseScale * zoom;
      const pxY = el.y * baseScale * zoom;
      const pxW = el.width * baseScale * zoom;
      const pxH = el.height * baseScale * zoom;
      
      return (
        <div
          key={el.id}
          onClick={(e) => { e.stopPropagation(); setSelectedElement(el.id); }}
          onDoubleClick={() => duplicateElement(el.id)}
          onMouseDown={(e) => startDrag(e, el)}
          className={`absolute border overflow-hidden select-none ${isSel ? 'ring-2 ring-brand-500 z-[999]' : 'hover:ring-1 hover:ring-slate-300'}`}
          style={{
            left: `${pxX}px`,
            top: `${pxY}px`,
            width: `${pxW}px`,
            height: `${pxH}px`,
            fontSize: `${(el.fontSize || 12) * zoom}px`,
            fontWeight: el.fontWeight,
            textAlign: el.textAlign,
            color: el.color,
            backgroundColor: el.backgroundColor === 'transparent' ? 'transparent' : el.backgroundColor,
            borderWidth: `${Math.max(0, el.borderWidth || 0) * zoom}px`,
            borderColor: el.borderColor,
            borderStyle: 'solid',
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            zIndex: (el.zIndex || 1) + (isSel ? 1000 : 0),
            boxSizing: 'border-box',
            cursor: 'move',
          }}
        >
          {renderElementVisual(el, pxW, pxH)}
          
          {/* Resize handles for selected in design mode */}
          {isSel && mode === 'design' && (
            <>
              {['nw','ne','sw','se'].map(corner => (
                <div
                  key={corner}
                  onMouseDown={(e) => startResize(e, el, corner)}
                  className="absolute w-2.5 h-2.5 bg-white border border-brand-600 rounded-sm"
                  style={{
                    ...(corner.includes('n') ? {top: -3} : {bottom: -3}),
                    ...(corner.includes('w') ? {left: -3} : {right: -3}),
                    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                    zIndex: 10001
                  }}
                />
              ))}
              {/* quick delete floating */}
              <button 
                onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                className="absolute -top-3 -right-2 bg-red-600 text-white w-4 h-4 text-[8px] leading-none flex items-center justify-center rounded-full shadow">×</button>
            </>
          )}
        </div>
      );
    })
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><i className="ph ph-spinner text-4xl animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-100">
      {/* Header like Canva + Zebra bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/gestor-etiquetas')} className="p-2 hover:bg-slate-100 rounded"><i className="ph ph-arrow-left" /></button>
          <div>
            <div className="font-semibold text-slate-900">{template?.template_name}</div>
            <div className="text-[10px] text-slate-500 -mt-px">{template?.width_mm}×{template?.height_mm} mm • {template?.template_type || 'etiqueta'}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* MODE SWITCH like professional label software */}
          <div className="flex bg-slate-100 rounded-lg overflow-hidden text-xs border">
            <button onClick={() => setMode('design')} className={`px-3 py-1 ${mode === 'design' ? 'bg-white shadow font-medium' : ''}`}>Diseño</button>
            <button onClick={() => setMode('preview')} className={`px-3 py-1 ${mode === 'preview' ? 'bg-white shadow font-medium' : ''}`}>Vista Previa Datos</button>
          </div>

          {/* Zoom like MS / Canva */}
          <div className="flex rounded-lg border bg-white text-sm ml-1">
            <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="px-2 py-1 hover:bg-slate-50">−</button>
            <span className="px-2 select-none py-1 font-mono text-xs">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(3.2, zoom + 0.1))} className="px-2 py-1 hover:bg-slate-50">+</button>
          </div>

          <button onClick={() => setShowGrid(!showGrid)} className={`px-3 py-1.5 text-sm rounded-xl border flex items-center gap-1 ${showGrid ? 'bg-slate-900 text-white' : 'bg-white'} `}>
            <i className="ph ph-grid-four" /> Grid
          </button>

          <button onClick={autoAlignGrid} className="px-3 py-1.5 rounded-xl border bg-white text-sm hover:bg-slate-50 flex gap-1 items-center">
            <i className="ph ph-arrows-in-cardinal" />Alinear Grid
          </button>

          <button onClick={exportZPL} className="px-4 py-1.5 rounded-xl bg-emerald-700 text-white text-sm font-medium flex items-center gap-2">
            <i className="ph ph-printer" /> Exportar ZPL (Zebra)
          </button>

          <button onClick={doPrintPreview} className="px-4 py-1.5 rounded-xl bg-slate-700 text-white text-sm font-medium flex items-center gap-2">
            <i className="ph ph-eye" /> Vista Previa / Imprimir
          </button>

          <button onClick={saveTemplate} className="px-6 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm flex items-center gap-2">
            <i className="ph ph-floppy-disk" /> Guardar
          </button>
        </div>
      </header>

      <div className="flex-1 pt-14 flex overflow-hidden">
        {/* LEFT TOOLBAR: Microsoft Word + Zebra style */}
        <div className="w-64 border-r bg-white p-3 overflow-y-auto">
          <div className="text-[10px] text-slate-500 mb-2 tracking-[1px] font-medium">ELEMENTOS</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { t: 'text', label: 'Texto', icon: 'ph-text-aa' },
              { t: 'variable', label: 'Variable', icon: 'ph-brackets-curly' },
              { t: 'barcode', label: 'Código Barras', icon: 'ph-barcode' },
              { t: 'qr', label: 'Código QR', icon: 'ph-qr-code' },
              { t: 'line', label: 'Línea', icon: 'ph-line-segment' },
              { t: 'rectangle', label: 'Rectángulo', icon: 'ph-rectangle' },
              { t: 'image', label: 'Imagen', icon: 'ph-image' },
            ].map(item => (
              <button key={item.t} onClick={() => addElement(item.t)} className="flex flex-col items-center gap-1 border border-slate-200 rounded-xl py-3 px-2 hover:bg-brand-50 hover:border-brand-200 active:bg-white transition">
                <i className={`ph ${item.icon} text-xl text-brand-700`} />
                <span className="text-xs font-medium text-slate-700">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Variable quick insert like Canary / Bartender */}
          <div className="mt-5">
            <div className="text-xs font-medium mb-1.5 text-slate-600">INSERTAR VARIABLE</div>
            <div className="max-h-52 overflow-auto bg-slate-50 border rounded-xl p-1 text-xs">
              {variables.map(v => (
                <button key={v.id} onClick={() => {
                  addElement('variable');
                  setTimeout(() => {
                    const created = elements[elements.length - 1] || { id: null };
                    const newId = created && elements.length ? elements[elements.length-1].id : Date.now();
                    // safe patch last added if variable
                    setElements(prev => prev.map((e, i) => i === prev.length - 1 && e.type === 'variable' ? { ...e, variable: v.variable_code } : e ));
                  }, 10);
                }} className="w-full text-left px-2 py-1 rounded hover:bg-white">{v.variable_name} <span className="opacity-50">({v.variable_code})</span></button>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t text-xs text-slate-500 leading-tight">
            <b>Drag & Drop:</b> arrastra por el centro. <br />
            <b>Resize:</b> esquinas de seleccionado. <b>Duplicar:</b> doble clic.
          </div>
        </div>

        {/* CENTER CANVAS (Word/Canva style surface) */}
        <div ref={containerRef} onClick={() => setSelectedElement(null)} className="flex-1 overflow-auto p-8 bg-slate-200 relative">
          <div className="inline-block relative">
            <div 
              ref={canvasRef} 
              className="bg-white shadow-2xl relative overflow-hidden print:!shadow-none" 
              style={{
                width: canvasWidth + 'px',
                height: canvasHeight + 'px',
                backgroundImage: showGrid 
                  ? `linear-gradient(rgba(148,163,184,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.13) 1px, transparent 1px)` 
                  : undefined,
                backgroundSize: showGrid ? `${18 * zoom}px ${18 * zoom}px` : 'auto'
              }}
            >
              {/* Main design surface */}
              {renderCanvasContent()}

              {/* Label edge mark like Zebra/ professional */}
              <div className="absolute pointer-events-none inset-0 border border-dashed border-slate-400/70" />
            </div>
            <div className="text-[11px] text-slate-400 mt-1 text-center select-none font-mono">
              {template?.width_mm} × {template?.height_mm} mm &nbsp;•&nbsp; DPI recomendado 203/300
            </div>
          </div>
        </div>

        {/* RIGHT PROPERTIES + LAYERS — Bartender professional */}
        <div className="w-80 border-l bg-white overflow-y-auto p-4 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2 text-sm font-medium text-slate-700">
              PROPIEDADES {selectedElementData && <span className="text-xs text-slate-400 ml-1">#{selectedElementData.id}</span>}
              {selectedElementData && <button onClick={() => deleteElement(selectedElementData.id)} className="text-red-600 text-xs hover:underline">Eliminar</button>}
            </div>

            {!selectedElementData ? (
              <div className="p-4 bg-slate-50 border rounded-xl text-center text-xs text-slate-500">Selecciona un elemento en el canvas para editar.</div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="uppercase text-[10px] text-slate-500 mb-1">Tipo</div>
                  <div className="font-semibold capitalize tracking-tight">{selectedElementData.type}</div>
                </div>

                {(selectedElementData.type === 'text' || selectedElementData.type === 'variable') && (
                  <>
                    {selectedElementData.type === 'text' && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Contenido</div>
                        <textarea value={selectedElementData.content || ''} onChange={e => updateElement(selectedElementData.id, { content: e.target.value })} className="w-full border px-2 py-1 text-sm rounded" rows={2} />
                      </div>
                    )}

                    {selectedElementData.type === 'variable' && (
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Variable dinámica</div>
                        <select value={selectedElementData.variable} onChange={e => updateElement(selectedElementData.id, { variable: e.target.value })} className="w-full px-2 py-1 border rounded">
                          <option value="">— seleccionar —</option>
                          {variables.map(v => <option key={v.id} value={v.variable_code}>{v.variable_name} — {v.variable_code}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px]">Tamaño font</div>
                        <input type="number" value={selectedElementData.fontSize || 12} onChange={e => updateElement(selectedElementData.id, { fontSize: parseInt(e.target.value) })} className="w-full border rounded px-2 py-1" />
                      </div>
                      <div>
                        <div className="text-[10px]">Negrita</div>
                        <select value={selectedElementData.fontWeight} onChange={e => updateElement(selectedElementData.id, { fontWeight: e.target.value })} className="w-full border rounded px-2 py-1">
                          <option value="normal">Normal</option><option value="bold">Negrita</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] mb-0.5">Alinear</div>
                      <div className="flex gap-1">
                        {['left','center','right'].map(a => (
                          <button key={a} onClick={() => updateElement(selectedElementData.id, { textAlign: a })} className={`flex-1 px-2 py-1 rounded border ${selectedElementData.textAlign === a ? 'bg-brand-600 text-white' : ''}`}>{a}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedElementData.type === 'image' && (
                  <div>
                    <div className="text-[10px]">URL Imagen / Logo</div>
                    <input value={selectedElementData.content || ''} placeholder="https://..." onChange={e => updateElement(selectedElementData.id, { content: e.target.value })} className="border px-2 py-1 w-full rounded" />
                  </div>
                )}

                {/* POSITIONING full like advanced designer */}
                <div className="pt-1 border-t">
                  <div className="text-[10px] mb-1 font-medium">Posición (mm)</div>
                  <div className="grid grid-cols-4 gap-1">
                    <input type="number" step="0.5" className="border px-1 rounded py-0.5 text-sm" value={selectedElementData.x} onChange={e => updateElement(selectedElementData.id, { x: parseFloat(e.target.value) })} />
                    <input type="number" step="0.5" className="border px-1 rounded py-0.5 text-sm" value={selectedElementData.y} onChange={e => updateElement(selectedElementData.id, { y: parseFloat(e.target.value) })} />
                    <div className="col-span-2 text-[10px] text-slate-400 self-center">X &nbsp; Y</div>
                    <input type="number" step="0.5" className="border px-1 rounded py-0.5 text-sm" value={selectedElementData.width} onChange={e => updateElement(selectedElementData.id, { width: parseFloat(e.target.value) })} />
                    <input type="number" step="0.5" className="border px-1 rounded py-0.5 text-sm" value={selectedElementData.height} onChange={e => updateElement(selectedElementData.id, { height: parseFloat(e.target.value) })} />
                    <div className="col-span-2 text-[10px] text-slate-400 self-center">Ancho &nbsp; Alto</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-2 text-xs">
                  <button onClick={() => { duplicateElement(selectedElement); }} className="py-0.5 px-2 bg-slate-100 border rounded hover:bg-slate-200">Duplicar</button>
                  <button onClick={() => changeLayer(selectedElement, 'up')} className="py-0.5 px-2 bg-slate-100 border rounded hover:bg-slate-200">Subir capa</button>
                  <button onClick={() => changeLayer(selectedElement, 'down')} className="py-0.5 px-2 bg-slate-100 border rounded hover:bg-slate-200">Bajar capa</button>
                </div>
              </div>
            )}
          </div>

          {/* Alignment palette (like MS Word & Bartender) */}
          {selectedElement && (
            <div className="pt-3 border-t">
              <div className="text-xs text-slate-600 mb-1.5">ALINEAR Y DISTRIBUIR</div>
              <div className="grid grid-cols-3 gap-1">
                {['left','center','right','top','middle','bottom'].map(a => (
                  <button key={a} onClick={() => alignSelected(a)} className="px-2 py-1 text-xs bg-slate-50 hover:bg-white border rounded">{a}</button>
                ))}
              </div>
            </div>
          )}

          {/* LAYERS MANAGEMENT Canva/Bartender style */}
          {showLayers && (
            <div className="pt-3 border-t">
              <div className="flex justify-between text-xs items-center mb-1.5">
                <span className="font-medium text-slate-600">CAPAS ({elements.length})</span>
                <button onClick={() => setShowLayers(false)} className="text-[10px] text-slate-400">ocultar</button>
              </div>
              <div className="max-h-[160px] overflow-auto text-sm border bg-slate-50 rounded divide-y">
                {elements.slice().sort((a,b) => (b.zIndex||0)-(a.zIndex||0)).map((el, idx) => (
                  <div onClick={() => setSelectedElement(el.id)} key={el.id} className={`flex items-center justify-between px-2 py-1 cursor-pointer ${el.id === selectedElement ? 'bg-white' : 'hover:bg-white/30'}`}>
                    <span className="truncate w-36 text-xs">{el.type} — {el.variable || el.content?.slice(0,16) || 'n/a'}</span>
                    <div className="flex gap-1 text-xs text-slate-500">
                      <button onClick={(e) => { e.stopPropagation(); changeLayer(el.id, 'up'); }} className="hover:text-emerald-700">↑</button>
                      <button onClick={(e) => { e.stopPropagation(); changeLayer(el.id, 'down'); }} className="hover:text-emerald-700">↓</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW MODE SAMPLE SELECT: Canva-like data source switch */}
          {mode === 'preview' && (
            <div className="pt-3 border-t mt-auto">
              <div className="text-xs font-medium mb-1 text-slate-600">DATOS DE EJEMPLO (real del sistema)</div>
              <select value={selectedLotId} onChange={e => { setSelectedLotId(e.target.value); loadSampleFromLot(e.target.value); }} className="text-sm border rounded w-full py-1 px-2 mb-2">
                <option value="">Usar valores por defecto</option>
                {lots.slice(0, 25).map(l => <option value={l.id} key={l.id}>{l.lot_number} — {l.producer}</option>)}
              </select>
              <button onClick={() => { setSampleData({}); setSelectedLotId(''); }} className="text-xs px-3 py-0.5 border rounded">Limpiar muestra</button>
            </div>
          )}
        </div>
      </div>

      {/* ZPL EXPORT MODAL (Zebra Designer behavior) */}
      {showZplModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6" onClick={() => setShowZplModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 flex justify-between items-center border-b">
              <div>
                <span className="font-semibold">Código ZPL — listo para impresora Zebra / Datamax</span>
                <div className="text-[11px] text-emerald-700">Generado desde el diseño actual. Compatible con 203/300 DPI</div>
              </div>
              <button onClick={() => setShowZplModal(false)} className="text-xl px-1">×</button>
            </div>
            <pre className="p-4 font-mono bg-slate-950 text-emerald-200 overflow-auto max-h-[380px] text-[12px] whitespace-pre">{zplCode}</pre>
            <div className="p-4 flex justify-between border-t">
              <button onClick={() => setShowZplModal(false)} className="px-5 py-2 rounded border">Cerrar</button>
              <div className="flex gap-2">
                <button onClick={downloadZPL} className="px-5 py-2 bg-emerald-600 text-white rounded font-medium">Descargar .zpl</button>
                <button onClick={() => navigator.clipboard.writeText(zplCode).then(() => alert('ZPL copiado'))} className="px-5 py-2 border rounded">Copiar al portapapeles</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
