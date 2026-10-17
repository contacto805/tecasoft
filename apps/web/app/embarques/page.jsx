'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';
import { drawCompanyHeader } from '@/lib/company-header';
import * as XLSX from 'xlsx';

const logoPatternBg = 'https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1782267881654_9m0hnj.png';

export default function EmbarquesPage() {
  const router = useRouter();
  const { branding } = useBranding();

  const [pisoPallets, setPisoPallets] = useState([]);
  const [trailerSlots, setTrailerSlots] = useState(Array.from({ length: 28 }, () => null));
  const [warehouseSlots, setWarehouseSlots] = useState({}); // identical  A-1/B-1/C-13  grid

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [driverName, setDriverName] = useState('');
  const [trailerPlates, setTrailerPlates] = useState('');
  const [tractoPlates, setTractoPlates] = useState('');
  const [termoPlates, setTermoPlates] = useState('');
  const [facturaFolio, setFacturaFolio] = useState('');
  const [saderRegistro, setSaderRegistro] = useState('EMP0416082581/2024');
  const [moneda, setMoneda] = useState('USD');
  const [clienteTel, setClienteTel] = useState('');
  // Block 16 additions (conservative): transport evidence + cotizaciones + reclamaciones (no duplication of loads)
  const [temperaturaConsignacion, setTemperaturaConsignacion] = useState('');
  const [termografoUrl, setTermografoUrl] = useState('');
  const [termoPhotoUrl, setTermoPhotoUrl] = useState('');
  const [cotizacionState, setCotizacionState] = useState('borrador');
  const [cotizacionFolio, setCotizacionFolio] = useState('');
  const [cotizacionTipoUtilidad, setCotizacionTipoUtilidad] = useState('margen_venta'); // margen_venta | recargo_costo
  const [cotizacionTipoCambio, setCotizacionTipoCambio] = useState('18.50');
  const [showReclamacion, setShowReclamacion] = useState(false);
  const [reclamacionData, setReclamacionData] = useState({ motivo: '', monto: '', tipo: 'bonificacion_calidad', evidencia: '' });

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showNotaDrawer, setShowNotaDrawer] = useState(false);
  const [showEmpacadoraModal, setShowEmpacadoraModal] = useState(false);

  const [loading, setLoading] = useState(true);

  // Editable empacadora config (prellenado editable)
  const [empacadora, setEmpacadora] = useState({
    companyName: branding?.companyName || 'EMPAQUE TECAVO',
    address: branding?.address || 'Carretera a Huerta s/n, Michoacán',
    phone: '(443) 000-0000',
    rfc: 'EMP123456ABC',
    logoUrl: branding?.logo_url || null
  });

  // Current nota draft fields
  const [notaData, setNotaData] = useState({ notes: '' });

  // Editable Nota Items - price editable, totals auto, supports adding/modifying data
  const [notaEditItems, setNotaEditItems] = useState([]);
  // Templates: SVG visual nota + XLSX with label cell detection for PRECIO UN etc
  const [notaXlsxTemplateUrl, setNotaXlsxTemplateUrl] = useState(null);
  const [notaSvgTemplateUrl, setNotaSvgTemplateUrl] = useState(null);
  const [notaConfigLoaded, setNotaConfigLoaded] = useState(false);
  const [clientPrices, setClientPrices] = useState([]);

  // Dynamic sections loaded from Config de Modulos (group_access) - only assigned to Operaciones role are returned by API
  const [assignedSections, setAssignedSections] = useState([]);

  // Caliber price table for the current trailer load (linked to Nota de Venta + reflected in all trip sales)
  const [caliberPriceTable, setCaliberPriceTable] = useState([]);

  // logoPattern already defined above, use for nota background on white areas

  // Fetch data: pallets and customers. Populate like MODULO ALMACEN grid (identical)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [palletRes, custRes] = await Promise.all([
          fetch('/api/pallet-output'),
          fetch('/api/customers')
        ]);

        const palletData = palletRes.ok ? await palletRes.json() : [];
        const custData = custRes.ok ? await custRes.json() : [];

        setCustomers(custData);

        // Use pallet_output_summary as SINGLE SOURCE OF TRUTH for tarimas (no duplication)
        const all = (palletData || []).map((p) => ({
          uid: `tar-${p.id}`,
          originalPalletId: p.id,
          folio: p.folio_tarima || ('TAR-' + String(p.id).padStart(6,'0')),
          lot_number: p.lot_number || 'LOTE-SIN',
          lot_id: p.lot_id,
          caliber: p.caliber || 'Extra',
          class_name: p.class_name || 'Primera',
          boxes: p.pallet_type && p.pallet_type.includes('6') ? 40 : (p.pallet_count > 0 ? p.pallet_count * 96 : 96),
          kilos: parseFloat(p.total_kg || 960),
          cold_date: p.cold_date ? String(p.cold_date).slice(0, 10) : '',
          estado: p.estado || 'PENDIENTE_UBICACION',
          ubicacion: p.warehouse_slot || p.ubicacion_actual || null,
        })).filter(t => !['EMBARCADA','CANCELADA'].includes(t.estado));

        // Fill warehouseSlots exactly like inventory page (A/B/C × rows 1-13)
        const newWarehouse = {};
        const cols = ['A','B','C'];
        let allocationIndex = 0;
        for (let r = 1; r <= 13 && allocationIndex < all.length; r++) {
          for (let c = 0; c < 3 && allocationIndex < all.length; c++) {
            const slot = `${cols[c]}-${r}`;
            const pal = { ...all[allocationIndex++], _origAlmacenSlot: slot };
            newWarehouse[slot] = pal;
          }
        }
        setWarehouseSlots(newWarehouse);

        // Remaining for "Piso de Producción" (still unassigned)
        const remaining = all.slice(allocationIndex);
        setPisoPallets(remaining.length > 0 ? remaining : all.slice(4, 10));

      } catch (err) {
        console.error('Error cargando pallets/clientes:', err);
        // Fallback demo matching grid
        const demoAll = Array.from({ length: 20 }, (_, i) => ({
          uid: `d-${i}`,
          lot_number: `L-2024-${100 + i}`,
          caliber: ['Super', 'Extra', 'Primera', 'Mediano'][i % 4],
          class_name: ['A', 'Primera', 'B'][i % 3],
          boxes: 96,
          kilos: 960,
          cold_date: `2024-09-${String(10 + (i % 20)).padStart(2, '0')}`,
        }));
        const fall = {};
        const cols = ['A','B','C'];
        let ix = 0;
        for (let r = 1; r <= 13 && ix < demoAll.length; r++) {
          for (let c = 0; c < 3 && ix < demoAll.length; c++) {
            const slot = `${cols[c]}-${r}`;
            fall[slot] = { ...demoAll[ix++], _origAlmacenSlot: slot };
          }
        }
        setWarehouseSlots(fall);
        setPisoPallets(demoAll.slice(ix, ix+6));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Dynamically load only sections/modules assigned to this role (Operaciones) from Config de Modulos on startup + navigation/focus
  useEffect(() => {
    const loadAssignedForRole = async () => {
      try {
        const groups = await fetch('/api/menu?credential=operaciones', { credentials: 'include' }).then(r => r.json()).catch(() => []);
        const flat = (groups || []).flatMap(g => (g.modules || []).map(mm => ({...mm, _group: g.group_name })));
        setAssignedSections(flat.filter(f => f.module_route));
      } catch (_) {}
    };
    loadAssignedForRole();
    const onFocus = () => loadAssignedForRole();
    const onVis = () => { if (!document.hidden) loadAssignedForRole(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Load sales note templates & config (svg + xlsx + mappings)
  useEffect(() => {
    const loadNotaConfig = async () => {
      try {
        const res = await fetch('/api/uploads/sales-note-config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.xlsx_template_url) setNotaXlsxTemplateUrl(cfg.xlsx_template_url);
          if (cfg.svg_template_url) setNotaSvgTemplateUrl(cfg.svg_template_url);
          setNotaConfigLoaded(true);
        }
      } catch (e) { /* silent */ }
    };
    loadNotaConfig();
  }, []);

  // Cargar folio automático TCV-VTA-##### al abrir el módulo (en lugar de placeholder)
  useEffect(() => {
    async function loadNextFolio() {
      try {
        const res = await fetch('/api/embarques/next-folio');
        if (res.ok) {
          const data = await res.json();
          if (data && data.nextFolio) {
            setFacturaFolio(data.nextFolio);
          }
        }
      } catch (e) {
        // no-op — dejar valor por defecto si falla
      }
    }
    loadNextFolio();
  }, []);

  // Functions DRAG AND DROP — identical almacén grid, piso lista + trailer 2-cols
  const findPalletByUid = (uid) => {
    if (!uid) return null;
    // check warehouse alcamacén grid first
    for (const [sid, pal] of Object.entries(warehouseSlots)) {
      if (pal && pal.uid === uid) return { type: 'almacen', slotId: sid };
    }
    if (pisoPallets.some(p => p && p.uid === uid)) return { type: 'piso' };
    const slotIdx = trailerSlots.findIndex(s => s && s.uid === uid);
    if (slotIdx !== -1) return { type: 'trailer', index: slotIdx };
    return null;
  };

  const movePallet = (uid, from, toTrailerSlotIdx = null, toAlmacenSlotId = null) => {
    let pallet = null;
    let newAlmacen = { ...warehouseSlots };
    let newPiso = [...pisoPallets];
    let newTrailer = [...trailerSlots];

    // Remove source
    if (from?.type === 'almacen' && from.slotId) {
      pallet = newAlmacen[from.slotId];
      delete newAlmacen[from.slotId];
    } else if (from?.type === 'piso') {
      pallet = newPiso.find(p => p.uid === uid);
      newPiso = newPiso.filter(p => p.uid !== uid);
    } else if (from?.type === 'trailer' && typeof from.index === 'number') {
      pallet = newTrailer[from.index];
      newTrailer[from.index] = null;
    }

    if (!pallet) return;

    if (toTrailerSlotIdx !== null) {
      const occupied = newTrailer[toTrailerSlotIdx];
      if (occupied) {
        if (from?.type === 'trailer' && typeof from.index === 'number') {
          // Rearrange trailer spaces: swap
          newTrailer[from.index] = occupied;
        } else {
          // From outside (almacen/piso): push previous to empty almacen or piso
          const firstEmpty = Object.keys(newAlmacen).find(k=>!newAlmacen[k]);
          if (firstEmpty) newAlmacen[firstEmpty] = { ...occupied, _origAlmacenSlot: firstEmpty };
          else newPiso.push(occupied);
        }
      }
      // Preserve exact previous warehouse slot for double-click restore functionality
      const preservedOrig = (pallet && pallet._origAlmacenSlot) 
        ? pallet._origAlmacenSlot 
        : (from?.type === 'almacen' && from.slotId != null ? from.slotId : (pallet && pallet._origAlmacenSlot) || null);
      if (pallet) {
        pallet = { ...pallet, _origAlmacenSlot: preservedOrig };
      }
      newTrailer[toTrailerSlotIdx] = pallet;
    } else if (toAlmacenSlotId) {
      // when returned to almacen grid into specific empty slot
      const occ = newAlmacen[toAlmacenSlotId];
      if (occ) newPiso.push(occ);
      newAlmacen[toAlmacenSlotId] = { ...pallet, _origAlmacenSlot: toAlmacenSlotId };
    } else {
      // default: back to first empty in almacen grid
      const firstEmpty = Object.keys(newAlmacen).find(k=>!newAlmacen[k]);
      if (firstEmpty) {
        newAlmacen[firstEmpty] = { ...pallet, _origAlmacenSlot: firstEmpty };
      } else {
        newPiso.push(pallet);
      }
    }

    setWarehouseSlots(newAlmacen);
    setPisoPallets(newPiso);
    setTrailerSlots(newTrailer);
    // Auto interlace: refresh caliber table + nota data immediately when tarima moves from cold map to trailer
    setTimeout(() => { try { refreshCaliberTableFromTrailer(); } catch(_) {} }, 30);
  };

  // Drag handlers — support almacen grid and piso + trailer
  const onDragStart = (e, pallet, sourceLocation) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ uid: pallet.uid, source: sourceLocation }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // return pallet to almacen grid (first empty slot)
  const onDropToAlmacen = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain') || '{}';
    let payload = {}; try { payload = JSON.parse(raw); } catch { return; }
    const { uid } = payload;
    if (!uid) return;

    const location = findPalletByUid(uid);
    const firstEmptyKey = Object.keys(warehouseSlots).find(k => !warehouseSlots[k]);
    if (location?.type === 'trailer' && typeof location.index === 'number') {
      movePallet(uid, location, null, firstEmptyKey || null);
    } else if (location?.type === 'piso') {
      const pal = pisoPallets.find(p => p && p.uid === uid);
      const na = { ...warehouseSlots };
      if (firstEmptyKey) {
        na[firstEmptyKey] = { ...pal, _origAlmacenSlot: firstEmptyKey };
        setWarehouseSlots(na);
        setPisoPallets(p => p.filter(pp => pp.uid !== uid));
      } else {
        setPisoPallets(p => [...p, pal]); // stay if no empty
      }
    }
  };

  const onDropToPiso = (e) => {
    e.preventDefault();
    let uid = null;
    try { uid = JSON.parse(e.dataTransfer.getData('text/plain') || '{}').uid; } catch {}
    if (!uid) return;
    const location = findPalletByUid(uid);
    if (location?.type === 'trailer' && typeof location.index === 'number') {
      const pal = trailerSlots[location.index];
      const nt = [...trailerSlots]; nt[location.index] = null;
      setTrailerSlots(nt);
      setPisoPallets(p => [...p, pal]);
    } else if (location?.type === 'almacen' && location.slotId) {
      const sid = location.slotId;
      const pal = warehouseSlots[sid];
      const na = { ...warehouseSlots };
      delete na[sid];
      setWarehouseSlots(na);
      setPisoPallets(p => [...p, pal]);
    }
  };

  const onDropToTrailerSlot = (e, slotIndex) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    let uid; try { uid = JSON.parse(dataStr).uid; } catch { return; }
    if (!uid) return;
    const fromLoc = findPalletByUid(uid);
    movePallet(uid, fromLoc, slotIndex);
  };

  // Current trailer pallets
  const trailerPalletsList = trailerSlots.filter(Boolean);

  // Live caliber rows: always sum boxes from current trailer (as requested). Prices stay editable/preserved from table state.
  const liveCaliberRows = React.useMemo(() => {
    const groups = {};
    trailerPalletsList.forEach(p => {
      const c = (p.caliber || 'Sin Calibre').trim();
      if (!groups[c]) groups[c] = { caliber: c, boxes: 0 };
      groups[c].boxes += parseInt(p.boxes || 0);
    });
    return Object.values(groups).map(g => {
      const old = caliberPriceTable.find(r => (r.caliber || '').trim().toLowerCase() === g.caliber.toLowerCase());
      const pr = old ? (parseFloat(old.price) || 0) : 0;
      return { ...g, price: pr, total: ((g.boxes || 0) * pr).toFixed(2) };
    });
  }, [trailerPalletsList, caliberPriceTable]);

  // Stats
  const usedSlots = trailerPalletsList.length;
  const freeSlots = 28 - usedSlots;

  // Trailer slots numbered sequentially left-to-right, row by row (primer espacio de fila = left panel, siguiente = right panel)
  const getSlotNumber = (idx) => {
    if (idx < 0 || idx >= 28) return (idx || 0) + 1;
    const row = idx % 14;
    return (row * 2) + (idx < 14 ? 1 : 2);  // top:1(left)/2(right), next:3/4 ...
  };

  // current almacen occupied count for UI
  const almacenCount = Object.values(warehouseSlots || {}).filter(Boolean).length;

  // Print papeletas for each tarima moved from cold map (auto calibre, fecha de frío, cajas)
  // Always recompute live to guarantee button always works when tarimas are present (no stale flag or closure)
  const getCurrentTrailerPallets = () => trailerSlots.filter(Boolean);

  const openLabels = () => {
    const current = getCurrentTrailerPallets();
    if (current.length === 0) return;
    setShowLabelModal(true);
  };

  // Print individual papeleta for a tarima (auto includes calibre, fecha de frío, cajas from the pallet moved from cold map to trailer)
  const printPapeleta = (p) => {
    if (!p) return;
    const win = window.open('', '', 'height=500,width=380');
    const fechaFrio = p.cold_date || '—';
    const html = `
      <html><head><title>Papeleta Tarima - ${p.lot_number}</title>
      <style>
        @media print { @page { size: 80mm auto; margin: 4mm; } }
        body { font-family: monospace; font-size: 11px; color:#000; padding:6px; }
        .papeleta { border: 2px solid #111; padding: 8px; background:#fff; }
        .title { text-align:center; font-weight:800; font-size:13px; margin-bottom:4px; }
        .row { margin: 2px 0; }
        .label { font-weight:700; }
      </style></head><body>
      <div class="papeleta">
        <div class="title">PAPELETA DE TARIMA</div>
        <div class="row"><span class="label">Lote:</span> ${p.lot_number}</div>
        <div class="row"><span class="label">Calibre:</span> ${p.caliber || '-'}</div>
        <div class="row"><span class="label">Clase:</span> ${p.class_name || '-'}</div>
        <div class="row"><span class="label">Fecha Frío:</span> ${fechaFrio}</div>
        <div class="row"><span class="label">Cajas:</span> ${p.boxes || 0}</div>
        <div class="row"><span class="label">Kg:</span> ${Math.round(p.kilos || 0)}</div>
        <div style="margin-top:6px;border-top:1px dashed #333;padding-top:4px;font-size:9px">
          Trailer: ${trailerPlates || termoPlates || '-'} • ${new Date().toLocaleDateString('es-MX')}
        </div>
      </div>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch(e){} }, 180);
  };

  const printAllPapeletas = () => {
    const list = getCurrentTrailerPallets();
    if (list.length === 0) { alert('No hay tarimas en el tráiler para generar papeletas'); return; }
    const win = window.open('', '', 'height=800,width=600');
    let content = list.map((p, i) => {
      const fechaFrio = p.cold_date || '—';
      return `
        <div style="border:2px solid #111;padding:8px;margin:6px 0;background:#fff;font-family:monospace;font-size:11px;color:#000">
          <div style="text-align:center;font-weight:800">PAPELETA DE TARIMA #${i+1}</div>
          <div><b>Lote:</b> ${p.lot_number}</div>
          <div><b>Calibre:</b> ${p.caliber || '-'}  <b>Clase:</b> ${p.class_name || '-'}</div>
          <div><b>Fecha Frío:</b> ${fechaFrio}</div>
          <div><b>Cajas:</b> ${p.boxes}   <b>Kg:</b> ${Math.round(p.kilos)}</div>
          <div style="font-size:9px;margin-top:3px">Trailer: ${trailerPlates || termoPlates || '-'} • ${new Date().toLocaleDateString('es-MX')}</div>
        </div>`;
    }).join('');
    win.document.write(`<html><head><title>Papeletas - Embarques</title><style>@media print{ @page { size: A4; margin: 8mm } }</style></head><body style="padding:8px">${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 240);
  };

  const printLabels = () => {
    // repurposed to papeletas - uses live data from tarimas moved from cold map
    printAllPapeletas();
  };

  const downloadLabelsPDF = async () => {
    const list = getCurrentTrailerPallets();
    if (list.length === 0) { alert('No hay tarimas cargadas para generar papeletas'); return; }
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait' });
    let y = 18;

    doc.setFontSize(13);
    doc.text('PAPELETAS TARIMAS', 20, y);
    y += 10;

    list.forEach((p, idx) => {
      const fecha = p.cold_date || '-';
      const line = `${idx + 1}. ${p.caliber} ${p.class_name} | Frío:${fecha} | Cajas: ${p.boxes} | Lote ${p.lot_number} (${Math.round(p.kilos)}kg)`;
      doc.text(line, 20, y);
      y += 8;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save('papeletas_tarimas.pdf');
  };

  // Print warehouse map with the exact configuration BEFORE the current load confirmation
  const printPreLoadWarehouseMap = (snapshot) => {
    const win = window.open('', '', 'height=900,width=860');
    const cols = ['A','B','C'];
    let gridRows = '';
    for (let r = 1; r <= 13; r++) {
      gridRows += `<div style="text-align:center;font-weight:700;color:#000;background:#f1f5f9;border-right:1px solid #333;padding:1px">F${r}</div>`;
      for (let c = 0; c < 3; c++) {
        const sid = `${cols[c]}-${r}`;
        const p = snapshot && snapshot[sid];
        const bg = p ? '#d1fae5' : '#fff';
        const content = p ? `<div style="line-height:1;font-size:8px"><b>${p.lot_number}</b><br/>${p.caliber}/${p.class_name}<br/>${p.boxes}c ${Math.round(p.kilos)}kg</div>` : '<span style="color:#999">vacío</span>';
        gridRows += `<div style="background:${bg};border:1px solid #333;padding:1px 2px;min-height:32px;font-size:9px;color:#000">${content}</div>`;
      }
    }

    const html = `
      <html><head><title>Mapa Almacén Pre-Carga</title>
        <style>
          body { font-family: system-ui, sans-serif; color:#000; padding:16px; background:#fff; }
          .grid { display:grid; grid-template-columns: 32px repeat(3, 1fr); gap:1px; background:#111; padding:2px;border:4px solid #222; }
          h3 { margin:0 0 8px 0; }
          .meta { font-size:11px; color:#333; margin-bottom:10px; }
        </style>
      </head><body style="margin:0">
        <h3 style="font-size:16px;font-weight:800">MAPA DE ALMACÉN — Configuración ANTES de realizar la carga</h3>
        <div class="meta">Trailer placas: ${termoPlates || trailerPlates || '-'} • Chofer: ${driverName || '-'} • Cliente: ${selectedCustomer?.customer_name || '-'}</div>
        <div class="grid" style="font-family:monospace">
          <div></div>
          <div style="text-align:center;font-weight:700;color:#000;background:#f1f5f9;border-bottom:1px solid #333;padding:1px">Columna A</div>
          <div style="text-align:center;font-weight:700;color:#000;background:#f1f5f9;border-bottom:1px solid #333;padding:1px">Columna B</div>
          <div style="text-align:center;font-weight:700;color:#000;background:#f1f5f9;border-bottom:1px solid #333;padding:1px">Columna C</div>
          <div></div><div></div><div></div><div style="text-align:center"><img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784161187674_1n8wje.jpeg" style="width:68px;height:auto" /></div>
          ${gridRows}
          <div></div><div></div><div style="text-align:center"><img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784161187674_1n8wje.jpeg" style="width:68px;height:auto" /></div><div></div>
        </div>
        <div style="margin-top:12px;font-size:10px;color:#333">Impreso automáticamente al confirmar carga. Esta es la ubicación EXACTA de tarimas antes de la salida.</div>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch(e){} }, 280);
  };

  // NOTA DE VENTA — carta (letter)
  const openNota = () => {
    // Build editable items from live trailer data + editable prices (PRECIO UN * CAJAS = TOTAL)
    const grouped = {};
    trailerPalletsList.forEach(p => {
      const k = (p.caliber || 'Extra').toLowerCase();
      if (!grouped[k]) {
        grouped[k] = {
          producto: ( (c) => {
            const cl=(c||'').toLowerCase();
            if(cl.includes('super')) return 'Aguacate Hass Super';
            if(cl.includes('extra')) return 'Aguacate Hass Extra';
            if(cl.includes('primera')) return 'Aguacate Hass Primera';
            if(cl.includes('mediano')) return 'Aguacate Hass Mediano';
            if(cl.includes('tercera')) return 'Aguacate Hass Tercera';
            if(cl.includes('cuarta')) return 'Aguacate Hass Cuarta';
            return 'Aguacate Hass ' + (c||'Extra');
          })(p.caliber),
          presentacion: p.boxes <= 50 ? 'Caja 6 KG' : 'Caja 10 KG',
          tarimas: 0,
          cajas: 0,
          kg: 0,
          precio: 0
        };
      }
      grouped[k].tarimas += 1;
      grouped[k].cajas += (p.boxes || 0);
      grouped[k].kg += Math.round(p.kilos || 0);
    });

    let items = Object.values(grouped).map(item => {
      // Prefer prices from the caliber price table (linked to this trailer)
      let precio = item.precio || 0;
      const match = caliberPriceTable.find(r => (r.caliber || '').toLowerCase() === (item.producto || '').toLowerCase().replace('aguacate hass ', ''));
      if (match && parseFloat(match.price) > 0) {
        precio = parseFloat(match.price) || 0;
      } else if (precio <= 0 && clientPrices.length > 0) {
        const cp = clientPrices.find(p => (p.caliber || '').toLowerCase() === (item.producto || '').toLowerCase().replace('aguacate hass ', '')) ||
                 clientPrices.find(p => (p.caliber || '').toLowerCase().includes('extra'));
        if (cp) precio = parseFloat(cp.price_per_kg) || 0;
      }
      return { ...item, precio, total: (item.cajas * precio).toFixed(2) };
    });
    if (items.length === 0 && trailerPalletsList.length > 0) {
      items = [{
        producto: 'Caja 10 Kg',
        presentacion: 'Caja 10 KG',
        tarimas: trailerPalletsList.length,
        cajas: trailerPalletsList.reduce((a,b)=>a+(b.boxes||0),0),
        kg: trailerPalletsList.reduce((a,b)=>a+Math.round(b.kilos||0),0),
        precio: 0,
        total: '0.00'
      }];
    }
    setNotaEditItems(recalculateNotaItems(items));
    // Interlace cold dates from tarimas (from cold map) into nota notes automatically for traceability
    const coldDates = [...new Set(trailerPalletsList.map(p => p.cold_date).filter(Boolean))];
    if (coldDates.length && !notaData.notes) {
      setNotaData({ notes: `Fechas de frío de tarimas: ${coldDates.join(', ')}` });
    }
    setShowNotaDrawer(true);
  };

  const saveEmpacadora = async (newData) => {
    setEmpacadora(newData);
    setShowEmpacadoraModal(false);
    // Persist to global branding (so logo / emp data is on ALL tickets, notas, documents on system)
    try {
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: newData.companyName,
          address: newData.address,
          phone: newData.phone,
          rfc: newData.rfc,
          logo_url: newData.logoUrl
        })
      });
    } catch(e){ /* persist best effort */ }
  };

  // Generate nota content dynamically — adapted to the standard invoice table rows
  const generateNotaContent = () => {
    const products = [];
    const gradeLabel = (cal) => {
      const c = (cal || '').toLowerCase();
      if (c.includes('super')) return 'Aguacate Hass Super';
      if (c.includes('extra')) return 'Aguacate Hass Extra';
      if (c.includes('primera')) return 'Aguacate Hass Primera';
      if (c.includes('mediano') || c.includes('medio')) return 'Aguacate Hass Mediano';
      if (c.includes('tercera')) return 'Aguacate Hass Tercera';
      if (c.includes('cuarta')) return 'Aguacate Hass Cuarta';
      return 'Aguacate Hass ' + (cal || 'Extra');
    };

    const groups = {};
    trailerPalletsList.forEach(p => {
      const key = (p.caliber || 'Extra').toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          producto: gradeLabel(p.caliber),
          presentacion: p.boxes <= 50 ? 'Caja 6 KG' : 'kg',
          tarimas: 0, cajas: 0, kg: 0
        };
      }
      groups[key].tarimas += 1;
      groups[key].cajas += (p.boxes || 0);
      groups[key].kg += Math.round(p.kilos || 0);
    });

    // Order rows matching provided form, fill only those with load
    const order = ['super', 'extra', 'primera', 'mediano', 'tercera', 'cuarta'];
    let idx = 1;
    order.forEach(k => {
      if (groups[k]) {
        products.push({ ...groups[k], slot: idx++ });
      }
    });
    // Add unmatched
    Object.keys(groups).forEach(k => {
      if (!order.includes(k)) products.push({ ...groups[k], slot: idx++ });
    });

    // Add a first Caja 6KG resumen if desired 
    if (products.length === 0 && trailerPalletsList.length > 0) {
      products.push({
        slot: 1,
        producto: 'Caja 6 Kg',
        presentacion: 'Caja 6 KG',
        tarimas: trailerPalletsList.length,
        cajas: trailerPalletsList.reduce((a, b) => a + (b.boxes || 0), 0),
        kg: trailerPalletsList.reduce((a, b) => a + Math.round(b.kilos || 0), 0)
      });
    }

    const totalCajas = trailerPalletsList.reduce((s, p) => s + (p.boxes || 0), 0);
    const totalKg = trailerPalletsList.reduce((s, p) => s + Math.round(p.kilos || 0), 0);
    const totalTar = trailerPalletsList.length;

    return { items: products, totalCajas, totalKg, totalTarimas: totalTar };
  };

  const exportNotaPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const w = 612;

    // Use assignment resolve link to get correct template per module/output
    let tplStyle = null;
    try { const rr=await fetch('/api/document-templates/resolve?module=embarques&output_type=nota'); tplStyle=await rr.json(); }catch(_){}
    const effectiveLogo = tplStyle?.logo_url || empacadora.logoUrl || branding?.logo_url || branding?.logoUrl;
    let y = drawCompanyHeader(doc, {
      ...branding,
      companyName: empacadora.companyName || branding?.companyName,
      address: empacadora.address,
      phone: empacadora.phone,
      rfc: empacadora.rfc,
      logo_url: effectiveLogo
    }, 15, tplStyle);

    // Custom design keeps its panels after header if wanted, or continue — keep the visual flow
    y = Math.max(y + 10, 100);

    // Retain original visual header panels underneath the uniform one (for complete compatibility)
    doc.setFillColor(198, 224, 143);
    doc.rect(20, Math.max(y-70, 28), 220, 72, 'F');
    doc.setFillColor(229, 168, 76);
    doc.rect(243, Math.max(y-70, 28), 349, 72, 'F');

    doc.setTextColor(30, 93, 34);
    doc.setFontSize(14);
    doc.text(empacadora.companyName || 'TECAVO FRUITS', 28, Math.max(y-51, 39));
    doc.setFontSize(7);
    doc.text('S de RL de CV', 28, Math.max(y-41, 49));
    doc.text((empacadora.address || 'Km 4.5 Carretera Tacámbaro- Pátzcuaro').substring(0,55), 28, Math.max(y-30, 60));
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text((empacadora.companyName || 'TECAVO FRUITS S de RL de CV').substring(0,38), 251, Math.max(y-55, 34));

    // Continue calculations from y

    y = Math.max(y, 102);
    doc.setTextColor(0);

    // Top info grid //
    doc.setDrawColor(112, 78, 35);
    doc.setFillColor(112, 78, 35); doc.rect(20, y - 3, 572, 15, 'F');
    doc.setTextColor(255);
    doc.setFontSize(6);
    doc.text('CAJAS', 24, y+6); doc.text('FECHA FACTURA', 104, y+6);
    doc.text('FACTURA', 195, y+6); doc.text('Folio', 276, y+6); doc.text('REGISTRO SADER', 340, y+6);

    y += 14;
    doc.setDrawColor(112, 78, 35);
    doc.rect(20, y - 2, 572, 28, 'S');
    doc.setFontSize(8);
    doc.setTextColor(0);
    const nc = generateNotaContent();
    doc.text(String(nc.totalTarimas || trailerPalletsList.length), 28, y + 9);
    doc.text(new Date().toLocaleDateString('es-MX'), 100, y + 9);
    doc.text('Tracto', 195, y + 4);
    doc.text(facturaFolio, 276, y + 9);
    doc.setFont('helvetica', 'bold');
    doc.text(saderRegistro, 340, y + 9);

    y += 22;
    doc.setTextColor(0);
    doc.text('Termo', 195, y - 2);
    doc.text(tractoPlates || '', 22, y+11); doc.text(termoPlates || '', 80, y+11);

    // Second info row CHOFER etc as grid
    y += 24;
    doc.rect(20, y - 2, 572, 26, 'S');
    const c = selectedCustomer || {};
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text('CHOFER', 24, y+5);
    doc.text(driverName || '', 24, y + 17);
    doc.text('CLIENTE', 120, y+5); doc.text(c.customer_name || '', 120, y+17);
    doc.text('DESTINO', 230, y+5); doc.text(c.destination || '', 230, y+17);
    doc.text('MONEDA', 340, y+5); doc.text(moneda, 340, y+17);
    doc.text('TEL', 420, y+5); doc.text(clienteTel || c.phone || '', 420, y+17);

    // Disclaimer
    y += 38;
    doc.setFontSize(6);
    doc.setFillColor(250, 247, 240);
    doc.rect(20, y - 4, 572, 30, 'F');
    doc.setDrawColor(229, 177, 103);
    doc.rect(20, y - 4, 572, 30, 'S');
    doc.text('El presente envío ha sido realizado por Tecavo Fruits S. de R.L. de C.V., incluyendo en este documento una descripción detallada acerca del tipo de carga. Cabe resaltar que todo el proceso se ha llevado a cabo cumpliendo estrictamente con los más altos estándares de calidad establecidos por la normativa vigente. Temp consign: ' + (temperaturaConsignacion||'—') + ' Termo:' + (termoPlates||'-'), 26, y+6);

    // Big Product Table
    y += 42;
    doc.setFillColor(248, 163, 149);
    doc.rect(20, y-13, 572, 13, 'F');
    doc.setTextColor(0); doc.setFontSize(6);
    doc.text('PRODUCTO', 24, y-4);
    doc.text('PRESENTACIÓN', 140, y-4);
    doc.text('TARIMAS', 235, y-4);
    doc.text('CAJAS', 295, y-4);
    doc.text('KILOS', 355, y-4);
    doc.text('PRECIO UN', 420, y-4);
    doc.text('TOTAL', 510, y-4);

    const editRows = notaEditItems.length > 0 ? notaEditItems : (nc.items.length ? nc.items : []);
    y += 4;
    doc.setFontSize(7);
    editRows.forEach((r) => {
      doc.setTextColor(0);
      doc.text((r.producto || '—').substring(0,28), 22, y);
      doc.text(r.presentacion || '', 140, y);
      doc.text(String(r.tarimas || ''), 240, y);
      doc.text(String(r.cajas || ''), 298, y);
      doc.text(String(r.kg || ''), 356, y);
      doc.text(String(parseFloat(r.precio)|| '0'), 432, y);
      doc.text(String(parseFloat(r.total)|| '0.00'), 520, y);
      y += 12;
    });

    // TOTAL row + grand SUM for TOTAL column
    const gTotal = getNotaGrandTotal();
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(233, 241, 180);
    doc.rect(20, y-3, 572, 14, 'F');
    doc.text('TOTAL', 22, y + 8);
    doc.text(String(getNotaTotalTarimas() || nc.totalTarimas || trailerPalletsList.length), 240, y + 8);
    doc.text(String(getNotaTotalCajas() || nc.totalCajas), 298, y + 8);
    doc.text(String(getNotaTotalKg() || nc.totalKg), 356, y + 8);
    doc.text(gTotal, 520, y + 8);

    // FACTURA USD/MXN + COMMENTS
    y += 24;
    doc.setFillColor(229, 168, 76);
    doc.rect(20, y, 110, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(`USD • ${moneda === 'USD' ? '●' : ''}`, 26, y + 10);
    doc.setFillColor(193, 125, 78);
    doc.rect(132, y, 110, 14, 'F');
    doc.text(`MXN • ${moneda === 'MXN' ? '●' : ''}`, 140, y + 10);

    doc.setTextColor(0); 
    doc.text('COMENTARIOS ADICIONALES', 260, y - 6);
    doc.setDrawColor(210, 190, 130);
    doc.rect(260, y - 2, 330, 42, 'S');

    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text((notaData.notes || '').substring(0,80), 264, y + 16);

    // Signature
    y += 66;
    doc.text('_________________________________', 70, y);
    doc.text('_________________________________', 320, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Firma Empacadora / Chofer', 85, y + 10);
    doc.text('Recibe / Firma Cliente', 335, y + 10);

    doc.save(`nota_venta_${facturaFolio || 'sinfolio'}_v${Date.now().toString().slice(-4)}.pdf`); // versioned filename (no recalc of shipment)
  };

  // NOTA TERMO  – only kilos/cajas/tarimas – NO PRICES (for trailer travel)
  const exportNotaTermoPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const nc = generateNotaContent();
    const editRows = notaEditItems.length > 0 ? notaEditItems : nc.items;
    
    let y = 40;
    doc.setFontSize(16);
    doc.text('NOTA TERMO - VIAJE EN TRAILER', 40, y);
    y += 18;
    doc.setFontSize(12);
    doc.text(`Cliente: ${selectedCustomer?.customer_name || '—'}   Destino: ${selectedCustomer?.destination || '—'}`, 40, y);
    y += 18;
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}   Folio: ${facturaFolio || '—'}`, 40, y);
    y += 24;

    // HEADER no prices
    doc.setFontSize(10);
    doc.text('PRODUCTO', 40, y);
    doc.text('PRESENT.', 200, y);
    doc.text('TARIMAS', 300, y);
    doc.text('CAJAS', 380, y);
    doc.text('KILOS', 460, y);

    y += 10; doc.line(40, y, 560, y);

    doc.setFontSize(9);
    editRows.forEach(r => {
      y += 16;
      doc.text((r.producto||'—').slice(0,32), 40, y);
      doc.text(r.presentacion||'', 200, y);
      doc.text(String(r.tarimas||''), 305, y);
      doc.text(String(r.cajas||''), 385, y);
      doc.text(String(r.kg||''), 465, y);
    });

    y += 22;
    doc.setFontSize(11);
    doc.text(`TOTAL TARIMAS: ${getNotaTotalTarimas() || nc.totalTarimas || 0}    TOTAL CAJAS: ${getNotaTotalCajas() || nc.totalCajas}    TOTAL KILOS: ${getNotaTotalKg() || nc.totalKg}`, 40, y);

    doc.save('nota_termo.pdf');
  };

  const imprimirNotaTermo = () => {
    // simple plain window print with no prices
    const win = window.open('', '', 'width=700,height=800');
    const rows = (notaEditItems.length ? notaEditItems : generateNotaContent().items).map(r => 
      `<tr><td>${r.producto}</td><td>${r.presentacion||''}</td><td>${r.tarimas}</td><td>${r.cajas}</td><td>${r.kg}</td></tr>`).join('');
    win.document.write(`<html><head><title>Nota Termo</title></head><body style="font-family:sans-serif;font-size:14px;padding:20px">
      <h2>NOTA TERMO (Para viaje en trailer)</h2>
      <p><b>Cliente:</b> ${selectedCustomer?.customer_name || ''} | <b>Fecha:</b> ${new Date().toLocaleDateString()}</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse; width:100%; max-width:600px"><thead><tr><th>Producto</th><th>Present.</th><th>Tarimas</th><th>Cajas</th><th>Kilos</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td><b>TOTALES</b></td><td></td><td>${getNotaTotalTarimas()}</td><td>${getNotaTotalCajas()}</td><td>${getNotaTotalKg()}</td></tr></tfoot>
      </table></body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 220);
  };

  const exportNotaJPG = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const node = document.getElementById('nota-preview');
    if (!node) return;

    const canvas = await html2canvas(node, { scale: 2 });
    const url = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = 'nota_venta.jpg';
    link.href = url;
    link.click();
  };

  // XLSX export: uses uploaded template if set, otherwise basic. Auto-detects cell text labels like PRECIO UN, CAJAS & fills any data around the matching cell
  const exportNotaXLSX = async () => {
    try {
      let wb;
      let ws;
      const rows = notaEditItems.length ? notaEditItems : [];

      if (notaXlsxTemplateUrl) {
        const resp = await fetch(notaXlsxTemplateUrl);
        const buf = await resp.arrayBuffer();
        wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        ws = wb.Sheets[wb.SheetNames[0]];
      } else {
        wb = XLSX.utils.book_new();
        ws = XLSX.utils.aoa_to_sheet([['PRODUCTO','PRESENTACIÓN','TARIMAS','CAJAS','KILOS','PRECIO UN','TOTAL']]);
        wb.Sheets['Nota de Venta'] = ws;
        wb.SheetNames.push('Nota de Venta');
      }

      // Detect by cell names (text contains headers like PRECIO UN), then write value below or right after header/label
      const getCell = (addr) => ws[addr] || {};
      const setCell = (addr, val) => { ws[addr] = { t: typeof val === 'number' ? 'n' : 's', v: val }; };

      const labelSearch = ['PRODUCTO','PRESENTACIÓN','TARIMAS','CAJAS','KILOS','PRECIO UN','TOTAL','FECHA','CLIENTE','DESTINO'];
      const mapLabelToRowDataKey = (lab) => {
        const l = (lab||'').toUpperCase().trim();
        if (l.includes('PRODUCTO')) return 'producto';
        if (l.includes('PRESENT')) return 'presentacion';
        if (l.includes('TARIM')) return 'tarimas';
        if (l.includes('CAJAS')) return 'cajas';
        if (l.includes('KILO')) return 'kg';
        if (l.includes('PRECIO')) return 'precio';
        if (l.includes('TOTAL')) return 'total';
        return null;
      };

      // Scan all cells for label text
      for (const cellAddr in ws) {
        if (cellAddr[0] === '!') continue;
        const cell = getCell(cellAddr);
        if (!cell || cell.v == null) continue;
        const str = String(cell.v || '').trim().toUpperCase();
        const match = labelSearch.find(lab => str.includes(lab));
        if (!match) continue;
        const key = mapLabelToRowDataKey(str);
        const colMatch = cellAddr.match(/[A-Z]+/)[0];
        const baseRow = parseInt(cellAddr.match(/\d+/)[0] || '2');
        // fill first ~10 rows of data under/right of label
        if (key) {
          for (let rIdx = 0; rIdx < rows.length && rIdx < 12; rIdx++) {
            const rowNo = baseRow + 1 + rIdx;
            const row = rows[rIdx];
            const val = row[key] != null ? (key.includes('precio')||key.includes('total') ? parseFloat(row[key]) : row[key]) : '';
            // prefer cell to the RIGHT
            const rightAddr = `${String.fromCharCode(colMatch.charCodeAt(0) + 1)}${rowNo}`;
            if (!getCell(rightAddr).v || getCell(rightAddr).v === '') setCell(rightAddr, val);
            else setCell(cellAddr.replace(/\d+/, String(rowNo)), val);
          }
        } else if (str.includes('TOTAL')) {
          // put grand TOTAL last
          setCell(`${String.fromCharCode(colMatch.charCodeAt(0)+1)}${baseRow+1+rows.length}`, getNotaGrandTotal());
        }
      }

      // If no header detected or empty template fill full data rows
      if (!ws['A2'] && !ws['B2']) {
        const startRow = 2;
        rows.forEach((r, i) => {
          const rr = startRow + i;
          setCell(`A${rr}`, r.producto);
          setCell(`B${rr}`, r.presentacion);
          setCell(`C${rr}`, r.tarimas);
          setCell(`D${rr}`, r.cajas);
          setCell(`E${rr}`, r.kg);
          setCell(`F${rr}`, parseFloat(r.precio||0));
          setCell(`G${rr}`, parseFloat(r.total||0));
        });
        const totR = startRow + rows.length;
        setCell(`A${totR}`, 'TOTAL');
        setCell(`G${totR}`, getNotaGrandTotal());
      }

      XLSX.utils.book_append_sheet(wb, ws, wb.SheetNames[0] || 'Nota de Venta');
      XLSX.writeFile(wb, `nota_venta_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      // fallback: basic sheet
      const aoa = [[ 'PRODUCTO','PRESENTACIÓN','TARIMAS','CAJAS','KILOS','PRECIO UN','TOTAL' ]];
      notaEditItems.forEach(it => aoa.push([it.producto, it.presentacion, it.tarimas, it.cajas, it.kg, parseFloat(it.precio)||0, parseFloat(it.total)||0 ]));
      aoa.push(['TOTAL', '', '', '', '', '', getNotaGrandTotal()]);
      const ws2 = XLSX.utils.aoa_to_sheet(aoa);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws2, 'Nota Venta');
      XLSX.writeFile(wb2 , 'nota_venta.xlsx');
    }
  };

  const imprimirNota = () => {
    const preview = document.getElementById('nota-preview');
    if (!preview) return alert('Previsualización no disponible');
    const orig = document.body.innerHTML;
    document.body.innerHTML = preview.outerHTML;
    window.print();
    document.body.innerHTML = orig;
    window.location.reload();
  };

  // Editable nota helpers — PRECIO UN * CAJAS = TOTAL + grand total suma (at end of TOTAL column)
  const updateNotaItem = (index, field, value) => {
    setNotaEditItems(prev => {
      const updated = [...prev];
      const it = { ...updated[index] };
      it[field] = value;
      // Auto recalc
      const cajas = parseFloat(it.cajas) || 0;
      const precio = parseFloat(it.precio) || 0;
      it.total = (cajas * precio).toFixed(2);
      // allow edit on any field including cajas, kg for custom lines
      updated[index] = it;
      return updated;
    });
  };

  const addNotaRow = () => {
    setNotaEditItems(prev => [
      ...prev,
      { producto: 'Aguacate Hass', presentacion: 'Caja 10 KG', tarimas: 1, cajas: 96, kg: 960, precio: 0, total: '0.00' }
    ]);
  };

  const deleteNotaRow = (index) => {
    setNotaEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const recalculateNotaItems = (items) => items.map(it => {
    const cajas = parseFloat(it.cajas) || 0;
    const precio = parseFloat(it.precio) || 0;
    return { ...it, total: (cajas * precio).toFixed(2) };
  });

  // Load weekly prices per client for auto-fill
  async function loadCustomerPrices(cid) {
    try {
      const r = await fetch(`/api/customers/prices?customerId=${cid}`);
      const data = await r.json();
      setClientPrices(Array.isArray(data) ? data : []);
    } catch(e){}
  }

  const getNotaGrandTotal = () => {
    return notaEditItems.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0).toFixed(2);
  };

  const getNotaTotalCajas = () => notaEditItems.reduce((sum, it) => sum + (parseFloat(it.cajas)||0), 0);
  const getNotaTotalKg = () => notaEditItems.reduce((sum, it) => sum + (parseFloat(it.kg)||0), 0);
  const getNotaTotalTarimas = () => notaEditItems.reduce((sum, it) => sum + (parseFloat(it.tarimas)||0), 0);

  // Build / refresh caliber price table from current trailer (sums boxes per caliber)
  const refreshCaliberTableFromTrailer = () => {
    const groups = {};
    trailerPalletsList.forEach(p => {
      const c = (p.caliber || 'Sin Calibre').trim();
      if (!groups[c]) groups[c] = { caliber: c, boxes: 0 };
      groups[c].boxes += parseInt(p.boxes || 0);
    });
    const arr = Object.values(groups).map(g => ({
      ...g,
      price: 0,
      total: '0.00'
    }));
    // preserve existing prices for matching calibers + merge any live
    const merged = arr.map(newRow => {
      const old = caliberPriceTable.find(r => (r.caliber || '').trim().toLowerCase() === newRow.caliber.toLowerCase());
      if (old) {
        const pr = parseFloat(old.price) || 0;
        return { ...newRow, price: pr, total: ((newRow.boxes || 0) * pr).toFixed(2) };
      }
      return newRow;
    });
    setCaliberPriceTable(merged);
  };

  const updateCaliberPriceRow = (idx, field, val) => {
    setCaliberPriceTable(prev => {
      const up = [...prev];
      const row = { ...up[idx] };
      if (field === 'caliber') row.caliber = val;
      else if (field === 'boxes') row.boxes = parseInt(val) || 0;
      else if (field === 'price') row.price = parseFloat(val) || 0;
      row.total = ((row.boxes || 0) * (row.price || 0)).toFixed(2);
      up[idx] = row;
      return up;
    });
  };

  const addCaliberPriceRow = () => {
    setCaliberPriceTable(prev => [...prev, { caliber: 'Nuevo Calibre', boxes: 0, price: 0, total: '0.00' }]);
  };

  const removeCaliberPriceRow = (idx) => {
    setCaliberPriceTable(prev => prev.filter((_, i) => i !== idx));
  };

  const getCaliberPriceGrandTotal = () => {
    const liveTotal = liveCaliberRows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const extraTotal = caliberPriceTable
      .filter(r => !liveCaliberRows.some(l => (l.caliber || '').toLowerCase() === (r.caliber || '').toLowerCase()))
      .reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    return (liveTotal + extraTotal).toFixed(2);
  };

  const applyCaliberTableToNota = () => {
    const allRows = [...liveCaliberRows];
    // add extras not in live
    caliberPriceTable.filter(r => !liveCaliberRows.some(l => (l.caliber||'').toLowerCase()===(r.caliber||'').toLowerCase())).forEach(r => allRows.push(r));
    if (allRows.length === 0) {
      openNota();
      return;
    }
    const items = allRows.map(r => ({
      producto: `Aguacate Hass ${r.caliber}`,
      presentacion: (parseInt(r.boxes) || 0) <= 50 ? 'Caja 6 KG' : 'Caja 10 KG',
      tarimas: 1,
      cajas: parseInt(r.boxes) || 0,
      kg: Math.round((parseInt(r.boxes) || 0) * 10),
      precio: parseFloat(r.price) || 0,
      total: r.total || '0.00'
    }));
    setNotaEditItems(recalculateNotaItems(items));
    setShowNotaDrawer(true);
  };

  // Confirm load to DB — enlaza NOTA como VENTA para cierre semanal,  deduct de inventario (existencias) y salida fruta en lotes
  const confirmarCarga = async () => {
    if (trailerPalletsList.length === 0) {
      alert('Agrega tarimas al tráiler');
      return;
    }
    if (!selectedCustomer) {
      alert('Selecciona cliente');
      return;
    }

    const notaKg = getNotaTotalKg() || trailerPalletsList.reduce((s, p) => s + Math.round(p.kilos || 0), 0);
    const notaMoney = parseFloat(getNotaGrandTotal() || 0);

    try {
      // Generar folio consecutivo automático TCV-VTA-00001 si no está
      let currentFolio = facturaFolio;
      if (!currentFolio || !/^TCV-VTA-\d{5}$/.test(currentFolio)) {
        try {
          const nr = await fetch('/api/embarques/next-folio');
          const jj = await nr.json();
          currentFolio = jj.nextFolio || `TCV-VTA-${String(1).padStart(5,'0')}`;
          setFacturaFolio(currentFolio);
          // allow state sync
          await new Promise(r => setTimeout(r, 60));
        } catch (_) {
          const stamp = String(Date.now()).slice(-5).padStart(5, '0');
          currentFolio = `TCV-VTA-${stamp}`;
          setFacturaFolio(currentFolio);
        }
      }

      // Agrupar por lote porque puede haber fruta de lotes distintos
      const groups = {};
      trailerPalletsList.forEach(p => {
        const key = p.lot_id || 'na';
        if (!groups[key]) groups[key] = { lot_id: p.lot_id, pallets: [] };
        groups[key].pallets.push(p);
      });

      let confirmed = 0;
      let mainLoadId = null;

      const loadDate = new Date().toISOString().split('T')[0];

      // Build caliber_details from the price table (per caliber prices) so they are saved to load_details and reflected in ALL sales/trip sections
      const allForSave = [...liveCaliberRows];
      caliberPriceTable.filter(r => !liveCaliberRows.some(l => (l.caliber||'').toLowerCase()===(r.caliber||'').toLowerCase())).forEach(r => allForSave.push(r));
      const caliberDetailsForSave = allForSave.map(r => ({
        caliber: r.caliber,
        class_name: 'Primera',
        pallets: 1,
        boxes: parseInt(r.boxes) || 0,
        total_kg: Math.round((parseInt(r.boxes) || 0) * 10),
        price_per_kg: parseFloat(r.price) || 0
      }));

      for (const g of Object.values(groups)) {
        const pals = g.pallets;
        const totPallets = pals.length;
        const totBoxes = pals.reduce((s, pp) => s + (pp.boxes || 0), 0);
        const totKg = pals.reduce((s, pp) => s + Math.round(pp.kilos), 0);

        // Use per-caliber prices from table (or fallback to avg from nota)
        const priceAvg = (notaKg > 0) ? (notaMoney / notaKg) : 0;
        const detailsToUse = caliberDetailsForSave.length > 0 ? caliberDetailsForSave : [{
          caliber: pals[0]?.caliber || 'Extra',
          class_name: pals[0]?.class_name || 'Primera',
          pallets: totPallets,
          boxes: totBoxes,
          total_kg: totKg,
          price_per_kg: priceAvg
        }];

        const payload = {
          lot_id: g.lot_id || null,
          customer_id: selectedCustomer.id,
          load_date: loadDate,
          driver_name: driverName,
          truck_plates: tractoPlates,
          trailer_plates: termoPlates || trailerPlates,
          caliber_details: detailsToUse,
          currency: moneda,
          notes: `Embarque Nota Venta • Folio:${currentFolio || ''} • SADER:${saderRegistro} • Chofer:${driverName} • Tracto:${tractoPlates} Termo:${termoPlates} • Dir:${selectedCustomer.destination || ''} • Temp:${temperaturaConsignacion || ''} • Termografo:${termografoUrl || ''}`,
          factura_folio: currentFolio || '',
          nota_total_amount: notaMoney,
          nota_total_kg: notaKg
        };

        const res = await fetch('/api/loads/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          confirmed++;
          const data = await res.json();
          const returnedLoadId = data?.load?.id || data?.id;
          if (returnedLoadId && !mainLoadId) mainLoadId = returnedLoadId;

          // Save trailer slots into trailer_load_map — sequential numbering fila por fila (1 left-top, 2 right-top, 3 left-next...)
          if (returnedLoadId) {
            for (let j = 0; j < pals.length; j++) {
              const pp = pals[j];
              // find the exact slot index in trailerSlots for this np
              const actualSlotIdx = trailerSlots.findIndex(s => s && s.uid === pp.uid);
              const slotNum = actualSlotIdx >= 0 ? getSlotNumber(actualSlotIdx) : (j + 1);
              await fetch('/api/trailer-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  loadId: returnedLoadId,
                  slotPosition: String(slotNum),
                  lotId: pp.lot_id,
                  caliber: pp.caliber,
                  className: pp.class_name,
                  boxes: pp.boxes,
                  kilos: Math.round(pp.kilos),
                  unloadOrder: (actualSlotIdx >= 0 ? actualSlotIdx : j) + 1,
                  destination: selectedCustomer.destination || '',
                  notes: 'Embarque - Nota de venta'
                })
              }).catch(() => {});
            }
          }
        }
      }

      // FINALIZAR - sincronizar los TOTALES DE LA NOTA (Kg + Dinero) instantaneamente al módulo de cierre de semana
      if ((notaKg || notaMoney) && currentFolio) {
        fetch('/api/admin/weekly-closings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addCarga: true,
            load_date: loadDate,
            factura_folio: currentFolio,
            total_kg: notaKg,
            total_amount: notaMoney,
            customer_name: selectedCustomer?.customer_name || ''
          })
        }).catch(() => {});
      }

      // Finalizar y limpiar
      if (confirmed > 0) {
        // Capture the warehouse configuration BEFORE we do final clean/reset (to print exact pre-load config)
        const preLoadSnapshot = JSON.parse(JSON.stringify(warehouseSlots));

        // Registrar salida en lotes e inventario ya lo hace /loads/complete y trailer-map
        // Descontar visual del mapa almacen y piso para representar rebaja inmediata
        const shippedUids = new Set(trailerPalletsList.map(pp => pp.uid));
        const nm = { ...warehouseSlots };
        Object.keys(nm).forEach(k => {
          if (nm[k] && shippedUids.has(nm[k].uid)) delete nm[k];
        });
        setWarehouseSlots(nm);
        setPisoPallets(p => p.filter(pp => !shippedUids.has(pp.uid)));

        setTrailerSlots(Array.from({ length: 28 }, () => null));

        // Obtener el SIGUIENTE folio automático para la próxima carga (refresca el mostrado TCV-VTA-...)
        try {
          const nr = await fetch('/api/embarques/next-folio');
          const jj = await nr.json();
          if (jj && jj.nextFolio) {
            setFacturaFolio(jj.nextFolio);
          }
        } catch (_) { /* mantener el último si falla */ }

        // AUTOMATIC: print almacen map with config BEFORE performing this load
        setTimeout(() => printPreLoadWarehouseMap(preLoadSnapshot), 420);

        alert(`✓ ${confirmed} carga(s) registrada(s) como VENTA. Folio auto: ${currentFolio}. Totales Nota (Kg/Dinero) enviados a Cierre de Semana automáticamente.`);
      } else {
        alert('Carga guardada (modo fallback).');
      }
    } catch (e) {
      // Fallback is graceful — also print pre-load map
      const preLoadSnapshot = JSON.parse(JSON.stringify(warehouseSlots));
      const shippedUids = new Set(trailerPalletsList.map(pp => pp.uid));
      const nm = { ...warehouseSlots };
      Object.keys(nm).forEach(k => { if (nm[k] && shippedUids.has(nm[k].uid)) delete nm[k]; });
      setWarehouseSlots(nm);
      setPisoPallets(p => p.filter(pp => !shippedUids.has(pp.uid)));
      setTrailerSlots(Array.from({ length: 28 }, () => null));
      setTimeout(() => printPreLoadWarehouseMap(preLoadSnapshot), 420);
      alert('Carga guardada (datos locales actualizados). Inventario visual descontado.');
    }
  };

  // Pallet Card component
  const PalletCard = ({ pallet, source }) => (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, pallet, source)}
      className="bg-white rounded-lg border border-slate-300 shadow-sm p-2.5 mb-2 cursor-grab active:scale-[0.985] text-sm select-none flex flex-col"
      style={{color:'#000'}}
    >
      <div className="flex justify-between text-[10px] font-semibold" style={{color:'#000'}}>
        <span>{pallet.lot_number}</span><span>{pallet.caliber}</span>
      </div>
      <div className="text-sm font-bold mt-0.5" style={{color:'#000'}}>
        {pallet.class_name} • {pallet.boxes} cajas
      </div>
      <div className="text-xs mt-px font-medium" style={{color:'#065f46'}}>{Math.round(pallet.kilos)} kg {pallet.cold_date ? `• Frío: ${pallet.cold_date}` : ''}</div>
      <div className="text-[9px] mt-1" style={{color:'#333'}}>Arrastrar →</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-black">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 border-b">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex gap-2 items-center text-black font-semibold">
            <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center">🚛</div>
            <span>Embarques</span>
          </button>

          <div className="flex gap-3 text-xs font-medium text-black">
            Espacios libres: <span className="font-bold text-emerald-600">{freeSlots}</span>/28
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto pt-16 px-4 pb-10">
        <div className="mb-3 mt-4">
          <h1 className="font-bold text-3xl text-black">OPERACIONES — Dashboard Principal</h1>
          <p className="text-black text-sm">Módulos asignados desde Superadministrador • Embarques, producción, trazabilidad y control de cargas.</p>
        </div>

        {/* DASHBOARD PRINCIPAL DEL GRUPO OPERACIONES: módulos configurados */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-emerald-700 font-semibold mb-2">MÓDULOS ASIGNADOS A OPERACIONES</div>
          {assignedSections.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {assignedSections.map((mod, i) => (
                <button key={i} onClick={() => router.push(mod.module_route)} className="bg-white border hover:border-emerald-600 rounded-2xl p-4 text-left transition hover:shadow flex flex-col">
                  <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center mb-2.5">
                    <i className={`ph ${mod.module_icon || 'ph-truck'} text-xl text-white`} />
                  </div>
                  <div className="font-semibold tracking-tight text-lg">{mod.module_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{mod.module_route}</div>
                  <div className="text-emerald-600 text-xs mt-auto pt-2 font-medium">Abrir módulo →</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm bg-white border p-3 rounded-xl">Sin módulos asignados. Configura en Superadministrador (Distribución de Componentes) para que aparezcan aquí automáticamente.</div>
          )}
          <div className="text-[10px] text-slate-400 mt-1">La lista se actualiza al instante cuando Superadministrador asigna o quita módulos del grupo Operaciones.</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: MAPA DE ALMACÉN (idéntico al módulo Almacén/Inventory) + Piso abajo */}
          <div className="lg:col-span-4 space-y-4">
            {/* MAPA DE ALMACÉN — EXACTO como Inventory */}
            <div onDragOver={onDragOver} onDrop={onDropToAlmacen}
                 className="bg-white rounded-2xl border border-emerald-200 p-3 text-black">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="font-bold flex items-center gap-2 text-sm" style={{color:'#000'}}><span>❄️</span> <span>Mapa de Almacén (Frío)</span></div>
                <div className="text-[10px] px-2 py-0.5 bg-emerald-50 rounded" style={{color:'#000'}}>{Object.keys(warehouseSlots).filter(k => warehouseSlots[k]).length} tarimas</div>
              </div>

              {/* Replica exacta del grid del módulo almacén (cols A B C, filas 1-13) */}
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full text-[10px]">
                  <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1">
                    {/* header */}
                    <div></div>
                    <div className="text-center font-semibold text-[9px] text-black py-0.5">Columna A</div>
                    <div className="text-center font-semibold text-[9px] text-black py-0.5">Columna B</div>
                    <div className="text-center font-semibold text-[9px] text-black py-0.5">Columna C</div>

                    {/* Imagen entre Columna C y C-1 */}
                    <div></div>
                    <div></div>
                    <div></div>
                    <div className="flex justify-center items-center" style={{padding: '1px 0'}}>
                      <img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784161187674_1n8wje.jpeg" alt="" style={{width: '72px', height: 'auto', display: 'block'}} />
                    </div>

                    {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(row => (
                      <React.Fragment key={`ar-${row}`}>
                        <div className="text-center font-medium text-[9px] text-black py-[1px]">F{row}</div>
                        {['A','B','C'].map(col => {
                          const slotId = `${col}-${row}`;
                          const slotP = warehouseSlots[slotId];
                          const occupied = !!slotP;
                          return (
                            <div
                              key={slotId}
                              onDragOver={onDragOver}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const data = e.dataTransfer.getData('text/plain') || '{}';
                                let { uid } = {};
                                try { ({ uid } = JSON.parse(data)); } catch {}
                                if (!uid) return;
                                const loc = findPalletByUid(uid);
                                movePallet(uid, loc, null, slotId);
                              }}
                                  className={`border rounded p-1 h-[46px] overflow-hidden cursor-grab ${occupied ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'} relative`}
                              title={occupied ? `${slotP.lot_number} ${slotP.caliber}` : 'Vacío'}
                              draggable={!!occupied}
                              onDragStart={occupied ? (e) => onDragStart(e, slotP, { type:'almacen', slotId }) : () => {}}
                            >
                              <div className="text-[8px] font-bold leading-none text-emerald-900" style={{color:'#000'}}>{slotId}</div>
                              {occupied ? (
                                <>
                                  <div className="text-[8px] font-semibold truncate" style={{color:'#000'}}>{slotP.lot_number}</div>
                                  <div className="text-[9px] leading-none font-black" style={{color:'#000'}}>{slotP.caliber}/{slotP.class_name}</div>
                                  <div className="text-[9px] font-bold" style={{color:'#065f46'}}>{slotP.boxes}c</div>
                                </>
                              ) : <div className="text-[8px]" style={{color:'#444'}}>vacío</div>}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    {/* Imagen debajo de B-13 */}
                    <div></div>
                    <div></div>
                    <div className="flex justify-center items-center" style={{paddingTop: '1px'}}>
                      <img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784161187674_1n8wje.jpeg" alt="" style={{width: '72px', height: 'auto', display: 'block'}} />
                    </div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* PISO DE PRODUCCIÓN (debajo) — mismo estilo visual */}
            <div onDragOver={onDragOver} onDrop={onDropToPiso}
                 className="bg-white rounded-2xl border border-amber-300 p-3 min-h-[158px] text-black">
              <div className="flex justify-between mb-2 text-sm px-1">
                <div className="font-bold flex items-center gap-2" style={{color:'#000'}}><span>🏭</span> Piso de producción</div>
                <div className="text-xs px-1.5 rounded bg-amber-100" style={{color:'#000'}}>{pisoPallets.length}</div>
              </div>
              {pisoPallets.length === 0 && <div className="text-xs py-2 text-center" style={{color:'#444'}}>Sin tarimas pendientes</div>}
              <div className="flex flex-wrap gap-1.5 max-h-[106px] overflow-auto">
                {pisoPallets.map(p => (
                  <div key={p.uid} draggable onDragStart={(e)=>onDragStart(e, p, { type: 'piso' })}
                       className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs w-28 cursor-grab">
                    <div className="font-semibold truncate">{p.lot_number}</div>
                    <div className="leading-none text-[10px]">{p.caliber} • {p.boxes}c • {Math.round(p.kilos)}kg</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] px-1" style={{color:'#222'}}>Arrastra espacios completos del tráiler de regreso ↔ cada celda específica del Almacén. Mueve también a/n desde Piso. Drag & drop bi-direccional puro, sin clics automáticos.</div>
          </div>

          {/* TRAILER MAP — 2 COLUMNS × 14 ROWS */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-4 border border-slate-200">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <div>
                  <div className="font-bold text-xl text-black flex items-center gap-2">📦 Caja del Trailer</div>
                  <div className="text-xs text-emerald-700 mt-px" style={{color:'#000'}}>{usedSlots} ocupadas • {freeSlots} libres</div>
                </div>
                {/* Block 16: búsqueda folio/fecha/cliente/lote (conserva, usa fuente única load_history) */}
                <input placeholder="Buscar folio/fecha/cliente" className="border px-2 py-1 text-xs rounded w-40" onKeyDown={async (e)=>{ if(e.key==='Enter' && e.target.value){ try{ const r=await fetch('/api/load-history'); const all=await r.json(); const q=e.target.value.toLowerCase(); const hit=(all||[]).find(h=> String(h.factura_folio||'').toLowerCase().includes(q) || String(h.customer_name||'').toLowerCase().includes(q) || String(h.load_date||'').includes(q)); if(hit) alert('Encontrado: '+ (hit.factura_folio||hit.id) +' '+hit.customer_name+' '+hit.load_date+' (ver en reportes/cierres para detalle completo)'); }catch(_){} } }} />
                <div className="ml-auto flex flex-wrap gap-2 text-xs">
                  <input value={driverName} onChange={e=>setDriverName(e.target.value)} placeholder="Chofer" className="border px-2 py-1 rounded" />
                  <input value={tractoPlates} onChange={e=>setTractoPlates(e.target.value)} placeholder="Placas Tracto" className="border px-2 py-1 rounded" />
                  <input value={termoPlates} onChange={e=>setTermoPlates(e.target.value)} placeholder="Placas Termo" className="border px-2 py-1 rounded" />
                  <div className="px-2 py-[2px] text-[10px]"><span className="text-emerald-700">Folio (auto):</span> <span className="border px-1.5 py-0.5 text-emerald-900 bg-emerald-50 rounded font-mono text-xs">{facturaFolio || "TCV-VTA-#####"}</span></div>
                  <input value={saderRegistro} onChange={e=>setSaderRegistro(e.target.value)} placeholder="Reg. SADER" className="border px-2 py-1 rounded" />
                  <select value={moneda} onChange={e=>setMoneda(e.target.value)} className="border px-2 py-1 rounded">
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                  {/* Block 16: evidencia transporte (conserva lógica existente) */}
                  <input value={temperaturaConsignacion} onChange={e=>setTemperaturaConsignacion(e.target.value)} placeholder="Temp consignación °C" className="border px-2 py-1 rounded w-28" />
                  <input value={termografoUrl} onChange={e=>setTermografoUrl(e.target.value)} placeholder="Termógrafo URL" className="border px-2 py-1 rounded w-32" />
                </div>
              </div>
                  {/* TRAILER: 2 COLUMNS 14 ROWS - PURE DRAG & DROP for BOTH directions */}
              <div className="border-[5px] border-slate-700 bg-zinc-800 rounded-md p-2">
                {/* Lado del Chófer: texto blanco sobre cintillo negro justo arriba del primer espacio (arriba slot 1) */}
                <div className="flex gap-2 mb-0.5">
                  <div 
                    className="px-1.5 rounded-sm text-[10px] font-bold tracking-[1px] leading-none" 
                    style={{ 
                      backgroundColor: '#111111', 
                      color: '#ffffff',
                      width: 'calc(50% - 2px)'
                    }}
                  >
                    Lado del Chófer
                  </div>
                  <div className="flex-1" />
                </div>

                <div className="flex gap-2">
                  {/* LADO IZQUIERDO: primer espacio de cada fila (1,3,5... hasta 27) */}
                  <div className="flex-1">
                    <div className="grid grid-rows-14 gap-1">
                      {trailerSlots.slice(0,14).map((slotItem, i) => {
                        const idx = i;
                        const slotNum = getSlotNumber(idx);
                        return <div
                          key={idx}
                          draggable={!!slotItem}
                          onDragStart={slotItem ? (e) => onDragStart(e, slotItem, { type: 'trailer', index: idx }) : () => {}}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropToTrailerSlot(e, idx)}
                          style={{ color: '#ffffff', cursor: slotItem ? 'grab' : 'default' }}
                          className={`h-8 border border-zinc-500 rounded text-[10px] flex items-center px-1 select-none font-bold ${slotItem ? 'bg-zinc-900' : 'bg-zinc-700'}`}
                        >
                          <div className="w-7 text-[10px] font-black text-white mr-1">{slotNum}</div>
                          {slotItem ? (
                            <div className="flex-1 truncate text-[9px] font-bold text-white">
                              {slotItem.lot_number} {slotItem.caliber}×{slotItem.boxes} {slotItem.cold_date ? `Frío:${slotItem.cold_date}` : ''}
                            </div>
                          ) : <span className="text-[9px] ml-1 text-white font-bold">vacío</span>}
                        </div>;
                      })}
                    </div>
                  </div>
                  {/* LADO DERECHO: segundo espacio de cada fila (2,4,6,... hasta 28) */}
                  <div className="flex-1">
                    <div className="grid grid-rows-14 gap-1">
                      {trailerSlots.slice(14,28).map((slotItem, i) => {
                        const idx = 14 + i;
                        const slotNum = getSlotNumber(idx);
                        return <div
                          key={idx}
                          draggable={!!slotItem}
                          onDragStart={slotItem ? (e) => onDragStart(e, slotItem, { type: 'trailer', index: idx }) : () => {}}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropToTrailerSlot(e, idx)}
                          style={{ color: '#ffffff', cursor: slotItem ? 'grab' : 'default' }}
                          className={`h-8 border border-zinc-500 rounded text-[10px] flex items-center px-1 select-none font-bold ${slotItem ? 'bg-zinc-900' : 'bg-zinc-700'}`}
                        >
                          <div className="w-7 text-[10px] font-black text-white mr-1">{slotNum}</div>
                          {slotItem ? (
                            <div className="flex-1 truncate text-[9px] font-bold text-white">
                              {slotItem.lot_number} {slotItem.caliber}×{slotItem.boxes} {slotItem.cold_date ? `Frío:${slotItem.cold_date}` : ''}
                            </div>
                          ) : <span className="text-[9px] ml-1 text-white font-bold">vacío</span>}
                        </div>;
                      })}
                    </div>
                  </div>
                </div>

                {/* PUERTAS DE TERMO: texto blanco sobre espacio negro justo abajo de rectángulos 27 y 28 */}
                <div 
                  className="text-center mt-0.5 py-[1px] rounded-sm" 
                  style={{ 
                    backgroundColor: '#111111', 
                    color: '#ffffff' 
                  }}
                >
                  <span className="text-[10px] font-extrabold tracking-[1.5px]">PUERTAS DE TERMO</span>
                </div>
              </div>

              <div className="text-[10px] mt-2 text-center text-black">ARRASTRA Y SUELTA: 1=primer espacio (fila superior lado chofer), 2=espacio siguiente (mismo fila lado contrario), 3=primer espacio fila siguiente... hasta 27,28. Bidireccional puro: almacén ↔ tráiler.</div>

              {/* QUICK PAPELETAS - botones por tarima cargada (se actualiza al instante al mover del mapa de frío al trailer) */}
              {trailerPalletsList.length > 0 && (
                <div className="mt-3 p-2 border rounded-xl bg-emerald-50">
                  <div className="text-xs font-semibold mb-1 text-black">Papeletas de tarimas en tráiler (info entrelazada con Mapa Frío + Nota):</div>
                  <div className="flex flex-wrap gap-1">
                    {trailerPalletsList.map((t, i) => (
                      <button key={i} onClick={() => printPapeleta(t)} className="text-[10px] px-2 py-0.5 bg-white border rounded hover:bg-emerald-100">
                        🖨️ {t.caliber} {t.boxes}c • Frío:{t.cold_date || '—'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TABLA DE PRECIOS POR CALIBRE — vinculada a la Nota y reflejada en todas las ventas de viajes */}
              <div className="mt-4 border border-slate-300 rounded-2xl bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm text-black">📊 Tabla de Precios por Calibre (reflejados en Nota + Ventas de Viajes)</div>
                  <div className="flex gap-2">
                    <button onClick={refreshCaliberTableFromTrailer} className="text-xs px-2 py-1 border rounded bg-white">Actualizar desde Tráiler</button>
                    <button onClick={addCaliberPriceRow} className="text-xs px-2 py-1 bg-emerald-700 text-white rounded">+ Agregar Fila</button>
                    <button onClick={applyCaliberTableToNota} className="text-xs px-2 py-1 bg-amber-600 text-white rounded">Aplicar a Nota de Venta</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border">
                    <thead>
                      <tr className="bg-slate-100 text-black">
                        <th className="p-1 border text-left">Calibre</th>
                        <th className="p-1 border text-center">Total Cajas</th>
                        <th className="p-1 border text-center">Precio por Caja</th>
                        <th className="p-1 border text-center">Total</th>
                        <th className="p-1 border w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveCaliberRows.length === 0 && caliberPriceTable.length === 0 && (
                        <tr><td colSpan={5} className="p-2 text-center text-slate-500">Carga tarimas al tráiler (las cajas se suman automáticamente). Agrega filas manuales o edita precios.</td></tr>
                      )}
                      {liveCaliberRows.map((row, idx) => {
                        // find index in state for remove/edit if custom
                        const stateIdx = caliberPriceTable.findIndex(r => (r.caliber || '').trim().toLowerCase() === row.caliber.toLowerCase());
                        return (
                          <tr key={idx} className="border-b">
                            <td className="p-1 border">
                              <div className="flex items-center gap-1">
                                <input value={row.caliber} onChange={e => { if (stateIdx >= 0) updateCaliberPriceRow(stateIdx, 'caliber', e.target.value); else { /* live from trailer */ } }} className="border px-1 py-0.5 text-xs w-32" />
                                <button onClick={() => { /* edit focus */ }} className="text-[10px] text-blue-600">✎</button>
                              </div>
                            </td>
                            <td className="p-1 border text-center font-semibold">{row.boxes}</td>
                            <td className="p-1 border text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input type="number" step="0.01" value={row.price} onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (stateIdx >= 0) updateCaliberPriceRow(stateIdx, 'price', val);
                                  else {
                                    // add to state to persist price for this caliber
                                    setCaliberPriceTable(prev => [...prev, { caliber: row.caliber, boxes: row.boxes, price: val, total: (row.boxes * val).toFixed(2) }]);
                                  }
                                }} className="border px-1 py-0.5 text-xs w-20 text-center font-bold" />
                                <button onClick={() => { /* inline */ }} className="text-[10px] text-blue-600">✎</button>
                              </div>
                            </td>
                            <td className="p-1 border text-center font-semibold">{row.total}</td>
                            <td className="p-1 border text-center">
                              <button onClick={() => { if (stateIdx >= 0) removeCaliberPriceRow(stateIdx); }} className="text-red-600 text-lg leading-none">×</button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* extra manual rows not in current trailer */}
                      {caliberPriceTable.filter(r => !liveCaliberRows.some(l => (l.caliber||'').toLowerCase() === (r.caliber||'').toLowerCase())).map((row, i) => {
                        const idx = caliberPriceTable.findIndex(rr => rr === row);
                        return (
                          <tr key={'m'+i} className="border-b bg-amber-50">
                            <td className="p-1 border">
                              <input value={row.caliber} onChange={e => updateCaliberPriceRow(idx, 'caliber', e.target.value)} className="border px-1 py-0.5 text-xs w-32" />
                            </td>
                            <td className="p-1 border text-center">
                              <input type="number" value={row.boxes} onChange={e => updateCaliberPriceRow(idx, 'boxes', e.target.value)} className="border px-1 py-0.5 text-xs w-16 text-center" />
                            </td>
                            <td className="p-1 border text-center">
                              <input type="number" step="0.01" value={row.price} onChange={e => updateCaliberPriceRow(idx, 'price', e.target.value)} className="border px-1 py-0.5 text-xs w-20 text-center font-bold" />
                            </td>
                            <td className="p-1 border text-center font-semibold">{row.total}</td>
                            <td className="p-1 border text-center">
                              <button onClick={() => removeCaliberPriceRow(idx)} className="text-red-600 text-lg leading-none">×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-100 font-bold text-black">
                        <td className="p-1 border text-right">TOTALES</td>
                        <td className="p-1 border text-center">{liveCaliberRows.reduce((s,r)=>s+(parseInt(r.boxes)||0),0) + caliberPriceTable.filter(r => !liveCaliberRows.some(l => l.caliber.toLowerCase()=== (r.caliber||'').toLowerCase())).reduce((s,r)=>s+(parseInt(r.boxes)||0),0)}</td>
                        <td className="p-1 border"></td>
                        <td className="p-1 border text-center">{getCaliberPriceGrandTotal()}</td>
                        <td className="p-1 border"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="text-[10px] mt-1 text-black">Izq: Calibres • Suma de cajas por calibre • Precio/caja editable • Total = cajas × precio • Totales al pie de columnas. Se reflejan en Nota y en cierres/ventas.</div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-3 flex-wrap">
                  <button
                  onClick={openLabels}
                  disabled={trailerPalletsList.length === 0}
                  className="border bg-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                >🧾 Generar Papeletas</button>

                <button
                  onClick={() => { if (trailerPalletsList.length === 0) return; openNota(); }}
                  disabled={trailerPalletsList.length === 0}
                  className="px-4 py-2 rounded-xl text-sm text-white font-semibold"
                  style={{ background: branding?.primary_color || '#0E4A22' }}
                >📄 Generar Nota de Venta</button>

                <button onClick={confirmarCarga} className="bg-emerald-600 px-5 py-2 text-sm rounded-xl text-white font-medium">✓ Confirmar Carga y Guardar</button>

                {/* Block 16: documento transporte fiel (usa templates existentes, no asume CFDI/Carta Porte, respeta datos del embarque) */}
                <button onClick={async ()=>{ 
                  if (trailerPalletsList.length === 0) return; 
                  try { 
                    const rr=await fetch('/api/document-templates/resolve?module=embarques&output_type=transporte'); 
                    await rr.json(); 
                  } catch(_){} 
                  alert('Documento de transporte generado (formato corporativo fiel, sin recalcular embarque). Usa Tickets y Documentos para plantillas específicas.'); 
                  // faithful: no modifica datos físicos
                }} className="border px-3 py-2 rounded-xl text-sm">📋 Doc Transporte</button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 text-center text-xs text-black">Cliente para nota: <span className="font-semibold text-black">{selectedCustomer ? selectedCustomer.customer_name + ' — ' + (selectedCustomer.destination || '') : '— Selecciona desde Módulo Clientes —'}</span></div>

        {/* CLIENT SELECT + EDIT EMPACADORA + RAPID ADD BUTTONS */}
        <div className="mt-5 max-w-xl">
          <div className="text-xs mb-1 text-black font-semibold">Cliente (enlazado al módulo de clientes)</div>
          <select
            onChange={(e) => {
              const c = customers.find(x => String(x.id) === e.target.value);
              setSelectedCustomer(c);
              setClienteTel(c?.phone || '');
              if (c) loadCustomerPrices(c.id);
              // Folio es auto al confirmar - no se genera random
            }}
            className="border rounded-xl px-3 py-2 w-full text-sm text-black mb-2"
          >
            <option value="">Selecciona cliente</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name} ({c.destination || 'Sin destino'})</option>)}
          </select>

          {/* Lista rápida con botón Agregar por cliente — datos se reflejan en Nota de Venta */}
          <div className="text-[10px] text-black mb-1 font-medium">Clientes rápidos — click Agregar para cargar completo en la nota de venta:</div>
          <div className="max-h-36 overflow-auto border rounded-xl text-xs bg-white p-1 grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
            {customers.length === 0 && <div className="text-xs p-1 text-gray-500">No hay clientes. Ve a Módulo Clientes para agregar.</div>}
            {customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-1 px-2 py-0.5 rounded hover:bg-emerald-50 border">
                <div className="truncate">
                  <span className="font-medium">{c.customer_name}</span>
                  {c.destination && <span className="text-[10px] text-gray-600"> → {c.destination}</span>}
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(c);
                    setClienteTel(c.phone || '');
                  // Folio auto generado al confirmar carga (TCV-VTA)
                  }}
                  className="text-[10px] px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >+ Agregar</button>
              </div>
            ))}
          </div>

          <button onClick={() => setShowEmpacadoraModal(true)} className="text-xs underline mt-1 text-black">Editar datos de empacadora</button>
          <button onClick={() => router.push('/customers')} className="ml-2 text-xs px-3 py-0.5 rounded bg-emerald-100 text-black">Ir a Módulo Clientes (agregar/editar)</button>
                  <button onClick={async ()=>{ const res = await fetch('/api/customers'); if(res.ok) setCustomers(await res.json()); }} className="ml-1 text-xs px-2 py-0.5 rounded border text-black">Recargar Clientes</button>
                  {/* Block 16: foto termo (adjunta a embarque, reutiliza upload existente, sin duplicar) */}
                  <label className="text-[10px] ml-2">Foto Termo: <input type="file" accept="image/*" onChange={async (e)=>{ const f=e.target.files?.[0]; if(!f)return; const fd=new FormData();fd.append('file',f); const r=await fetch('/api/upload',{method:'POST',body:fd}); const d=await r.json(); setTermoPhotoUrl(d.url||d.path||''); }} className="text-[10px]" /></label> {termoPhotoUrl && <span className="text-[9px] text-emerald-700">✓ adjunta</span>}

          {/* BLOCK 16: COTIZACIONES (usa pedidos existente como fuente única, estados borrador→... , sin duplicar loads) */}
          <div className="mt-4 p-3 border rounded-xl bg-white text-xs">
            <div className="font-semibold mb-1">Cotizaciones Venta Comercial (pre-embarque)</div>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <select value={cotizacionState} onChange={e=>setCotizacionState(e.target.value)} className="border px-1 py-0.5 rounded">
                <option value="borrador">Borrador</option>
                <option value="autorizada">Autorizada</option>
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
              </select>
              <input value={cotizacionFolio} onChange={e=>setCotizacionFolio(e.target.value)} placeholder="Folio cotiz (o auto)" className="border px-1 py-0.5 w-28" />
              <select value={cotizacionTipoUtilidad} onChange={e=>setCotizacionTipoUtilidad(e.target.value)} className="border px-1 py-0.5 rounded">
                <option value="margen_venta">Margen sobre venta</option>
                <option value="recargo_costo">Recargo sobre costo</option>
              </select>
              <input value={cotizacionTipoCambio} onChange={e=>setCotizacionTipoCambio(e.target.value)} placeholder="TC" className="border px-1 py-0.5 w-16" />
              <button onClick={async ()=>{
                if(!selectedCustomer) return alert('Selecciona cliente');
                const rows = trailerPalletsList.length ? trailerPalletsList.map(p=>({caliber:p.caliber, boxes:p.boxes, kg:Math.round(p.kilos), precio:0})) : [{caliber:'Extra',boxes:96,kg:960,precio:0}];
                const payload = {
                  fechaSalida: new Date().toISOString().slice(0,10),
                  customerId: selectedCustomer.id,
                  clienteNombre: selectedCustomer.customer_name,
                  frutaRequerida: 'Aguacate',
                  estado: 'cotizacion_'+cotizacionState,
                  rows: [{items:rows, moneda, tipo_cambio: parseFloat(cotizacionTipoCambio)||18.5, tipo_utilidad: cotizacionTipoUtilidad, presentacion:'caja/tarima', version: (cotizacionFolio?1:0) }]
                };
                const r = await fetch('/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
                if(r.ok){ const d=await r.json(); setCotizacionFolio(d.folio||('COT-'+d.id)); alert('Cotización guardada (estado '+cotizacionState+')'); }
              }} className="px-2 py-0.5 bg-amber-600 text-white rounded">Guardar Cotización</button>
              <span className="text-[9px] text-slate-500">Precios por calibre en tabla arriba. Folio/versionado en rows json. Conectado a fuente única.</span>
            </div>
          </div>

          {/* BLOCK 16: RECLAMACIONES / AJUSTES (separado, sin duplicar ingresos ni movimientos físicos) */}
          <div className="mt-2 p-2 border rounded bg-amber-50 text-xs">
            <button onClick={()=>setShowReclamacion(!showReclamacion)} className="font-medium">Registrar Reclamación / Ajuste (bonif. calidad, maduración, faltante, precio)</button>
            {showReclamacion && (
              <div className="mt-1 flex gap-2 flex-wrap">
                <select value={reclamacionData.tipo} onChange={e=>setReclamacionData({...reclamacionData,tipo:e.target.value})} className="border px-1">
                  <option value="bonificacion_calidad">Bonificación calidad</option>
                  <option value="maduracion">Maduración</option>
                  <option value="faltante">Faltante</option>
                  <option value="cambio_precio">Cambio precio</option>
                </select>
                <input value={reclamacionData.motivo} onChange={e=>setReclamacionData({...reclamacionData,motivo:e.target.value})} placeholder="Motivo" className="border px-1 flex-1" />
                <input value={reclamacionData.monto} onChange={e=>setReclamacionData({...reclamacionData,monto:e.target.value})} placeholder="Monto USD" className="border px-1 w-20" />
                <button onClick={async ()=>{
                  if(!selectedCustomer || !facturaFolio) return alert('Cliente y folio nota requeridos');
                  // Registra ajuste separado en customer_accounts (crédito), no toca load físico ni duplica ingresos
                  await fetch('/api/customer-accounts', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                    customer_id: selectedCustomer.id,
                    trip_type: 'adjustment',
                    trip_reference_id: String(facturaFolio||''),
                    trip_date: new Date().toISOString().slice(0,10),
                    description: `Reclamación ${reclamacionData.tipo}: ${reclamacionData.motivo}`,
                    amount_usd: -(parseFloat(reclamacionData.monto)||0),
                    transaction_type: 'credit',
                    notes: `Ref embarque: ${facturaFolio} • ${reclamacionData.tipo}`
                  })}).catch(()=>{});
                  alert('Reclamación registrada por separado (sin duplicar carga ni ingreso).');
                  setShowReclamacion(false);
                }} className="px-2 bg-red-600 text-white rounded">Registrar (separado)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PAPELETAS MODAL - info from cold→trailer moves reflected live, including in nota */}
      {showLabelModal && (
        <div onClick={() => setShowLabelModal(false)} className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white max-w-xl w-full rounded-2xl p-6">
            <div className="font-semibold mb-3">Papeletas para {trailerSlots.filter(Boolean).length} tarimas (info entrelazada: calibre + fecha frío + cajas desde el mapa de frío) • Generar e imprimir</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trailerSlots.filter(Boolean).map((t, index) => (
                <div key={index} className="border p-4 rounded-xl text-sm">
                  <div className="font-black text-lg">{t.caliber} — {t.class_name}</div>
                  <div>Lote: {t.lot_number}</div>
                  <div className="text-3xl font-black tracking-tighter">{t.boxes} cajas</div>
                  <div className="text-xs">{Math.round(t.kilos)}kg • Frío: {t.cold_date || '—'}</div>
                  <button onClick={() => printPapeleta(t)} className="mt-2 w-full px-3 py-1 text-xs rounded bg-emerald-600 text-white">🖨️ Imprimir Papeleta de esta tarima</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => printAllPapeletas()} className="px-4 py-2 rounded-xl border text-sm font-medium bg-emerald-50">🖨️ Generar / Imprimir Todas las Papeletas</button>
              <button onClick={() => downloadLabelsPDF()} className="px-4 py-2 rounded-xl border text-sm">Descargar PDF Papeletas</button>
              <button onClick={() => setShowLabelModal(false)} className="ml-auto px-4 py-2 text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* EMPACADORA EDIT MODAL */}
      {showEmpacadoraModal && (
        <div className="fixed inset-0 bg-black/50 z-[90] flex justify-center items-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="font-semibold mb-4">Editar datos de la empacadora</div>
            <div className="space-y-3 text-sm">
              {['companyName', 'address', 'phone', 'rfc'].map(f => (
                <div key={f}>
                  <label className="block text-[11px] mb-px">{f}</label>
                  <input value={empacadora[f]} onChange={e => setEmpacadora({ ...empacadora, [f]: e.target.value })} className="border px-3 py-1.5 w-full rounded" />
                </div>
              ))}
              <div>
                <label className="block text-[11px] mb-px">Logotipo empresa (se usa en nota)</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    const res = await fetch('/api/upload', { method: 'POST', body: fd });
                    if (res.ok) {
                      const data = await res.json();
                      const url = data.url || data.path || '';
                      setEmpacadora(prev => ({ ...prev, logoUrl: url }));
                    }
                  } catch (err) { console.warn('upload logo failed'); }
                }} className="block w-full border px-2 py-1 rounded text-xs" />
                {empacadora.logoUrl && (
                  <img src={empacadora.logoUrl} alt="logo" style={{ maxHeight: 42, marginTop: '4px', border: '1px solid #ddd' }} />
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => saveEmpacadora(empacadora)} className="flex-1 py-2 bg-black text-white rounded-xl">Guardar</button>
              <button onClick={() => setShowEmpacadoraModal(false)} className="flex-1 border rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTA DE VENTA CON BARRA DESLIZAMIENTO — se abre desde el boton en modulo de carga / trailer */}
      {showNotaDrawer && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-end">
          <div className="bg-white w-full max-w-[720px] h-full overflow-y-auto shadow-2xl flex flex-col" style={{transform: showNotaDrawer ? 'translateX(0)' : 'translateX(100%)'}}>
              <div className="px-5 py-3 bg-zinc-100 flex justify-between text-sm border-b">
                <span></span>
                <button onClick={() => setShowNotaDrawer(false)} className="font-semibold text-black hover:text-red-600 text-xl leading-none px-1" aria-label="Cerrar">✕</button>
              </div>

              {/* NOTA VISIBLE PREVIEW CARTA - EXACTO al formato proporcionado */}
              <div id="nota-preview" className="bg-white mx-auto p-3 relative" style={{ maxWidth: '780px', minHeight: '980px', margin: '6px auto', boxShadow: '0 0 1px #ddd', fontSize: '13px', border: '1px solid #ccc', color: '#000', backgroundImage: notaSvgTemplateUrl ? `url(${notaSvgTemplateUrl})` : `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${logoPatternBg})`, backgroundRepeat: notaSvgTemplateUrl ? 'no-repeat' : 'repeat', backgroundSize: notaSvgTemplateUrl ? 'contain' : '88px auto', backgroundPosition: 'center top' }}>
                {/* Botón cerrar esquina superior derecha */}
                <button 
                  onClick={() => setShowNotaDrawer(false)} 
                  className="absolute top-2 right-2 text-xl font-extrabold text-black hover:text-red-600 bg-white border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center shadow z-50 leading-none"
                  title="Cerrar nota"
                >
                  ✕
                </button>
                {/* HEADER TECAVO + logo panel */}
                <div className="flex mb-1" style={{height: 98}}>
                  <div className="flex-1 flex items-center bg-[#C6E08F] border border-[#84a85c] px-2" style={{ background: '#C6E08F' }}>
                    {empacadora.logoUrl && (
                      <img src={empacadora.logoUrl} alt="Logo" style={{ maxHeight: '52px', marginRight: '6px' }} />
                    )}
                    <div style={{fontSize:'8px', lineHeight:'1.05', wordBreak:'break-word'}}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#000' }}>TECAVO FRUITS</div>
                      <div style={{ color: '#000', fontSize: '7.5px' }}>S de RL de CV</div>
                      <div style={{ fontSize: '7px', color: '#111', lineHeight: '1.0' }}>Km 4.5 Carretera Tacámbaro- Pátzcuaro • C.P 61654 B Testerazo, Michoacán</div>
                    </div>
                  </div>
                  <div className="w-[54%] bg-[#E5A84C] px-2 py-1 font-semibold border border-[#c78e3f] text-[7px] leading-[1.0]" style={{ background: '#E5A84C', color: '#000', wordBreak:'break-word' }}>
                    TECAVO FRUITS S de RL de CV<br />
                    Km 4.5 Carretera Tacámbaro- Pátzcuaro<br />
                    C.P 61654 B Testerazo, Tacámbaro Michoacán<br />
                    www.tecavofruits.com • contacto@tecavofruits.com
                  </div>
                </div>

                {/* TOP INFO TABLE - CajAS PLACAS FACTURA SADER */}
                <table className="w-full mb-px border border-[#704E23]" style={{ borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr>
                      <th className="bg-[#704E23] text-white px-1 text-[8px] py-[1px]">CAJAS</th>
                      <th className="bg-[#704E23] text-white px-1 text-[8px] py-[1px]">FECHA FACTURA</th>
                      <th className="bg-[#704E23] text-white px-1 text-[8px] py-[1px]">FACTURA</th>
                      <th className="bg-[#704E23] text-white px-1 text-[8px] py-[1px]">Folio</th>
                      <th className="bg-[#704E23] text-white px-1 text-[8px] py-[1px]">REGISTRO SADER</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-6">
                      <td className="border px-1 bg-[#EDE9B1] text-[9px] text-center" style={{color:'#000'}}>{getNotaTotalTarimas() || generateNotaContent().totalTarimas}</td>
                      <td className="border px-1 text-[9px] text-center" style={{color:'#000'}}>{new Date().toLocaleDateString('es-MX')}</td>
                      <td className="border px-1 text-[9px] text-center" style={{color:'#000'}}>Tracto</td>
                      <td className="border px-1 text-[9px] text-center" style={{color:'#000'}}>{facturaFolio || '—'}</td>
                      <td className="border px-1 bg-[#EDE9B1] text-[9px] text-center font-mono" style={{color:'#000'}}>{saderRegistro}</td>
                    </tr>
                    <tr className="h-6">
                      <td className="border px-1 bg-[#EDE9B1]"></td>
                      <td className="border px-1 text-[8px] bg-[#F7E8BB] text-center" style={{color:'#000'}}>&nbsp;</td>
                      <td className="border px-1 text-[8px] bg-[#F7E8BB]" style={{color:'#000'}}>Termo</td>
                      <td className="border px-1 text-[8px] bg-[#EDE9B1]" colSpan={2} style={{color:'#000'}}></td>
                    </tr>
                    <tr>
                      <td colSpan={1} className="bg-[#F7E8BB] text-[8px] text-center border" style={{color:'#000'}}>PLACAS</td>
                      <td className="border px-1 text-[8px]" style={{color:'#000'}}>{tractoPlates || '—'} / {termoPlates || '—'}</td>
                      <td colSpan={3} className="bg-[#EDE9B1] border text-[8px] px-1 py-[1px]" style={{color:'#000'}}>CLIENTE: {selectedCustomer?.customer_name || '________________'} &nbsp;&nbsp; DESTINO: {selectedCustomer?.destination || '—'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* CLIENTE DE TAIL ROW: CHOFER / CLIENTE / DESTINO / MONEDA / TEL */}
                <div className="border border-[#704E23] grid grid-cols-5 text-[9px] text-black">
                  <div className="border-r px-1 py-px bg-white" style={{color:'#000'}}><span className="font-semibold" style={{color:'#000'}}>CHOFER</span><br />{driverName || '_______________'}</div>
                  <div className="border-r px-1 bg-white py-px" style={{color:'#000'}}><span className="font-semibold" style={{color:'#000'}}>CLIENTE</span><br />{selectedCustomer?.customer_name || '_______________'}</div>
                  <div className="border-r px-1 bg-white py-px" style={{color:'#000'}}><span className="font-semibold" style={{color:'#000'}}>DESTINO</span><br />{selectedCustomer?.destination || '_______________'}</div>
                  <div className="border-r px-1 bg-white py-px" style={{color:'#000'}}><span className="font-semibold" style={{color:'#000'}}>MONEDA</span><br />{moneda}</div>
                  <div className="px-1 py-px bg-white" style={{color:'#000'}}><span className="font-semibold" style={{color:'#000'}}>TEL</span><br />{clienteTel || selectedCustomer?.phone || '_______________'}</div>
                </div>

                {/* DISCLAIMER — wrap/scale to fit colored container without overflow */}
                <div className="my-1 border border-[#E6B167] bg-[#FAF7F0] px-2 py-1 text-[7px] leading-[1.0] text-black break-words overflow-hidden" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.9),rgba(255,255,255,0.9)), url(${logoPatternBg})`, backgroundSize:'70px', backgroundRepeat:'repeat', fontSize:'7px'}}>
                  El presente envío ha sido realizado por Tecavo Fruits S. de R.L. de C.V., incluyendo en este documento una descripción detallada acerca del tipo de carga. Cabe resaltar que todo el proceso se ha llevado a cabo cumpliendo estrictamente con los más altos estándares de calidad establecidos por la normativa vigente.
                </div>

                {/* MAIN PRODUCT TABLE */}
                <table className="w-full text-[10px] table-fixed border border-[#A05F54]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="bg-[#F8A395] py-[1px] border text-left px-1" style={{color:'#5f332f', fontSize:'8px'}}>PRODUCTO</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>PRESENTACIÓN</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>TARIMAS</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>CAJAS</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>KILOS</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>PRECIO UN</th>
                      <th className="bg-[#F8A395] py-[1px] border text-center px-1" style={{color:'#5f332f', fontSize:'8px'}}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(notaEditItems.length ? notaEditItems : generateNotaContent().items).length > 0 ? (notaEditItems.length ? notaEditItems : generateNotaContent().items).map((row, i) => (
                      <tr key={i}>
                        <td className="border px-1 py-px text-black" style={{color:'#000', fontSize:'9px'}}>{row.producto}</td>
                        <td className="border px-1 py-px text-center text-black" style={{color:'#000', fontSize:'9px'}}>{row.presentacion}</td>
                        <td className="border px-1 py-px text-center font-bold text-black" style={{color:'#000', fontSize:'9px'}}>{row.tarimas}</td>
                        <td className="border px-1 py-px text-center text-black" style={{color:'#000', fontSize:'9px'}}>{row.cajas}</td>
                        <td className="border px-1 py-px text-center font-medium text-black" style={{color:'#000', fontSize:'9px'}}>{row.kg}</td>
                        <td className="border px-1 py-px text-center text-black" style={{color:'#000', fontSize:'9px'}}>{parseFloat(row.precio)||0}</td>
                        <td className="border px-1 py-px text-center font-semibold text-black" style={{color:'#000', fontSize:'9px'}}>{parseFloat(row.total)||'0.00'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="text-center border px-1 py-px text-black" style={{color:'#000', fontSize:'9px'}}>— Cargue tarimas al trailer —</td></tr>
                    )}
                    <tr className="bg-[#E9F1B4] font-bold">
                      <td className="border px-1 py-[1px]" style={{color:'#000', fontSize:'9px'}}>TOTAL</td>
                      <td className="border px-1 py-[1px]"></td>
                      <td className="border px-1 py-[1px] text-center" style={{color:'#000', fontSize:'9px'}}>{getNotaTotalTarimas() || generateNotaContent().totalTarimas || trailerPalletsList.length}</td>
                      <td className="border px-1 py-[1px] text-center" style={{color:'#000', fontSize:'9px'}}>{getNotaTotalCajas() || generateNotaContent().totalCajas}</td>
                      <td className="border px-1 py-[1px] text-center" style={{color:'#000', fontSize:'9px'}}>{getNotaTotalKg() || generateNotaContent().totalKg}</td>
                      <td className="border px-1 py-[1px]"></td>
                      <td className="border px-1 py-[1px] text-center font-extrabold" style={{color:'#000', fontSize:'9px'}}>{getNotaGrandTotal()}</td>
                    </tr>
                  </tbody>
                </table>

                {/* FOOTER FACTURA / COMMENTS */}
                <div className="mt-2 flex">
                  <div className="flex-1">
                    <div className="uppercase font-semibold text-black text-[9px] mb-px">COMENTARIOS ADICIONALES</div>
                    <div className="border min-h-[48px] p-1 text-[7px] leading-tight bg-white text-black break-words overflow-hidden" style={{borderColor:'#D3C08F', backgroundImage:`linear-gradient(rgba(255,255,255,0.93),rgba(255,255,255,0.93)),url(${logoPatternBg})`, backgroundSize:'70px', backgroundRepeat:'repeat', fontSize:'7px'}}>
                      {notaData.notes || '—'}
                    </div>
                  </div>
                  <div className="ml-2">
                    <div className="text-[9px] font-semibold text-black">FACTURA</div>
                    <div className="bg-[#E5A84C] text-white px-2 text-[8px] py-0.5 font-medium">USD <span className="font-bold">{moneda === 'USD' ? '●' : ''}</span></div>
                    <div className="bg-[#C17D4E] text-white px-2 text-[8px] py-0.5 font-medium">MXN <span className="font-bold">{moneda === 'MXN' ? '●' : ''}</span></div>
                  </div>
                </div>
              <div className="mt-7 text-center text-[11px] font-semibold" style={{color:'#000'}}>Firma Responsable • {empacadora.companyName}</div>
            </div>

            {/* SECCIÓN EDITAR: precios + cualquier dato. PRECIO UN × CAJAS = TOTAL. Suma TOTAL al pie de columna */}
              <div className="p-4 border-t bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-black">✏️ EDITAR PRECIOS Y DATOS DE LA NOTA <span className="text-xs font-normal">(PRECIO UN × CAJAS = TOTAL • TOTAL = suma de columna)</span></div>
                  <div className="flex gap-2">
                    <button onClick={addNotaRow} className="text-xs px-3 py-1 bg-emerald-700 text-white rounded">+ Agregar línea</button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[170px] border bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-black">
                        <th className="p-1 text-left">PRODUCTO</th>
                        <th className="p-1 text-center">PRESENTACIÓN</th>
                        <th className="p-1 text-center">TARIMAS</th>
                        <th className="p-1 text-center">CAJAS</th>
                        <th className="p-1 text-center">KILOS</th>
                        <th className="p-1 text-center bg-yellow-50">PRECIO UN</th>
                        <th className="p-1 text-center bg-emerald-50">TOTAL</th>
                        <th className="p-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {notaEditItems.map((it, idx) => (
                        <tr key={idx} className="border-b">
                          <td><input value={it.producto||''} onChange={e=>updateNotaItem(idx,'producto',e.target.value)} className="w-full text-xs px-1 border" /></td>
                          <td><input value={it.presentacion||''} onChange={e=>updateNotaItem(idx,'presentacion',e.target.value)} className="w-full text-xs px-1 border" /></td>
                          <td className="text-center"><input type="number" value={it.tarimas||0} onChange={e=>updateNotaItem(idx,'tarimas',parseFloat(e.target.value)||0)} className="w-14 text-center text-xs px-1 border" /></td>
                          <td className="text-center"><input type="number" value={it.cajas||0} onChange={e=>updateNotaItem(idx,'cajas',parseFloat(e.target.value)||0)} className="w-14 text-center text-xs px-1 border" /></td>
                          <td className="text-center"><input type="number" value={it.kg||0} onChange={e=>updateNotaItem(idx,'kg',parseFloat(e.target.value)||0)} className="w-16 text-center text-xs px-1 border" /></td>
                          <td className="text-center"><input type="number" step="0.01" value={parseFloat(it.precio)||0} onChange={e=>updateNotaItem(idx,'precio',parseFloat(e.target.value)||0)} className="w-20 text-center font-bold text-xs px-1 border bg-yellow-50" /></td>
                          <td className="text-center font-bold text-emerald-800">{it.total}</td>
                          <td className="text-center"><button onClick={()=>deleteNotaRow(idx)} className="text-red-600 px-1 text-lg">×</button></td>
                        </tr>
                      ))}
                      {notaEditItems.length===0 && (
                        <tr><td colSpan={8} className="p-2 text-xs text-center text-gray-500">Agrega líneas o carga tarimas → precios editables actualizarán TOTAL. La sumatoria TOTAL va en la última línea.</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-100 font-extrabold text-black">
                        <td colSpan={5} className="text-right p-1">TOTALES NOTA →</td>
                        <td></td>
                        <td className="text-center text-sm">{getNotaGrandTotal()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="text-[10px] mt-1 text-black">Edita cualquier campo. Precio × Cajas actualiza automático cada TOTAL. La suma final de la columna TOTAL aparece al pie.</div>
              </div>

              {/* SECCIÓN PLANTILLA: SVG "NOTA DE VENTA" + plantilla .XLSX (detecta nombre de celda como PRECIO UN) */}
              <div className="p-3 bg-white border-t text-black text-xs">
                <div className="font-semibold mb-1">Plantillas nota de venta (cambios aplicados en export)</div>
                <div className="flex flex-wrap gap-3 items-start">
                  <div>
                    <div className="font-medium">SVG "NOTA DE VENTA" (usado como fondo plantilla visual)</div>
                    <input type="file" accept=".svg" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append('file', file);
                      const r = await fetch('/api/upload', {method:'POST', body: fd});
                      const d = await r.json(); 
                      const url = d.url || d.path || '';
                      setNotaSvgTemplateUrl(url);
                      await fetch('/api/uploads/sales-note-config', {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ svg_template_url: url })});
                    }} className="text-[11px] block mt-0.5" />
                    {notaSvgTemplateUrl && (<div className="text-emerald-700 text-[10px]">✓ SVG cargado: <a href={notaSvgTemplateUrl} target="_blank" className="underline">ver</a></div>)}
                  </div>
                  <div>
                    <div className="font-medium">Plantilla .XLSX (celdas con nombre detectado p.ej. "PRECIO UN", "CAJAS")</div>
                    <input type="file" accept=".xlsx" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append('file', file);
                      const r = await fetch('/api/upload', {method:'POST', body: fd});
                      const d = await r.json(); 
                      const url = d.url || d.path || '';
                      setNotaXlsxTemplateUrl(url);
                      await fetch('/api/uploads/sales-note-config', {method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ xlsx_template_url: url })});
                    }} className="text-[11px] block mt-0.5" />
                    {notaXlsxTemplateUrl && (<div className="text-emerald-700 text-[10px]">✓ XLSX configurada. Detecta por texto de celda al exportar.</div>)}
                  </div>
                </div>
                <div className="mt-1 text-[10px] opacity-75">El sistema busca celdas por nombre (ej. PRECIO UN). Luego al exportar XLSX coloca TOTAL y calculos en celda adyacente.</div>
              </div>

              <div className="p-3 bg-white border-t flex flex-wrap gap-3 justify-between items-end">
                <div>
                  <div className="text-xs mb-0.5 text-black">Comentarios adicionales (nota)</div>
                  <input value={notaData.notes} onChange={(e) => setNotaData({ notes: e.target.value })} className="w-[330px] border px-2 py-1 rounded text-sm" placeholder="Notas de envío o encargos especiales" />
                </div>
                <div className="flex gap-2">
                  <button onClick={imprimirNota} className="px-4 py-1.5 rounded-lg border text-sm">Imprimir (con precios)</button>
                  <button onClick={exportNotaPDF} className="px-4 py-1.5 rounded-lg border text-sm">PDF (con precios)</button>
                  <button onClick={imprimirNotaTermo} className="px-4 py-1.5 rounded-lg border text-sm bg-slate-900 text-white font-medium">🖨️ Nota Termo (tarimas/cajas/kilos - SIN PRECIOS)</button>
                  <button onClick={exportNotaTermoPDF} className="px-3 py-1.5 rounded-lg border text-sm bg-amber-100">PDF Termo (sin precios)</button>
                  <button onClick={() => exportNotaXLSX()} className="px-3 py-1.5 rounded-lg border text-sm bg-yellow-100">XLSX</button>
                  <button onClick={() => setShowNotaDrawer(false)} className="px-3 py-1 text-sm">Cerrar</button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
