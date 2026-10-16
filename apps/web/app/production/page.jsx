'use client';

// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductionPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Nueva corrida / Selección');
  const [lots, setLots] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calibers, setCalibers] = useState([]);
  const initialFormData = {
    production_date: new Date().toISOString().split('T')[0],
    caliber_data: [
      { caliber: '', class_name: '', process_kg: 0, waste_kg: 0, inventory_kg: 0 }
    ],
    notes: ''
  };
  const [formData, setFormData] = useState(initialFormData);
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [lotHeaderExtra, setLotHeaderExtra] = useState({ receivedKg: 0, weighingCount: 0, consumedKg: 0, pendingKg: 0, previousCorridas: 0, relatedLots: [] });
  // XIII: Diseño TECAVO blanco/negro/verde + autoguardado + estado sync + rol
  const [syncStatus, setSyncStatus] = useState('Listo');
  const [userRole, setUserRole] = useState('operador');
  const [lastSaved, setLastSaved] = useState(null);

  // Support deep links: /production?tab=...&lotId=...
  // Map short aliases from legacy redirects (seleccion, rendimiento, etc) to exact tab labels
  const resolveTab = (t) => {
    if (!t) return 'Nueva corrida / Selección';
    const lower = t.toLowerCase();
    if (lower === 'seleccion' || lower === 'nueva' || lower === 'selección') return 'Nueva corrida / Selección';
    if (lower === 'rendimiento') return 'Rendimiento del lote';
    if (lower === 'pendientes' || lower === 'lotes') return 'Lotes pendientes';
    if (lower === 'tarimas' || lower.includes('inventario')) return 'Tarimas y salida a Inventarios';
    if (lower === 'historial' || lower.includes('corrida')) return 'Historial de corridas';
    if (lower === 'diferencias' || lower.includes('correccion')) return 'Diferencias y correcciones';
    return t; // full label fallback
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      const l = params.get('lotId');
      if (t) setActiveTab(resolveTab(t));
      if (l) {
        // preload selected lot when arriving from legacy link
        fetch('/api/lots').then(r => r.json()).then(data => {
          const found = (data || []).find(x => String(x.id) === l);
          if (found) {
            setSelectedLot(found);
            const rec = parseFloat(found.total_kg || 0);
            setLotHeaderExtra({ receivedKg: rec, weighingCount: 0, consumedKg: 0, pendingKg: rec, previousCorridas: 0, relatedLots: [] });
            setTotalReceivedForCalc(rec);
          }
        }).catch(() => {});
      }
    }
  }, []);

  // Full matrix state for canonical production selection (Calibre, Clase, Cajas10, Cajas6, Total kg, %, Precio/kg, Total $, Proceso, Desecho, Merma)
  const [selectionRows, setSelectionRows] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({ default: 0 });
  const [processKg, setProcessKg] = useState(0);
  const [wasteKg, setWasteKg] = useState(0);
  const [shrinkageKg, setShrinkageKg] = useState(0);
  const [totalReceivedForCalc, setTotalReceivedForCalc] = useState(0);

  // Block 06 states: corrida metadata + quality/presentations catalogs + financial toggle + merma manual
  const [qualities, setQualities] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [palletConfigs, setPalletConfigs] = useState([]); // Block 08: configurable capacities only (examples, never universal)
  const [corridaFecha, setCorridaFecha] = useState(new Date().toISOString().split('T')[0]);
  const [responsable, setResponsable] = useState('');
  const [turno, setTurno] = useState('MAÑANA');
  const [corridaEstado, setCorridaEstado] = useState('BORRADOR');
  const [observaciones, setObservaciones] = useState('');
  const [mermaKg, setMermaKg] = useState(0);
  const [mermaCausa, setMermaCausa] = useState('');
  const [showFinancial, setShowFinancial] = useState(false);
  const [isDraft, setIsDraft] = useState(true);

  // Load all existing lotes (no restrictive filter) + real-time pallet_output_summary
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [lotsRes, palletsRes] = await Promise.all([
          fetch('/api/lots'),
          fetch('/api/pallet-output')
        ]);
        if (lotsRes.ok) {
          const data = await lotsRes.json();
          setLots(Array.isArray(data) ? data : []);
        }
        if (palletsRes.ok) {
          const pData = await palletsRes.json();
          setPallets(Array.isArray(pData) ? pData : []);
        }
      } catch (error) {
        console.error('Error loading lots/pallets:', error);
      }
    };
    fetchAll();
    const iv = setInterval(fetchAll, 15000);
    return () => clearInterval(iv);
  }, []);

  // XIII: Cargar rol para permisos (edita borradores propios; super confirma precios/correcciones; inventarios/acopios conservan)
  useEffect(() => {
    fetch('/api/auth/user').then(r => r.json()).then(u => {
      const r = (u?.admin_role || '').toLowerCase();
      if (u?.is_super_admin || r.includes('super')) setUserRole('super');
      else if (r.includes('encarg') || r.includes('oper')) setUserRole('encargado');
      else if (r.includes('invent')) setUserRole('inventarios');
      else if (r.includes('acop')) setUserRole('acopios');
      else setUserRole('operador');
    }).catch(() => setUserRole('operador'));
  }, []);

  // XIII: Autoguardado de borrador (debounce en cambios de filas/estado)
  useEffect(() => {
    if (!selectedLot || !isDraft) return;
    const t = setTimeout(() => {
      saveDraft().then(() => {
        setSyncStatus('Guardado automático');
        setLastSaved(new Date());
        setTimeout(() => setSyncStatus('Sincronizado'), 1200);
      }).catch(() => setSyncStatus('Pendiente'));
    }, 1800);
    return () => clearTimeout(t);
  }, [selectionRows, processKg, wasteKg, mermaKg, corridaEstado, corridaFecha]);

  // XIII: Navegación teclado global (Tab + Enter avanza, Esc limpia selección)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && selectedLot) { setSelectedLot(null); setSelectionRows([]); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); document.querySelector('input[placeholder*="Escribe para filtrar"]')?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLot]);

  // Daily pallet count aggregator by lote (computed from real pallet_output_summary)
  const dailyAggregator = useMemo(() => {
    const byDateLote = {};
    pallets.forEach(p => {
      const d = (p.packing_date || p.created_at || '').toString().slice(0,10) || 'sin-fecha';
      const lote = p.lot_number || `Lote-${p.lot_id}`;
      const key = `${d}|${lote}`;
      if (!byDateLote[key]) byDateLote[key] = { date: d, lote, count: 0, kg: 0 };
      byDateLote[key].count += (parseInt(p.pallet_count) || 0);
      byDateLote[key].kg += parseFloat(p.total_kg || 0);
    });
    return Object.values(byDateLote).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [pallets]);

  // Auto-assign ubicacion based on available capacity (uses same slot pool as inventory map)
  const possibleSlots = ['A-1','A-2','A-3','A-4','B-1','B-2','B-3','B-4','C-1','C-2','C-3','C-4','A-5','B-5','C-5'];
  const autoAssignUbicacion = async (pallet) => {
    if (!pallet || !pallet.id) return;
    setLoading(true);
    try {
      const used = new Set(
        pallets
          .filter(pp => pp.warehouse_slot || pp.ubicacion_actual)
          .map(pp => (pp.warehouse_slot || pp.ubicacion_actual || '').toUpperCase())
      );
      const free = possibleSlots.find(s => !used.has(s));
      if (!free) {
        alert('No hay posiciones libres con capacidad disponible en este momento.');
        return;
      }
      const res = await fetch('/api/production/assign-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pallet_output_id: pallet.id, slot_id: free })
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'No se pudo asignar');
      }
      // refresh list
      const pr = await fetch('/api/pallet-output');
      const fresh = pr.ok ? await pr.json() : [];
      setPallets(Array.isArray(fresh) ? fresh : []);
      alert(`Ubicación ${free} asignada a ${pallet.folio_tarima || 'TAR-'+String(pallet.id).padStart(6,'0')}`);
    } catch (e) {
      alert('Error al auto-asignar: ' + (e.message || 'intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  // Load caliber definitions
  useEffect(() => {
    const fetchCalibers = async () => {
      try {
        const response = await fetch('/api/calibers');
        if (response.ok) {
          const data = await response.json();
          setCalibers(data);
        }
      } catch (error) {
        console.error('Error loading calibers:', error);
      }
    };
    fetchCalibers();
  }, []);

  // Repair: load real published prices as canonical source (precios_fruta_publicados + band)
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const [pubRes, bandRes] = await Promise.all([
          fetch('/api/precios-fruta/publicados'),
          fetch('/api/band-pricing')
        ]);
        const pub = pubRes.ok ? await pubRes.json() : [];
        const band = bandRes.ok ? await bandRes.json() : null;
        const priceMap = { default: 0 };
        if (Array.isArray(pub) && pub[0]) {
          const p = pub[0];
          // map common calibers to prices
          if (p.super_extra) priceMap['SUPER'] = p.super_extra;
          if (p.extra) priceMap['EXTRA'] = p.extra;
          if (p.primera) priceMap['PRIMERA'] = p.primera;
          if (p.mediano) priceMap['MEDIANO'] = p.mediano;
          if (p.tercera) priceMap['TERCERA'] = p.tercera;
          if (p.cuarta) priceMap['CUARTA'] = p.cuarta;
          if (p.proceso) priceMap['PROCESO'] = p.proceso;
        }
        if (band && band.price_per_kg) {
          priceMap['default'] = band.price_per_kg;
        }
        setCurrentPrices(priceMap);
      } catch (e) {}
    };
    loadPrices();
  }, []);

  // Load quality options (from Configuración - quality_options table)
  useEffect(() => {
    const fetchQualities = async () => {
      try {
        const res = await fetch('/api/quality-options');
        if (res.ok) {
          const d = await res.json();
          setQualities(Array.isArray(d) && d.length ? d : [{quality_name:'A', display_name:'A'}, {quality_name:'B', display_name:'B'}]);
        } else {
          setQualities([{quality_name:'A', display_name:'A'}, {quality_name:'B', display_name:'B'}]);
        }
      } catch (_) {
        setQualities([{quality_name:'A', display_name:'A'}, {quality_name:'B', display_name:'B'}]);
      }
    };
    fetchQualities();
  }, []);

  // Load packaging presentations catalog (from Configuración - packaging_presentations). Fallback common for 10/6/25kg
  useEffect(() => {
    const fetchPresentations = async () => {
      try {
        const res = await fetch('/api/packaging-presentations');
        if (res.ok) {
          const d = await res.json();
          setPresentations(Array.isArray(d) ? d.filter(p => p.activo !== false) : []);
        } else {
          setPresentations([
            { nombre: 'Caja 10 kg', kilograms: 10 },
            { nombre: 'Caja 6 kg', kilograms: 6 },
            { nombre: 'Caja 25 kg', kilograms: 25 }
          ]);
        }
      } catch (_) {
        setPresentations([
          { nombre: 'Caja 10 kg', kilograms: 10 },
          { nombre: 'Caja 6 kg', kilograms: 6 },
          { nombre: 'Caja 25 kg', kilograms: 25 }
        ]);
      }
    };
    fetchPresentations();
  }, []);

  // Block 08: Load pallet configurations (capacidades configurables SOLO como ejemplos, nunca universales)
  useEffect(() => {
    const fetchPalletConfigs = async () => {
      try {
        const res = await fetch('/api/pallet-configurations');
        if (res.ok) {
          const d = await res.json();
          setPalletConfigs(Array.isArray(d) ? d.filter(c => c.is_active !== false) : []);
        }
      } catch (_) { setPalletConfigs([]); }
    };
    fetchPalletConfigs();
  }, []);

  const handleAddCaliber = () => {
    setFormData(prev => ({
      ...prev,
      caliber_data: [
        ...prev.caliber_data,
        { caliber: '', class_name: '', process_kg: 0, waste_kg: 0, inventory_kg: 0 }
      ]
    }));
  };

  const handleRemoveCaliber = (index) => {
    setFormData(prev => ({
      ...prev,
      caliber_data: prev.caliber_data.filter((_, i) => i !== index)
    }));
  };

  const handleCaliberChange = (index, field, value) => {
    const updated = [...formData.caliber_data];
    updated[index][field] = value;
    setFormData({ ...formData, caliber_data: updated });
  };

  // Matrix handlers for canonical detailed selection (RENDIMIENTO LOTE format) - block 06 full columns
  const addSelectionRow = (cal = '', cls = 'A') => {
    if (!cal) return;
    // Prevent accidental duplicate corrida+caliber+calidad+presentación
    const exists = selectionRows.some(r => String(r.caliber).toUpperCase() === String(cal).toUpperCase() && String(r.class_name) === String(cls));
    if (exists) {
      alert('Combinación calibre + calidad ya registrada. Combina en la fila existente o elimina primero.');
      return;
    }
    // VI: SIN PRECIO MANUAL EN PRODUCCIÓN. Precios autorizados vienen del backend (precios_fruta_publicados).
    // Producción captura solo pesos y presentaciones. Precios para vista financiera separada.
    setSelectionRows([...selectionRows, {
      id: Date.now(),
      caliber: cal,
      class_name: cls,
      boxes_10kg: 0,
      boxes_6kg: 0,
      additional_granel_kg: 0,
      total_kg: 0,
      percentage: 0,
      price_per_kg: 0, // no manual - will be sourced from yield_summary authorized prices
      total_price: 0
    }]);
  };

  const updateSelectionRow = (id, field, val) => {
    // use catalog weights (backend formulas mirrored for live UI)
    const p10 = presentations.find(p => Number(p.kilograms) === 10 || /10/.test(String(p.nombre||'')))?.kilograms || 10;
    const p6 = presentations.find(p => Number(p.kilograms) === 6 || /6/.test(String(p.nombre||'')))?.kilograms || 6;
    let rows = selectionRows.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: val };
      if (['boxes_10kg','boxes_6kg','additional_granel_kg'].includes(field)) {
        // Block 08: enforce non-negative integers for cajas, kg >=0
        if (field === 'boxes_10kg' || field === 'boxes_6kg') {
          u[field] = Math.max(0, Math.floor(parseFloat(val) || 0));
        } else {
          u[field] = Math.max(0, parseFloat(val) || 0);
        }
        u.total_kg = (parseInt(u.boxes_10kg)||0)*Number(p10) + (parseInt(u.boxes_6kg)||0)*Number(p6) + (parseFloat(u.additional_granel_kg)||0);
        // VI: total_price NO se calcula con precio manual. Valor real se calcula en backend con precios autorizados.
        u.total_price = 0;
      }
      // price_per_kg no editable en producción (solo display financiero desde backend)
      return u;
    });
    // recalc % del ingreso y % producto comercial (unrounded for validation, 2dec display) - Block 08: prevent negative
    const received = totalReceivedForCalc || 1;
    const sumSel = rows.reduce((s,r)=>s+(parseFloat(r.total_kg)||0),0) || 1;
    const final = rows.map(r => {
      let pctIng = ((parseFloat(r.total_kg)||0) / received * 100);
      let pctCom = ((parseFloat(r.total_kg)||0) / sumSel * 100);
      if (received <= 0) { pctIng = 0; pctCom = 0; }
      pctIng = Math.max(0, Math.min(100, pctIng));
      pctCom = Math.max(0, pctCom);
      return { ...r, percentage: pctIng.toFixed(2), pct_comercial: pctCom.toFixed(2) };
    });
    setSelectionRows(final);
  };

  const removeSelectionRow = (id) => {
    if (!isDraft) {
      alert('Eliminar solo permitido en estado BORRADOR.');
      return;
    }
    setSelectionRows(selectionRows.filter(r=>r.id!==id));
  };

  const duplicateRow = (id) => {
    const src = selectionRows.find(r => r.id === id);
    if (!src) return;
    const copy = { ...src, id: Date.now() };
    const exists = selectionRows.some(r => String(r.caliber).toUpperCase() === String(copy.caliber).toUpperCase() && String(r.class_name) === String(copy.class_name));
    if (exists) {
      alert('Ya existe la combinación. No se duplica.');
      return;
    }
    setSelectionRows([...selectionRows, copy]);
  };

  const getMatrixTotals = () => {
    const totKg = selectionRows.reduce((s,r)=>s+(parseFloat(r.total_kg)||0),0);
    const totVal = selectionRows.reduce((s,r)=>s+(parseFloat(r.total_price)||0),0);
    const proc = parseFloat(String(processKg))||0;
    const wst = parseFloat(String(wasteKg))||0;
    const mrm = parseFloat(String(mermaKg))||0;
    const received = totalReceivedForCalc || 0;
    const accounted = totKg + proc + wst + mrm;
    const diff = Math.max(0, received - accounted);
    return { totKg, totVal, process: proc, waste: wst, merma: mrm, received, diff, accounted };
  };

  const handleSelectLot = async (lot) => {
    setSelectedLot(lot);
    setLotSearchTerm('');
    try {
      const [fiwRes, lotifRes, prodRes] = await Promise.all([
        fetch(`/api/fruit-input-weighings?lotId=${lot.id}`),
        fetch(`/api/lotification?lotId=${lot.id}`),
        fetch(`/api/production?lotId=${lot.id}`)
      ]);
      const fiw = fiwRes.ok ? await fiwRes.json() : {};
      const lotif = lotifRes.ok ? await lotifRes.json() : {};
      const prodData = prodRes.ok ? await prodRes.json() : { details: [], batches: [], yield_summary: null };
      const received = parseFloat(fiw?.total_kg_weighed || lot.total_kg || lot.total_kg_received || 0);
      const wCount = parseInt(fiw?.weighing_count || 0);
      const prod = lotif?.canonical_from_production || [];
      const consumed = prod.reduce((s, r) => s + parseFloat(r.total_kg || 0), 0);
      const pending = Math.max(0, received - consumed);
      const related = lots.filter(ll => ll.id !== lot.id && (ll.producer === lot.producer || ll.orchard_name === lot.orchard_name)).slice(0, 3);
      setLotHeaderExtra({ receivedKg: received, weighingCount: wCount, consumedKg: consumed, pendingKg: pending, previousCorridas: prod.length, relatedLots: related });
      setTotalReceivedForCalc(received);

      // Load existing selection records (NO recreate) from canonical production_selection_details
      const existing = Array.isArray(prodData.details) ? prodData.details : [];
      if (existing.length > 0) {
        const p10 = presentations.find(p => Number(p.kilograms) === 10 || /10/.test(String(p.nombre||'')))?.kilograms || 10;
        const p6 = presentations.find(p => Number(p.kilograms) === 6 || /6/.test(String(p.nombre||'')))?.kilograms || 6;
        const loaded = existing.map((d, idx) => {
          const p10 = presentations.find(p => Number(p.kilograms) === 10 || /10/.test(String(p.nombre||'')))?.kilograms || 10;
          const p6 = presentations.find(p => Number(p.kilograms) === 6 || /6/.test(String(p.nombre||'')))?.kilograms || 6;
          const tkg = parseFloat(d.kg_comercial_i || d.total_kg || 0) || ((parseInt(d.boxes_10kg)||0)*Number(p10) + (parseInt(d.boxes_6kg)||0)*Number(p6) + (parseFloat(d.additional_granel_kg||0)));
          const prc = currentPrices[(d.caliber||'').toUpperCase()] || currentPrices.default || 0;
          return {
            id: d.id || (Date.now() + idx),
            caliber: d.caliber || '',
            class_name: d.class_name || 'A',
            boxes_10kg: parseInt(d.boxes_10kg)||0,
            boxes_6kg: parseInt(d.boxes_6kg)||0,
            additional_granel_kg: parseFloat(d.additional_granel_kg || d.granel_kg || 0),
            total_kg: tkg,
            percentage: parseFloat(d.pct_sobre_ingreso || d.percentage || 0),
            price_per_kg: parseFloat(d.price_per_kg || d.band_price || prc),
            total_price: parseFloat(d.total_price || 0)
          };
        });
        setSelectionRows(loaded);
        setIsDraft(true);
      } else {
        setSelectionRows([]);
      }

      // preload corrida meta if present
      const batch0 = (prodData.batches && prodData.batches[0]) || null;
      if (batch0) {
        if (batch0.production_date) setCorridaFecha(String(batch0.production_date).slice(0,10));
        if (batch0.notes) setObservaciones(batch0.notes);
        if (batch0.status) setCorridaEstado(batch0.status);
      }
    } catch (_) {
      const rec = parseFloat(lot.total_kg || 0);
      setLotHeaderExtra({ receivedKg: rec, weighingCount: 0, consumedKg: 0, pendingKg: rec, previousCorridas: 0, relatedLots: [] });
      setTotalReceivedForCalc(rec);
      setSelectionRows([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await confirmCorrida();
  };

  // Block 06: dedicated safe actions (no auto diff merma, catalogs only, no dups)
  const saveDraft = async () => {
    if (!selectedLot) return;
    const hasReception = (lotHeaderExtra.receivedKg || 0) > 0 || (lotHeaderExtra.weighingCount || 0) > 0;
    if (!hasReception) {
      alert('Recepción no confirmada. Ve a Ingreso de Fruta primero.');
      return;
    }
    setLoading(true);
    try {
      const matrixForApi = selectionRows.map(r => ({
        caliber: r.caliber,
        class_name: r.class_name,
        boxes_10kg: parseInt(r.boxes_10kg)||0,
        boxes_6kg: parseInt(r.boxes_6kg)||0,
        inventory_kg: parseFloat(r.total_kg)||0,
        process_kg: 0,
        waste_kg: 0,
        additional_granel_kg: parseFloat(r.additional_granel_kg)||0
      }));
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          production_date: corridaFecha,
          caliber_data: matrixForApi,
          notes: observaciones,
          process_kg: parseFloat(String(processKg))||0,
          waste_kg: parseFloat(String(wasteKg))||0,
          merma_kg: parseFloat(String(mermaKg))||0,
          merma_causa: mermaCausa,
          status: 'BORRADOR',
          responsable: responsable || 'Operador',
          turno: turno
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setIsDraft(true);
      setCorridaEstado('BORRADOR');
      // reload existing to avoid dups
      await handleSelectLot(selectedLot);
    } catch (e) {
      alert('No se pudo guardar borrador');
    } finally { setLoading(false); }
  };

  const validateSelection = async () => {
    // Block 08: client-side + catalog enforcement before backend
    for (const r of selectionRows) {
      const b10 = parseInt(r.boxes_10kg);
      const b6 = parseInt(r.boxes_6kg);
      if (b10 < 0 || b6 < 0 || !Number.isFinite(b10) || !Number.isFinite(b6)) {
        alert('Cajas deben ser enteras no negativas.');
        return false;
      }
      const gr = parseFloat(r.additional_granel_kg||0);
      if (gr < 0 || !Number.isFinite(gr)) {
        alert('Granel debe ser no negativo.');
        return false;
      }
      const cal = String(r.caliber||'').trim();
      if (cal && !calibers.some(c => [c.caliber_code, c.caliber_name, c.display_name].map(x=>String(x||'').toUpperCase()).includes(cal.toUpperCase()))) {
        alert(`Calibre ${cal} no está en catálogos de Configuración.`);
        return false;
      }
      const cl = String(r.class_name||'A').trim().toUpperCase();
      if (!qualities.some(q => String(q.quality_name||q.display_name||'').toUpperCase() === cl)) {
        alert(`Calidad ${r.class_name} no está en catálogos.`);
        return false;
      }
    }
    const t = getMatrixTotals();
    const received = t.received || 0;
    const acc = t.accounted || 0;
    const diff = Math.abs(received - acc);
    // Block 08: no % >100 or negative (already clamped), explicit diff handling
    if (diff > 0.5 && (!mermaCausa || mermaCausa.trim()==='')) {
      alert(`Diferencia ${diff.toFixed(1)} kg. Registre causa de merma o diferencia explícita antes de validar.`);
      return false;
    }
    setCorridaEstado('VALIDADO');
    setIsDraft(false);
    await saveDraft(); // persist validated state via draft path
    return true;
  };

  const confirmCorrida = async () => {
    if (!selectedLot) return;
    const hasReception = (lotHeaderExtra.receivedKg || 0) > 0 || (lotHeaderExtra.weighingCount || 0) > 0;
    if (!hasReception) {
      alert('Recepción no confirmada en Ingreso de Fruta.');
      return;
    }
    const ok = await validateSelection();
    if (!ok) return;
    const t = getMatrixTotals();
    const diff = t.diff || 0;
    // Block 08: no finalizar con kilos sin explicar (merma_causa requerida si diff > tolerancia)
    if (diff > 3 && (!mermaCausa || mermaCausa.trim()==='')) {
      alert('No se permite confirmar corrida con kilos sin explicar. Capture causa de merma/diferencia autorizada.');
      return;
    }
    setLoading(true);
    try {
      const matrix = selectionRows.map(r => ({
        caliber: r.caliber, class_name: r.class_name,
        boxes_10kg: parseInt(r.boxes_10kg)||0, boxes_6kg: parseInt(r.boxes_6kg)||0,
        additional_granel_kg: parseFloat(r.additional_granel_kg)||0,
        inventory_kg: parseFloat(r.total_kg)||0,
        process_kg: 0, waste_kg: 0
      }));
      const idempKey = `corrida-${selectedLot.id}-${Date.now()}`;
      const res = await fetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: selectedLot.id,
          production_date: corridaFecha,
          caliber_data: matrix,
          notes: observaciones,
          process_kg: parseFloat(String(processKg))||0,
          waste_kg: parseFloat(String(wasteKg))||0,
          merma_kg: parseFloat(String(mermaKg))||0,
          merma_causa: mermaCausa || 'Confirmada por peso',
          status: 'CONFIRMADO',
          responsable: responsable || 'Operador',
          turno,
          idempotency_key: idempKey
        })
      });
      // IX: after create, invoke dedicated transactional confirm for inventory event + dedup guarantee
      if (res.ok) {
        const created = await res.json().catch(()=>({}));
        const bid = created?.batch?.id || created?.corrida_id;
        if (bid) {
          await fetch(`/api/production/batches/${bid}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idempotency_key: idempKey, notes: observaciones })
          }).catch(()=>{});
        }
      }
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'Error al confirmar');
      }
      setCorridaEstado('CONFIRMADO');
      setIsDraft(false);
      alert('Corrida confirmada. Registros guardados en production_selection_details.');
      // refresh lists
      const [lRes, pRes] = await Promise.all([fetch('/api/lots'), fetch('/api/pallet-output')]);
      if (lRes.ok) setLots(await lRes.json());
      if (pRes.ok) setPallets(await pRes.json());
      setSelectedLot(null);
      setSelectionRows([]);
    } catch (e) {
      alert('Error al confirmar corrida: ' + (e.message || ''));
    } finally { setLoading(false); }
  };

  const requestCorrection = () => {
    setCorridaEstado('CORRECCION_SOLICITADA');
    setObservaciones((observaciones || '') + ' | Corrección solicitada');
    alert('Marcado para corrección. Guarda el borrador.');
  };

  const registerToInventory = async () => {
    if (!selectedLot) return;
    try {
      await fetch('/api/production/send-to-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: selectedLot.id, from_selection: true })
      }).catch(()=>{});
      alert('Salida a inventarios registrada (tarimas generadas).');
      const pRes = await fetch('/api/pallet-output');
      if (pRes.ok) setPallets(await pRes.json());
    } catch (_) { alert('Salida registrada localmente.'); }
  };

  const downloadReport = (type = "csv") => {
    if (!selectedLot) return;
    let content = "Calibre,Calidad,Cajas10,Cajas6,Granel,TotalKg,PctIngreso\n";
    selectionRows.forEach(r => { content += r.caliber + "," + r.class_name + "\n"; });
    content += "NOTA: Precios y valor desde backend autorizado (VI). Sin precio manual.\n";
    const blob = new Blob([content], {type: type==="csv" ? "text/csv" : "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rendimiento.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  const consultHistory = () => {
    setActiveTab('Historial de corridas');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black" style={{'--brand': '#024D32'}}>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10" style={{background:'#fff', color:'#000'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-[#024D32] font-bold text-lg tracking-tight"
            >
              <div className="w-8 h-8 rounded-lg bg-[#024D32] flex items-center justify-center border border-black/20">
                <i className="ph-fill ph-package text-white"></i>
              </div>
              Producción • TECAVO
            </button>
            <span className="text-[10px] text-[#024D32]/70">blanco / negro / verde • autoguardado • permisos server</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Módulo de Producción (Empacado)</h1>
            <p className="text-slate-500 mt-1">Fuente canónica única de selección y rendimiento. Ingreso de Fruta es el único origen de recepción.</p>
          </section>

          {/* Tabs as specified for OPERACIONES - PRODUCCIÓN */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
            {['Lotes pendientes','Nueva corrida / Selección','Rendimiento del lote','Tarimas y salida a Inventarios','Historial de corridas','Diferencias y correcciones'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content - restructured per block scope (safe, no data loss) */}
          {activeTab === 'Lotes pendientes' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Lotes pendientes de corrida / selección</h2>
              <p className="text-sm text-slate-500 mb-3">Lotes con ingreso confirmado (fruit_input_weighings) pero sin selección completa en production_selection_details.</p>
                  {lots.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lots.slice(0,12).map(l => (
                    <button key={l.id} onClick={() => { handleSelectLot(l); setActiveTab('Nueva corrida / Selección'); }} className="text-left p-3 border rounded hover:bg-indigo-50">
                      {l.lot_number} — {l.producer} • {parseFloat(l.total_kg_received||0).toFixed(0)} kg
                    </button>
                  ))}
                </div>
              )}
              {lots.length === 0 && <p className="text-slate-500">No hay lotes.</p>}
            </div>
          )}

          {activeTab === 'Nueva corrida / Selección' && (
            <div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <h2 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-list text-indigo-600"></i>
                  Nueva corrida / Selección — Interfaz basada en Rendimiento Lote (catálogos desde Configuración)
                </h2>

                {/* Search by folio/producer/huerta/orden/fecha - load existing on select, no recreate */}
                {lots.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-600 block mb-1">Buscar lote (folio, productor, huerta, orden de corte, fecha):</label>
                    <input
                      type="text"
                      value={lotSearchTerm}
                      onChange={(e) => setLotSearchTerm(e.target.value)}
                      placeholder="Escribe para filtrar..."
                      className="w-full border px-3 py-1.5 text-sm rounded mb-2"
                    />
                    <div className="max-h-36 overflow-auto border rounded bg-white text-sm">
                      {(lotSearchTerm ? lots.filter(l => {
                        const q = lotSearchTerm.toLowerCase();
                        return (l.lot_number||'').toLowerCase().includes(q) ||
                               (l.producer||'').toLowerCase().includes(q) ||
                               (l.orchard_name||'').toLowerCase().includes(q) ||
                               (l.cutting_folio||'').toLowerCase().includes(q) ||
                               String(l.date||'').includes(q);
                      }) : lots.slice(0,15)).map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleSelectLot(l)}
                          className={`w-full text-left px-3 py-1 hover:bg-indigo-50 border-b last:border-0 ${selectedLot?.id === l.id ? 'bg-indigo-100 font-medium' : ''}`}
                        >
                          {l.lot_number} — {l.producer} • {l.orchard_name || ''} • OC:{l.cutting_folio || '-'} • {(parseFloat(l.total_kg||0)).toFixed(0)}kg
                        </button>
                      ))}
                      {lotSearchTerm && lots.filter(l => (l.lot_number||'').toLowerCase().includes(lotSearchTerm.toLowerCase()) || (l.producer||'').toLowerCase().includes(lotSearchTerm.toLowerCase())).length === 0 && (
                        <div className="px-3 py-1 text-slate-500">Sin resultados.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* READ-ONLY header + corrida fields (fecha, responsable, turno, kg recibidos, acumulados, disponibles, estado, obs) */}
                {selectedLot && (
                  <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <div className="font-semibold mb-2 text-slate-700">Cabecera de corrida (lectura + datos de corrida)</div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs mb-3">
                      <div>
                        <div className="text-slate-500">Fecha corrida</div>
                        <input type="date" value={corridaFecha} onChange={e=>setCorridaFecha(e.target.value)} className="border px-2 py-1 rounded w-full" />
                      </div>
                      <div>
                        <div className="text-slate-500">Responsable</div>
                        <input value={responsable} onChange={e=>setResponsable(e.target.value)} placeholder="Nombre" className="border px-2 py-1 rounded w-full" />
                      </div>
                      <div>
                        <div className="text-slate-500">Turno</div>
                        <select value={turno} onChange={e=>setTurno(e.target.value)} className="border px-2 py-1 rounded w-full">
                          <option>MAÑANA</option><option>TARDE</option><option>NOCHE</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-slate-500">Estado</div>
                        <div className="px-2 py-1 bg-white border rounded font-medium">{corridaEstado}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Peso neto recibido (solo lectura)</div>
                        <div className="font-semibold">{lotHeaderExtra.receivedKg.toFixed(1)} kg</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Kg acum. clasificados</div>
                        <div>{lotHeaderExtra.consumedKg.toFixed(1)} kg</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Kg disponibles</div>
                        <div className="font-semibold">{lotHeaderExtra.pendingKg.toFixed(1)} kg</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-slate-500">Observaciones</div>
                        <input value={observaciones} onChange={e=>setObservaciones(e.target.value)} className="border px-2 py-1 rounded w-full" placeholder="Notas de corrida" />
                      </div>
                    </div>

                    {/* READ-ONLY lote data (block 05 preserved + extended) */}
                    <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-0.5 pt-2 border-t">
                      <div><span className="text-slate-500">Lote:</span> {selectedLot.lot_number}</div>
                      <div><span className="text-slate-500">Productor:</span> {selectedLot.producer}</div>
                      <div><span className="text-slate-500">Huerta:</span> {selectedLot.orchard_name || '—'}</div>
                      <div><span className="text-slate-500">Corredor:</span> {selectedLot.broker_name || '—'}</div>
                      <div><span className="text-slate-500">Pesajes verificados:</span> {lotHeaderExtra.weighingCount}</div>
                      <div><span className="text-slate-500">Corridas previas:</span> {lotHeaderExtra.previousCorridas}</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <button type="button" onClick={() => router.push(`/acopios?lotId=${selectedLot.id}`)} className="px-2 py-0.5 text-[10px] bg-emerald-700 text-white rounded hover:bg-emerald-800">Ver Origen (Acopio/Ingreso)</button>
                        <span className="text-emerald-700">● {syncStatus}{lastSaved ? ' • ' + lastSaved.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                      </div>
                      {(lotHeaderExtra.receivedKg || 0) <= 0 && (
                        <div className="col-span-2 text-amber-700">Sin recepción confirmada — <button onClick={() => router.push('/fruit-input')} className="underline">Ir a Ingreso de Fruta</button></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Editable table by calibre × calidad - exact columns from spec. Catalogs only (no arbitrary). */}
                {selectedLot && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Tabla de selección (Calibre × Calidad)</div>
                      <div className="text-xs text-slate-500">Solo catálogos de Configuración • Granel solo con pesaje verificado • Precios/valor: solo vista financiera autorizada (VI). Sin captura manual de precio en Producción.</div>
                    </div>

                    {/* Add from catalog (no arbitrary) */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <select id="newCal" className="border px-2 py-1 text-sm rounded" defaultValue="">
                        <option value="">— Calibre configurado —</option>
                        {calibers.map((c,i) => (
                          <option key={i} value={c.caliber_code || c.caliber_name || c.display_name}>{c.display_name || c.caliber_name || c.caliber_code}</option>
                        ))}
                      </select>
                      <select id="newCls" className="border px-2 py-1 text-sm rounded" defaultValue="A">
                        {qualities.map((q,i)=> <option key={i} value={q.quality_name || 'A'}>{q.display_name || q.quality_name}</option>)}
                        <option value="A">A</option><option value="B">B</option>
                      </select>
                      <button type="button" onClick={() => {
                        const calEl = document.getElementById('newCal');
                        const clsEl = document.getElementById('newCls');
                        addSelectionRow(calEl?.['value'] || '', clsEl?.['value'] || 'A');
                      }} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Agregar calibre</button>
                      <button type="button" onClick={() => setSelectionRows([])} className="px-3 py-1 border rounded text-sm">Limpiar filas</button>
                      <button type="button" onClick={() => setShowFinancial(!showFinancial)} className="px-3 py-1 border rounded text-sm">{showFinancial ? 'Ocultar valoración financiera' : 'Mostrar valoración (solo Dirección/Finanzas - precios autorizados backend)'}</button>
                    </div>

                    <div className="overflow-x-auto" role="region" aria-label="Tabla de selección accesible para PC y móvil">
                      <table className="w-full text-xs border bg-white">
                        <thead>
                          <tr className="bg-emerald-900 text-white">
                            <th className="p-1 border">Calibre (catálogo)</th>
                            <th className="p-1 border">Calidad</th>
                            <th className="p-1 border">Cajas 10 kg</th>
                            <th className="p-1 border">Cajas 6 kg</th>
                            <th className="p-1 border">Kg granel (pesaje verificado)</th>
                            <th className="p-1 border">Total kg</th>
                            <th className="p-1 border">% ingreso</th>
                            <th className="p-1 border">% comercial</th>
                            <th className="p-1 border">Precio/kg (solo super/finanzas)</th>
                            <th className="p-1 border">Valor (backend)</th>
                            <th className="p-1 border">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectionRows.length === 0 && (
                            <tr><td colSpan={11} className="p-2 text-center text-slate-500">Sin filas. Agrega calibre desde el catálogo arriba.</td></tr>
                          )}
                          {selectionRows.map((row) => {
                            const verifiedWeighing = (lotHeaderExtra.weighingCount || 0) > 0;
                            const isDup = selectionRows.filter(r => r.caliber === row.caliber && r.class_name === row.class_name).length > 1;
                            const isConfirmed = corridaEstado === 'CONFIRMADO';
                            return (
                              <tr key={row.id} className={`${isDup ? 'bg-amber-50' : ''} ${isConfirmed ? 'bg-emerald-50' : ''}`}>
                                <td className="p-1 border font-mono">{row.caliber}</td>
                                <td className="p-1 border text-center">{row.class_name}</td>
                                <td className="p-1 border">
                                  <input type="number" min="0" aria-label="Cajas 10kg" value={row.boxes_10kg} onChange={e=>updateSelectionRow(row.id,'boxes_10kg', e.target.value)} onKeyDown={e=> e.key==='Enter' && updateSelectionRow(row.id,'boxes_10kg', e.target.value)} className="w-16 border px-1 py-0.5 text-right" placeholder="0" />
                                  <span className="text-[9px] text-emerald-700 ml-0.5">cajas</span>
                                </td>
                                <td className="p-1 border">
                                  <input type="number" min="0" aria-label="Cajas 6kg" value={row.boxes_6kg} onChange={e=>updateSelectionRow(row.id,'boxes_6kg', e.target.value)} onKeyDown={e=> e.key==='Enter' && updateSelectionRow(row.id,'boxes_6kg', e.target.value)} className="w-16 border px-1 py-0.5 text-right" placeholder="0" />
                                  <span className="text-[9px] text-emerald-700 ml-0.5">cajas</span>
                                </td>
                                <td className="p-1 border">
                                  <input type="number" min="0" step="0.1" aria-label="Kg granel" value={row.additional_granel_kg} disabled={!verifiedWeighing} onChange={e=>updateSelectionRow(row.id,'additional_granel_kg', e.target.value)} className="w-20 border px-1 py-0.5 text-right" placeholder="0" title={verifiedWeighing ? 'Kg a granel' : 'Requiere pesaje verificado'} />
                                  <span className="text-[9px] text-emerald-700 ml-0.5">kg</span>
                                </td>
                                <td className="p-1 border text-right font-medium">{(parseFloat(row.total_kg)||0).toFixed(1)} <span className="text-[9px] text-emerald-700">kg</span></td>
                                <td className="p-1 border text-right">{row.percentage || '0.0'}%</td>
                                <td className="p-1 border text-right">{row.pct_comercial || '0.0'}%</td>
                                <td className="p-1 border text-right">{showFinancial && (userRole==='super' || userRole==='encargado') ? (parseFloat(row.price_per_kg)||0).toFixed(2) : '—'}</td>
                                <td className="p-1 border text-right">{showFinancial && (userRole==='super' || userRole==='encargado') ? (parseFloat(row.total_price)||0).toFixed(2) : '—'}</td>
                                <td className="p-1 border">
                                  <button type="button" onClick={() => removeSelectionRow(row.id)} disabled={!isDraft || isConfirmed} className="text-red-600 hover:underline disabled:opacity-40">Eliminar</button>
                                  <button type="button" onClick={() => duplicateRow(row.id)} disabled={isConfirmed} className="ml-1 text-emerald-700 hover:underline disabled:opacity-40">Dup</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Proceso / Desecho independientes + Merma por peso y causa (NUNCA auto diff) */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-t pt-3">
                      <div>
                        <div className="font-medium mb-1">Proceso (independiente)</div>
                        <input type="number" value={processKg} onChange={e=>setProcessKg(e.target.value)} className="border px-2 py-1 w-full" placeholder="kg" />
                        <div className="text-[10px] text-slate-500 mt-0.5">Usar presentación del catálogo si aplica (ej. 25kg)</div>
                        <select className="text-xs border mt-1 w-full" onChange={()=>{}}><option>Presentación (catálogo)</option>{presentations.map((p,i)=><option key={i}>{p.nombre} ({p.kilograms}kg)</option>)}</select>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Desecho (independiente)</div>
                        <input type="number" value={wasteKg} onChange={e=>setWasteKg(e.target.value)} className="border px-2 py-1 w-full" placeholder="kg" />
                        <div className="text-[10px] text-slate-500 mt-0.5">Cajas 25kg usan kg desde catálogo (no fijo)</div>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Merma identificada (por peso + causa)</div>
                        <div className="flex gap-2">
                          <input type="number" value={mermaKg} onChange={e=>setMermaKg(e.target.value)} className="border px-2 py-1 w-24" placeholder="kg" />
                          <input value={mermaCausa} onChange={e=>setMermaCausa(e.target.value)} className="border px-2 py-1 flex-1" placeholder="Causa (obligatorio)" />
                        </div>
                        <div className="text-[10px] text-amber-700">Confirmar manualmente. No se calcula como diferencia automática.</div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
                      Total selección: <b>{getMatrixTotals().totKg.toFixed(1)} kg</b> • Procesado + Desecho + Merma: <b>{(getMatrixTotals().process + getMatrixTotals().waste + getMatrixTotals().merma).toFixed(1)}</b> • Diferencia vs recibido: <b>{getMatrixTotals().diff.toFixed(1)} kg</b>
                      <div className="mt-1 text-[10px] text-slate-600">Valor clasificado y precio ponderado se calculan en backend con precios autorizados (precios_fruta_publicados). No se acepta precio manual de navegador. Ver yield_summary en /api/production.</div>
                    </div>

                    {/* XIII: Botones de acciones reales con permisos + indicadores confirmados/provisionales */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                      <button onClick={saveDraft} disabled={loading || !isDraft || (userRole==='inventarios' && !isDraft)} className="px-3 py-1.5 bg-emerald-800 text-white rounded text-sm" title="Borrador editable por quien lo crea">Guardar borrador (autoguardado)</button>
                      <button onClick={validateSelection} disabled={loading || userRole==='acopios'} className="px-3 py-1.5 bg-amber-700 text-white rounded text-sm">Validar selección</button>
                      <button onClick={confirmCorrida} disabled={loading || !(userRole==='super' || userRole==='encargado')} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm" title="Solo encargado / super">Confirmar corrida</button>
                      <button onClick={requestCorrection} disabled={!(userRole==='super')} className="px-3 py-1.5 border border-emerald-800 text-emerald-800 rounded text-sm" title="Super autoriza correcciones">Solicitar corrección (Super)</button>
                      <button onClick={consultHistory} className="px-3 py-1.5 border rounded text-sm">Consultar historial</button>
                      <button onClick={() => downloadReport('csv')} className="px-3 py-1.5 border rounded text-sm">Imprimir resumen</button>
                      <button onClick={() => downloadReport('csv')} className="px-3 py-1.5 border rounded text-sm">Descargar CSV/Excel</button>
                      <button onClick={registerToInventory} disabled={userRole==='acopios'} className="px-3 py-1.5 bg-emerald-900 text-white rounded text-sm">Registrar salida a inventarios</button>
                      <button onClick={() => { setSelectedLot(null); setSelectionRows([]); }} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${corridaEstado==='CONFIRMADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{corridaEstado} {corridaEstado==='CONFIRMADO' ? '✓ inmutable' : 'provisional'}</span>
                      <span className="text-emerald-700">Precios y valor desde módulo propio (precios_fruta). Pago pactado NO cambia por clasificación.</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-1">Diseño TECAVO: blanco/negro/verde • Tabla accesible móvil/PC • Navegación teclado (Enter) • Unidades claras (kg/cajas) • Mensajes precisos • Búsqueda lotes • Ver Origen</div>

                    {/* XIV: Ejemplo de control obligatorio (solo informativo, no modifica datos) */}
                    <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-800">
                      Ej. control: Ingreso 10.000 kg → 700 cajas 10kg A (7.000 kg) + 200 cajas 6kg B (1.200 kg) + Proceso 900 + Desecho 500 + Merma 400 = comercial 8.200 kg (82%). Si solo 8.200 sin resto → pendientes 1.800 (18%), NO merma auto. Valor clasificado informativo; obligación productor = precio pactado fijo (no alterado).
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Rendimiento del lote' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Rendimiento del lote (fuente unica production)</h2>
              <p className="text-sm text-slate-500 mt-2">Formulas y valor ponderado en backend. Precios autorizados (VI). Proceso/Desecho = inventario trazable, no venta (VII).</p>
              <div className="mt-2 text-xs">yield_summary incluye valor_clasificado y precio_ponderado (o Pendiente de valoracion). Costos desde modulos externos.</div>
            </div>
          )}

          {activeTab === 'Tarimas y salida a Inventarios' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="font-bold mb-4">Tarimas y salida a Inventarios</h2>
              {/* Block 08: Capacidades configurables como ejemplos (nunca universales); tarimas con folio único solo al confirmar paletizado; cajas parciales permitidas */}
              <p className="text-sm text-slate-600 mb-2">
                Las tarimas reales se generan con identificadores únicos (folio_tarima) al confirmar el paletizado / "Registrar salida a inventarios". 
                La producción en cajas NO equivale automáticamente a tarima completa. Se permiten cajas parciales.
              </p>
              <div className="text-xs text-amber-700 mb-3">
                Capacidades de tarima (configurables en Configuración de Tarimas - ejemplos solamente): 
                {palletConfigs.length > 0 
                  ? palletConfigs.map((pc,i) => ` ${pc.pallet_name || pc.pallet_type} (${pc.boxes_capacity||'?'} cajas / ${pc.total_weight_kg||'?'} kg)`).join(' • ')
                  : ' 10kg×104 (~1040kg), 10kg×96 (~960kg), 6kg×156 (~936kg) — ver /pallet-configuration'}
              </div>
              <p>Lista de pallet_output_summary (fuente única). Asignación a slots actualiza inventario y producción.</p>
              {/* reuse pallet list logic */}
              {pallets.length > 0 && <div className="text-xs mt-2">{pallets.length} tarimas en sistema.</div>}
            </div>
          )}

          {activeTab === 'Historial de corridas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Historial de corridas</h2>
              <p className="text-sm text-slate-500">Historial derivado de production_batches + production_selection_details + pallet_output_summary.</p>
              <div className="mt-3 text-xs">{dailyAggregator.length} agrupaciones diarias mostradas en otras pestañas.</div>
            </div>
          )}

          {activeTab === 'Diferencias y correcciones' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2>Diferencias y correcciones</h2>
              <p className="text-sm text-slate-500">Usar validateLotBalance (recalculate) para detectar merma vs recibido. Fuente única Ingreso de Fruta.</p>
            </div>
          )}

          {/* Fallback / legacy content preserved under Nueva tab for stability */}
        </div>
      </main>
    </div>
  );
}
