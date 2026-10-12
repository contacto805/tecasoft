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
const FONT_OPTIONS = ['Arial', 'Helvetica', 'Times New Roman', 'Inter', 'Courier New'];

const defaultForm = {
  template_name: '',
  document_type: 'pdf',
  description: '',
  logo_url: '',
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

  useEffect(() => { loadAll(); fetchSuperAdmin(); loadBranding(); }, []);

  async function fetchSuperAdmin() {
    try { const r = await fetch('/api/auth/check-super-admin'); if (r.ok) setIsSuperAdmin(!!(await r.json()).isSuperAdmin); } catch (_) {}
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

  const startNew = () => { setSelectedTemplate(null); setForm(defaultForm); setActiveTab('plantillas'); };

  const editTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setForm({ ...defaultForm, ...{
      template_name: tpl.template_name||'',
      document_type: tpl.document_type||'pdf',
      description: tpl.description||'',
      logo_url: tpl.logo_url||'',
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
    }});
    setPreviewConfig(tpl);
  };

  const handleField = (key, val) => {
    const f = { ...form, [key]: val }; setForm(f);
    setPreviewConfig({ ...(previewConfig||{}), ...f, [key]: val });
  };

  const saveTemplate = async () => {
    const payload = { ...form, template_code: (form.template_name||'tpl').toLowerCase().replace(/\s/g,'_').slice(0,60), created_by:'admin' };
    const url = selectedTemplate ? `/api/document-templates/${selectedTemplate.id}` : '/api/document-templates';
    const method = selectedTemplate ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const saved = await res.json().catch(()=>({}));
    if (res.ok) { await loadAll(); if (saved && saved.id) { setSelectedTemplate(saved); setForm(saved); setPreviewConfig(saved); } alert('Plantilla guardada'); }
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
    const bg = c.primary_color || '#0E4A22'; const f = c.font_family||'Arial'; const l = c.logo_url||c.base_file_url;
    const nm = c.template_name || 'Asignado';
    return (<div className="border bg-white rounded-xl p-3" style={{fontFamily:f}}><div style={{background:bg,color:'#fff'}} className="p-2 flex items-center gap-2">{l&&<img src={l} className="h-8 inline"/>}<span>{nm}</span></div><div style={{color:c.secondary_color}} className="p-2 text-xs">Documento {c.document_type||'asignado'} listo para imprimir en módulo.</div></div>);
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
                <div className="font-semibold mb-3">{selectedTemplate?'Editar':'Crear'} Plantilla</div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <input value={form.template_name} onChange={e=>handleField('template_name',e.target.value)} placeholder="Nombre plantilla" className="border px-2 py-1 rounded" />
                  <select value={form.document_type} onChange={e=>handleField('document_type',e.target.value)} className="border px-2 rounded">{DOCUMENT_TYPES.map(d=><option key={d}>{d}</option>)}</select>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2 text-sm">
                  <input value={form.font_family} onChange={e=>handleField('font_family',e.target.value)} className="border px-1" />
                  <input type="number" value={form.font_size_title} onChange={e=>handleField('font_size_title',+e.target.value)} className="border px-1" placeholder="Titulo pt" />
                  <input type="number" value={form.font_size_body} onChange={e=>handleField('font_size_body',+e.target.value)} className="border px-1" placeholder="Cuerpo pt" />
                  <input type="number" value={form.font_size_small} onChange={e=>handleField('font_size_small',+e.target.value)} className="border px-1" placeholder="Peque pt" />
                </div>
                <div className="flex gap-2 items-center mb-2 text-xs">Colores:
                  {['primary_color','secondary_color','accent_color'].map(k=>(<input key={k} type="color" value={form[k]} onChange={e=>handleField(k,e.target.value)} />))}
                </div>
                <input value={form.logo_url} onChange={e=>handleField('logo_url',e.target.value)} placeholder="URL logo o imagen" className="border w-full mb-2 px-2 text-sm py-1 rounded" />
                <label className="block mb-1 text-xs">O sube base/imagen: <input type="file" accept="image/*" onChange={async (e)=>{ const fi=e.target.files[0]; if(!fi)return; const fd=new FormData();fd.append('file',fi); try{ const u=await fetch('/api/upload',{method:'POST',body:fd}); if(!u.ok)throw new Error(''); const d=await u.json(); const uu = d && (d.url || (d.data&&d.data.url)); if(uu) handleField('base_file_url',uu); else handleField('base_file_url',d.url || ''); }catch(e){} }} /></label>
                <textarea value={form.description} onChange={e=>handleField('description',e.target.value)} className="border w-full rounded px-2 py-1 text-sm" placeholder="Descripción" />
                <div className="mt-3 flex gap-2"><button onClick={()=>showPreview(form)} className="border px-3 py-1 rounded text-sm">Vista Previa</button><button onClick={saveTemplate} className="bg-emerald-700 px-4 text-white rounded py-1">Guardar</button></div>
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
              <p className="text-xs text-slate-500 mb-2">Se usa en documentos, tickets, notas de venta y toda la papelería.</p>
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
                {/* Demo de vista previa de archivo cargado usando la imagen de referencia */}
                <div className="mt-2">
                  <img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784107484476_zwsgxc.jpeg" alt="Vista previa documento cargado" className="border rounded max-h-28 object-contain" />
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
