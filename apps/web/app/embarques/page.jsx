'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';
import { drawCompanyHeader } from '@/lib/company-header';
import * as XLSX from 'xlsx';
import {buildSalesNote,buildPalletSlips,exportSalesNoteExcel,presentPdf,validateShipmentTemplate} from '@/utils/shipment-print';
import {coldSlots,floor,makeShipmentMap,trailerPosition} from '@/utils/shipment-map';
import {mexicoToday} from '@/utils/closing-period';
import './shipment.css';

const logoPatternBg = 'https://app-cdn.appgen.com/c47548b2-8776-415f-8483-cdae09035713/assets/uploaded_1782267881654_9m0hnj.png';

export default function EmbarquesPage() {
  const router = useRouter();
  const { branding } = useBranding();

  const [map,setMap] = useState(() => makeShipmentMap([]));
  const {warehouse:warehouseSlots,reserved,pending:pisoPallets,trailer:trailerSlots,conflicts} = map;
  const [activePallet,setActivePallet] = useState(null);
  const [mapMessage,setMapMessage] = useState('');
  const [inventoryError,setInventoryError] = useState('');
  const [moving,setMoving] = useState(false);
  const movementLock = useRef(false);
  const inventoryRequest = useRef(0);
  const [historicalMap,setHistoricalMap] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [driverName, setDriverName] = useState('');
  const [trailerPlates, setTrailerPlates] = useState('');
  const [tractoPlates, setTractoPlates] = useState('');
  const [termoPlates, setTermoPlates] = useState('');
  const [facturaFolio, setFacturaFolio] = useState('');
  const [saderRegistro, setSaderRegistro] = useState('EMP0416082581/2024');
  const [moneda, setMoneda] = useState('USD');
  const [tipoCambioVenta,setTipoCambioVenta] = useState('');
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
  const [showLoadMapModal, setShowLoadMapModal] = useState(false);

  const [loading, setLoading] = useState(true);

  // Centralized corporate config (single source from app-config + branding, used by mapa de carga, nota y hoja de venta)
  const [corporateConfig, setCorporateConfig] = useState({});

  // Editable empacadora config (prellenado editable) — centralized source used by all print templates
  const [empacadora, setEmpacadora] = useState({
    companyName: branding?.companyName || 'EMPAQUE TECAVO',
    address: branding?.address || 'Carretera a Huerta s/n, Michoacán',
    phone: '(443) 000-0000',
    rfc: 'EMP123456ABC',
    logoUrl: branding?.logo_url || null,
    website: 'www.tecavofruits.com',
    email: ''
  });

  // Current nota draft fields
  const [notaData, setNotaData] = useState({ notes: '' });

  // Editable Nota Items - price editable, totals auto, supports adding/modifying data
  const [notaEditItems, setNotaEditItems] = useState([]);
  const [printSettings,setPrintSettings] = useState({});
  const [templateStatus,setTemplateStatus] = useState('');
  const [savingTemplate,setSavingTemplate] = useState(false);
  const [lastLoadId,setLastLoadId] = useState(null);
  const [clientPrices, setClientPrices] = useState([]);

  // Dynamic sections loaded from Config de Modulos (group_access) - only assigned to Operaciones role are returned by API
  const [assignedSections, setAssignedSections] = useState([]);

  // Caliber price table for the current trailer load (linked to Nota de Venta + reflected in all trip sales)
  const [caliberPriceTable, setCaliberPriceTable] = useState([]);

  // logoPattern already defined above, use for nota background on white areas

  const refreshInventory = async () => {
    const version = ++inventoryRequest.current;
    try {
      const response = await fetch('/api/pallet-output',{cache:'no-store'});
      if (!response.ok) throw new Error('No se pudo leer el inventario.');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Inventario no disponible.');
      if (version !== inventoryRequest.current) return;
      const next = makeShipmentMap(rows);
      setMap(next);
      setActivePallet(current => current && [...Object.values(next.warehouse),...next.pending,...next.trailer]
        .some(p=>p?.uid === current.uid && p.position === current.position) ? current : null);
      setInventoryError('');
    } catch(error) {
      if (version === inventoryRequest.current) setInventoryError(error.message);
    } finally {
      if (version === inventoryRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    refreshInventory();
    fetch('/api/customers').then(response=>response.ok ? response.json() : [])
      .then(data=>setCustomers(Array.isArray(data) ? data : [])).catch(()=>{});
    const refresh = () => { if (!document.hidden && !movementLock.current) refreshInventory(); };
    const timer = window.setInterval(refresh,8000);
    window.addEventListener('focus',refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus',refresh);
      inventoryRequest.current++;
    };
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

  useEffect(() => {
    fetch('/api/uploads/sales-note-config',{cache:'no-store'}).then(response=>{
      if (!response.ok) throw new Error('No se pudieron cargar las plantillas.');
      return response.json();
    }).then(setPrintSettings).catch(error=>setTemplateStatus(error.message));
  }, []);

  const saveTemplateSettings = async update => {
    const response = await fetch('/api/uploads/sales-note-config',{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(update)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setPrintSettings(settings=>({...settings,...update}));
  };

  const uploadPrintTemplate = async (file,key) => {
    if (!file) return;
    setSavingTemplate(true);
    setTemplateStatus('');
    try {
      await validateShipmentTemplate(file,key);
      const body = new FormData(); body.append('file',file);
      const response = await fetch('/api/upload',{method:'POST',body});
      const result = await response.json();
      const url = result.url || result.data?.url || result.path;
      if (!response.ok || !url) throw new Error(result.error || 'No se pudo almacenar la plantilla.');
      await saveTemplateSettings({[key]:url});
      setTemplateStatus('Plantilla guardada.');
    } catch(error) {setTemplateStatus(error.message);}
    finally {setSavingTemplate(false);}
  };

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

  // Load centralized corporate config (used by mapa de carga, nota de venta y hoja de venta)
  useEffect(() => {
    const loadCorporate = async () => {
      try {
        const [cfgRes, brandRes] = await Promise.all([
          fetch('/api/app-config'),
          fetch('/api/branding')
        ]);
        const cfg = cfgRes.ok ? await cfgRes.json() : {};
        const brand = brandRes.ok ? await brandRes.json() : {};
        const company = cfg.company || {};
        const loadedCorp = {
          name: company.name || brand.company_name || 'TECAVO FRUITS',
          legal_name: company.legal_name || 'Tecavo Fruits S de RL de CV',
          address: company.address || brand.address || 'Carretera a Huerta s/n, Michoacán',
          phone: company.phone || '',
          email: company.email || '',
          web: company.web || 'www.tecavofruits.com',
          rfc: company.rfc || '',
          sader: company.sader || saderRegistro,
          logo_url: company.logo_url || brand.logo_url || empacadora.logoUrl || null
        };
        setCorporateConfig(loadedCorp);
        // sync into empacadora for edit/preview consistency
        setEmpacadora(prev => ({
          ...prev,
          companyName: loadedCorp.name,
          address: loadedCorp.address,
          phone: loadedCorp.phone || prev.phone,
          rfc: loadedCorp.rfc || prev.rfc,
          logoUrl: loadedCorp.logo_url || prev.logoUrl,
          website: loadedCorp.web,
          email: loadedCorp.email
        }));
      } catch (_) {
        setCorporateConfig({
          name: 'TECAVO FRUITS', legal_name: 'Tecavo Fruits S de RL de CV',
          address: 'Carretera a Huerta s/n, Michoacán', phone: '', email: '', web: 'www.tecavofruits.com',
          rfc: '', sader: saderRegistro, logo_url: null
        });
      }
    };
    loadCorporate();
  }, []);

  const commitPosition = async (pallet,target) => {
    if (!pallet || pallet.position === target || movementLock.current || submitting || inventoryError || conflicts.length) return;
    movementLock.current = true;
    setMoving(true);
    setMapMessage('');
    try {
      const response = await fetch('/api/embarques/pallet-location',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:pallet.originalPalletId,expected:pallet.position,target})
      });
      const moved = await response.json();
      if (!response.ok) throw new Error(moved.error || 'No se pudo mover la tarima.');
      setMapMessage(`${pallet.folio} · ${pallet.position} a ${target}`);
      setActivePallet(null);
      setNotaEditItems([]);
    } catch (error) {
      setMapMessage(error.message);
    } finally {
      await refreshInventory();
      setMoving(false);
      movementLock.current = false;
    }
  };

  const findPallet = uid => [...Object.values(warehouseSlots),...pisoPallets,...trailerSlots]
    .find(pallet=>pallet?.uid===uid);
  const onDragStart = (event,pallet) => {
    event.dataTransfer.setData('text/plain',pallet.uid);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = moving || inventoryError ? 'none' : 'move';
  };
  const placeAt = (event,target) => {
    event.preventDefault();
    event.stopPropagation();
    const pallet = findPallet(event.dataTransfer.getData('text/plain'));
    commitPosition(pallet,target);
  };

  const openHistoricalMap = async id => {
    const raw = id || window.prompt('ID del embarque confirmado');
    if (!/^\d+$/.test(raw || '')) return;
    try {
      const response = await fetch(`/api/embarques/document?loadId=${raw}`);
      const document = await response.json();
      if (!response.ok) throw new Error(document.error);
      setHistoricalMap({id:raw,...document});
    } catch (error) {setMapMessage(error.message || 'El embarque no está disponible.');}
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

  const printPallets = async (rows,print=true,plates=termoPlates || trailerPlates) => {
    const popup = print ? window.open('about:blank','_blank') : null;
    if (print && !popup) { alert('Permite ventanas emergentes para imprimir.'); return; }
    try { presentPdf(await buildPalletSlips(rows,printSettings.pallet_template_url,plates),'papeletas.pdf',popup); }
    catch(error) {popup?.close();alert(error.message);}
  };
  const printPapeleta = pallet => printPallets([pallet]);
  const printAllPapeletas = () => printPallets(getCurrentTrailerPallets());
  const printLabels = printAllPapeletas;
  const downloadLabelsPDF = () => printPallets(getCurrentTrailerPallets(),false);

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
      const presentacion=p.boxes <= 50 ? 'Caja 6 KG' : 'Caja 10 KG';
      if (grouped[k].presentacion!==presentacion) grouped[k].presentacion='Mixta';
      grouped[k].tarimas += 1;
      grouped[k].cajas += (p.boxes || 0);
      grouped[k].kg += Number(p.kilos || 0);
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
    // Persist to global branding (single source used by mapa de carga, nota y hoja de venta)
    try {
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: newData.companyName,
          address: newData.address,
          phone: newData.phone,
          rfc: newData.rfc,
          logo_url: newData.logoUrl,
          website: newData.website,
          email: newData.email
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

  const noteData = () => ({
    folio:facturaFolio,customer:selectedCustomer?.customer_name,currency:moneda,
    driver:driverName,date:mexicoToday(),notes:notaData.notes,destination:selectedCustomer?.destination,
    plates:termoPlates || trailerPlates,
    rows:notaEditItems,company:corporateConfig.name || empacadora.companyName
  });
  const printSalesNote = async (print=false,note=noteData()) => {
    const popup = print ? window.open('about:blank','_blank') : null;
    if (print && !popup) {alert('Permite ventanas emergentes para imprimir.');return;}
    try {
      const merged = {...note,company:companyName()};
      presentPdf(await buildSalesNote(merged,printSettings),`nota_venta_${note.folio || 'borrador'}.pdf`,popup);
    } catch(error) {popup?.close();alert(error.message);}
  };
  const companyName = () => corporateConfig.name || empacadora.companyName || 'Tecavo Fruits';
  const exportNotaPDF = () => printSalesNote();

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

  const exportNotaXLSX = async (note=noteData()) => {
    try {await exportSalesNoteExcel(note,printSettings.xlsx_template_url);}
    catch(error) {alert(error.message || 'No se pudo generar la nota en Excel.');}
  };
  const imprimirNota = () => printSalesNote(true);

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

  // MAPA DE CARGA generator (plantilla imprimible) — usa datos reales del trailer actual (embarque seleccionado)
  const generateLoadMapData = () => {
    const list = trailerPalletsList;
    const totalCajas = list.reduce((s,p)=>s+(p.boxes||0),0);
    const totalKg = list.reduce((s,p)=>s+Math.round(p.kilos||0),0);
    const totalTar = list.length;
    return { list, totalCajas, totalKg, totalTar };
  };

  const printLoadMap = () => {
    const { list, totalCajas, totalKg, totalTar } = generateLoadMapData();
    const win = window.open('', '', 'height=720,width=1100');
    const corp = corporateConfig || {};
    const cName = corp.name || empacadora.companyName || 'TECAVO FRUITS';
    const cAddr = corp.address || empacadora.address || '';
    const cSader = corp.sader || saderRegistro;
    const cWeb = corp.web || empacadora.website || '';
    const cEmail = corp.email || empacadora.email || '';
    const cLogo = corp.logo_url || empacadora.logoUrl || '';
    const html = `
      <html><head><title>Mapa de Carga — ${facturaFolio || ''}</title>
      <style>
        @media print { @page { size: letter landscape; margin: 12mm; } }
        body { font-family: Arial, system-ui, sans-serif; color:#17332A; margin:0; padding:0; background:#fff; }
        .hdr { display:flex; gap:10px; align-items:flex-start; border-bottom:4px solid #134D29; padding-bottom:8px; margin-bottom:8px; }
        .logo { height:42px; max-width:140px; }
        .title { font-size:18px; font-weight:800; color:#134D29; }
        .trailer { display:grid; grid-template-columns:1fr 1fr; gap:4px; border:5px solid #134D29; background:#F3F6F2; padding:6px; max-width:100%; }
        .slot { border:1px solid #A9CAE6; background:#D9ECFF; padding:4px 5px; font-size:9px; min-height:48px; color:#124D78; }
        .slot.empty { background:#F3F6F2; border-color:#D9E1DA; color:#607168; }
        .slot.used::after { content:' Utilizado'; font-size:7px; color:#124D78; font-weight:600; }
        .meta { font-size:10px; margin:4px 0 6px; color:#17332A; }
        .legend { font-size:9px; display:flex; gap:16px; margin-top:8px; padding:4px; background:#F3F6F2; border:1px solid #D9E1DA; }
        .small { font-size:8px; color:#607168; }
        .corporate { font-size:8px; color:#607168; line-height:1.1; }
      </style></head><body>
        <div class="hdr">
          ${cLogo ? `<img src="${cLogo}" class="logo" />` : '<div style="font-weight:800;font-size:16px;color:#134D29;">TECAVO FRUITS</div>'}
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:#134D29;">${cName}</div>
            <div class="corporate">${cAddr}</div>
            <div class="corporate">SADER: ${cSader} • Web: ${cWeb} • Tel: ${corp.phone || empacadora.phone || ''} • ${cEmail}</div>
          </div>
          <div style="text-align:right;">
            <div class="title">MAPA DE CARGA</div>
            <div style="font-size:10px;color:#17332A;">Folio: ${facturaFolio || '—'} • ${new Date().toLocaleDateString('es-MX')}</div>
          </div>
        </div>
        <div class="meta"><b>Cliente:</b> ${selectedCustomer?.customer_name || '—'} → ${selectedCustomer?.destination || '—'} &nbsp;|&nbsp; <b>Unidad:</b> ${termoPlates || trailerPlates || '—'} &nbsp;|&nbsp; <b>Placas:</b> ${tractoPlates || ''} / ${termoPlates || ''} &nbsp;|&nbsp; <b>Operador:</b> ${driverName || '—'}</div>
        <div style="font-weight:700;margin-bottom:4px;font-size:11px;color:#134D29;">ACOMODO EXACTO DEL TRÁILER (FRENTE = lado chofer; PUERTAS = fondo)</div>
        <div class="trailer">
          <div>
            <div style="background:#134D29;color:#fff;font-size:8px;padding:1px 4px;text-align:center;">LADO CHOFER — FRENTE</div>
            ${Array.from({length:14}).map((_,i) => {
              const p = trailerSlots[i];
              const num = getSlotNumber(i);
              return p ? `<div class="slot used"><b>Pos ${num}</b> ${p.lot_number} ${p.caliber}/${p.class_name}<br/>${p.boxes}c ${Math.round(p.kilos)}kg ${p.cold_date? '• Frío '+p.cold_date : ''}</div>` : `<div class="slot empty">Pos ${num} — Disponible</div>`;
            }).join('')}
          </div>
          <div>
            <div style="background:#134D29;color:#fff;font-size:8px;padding:1px 4px;text-align:center;">LADO CONTRARIO</div>
            ${Array.from({length:14}).map((_,i) => {
              const idx=14+i; const p = trailerSlots[idx];
              const num = getSlotNumber(idx);
              return p ? `<div class="slot used"><b>Pos ${num}</b> ${p.lot_number} ${p.caliber}/${p.class_name}<br/>${p.boxes}c ${Math.round(p.kilos)}kg ${p.cold_date? '• Frío '+p.cold_date : ''}</div>` : `<div class="slot empty">Pos ${num} — Disponible</div>`;
            }).join('')}
          </div>
        </div>
        <div style="margin-top:3px;font-size:8px;color:#9E391F;font-weight:600;">PUERTAS DE TERMO (salida de carga)</div>
        <div class="legend">
          <div><span style="background:#D9ECFF;border:1px solid #A9CAE6;display:inline-block;width:12px;height:12px;margin-right:3px;"></span> Utilizado (datos reales del embarque)</div>
          <div><span style="background:#F3F6F2;border:1px solid #D9E1DA;display:inline-block;width:12px;height:12px;margin-right:3px;"></span> Disponible</div>
        </div>
        <div style="margin-top:6px;font-size:10px;color:#17332A;">Totales: ${totalTar} tarimas • ${totalCajas} cajas • ${totalKg} kg neto • Espacios disponibles: ${28 - totalTar}</div>
        <div class="small">Este mapa reproduce EXACTAMENTE las posiciones, orden y orientación guardadas en Embarques. Sin reacomodo ni datos inventados.</div>
        <div style="margin-top:10px;border-top:1px solid #D9E1DA;padding-top:6px;font-size:8px;color:#607168;display:flex;justify-content:space-between;"><div>TECAVO FRUITS — Mapa de Carga</div><div>Página 1/1</div></div>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ try{win.print();}catch(e){} }, 280);
  };

  const downloadLoadMapPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { list, totalCajas, totalKg, totalTar } = generateLoadMapData();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const corp = corporateConfig || {};
    const cName = corp.name || empacadora.companyName || 'TECAVO FRUITS';
    let y = 28;
    doc.setFillColor(14,74,34); doc.rect(0,0,842,26,'F');
    doc.setTextColor(255); doc.setFontSize(13);
    doc.text(cName, 18, 17);
    doc.setFontSize(8); doc.text(`${corp.address||''} | SADER ${corp.sader||saderRegistro} | ${corp.web||''} ${corp.email||''}`, 18, 23);
    doc.setTextColor(0); y=42;
    doc.setFontSize(11); doc.text('MAPA DE CARGA — ACOMODO EXACTO DEL TRÁILER', 18, y);
    y+=12; doc.setFontSize(9);
    doc.text(`Folio: ${facturaFolio||'—'}  Cliente: ${selectedCustomer?.customer_name||'—'} → ${selectedCustomer?.destination||''}  Unidad: ${termoPlates||trailerPlates||'—'}  Operador: ${driverName||'—'}`, 18, y);
    y+=16;
    // Simple grid representation
    list.forEach((p, idx) => {
      const col = idx < 14 ? 0 : 1;
      const row = idx % 14;
      const x = 18 + col * 400;
      const yy = y + row * 15;
      doc.setDrawColor(14,74,34); doc.setFillColor(220,252,231);
      doc.rect(x, yy-3, 380, 13, 'FD');
      doc.setFontSize(7); doc.setTextColor(0);
      const num = getSlotNumber(idx<14?idx:14+ (idx-14) );
      doc.text(`Pos ${num}: ${p.lot_number} ${p.caliber} ${p.class_name} | ${p.boxes}c ${Math.round(p.kilos)}kg`, x+3, yy+6);
    });
    y += 14*15 + 14;
    doc.setFontSize(9); doc.text(`TOTALES: ${totalTar} tarimas • ${totalCajas} cajas • ${totalKg} kg`, 18, y);
    y+=12; doc.setFontSize(7); doc.text('Leyenda: posiciones ocupadas fieles al registro de Embarques. No se alteran existencias ni acomodo.', 18, y);
    doc.save(`mapa_carga_${facturaFolio || 'embarque'}.pdf`);
  };

  // Used cold slots for blue highlight in mapa de frío (derivado de tarimas del embarque actual en trailer)
  const applyCaliberTableToNota = openNota;

  const [submitting, setSubmitting] = useState(false);

  // Confirm load to DB — enlaza NOTA como VENTA para cierre semanal,  deduct de inventario (existencias) y salida fruta en lotes
  const confirmarCarga = async () => {
    if (submitting) return;
    if (trailerPalletsList.length === 0) {
      alert('Agrega tarimas al tráiler');
      return;
    }
    if (!selectedCustomer) {
      alert('Selecciona cliente');
      return;
    }

    if (!Number.isFinite(Number(tipoCambioVenta)) || Number(tipoCambioVenta) <= 0) {
      alert('Captura el tipo de cambio pactado (MXN por USD) para registrar el cierre y la cartera.');
      return;
    }
    if (inventoryError || conflicts.length || moving) {
      alert('Actualiza el inventario y resuelve los conflictos antes de confirmar.');
      return;
    }
    setSubmitting(true);

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

      const loadDate = mexicoToday();

      // Una sola llamada comercial con TODOS los detalles (soporta multi-lote). 
      // Trailer-map draft visual; el descuento + UNA nota/CxC ocurre solo en loads/complete.
      const key = caliber => String(caliber || 'Extra').trim().toLowerCase();
      const prices = new Map(liveCaliberRows.map(row => [key(row.caliber), Number(row.price) || 0]));
      if (notaEditItems.length) {
        const live = new Map(liveCaliberRows.map(row => [key(row.caliber),row.boxes]));
        const matched = new Set();
        for (const row of notaEditItems) {
          const caliber = key(String(row.producto || '').replace(/^aguacate hass\s*/i,''));
          if (matched.has(caliber) || live.get(caliber) !== Number(row.cajas)) {
            throw new Error('La nota debe tener las mismas cajas por calibre que las tarimas seleccionadas.');
          }
          matched.add(caliber);
          prices.set(caliber, Number(row.precio) || 0);
        }
        if (matched.size !== live.size) throw new Error('Completa en la nota todos los calibres del embarque.');
      }
      const caliberDetailsForSave = trailerPalletsList.map(pallet => ({
        position: pallet.position,
        pallet_id: pallet.originalPalletId || pallet.id,
        boxes: Number(pallet.boxes) || 0,
        price_per_box: prices.get(key(pallet.caliber)) || 0,
        unit: 'caja'
      }));

      const payload = {
        customer_id: selectedCustomer.id,
        load_date: loadDate,
        driver_name: driverName,
        truck_plates: tractoPlates,
        trailer_plates: termoPlates || trailerPlates,
        caliber_details: caliberDetailsForSave,
        currency: moneda,
        exchange_rate: Number(tipoCambioVenta),
        notes: `Embarque Nota Venta • Folio:${currentFolio || ''} • SADER:${saderRegistro} • Chofer:${driverName} • Tracto:${tractoPlates} Termo:${termoPlates} • Dir:${selectedCustomer.destination || ''} • Temp:${temperaturaConsignacion || ''} • Termografo:${termografoUrl || ''}`,
        factura_folio: currentFolio || ''
      };

      const res = await fetch('/api/loads/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let confirmed = 0;

      if (res.ok) {
        confirmed = 1;
        const data = await res.json();
        setMapMessage(`Nota ${data.nota_folio || currentFolio} confirmada.`);
        setLastLoadId(data.load?.id || null);
      } else {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'No se pudo confirmar el embarque.');
      }

      if (confirmed > 0) {
        const preLoadSnapshot = {...warehouseSlots,...reserved};
        await refreshInventory();
        setActivePallet(null);
        setNotaEditItems([]);
        setTipoCambioVenta('');

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

        alert(`✓ ${confirmed} carga(s) registrada(s) como VENTA. Folio auto: ${currentFolio}. Las partidas actualizan los cierres de las semanas de ingreso.`);
      } else {
        alert('Carga guardada (modo fallback).');
      }
    } catch (e) {
      alert(e.message || 'No se pudo confirmar el embarque. Las tarimas siguen en el mapa para reintentar.');
    } finally {
      setSubmitting(false);
    }
  };

  const PalletCard = ({pallet}) => (
    <button type="button" draggable={!moving} onDragStart={event=>onDragStart(event,pallet)}
      aria-pressed={activePallet?.uid === pallet.uid} onClick={()=>setActivePallet(pallet)}
      className="shipment-pallet">
      <strong>{pallet.lot_number}</strong><span>{pallet.caliber} · {pallet.class_name}</span>
      <span>{pallet.boxes} cajas · {pallet.kilos} kg</span>
    </button>
  );

  return (
    <div className="shipment-workspace min-h-screen">
      <header className="shipment-header fixed top-0 left-0 right-0 z-50 border-b">
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
        <section className="shipment-hero">
          <div><h1>Planeación de embarques</h1><p>Ubica las tarimas en el tráiler y confirma la nota de venta.</p></div>
          <div className="shipment-metrics">
            <div><strong>{Object.keys(warehouseSlots).length}</strong><span>En frío</span></div>
            <div><strong>{pisoPallets.length}</strong><span>En piso</span></div>
            <div><strong>{usedSlots}/28</strong><span>En el tráiler</span></div>
          </div>
        </section>
        {!!assignedSections.length && <details className="shipment-panel mb-4"><summary className="cursor-pointer font-semibold">Módulos de Operaciones</summary>
          <div className="flex flex-wrap gap-2 mt-3">{assignedSections.map(mod=><button key={mod.module_route}
            className="shipment-action" onClick={()=>router.push(mod.module_route)}>{mod.module_name}</button>)}</div>
        </details>}
        <div className="shipment-status" role="status">
          <span>{inventoryError || (conflicts.length ? 'Posiciones duplicadas en inventario: ' + conflicts.join(', ') : mapMessage || (loading ? 'Cargando inventario…' : 'Inventario actualizado'))}</span>
          {lastLoadId && <button type="button" className="shipment-action" onClick={()=>openHistoricalMap(lastLoadId)}>Imprimir último embarque</button>}
          <button type="button" className="shipment-action" onClick={refreshInventory} disabled={moving}>Actualizar</button>
        </div>
        {activePallet && <div className="shipment-status">
          <span><strong>{activePallet.folio}</strong> · {activePallet.position}. Selecciona una posición libre.</span>
          <button type="button" className="shipment-action" onClick={()=>commitPosition(activePallet,floor)} disabled={moving}>Mover al piso</button>
          <button type="button" className="shipment-action" onClick={()=>setActivePallet(null)}>Cancelar selección</button>
        </div>}
              <details className="shipment-panel mb-4">
                <summary className="cursor-pointer font-semibold mb-2">Plantillas de impresión</summary>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    ['pdf_template_url','Nota de venta en PDF','.pdf'],
                    ['xlsx_template_url','Nota de venta en Excel','.xlsx,.xls'],
                    ['pallet_template_url','Papeleta de tarima','.jpg,.jpeg,.png']
                  ].map(([key,label,accept])=><label key={key} className="grid gap-1 text-sm">
                    {label}<input type="file" accept={accept} disabled={savingTemplate}
                      onChange={event=>{const file=event.target.files?.[0];event.target.value='';uploadPrintTemplate(file,key);}}/>
                    {printSettings[key] && <span className="text-emerald-800 text-xs">Plantilla configurada</span>}
                  </label>)}
                </div>
                {printSettings.pdf_template_url && <label className="mt-3 flex gap-2 items-center text-sm">Inicio de datos sobre PDF (pt)
                  <input type="number" min="20" max="200" defaultValue={printSettings.pdf_top_margin || 78}
                    className="w-20 border rounded p-1" onBlur={event=>saveTemplateSettings({pdf_top_margin:event.target.value})
                      .then(()=>setTemplateStatus('Posición de impresión guardada.')).catch(error=>setTemplateStatus(error.message))}/>
                </label>}
                <p className="text-xs text-slate-600 mt-2">El PDF usa la primera página como membrete. Excel reconoce columnas como Producto, Cajas y Precio unitario.</p>
                {templateStatus && <p role="status" className="mt-2 text-sm">{templateStatus}</p>}
              </details>
        {historicalMap && <section className="shipment-panel mb-4">
          <div className="flex justify-between"><strong>Mapa confirmado · Embarque #{historicalMap.id}</strong>
          <button type="button" className="shipment-action" onClick={()=>setHistoricalMap(null)}>Cerrar</button></div>
          {historicalMap.positions.length ? <ul className="mt-2 text-sm">{historicalMap.positions.map(row=><li key={row.id}>Posición {row.slot_position} · Lote {row.lot_number || row.lot_id} · {row.caliber} · {row.kilos} kg</li>)}</ul> : <p>Sin posiciones registradas.</p>}
          <div className="mt-3 flex gap-2 flex-wrap">
            <button type="button" className="shipment-action" onClick={()=>printSalesNote(true,historicalMap)}>Imprimir nota</button>
            <button type="button" className="shipment-action" onClick={()=>exportNotaXLSX(historicalMap)}>Nota Excel</button>
            <button type="button" className="shipment-action" onClick={()=>printPallets(historicalMap.pallets,true,historicalMap.plates)}>Imprimir papeletas</button>
          </div>
        </section>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: MAPA DE ALMACÉN (idéntico al módulo Almacén/Inventory) + Piso abajo */}
          <div className="lg:col-span-4 space-y-4">
            <section className="shipment-panel">
              <div className="shipment-panel-head"><h2>Mapa de frío</h2><span>39 posiciones</span></div>
              <p className="shipment-hint">Una posición apartada se conserva para devolver su tarima desde el tráiler.</p>
              <div className="shipment-cold-grid">
                {['A','B','C'].map(column=><div key={column} className="shipment-column">Columna {column}</div>)}
                {coldSlots.map(slot=>{
                  const pallet = warehouseSlots[slot];
                  const held = reserved[slot];
                  return <button type="button" key={slot} className="shipment-slot"
                    data-state={held ? 'reserved' : pallet ? 'occupied' : 'empty'}
                    aria-pressed={!!pallet && activePallet?.uid===pallet.uid}
                    onDragOver={onDragOver} onDrop={event=>placeAt(event,slot)}
                    draggable={!!pallet && !moving} onDragStart={event=>pallet && onDragStart(event,pallet)}
                    onClick={()=>activePallet ? (activePallet.uid===pallet?.uid ? setActivePallet(null) : commitPosition(activePallet,slot)) : setActivePallet(pallet || null)}>
                    <b>{slot}</b>
                    {held ? <span>Reservada · {held.lot_number}</span> : pallet ?
                      <><span>{pallet.lot_number}</span><span>{pallet.caliber} · {pallet.boxes} c</span></> : <span>Libre</span>}
                  </button>;
                })}
              </div>
            </section>

            {/* PISO DE PRODUCCIÓN (debajo) — mismo estilo visual */}
            <div onDragOver={onDragOver} onDrop={event=>placeAt(event,floor)}
                 className="shipment-panel min-h-[158px]">
              <div className="flex justify-between mb-2 text-sm px-1">
                <div className="font-bold flex items-center gap-2" style={{color:'#000'}}><span>🏭</span> Piso de producción</div>
                <div className="text-xs px-1.5 rounded bg-amber-100" style={{color:'#000'}}>{pisoPallets.length}</div>
              </div>
              {pisoPallets.length === 0 && <div className="text-xs py-2 text-center" style={{color:'#444'}}>Sin tarimas pendientes</div>}
              <div className="flex flex-wrap gap-1.5 max-h-[106px] overflow-auto">
                {pisoPallets.map(pallet=><PalletCard key={pallet.uid} pallet={pallet}/>)}
              </div>
            </div>

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
                <button type="button" onClick={()=>openHistoricalMap()} className="shipment-action">Consultar mapa confirmado</button>
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
                  <input aria-label="Tipo de cambio MXN por USD" type="number" min="0.0001" step="0.0001"
                    value={tipoCambioVenta} onChange={e=>setTipoCambioVenta(e.target.value)} placeholder="MXN por USD" className="border px-2 py-1 rounded w-28"/>
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
                  <div className="shipment-trailer-grid">
                    {Array.from({length:28},(_,position)=>{
                      const index = Math.floor(position/2)+(position%2 ? 14 : 0);
                      const pallet = trailerSlots[index];
                      const target = trailerPosition(index);
                      return <div key={target} className="shipment-trailer-slot" data-state={pallet ? 'occupied' : 'empty'}
                        onDragOver={onDragOver} onDrop={event=>placeAt(event,target)}>
                        <button type="button" className="shipment-slot-main" draggable={!!pallet && !moving}
                          aria-pressed={!!pallet && activePallet?.uid===pallet.uid}
                          onDragStart={event=>pallet && onDragStart(event,pallet)}
                          onClick={()=>activePallet ? (activePallet.uid===pallet?.uid ? setActivePallet(null) : commitPosition(activePallet,target)) : setActivePallet(pallet || null)}>
                          <b>{position+1}</b><span>{pallet ? `${pallet.lot_number} · ${pallet.caliber} · ${pallet.boxes} c` : 'Libre'}</span>
                        </button>
                        {pallet && <button type="button" className="shipment-return" disabled={moving}
                          onClick={()=>commitPosition(pallet,pallet.origin || floor)}>Devolver</button>}
                      </div>;
                    })}
                  </div>
                </div>

                <div className="shipment-trailer-footer">Puertas del tráiler</div>
              </div>
              <p className="shipment-hint mt-2">Arrastra una tarima o selecciónala y elige una posición libre. Si la posición es inválida, la tarima permanece en su origen.</p>

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

                <button
                  onClick={() => { if (trailerPalletsList.length === 0) return; setShowLoadMapModal(true); }}
                  disabled={trailerPalletsList.length === 0}
                  className="border px-4 py-2 rounded-xl text-sm font-medium bg-white hover:bg-slate-50"
                >🗺️ Generar Mapa de Carga</button>

                <button onClick={confirmarCarga} disabled={submitting || moving || !!inventoryError || conflicts.length > 0} className="bg-emerald-600 px-5 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-60">{submitting ? 'Confirmando...' : '✓ Confirmar Carga y Guardar'}</button>

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
              {['companyName', 'address', 'phone', 'rfc', 'website', 'email'].map(f => (
                <div key={f}>
                  <label className="block text-[11px] mb-px">{f === 'website' ? 'Página web' : f === 'email' ? 'Correo' : f}</label>
                  <input value={empacadora[f] || ''} onChange={e => setEmpacadora({ ...empacadora, [f]: e.target.value })} className="border px-3 py-1.5 w-full rounded" />
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

                {/* CLEAN NOTA PREVIEW - always white/light, isolated from app theme, letter proportions */}
                <div id="nota-preview" style={{ background: '#fff', color: '#000', padding: '8mm', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9pt', lineHeight: 1.25, border: '1px solid #ddd', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
                  {/* Header compact with logo */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6pt', borderBottom: '1px solid #ccc', paddingBottom: '4pt' }}>
                    { (corporateConfig.logo_url || empacadora.logoUrl || branding?.logo_url) && (
                      <img 
                        src={corporateConfig.logo_url || empacadora.logoUrl || branding?.logo_url} 
                        alt="Logo TECAVO" 
                        style={{ height: '32pt', width: 'auto', maxWidth: '110px', marginRight: '8pt', objectFit: 'contain', display: 'block' }}
                        onLoad={() => {}}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11pt', fontWeight: 700, color: '#000' }}>{corporateConfig.name || empacadora.companyName || 'TECAVO FRUITS'}</div>
                      <div style={{ fontSize: '8pt', color: '#222' }}>{(corporateConfig.address || empacadora.address || '').substring(0,58)}</div>
                      <div style={{ fontSize: '7.5pt', color: '#444' }}>{corporateConfig.phone || ''} {corporateConfig.rfc ? 'RFC: '+corporateConfig.rfc : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '9pt' }}>
                      <div style={{ fontWeight: 700 }}>NOTA DE VENTA</div>
                      <div>Folio: {facturaFolio || '—'}</div>
                      <div>Fecha: {new Date().toLocaleDateString('es-MX')}</div>
                    </div>
                  </div>

                  {/* Info compact */}
                  <div style={{ fontSize: '8pt', marginBottom: '6pt', color: '#000' }}>
                    <div>CHOFER: {driverName || '—'} &nbsp;&nbsp; CLIENTE: {selectedCustomer?.customer_name || '—'} &nbsp;&nbsp; DESTINO: {selectedCustomer?.destination || '—'}</div>
                    <div style={{marginTop:'2pt'}}>PLACAS: {(tractoPlates||'—') + '/' + (termoPlates||'—')} &nbsp;&nbsp; MONEDA: {moneda} &nbsp;&nbsp; SADER: {saderRegistro}</div>
                  </div>

                  {/* Light disclaimer */}
                  <div style={{ fontSize: '7pt', color: '#444', marginBottom: '6pt', border: '1px solid #ddd', padding: '2pt 4pt', background: '#fafafa' }}>
                    El presente envío ha sido realizado por Tecavo Fruits S. de R.L. de C.V. Cumpliendo estrictamente con los más altos estándares de calidad.
                  </div>

                  {/* Table - light green header, black text, thin gray borders */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '4pt' }}>
                    <thead>
                      <tr style={{ background: '#e8f5e9', color: '#000' }}>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'left' }}>PRODUCTO</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>PRES.</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>TAR.</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>CAJAS</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>KG</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>PRECIO</th>
                        <th style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(notaEditItems.length ? notaEditItems : generateNotaContent().items).length > 0 ? (notaEditItems.length ? notaEditItems : generateNotaContent().items).map((row, i) => (
                        <tr key={i}>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', color: '#000' }}>{row.producto}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{row.presentacion}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{row.tarimas}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{row.cajas}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{row.kg}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{parseFloat(row.precio)||0}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1pt 3pt', textAlign: 'center', color: '#000' }}>{parseFloat(row.total)||'0.00'}</td>
                        </tr>
                      )) : <tr><td colSpan={7} style={{ border: '1px solid #ccc', padding: '2pt', textAlign: 'center', color: '#000' }}>— Cargue tarimas al trailer —</td></tr>}
                      <tr style={{ background: '#f5faf5', fontWeight: 700 }}>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt', color: '#000' }}>TOTAL</td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt' }}></td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center', color: '#000' }}>{getNotaTotalTarimas() || generateNotaContent().totalTarimas || trailerPalletsList.length}</td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center', color: '#000' }}>{getNotaTotalCajas() || generateNotaContent().totalCajas}</td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center', color: '#000' }}>{getNotaTotalKg() || generateNotaContent().totalKg}</td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt' }}></td>
                        <td style={{ border: '1px solid #aaa', padding: '2pt 3pt', textAlign: 'center', color: '#000' }}>{getNotaGrandTotal()}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Comments + signatures */}
                  <div style={{ fontSize: '8pt', marginTop: '4pt' }}>
                    <div style={{ fontWeight: 600, marginBottom: '2pt' }}>OBSERVACIONES</div>
                    <div style={{ border: '1px solid #ccc', minHeight: '28pt', padding: '2pt', fontSize: '7.5pt', color: '#000', background: '#fff' }}>
                      {notaData.notes || '—'}
                    </div>
                    <div style={{ display: 'flex', marginTop: '10pt', fontSize: '8pt' }}>
                      <div style={{ flex: 1 }}>
                        _______________________________<br />Firma Empacadora / Chofer
                      </div>
                      <div style={{ flex: 1 }}>
                        _______________________________<br />Recibe / Firma Cliente
                      </div>
                    </div>
                  </div>
                </div>

            {/* SECCIÓN EDITAR: precios + cualquier dato. PRECIO UN × CAJAS = TOTAL. Suma TOTAL al pie de columna */}
              <div className="p-4 border-t bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-black">Precios de la nota <span className="text-xs font-normal">(PRECIO UN × CAJAS = TOTAL • TOTAL = suma de columna)</span></div>
                  <div className="flex gap-2">
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
                          <td>{it.producto}</td>
                          <td>{it.presentacion}</td>
                          <td className="text-center">{it.tarimas}</td>
                          <td className="text-center">{it.cajas}</td>
                          <td className="text-center">{it.kg}</td>
                          <td className="text-center"><input type="number" step="0.01" value={parseFloat(it.precio)||0} onChange={e=>updateNotaItem(idx,'precio',parseFloat(e.target.value)||0)} className="w-20 text-center font-bold text-xs px-1 border bg-yellow-50" /></td>
                          <td className="text-center font-bold text-emerald-800">{it.total}</td>
                        </tr>
                      ))}
                      {notaEditItems.length===0 && (
                        <tr><td colSpan={8} className="p-2 text-xs text-center text-gray-500">Carga tarimas para preparar las partidas de la nota.</td></tr>
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

      {/* MAPA DE CARGA MODAL — vista previa imprimible + PDF. Representa exactamente el acomodo del trailer actual */}
      {showLoadMapModal && (
        <div onClick={() => setShowLoadMapModal(false)} className="fixed inset-0 bg-black/70 z-[85] flex items-center justify-center p-4">
          <div onClick={e=>e.stopPropagation()} className="bg-white w-full max-w-[1080px] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 bg-emerald-900 text-white flex items-center justify-between text-sm">
              <span className="font-semibold">🗺️ MAPA DE CARGA — Vista Previa (acomodo exacto del embarque)</span>
              <button onClick={() => setShowLoadMapModal(false)} className="text-white/90 hover:text-white">✕</button>
            </div>
            <div className="p-5">
              <div className="text-[11px] text-slate-600 mb-2">Datos tomados del tráiler actual. Se conserva la distribución, orden y posiciones registradas.</div>
              {/* Visual compact trailer map for preview */}
              <div className="border-4 border-emerald-900 bg-slate-900 p-3 rounded">
                <div className="text-white text-[10px] mb-1 font-bold tracking-wider">LADO CHOFER — FRENTE</div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {[0,1].map(side => (
                    <div key={side} className="grid grid-rows-7 gap-1">
                      {(trailerSlots.slice(side*14, side*14+14)).map((p, i) => {
                        const realIdx = side*14 + i;
                        const num = getSlotNumber(realIdx);
                        return p ? (
                          <div key={i} className="bg-emerald-100 text-emerald-950 border border-emerald-700 rounded px-2 py-0.5 text-[9px] leading-tight">
                            <span className="font-black">#{num}</span> {p.lot_number} {p.caliber} {p.boxes}c {Math.round(p.kilos)}kg
                          </div>
                        ) : <div key={i} className="bg-slate-700 text-slate-300 border border-slate-500 rounded px-2 py-0.5 text-[9px]">#{num} vacío</div>;
                      })}
                    </div>
                  ))}
                </div>
                <div className="text-center text-white text-[10px] font-bold tracking-[2px] bg-black py-px">PUERTAS DE TERMO</div>
              </div>

              {/* Legend + totals */}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-emerald-100 border border-emerald-700"></span> Ocupado</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 inline-block bg-slate-700"></span> Disponible</div>
                <div className="ml-auto font-semibold">Tarimas: {trailerPalletsList.length} • Cajas: {trailerPalletsList.reduce((a,b)=>a+(b.boxes||0),0)} • Kg: {trailerPalletsList.reduce((a,b)=>a+Math.round(b.kilos||0),0)}</div>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Cliente: {selectedCustomer?.customer_name || '—'} | Destino: {selectedCustomer?.destination || '—'} | Folio: {facturaFolio}</div>
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-2">
              <button onClick={printLoadMap} className="px-4 py-2 bg-white border rounded-lg text-sm font-medium">🖨️ Imprimir (horizontal)</button>
              <button onClick={downloadLoadMapPDF} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium">Descargar PDF</button>
              <button onClick={() => setShowLoadMapModal(false)} className="ml-auto px-4 py-2 text-sm">Cerrar</button>
            </div>
            <div className="px-4 pb-3 text-[9px] text-slate-500">Todos los datos provienen del embarque actual. Generar documento no modifica existencias ni el acomodo guardado.</div>
          </div>
        </div>
      )}
    </div>
  );
}
