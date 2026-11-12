'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Save, Eye, Upload } from 'lucide-react';

const ERP_CORE_CODES = [
  'lotification-registry', 'embarques', 'loads', 'lotification', 'box-control', 'reports',
  'cutting-orders', 'sales-process-waste', 'weekly-closings', 'contratos', 'tickets', 'facturas', 'invoices', 'cierres'
];

const OUTPUT_TYPES = ['pdf', 'excel', 'ticket', 'nota'];
const DOCUMENT_TYPES = ['pdf', 'ticket', 'excel', 'nota', 'jpg'];
const FONT_OPTIONS = ['Arial', 'Helvetica', 'Times New Roman', 'Inter', 'Courier New', 'monospace'];

const defaultForm = {
  template_name: '',
  document_type: 'pdf',
  description: '',
  logo_url: 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png',
  base_file_url: '',
  primary_color: '#0E4A22',
  secondary_color: '#963821',
  accent_color: '#E0DA62',
  font_family: 'Arial',
  font_size_title: 16,
  font_size_body: 11,
  font_size_small: 9,
  page_size: 'A4',
  orientation: 'portrait',
  is_default: false,
  header_text: 'EMPAQUE TECAVO • Del campo con amor',
  footer_text: 'Documento corporativo oficial • Conserve para sus registros',
  additional_logo_url: 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png',
  // Central ascending folio linked to Administración module for control
  current_folio: 'DOC-0001',
  folio_prefix: 'DOC-',
};

export default function TicketsYDocumentos() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [liveModules, setLiveModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [activeTab, setActiveTab] = useState('plantillas');
  const [previewConfig, setPreviewConfig] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [assignState, setAssignState] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Current active files from system (used for previews in this "subir" section)
  const [currentLogo, setCurrentLogo] = useState(null);
  const [currentExcel, setCurrentExcel] = useState(null);

  // Central folio control - linked to Administración for ascending automated control across all modules that emit tickets/notas
  const [centralFolio, setCentralFolio] = useState('DOC-0001');
  const [folioPrefix, setFolioPrefix] = useState('DOC-');

  useEffect(() => { loadAll(); fetchSuperAdmin(); loadBranding(); }, []);

  async function fetchSuperAdmin() {
    try { const r = await fetch('/api/auth/check-super-admin'); if (r.ok) setIsSuperAdmin(!!(await r.json()).isSuperAdmin); } catch (_) {}
  }

  // Central ascending folio generator - all modules (tickets, notas, embarques, etc.) must use this pattern linked to Administración
  async function generateNextCentralFolio() {
    const prefix = folioPrefix || form.folio_prefix || 'DOC-';
    try {
      const r = await fetch(`/api/admin/folios/next-folio?prefix=${encodeURIComponent(prefix)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.nextFolio) {
          setCentralFolio(d.nextFolio);
          handleField('current_folio', d.nextFolio);
          handleField('folio_prefix', prefix);
          return d.nextFolio;
        }
      }
    } catch (_) {}
    // fallback local increment
    const current = centralFolio || form.current_folio || 'DOC-0001';
    let num = 1;
    const match = current.match(/(\d+)$/);
    if (match) num = parseInt(match[1], 10) + 1;
    const next = prefix + String(num).padStart(4, '0');
    setCentralFolio(next);
    handleField('current_folio', next);
    return next;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [tRes, aRes, mRes] = await Promise.all([
        fetch('/api/document-templates'),
        fetch('/api/admin/document-assignments'),
        fetch('/api/menu?includeAll=true')
      ]);
      const tData = await tRes.json();
      const aData = await aRes.json();
      const mData = mRes.ok ? await mRes.json() : [];

      const flat = [];
      (mData || []).forEach((g) => (g.modules || []).forEach((mod) => { if (mod && mod.is_active !== false) flat.push({code: (mod.module_route||'').replace(/^\/+/,''), label: mod.module_name, group: g.group_name}); }));
      setLiveModules(flat.length ? flat : [{code:'lotification-registry',label:'Registro de Lotificación'},{code:'embarques',label:'Embarques'}]);
      setTemplates(Array.isArray(tData)?tData:[]); setAssignments(Array.isArray(aData)?aData:[]);

      if (tData && tData.length) setPreviewConfig(tData.find(t=>t.is_default) || tData[0]);

      const asg = {}; (aData||[]).forEach(a => { asg[`${a.module_code}|${a.output_type}`] = a.template_id; });
      setAssignState(asg);
    } catch(e) { console.error(e); setLiveModules([{code:'embarques',label:'Embarques'}]); }
    finally { setLoading(false); loadBranding(); }
  }

  async function loadBranding() {
    try {
      const r = await fetch('/api/branding');
      if (r.ok) {
        const b = await r.json();
        setCurrentLogo(b.logo_url || null);
        setCurrentExcel(b.excel_plantilla_url || null);
      }
    } catch(e){}
  }

  const startNew = () => { 
    setSelectedTemplate(null); 
    const initF = 'DOC-0001';
    setForm({...defaultForm, header_text: defaultForm.header_text, footer_text: defaultForm.footer_text, current_folio: initF, folio_prefix: 'DOC-'}); 
    setCentralFolio(initF);
    setFolioPrefix('DOC-');
    setActiveTab('plantillas'); 
  };

  const editTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setForm({ ...defaultForm, ...{
      template_name: tpl.template_name||'',
      document_type: tpl.document_type||'pdf',
      description: tpl.description||'',
      logo_url: tpl.logo_url||'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png',
      base_file_url: tpl.base_file_url||'',
      primary_color: tpl.primary_color||'#0E4A22',
      secondary_color: tpl.secondary_color||'#963821',
      accent_color: tpl.accent_color||'#E0DA62',
      font_family: tpl.font_family||'Arial',
      font_size_title: tpl.font_size_title||16,
      font_size_body: tpl.font_size_body||11,
      font_size_small: tpl.font_size_small||9,
      page_size: tpl.page_size||'A4',
      orientation: tpl.orientation||'portrait',
      is_default: !!tpl.is_default,
      header_text: tpl.header_text || tpl.header_config?.text || 'EMPAQUE TECAVO • Del campo con amor',
      footer_text: tpl.footer_text || tpl.footer_config?.text || 'Documento corporativo oficial • Conserve para sus registros',
      additional_logo_url: tpl.additional_logo_url || 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png',
      current_folio: tpl.current_folio || 'DOC-0001',
      folio_prefix: tpl.folio_prefix || 'DOC-',
    }});
    setPreviewConfig(tpl);
    setCentralFolio(tpl.current_folio || 'DOC-0001');
    setFolioPrefix(tpl.folio_prefix || 'DOC-');
  };

  const handleField = (key, val) => {
    const f = { ...form, [key]: val }; setForm(f);
    setPreviewConfig({ ...(previewConfig||{}), ...f, [key]: val });
  };

  const saveTemplate = async () => {
    const payload = { 
      ...form, 
      template_code: (form.template_name||'tpl').toLowerCase().replace(/\s/g,'_').slice(0,60), 
      created_by:'admin',
      header_config: { text: form.header_text },
      footer_config: { text: form.footer_text },
      additional_logo_url: form.additional_logo_url || null,
      current_folio: centralFolio || form.current_folio,
      folio_prefix: folioPrefix || form.folio_prefix
    };
    const url = selectedTemplate ? `/api/document-templates/${selectedTemplate.id}` : '/api/document-templates';
    const method = selectedTemplate ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const saved = await res.json().catch(()=>({}));
    if (res.ok) { await loadAll(); if (saved && saved.id) { setSelectedTemplate(saved); setForm({...form, ...saved}); setPreviewConfig(saved); } alert('Plantilla guardada con folio central vinculado a Administración'); }
    else alert('Error: '+(saved.error||''));
  };

  const deleteTemplate = async (id) => { if (!confirm('¿Eliminar?')) return; await fetch(`/api/document-templates/${id}`, {method:'DELETE'}); await loadAll(); if (selectedTemplate && selectedTemplate.id===id) startNew(); };

  const showPreview = (tpl, lbl=null, ot=null) => setPreviewModal({tpl, modLabel:lbl, outType:ot});
  const closePreview = () => setPreviewModal(null);

  const setAssignment = async (mod, outType, tplId) => { await fetch('/api/admin/document-assignments',{method:'POST',headers:{'Content-Type':'application/json'}, body:JSON.stringify({module_code:mod, output_type:outType, template_id:parseInt(tplId)})}); await loadAll(); };
  const clearAssignment = async (mod, outType) => { await fetch('/api/admin/document-assignments?module='+mod+'&output_type='+outType,{method:'DELETE'}); await loadAll(); };
  const getAssignedTplName = (mod, ot) => (assignments.find(a=>a.module_code===mod && a.output_type===ot) || {}).template_name || '—';
  const showAssignedPreview = async (mod, ot) => {
    try {
      const r = await fetch(`/api/document-templates/resolve?module=${encodeURIComponent(mod)}&output_type=${ot}`);
      const tpl = await r.json();
      if (tpl && tpl.id) { showPreview(tpl, mod, ot); } else { showPreview(templates.find(t=>t.id), mod, ot); }
    } catch { showPreview(null, mod, ot); }
  };

  // Ensure changes are immediately available everywhere: force live resolve
  async function forceSyncSystem() { 
    try { await fetch('/api/document-templates/resolve?force=true'); } catch(_) {}
    await loadAll(); 
    await loadBranding();
    alert('Sistema sincronizado. Cambios en plantillas se reflejan en todos los módulos y documentos generados.');
  };

  function renderSimplePreview(c) {
    const bg = c.primary_color || '#0E4A22'; const f = c.font_family||'Arial'; const l = c.logo_url||c.base_file_url || 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png';
    const nm = c.template_name || 'Asignado';
    const ht = c.header_text || '';
    const ft = c.footer_text || '';
    const folio = c.current_folio || centralFolio || 'DOC-0001';
    return (<div className="border bg-white rounded-xl p-3" style={{fontFamily:f}}><div style={{background:bg,color:'#fff'}} className="p-2 flex items-center gap-2">{l&&<img src={l} className="h-8 inline"/>}<span>{nm}</span></div>{ht && <div className="text-[11px] px-2 pt-1 font-medium" style={{color:bg}}>{ht}</div>}<div style={{color:c.secondary_color}} className="p-2 text-xs">Documento {c.document_type||'asignado'} • Folio central: <b>{folio}</b> (Administración)</div>{ft && <div className="text-[10px] px-2 pb-1 text-slate-500">{ft}</div>}</div>);
  }

  // PROFESSIONAL GENERATORS - real PDF/JPG/Ticket using current corporate config + uploaded images + CENTRAL ASCENDING FOLIO from Administración
  async function generateRealPDF() {
    const folio = centralFolio || form.current_folio || generateNextCentralFolio();
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: form.orientation === 'landscape' ? 'l' : 'p', unit: 'mm', format: form.page_size || 'A4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 15;

    // Corporate colors & header
    doc.setFillColor(parseInt((form.primary_color||'#0E4A22').slice(1,3),16), parseInt((form.primary_color||'#0E4A22').slice(3,5),16), parseInt((form.primary_color||'#0E4A22').slice(5,7),16));
    doc.rect(0, 0, pw, 22, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(form.font_size_title || 16);
    doc.setFont(form.font_family || 'helvetica', 'bold');
    doc.text(form.header_text || 'EMPAQUE TECAVO', m, 14);

    // Logo if present (uses uploaded corporate image)
    const logoToUse = form.logo_url || form.additional_logo_url || 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png';
    if (logoToUse) {
      try { doc.addImage(logoToUse, 'JPEG', pw - 50, 3, 35, 16); } catch(_) {}
    }

    doc.setTextColor(0,0,0);
    doc.setFontSize(form.font_size_body || 11);
    doc.setFont(form.font_family || 'helvetica', 'normal');

    let y = 32;
    doc.text('DOCUMENTO CORPORATIVO - VISTA PREVIA EDITABLE', m, y); y += 8;
    doc.text(`Plantilla: ${form.template_name || 'Sin nombre'}  |  Tipo: ${form.document_type}`, m, y); y += 7;
    doc.text(`Folio Central (Administración): ${folio}   |   Fecha: ${new Date().toLocaleDateString('es-MX')}`, m, y); y += 10;

    // Sample content for corporate look - all modules use this ascending folio control
    doc.setFontSize(form.font_size_body || 11);
    doc.text('Ejemplo de contenido dinámico (folio vinculado a Administración):', m, y); y += 6;
    doc.text(`• Folio: ${folio}   |   Lote: LOT-2025-042   |   Kg: 1,250.00`, m, y); y += 6;
    doc.text('• Productor / Huerta: Ejemplo S.A. de C.V. - Huerta El Paraíso', m, y); y += 6;
    doc.text('• Calibre / Clase: Extra / Primera   |   Precio: $48.50 /kg', m, y); y += 10;

    doc.setFontSize(form.font_size_small || 9);
    doc.setTextColor(80,80,80);
    doc.text(form.footer_text || 'Documento corporativo oficial • Conserve para sus registros', m, ph - 12);
    doc.text('Generado desde Tickets y Documentos • Folio ascendente centralizado en Administración', m, ph - 6);

    doc.save(`Muestra_${(form.template_name||'doc').replace(/\s/g,'_')}_${folio}.pdf`);
    // Advance folio for next use in any module
    generateNextCentralFolio();
  }

  async function generateRealJPG() {
    const folio = centralFolio || form.current_folio || generateNextCentralFolio();
    // Use a live preview element for high quality JPG
    const el = document.createElement('div');
    el.style.width = '800px';
    el.style.padding = '24px';
    el.style.background = '#fff';
    el.style.fontFamily = form.font_family || 'Arial';
    el.style.border = `4px solid ${form.primary_color || '#0E4A22'}`;
    const logoToUse = form.logo_url || form.additional_logo_url || 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png';
    el.innerHTML = `
      <div style="background:${form.primary_color||'#0E4A22'};color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">
        ${logoToUse ? `<img src="${logoToUse}" style="height:42px;max-width:160px;object-fit:contain" />` : ''}
        <div style="font-size:20px;font-weight:700;">${form.header_text || 'EMPAQUE TECAVO'}</div>
      </div>
      <div style="padding:16px 20px;color:#222;font-size:14px;line-height:1.5;">
        <div style="margin-bottom:8px;font-weight:600;color:${form.secondary_color||'#963821'}">DOCUMENTO CORPORATIVO (JPG)</div>
        <div>Plantilla: <b>${form.template_name || 'Sin nombre'}</b> — ${form.document_type}</div>
        <div style="margin:10px 0;">Folio Central (Admón): <b>${folio}</b> &nbsp;&nbsp; Lote: LOT-2025-042 &nbsp;&nbsp; Total: 1,250.00 kg</div>
        <div style="font-size:12px;color:#555;margin-top:12px;">${form.footer_text || 'Documento corporativo oficial • Conserve para sus registros'}</div>
      </div>
    `;
    document.body.appendChild(el);
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {scale: 2, backgroundColor: '#ffffff'});
    document.body.removeChild(el);
    const link = document.createElement('a');
    link.download = `Muestra_${(form.template_name||'doc').replace(/\s/g,'_')}_${folio}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    generateNextCentralFolio();
  }

  function generateThermalTicket() {
    const folio = centralFolio || form.current_folio || generateNextCentralFolio();
    // Simple thermal ticket text + small jsPDF for 80mm style - uses central folio from Administración
    const w = 80; // mm thermal
    import('jspdf').then(({default: jsPDF}) => {
      const doc = new jsPDF({unit:'mm', format:[w, 200]});
      doc.setFontSize(10);
      doc.setFont('courier', 'normal');
      let y = 8;
      const center = (t) => { const tw = doc.getTextWidth(t); doc.text(t, (w-tw)/2 , y); };
      center((form.header_text || 'TECAVO').toUpperCase()); y += 5;
      center('TICKET CORPORATIVO'); y += 6;
      doc.text(`Folio Central (Adm): ${folio}   Fecha: ${new Date().toLocaleDateString('es-MX')}`, 5, y); y += 5;
      const logoToUse = form.logo_url || form.additional_logo_url || 'https://app-cdn.appgen.com/7fb1627b-46c6-4220-bc49-ed19cb1ce959/assets/uploaded_1794450433353_4f52o.png';
      if (logoToUse) { try { doc.addImage(logoToUse, 'JPEG', 25, y, 30, 12); y += 14; } catch(_) {} }
      doc.text('Lote: LOT-042   Kg: 1250.00', 5, y); y += 5;
      doc.text('Precio: $48.50   Total: $60,625.00', 5, y); y += 8;
      doc.setFontSize(8);
      doc.text(form.footer_text || 'Conserve este ticket • Control Administración', 5, y);
      doc.save(`Ticket_Termico_${(form.template_name||'tkt')}_${folio}.pdf`);
    });
    generateNextCentralFolio();
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-12 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between mb-5">
          <div><button onClick={()=>router.push('/administracion')} className="text-sm">← Administración</button><h1 className="text-3xl font-bold">Tickets y Documentos</h1></div>
          <button onClick={()=>{startNew();setActiveTab('plantillas');}} className="px-3 py-1.5 bg-emerald-700 text-white rounded flex gap-1"><Plus size={16}/> Nueva Plantilla</button>
        </div>

        <div className="flex gap-2 mb-4 border-b">
          {[{k:'plantillas',l:'Plantillas y Estilos'},{k:'asignaciones',l:'Asignación por Módulo'},{k:'subir',l:'Archivos Base (Logo / Plantilla)'}].map(x=>(<button key={x.k} onClick={()=>setActiveTab(x.k)} className={`px-4 py-1.5 ${activeTab===x.k?'border-b-2 border-emerald-700 font-medium':''}`}>{x.l}</button>))}
        </div>

        {loading ? <div>Cargando...</div> : <>
          {activeTab==='plantillas' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border rounded p-4">
              <div className="flex items-center justify-between mb-2"><div className="font-semibold">Plantillas Existentes</div><button onClick={startNew} className="border px-2 text-xs rounded">Nueva</button></div>
              {templates.length===0 && <div className="py-6 text-slate-400 text-sm">No hay plantillas</div>}
              {templates.map(tpl => (
                <div key={tpl.id} onClick={()=>editTemplate(tpl)} className={`border p-2 mb-2 rounded cursor-pointer flex justify-between ${selectedTemplate?.id===tpl.id?'ring-1 ring-emerald':''}`}>
                  <div>{tpl.template_name} <span className="text-xs">({tpl.document_type})</span></div>
                  <div>
                    <button onClick={(e)=>{e.stopPropagation(); showPreview(tpl);}} className="text-xs mr-2 border px-2">Vista Previa</button>
                    <button onClick={(e)=>{e.stopPropagation(); deleteTemplate(tpl.id);}} className="text-red-500">×</button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="bg-white border rounded p-3">
                <div className="font-semibold mb-3">{selectedTemplate?'Editar':'Crear'} Plantilla Profesional</div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <input value={form.template_name} onChange={e=>handleField('template_name',e.target.value)} placeholder="Nombre plantilla" className="border px-2 py-1 rounded" />
                  <select value={form.document_type} onChange={e=>handleField('document_type',e.target.value)} className="border px-2 rounded">{DOCUMENT_TYPES.map(d=><option key={d}>{d}</option>)}</select>
                </div>

                {/* CORPORATE HEADER / FOOTER TEXT - editable for branding */}
                <div className="grid grid-cols-1 gap-2 mb-2 text-sm">
                  <input value={form.header_text||''} onChange={e=>handleField('header_text',e.target.value)} placeholder="Texto de encabezado corporativo" className="border px-2 py-1 rounded" />
                  <input value={form.footer_text||''} onChange={e=>handleField('footer_text',e.target.value)} placeholder="Texto de pie corporativo" className="border px-2 py-1 rounded" />
                </div>

                {/* CENTRAL ASCENDING FOLIO CONTROL - linked to Administración module for ALL tickets/notas across system */}
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded mb-2">
                  <div className="text-xs font-semibold text-emerald-800 mb-1">FOLIO ASCENDENTE CENTRAL (vinculado a Módulo Administración)</div>
                  <div className="flex gap-2 items-center">
                    <input value={folioPrefix} onChange={e=>{setFolioPrefix(e.target.value); handleField('folio_prefix', e.target.value);}} className="border w-20 px-2 py-1 rounded text-sm font-mono" placeholder="DOC-" />
                    <input value={centralFolio} onChange={e=>{setCentralFolio(e.target.value); handleField('current_folio', e.target.value);}} className="border flex-1 px-2 py-1 rounded text-sm font-mono" placeholder="DOC-0001" />
                    <button onClick={generateNextCentralFolio} className="px-3 py-1 bg-emerald-700 text-white rounded text-xs">Siguiente Folio</button>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1">Todos los módulos que generan tickets, notas, etc. deben usar este folio ascendente para control centralizado desde Administración.</div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2 text-sm">
                  <input value={form.font_family} onChange={e=>handleField('font_family',e.target.value)} placeholder="Fuente (Arial, Helvetica, monospace...)" className="border px-1" />
                  <input type="number" value={form.font_size_title} onChange={e=>handleField('font_size_title',+e.target.value)} className="border px-1" placeholder="Titulo pt" />
                  <input type="number" value={form.font_size_body} onChange={e=>handleField('font_size_body',+e.target.value)} className="border px-1" placeholder="Cuerpo pt" />
                  <input type="number" value={form.font_size_small} onChange={e=>handleField('font_size_small',+e.target.value)} className="border px-1" placeholder="Peque pt" />
                </div>
                <div className="flex gap-2 items-center mb-2 text-xs">Colores corporativos:
                  {['primary_color','secondary_color','accent_color'].map(k=>(<input key={k} type="color" value={form[k]} onChange={e=>handleField(k,e.target.value)} />))}
                </div>

                {/* IMAGES: logo + additional for full corporate image */}
                <div className="space-y-2 mb-2">
                  <input value={form.logo_url} onChange={e=>handleField('logo_url',e.target.value)} placeholder="URL Logo principal" className="border w-full px-2 text-sm py-1 rounded" />
                  <input value={form.additional_logo_url} onChange={e=>handleField('additional_logo_url',e.target.value)} placeholder="URL Imagen adicional / banner corporativo" className="border w-full px-2 text-sm py-1 rounded" />
                  <label className="block text-xs">Subir imagen (logo o banner): <input type="file" accept="image/*" onChange={async (e)=>{ const fi=e.target.files[0]; if(!fi)return; const fd=new FormData();fd.append('file',fi); try{ const u=await fetch('/api/upload',{method:'POST',body:fd}); if(!u.ok)throw new Error(''); const d=await u.json(); const uu = d && (d.url || (d.data&&d.data.url)); if(uu){ handleField('logo_url',uu); handleField('additional_logo_url',uu); } }catch(e){} }} /></label>
                </div>

                <textarea value={form.description} onChange={e=>handleField('description',e.target.value)} className="border w-full rounded px-2 py-1 text-sm" placeholder="Descripción (ej: Nota de venta corporativa con logo y colores oficiales)" />

                {/* PROFESSIONAL GENERATOR BUTTONS */}
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs font-medium mb-1 text-emerald-700">Generador Profesional (PDF / JPG / Ticket editable con imagen corporativa)</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => generateRealPDF()} className="px-3 py-1 bg-emerald-700 text-white text-xs rounded">Generar PDF Muestra</button>
                    <button onClick={() => generateRealJPG()} className="px-3 py-1 bg-slate-800 text-white text-xs rounded">Generar JPG</button>
                    <button onClick={() => generateThermalTicket()} className="px-3 py-1 bg-amber-700 text-white text-xs rounded">Generar Ticket Térmico</button>
                    <button onClick={()=>showPreview(form)} className="border px-3 py-1 rounded text-sm">Vista Previa Rápida</button>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Los archivos usan el logo, colores, fuentes y textos corporativos configurados. Sube imágenes arriba para imagen de marca completa.</div>
                </div>

                <div className="mt-3 flex gap-2"><button onClick={saveTemplate} className="bg-emerald-700 px-4 text-white rounded py-1 flex-1">Guardar Plantilla Corporativa</button></div>
              </div>
              <div className="mt-3">{renderSimplePreview(form)}</div>
            </div>
          </div>}

          {activeTab==='asignaciones' && <div className="bg-white border p-4 rounded">
            <h3 className="font-semibold mb-3">Asignación de plantillas a módulos del ERP + Vista Previa</h3>
            <div className="text-xs mb-2">Usa el botón Vista Previa en cada celda para visualizar el resultado de la asignación actual.</div>
            <table className="w-full text-sm border">
              <thead><tr className="bg-slate-100"><th className="p-2 border">Módulo</th>{OUTPUT_TYPES.map(o=><th key={o} className="p-2 border">{o}</th>)}</tr></thead>
              <tbody>
                {(liveModules.length?liveModules : [{code:'embarques',label:'Embarques'}]).map(m=>(<tr key={m.code}><td className="p-2 border font-medium">{m.label}</td>{OUTPUT_TYPES.map(ot=>{const key=`${m.code}|${ot}`; const tid=assignState[key];const nm=getAssignedTplName(m.code,ot); return <td key={ot} className="border p-1 text-center"><select value={tid||''} onChange={ev=>{if(ev.target.value)setAssignment(m.code,ot,ev.target.value);else clearAssignment(m.code,ot);}} className="border text-xs">{[<option key="0" value="">—</option>].concat(templates.map(t=><option key={t.id} value={t.id}>{t.template_name}</option>))}</select><button onClick={() => showAssignedPreview(m.code, ot)} className="block text-[10px] mx-auto mt-px border px-1.5 rounded text-emerald-700">Vista Previa</button></td>})}</tr>))}
              </tbody>
            </table>
          </div>}

          {activeTab==='subir' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LOGO */}
            <div className="bg-white border p-5 rounded">
              <h3 className="font-medium mb-1 flex items-center gap-2">🏷️ Logotipo de la empresa</h3>
                <p className="text-xs text-slate-500 mb-2">Se usa en documentos, tickets, notas de venta y toda la papelería. El generador profesional permite editar textos corporativos, subir múltiples imágenes y exportar PDF/JPG/Ticket con marca completa.</p>
              <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={async (e) => {
                const f = e.target.files[0]; if (!f) return;
                const fd = new FormData(); fd.append('file', f);
                try {
                  const r = await fetch('/api/upload', {method:'POST', body: fd});
                  if (!r.ok) {
                    const eD = await r.json().catch(() => ({}));
                    throw new Error(eD.error || 'Error http de carga');
                  }
                  const d = await r.json();
                  const newUrl = d && (d.url || (d.data && d.data.url) || d.secure_url || d.filename_url);
                  if (newUrl) {
                    const uploadUrl = newUrl;
                    const br = await fetch('/api/branding', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ logo_url: uploadUrl }) });
                    if (!br.ok) { throw new Error('No se pudo registrar el logo (branding)'); }
                    handleField('base_file_url', uploadUrl);
                    handleField('logo_url', uploadUrl);
                    setCurrentLogo(uploadUrl);
                    // Sync logo to active templates for linked modules
                    try { 
                      const tRes = await fetch('/api/document-templates');
                      const ts = await tRes.json();
                      for(const t of (ts||[]).slice(0,6)) { if (t && t.id) await fetch(`/api/document-templates/${t.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({logo_url:uploadUrl})}); }
                    }catch(_){} 
                    alert('✅ Logotipo actualizado para toda la papelería.');
                    await loadAll();
                    await loadBranding();
                  } else {
                    throw new Error(d && d.error ? d.error : 'No se obtuvo URL de la carga');
                  }
                } catch (err) { alert('Error al cargar logo: ' + (err && err.message ? err.message : 'desconocido')); }
              }} />
              <div className="mt-2 text-[11px] text-slate-500">Formatos recomendados: PNG o JPG con fondo transparente.</div>
              {/* VISTA PREVIA DEL LOGO ACTUAL EN USO */}
              <div className="mt-4">
                <div className="text-xs font-semibold mb-1 text-slate-600">Vista previa del logotipo activo en el sistema:</div>
                {currentLogo ? (
                  <div className="border rounded p-2 bg-white inline-block">
                    <img src={currentLogo} alt="Logotipo empresa en uso" className="h-14 max-w-[180px] object-contain" />
                    <div className="text-[10px] text-emerald-700 mt-1">✓ En uso: todos los módulos (tickets, notas, PDFs, embarques...)</div>
                  </div>
                ) : <div className="text-xs text-slate-400 italic">No se ha cargado logotipo todavía. Súbelo arriba.</div>}
              </div>
            </div>

            {/* EXCEL PLANTILLA */}
            <div className="bg-white border p-5 rounded">
              <h3 className="font-medium mb-1 flex items-center gap-2">📊 Plantilla Excel</h3>
              <p className="text-xs text-slate-500 mb-2">Se usará como formato base para nota de venta, reportes y documentos (excepto tickets).</p>
              <input type="file" accept=".xlsx,.xls" onChange={async (e) => {
                const f = e.target.files[0]; if (!f) return;
                const fd = new FormData(); fd.append('file', f);
                try {
                  const r = await fetch('/api/upload', {method:'POST', body: fd});
                  if (!r.ok) {
                    const eD = await r.json().catch(() => ({}));
                    throw new Error(eD.error || 'Error http de carga');
                  }
                  const d = await r.json();
                  const newUrl = d && (d.url || (d.data && d.data.url) || d.secure_url || d.filename_url);
                  if (newUrl) {
                    const uploadUrl = newUrl;
                    const br = await fetch('/api/branding', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ excel_plantilla_url: uploadUrl }) });
                    if (!br.ok) { throw new Error('No se pudo registrar la plantilla (branding)'); }
                    setCurrentExcel(uploadUrl);
                    // Sync the excel base to usable templates for the modules
                    try {
                      const tRes = await fetch('/api/document-templates');
                      const ts = await tRes.json();
                      const excelTpls = (ts||[]).filter(tt => !tt.base_file_url || ['excel','nota','report'].includes(tt.document_type || ''));
                      for(const t of (excelTpls || []).slice(0,5)) {
                        if (t && t.id) {
                          await fetch(`/api/document-templates/${t.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_file_url:uploadUrl})}); 
                        }
                      }
                    }catch(_){}
                    alert('✅ Plantilla Excel cargada. Usada en notas y reportes.');
                    await loadAll();
                    await loadBranding();
                  } else {
                    throw new Error(d && d.error ? d.error : 'No se obtuvo URL de la carga');
                  }
                } catch (err) { alert('Error al cargar plantilla: ' + (err && err.message ? err.message : 'desconocido')); }
              }} />
              <div className="mt-2 text-[11px] text-slate-500">Archivo XLSX con estructura base (encabezados y posiciones para datos).</div>
              {/* VISTA PREVIA DE LA PLANTILLA EXCEL ACTIVA EN USO */}
              <div className="mt-4">
                <div className="text-xs font-semibold mb-1 text-slate-600">Plantilla Excel actualmente usada por el sistema:</div>
                {currentExcel ? (
                  <div className="border rounded bg-white p-3 text-xs">
                    <div>📁 <span className="font-mono text-emerald-800 break-all">{currentExcel.split('/').pop()}</span></div>
                    <div className="mt-1 flex gap-2">
                      <a href={currentExcel} target="_blank" rel="noopener" download className="text-blue-600 underline">Descargar / Abrir</a>
                      <span className="text-emerald-700">✓ Enlace a módulos: asignaciones Excel y reportes usan esta plantilla</span>
                    </div>
                  </div>
                ) : <div className="text-xs text-slate-400 italic">Sin plantilla Excel cargada. Súbela para usarla globalmente.</div>}
                {/* Vista previa dinámica del logo/plantilla activa (sin imagen estática) */}
                <div className="mt-2">
                  {(currentLogo || currentExcel) ? (
                    <div className="border rounded p-2 bg-white inline-block text-xs">
                      {currentLogo && <img src={currentLogo} alt="Logo corporativo activo" className="max-h-16 object-contain" />}
                      {currentExcel && <div className="mt-1 text-emerald-700">Plantilla Excel activa</div>}
                    </div>
                  ) : <div className="text-[10px] text-slate-400">Sube logo o plantilla arriba para previsualizar imagen corporativa.</div>}
                </div>
              </div>
            </div>
          </div>}
        </>}

        <div className="mt-6 flex justify-center"><button onClick={forceSyncSystem} className="text-xs px-4 py-1.5 border rounded">Sincronizar cambios al resto del sistema ahora →</button></div>
      </div>

      {previewModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center" onClick={closePreview}>
          <div className="max-w-md bg-white rounded p-4 w-full mx-2" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-2"><div>Vista Previa asignada: {previewModal.tpl?.template_name || 'Asignado'}</div><button onClick={closePreview}>×</button></div>
            {previewModal.tpl ? renderSimplePreview(previewModal.tpl) : <div>Resolviendo enlace...</div>}
            <div className="text-xs mt-3 text-slate-500">Usa el enlace asignado para {previewModal.outType} en {previewModal.modLabel||'módulo'}. Cambios de plantillas aplicados al imprimir documentos.</div>
          </div>
        </div>
      )}
    </div>
  );
}
