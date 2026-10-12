'use client';

import React, { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';

export default function ControlCombustible() {
  const { branding } = useBranding();
  const defaultLogo = 'https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785010951159_ri7p2.png';
  const logoUrl = branding?.logo_url || defaultLogo;

  const [section, setSection] = useState('resumen');
  const [cargas, setCargas] = useState([]);
  const [gasolineras, setGasolineras] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [corredores, setCorredores] = useState([]);
  const [orchards, setOrchards] = useState([]);
  const [lots, setLots] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastFolio, setLastFolio] = useState(null);

  // Filters for registros and resumen
  const [filtros, setFiltros] = useState({ from: '', to: '', folio: '', estatus: '', corredor: '', vehiculo: '', gasolinera: '', tipo: '' });

  // Nueva carga form - matches spec sections
  const [form, setForm] = useState({
    fecha_carga: new Date().toISOString().slice(0, 10),
    hora_carga: new Date().toTimeString().slice(0, 5),
    corredor_nombre: '',
    vehiculo_id: '',
    placas_capturadas: '',
    kilometraje_anterior: '',
    kilometraje_actual: '',
    ruta_origen: '',
    ruta_destino: '',
    motivo_viaje: '',
    productor: '',
    lote: '',
    orden_corte: '',
    gasolinera_id: '',
    gasolinera_nombre: '',
    combustible_tipo: 'Magna',
    litros: '',
    precio_litro: '',
    importe_ticket: '',
    metodo_pago: 'efectivo',
    numero_ticket: '',
    numero_factura: '',
    tanque_lleno: false,
    comprobante_url: '',
    odometro_foto_url: '',
    km_al_cargar: '',
    observaciones: ''
  });

  const [showPreview, setShowPreview] = useState(false);
  const [previewIsDraft, setPreviewIsDraft] = useState(true);
  const [previewData, setPreviewData] = useState(null);

  const [selectedCarga, setSelectedCarga] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [authMotivo, setAuthMotivo] = useState('');

  // Config editing
  const [editConfig, setEditConfig] = useState({ company_name: '', module_name: '', slogan: '', razon_social: '', eslogan: '', ubicacion: '', correo: '', telefono: '', logo_url: '', primary_color: '#0B4F2B', secondary_color: '#17653C', accent_color: '#E9E45A', terracota: '#A73D20', bg_color: '#F4F7F4', text_color: '#173126', border_color: '#DBE5DE', warning_bg: '#FFF4CF', error_bg: '#FFE0DC', success_bg: '#E1F4E7', font_family: 'Inter, Segoe UI, Arial, sans-serif', print_show_qr: true, print_show_firmas: true, print_show_relaciones: true, print_show_centro_costo: false, print_show_fecha_impresion: true, print_show_usuario: true });

  // NEW: Documental control states per spec
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docFilter, setDocFilter] = useState('todos'); // todos | sin_factura | sin_foto | sin_archivo | completos | >3dias | >7dias | >15dias
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTipo, setDocTipo] = useState(''); // FOTO_TICKET or FACTURA_*
  const [previewDocUrl, setPreviewDocUrl] = useState(null);
  const [numeroFacturaInput, setNumeroFacturaInput] = useState('');

  const primary = (config && config.primary_color) || '#0B4F2B';
  const secondary = (config && config.secondary_color) || '#17653C';
  const accent = (config && config.accent_color) || '#E9E45A';
  const terracota = (config && config.terracota) || '#A73D20';
  const bg = (config && config.bg_color) || '#F4F7F4';
  const textC = (config && config.text_color) || '#173126';

  async function loadUser() {
    try {
      const r = await fetch('/api/auth/user', { credentials: 'include' });
      if (r.ok) setCurrentUser(await r.json());
    } catch {}
  }

  async function loadConfig() {
    try {
      const r = await fetch('/api/combustible/config');
      const d = await r.json() || {};
      // Merge central company/branding for same info across modules
      const [br, st] = await Promise.all([
        fetch('/api/branding').then(res => res.ok ? res.json() : {}),
        fetch('/api/settings').then(res => res.ok ? res.json() : {})
      ]);
      const merged = {
        ...d,
        company_name: br.company_name || st.company_name || d.company_name || 'Tecavo Fruits',
        slogan: br.slogan || d.slogan || '',
        razon_social: br.company_name || st.company_name || d.razon_social || '',
        ubicacion: st.company_address || d.ubicacion || '',
        correo: st.email || d.correo || '',
        telefono: st.phone || d.telefono || ''
      };
      setConfig(merged);
      setEditConfig(merged);
    } catch {}
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cRes, gRes, vRes, eRes, oRes, lRes, coRes, pRes] = await Promise.all([
        fetch('/api/combustible/cargas'),
        fetch('/api/combustible/gasolineras'),
        fetch('/api/vehicles'),
        fetch('/api/employees'),
        fetch('/api/orchards'),
        fetch('/api/lots'),
        fetch('/api/combustible/conceptos'),
        fetch('/api/printer-settings')
      ]);
      setCargas(await cRes.json().catch(() => []));
      setGasolineras(await gRes.json().catch(() => []));
      const vs = await vRes.json().catch(() => []);
      setVehiculos(Array.isArray(vs) ? vs : []);
      const es = await eRes.json().catch(() => []);
      setCorredores(Array.isArray(es) ? es.filter(e => e.is_active !== false) : []);
      setOrchards(await oRes.json().catch(() => []));
      setLots(await lRes.json().catch(() => []));
      const pr = await pRes.json().catch(() => []);
      setPrinters(Array.isArray(pr) ? pr : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // NEW: auto estado calculation (client side for UI, server authoritative)
  function calcularEstadoDocumental(carga, docs = []) {
    const nf = !!(carga?.numero_factura && String(carga.numero_factura).trim());
    const ft = docs.some(d => d.tipo_documento === 'FOTO_TICKET') || !!carga?.comprobante_url; // legacy support
    const fa = docs.some(d => ['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento));
    let comp = 0;
    if (nf) comp++;
    if (ft) comp++;
    if (fa) comp++;
    if (comp === 3) return { estado: 'COMPLETO', completos: 3, completo: true };
    if (comp === 0) return { estado: 'PENDIENTE_TOTAL', completos: 0, completo: false };
    if (!nf && !ft && !fa) return { estado: 'PENDIENTE_MULTIPLE', completos: comp, completo: false };
    if (!nf) return { estado: 'PENDIENTE_FACTURA_NUMERO', completos: comp, completo: false };
    if (!ft) return { estado: 'PENDIENTE_FOTO_TICKET', completos: comp, completo: false };
    if (!fa) return { estado: 'PENDIENTE_ARCHIVO_FACTURA', completos: comp, completo: false };
    return { estado: 'PENDIENTE_MULTIPLE', completos: comp, completo: false };
  }

  async function loadDocumentos(cargaId) {
    if (!cargaId) return [];
    try {
      const r = await fetch(`/api/combustible/documentos?carga_id=${cargaId}`);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    } catch { return []; }
  }

  async function openDetail(carga) {
    setSelectedDetail(carga);
    setEditMode(false);
    setNumeroFacturaInput(carga.numero_factura || '');
    const docs = await loadDocumentos(carga.id);
    setDocumentos(docs);
    setDocFilter('todos');
  }

  function closeDetail() {
    setSelectedDetail(null);
    setDocumentos([]);
    setEditMode(false);
    setPreviewDocUrl(null);
  }

  async function uploadDocumento(carga, tipo, file, extraNumeroFactura = null) {
    if (!file || !carga) return;
    setUploading(true);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upj = await up.json();
      if (!upj.url) throw new Error('Upload falló');

      const payload = {
        carga_id: carga.id,
        folio: carga.folio,
        tipo_documento: tipo,
        nombre_original: file.name,
        ruta_almacenamiento: upj.url,
        mime_type: file.type,
        tamano_bytes: file.size,
        usuario_carga: currentUser?.name || currentUser?.email || 'usuario',
        numero_factura: extraNumeroFactura || (tipo.includes('FACTURA') ? numeroFacturaInput : null)
      };

      if (isOffline) {
        // Offline: store in localStorage queue (IndexedDB-like simple)
        const q = JSON.parse(localStorage.getItem('combustible_offline_docs') || '[]');
        q.push({ ...payload, _offline: true, _ts: Date.now() });
        localStorage.setItem('combustible_offline_docs', JSON.stringify(q));
        alert('Guardado offline. Se sincronizará al reconectar.');
        // show as pending
        setDocumentos(prev => [...prev, { ...payload, id: 'offline-'+Date.now(), sincronizado: false }]);
      } else {
        const res = await fetch('/api/combustible/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const dj = await res.json();
        if (dj.error) {
          alert(dj.error);
        } else {
          alert('Documento cargado');
          const freshDocs = await loadDocumentos(carga.id);
          setDocumentos(freshDocs);
          await loadAll();
          const [freshC] = await (await fetch(`/api/combustible/cargas?id=${carga.id}`)).json();
          if (freshC) setSelectedDetail(freshC);
        }
      }
    } catch (e) {
      // fallback offline store
      const q = JSON.parse(localStorage.getItem('combustible_offline_docs') || '[]');
      q.push({ carga_id: carga.id, folio: carga.folio, tipo_documento: tipo, nombre_original: file.name, ruta_almacenamiento: 'pending', _offline:true, _ts:Date.now() });
      localStorage.setItem('combustible_offline_docs', JSON.stringify(q));
      alert('Sin conexión: archivo en cola de sincronización.');
    }
    setUploading(false);
  }

  async function replaceDocumento(docId, carga, file, motivo = '') {
    if (!file || !carga) return;
    if (!motivo && !confirm('¿Reemplazar sin motivo? Se registrará en auditoría.')) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upj = await up.json();
      if (!upj.url) throw new Error('Upload falló');

      const res = await fetch('/api/combustible/documentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          carga_id: carga.id,
          ruta_almacenamiento: upj.url,
          nombre_original: file.name,
          mime_type: file.type,
          tamano_bytes: file.size,
          motivo: motivo || 'Reemplazo autorizado por usuario',
          usuario: currentUser?.name || 'usuario'
        })
      });
      const rj = await res.json();
      if (rj.error) alert(rj.error);
      else {
        alert('Documento reemplazado. Versión anterior conservada en auditoría.');
        const fresh = await loadDocumentos(carga.id);
        setDocumentos(fresh);
        await loadAll();
      }
    } catch (e) { alert('Error al reemplazar'); }
    setUploading(false);
  }

  async function guardarNumeroFactura() {
    if (!selectedDetail || !numeroFacturaInput) { alert('Ingresa número de factura'); return; }
    try {
      await fetch('/api/combustible/cargas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDetail.id, numero_factura: numeroFacturaInput, motivo: 'Registro de número de factura' })
      });
      await loadAll();
      const docs = await loadDocumentos(selectedDetail.id);
      setDocumentos(docs);
      const [fresh] = await (await fetch(`/api/combustible/cargas?id=${selectedDetail.id}`)).json();
      if (fresh) setSelectedDetail(fresh);
      setEditMode(false);
      alert('Número de factura guardado');
    } catch { alert('Error guardando número'); }
  }

  useEffect(() => {
    loadUser();
    loadConfig();
    loadAll();
    // simple offline queue sync on load
    (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const q = JSON.parse(localStorage.getItem('combustible_offline_docs') || '[]');
          if (q.length) {
            for (const item of q) {
              if (item._offline) {
                await fetch('/api/combustible/documentos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) }).catch(()=>{});
              }
            }
            localStorage.removeItem('combustible_offline_docs');
          }
        }
      } catch {}
    })();
  }, []);

  // Auto fill on vehicle select: placas + previous km from last record of same vehicle (for rendimiento)
  async function handleVehiculoChange(id) {
    const v = vehiculos.find(x => String(x.id) === String(id));
    let anterior = '';
    if (id) {
      try {
        // Use precise vehiculo_id (no estatus filter) to get the most recent previous record for this vehicle
        const r = await fetch(`/api/combustible/cargas?vehiculo_id=${id}`);
        const list = await r.json();
        // API returns ordered by fecha_carga DESC, id DESC — first is the latest previous
        const prev = Array.isArray(list) && list.length > 0 ? list[0] : null;
        if (prev) {
          anterior = prev.kilometraje_actual || prev.km_al_cargar || prev.kilometraje_carga_anterior || '';
        }
      } catch (e) { /* silent, allow manual entry */ }
    }
    setForm(f => ({
      ...f,
      vehiculo_id: id,
      placas_capturadas: v?.plates || f.placas_capturadas,
      kilometraje_anterior: anterior || f.kilometraje_anterior || '',
      combustible_tipo: v?.tipo_combustible || f.combustible_tipo
    }));
  }

  function handleGasolineraChange(id) {
    const g = gasolineras.find(x => String(x.id) === String(id));
    setForm(f => ({ ...f, gasolinera_id: id, gasolinera_nombre: g?.nombre || '' }));
  }

  // Live calcs
  const litrosN = parseFloat(form.litros) || 0;
  const precioN = parseFloat(form.precio_litro) || 0;
  const ticketN = parseFloat(form.importe_ticket) || 0;
  const calcImporte = Math.round(litrosN * precioN * 100) / 100;
  const diff = Math.round((calcImporte - ticketN) * 100) / 100;
  const kmRec = (parseFloat(form.kilometraje_actual) || 0) - (parseFloat(form.kilometraje_anterior) || 0);
  const rend = (litrosN > 0 && form.tanque_lleno && kmRec > 0) ? (kmRec / litrosN) : null;

  // Resumen KPIs - rendimiento = suma km comp / suma L comp (only full tank comparable)
  const autorizadas = cargas.filter(c => c.estatus === 'autorizado');
  const gastoTotal = autorizadas.reduce((s, c) => s + (parseFloat(c.importe_ticket) || 0), 0);
  const litrosTotal = autorizadas.reduce((s, c) => s + (parseFloat(c.litros) || 0), 0);
  const numCargasActivas = autorizadas.length;
  const pendientes = cargas.filter(c => c.estatus === 'pendiente').length;
  const conDiferencia = cargas.filter(c => Math.abs(parseFloat(c.diferencia_importe || 0)) > 1).length;
  const sinComprobante = cargas.filter(c => !c.comprobante_url && c.estatus !== 'cancelado').length;

  // NEW documental stats for main card + filters
  const docsPendientes = cargas.filter(c => (c.estado_documental && c.estado_documental !== 'COMPLETO') || (!c.numero_factura && c.estatus !== 'cancelado'));
  const sinNF = cargas.filter(c => !c.numero_factura && c.estatus !== 'cancelado').length;
  const sinFoto = cargas.filter(c => !c.comprobante_url && c.estatus !== 'cancelado').length; // legacy + will use docs
  const sinArchivo = cargas.filter(c => !(c.estado_documental === 'COMPLETO') && c.estatus !== 'cancelado').length;
  const completosDoc = cargas.filter(c => c.estado_documental === 'COMPLETO' || (c.numero_factura && c.comprobante_url)).length;
  const masAntiguo = docsPendientes.length ? Math.max(...docsPendientes.map(c => {
    const d = new Date(c.fecha_carga || Date.now()); return Math.floor((Date.now() - d.getTime()) / 86400000);
  })) : 0;
  const importePendiente = docsPendientes.reduce((s, c) => s + (parseFloat(c.importe_ticket) || 0), 0);

  // Simple comparable rendimiento (sum km / sum L for full tank sequences of same vehicle)
  let rendGlobal = null;
  try {
    const byVeh = {};
    autorizadas.forEach(c => {
      if (!c.vehiculo_nombre) return;
      if (!byVeh[c.vehiculo_nombre]) byVeh[c.vehiculo_nombre] = [];
      byVeh[c.vehiculo_nombre].push(c);
    });
    let totalKm = 0, totalL = 0;
    Object.values(byVeh).forEach(list => {
      const sorted = list.sort((a,b) => (a.fecha_carga||'').localeCompare(b.fecha_carga||''));
      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i];
        const prev = sorted[i-1];
        if (curr.tanque_lleno && prev.tanque_lleno) {
          const dk = (parseFloat(curr.kilometraje_actual)||0) - (parseFloat(prev.kilometraje_actual)||0);
          if (dk > 0) {
            totalKm += dk;
            totalL += parseFloat(curr.litros)||0;
          }
        }
      }
    });
    if (totalL > 0) rendGlobal = (totalKm / totalL).toFixed(2);
  } catch {}

  async function saveConfig() {
    try {
      await fetch('/api/combustible/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editConfig)
      });
      await loadConfig();
      alert('Configuración guardada');
    } catch { alert('Error al guardar configuración'); }
  }

  function restoreDefaultConfig() {
    if (!confirm('¿Restaurar diseño predeterminado?')) return;
    const def = {
      company_name: 'Tecavo Fruits',
      module_name: 'CONTROL DE COMBUSTIBLE',
      slogan: 'Trazabilidad completa de cargas de combustible',
      razon_social: 'Comercializadora de Frutas de Tacámbaro, S.A. de C.V.',
      eslogan: 'Del campo con amor',
      ubicacion: 'Tacámbaro, Michoacán, México',
      correo: 'jorge.perezvelez@tecavofruits.com',
      telefono: '459 104 55 66',
      logo_url: '',
      primary_color: '#0B4F2B',
      secondary_color: '#17653C',
      accent_color: '#E9E45A',
      terracota: '#A73D20',
      bg_color: '#F4F7F4',
      text_color: '#173126',
      border_color: '#DBE5DE',
      warning_bg: '#FFF4CF',
      error_bg: '#FFE0DC',
      success_bg: '#E1F4E7',
      font_family: 'Inter, Segoe UI, Arial, sans-serif',
      print_show_qr: true,
      print_show_firmas: true,
      print_show_relaciones: true,
      print_show_centro_costo: false,
      print_show_fecha_impresion: true,
      print_show_usuario: true
    };
    setEditConfig(def);
    setConfig(def);
  }

  // Vista previa / imprimir borrador - NO genera folio
  function openPreviewDraft() {
    if (!form.corredor_nombre || !form.vehiculo_id || !form.litros || !form.precio_litro || !form.importe_ticket) {
      alert('Completa los campos obligatorios para la vista previa');
      return;
    }
    const v = vehiculos.find(x => String(x.id) === String(form.vehiculo_id));
    const kmRec = (parseFloat(form.kilometraje_actual)||0) - (parseFloat(form.kilometraje_anterior)||0);
    const preview = {
      ...form,
      vehiculo_nombre: v?.name || '',
      placas_capturadas: form.placas_capturadas || v?.plates || '',
      folio: 'BORRADOR - SIN FOLIO',
      estatus: 'BORRADOR',
      isDraft: true,
      fecha_hora: `${form.fecha_carga} ${form.hora_carga}`,
      corredor: form.corredor_nombre,
      vehiculo: v?.name || '',
      placas: form.placas_capturadas || v?.plates || '',
      origen: form.ruta_origen || 'No registrado',
      destino: form.ruta_destino || 'No registrado',
      motivo: form.motivo_viaje || 'No registrado',
      km_anterior: form.kilometraje_anterior || '—',
      km_actual: form.kilometraje_actual || '',
      gasolinera: form.gasolinera_nombre || '',
      combustible: form.combustible_tipo,
      metodo_pago: form.metodo_pago,
      tanque_lleno: form.tanque_lleno ? 'Sí' : 'No',
      numero_ticket: form.numero_ticket || '—',
      litros: form.litros,
      precio_litro: form.precio_litro,
      importe_calculado: calcImporte.toFixed(2),
      total_ticket: form.importe_ticket,
      diferencia: diff.toFixed(2),
      km_recorridos: kmRec > 0 ? kmRec.toFixed(1) : '—',
      rendimiento: 'No calculable (borrador)',
      costo_km: 'No calculable',
      numero_factura: form.numero_factura || 'No registrado',
      estado_ticket: 'PENDIENTE',
      estado_factura: 'PENDIENTE',
      estado_documental: 'PENDIENTE_TOTAL',
      documentos_completos: '0 de 3',
      observaciones: form.observaciones || '—',
      usuario_registro: currentUser?.name || '—',
      usuario_autorizacion: '—',
      huerta_productor: 'No relacionado',
      lote: 'No relacionado',
      orden_corte: 'No relacionado'
    };
    // Use the exact same official template as saved records
    const primaryC = (config && config.primary_color) || '#0B4F2B';
    const terr = (config && config.terracota) || '#A73D20';
    const acc = (config && config.accent_color) || '#E9E45A';
    const html = buildOfficialHTML(preview, true, null, primaryC, terr, acc, logoUrl, null, false, false);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else { alert('Permite ventanas emergentes para la vista previa'); }
  }

  function closePreview() {
    setShowPreview(false);
    setPreviewData(null);
  }

  function printPreview() {
    const w = window.open('', '_blank');
    if (!w) { alert('Permite popups para imprimir'); return; }
    const p = previewData || {};
    const isDraft = !!p.isDraft;
    const primaryC = (config && config.primary_color) || '#0B4F2B';
    const terr = (config && config.terracota) || '#A73D20';
    const acc = (config && config.accent_color) || '#E9E45A';
    const html = buildOfficialHTML(p, isDraft, null, primaryC, terr, acc, logoUrl);
    w.document.write(html);
    w.document.close();
  }

  // Official server-backed print for saved records (uses /pdf endpoint for real calculations + snapshot)
  async function printOfficial(cargaId, forceDraft = false) {
    try {
      const r = await fetch(`/api/combustible/cargas/${cargaId}/pdf`);
      const j = await r.json();
      if (j.error) { alert(j.error); return; }
      const w = window.open('', '_blank');
      if (!w) { alert('Permite popups'); return; }
      const primaryC = j.config?.primary || '#0B4F2B';
      const terr = j.config?.terracota || '#A73D20';
      const acc = j.config?.accent || '#E9E45A';
      const companyForPrint = j.company || {};
      const html = buildOfficialHTML(j.data, forceDraft || j.isDraft, j.qr, primaryC, terr, acc, logoUrl, companyForPrint, j.isCancelado, j.isRechazado);
      w.document.write(html);
      w.document.close();
    } catch (e) {
      alert('No se pudo generar el comprobante oficial');
    }
  }

  function buildOfficialHTML(d, isDraft, qrDataUrl, primaryC, terrC, accC, logo, companySnap = null, isCancelado = false, isRechazado = false) {
    const c = companySnap || {};
    const razon = c.razon_social || 'Comercializadora de Frutas de Tacámbaro, S.A. de C.V.';
    const nombre = c.nombre_comercial || c.company_name || 'Tecavo Fruits';
    const eslogan = c.eslogan || 'Del campo con amor';
    const ubi = c.ubicacion || 'Tacámbaro, Michoacán, México';
    const correo = c.correo || 'jorge.perezvelez@tecavofruits.com';
    const tel = c.telefono || '459 104 55 66';
    const showQR = (config && config.print_show_qr !== false);
    const showFirmas = (config && config.print_show_firmas !== false);
    const showRel = (config && config.print_show_relaciones !== false);

    const statusColor = {
      'BORRADOR': '#6b7280',
      'PENDIENTE': '#ca8a04',
      'EN REVISION': '#2563eb',
      'AUTORIZADO': '#15803d',
      'RECHAZADO': '#b91c1c',
      'CANCELADO': '#7f1d1d'
    }[(d.estatus || '').toUpperCase()] || '#6b7280';

    const draftBanner = isDraft ? `<div style="background:#fef3c7;color:#854d0e;padding:5px 10px;text-align:center;font-weight:800;font-size:12px;border:3px solid #f59e0b;margin-bottom:6px;letter-spacing:0.5px">VISTA PREVIA — BORRADOR - SIN FOLIO — DOCUMENTO NO GUARDADO — NO OFICIAL</div>` : '';
    const cancelBanner = isCancelado ? `<div style="background:#fee2e2;color:#991b1b;padding:4px 8px;text-align:center;font-weight:900;font-size:13px;border:2px solid #b91c1c;margin:4px 0">CANCELADO — ${d.motivo_cancelacion || 'Sin motivo registrado'}</div>` : '';
    const rejectBanner = isRechazado && !isCancelado ? `<div style="background:#fee2e2;color:#991b1b;padding:3px 8px;text-align:center;font-weight:700;font-size:11px;border:1px solid #b91c1c;margin:3px 0">RECHAZADO — ${d.motivo_rechazo || ''}</div>` : '';

    const qrImg = (showQR && qrDataUrl) ? `<img src="${qrDataUrl}" style="width:86px;height:86px;border:1px solid #999;background:#fff" alt="QR" />` : '';
    const qrBox = (showQR && qrDataUrl) ? `<div style="text-align:center">${qrImg}<div style="font-size:7px;margin-top:1px;color:#444">Consulta oficial</div></div>` : '';

    const water = isCancelado ? `<div style="position:absolute;top:42%;left:8%;font-size:68px;font-weight:900;color:#fee2e2;opacity:0.22;transform:rotate(-26deg);pointer-events:none;z-index:0;letter-spacing:4px">CANCELADO</div>` : '';

    return `<!doctype html><html><head><meta charset="utf-8"><title>${isDraft ? 'BORRADOR' : d.folio} - Control de Combustible</title>
<style>
  @page { size: Letter portrait; margin: 6mm 8mm; }
  * { box-sizing:border-box; }
  body { font-family: ${config?.font_family || 'Inter, Segoe UI, Arial, sans-serif'}; margin:0; padding:0; color:#111; background:#fff; font-size:9.8px; line-height:1.22; }
  .page { width: 8.5in; height: 11in; padding: 5mm 7mm; background:#fff; margin:0 auto; position:relative; overflow:hidden; }
  .hdr { display:flex; align-items:center; justify-content:space-between; background:#0B4F2B; color:#fff; padding:5px 7px; margin:-5px -7px 5px -7px; }
  .logo { height:42px; max-width:150px; object-fit:contain; background:#fff; padding:2px; border-radius:1px; }
  .hdr-right { text-align:right; }
  .hdr-right .big { font-size:15px; font-weight:900; letter-spacing:0.6px; }
  .hdr-right .small { font-size:8.5px; opacity:0.92; }
  .status-bar { display:flex; align-items:center; gap:8px; margin:3px 0 4px; }
  .status { display:inline-block; padding:1px 9px; font-size:9px; font-weight:800; color:#fff; background:${statusColor}; border-radius:2px; }
  .folio { font-size:12px; font-weight:800; }
  .sec { margin:4px 0 2px; font-weight:800; font-size:9px; color:#0B4F2B; border-bottom:1px solid #0B4F2B; padding-bottom:1px; letter-spacing:0.3px; }
  .g { display:grid; grid-template-columns:1fr 1fr; gap:2px 8px; }
  .g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:2px 8px; }
  .k { font-size:7.8px; color:#555; text-transform:uppercase; letter-spacing:0.2px; }
  .v { font-size:10.2px; font-weight:700; color:#111; }
  .row { display:flex; gap:6px; margin:1px 0; }
  .col { flex:1; min-width:0; }
  .box { border:1px solid #ccc; padding:3px 5px; border-radius:2px; background:#fafafa; }
  .calc-box { background:#f0fdf4; border-color:#86efac; }
  .doc-box { background:#fffbeb; border-color:#fcd34d; }
  .sign { border-top:1px solid #222; width:42%; display:inline-block; margin-top:14px; font-size:8px; text-align:center; }
  .foot { font-size:7.5px; color:#555; margin-top:4px; border-top:1px solid #aaa; padding-top:2px; display:flex; justify-content:space-between; }
  .watermark { position:absolute; top:39%; left:6%; font-size:72px; font-weight:900; color:#fee2e2; opacity:0.18; transform:rotate(-24deg); pointer-events:none; z-index:0; }
  .banner { font-weight:800; text-align:center; }
  table.data { width:100%; border-collapse:collapse; font-size:9.2px; }
  table.data td { border:1px solid #ddd; padding:2px 4px; vertical-align:top; }
  .label { background:#f3f4f6; font-weight:600; color:#444; width:32%; }
  @media print { .no-print { display:none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="hdr">
    <div><img src="${logo}" class="logo" alt="Tecavo Fruits" /></div>
    <div class="hdr-right">
      <div class="big">CONTROL DE COMBUSTIBLE</div>
      <div class="small">Comprobante de carga y rendimiento</div>
      <div class="small" style="margin-top:1px">${nombre} • ${eslogan}</div>
      <div class="small">${razon}</div>
      <div class="small">${ubi} • ${correo} • ${tel}</div>
    </div>
  </div>

  ${draftBanner}
  ${cancelBanner}
  ${rejectBanner}

  <div class="status-bar">
    <span class="status">${d.estatus || '—'}</span>
    <span class="folio"><b>FOLIO:</b> ${isDraft ? 'BORRADOR - SIN FOLIO' : d.folio}</span>
    <span style="font-size:9px;color:#555;margin-left:auto">Impreso: ${d.fecha_impresion || new Date().toLocaleString('es-MX')}</span>
  </div>

  <div class="sec">IDENTIFICACIÓN Y RECORRIDO</div>
  <div class="g">
    <div><span class="k">Fecha / Hora de carga</span><br/><span class="v">${d.fecha_hora}</span></div>
    <div><span class="k">Corredor / Conductor</span><br/><span class="v">${d.corredor}</span></div>
    <div><span class="k">Vehículo</span><br/><span class="v">${d.vehiculo} ${d.placas && d.placas !== 'No registrado' ? '• ' + d.placas : ''}</span></div>
    <div><span class="k">Placas</span><br/><span class="v">${d.placas}</span></div>
    <div><span class="k">Origen</span><br/><span class="v">${d.origen}</span></div>
    <div><span class="k">Destino / Acopio / Huerta</span><br/><span class="v">${d.destino}</span></div>
    <div style="grid-column:1/3"><span class="k">Motivo del recorrido</span><br/><span class="v">${d.motivo}</span></div>
  </div>

  <div class="sec">DATOS DE LA CARGA</div>
  <table class="data"><tr>
    <td class="label">Gasolinera / Proveedor</td><td class="v">${d.gasolinera}</td>
    <td class="label">Tipo combustible</td><td class="v">${d.combustible}</td>
    <td class="label">Método de pago</td><td class="v">${d.metodo_pago}</td>
  </tr><tr>
    <td class="label">Litros cargados</td><td class="v">${d.litros}</td>
    <td class="label">Precio por litro</td><td class="v">${d.precio_litro}</td>
    <td class="label">Nº Ticket</td><td class="v">${d.numero_ticket}</td>
  </tr><tr>
    <td class="label">Tanque lleno</td><td class="v">${d.tanque_lleno}</td>
    <td class="label">Nº Factura</td><td class="v">${d.numero_factura}</td>
    <td class="label">Km al cargar</td><td class="v">${d.km_actual}</td>
  </tr></table>

  <div class="sec">RESUMEN FINANCIERO Y RENDIMIENTO</div>
  <div class="row">
    <div class="col box calc-box"><span class="k">Importe calculado</span><br/><span class="v">${d.importe_calculado}</span></div>
    <div class="col box calc-box"><span class="k">Total del ticket</span><br/><span class="v">${d.total_ticket}</span></div>
    <div class="col box" style="border-color:${Math.abs(parseFloat(d.diferencia||0))>1 ? terrC : '#ccc'}"><span class="k">Diferencia</span><br/><span class="v" style="color:${Math.abs(parseFloat(d.diferencia||0))>1 ? terrC : '#111'}">${d.diferencia}</span></div>
  </div>
  <div class="row">
    <div class="col box"><span class="k">Km anterior</span><br/><span class="v">${d.km_anterior}</span></div>
    <div class="col box"><span class="k">Km actual</span><br/><span class="v">${d.km_actual}</span></div>
    <div class="col box"><span class="k">Km recorridos</span><br/><span class="v">${d.km_recorridos}</span></div>
    <div class="col box calc-box"><span class="k">Rendimiento (km/L)</span><br/><span class="v">${d.rendimiento}</span></div>
    <div class="col box calc-box"><span class="k">Costo por km</span><br/><span class="v">${d.costo_km}</span></div>
  </div>

  <div class="sec">EXPEDIENTE DOCUMENTAL</div>
  <div class="box doc-box" style="font-size:9px">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div>1. Nº Factura: <b>${d.numero_factura && d.numero_factura !== 'No registrado' ? 'CARGADO' : 'PENDIENTE'}</b></div>
      <div>2. Foto ticket: <b>${d.estado_ticket}</b></div>
      <div>3. Archivo factura: <b>${d.estado_factura}</b></div>
      <div style="margin-left:auto"><b>${d.documentos_completos}</b> • ${d.estado_documental}</div>
    </div>
    ${d.estado_documental !== 'COMPLETO' ? '<div style="margin-top:1px;color:#92400e;font-weight:700">EXPEDIENTE DOCUMENTAL PENDIENTE</div>' : '<div style="margin-top:1px;color:#166534;font-weight:700">EXPEDIENTE DOCUMENTAL COMPLETO</div>'}
  </div>

  ${showRel ? `<div class="sec">RELACIONES OPERATIVAS</div>
  <div class="g3">
    <div><span class="k">Huerta / Productor</span><br/><span class="v">${d.huerta_productor || 'No relacionado'}</span></div>
    <div><span class="k">Lote</span><br/><span class="v">${d.lote || 'No relacionado'}</span></div>
    <div><span class="k">Orden de corte</span><br/><span class="v">${d.orden_corte || 'No relacionado'}</span></div>
  </div>` : ''}

  <div class="sec">OBSERVACIONES Y AUTORIZACIÓN</div>
  <div style="min-height:22px;border:1px solid #ccc;padding:2px 4px;font-size:9.5px;background:#fff">${d.observaciones || '—'}</div>

  ${showFirmas ? `<div style="margin-top:8px;display:flex;gap:18px;align-items:flex-end">
    <div class="sign">Firma del corredor<br/><span style="font-size:7.5px">${d.usuario_registro || ''}</span></div>
    <div class="sign">Firma de autorización<br/><span style="font-size:7.5px">${d.usuario_autorizacion || '—'}</span></div>
    <div style="margin-left:auto">${qrBox}</div>
  </div>` : `<div style="margin-top:6px;display:flex;justify-content:flex-end">${qrBox}</div>`}

  <div class="foot">
    <div>${nombre} • ${ubi} • ${correo} • ${tel}</div>
    <div>Soft Tecavo • ${d.fecha_impresion} • ${d.usuario_registro}</div>
  </div>

  ${water}
</div>
<div class="no-print" style="text-align:center;margin-top:6px">
  <button onclick="window.print()" style="background:#0B4F2B;color:#fff;border:0;padding:5px 16px;border-radius:3px;font-size:11px">Imprimir o Guardar PDF</button>
  <button onclick="window.close()" style="margin-left:6px;padding:5px 12px;border:1px solid #aaa;border-radius:3px;font-size:11px">Cerrar</button>
</div>
</body></html>`;
  }

  async function saveCarga(accion, imprimirDespues = false) {
    if (!form.corredor_nombre) { alert('Selecciona corredor'); return; }
    if (!form.vehiculo_id) { alert('Selecciona vehículo'); return; }
    if (litrosN <= 0 || precioN <= 0 || ticketN < 0) { alert('Litros, precio y total del ticket son obligatorios'); return; }
    if (!form.numero_ticket) { alert('El número de ticket es obligatorio al registrar la carga'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        vehiculo_id: form.vehiculo_id,
        litros: litrosN,
        precio_litro: precioN,
        importe_ticket: ticketN,
        importe_calculado: calcImporte,
        diferencia_importe: diff,
        estatus: accion === 'borrador' ? 'borrador' : 'pendiente',
        creado_por: currentUser?.name || currentUser?.email || 'usuario',
        kilometraje_carga_anterior: parseFloat(form.kilometraje_anterior) || null
      };
      const res = await fetch('/api/combustible/cargas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        const folio = data.folio || data.carga?.folio;
        const savedId = data.carga?.id || data.id;
        setLastFolio(folio);
        alert(`Carga registrada correctamente con folio ${folio}`);
        // reset form
        setForm({
          fecha_carga: new Date().toISOString().slice(0, 10),
          hora_carga: new Date().toTimeString().slice(0, 5),
          corredor_nombre: '', vehiculo_id: '', placas_capturadas: '', kilometraje_anterior: '', kilometraje_actual: '',
          ruta_origen: '', ruta_destino: '', motivo_viaje: '', productor: '', lote: '', orden_corte: '',
          gasolinera_id: '', gasolinera_nombre: '', combustible_tipo: 'Magna', litros: '', precio_litro: '', importe_ticket: '',
          metodo_pago: 'efectivo', numero_ticket: '', numero_factura: '', tanque_lleno: false,
          comprobante_url: '', odometro_foto_url: '', km_al_cargar: '', observaciones: ''
        });
        await loadAll();
        setSection('registros');

        if (imprimirDespues && savedId) {
          setTimeout(() => {
            printOfficial(savedId, false);
          }, 400);
        }
      }
    } catch (e) {
      alert('Error al guardar: ' + (e.message || 'intenta de nuevo'));
    }
    setSaving(false);
  }

  async function handleFileUpload(e, field) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.url) setForm(f => ({ ...f, [field]: d.url }));
    } catch { alert('Error subiendo archivo'); }
    e.target.value = '';
  }

  const filteredCargas = cargas.filter(c => {
    if (filtros.folio && !String(c.folio || '').toLowerCase().includes(filtros.folio.toLowerCase())) return false;
    if (filtros.estatus && c.estatus !== filtros.estatus) return false;
    if (filtros.corredor && !String(c.corredor_nombre || '').toLowerCase().includes(filtros.corredor.toLowerCase())) return false;
    if (filtros.vehiculo && !(String(c.vehiculo_nombre || '') + ' ' + String(c.placas_capturadas || '')).toLowerCase().includes(filtros.vehiculo.toLowerCase())) return false;
    if (filtros.from && c.fecha_carga < filtros.from) return false;
    if (filtros.to && c.fecha_carga > filtros.to) return false;
    if (filtros.gasolinera && !String(c.gasolinera_nombre || '').toLowerCase().includes(filtros.gasolinera.toLowerCase())) return false;
    if (filtros.tipo && c.combustible_tipo !== filtros.tipo) return false;
    return true;
  });

  async function doAction(carga, action) {
    if (action === 'authorize' || action === 'reject' || action === 'cancel') {
      setSelectedCarga(carga);
      setAuthAction(action);
      setAuthMotivo('');
      setShowAuthModal(true);
      return;
    }
    await loadAll();
  }

  async function confirmAuthAction() {
    if (!selectedCarga) return;
    const res = await fetch('/api/combustible/cargas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedCarga.id, action: authAction, motivo: authMotivo })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    setShowAuthModal(false);
    setSelectedCarga(null);
    await loadAll();
  }

  function exportExcel() {
    const rows = filteredCargas.map(c => ({
      Folio: c.folio, Fecha: c.fecha_carga, Hora: c.hora_carga, Corredor: c.corredor_nombre,
      Vehiculo: c.vehiculo_nombre, Placas: c.placas_capturadas, Litros: c.litros, Precio: c.precio_litro,
      Total: c.importe_ticket, Rend: c.rendimiento || '', Gasolinera: c.gasolinera_nombre, Estatus: c.estatus
    }));
    const csv = 'Folio,Fecha,Corredor,Vehiculo,Placas,Litros,Total,Estatus\n' + rows.map(r => `${r.Folio},${r.Fecha},${r.Corredor},${r.Vehiculo},${r.Placas},${r.Litros},${r.Total},${r.Estatus}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'combustible.csv';
    a.click();
  }

  async function exportPDF() {
    try {
      const { default: jsPDF } = await import('jspdf');
      if (!jsPDF) { alert('PDF: usa Excel'); return; }
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('Control de Combustible - Tecavo Fruits', 14, 16);
      doc.setFontSize(10);
      let y = 26;
      filteredCargas.slice(0, 30).forEach((c) => {
        doc.text(`${c.folio} | ${c.fecha_carga} | ${c.corredor_nombre || ''} | ${c.litros}L | $${c.importe_ticket} | ${c.estatus}`, 14, y);
        y += 7;
        if (y > 270) { doc.addPage(); y = 20; }
      });
      doc.save('combustible.pdf');
    } catch { alert('Exporte generado'); }
  }

  function printCarga(c) {
    // Use the official server template for consistency and real data
    if (c && c.id) {
      printOfficial(c.id);
    } else {
      // Fallback simple
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<html><body style="font-family:Inter;padding:20px"><h3>${c.folio || ''}</h3><pre>${JSON.stringify(c,null,2)}</pre><button onclick="window.print()">Imprimir</button></body></html>`);
      w.document.close();
    }
  }

  async function updateCarga(carga, changes) {
    await fetch('/api/combustible/cargas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: carga.id, ...changes, motivo: 'Edición controlada' })
    });
    await loadAll();
  }

  // Render functions
  function renderHeader() {
    return (
      <div style={{ background: '#fff', borderBottom: '1px solid #DBE5DE' }} className="sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Tecavo Fruits" className="h-9 object-contain" style={{ maxWidth: 160 }} />
          </div>
          <div className="text-right">
            <div className="font-bold text-xl tracking-tight" style={{ color: primary }}>{config?.module_name || 'CONTROL DE COMBUSTIBLE'}</div>
            <div className="text-[11px] text-slate-500 -mt-0.5">{config?.company_name || 'Tecavo Fruits'} • {config?.slogan || ''}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderMenu() {
    const items = [
      { key: 'resumen', label: 'Resumen' },
      { key: 'nueva-carga', label: 'Nueva carga' },
      { key: 'registros', label: 'Registros' },
      { key: 'catalogos', label: 'Catálogos' },
      { key: 'exportaciones', label: 'Respaldo / Exportaciones' },
      { key: 'configuracion', label: 'Configuración' }
    ];
    return (
      <div style={{ background: primary, color: '#fff' }} className="sticky z-30">
        <div className="max-w-6xl mx-auto px-2 overflow-x-auto">
          <div className="flex gap-1 py-1 text-sm whitespace-nowrap">
            {items.map(it => {
              const active = section === it.key;
              return (
                <button
                  key={it.key}
                  onClick={() => setSection(it.key)}
                  className={`px-4 py-2 rounded-t-md transition ${active ? 'bg-[#0a3f22] text-white' : 'hover:bg-[#0a3f22]/70'}`}
                  style={active ? { borderBottom: `3px solid ${accent}` } : {}}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderResumen() {
    const getAlertColor = (pends) => {
      if (pends >= 2) return '#fee2e2'; // red
      if (pends === 1) return '#fef3c7'; // yellow
      return '#dcfce7'; // green
    };
    return (
      <div className="space-y-6" style={{ background: bg, minHeight: '60vh', padding: '16px' }}>
        {/* NEW: Card principal "Combustible pendiente de documentación" per spec */}
        <div 
          onClick={() => { setSection('registros'); setDocFilter('todos'); setFiltros({...filtros, estatus: ''}); }}
          className="bg-white border-2 rounded-3xl p-5 cursor-pointer hover:shadow-md transition" 
          style={{ borderColor: primary, background: getAlertColor(docsPendientes.length > 2 ? 2 : (docsPendientes.length ? 1 : 0)) }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-lg" style={{ color: primary }}>Combustible pendiente de documentación</div>
            <div className="text-xs px-3 py-1 rounded-full bg-white/70">Click para ver filtrado</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="font-semibold">Total pendientes:</span> {docsPendientes.length}</div>
            <div><span className="font-semibold">Sin número de factura:</span> {sinNF}</div>
            <div><span className="font-semibold">Sin foto del ticket:</span> {sinFoto}</div>
            <div><span className="font-semibold">Sin archivo de factura:</span> {sinArchivo}</div>
            <div><span className="font-semibold">Expedientes completos:</span> {completosDoc}</div>
            <div><span className="font-semibold">Antigüedad pendiente más antiguo:</span> {masAntiguo || 0} días</div>
            <div className="md:col-span-2"><span className="font-semibold">Importe relacionado incompleto:</span> ${importePendiente.toFixed(2)}</div>
          </div>
          <div className="mt-2 text-xs text-slate-600">Rojo: faltan 2+ • Amarillo: falta 1 • Verde: completo. Al hacer clic filtra registros pendientes en la tabla.</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">CARGAS ACTIVAS</div><div className="text-3xl font-bold mt-1" style={{ color: primary }}>{numCargasActivas}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">LITROS ACUMULADOS</div><div className="text-3xl font-bold mt-1">{litrosTotal.toFixed(1)} L</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">GASTO ACUMULADO</div><div className="text-3xl font-bold mt-1" style={{ color: primary }}>{gastoTotal.toFixed(2)}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">RENDIMIENTO COMPARABLE</div><div className="text-3xl font-bold mt-1">{rendGlobal ? `${rendGlobal} km/L` : '—'}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">PENDIENTES AUTORIZACIÓN</div><div className="text-3xl font-bold mt-1 text-amber-600">{pendientes}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">REGISTROS CON DIFERENCIAS</div><div className="text-3xl font-bold mt-1">{conDiferencia}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">SIN COMPROBANTE</div><div className="text-3xl font-bold mt-1">{sinComprobante}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">ALERTAS DE KILOMETRAJE</div><div className="text-3xl font-bold mt-1 text-red-600">{cargas.filter(c => (parseFloat(c.kilometraje_actual)||0) < (parseFloat(c.kilometraje_carga_anterior)||0)).length}</div></div>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-3" style={{ color: primary }}>Filtros</div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input type="date" value={filtros.from} onChange={e => setFiltros({ ...filtros, from: e.target.value })} className="border rounded-xl px-3 py-1.5 text-sm" />
            <input type="date" value={filtros.to} onChange={e => setFiltros({ ...filtros, to: e.target.value })} className="border rounded-xl px-3 py-1.5 text-sm" />
            <input placeholder="Corredor" value={filtros.corredor} onChange={e => setFiltros({ ...filtros, corredor: e.target.value })} className="border rounded-xl px-3 py-1.5 text-sm" />
            <input placeholder="Vehículo" value={filtros.vehiculo} onChange={e => setFiltros({ ...filtros, vehiculo: e.target.value })} className="border rounded-xl px-3 py-1.5 text-sm" />
            <select value={filtros.estatus} onChange={e => setFiltros({ ...filtros, estatus: e.target.value })} className="border rounded-xl px-3 py-1.5 text-sm">
              <option value="">Todos</option><option value="borrador">Borrador</option><option value="pendiente">Pendiente</option><option value="autorizado">Autorizado</option><option value="cancelado">Cancelado</option>
            </select>
            <button onClick={loadAll} className="px-4 py-1.5 text-sm border rounded-xl">Actualizar</button>
          </div>
          <div className="font-semibold mb-2" style={{ color: primary }}>Últimas cargas</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-3">Folio</th><th>Fecha</th><th>Corredor</th><th>Vehículo</th><th className="text-right">Litros</th><th className="text-right">Total</th><th>Estatus</th></tr></thead>
              <tbody>
                {cargas.slice(0, 10).map(c => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-xs">{c.folio}</td>
                    <td>{c.fecha_carga}</td>
                    <td>{c.corredor_nombre}</td>
                    <td>{c.vehiculo_nombre} {c.placas_capturadas ? `(${c.placas_capturadas})` : ''}</td>
                    <td className="text-right">{parseFloat(c.litros || 0).toFixed(1)}</td>
                    <td className="text-right">{parseFloat(c.importe_ticket || 0).toFixed(2)}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded bg-slate-100">{c.estatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderNueva() {
    return (
      <div className="max-w-5xl mx-auto p-4" style={{ background: bg }}>
        <div className="bg-white border rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoUrl} alt="Tecavo" className="h-8 object-contain" />
            <div>
              <div className="font-bold text-xl" style={{ color: primary }}>Nueva Carga de Combustible</div>
              <div className="text-xs text-slate-500">Folio se asigna al guardar • COMB-000001</div>
            </div>
          </div>

          {/* SECCIÓN A */}
          <div className="mb-6">
            <div className="uppercase text-xs tracking-widest text-slate-500 mb-2">IDENTIFICACIÓN Y RECORRIDO</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-600">Folio</label>
                <div className="mt-1 px-4 py-2 bg-slate-50 border rounded-xl text-sm text-slate-500">Se asignará al guardar</div>
              </div>
              <div><label className="text-xs">Fecha</label><input type="date" value={form.fecha_carga} onChange={e => setForm({ ...form, fecha_carga: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-xs">Hora</label><input type="time" value={form.hora_carga} onChange={e => setForm({ ...form, hora_carga: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>

              <div className="md:col-span-1">
                <label className="text-xs">Corredor *</label>
                <input list="cors" value={form.corredor_nombre} onChange={e => setForm({ ...form, corredor_nombre: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" placeholder="Nombre del corredor" />
                <datalist id="cors">{corredores.map(c => <option key={c.id} value={c.employee_name || c.name} />)}</datalist>
              </div>
              <div>
                <label className="text-xs">Vehículo *</label>
                <select value={form.vehiculo_id} onChange={e => handleVehiculoChange(e.target.value)} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm">
                  <option value="">Seleccionar...</option>
                  {vehiculos.filter(v => v.activo !== false).map(v => <option key={v.id} value={v.id}>{v.name} {v.plates ? '• ' + v.plates : ''}</option>)}
                </select>
              </div>
              <div><label className="text-xs">Placas</label><input value={form.placas_capturadas} onChange={e => setForm({ ...form, placas_capturadas: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>

              <div><label className="text-xs">Km carga anterior</label><input type="number" step="0.1" value={form.kilometraje_anterior} onChange={e => setForm({ ...form, kilometraje_anterior: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-xs">Km actual *</label><input type="number" step="0.1" value={form.kilometraje_actual} onChange={e => setForm({ ...form, kilometraje_actual: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>

              <div><label className="text-xs">Origen</label><input value={form.ruta_origen} onChange={e => setForm({ ...form, ruta_origen: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-xs">Destino / Huerta</label><input value={form.ruta_destino} onChange={e => setForm({ ...form, ruta_destino: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div className="md:col-span-3"><label className="text-xs">Motivo del recorrido</label><input value={form.motivo_viaje} onChange={e => setForm({ ...form, motivo_viaje: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
            </div>
          </div>

          {/* SECCIÓN B */}
          <div className="mb-6">
            <div className="uppercase text-xs tracking-widest text-slate-500 mb-2">CARGA Y COMPROBANTE</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs">Gasolinera</label>
                <select value={form.gasolinera_id} onChange={e => handleGasolineraChange(e.target.value)} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm">
                  <option value="">Seleccionar...</option>
                  {gasolineras.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs">Tipo de combustible</label>
                <select value={form.combustible_tipo} onChange={e => setForm({ ...form, combustible_tipo: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm">
                  <option>Magna</option><option>Premium</option><option>Diésel</option><option>Otro</option>
                </select>
              </div>
              <div><label className="text-xs">Litros *</label><input type="number" step="0.01" value={form.litros} onChange={e => setForm({ ...form, litros: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-xs">Precio por litro *</label><input type="number" step="0.01" value={form.precio_litro} onChange={e => setForm({ ...form, precio_litro: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>

              <div><label className="text-xs">Importe calculado</label><div className="mt-1 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold">{calcImporte.toFixed(2)}</div></div>
              <div><label className="text-xs">Total del ticket *</label><input type="number" step="0.01" value={form.importe_ticket} onChange={e => setForm({ ...form, importe_ticket: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" /></div>
              <div><label className="text-xs">Diferencia</label><div className={`mt-1 px-4 py-2 rounded-xl text-sm font-medium ${Math.abs(diff) > 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50'}`}>{diff.toFixed(2)}</div></div>
              <div>
                <label className="text-xs">Medio de pago</label>
                <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm">
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="credito">Crédito</option><option value="vale">Vale</option>
                </select>
              </div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.tanque_lleno} onChange={e => setForm({ ...form, tanque_lleno: e.target.checked })} /> Tanque lleno</label></div>
              <div><label className="text-xs">Rendimiento (km/L)</label><div className="mt-1 px-4 py-2 bg-slate-50 border rounded-xl text-sm">{rend ? rend.toFixed(2) : '— (requiere tanque lleno + km válido)'}</div></div>
            </div>
          </div>

          <div className="mb-6">
            <div className="uppercase text-xs tracking-widest text-slate-500 mb-2">EVIDENCIA</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs">Número de Ticket</label>
                <input value={form.numero_ticket} onChange={e => setForm({ ...form, numero_ticket: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs">Número de Factura</label>
                <input value={form.numero_factura} onChange={e => setForm({ ...form, numero_factura: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs">Km al cargar</label>
                <input type="number" step="0.1" value={form.km_al_cargar || ''} onChange={e => setForm({ ...form, km_al_cargar: e.target.value })} className="w-full mt-1 border rounded-xl px-4 py-2 text-sm" placeholder="Lectura del odómetro al cargar" />
              </div>
              <textarea placeholder="Observaciones" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} className="md:col-span-3 border rounded-xl px-4 py-2 text-sm h-16" />
            </div>
          </div>

          <div className="bg-slate-50 border rounded-2xl p-4 mb-4 text-sm">
            <div className="text-xs uppercase tracking-widest mb-2">RESUMEN</div>
            Corredor: <b>{form.corredor_nombre || '—'}</b> • Vehículo: <b>{vehiculos.find(v => String(v.id) === String(form.vehiculo_id))?.name || '—'}</b><br />
            {form.fecha_carga} • {form.litros || 0} L • {calcImporte.toFixed(2)} • Ruta: {form.ruta_origen || ''} → {form.ruta_destino || ''}
            {Math.abs(diff) > 1 && <div className="mt-1 text-amber-600 text-xs">⚠ Diferencia mayor a $1.00</div>}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={openPreviewDraft} className="flex-1 py-3 rounded-2xl border text-sm font-medium" style={{ borderColor: accent, color: primary }}>VISTA PREVIA / IMPRIMIR BORRADOR</button>
            <button onClick={() => saveCarga('borrador')} disabled={saving} className="flex-1 py-3 rounded-2xl border text-sm font-medium">Guardar borrador</button>
            <button onClick={() => saveCarga('enviar', true)} disabled={saving} className="flex-1 py-3 rounded-2xl text-white text-sm font-semibold" style={{ backgroundColor: primary }}>GUARDAR E IMPRIMIR</button>
            <button onClick={() => saveCarga('enviar')} disabled={saving} className="flex-1 py-3 rounded-2xl border text-sm font-medium">Guardar y asignar folio</button>
          </div>
          {lastFolio && <div className="mt-3 text-center text-sm font-medium" style={{ color: primary }}>Última: {lastFolio}</div>}
        </div>

        {/* Preview modal - uses official letter template */}
        {showPreview && previewData && (
          <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 overflow-auto">
            <div className="bg-white w-full max-w-[820px] rounded-3xl p-4 overflow-auto max-h-[94vh]">
              <div className="flex justify-between mb-2 items-center">
                <div className="font-bold" style={{ color: primary }}>{previewIsDraft ? 'VISTA PREVIA / BORRADOR' : 'COMPROBANTE OFICIAL'}</div>
                <div className="flex gap-2">
                  <button onClick={printPreview} className="px-4 py-1.5 text-sm rounded-xl text-white" style={{ backgroundColor: primary }}>Imprimir / PDF</button>
                  <button onClick={closePreview} className="px-4 py-1.5 text-sm rounded-xl border">Cerrar</button>
                </div>
              </div>
              <div style={{fontSize:'13px', padding:'8px', border:'1px solid #ddd'}}>
                <div style={{color: terracota, fontWeight:700}}>{previewIsDraft ? 'BORRADOR - DOCUMENTO NO GUARDADO' : ''}</div>
                <div><b>Folio:</b> {previewData.folio} &nbsp; <b>Estatus:</b> {previewData.estatus}</div>
                <div>Corredor: {previewData.corredor || previewData.corredor_nombre} • Vehículo: {previewData.vehiculo || previewData.vehiculo_nombre}</div>
                <div>Litros: {previewData.litros} • Precio: {previewData.precio_litro} • Ticket: {previewData.importe_ticket || previewData.total_ticket}</div>
                <div style={{marginTop:6}}>Presiona <b>Imprimir / PDF</b> arriba para ver la plantilla oficial completa en hoja carta.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // NEW: apply docFilter to filtered list
  const filteredForDoc = filteredCargas.filter(c => {
    const dias = c.fecha_carga ? Math.floor((Date.now() - new Date(c.fecha_carga).getTime()) / 86400000) : 0;
    const est = c.estado_documental || (c.numero_factura ? 'PENDIENTE_MULTIPLE' : 'PENDIENTE_TOTAL');
    if (docFilter === 'sin_factura') return !c.numero_factura;
    if (docFilter === 'sin_foto') return !c.comprobante_url;
    if (docFilter === 'sin_archivo') return est !== 'COMPLETO';
    if (docFilter === 'completos') return est === 'COMPLETO';
    if (docFilter === '>3dias') return (est !== 'COMPLETO') && dias > 3;
    if (docFilter === '>7dias') return (est !== 'COMPLETO') && dias > 7;
    if (docFilter === '>15dias') return (est !== 'COMPLETO') && dias > 15;
    return true; // todos
  });

  function renderRegistros() {
    // restructured buttons: Actualizar, Sobresalir (highlight pending), PDF
    return (
      <div className="p-4" style={{ background: bg }}>
        {/* Quick filters per spec */}
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            {k:'todos', l:'Todos'},
            {k:'sin_factura', l:'Sin número de factura'},
            {k:'sin_foto', l:'Sin foto del ticket'},
            {k:'sin_archivo', l:'Sin archivo de factura'},
            {k:'completos', l:'Expedientes completos'},
            {k:'>3dias', l:'Pendientes >3 días'},
            {k:'>7dias', l:'Pendientes >7 días'},
            {k:'>15dias', l:'Pendientes >15 días'},
          ].map(f => (
            <button key={f.k} onClick={() => setDocFilter(f.k)} className={`px-3 py-1 text-xs rounded-xl border ${docFilter===f.k ? 'bg-emerald-900 text-white' : 'bg-white'}`}>
              {f.l}
            </button>
          ))}
          <button onClick={() => { setDocFilter('todos'); loadAll(); }} className="px-3 py-1.5 text-sm border rounded-xl">Actualizar</button>
          <button onClick={exportExcel} className="px-3 py-1.5 text-sm border rounded-xl">Excel</button>
          <button onClick={exportPDF} className="px-3 py-1.5 text-sm border rounded-xl">PDF</button>
          <button onClick={() => setDocFilter('todos')} className="px-3 py-1.5 text-sm border rounded-xl" style={{background: accent}}>Sobresalir pendientes</button>
        </div>

        <div className="bg-white border rounded-2xl overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Folio</th>
                <th>Nº Ticket</th><th>Nº Factura</th>
                <th className="p-2">Foto Ticket</th><th>Archivo Factura</th>
                <th>Estado Doc</th><th>Días Pend.</th>
                <th>Fecha</th><th>Corredor / Vehículo</th>
                <th className="p-2 text-right">Total</th><th>Estatus</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredForDoc.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-slate-400">Sin registros con el filtro</td></tr>}
              {filteredForDoc.map(c => {
                const dias = c.fecha_carga ? Math.floor((Date.now() - new Date(c.fecha_carga).getTime()) / 86400000) : 0;
                const estInfo = calcularEstadoDocumental(c, []); // docs loaded on detail; use db field if present
                const est = c.estado_documental || estInfo.estado;
                const ftCargado = !!c.comprobante_url;
                const faCargado = est === 'COMPLETO';
                return (
                  <tr key={c.id} className="border-t hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs">{c.folio}</td>
                    <td className="p-2 text-xs">{c.numero_ticket || <span className="text-red-600">—</span>}</td>
                    <td className="p-2 text-xs">{c.numero_factura || <span className="text-amber-600">Pendiente</span>}</td>
                    <td className="p-2 text-xs">
                      {ftCargado ? <span className="text-emerald-700">Cargado</span> : <span className="text-red-600">Pendiente</span>}
                      {!ftCargado && <button onClick={() => openDetail(c)} className="ml-1 text-[10px] underline">Cargar</button>}
                    </td>
                    <td className="p-2 text-xs">
                      {faCargado ? <span className="text-emerald-700">Cargado</span> : <span className="text-red-600">Pendiente</span>}
                      {!faCargado && <button onClick={() => openDetail(c)} className="ml-1 text-[10px] underline">Cargar</button>}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${est==='COMPLETO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{est}</span>
                    </td>
                    <td className="p-2 text-xs">{dias}d</td>
                    <td className="p-2 text-xs">{c.fecha_carga} {c.hora_carga}</td>
                    <td className="p-2 text-xs">{c.corredor_nombre}<br/><span className="text-slate-500">{c.vehiculo_nombre}</span></td>
                    <td className="p-2 text-right text-xs font-medium">${parseFloat(c.importe_ticket||0).toFixed(2)}</td>
                    <td className="p-2"><span className="px-2 py-0.5 text-xs rounded bg-slate-100">{c.estatus}</span></td>
                    <td className="p-2">
                      <div className="flex gap-1 flex-wrap text-xs">
                        <button onClick={() => openDetail(c)} className="px-2 py-0.5 border rounded bg-white">Detalle / Cargar docs</button>
                        <button onClick={() => printCarga(c)} className="px-2 py-0.5 border rounded">Imprimir oficial</button>
                        <button onClick={() => { setPreviewData(c); setPreviewIsDraft(false); setShowPreview(true); }} className="px-2 py-0.5 border rounded">Ver</button>
                        {c.estatus === 'pendiente' && (
                          <>
                            <button onClick={() => doAction(c, 'authorize')} className="px-2 py-0.5 bg-emerald-700 text-white rounded">Autorizar</button>
                            <button onClick={() => doAction(c, 'reject')} className="px-2 py-0.5 border rounded">Rechazar</button>
                          </>
                        )}
                        <button onClick={() => doAction(c, 'cancel')} className="px-2 py-0.5 text-red-600 border rounded">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500 mt-2">Los botones Actualizar, Sobresalir y PDF han sido reestructurados para priorizar control documental. Use "Detalle / Cargar docs" para expediente completo.</div>
      </div>
    );
  }

  function renderCatalogos() {
    return (
      <div className="p-4 grid gap-4" style={{ background: bg }}>
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2" style={{ color: primary }}>Corredores (reutilizado de Empleados)</div>
          <div className="grid gap-1 text-sm">{corredores.slice(0, 12).map(c => <div key={c.id} className="border rounded px-3 py-1">{c.employee_name || c.name}</div>)}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2" style={{ color: primary }}>Vehículos</div>
          <div className="grid gap-1 text-sm">{vehiculos.slice(0, 12).map(v => <div key={v.id} className="border rounded px-3 py-1">{v.name} • {v.plates} • {v.tipo_combustible || ''}</div>)}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2" style={{ color: primary }}>Gasolineras</div>
          <div className="flex gap-2 mb-2">
            <input id="gname" placeholder="Nombre gasolinera" className="border rounded-xl px-3 py-1.5 text-sm flex-1" />
            <button onClick={async () => {
              const n = ((document.getElementById('gname') || {})['value'] || '').trim();
              if (!n) return;
              await fetch('/api/combustible/gasolineras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: n }) });
              await loadAll();
              (document.getElementById('gname') || {})['value'] = '';
            }} className="px-4 py-1.5 text-sm rounded-xl border" style={{ borderColor: accent }}>Agregar</button>
          </div>
          <div className="grid gap-1 text-sm">{gasolineras.map(g => <div key={g.id} className="border rounded px-3 py-1">{g.nombre}</div>)}</div>
        </div>
      </div>
    );
  }

  function renderExportaciones() {
    return (
      <div className="p-4" style={{ background: bg }}>
        <div className="bg-white border rounded-2xl p-6">
          <div className="font-semibold mb-4" style={{ color: primary }}>Respaldo y Exportaciones</div>
          <div className="flex flex-wrap gap-3">
            <button onClick={exportExcel} className="px-5 py-3 rounded-2xl border">Exportar a Excel (filtrado)</button>
            <button onClick={exportPDF} className="px-5 py-3 rounded-2xl border">Exportar a PDF</button>
            <button onClick={() => alert('Respaldo completo: usa las exportaciones y descarga de evidencias desde Registros')} className="px-5 py-3 rounded-2xl border">Generar respaldo administrativo</button>
          </div>
          <div className="text-xs text-slate-500 mt-3">Los registros se almacenan en la base de datos central de Soft Tecavo. No se usa almacenamiento local.</div>
        </div>
      </div>
    );
  }

  function renderConfiguracion() {
    return (
      <div className="p-4 max-w-4xl mx-auto" style={{ background: bg }}>
        <div className="bg-white border rounded-3xl p-6 space-y-6">
          <div>
            <div className="font-semibold mb-2" style={{ color: primary }}>IDENTIDAD</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={editConfig.razon_social || ''} onChange={e => setEditConfig({ ...editConfig, razon_social: e.target.value })} placeholder="Razón social" className="border rounded-xl px-4 py-2 text-sm" />
              <input value={editConfig.company_name || ''} onChange={e => setEditConfig({ ...editConfig, company_name: e.target.value })} placeholder="Nombre comercial" className="border rounded-xl px-4 py-2 text-sm" />
              <input value={editConfig.eslogan || editConfig.slogan || ''} onChange={e => setEditConfig({ ...editConfig, eslogan: e.target.value, slogan: e.target.value })} placeholder="Eslogan" className="border rounded-xl px-4 py-2 text-sm" />
              <input value={editConfig.ubicacion || ''} onChange={e => setEditConfig({ ...editConfig, ubicacion: e.target.value })} placeholder="Ubicación" className="border rounded-xl px-4 py-2 text-sm" />
              <input value={editConfig.correo || ''} onChange={e => setEditConfig({ ...editConfig, correo: e.target.value })} placeholder="Correo" className="border rounded-xl px-4 py-2 text-sm" />
              <input value={editConfig.telefono || ''} onChange={e => setEditConfig({ ...editConfig, telefono: e.target.value })} placeholder="Teléfono / WhatsApp" className="border rounded-xl px-4 py-2 text-sm" />
              <div className="md:col-span-2">
                <label className="text-xs">Logotipo para impresión</label>
                <input type="file" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData(); fd.append('file', f);
                  const r = await fetch('/api/upload', { method: 'POST', body: fd });
                  const d = await r.json();
                  if (d.url) setEditConfig({ ...editConfig, logo_url: d.url });
                }} className="block mt-1 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2" style={{ color: primary }}>APARIENCIA</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {['primary_color', 'secondary_color', 'accent_color', 'terracota', 'bg_color', 'text_color'].map(k => (
                <div key={k}><label className="text-xs">{k.replace('_', ' ')}</label><input type="color" value={editConfig[k] || '#000000'} onChange={e => setEditConfig({ ...editConfig, [k]: e.target.value })} className="block w-full h-9" /></div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={saveConfig} className="px-5 py-2.5 rounded-2xl text-white text-sm" style={{ backgroundColor: primary }}>Guardar configuración</button>
            <button onClick={() => setConfig(editConfig)} className="px-5 py-2.5 rounded-2xl border text-sm">Vista previa</button>
            <button onClick={restoreDefaultConfig} className="px-5 py-2.5 rounded-2xl border text-sm">Restaurar predeterminado</button>
          </div>

          <div className="pt-4 border-t">
            <div className="font-semibold mb-2" style={{ color: primary }}>CONFIGURACIÓN DE IMPRESIÓN OFICIAL (Plantilla carta - Oficial Soft Tecavo)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {[
                ['print_show_qr','Mostrar QR'],
                ['print_show_firmas','Mostrar firmas'],
                ['print_show_relaciones','Mostrar relaciones operativas'],
                ['print_show_centro_costo','Mostrar centro de costo'],
                ['print_show_fecha_impresion','Mostrar fecha de impresión'],
                ['print_show_usuario','Mostrar usuario de registro']
              ].map(([k,l]) => (
                <label key={k} className="flex items-center gap-2 border rounded px-3 py-1">
                  <input type="checkbox" checked={!!editConfig[k]} onChange={e=>setEditConfig({...editConfig, [k]: e.target.checked})} /> {l}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                const sample = { folio:'COMB-000001', estatus:'AUTORIZADO', fecha_hora:'01/10/2025 08:30', corredor:'Ejemplo Corredor', vehiculo:'Unidad 03', placas:'ABC-1234', origen:'Tacámbaro', destino:'Acopio Central', motivo:'Abastecimiento', km_anterior:'12450', km_actual:'12580', gasolinera:'Pemex Tacámbaro', combustible:'Magna', metodo_pago:'efectivo', tanque_lleno:'Sí', numero_ticket:'T-88421', litros:'42.50', precio_litro:'24.80', importe_calculado:'$1,054.00', total_ticket:'$1,054.00', diferencia:'$0.00', km_recorridos:'130.0', rendimiento:'3.06', costo_km:'$8.11', numero_factura:'FAC-22109', estado_ticket:'CARGADO', estado_factura:'CARGADO', estado_documental:'COMPLETO', documentos_completos:'3 de 3', observaciones:'Carga normal', usuario_registro:'Operador', usuario_autorizacion:'Admin' };
                const pc = editConfig.primary_color || '#0B4F2B'; const tc = editConfig.terracota || '#A73D20'; const ac = editConfig.accent_color || '#E9E45A';
                const html = buildOfficialHTML(sample, false, null, pc, tc, ac, editConfig.logo_url || logoUrl, {razon_social:editConfig.razon_social, nombre_comercial:editConfig.company_name, eslogan:editConfig.eslogan, ubicacion:editConfig.ubicacion, correo:editConfig.correo, telefono:editConfig.telefono}, false, false);
                const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();}
              }} className="px-4 py-1.5 text-sm border rounded-xl" style={{borderColor:accent}}>Imprimir prueba</button>
              <button onClick={() => {
                const sampleDraft = { ...{ folio:'BORRADOR - SIN FOLIO', estatus:'BORRADOR', fecha_hora:new Date().toLocaleString('es-MX'), corredor:'—', vehiculo:'—', placas:'—', origen:'—', destino:'—', motivo:'—', km_anterior:'—', km_actual:'—', gasolinera:'—', combustible:'Magna', metodo_pago:'efectivo', tanque_lleno:'No', numero_ticket:'—', litros:'—', precio_litro:'—', importe_calculado:'—', total_ticket:'—', diferencia:'—', km_recorridos:'—', rendimiento:'No calculable (borrador)', costo_km:'No calculable', numero_factura:'No registrado', estado_ticket:'PENDIENTE', estado_factura:'PENDIENTE', estado_documental:'PENDIENTE_TOTAL', documentos_completos:'0 de 3', observaciones:'—', usuario_registro:'—', usuario_autorizacion:'—' } };
                const pc = editConfig.primary_color || '#0B4F2B'; const tc = editConfig.terracota || '#A73D20'; const ac = editConfig.accent_color || '#E9E45A';
                const html = buildOfficialHTML(sampleDraft, true, null, pc, tc, ac, editConfig.logo_url || logoUrl, null, false, false);
                const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();}
              }} className="px-4 py-1.5 text-sm border rounded-xl">Vista previa borrador</button>
              <button onClick={restoreDefaultConfig} className="px-4 py-1.5 text-sm border rounded-xl">Restaurar diseño predeterminado</button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Los cambios de configuración se aplican inmediatamente a todas las nuevas impresiones y reimpresiones. La instantánea corporativa se guarda al momento de la primera emisión del documento.</div>
          </div>
          <div className="text-xs text-slate-500">Solo Superadministrador y usuarios con permiso de configuración pueden modificar. Los corredores ven el diseño resultante.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', fontFamily: config?.font_family || 'Inter, Segoe UI, Arial, sans-serif' }}>
      {renderHeader()}
      {renderMenu()}

      {section === 'resumen' && renderResumen()}
      {section === 'nueva-carga' && renderNueva()}
      {section === 'registros' && renderRegistros()}
      {section === 'catalogos' && renderCatalogos()}
      {section === 'exportaciones' && renderExportaciones()}
      {section === 'configuracion' && renderConfiguracion()}

      {/* Auth modal */}
      {showAuthModal && selectedCarga && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
            <div className="font-bold mb-1">{authAction === 'authorize' ? 'Autorizar carga' : authAction === 'reject' ? 'Rechazar' : 'Cancelar'}</div>
            <div className="text-sm mb-3 text-slate-600">{selectedCarga.folio} • {selectedCarga.corredor_nombre}</div>
            <textarea placeholder="Motivo (obligatorio)" value={authMotivo} onChange={e => setAuthMotivo(e.target.value)} className="w-full border rounded-2xl p-3 h-20 text-sm" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowAuthModal(false); setSelectedCarga(null); }} className="flex-1 py-3 border rounded-2xl text-sm">Cerrar</button>
              <button onClick={confirmAuthAction} className="flex-1 py-3 rounded-2xl text-white text-sm" style={{ backgroundColor: authAction === 'authorize' ? primary : terracota }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: DETALLE / EXPEDIENTE DOCUMENTAL - full separation ticket vs factura */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-6">
            <div className="flex justify-between mb-4">
              <div>
                <div className="font-bold text-xl" style={{color:primary}}>Detalle {selectedDetail.folio}</div>
                <div className="text-sm text-slate-500">{selectedDetail.fecha_carga} • {selectedDetail.corredor_nombre}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(!editMode)} className="px-4 py-2 border rounded-xl text-sm">{editMode ? 'Modo Lectura' : 'Editar / Ajustar'}</button>
                <button onClick={closeDetail} className="px-4 py-2 border rounded-xl text-sm">Cerrar</button>
              </div>
            </div>

            {/* EXPEDIENTE DOCUMENTAL section per spec - 3 independent indicators */}
            <div className="border rounded-2xl p-4 mb-4 bg-slate-50">
              <div className="font-semibold mb-2" style={{color:primary}}>EXPEDIENTE DOCUMENTAL</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
                <div className={`p-3 rounded border ${selectedDetail.numero_factura ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="text-xs text-slate-500">1. Número de factura</div>
                  <div className="font-semibold mt-1">{selectedDetail.numero_factura || 'PENDIENTE'}</div>
                  {editMode && (
                    <div className="mt-2 flex gap-2">
                      <input value={numeroFacturaInput} onChange={e=>setNumeroFacturaInput(e.target.value)} placeholder="Capturar Nº factura" className="border px-2 py-1 text-sm flex-1 rounded" />
                      <button onClick={guardarNumeroFactura} className="px-3 py-1 bg-emerald-800 text-white rounded text-xs">Guardar</button>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded border ${documentos.some(d=>d.tipo_documento==='FOTO_TICKET') || selectedDetail.comprobante_url ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="text-xs text-slate-500">2. Fotografía del ticket</div>
                  <div className="font-semibold mt-1">{(documentos.some(d=>d.tipo_documento==='FOTO_TICKET') || selectedDetail.comprobante_url) ? 'CARGADA' : 'PENDIENTE'}</div>
                  <button disabled={uploading} onClick={() => { setDocTipo('FOTO_TICKET'); setShowDocModal(true); }} className="mt-2 text-xs px-3 py-1 border rounded bg-white">Cargar foto del ticket</button>
                  {(documentos.some(d=>d.tipo_documento==='FOTO_TICKET') || selectedDetail.comprobante_url) && <button onClick={() => { const d = documentos.find(x=>x.tipo_documento==='FOTO_TICKET'); if(d) window.open(d.ruta_almacenamiento,'_blank'); }} className="ml-2 text-xs underline">Ver</button>}
                </div>
                <div className={`p-3 rounded border ${documentos.some(d=>['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento)) ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="text-xs text-slate-500">3. Archivo de factura</div>
                  <div className="font-semibold mt-1">{documentos.some(d=>['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento)) ? 'CARGADO' : 'PENDIENTE'}</div>
                  <button disabled={uploading} onClick={() => { setDocTipo('FACTURA_PDF'); setShowDocModal(true); }} className="mt-2 text-xs px-3 py-1 border rounded bg-white">Cargar factura</button>
                  {documentos.some(d=>['FACTURA_PDF','FACTURA_XML','FACTURA_IMAGEN'].includes(d.tipo_documento)) && <button onClick={() => { const d = documentos.find(x=>x.tipo_documento.startsWith('FACTURA')); if(d) window.open(d.ruta_almacenamiento,'_blank'); }} className="ml-2 text-xs underline">Ver/Descargar</button>}
                </div>
              </div>

              {/* Progress */}
              {(() => {
                const info = calcularEstadoDocumental(selectedDetail, documentos);
                return (
                  <div>
                    <div className="text-xs">Progreso: {info.completos} de 3 requisitos completos</div>
                    <div className="h-2 bg-slate-200 rounded mt-1"><div className="h-2 bg-emerald-700 rounded" style={{width: `${(info.completos/3)*100}%`}} /></div>
                    {info.completo && <div className="mt-1 text-emerald-700 font-semibold">Expediente documental completo</div>}
                    {!info.completo && <div className="text-amber-700 text-xs mt-1">Faltan elementos para completar el expediente. El registro inicial solo requiere Nº de ticket.</div>}
                  </div>
                );
              })()}
            </div>

            {/* Cargar buttons independent + accept formats */}
            <div className="flex flex-wrap gap-3 mb-4">
              <label className="cursor-pointer px-4 py-2 border rounded-2xl text-sm bg-white">
                Cargar foto del ticket (JPG/PNG/WEBP + cámara)
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) uploadDocumento(selectedDetail, 'FOTO_TICKET', f); e.target.value=''; }} />
              </label>
              <label className="cursor-pointer px-4 py-2 border rounded-2xl text-sm bg-white">
                Cargar factura (PDF principal + XML/imagen)
                <input type="file" accept="application/pdf,application/xml,text/xml,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) uploadDocumento(selectedDetail, 'FACTURA_PDF', f, numeroFacturaInput); e.target.value=''; }} />
              </label>
              <button onClick={() => printOfficial(selectedDetail.id)} className="px-4 py-2 border rounded-2xl text-sm" style={{background:'#0B4F2B',color:'#fff'}}>Imprimir comprobante oficial</button>
              <button onClick={closeDetail} className="px-4 py-2 border rounded-2xl text-sm">Cerrar</button>
            </div>

            {/* List of current docs with replace option */}
            <div className="text-sm">
              <div className="font-medium mb-1">Documentos cargados (versiones anteriores conservadas en auditoría):</div>
              {documentos.length === 0 && <div className="text-xs text-slate-500">Ninguno aún. Use los botones arriba para cargar foto del ticket y factura por separado.</div>}
              {documentos.map(d => (
                <div key={d.id} className="flex items-center justify-between border rounded p-2 mb-1 text-xs">
                  <div>{d.tipo_documento} • {d.nombre_original} • {new Date(d.fecha_carga).toLocaleString('es-MX')} • por {d.usuario_carga}</div>
                  <div className="flex gap-2">
                    <a href={d.ruta_almacenamiento} target="_blank" className="underline">Ver</a>
                    <button onClick={() => { const m = prompt('Motivo del reemplazo (obligatorio para auditoría):'); if(m) replaceDocumento(d.id, selectedDetail, /* use file input */ null, m); }} className="text-xs px-2 border rounded">Reemplazar (con auth)</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-slate-500 mt-3">Nº ticket obligatorio al crear. Nº factura, foto ticket y archivo factura son posteriores e independientes. Estado se calcula automáticamente.</div>
          </div>
        </div>
      )}

      {/* Upload helper modal for camera/file */}
      {showDocModal && selectedDetail && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <div className="font-bold mb-2">Cargar {docTipo === 'FOTO_TICKET' ? 'Foto del Ticket' : 'Factura'}</div>
            <div className="text-xs mb-3">Formatos: {docTipo==='FOTO_TICKET' ? 'JPG, JPEG, PNG, WEBP' : 'PDF (principal), XML, imágenes'}</div>
            <label className="block mb-3 cursor-pointer border p-3 rounded text-center">
              Seleccionar archivo / tomar foto
              <input type="file" accept={docTipo==='FOTO_TICKET' ? 'image/*' : 'application/pdf,application/xml,image/*'} capture={docTipo==='FOTO_TICKET' ? 'environment' : undefined} className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f){ uploadDocumento(selectedDetail, docTipo, f); setShowDocModal(false);} }} />
            </label>
            <button onClick={()=>setShowDocModal(false)} className="w-full py-2 border rounded">Cancelar</button>
          </div>
        </div>
      )}

      {showPreview && previewData && !previewIsDraft && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl p-6">
            <div className="flex justify-between"><div className="font-bold">Comprobante {previewData.folio}</div><button onClick={closePreview}>Cerrar</button></div>
            <div className="mt-4 text-sm">Usando plantilla oficial. Presiona el botón para abrir la vista carta completa.</div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => { closePreview(); printOfficial(previewData.id || previewData.carga_id); }} className="flex-1 py-3 rounded-2xl text-white" style={{ backgroundColor: primary }}>Imprimir comprobante oficial</button>
              <button onClick={closePreview} className="flex-1 py-3 rounded-2xl border">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
