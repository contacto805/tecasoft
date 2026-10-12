'use client';

import React, { useState, useEffect } from 'react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function AcopiosCampo() {
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [visits, setVisits] = useState([]);
  const [orchards, setOrchards] = useState([]);
  const [stats, setStats] = useState({});
  const [journeys, setJourneys] = useState({ journeys: [], fuels: [] });
  const [pedidosAcop, setPedidosAcop] = useState([]);
  const [cuttingOrders, setCuttingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState('acopiador');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [selectedAcopiador, setSelectedAcopiador] = useState(null);
  const [assignedSections, setAssignedSections] = useState([]);

  // Dynamic sections from Config de Modulos: only render sections assigned to this module's group
  const hasOrdenCorteSection = assignedSections.some(s => 
    (s.module_name || '').toLowerCase().includes('corte') || 
    (s.module_route || '').toLowerCase().includes('corte') || 
    (s.module_route || '').includes('cutting')
  );

  // Nueva visita form
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: new Date().toTimeString().slice(0,5),
    acopiador: currentUser,
    orchard_name: '',
    producer: '',
    broker: '',
    municipality: '',
    locality: '',
    state: 'Michoacán',
    lat: '', lng: '', alt: '',
    super_percent: 0, extra_percent: 0, primera_percent: 0, mediano_percent: 0,
    tercera_percent: 0, cuarta_percent: 0, canica_percent: 0, clase2_percent: 0,
    proceso_percent: 0, desecho_percent: 0,
    trees_productive: '', young_trees: '', hectares: '', est_kg: '', est_ton: '',
    observations: ''
  });
  const [photos, setPhotos] = useState([]); // {url, type, file?}
  const [negotiation, setNegotiation] = useState({ status: 'Prospecto', offered_price: '', pact_price: '', purchase_type: 'Campo', payment_form: 'Contado', tentative_cut_date: '', observations: '' });
  const [officialPrice, setOfficialPrice] = useState(null); // from central Definición de Precios Semanales
  const [flowers, setFlowers] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({ producer: '', broker: '', from: '', to: '', status: '' });
  const [availableCorredores, setAvailableCorredores] = useState([]);

  // Compute week data dynamically anchored to data (safe for invalid dates)
  const weekStartStr = (() => {
    try {
      let ts = Date.now();
      if (visits && visits.length) {
        const tsList = visits
          .map(v => {
            try { const d = new Date(v.visit_date || ''); return isNaN(d.getTime()) ? 0 : d.getTime(); } catch { return 0; }
          })
          .filter(t => t > 0);
        if (tsList.length > 0) ts = Math.max(...tsList);
      }
      const ws = new Date(ts);
      ws.setDate(ws.getDate() - 7);
      return ws.toISOString().slice(0, 10);
    } catch {
      const ws = new Date(Date.now() - 7 * 86400000);
      return ws.toISOString().slice(0, 10);
    }
  })();
  const weekVisits = visits.filter(v => {
    const dstr = (v.visit_date || '').toString().slice(0, 10);
    return dstr >= weekStartStr;
  });

  // Agent summaries (recuadros) + totals
  const agentStats = {};
  weekVisits.forEach(v => {
    const a = v.acopiador || 'Sin asignar';
    if (!agentStats[a]) agentStats[a] = { visits: 0, negotiated: 0, kgEst: 0, list: [] };
    agentStats[a].visits++;
    if (['En negociación', 'Aceptada', 'Cortada'].includes(v.neg_status)) agentStats[a].negotiated++;
    agentStats[a].kgEst += parseFloat(v.est_kg || 0);
    agentStats[a].list.push(v);
  });
  const weekTotalVisits = weekVisits.length;
  const weekNegotiated = weekVisits.filter(v => ['En negociación', 'Aceptada', 'Cortada'].includes(v.neg_status)).length;

  // Km from journeys for week (matching user_id to acopiador)
  const weekKmTotal = (journeys.journeys || []).reduce((sum, j) => {
    const jd = (j.date || '').toString().slice(0,10);
    if (jd && jd >= weekStartStr) return sum + (parseFloat(j.total_km || 0) || 0);
    return sum;
  }, 0);

  // Current GPS preview
  const [gpsPreview, setGpsPreview] = useState(null);

  // For route
  const [journeyForm, setJourneyForm] = useState({ km_initial: '', km_final: '', photo_start_url: '', photo_end_url: '' });
  const [fuelForm, setFuelForm] = useState({ vehicle: '', liters: '', cost: '', station: '', km_at_load: '', photo_ticket_url: '' });
  const [activeJourneyId, setActiveJourneyId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const mapApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

  // === CALCULADORA TECAVO ===
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcVisit, setCalcVisit] = useState(null); // the visit being evaluated
  const [calcData, setCalcData] = useState({ est_kg_cut: '', calculation_base: 'sample_weight', sample_total_kg: '', observations: '', categories: [] });
  const [centralCalibers, setCentralCalibers] = useState([]);
  const [calcEvals, setCalcEvals] = useState([]); // versions for current visit
  const [calcLoading, setCalcLoading] = useState(false);
  const [confirmCutData, setConfirmCutData] = useState(null); // for confirm corte modal

  // Load Google Maps once (safe, always-called hook). Pass results to sub-map helpers
  const mapLoad = useLoadScript({ googleMapsApiKey: mapApiKey });

  const refreshMenuAndUser = async () => {
    try {
      const u = await fetch('/api/auth/user').then(r => r.json()).catch(()=>({}));
      if (u?.name) setCurrentUser(u.name);
      const role = u?.admin_role || (u?.is_super_admin ? 'superadministrador' : '');
      setUserRole(role);
      setIsAdmin(!!u?.is_super_admin || (role && String(role).toLowerCase().includes('super')) || u?.email?.includes('admin'));

      const groups = await fetch('/api/menu?credential=campo').then(r => r.json()).catch(() => []);
      const flat = (groups || []).flatMap(g => (g.modules || []).map(mm => ({...mm, _group: g.group_name })));
      setAssignedSections(flat.filter(f => f.module_route));
    } catch (_) {}
  };

  useEffect(() => {
    loadAll();
    refreshMenuAndUser();
    // Consume central weekly prices (Definición de Precios Semanales)
    fetch('/api/price-weeks/current').then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.items && d.items.length) {
        // average purchase as reference for field price comparison
        const avg = d.items.reduce((s, i) => s + (parseFloat(i.purchase_mxn_kg) || 0), 0) / d.items.length;
        setOfficialPrice({ week: d.week, avgPurchase: avg });
      }
    }).catch(() => {});

    // load master corredores list (from superadmin) so they appear linked in forms
    fetch('/api/brokers?masters=true').then(r => r.ok ? r.json() : []).then(list => setAvailableCorredores(Array.isArray(list)?list:[])).catch(()=>{}); 

    // Load central calibers for Calculadora TECAVO (with gramaje if configured)
    fetch('/api/calibers').then(r => r.ok ? r.json() : []).then(list => {
      if (Array.isArray(list) && list.length) setCentralCalibers(list);
    }).catch(()=>{});

    // Real-time: refetch menu config + user role when focus/visibility so Superadministrador changes (module toggles, group access) propagate immediately
    const onFocus = () => refreshMenuAndUser();
    const onVis = () => { if (!document.hidden) refreshMenuAndUser(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    // light poll every 25s as safety net for same-tab changes
    const iv = setInterval(refreshMenuAndUser, 25000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  }, []);

  // Sync: if config removes a section (e.g. ordenes toggled off in super), switch to safe tab
  useEffect(() => {
    if (!hasOrdenCorteSection && tab === 'ordenes') {
      setTab('dashboard');
    }
  }, [hasOrdenCorteSection, tab]);

  async function loadAll() {
    setLoading(true);
    try {
      const [vRes, oRes, stRes, jRes, pdRes, coRes] = await Promise.all([
        fetch('/api/acopios/visits'),
        fetch('/api/acopios/orchards'),
        fetch('/api/acopios/stats'),
        fetch('/api/acopios/journeys'),
        fetch('/api/pedidos'),
        fetch('/api/cutting-orders')
      ]);
      const vs = await vRes.json(); setVisits(Array.isArray(vs) ? vs : []);
      const os = await oRes.json(); setOrchards(Array.isArray(os) ? os : []);
      const st = await stRes.json(); setStats(st);
      const js = await jRes.json(); setJourneys(js);
      const pd = pdRes.ok ? await pdRes.json() : []; setPedidosAcop(Array.isArray(pd)?pd:[]);
      const co = coRes && coRes.ok ? await coRes.json() : []; setCuttingOrders(Array.isArray(co)?co:[]);
    } catch (e) {}
    setLoading(false);
  }

  async function refreshVisits() {
    const params = new URLSearchParams();
    if (filters.producer) params.set('producer', filters.producer);
    if (filters.broker) params.set('broker', filters.broker);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const res = await fetch('/api/acopios/visits?' + params.toString());
    const vs = await res.json();
    setVisits(Array.isArray(vs) ? vs : []);
  }

  // GPS capture + sync google map marker
  function captureGPS() {
    if (!navigator.geolocation) {
      alert('Geolocalización no disponible');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = {
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        alt: (pos.coords.altitude || 0).toFixed(0),
        precision: pos.coords.accuracy
      };
      setForm(f => ({ ...f, lat: p.lat, lng: p.lng, alt: p.alt }));
      setGpsPreview(p);
      setSelectedPosition({ lat: p.lat, lng: p.lng });
    }, () => alert('No se pudo obtener ubicación GPS'));
  }

  // Upload image using existing
  async function handlePhotoUpload(e, slotType = 'general') {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await r.json();
      const url = data?.url || data?.path || '';
      if (url) {
        setPhotos(prev => [...prev, { url, photo_type: slotType, fileName: file.name }]);
      }
    } catch {
      alert('Error al subir fotografía. Prueba otra vez.');
    }
    setUploadLoading(false);
    e.target.value = '';
  }

  // calibrate %
  function setCal(key, val) {
    let n = parseFloat(val) || 0;
    if (n < 0) n = 0; if (n > 100) n = 100;
    setForm(f => {
      const next = { ...f, [key]: n };
      // auto calc and clip? simple, we check on save
      return next;
    });
  }

  const calSum = () => {
    return ['super','extra','primera','mediano','tercera','cuarta','canica','clase2','proceso','desecho']
      .reduce((s,k) => s + (parseFloat(form[k+'_percent']||0)), 0);
  };

  // === CALCULADORA TECAVO HELPERS (usa calibres centrales + gramaje) ===
  function openCalculatorForVisit(v) {
    setCalcVisit(v);
    setCalcData({ est_kg_cut: v?.est_kg || '', calculation_base: 'sample_weight', sample_total_kg: '', observations: v?.observations || '', categories: [] });
    setCalcEvals([]);
    setShowCalculator(true);
    // load previous evals
    if (v && v.id) loadCalculatorEvals(v.id);
  }

  async function loadCalculatorEvals(visitId) {
    try {
      const r = await fetch(`/api/acopios/calculator?visitId=${visitId}`);
      const data = await r.json();
      setCalcEvals(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  function initCalcCategoriesFromCentral() {
    // Build initial rows from central calibers + fixed qualities
    const base = (centralCalibers.length ? centralCalibers.map(c => ({
      category_type: 'caliber',
      name: c.display_name || c.caliber_name || c.caliber_code,
      gramaje: c.gramaje || 0,
      sample_kg: '',
      projected_percent: 0,
      projected_kg: 0
    })) : [
      {category_type:'caliber', name:'Super (40\'s)', sample_kg:'', projected_percent:0, projected_kg:0},
      {category_type:'caliber', name:'Extra (48\'s)', sample_kg:'', projected_percent:0, projected_kg:0},
      {category_type:'caliber', name:'Primera (60\'s)', sample_kg:'', projected_percent:0, projected_kg:0}
    ]);
    // add quality rows (only A/B/Proceso/Desecho)
    const qBase = ['Calidad A','Calidad B','Proceso','Desecho'].map(q => ({category_type:'quality', name: q, sample_kg:'', projected_percent:0, projected_kg:0}));
    setCalcData(d => ({...d, categories: [...base, ...qBase]}));
  }

  function updateCalcCat(idx, key, val) {
    setCalcData(d => {
      const next = [...(d.categories || [])];
      next[idx] = { ...next[idx], [key]: val };
      // auto calc if sample
      const est = parseFloat(d.est_kg_cut) || 0;
      const totSample = parseFloat(d.sample_total_kg) || next.reduce((s,c)=> s + (parseFloat(c.sample_kg)||0), 0);
      if (d.calculation_base === 'sample_weight' && totSample > 0) {
        const s = parseFloat(next[idx].sample_kg) || 0;
        const pct = (s / totSample) * 100;
        next[idx].projected_percent = parseFloat(pct.toFixed(2));
        next[idx].projected_kg = parseFloat(((est * pct) / 100).toFixed(2));
      }
      return { ...d, categories: next };
    });
  }

  function recalcAll() {
    setCalcData(d => {
      const est = parseFloat(d.est_kg_cut) || 0;
      const cats = (d.categories || []).map(c => {
        if (d.calculation_base === 'manual_percent') {
          const pct = parseFloat(c.projected_percent) || 0;
          return { ...c, projected_kg: parseFloat((est * pct / 100).toFixed(2)) };
        } else {
          const totS = parseFloat(d.sample_total_kg) || (d.categories||[]).reduce((s,x)=>s+(parseFloat(x.sample_kg)||0),0);
          const s = parseFloat(c.sample_kg) || 0;
          const pct = totS > 0 ? (s / totS * 100) : 0;
          return { ...c, projected_percent: parseFloat(pct.toFixed(2)), projected_kg: parseFloat((est * pct / 100).toFixed(2)) };
        }
      });
      return { ...d, categories: cats };
    });
  }

  async function saveCalculator(draftOnly = true) {
    if (!calcVisit?.id) return alert('Visita no seleccionada');
    setCalcLoading(true);
    try {
      const payload = {
        visit_id: calcVisit.id,
        responsible: currentUser,
        evaluation_date: new Date().toISOString().slice(0,10),
        est_kg_cut: parseFloat(calcData.est_kg_cut) || 0,
        calculation_base: calcData.calculation_base,
        sample_total_kg: parseFloat(calcData.sample_total_kg) || 0,
        observations: calcData.observations,
        evidence: [],
        categories: (calcData.categories || []).map(c => ({
          category_type: c.category_type,
          name: c.name,
          sample_kg: parseFloat(c.sample_kg) || 0,
          projected_percent: parseFloat(c.projected_percent) || 0,
          projected_kg: parseFloat(c.projected_kg) || 0
        }))
      };
      const res = await fetch('/api/acopios/calculator', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      alert(draftOnly ? 'Evaluación guardada como borrador.' : 'Evaluación guardada.');
      await loadCalculatorEvals(calcVisit.id);
      await refreshVisits();
      if (!draftOnly) {
        // mark as confirmed
        if (j.evaluation?.id) await fetch('/api/acopios/calculator', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id: j.evaluation.id, is_confirmed: true})});
      }
    } catch(e) { alert('Error guardando calculadora: ' + e.message); }
    setCalcLoading(false);
  }

  async function confirmCorteFromCalc() {
    if (!calcVisit) return;
    // Preload cutting order data from visit + confirmed eval
    const confirmed = calcEvals.find(e => e.is_confirmed) || calcEvals[0];
    const snap = confirmed ? { est_kg: confirmed.est_kg_cut, categories: confirmed.categories || calcData.categories } : null;

    setConfirmCutData({
      producer_name: calcVisit.producer || '',
      orchard_name: calcVisit.orchard_name || '',
      broker_name: calcVisit.broker || '',
      cutting_date: calcVisit.visit_date || new Date().toISOString().slice(0,10),
      visit_id: calcVisit.id,
      calculator_evaluation_id: confirmed?.id || null,
      projection_snapshot: snap,
      boxes_count: '',
      driver_name: '',
      crew_chief_name: '',
      truck_plates: '',
      location: calcVisit.municipality || ''
    });
    setShowCalculator(false);
    setTab('ordenes'); // show orders section
  }

  async function saveVisit() {
    const sum = calSum();
    if (Math.abs(sum - 100) > 0.6) {
      alert('La suma de calibres debe ser exactamente 100%. Actual: ' + sum.toFixed(1));
      return;
    }
    if (!form.orchard_name) { alert('Ingresa nombre de huerta'); return; }

    const payload = {
      visit: { ...form, acopiador: currentUser },
      negotiation: negotiation.status ? negotiation : null,
      photos: photos.map(p => ({ photo_url: p.url, photo_type: p.photo_type })),
      flowers: flowers.length ? flowers : []
    };
    const res = await fetch('/api/acopios/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const rj = await res.json();
    if (rj.error) {
      alert('Error: ' + rj.error); return;
    }
    alert('Visita guardada correctamente.');
    // Reset
    setPhotos([]); setFlowers([]); setGpsPreview(null); setSelectedPosition(null);
    setForm({
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toTimeString().slice(0,5),
      acopiador: currentUser,
      orchard_name: '', producer: '', broker: '', municipality: '', locality: '', state: 'Michoacán',
      lat: '', lng: '', alt: '', super_percent:0,extra_percent:0,primera_percent:0,mediano_percent:0,
      tercera_percent:0,cuarta_percent:0,canica_percent:0,clase2_percent:0,proceso_percent:0,desecho_percent:0,
      trees_productive:'',young_trees:'',hectares:'',est_kg:'',est_ton:'',observations:''
    });
    setNegotiation({ status: 'Prospecto', offered_price:'', pact_price:'', purchase_type:'Campo', payment_form:'Contado', tentative_cut_date:'', observations:'' });
    await refreshVisits();
    await loadAll();
    setTab('huertas');
  }

  async function updateNeg(visitId, newNeg) {
    const res = await fetch('/api/acopios/visits', {
      method: 'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: visitId, negotiation: newNeg })
    });
    if (res.ok) {
      await refreshVisits();
    }
  }

  async function saveJourney() {
    if (!journeyForm.km_initial || !journeyForm.km_final) { alert('Km inicial y final requerido'); return; }
    const total = (+journeyForm.km_final) - (+journeyForm.km_initial);
    if (total <= 0) { alert('Km final debe ser mayor'); return; }
    await fetch('/api/acopios/journeys', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'journey', journey: { ...journeyForm, total_km: total, date: new Date().toISOString().split('T')[0] } })
    });
    setJourneyForm({ km_initial:'', km_final:'', photo_start_url:'', photo_end_url:'' });
    await loadAll();
  }

  async function saveFuel() {
    if (!fuelForm.vehicle || !fuelForm.liters) return alert('Vehículo y litros requerido');
    await fetch('/api/acopios/journeys', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type:'fuel', fuel:{ ...fuelForm, date: new Date().toISOString().split('T')[0], user_id: currentUser }})});
    setFuelForm({ vehicle:'', liters:'', cost:'', station:'', km_at_load:'', photo_ticket_url:'' });
    await loadAll();
  }

  // Simple reporting
  async function genReport(format = 'excel') {
    const fData = visits;
    const rows = fData.map(v => ({
      Fecha: v.visit_date, Huerta: v.orchard_name, Productor: v.producer, Corredor: v.broker,
      Est_Kg: v.est_kg || 0, Status: v.neg_status || '', Precio_Pact: v.pact_price || v.offered_price || ''
    }));
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Acopios');
      XLSX.writeFile(wb, `acopios-${new Date().toISOString().slice(0,10)}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text('Acopios de Campo - Tecavo Fruits', 20, 15);
      // @ts-ignore
      doc.autoTable({ startY: 25, head: [['Fecha','Huerta','Productor','Est Kg','Estatus']], body: rows.slice(0,20).map(r => [r.Fecha,r.Huerta,r.Productor,r.Est_Kg,r.Status]) });
      doc.save(`acopios-${Date.now()}.pdf`);
    } else {
      const csv = 'Fecha,Huerta,Productor,Corredor,Est Kg\n' + rows.map(r => `${r.Fecha},${r.Huerta},${r.Productor},${r.Corredor},${r.Est_Kg}`).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'acopios.csv'; a.click();
    }
  }


  function addFlower() {
    setFlowers([...flowers, { flower_type: 'Principal', est_cut_date: '', real_cut_date: '', expected_kg: '', real_kg: '', notes: '' }]);
  }
  function updateFlower(i, k, val) {
    const fs = [...flowers]; fs[i][k] = val; setFlowers(fs);
  }

  // Legacy simple map replaced by Google Maps (HuertasOverviewMap + HuertaMapPicker)
  // Kept for compatibility only if needed elsewhere.

  // Filters active
  const filteredVisits = visits.filter(v => {
    if (filters.producer && !String(v.producer||'').toLowerCase().includes(filters.producer.toLowerCase())) return false;
    if (filters.broker && !String(v.broker||'').toLowerCase().includes(filters.broker.toLowerCase())) return false;
    if (filters.status && v.neg_status !== filters.status) return false;
    return true;
  });

  // Producer summary
  const producerRows = {};
  visits.forEach(v => {
    const p = v.producer || 'Sin productor';
    if (!producerRows[p]) producerRows[p] = { visited:0, won:0, lost:0, negos:0, kg:0 };
    producerRows[p].visited++;
    if (v.neg_status) producerRows[p].negos++;
    if (['Aceptada','Cortada'].includes(v.neg_status)) producerRows[p].won++;
    if (v.neg_status === 'Rechazada') producerRows[p].lost++;
    producerRows[p].kg += parseFloat(v.est_kg || 0);
  });

  // Permission: solo operaciones, administración general y superadministrador pueden editar tarimas faltantes / marcar completo
  const canModifyFaltantes = () => {
    const r = String(userRole || '').toLowerCase();
    if (isAdmin || r.includes('superadministrador')) return true;
    return r.includes('operaciones') || r.includes('administracion_general') || r.includes('administrador');
  };

  // Google Maps location picker for marking huerta (Nueva Visita) - receives preload state from parent
  function HuertaMapPicker({ position, onChange, apiKey, isLoaded, loadError }) {
    if (!apiKey) return <div className="h-64 bg-emerald-50 border rounded flex items-center justify-center text-sm text-slate-600">Configura GOOGLE_MAPS_API_KEY (Next_Public) para mapa Google interactivo. Captura GPS/textos disponibles.</div>;
    if (loadError) return <div className="p-3 text-sm text-red-600">Error cargando Google Maps. Revisa API Key.</div>;
    if (!isLoaded) return <div className="h-64 bg-slate-100 rounded flex items-center justify-center text-sm">Cargando mapa de Google Maps...</div>;

    const center = position ? {lat: parseFloat(position.lat), lng: parseFloat(position.lng)} : {lat: 19.60, lng: -101.20};
    return (
      <div className="border rounded-xl overflow-hidden">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '260px' }}
          center={center}
          zoom={15}
          onClick={(e) => {
            const p = { lat: e.latLng.lat().toFixed(6), lng: e.latLng.lng().toFixed(6) };
            onChange(p);
          }}
        >
          {position && (
            <Marker
              position={{ lat: parseFloat(position.lat), lng: parseFloat(position.lng) }}
              draggable
              onDragEnd={(e) => {
                const p = { lat: e.latLng.lat().toFixed(6), lng: e.latLng.lng().toFixed(6) };
                onChange(p);
              }}
            />
          )}
        </GoogleMap>
      </div>
    );
  }

  // Overview Google map in the "mapa" tab - receives preload state
  function HuertasOverviewMap({ items, apiKey, isLoaded, loadError }) {
    const pts = items.filter(x => x.lat && x.lng);
    if (!apiKey) return <div className="p-3 text-xs text-slate-500">Sin API Key configurada. Se muestran enlaces directos a Google Maps.</div>;
    if (loadError) return <div className="p-3 text-xs text-red-600">Error cargando Google Maps.</div>;
    if (!isLoaded) return <div className="h-72 bg-slate-100 rounded flex items-center justify-center">Cargando Google Maps...</div>;
    if (!pts.length) return <div className="p-4 text-xs text-slate-500">Sin huertas con coordenadas registradas.</div>;
    const c = { lat: parseFloat(pts[0].lat), lng: parseFloat(pts[0].lng) };
    return (
      <div className="border rounded-2xl overflow-hidden">
        <GoogleMap mapContainerStyle={{width:'100%', height: '320px'}} center={c} zoom={11}>
          {pts.map((p, i) => (
            <Marker
              key={i}
              position={{ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }}
              title={`${p.orchard_name} • ${p.producer || ''}`}
              onClick={() => alert(`${p.orchard_name}
${p.producer||''} | ${p.neg_status||''}
${p.lat},${p.lng}`)}
            />
          ))}
        </GoogleMap>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex items-end justify-between mb-6">
          <div>
            <div className="uppercase tracking-[2px] text-xs text-emerald-700 font-bold mb-1">TECAVO FRUITS</div>
            <h1 className="text-4xl font-bold tracking-tighter">ACOPIOS — Dashboard Principal</h1>
            <p className="text-slate-500">Módulos asignados desde Superadministrador • Acceso inmediato a las secciones configuradas para este grupo</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab('reportes')} className="px-4 py-1.5 border bg-white rounded-lg text-sm font-medium">Reportes</button>
            <button onClick={() => { setTab('nueva'); window.scrollTo(0,100); }} className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 transition text-white rounded-lg font-medium flex items-center gap-2"><span>＋</span> Nueva Visita</button>
          </div>
        </header>

        {/* DASHBOARD PRINCIPAL DEL GRUPO: Módulos configurados en Superadministrador */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold tracking-widest text-emerald-700">MÓDULOS ASIGNADOS A CAMPO / ACOPIO</div>
            <button onClick={refreshMenuAndUser} className="text-xs px-3 py-1 border rounded hover:bg-white">Actualizar desde Superadmin</button>
          </div>
          {assignedSections.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {assignedSections.map((mod, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(mod.module_route)}
                  className="group bg-white border border-emerald-200 hover:border-emerald-600 rounded-2xl p-4 text-left flex flex-col transition hover:shadow-md"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                    <i className={`ph ${mod.module_icon || 'ph-cube'} text-2xl text-emerald-700`} />
                  </div>
                  <div className="font-semibold text-lg tracking-tight text-slate-900 group-hover:text-emerald-700">{mod.module_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{mod.module_route}</div>
                  <div className="mt-auto pt-3 text-[11px] text-emerald-600 font-medium flex items-center gap-1">Abrir módulo →</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border rounded-2xl p-5 text-sm text-slate-500">No hay módulos asignados aún para este grupo. Configúralos en Superadministrador → Distribución de Componentes.</div>
          )}
          <div className="text-[10px] mt-2 text-slate-400">Los módulos visibles aquí son exactamente los que el Superadministrador asignó a "Accopio / Campo" usando la matriz de group_access.</div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-3 mb-4 pb-3">
            {(assignedSections.length ? assignedSections : []).map((s, idx) => (
              <button key={idx} onClick={() => router.push(s.module_route)}
                className="w-11 h-11 rounded-2xl border border-black/10 flex items-center justify-center shadow-[0_7px_0_#11182730] active:translate-y-1 active:shadow-[0_2px_0_#11182730] hover:brightness-110 transition bg-[#1F3C2F] text-white"
                title={s.module_name}>
                <i className={`ph ${s.module_icon || 'ph-cube'} text-2xl`} />
              </button>
            ))}
            {assignedSections.length === 0 && [ '/acopios','/cutting-orders','/precios-fruta','/cuadrillas' ].map((r,i)=> (
              <button key={i} onClick={() => router.push(r)} className="w-11 h-11 rounded-2xl border border-black/10 flex items-center justify-center shadow-[0_7px_0_#11182730] active:translate-y-1 active:shadow-[0_2px_0_#11182730] hover:brightness-110 transition bg-[#1F3C2F] text-white"><i className="ph ph-cube text-2xl" /></button>
            ))}
          </div>
        )}

        {/* MENU TABS - dynamically filtered from Config de Modulos assignments for this group */}
        <div className="flex flex-wrap gap-2 mb-5 text-sm">
          {[
            ['dashboard','Dashboard Acopios'],
            ['nueva','Nueva Visita de Huerta'],
            ['huertas','Huertas Visitadas'],
            ...(hasOrdenCorteSection ? [['ordenes','Órdenes de Corte']] : []),
            ['negociaciones','Negociaciones'],
            ['calculadora','Calculadora TECAVO'],
            ['floraciones','Seguimiento de Floraciones'],
            ['rutas','Rutas y Combustible'],
            ['indicadores','Indicadores de Conversión'],
            ['mapa','Mapa General de Huertas'],
            ['reportes','Reportes']
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl font-medium border ${tab===k ? 'bg-white border-emerald-600 text-emerald-800' : 'bg-white/70 hover:bg-white'}`}>{lbl}</button>
          ))}
        </div>

        {/* DASHBOARD - Vista enfocada por semana, agentes y expediente */}
        {tab === 'dashboard' && (
          <div>
            {/* 3 KPIs principales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl border p-5">
                <div className="text-xs uppercase tracking-wide text-slate-500">Huertas visitadas en la semana</div>
                <div className="text-5xl font-bold text-emerald-800 mt-1 tracking-tight">{weekTotalVisits}</div>
                <div className="text-xs mt-1 text-slate-500">desde {weekStartStr}</div>
              </div>
              <div className="bg-white rounded-2xl border p-5">
                <div className="text-xs uppercase tracking-wide text-slate-500">Negociadas</div>
                <div className="text-5xl font-bold mt-1 tracking-tight">{weekNegotiated}</div>
                <div className="mt-1"><span className="inline text-sm px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Aceptada + Cortada + En negociación</span></div>
              </div>
              <div className="bg-white rounded-2xl border p-5">
                <div className="text-xs uppercase tracking-wide text-slate-500">Km recorridos (semana)</div>
                <div className="text-5xl font-bold mt-1 tracking-tight">{Math.round(weekKmTotal)}</div>
                <div className="text-xs mt-1 text-slate-500">Jornadas registradas por acopiadores</div>
              </div>
            </div>

            {/* PEDIDOS: visible para todos en acopios (fruta requerida). Solo operaciones, admin general y superadmin pueden editar tarimas faltantes y marcar completo */}
            <div className="bg-white border rounded-2xl p-4 mt-4">
              <div className="uppercase text-xs tracking-widest text-emerald-700 font-semibold mb-2">Pedidos para Viajes</div>
              {pedidosAcop.length ? pedidosAcop.map((p,ix)=>(
                <div key={ix} className="text-xs border-b py-1.5 last:border-0">
                  <div>{p.fecha_salida} • {p.cliente_nombre} • Fruta: {p.fruta_requerida||'—'} • Total: {p.total_tarimas}</div>
                  {(p.rows||[]).map((r,rx)=><div key={rx} className="ml-1">Calibre {r.calibre} Clase: {r.clase||'A'} • {r.num_tarimas} tarimas  Faltantes: {canModifyFaltantes() ? (
                    <input className="w-10 border px-0.5" type="number" defaultValue={r.tarimas_faltantes||r.num_tarimas} onBlur={e=>{
                      const v=parseInt(e.target.value)||0; const nr=[...(p.rows||[])]; nr[rx]={...nr[rx],tarimas_faltantes:v}; fetch('/api/pedidos',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,rows:nr})}).then(()=>loadAll());
                    }} />
                  ) : (
                    <span className="font-mono">{r.tarimas_faltantes != null ? r.tarimas_faltantes : r.num_tarimas}</span>
                  )} </div>)}
                  {p.estado!=='completado' && canModifyFaltantes() && <button onClick={()=>fetch('/api/pedidos',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,estado:'completado'})}).then(()=>loadAll())} className="mt-0.5 text-[10px] border px-1 rounded">Marcar completo</button>}
                </div>
              )) : <div className="text-xs text-slate-400">Sin pedidos configurados en Superadministrador.</div>}
              {!canModifyFaltantes() && pedidosAcop.length > 0 && (
                <div className="text-[10px] text-amber-600 mt-1">Solo Operaciones, Administración General o Superadministrador pueden modificar tarimas faltantes y completar pedidos.</div>
              )}
            </div>

            {/* Recuadros por Acopiador/Corredor */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xl tracking-tight">Expediente por Acopiador / Corredor</div>
                <div className="text-sm text-slate-500">Haz clic en un recuadro para ver el expediente semanal completo de ese agente</div>
              </div>
              <button onClick={() => { setSelectedAcopiador(null); loadAll(); }} className="text-sm border px-3 py-1 rounded">Actualizar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {Object.keys(agentStats).length === 0 && (
                <div className="col-span-full text-sm bg-white p-4 rounded border">No hay datos de visitas para la semana actual. Registra en "Nueva Visita".</div>
              )}
              {Object.entries(agentStats).map(([name, s]) => {
                const isSel = selectedAcopiador === name;
                return (
                  <div 
                    key={name} 
                    onClick={() => setSelectedAcopiador(name)} 
                    className={`cursor-pointer bg-white border rounded-2xl p-4 transition hover:shadow ${isSel ? 'border-emerald-600 ring-1 ring-emerald-200' : ''}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-bold text-lg">{name}</div>
                      <div className="text-[10px] uppercase text-emerald-700 font-medium">Acopiador</div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 text-center">
                      <div>
                        <div className="text-[11px] text-slate-500">Visitadas</div>
                        <div className="font-semibold text-3xl tracking-tighter">{s.visits}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Negociadas</div>
                        <div className="font-semibold text-3xl tracking-tighter">{s.negotiated}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Est. Kg</div>
                        <div className="font-semibold text-3xl tracking-tighter">{Math.round(s.kgEst).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="mt-5 text-emerald-800 bg-emerald-50 text-xs inline py-1 px-3 rounded-full font-medium">Ver expediente por semana →</div>
                  </div>
                );
              })}
            </div>

            {/* EXPEDIENTE DETALLE por agente seleccionado */}
            {selectedAcopiador && agentStats[selectedAcopiador] && (
              <div className="bg-white border rounded-3xl p-6 mb-8">
                <div className="flex justify-between mb-4 items-start">
                  <div>
                    <div className="text-sm uppercase text-slate-500">Expediente completo semanal</div>
                    <div className="text-2xl font-semibold tracking-tight">{selectedAcopiador}</div>
                    <div className="text-xs">Semana del {weekStartStr}</div>
                  </div>
                  <button onClick={() => setSelectedAcopiador(null)} className="text-xs underline">Cerrar expediente</button>
                </div>

                <div className="flex text-sm gap-6 mb-4">
                  <div>Visitas: <span className="font-mono">{agentStats[selectedAcopiador].visits}</span></div>
                  <div>Negociadas: <span className="font-mono">{agentStats[selectedAcopiador].negotiated}</span></div>
                  <div>Kg Total Estimado: <span className="font-mono">{Math.round(agentStats[selectedAcopiador].kgEst)}</span></div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="pb-2 pr-3">Fecha</th>
                        <th className="pb-2">Huerta</th>
                        <th className="pb-2">Productor</th>
                        <th className="pb-2">Corredor</th>
                        <th className="pb-2">Est. Kg</th>
                        <th className="pb-2">Calibres</th>
                        <th className="pb-2">Estatus</th>
                        <th className="pb-2">Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentStats[selectedAcopiador].list.sort((a,b)=> (b.visit_date||'').localeCompare(a.visit_date||'')).map((v, idx) => {
                        const cal = Math.round((v.super_percent||0)+(v.extra_percent||0)+(v.primera_percent||0));
                        return (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{v.visit_date}</td>
                            <td className="font-medium py-2">{v.orchard_name}</td>
                            <td>{v.producer}</td>
                            <td className="text-xs text-slate-600">{v.broker || '—'}</td>
                            <td>{Number(v.est_kg || 0).toLocaleString()}</td>
                            <td className="text-xs">{cal}% sup/extra/1ra</td>
                            <td>
                              <span className={`px-2 py-px rounded text-[10px] ${v.neg_status === 'Aceptada' || v.neg_status === 'Cortada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {v.neg_status || 'Prospecto'}
                              </span>
                            </td>
                            <td className="text-[10px]">{v.lat && v.lng ? `${parseFloat(v.lat).toFixed(3)},${parseFloat(v.lng).toFixed(3)}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] mt-4 text-slate-500">Registro completo visible en "Huertas Visitadas". Todas las visitas para este acopiador durante la semana.</div>
              </div>
            )}
          </div>
        )}

        {/* NUEVA VISITA */}
        {tab === 'nueva' && (
          <div className="bg-white p-7 rounded-3xl border shadow-sm">
            <h2 className="text-2xl mb-5 font-semibold">Nueva Visita de Huerta</h2>

            {/* GENERAL */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3 mb-7">
              <div><label className="block text-xs uppercase mb-0.5 text-slate-500">Fecha</label><input type="date" value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})} className="border w-full px-3 py-1.5 rounded" /></div>
              <div><label className="block text-xs uppercase mb-0.5 text-slate-500">Hora</label><input type="time" value={form.visit_time} onChange={e => setForm({...form, visit_time: e.target.value})} className="border w-full px-3 py-1.5 rounded" /></div>
              <div><label className="block text-xs uppercase mb-0.5 text-slate-500">Acopiador</label><input value={form.acopiador || currentUser} onChange={e=>setForm({...form,acopiador:e.target.value})} className="border w-full px-3 py-1.5 rounded" /></div>
              <div><button onClick={captureGPS} className="mt-5 bg-slate-900 text-white text-sm px-5 py-1.5 rounded-xl">📍 Capturar mi ubicación GPS</button></div>
            </div>

            <div className="mb-6 text-xs bg-emerald-50 p-2 rounded border border-emerald-100">Coordenadas: {form.lat || gpsPreview?.lat || '—'}, {form.lng || gpsPreview?.lng || '—'} • Captura automática y editable. Marca la huerta en Google Maps.</div>

            {/* Google Maps marker for precise huerta geolocation */}
            <div className="mb-7">
              <div className="text-sm font-medium mb-1.5 text-emerald-800">Marcar ubicación exacta de huerta (clic en mapa o arrastra marcador)</div>
              <HuertaMapPicker
                position={selectedPosition || (form.lat && form.lng ? {lat: form.lat, lng: form.lng} : null)}
                onChange={(p)=>{ setSelectedPosition(p); setForm(f => ({...f, lat: p.lat, lng: p.lng})); }}
                apiKey={mapApiKey}
                isLoaded={mapLoad.isLoaded}
                loadError={mapLoad.loadError}
              />
              <div className="text-[10px] text-slate-500 mt-1">Google Maps: clic establece marcador. GPS del navegador centra automáticamente al capturar.</div>
            </div>

            {/* DATOS DE HUERTA */}
            <div className="mb-6">
              <div className="font-semibold text-sm mb-2">Datos capturados</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2">
                <input placeholder="Nombre Huerta *" value={form.orchard_name} onChange={e=>setForm({...form,orchard_name:e.target.value})} className="border px-3 py-1.5 rounded" />
                <input placeholder="Productor" value={form.producer} onChange={e=>setForm({...form,producer:e.target.value})} className="border px-3 py-1.5 rounded" />
                <select value={form.broker} onChange={e=>setForm({...form,broker:e.target.value})} className="border px-3 py-1.5 rounded">
                  <option value="">-- Seleccionar Corredor --</option>
                  {availableCorredores.map((c, i) => <option key={i} value={c.broker_name || c.name}>{c.broker_name || c.name}</option>)}
                </select>
                <input placeholder="Municipio" value={form.municipality} onChange={e=>setForm({...form,municipality:e.target.value})} className="border px-3 py-1.5 rounded" />
                <input placeholder="Localidad" value={form.locality} onChange={e=>setForm({...form,locality:e.target.value})} className="border px-3 py-1.5 rounded" />
                <input placeholder="Estado" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} className="border px-3 py-1.5 rounded" />
              </div>
              <div className="mt-1 text-[10px] text-slate-500">Lat/Long/Alt <input value={form.lat} onChange={e=>{const v=e.target.value; setForm({...form,lat:v}); if(v&&form.lng) setSelectedPosition({lat:v,lng:form.lng});}} className="w-24 mx-1 border px-1" /> / <input value={form.lng} onChange={e=>{const v=e.target.value; setForm({...form,lng:v}); if(v&&form.lat) setSelectedPosition({lat:form.lat,lng:v});}} className="w-24 border px-1" /> / {form.alt||''}</div>
            </div>

            {/* EVALUACIÓN DE FRUTA (calibres 100%) */}
            <div className="mb-7">
              <div className="font-semibold text-sm mb-2 flex justify-between">Evaluación de Fruta <span className={`text-xs ${Math.abs(calSum()-100)>0.6 ? 'text-red-600':'text-emerald-700'}`}>Suma: {calSum().toFixed(0)} / 100</span></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                {['super','extra','primera','mediano','tercera','cuarta','canica','clase2','proceso','desecho'].map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <div className="w-16 capitalize text-xs text-slate-600">{k.replace('_',' ')} %</div>
                    <input type="number" step="0.1" value={form[k+'_percent']} onChange={e=>setCal(k+'_percent', e.target.value)} className="w-20 border px-2 rounded py-1" />
                  </div>
                ))}
              </div>
              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-emerald-600 h-full transition" style={{ width: Math.min(100, Math.max(0, calSum())) + '%' }} /></div>
            </div>

            {/* ESTIMACIÓN PRODUCCIÓN */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-7">
              <input type="number" placeholder="Árboles productivos" value={form.trees_productive} onChange={e=>setForm({...form,trees_productive:e.target.value})} className="border px-2.5 py-1.5 rounded" />
              <input type="number" placeholder="Árboles jóvenes" value={form.young_trees} onChange={e=>setForm({...form,young_trees:e.target.value})} className="border px-2.5 py-1.5 rounded" />
              <input type="number" placeholder="Hectáreas" value={form.hectares} onChange={e=>setForm({...form,hectares:e.target.value})} className="border px-2.5 py-1.5 rounded" />
              <input type="number" placeholder="Producción estimada (Kg)" value={form.est_kg} onChange={e=>setForm({...form,est_kg:e.target.value})} className="border px-2.5 py-1.5 rounded" />
              <input type="number" placeholder="Toneladas" value={form.est_ton} onChange={e=>setForm({...form,est_ton:e.target.value})} className="border px-2.5 py-1.5 rounded" />
            </div>

            {/* EVIDENCIA FOTO */}
            <div className="mb-6">
              <div className="font-medium mb-2 text-sm">Evidencia fotográfica (requerido mínimo 3) ★</div>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer bg-emerald-700 text-xs text-white px-3 py-2 rounded flex items-center">Subir Vista General<input type="file" accept="image/*" className="hidden" onChange={e=>handlePhotoUpload(e,'general')} /></label>
                <label className="cursor-pointer bg-emerald-700 text-xs text-white px-3 py-2 rounded flex items-center">Subir Fruta en Árbol<input type="file" accept="image/*" className="hidden" onChange={e=>handlePhotoUpload(e,'fruta_arbol')} /></label>
                <label className="cursor-pointer bg-emerald-700 text-xs text-white px-3 py-2 rounded flex items-center">Subir Condición<input type="file" accept="image/*" className="hidden" onChange={e=>handlePhotoUpload(e,'condicion')} /></label>
              </div>
              <div className="text-[10px] mt-1 text-emerald-800">{photos.length} fotos cargadas{uploadLoading ? ' — subiendo…' : ''}</div>
              <div className="flex gap-2 mt-2 flex-wrap">{photos.map((p,ix)=> <img key={ix} src={p.url} className="w-16 h-16 rounded object-cover border" alt="" />)}</div>
            </div>

            {/* NEGOCIACIÓN */}
            <div className="mb-7">
              <div className="font-semibold text-sm mb-2">Negociación</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3">
                <select value={negotiation.status} onChange={e=>setNegotiation({...negotiation,status:e.target.value})} className="border px-3 py-1.5 text-sm rounded">
                  <option>Prospecto</option><option>En negociación</option><option>Aceptada</option><option>Rechazada</option><option>Cortada</option>
                </select>
                <input placeholder="Precio ofrecido $/kg" value={negotiation.offered_price} onChange={e=>setNegotiation({...negotiation,offered_price:e.target.value})} className="border px-3 py-1.5 rounded" />
                <input placeholder="Precio pactado" value={negotiation.pact_price} onChange={e=>setNegotiation({...negotiation,pact_price:e.target.value})} className="border px-3 py-1.5 rounded" />
                {officialPrice && (
                  <div className="text-xs text-emerald-700 mt-1">Precio oficial semana (prom compra): <span className="font-semibold">${officialPrice.avgPurchase.toFixed(2)}/kg</span> (Fuente central)</div>
                )}
                {officialPrice && negotiation.pact_price && parseFloat(negotiation.pact_price) > officialPrice.avgPurchase && (
                  <div className="text-xs text-amber-600 mt-0.5">⚠ Pactado supera precio oficial semanal</div>
                )}
                <select value={negotiation.purchase_type} onChange={e=>setNegotiation({...negotiation,purchase_type:e.target.value})} className="border px-3 py-1.5 rounded">
                  <option>Campo</option><option>Puesto en Empacadora</option><option>Mixto</option>
                </select>
                <select value={negotiation.payment_form} onChange={e=>setNegotiation({...negotiation,payment_form:e.target.value})} className="border px-3 py-1.5 rounded">
                  <option>Contado</option><option>Crédito</option><option>Anticipo</option>
                </select>
                <input type="date" value={negotiation.tentative_cut_date} onChange={e=>setNegotiation({...negotiation,tentative_cut_date:e.target.value})} className="border px-3 py-1.5 rounded" />
                <textarea value={negotiation.observations} onChange={e=>setNegotiation({...negotiation,observations:e.target.value})} placeholder="Observaciones" className="md:col-span-3 border px-3 py-2 rounded text-sm" />
              </div>
            </div>

            <button onClick={saveVisit} className="w-full md:w-auto px-8 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-sm tracking-wider">GUARDAR VISITA COMPLETA →</button>
            <button type="button" onClick={() => openCalculatorForVisit({ ...form, id: null, producer: form.producer, orchard_name: form.orchard_name, broker: form.broker })} className="ml-3 px-6 py-2.5 rounded-xl border border-emerald-700 text-emerald-700 hover:bg-emerald-50 text-sm">📊 Abrir Calculadora TECAVO</button>
            <p className="text-xs text-slate-500 mt-1">La visita se audita automáticamente. Sumatoria de calibers obligatoria = 100%.</p>
          </div>
        )}

        {/* HUERTAS / VISITADAS */}
        {tab === 'huertas' && (
          <div>
            <div className="mb-3 flex gap-3 items-center">
              <input placeholder="Filtrar productor" className="px-3 text-sm py-1.5 border rounded w-52" value={filters.producer} onChange={e=>setFilters({...filters,producer:e.target.value})} onBlur={refreshVisits} />
              <select className="px-3 text-sm py-1.5 border rounded w-52" value={filters.broker} onChange={e=>{setFilters({...filters,broker:e.target.value}); refreshVisits();}}>
                <option value="">Filtrar por corredor</option>
                {availableCorredores.map((c, i) => <option key={i} value={c.broker_name || c.name}>{c.broker_name || c.name}</option>)}
              </select>
              <select className="border px-2 py-1.5 text-sm rounded" value={filters.status} onChange={e=>{setFilters({...filters,status:e.target.value}); refreshVisits();}}>
                <option value="">Todos estatus</option><option>Aceptada</option><option>En negociación</option><option>Rechazada</option><option>Cortada</option>
              </select>
            </div>
            <table className="min-w-full bg-white rounded border text-sm">
              <thead><tr className="text-left border-b bg-slate-50"><th className="p-3">Fecha</th><th>Huerta</th><th>Productor/Corredor</th><th>Calibre</th><th>Est Kg</th><th>Precio</th><th>Estatus</th><th>Actualizar</th></tr></thead>
              <tbody>
                {filteredVisits.map((v,i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3 font-mono text-xs">{v.visit_date}</td>
                    <td className="font-medium p-2">{v.orchard_name}</td>
                    <td className="p-2">{v.producer}<br/><span className="font-thin text-xs">{v.broker}</span></td>
                    <td className="text-[10px]">{v.super_percent}/{v.extra_percent}/{v.primera_percent} %</td>
                    <td>{v.est_kg}</td>
                    <td>${v.pact_price || v.offered_price || '—'}</td>
                    <td><span className="text-xs px-2 py-px rounded-full bg-emerald-100">{v.neg_status || 'Prospecto'}</span></td>
                    <td>
                      <select defaultValue={v.neg_status || 'Prospecto'} className="border text-xs rounded p-0.5" onChange={ev => updateNeg(v.id, {status: ev.target.value, pact_price: v.pact_price})}>
                        <option>Prospecto</option><option>En negociación</option><option>Aceptada</option><option>Rechazada</option><option>Cortada</option>
                      </select>
                      <button onClick={() => openCalculatorForVisit(v)} className="ml-2 text-[10px] px-2 py-0.5 border rounded bg-emerald-50 text-emerald-700">📊 Calc</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* NEGOCIACIONES */}
        {tab === 'negociaciones' && (
          <div className="bg-white rounded-2xl border p-6">
            <div className="font-bold mb-4">Expedientes de negociación (histórico)</div>
            {visits.filter(v => v.neg_status).map((v,i) => (
              <div key={i} className="border-b py-3">
                <div className="font-semibold text-sm">{v.visit_date} • {v.orchard_name} — {v.producer}</div>
                <div>Estado: <span className="font-semibold">{v.neg_status}</span> | Ofertado ${v.offered_price || '—'} | Pactado ${v.pact_price || '—'}</div>
                <div className="mt-1.5">Registrado por {v.acopiador} | Lat: {v.lat || '—'}</div>
              </div>
            ))}
          </div>
        )}

        {/* FLORACIONES */}
        {tab === 'floraciones' && (
          <div className="bg-white border p-5 rounded-3xl">
            <p className="font-semibold mb-3">Seguimiento de floraciones - utiliza el formulario de nueva visita</p>
            <div>{flowers.length ? flowers.map((fl,k) => <div key={k}>Floración {fl.flower_type} - Esperado: {fl.expected_kg || '—'} kg</div>) : 'Registra floraciones al guardar una visita de huerta.'}</div>
          </div>
        )}

        {/* RUTAS Y COMBUSTIBLE – SOLO ADMIN */}
        {tab === 'rutas' && (
          <div>
            {!isAdmin && <div className="text-amber-600 text-xs p-2">Solo personal autorizado. Super Admin / Administración.</div>}
            {isAdmin && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 border rounded-2xl">
                <div className="font-semibold mb-2">INICIO / FIN DE JORNADA</div>
                <input placeholder="Km inicial" value={journeyForm.km_initial} onChange={e=>setJourneyForm({...journeyForm,km_initial:e.target.value})} className="border w-full mb-2 p-2 rounded" />
                <input placeholder="Km final" value={journeyForm.km_final} onChange={e=>setJourneyForm({...journeyForm,km_final:e.target.value})} className="border w-full mb-2 p-2 rounded" />
                <div className="flex gap-3">
                  <button onClick={async ()=>{}} className="text-xs px-3 py-1 border">Usar foto odómetro (cargar por separado)</button>
                  <button onClick={saveJourney} className="text-xs px-4 py-1 bg-emerald-800 text-white rounded">Guardar Jornada</button>
                </div>
                <div className="mt-4">
                  <div className="text-xs">Histórico</div>
                  <div>{journeys.journeys?.map((j,i)=><div key={i}>{j.date}: {j.km_initial} → {j.km_final} ({j.total_km}km)</div>)}</div>
                </div>
              </div>
              <div className="bg-white p-5 border rounded-2xl">
                <div className="font-semibold mb-2">CONTROL DE COMBUSTIBLE</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={fuelForm.vehicle} onChange={e=>setFuelForm({...fuelForm,vehicle:e.target.value})} placeholder="Vehículo / placas" className="border p-2 rounded"/>
                  <input value={fuelForm.liters} onChange={e=>setFuelForm({...fuelForm,liters:e.target.value})} placeholder="Litros" className="border p-2 rounded"/>
                  <input value={fuelForm.cost} onChange={e=>setFuelForm({...fuelForm,cost:e.target.value})} placeholder="Costo" className="border p-2 rounded"/>
                  <input value={fuelForm.station} onChange={e=>setFuelForm({...fuelForm,station:e.target.value})} placeholder="Estación servicio" className="border p-2 rounded"/>
                </div>
                <button className="mt-2 px-4 py-2 bg-emerald-950 text-emerald-200 text-sm rounded" onClick={saveFuel}>Registrar carga combustible</button>
              </div>
            </div>}
          </div>
        )}

        {tab === 'indicadores' && (
          <div className="space-y-5">
            {Object.keys(producerRows).length>0 && Object.keys(producerRows).map(p => {
              const r = producerRows[p];
              const conv = r.negos ? ((r.won/r.negos)*100).toFixed(1) : 0;
              return <div key={p} className="bg-white p-4 border rounded"><span className="font-bold">{p}</span> — visitas {r.visited}, negociadas {r.negos}, ganadas {r.won} ({conv}%), total kg estim: {r.kg}</div>;
            })}
            <div>Efectividad de Acopiadores: (huertas concretadas / visitadas) × 100 → existente en Dashboard.</div>
          </div>
        )}

        {/* MAPA - ahora con Google Maps */}
        {tab === 'mapa' && (
          <div>
            <h3 className="text-lg font-medium mb-3">Mapa General de Huertas - Google Maps</h3>
            <HuertasOverviewMap items={visits} apiKey={mapApiKey} isLoaded={mapLoad.isLoaded} loadError={mapLoad.loadError} />
            <div className="mt-2 text-xs text-slate-500">🟢 Aceptada/Cortada  🟡 En negociación  🔴 Rechazada  🔵 Prospecto — Clic en marcador muestra detalles</div>
            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              {visits.filter(x=>x.lat).slice(0,12).map((v,ii)=>
                <a key={ii} className="p-3 rounded bg-white border hover:bg-emerald-50 text-sm block" target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`}>
                  {v.orchard_name} • {v.producer} ({v.neg_status||'—'})
                </a>)}
            </div>
          </div>
        )}

        {/* ÓRDENES DE CORTE - sección integrada al módulo de campo */}
        {tab === 'ordenes' && (
          <div className="bg-white border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-lg">Órdenes de Corte</div>
                <div className="text-xs text-slate-500">Listado de órdenes para ejecución en campo</div>
              </div>
              <button onClick={() => router.push('/cutting-orders')} className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium">Administrar Órdenes de Corte completas →</button>
            </div>
            {cuttingOrders.length === 0 ? (
              <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded">Sin órdenes registradas aún. Crea una en el módulo completo.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="pb-2 pr-3">Folio</th>
                      <th className="pb-2">Productor / Huerta</th>
                      <th className="pb-2">Fecha</th>
                      <th className="pb-2">Cajas</th>
                      <th className="pb-2">Chofer / Cuadrilla</th>
                      <th className="pb-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuttingOrders.slice(0, 10).map((o, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-emerald-700 text-xs">{o.folio}</td>
                        <td className="py-1.5">{o.producer_name || '—'} / {o.orchard_name || '—'}</td>
                        <td className="py-1.5 text-xs">{o.cutting_date || '—'}</td>
                        <td className="py-1.5">{o.boxes_count || 0}</td>
                        <td className="py-1.5 text-xs">{o.driver_name || '—'} / {o.crew_chief_name || '—'}</td>
                        <td className="py-1.5"><span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{o.status || 'pendiente'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-[10px] text-slate-400">Sincronizado con trazabilidad, control de cajas y cuadrillas.</div>
          </div>
        )}

        {/* REPORTES */}
        {tab === 'reportes' && (
          <div>
            <div className="flex gap-3">
              <button onClick={()=>genReport('excel')} className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm">Exportar Excel</button>
              <button onClick={()=>genReport('pdf')} className="bg-red-700 text-white px-4 py-2 rounded-xl text-sm">Exportar PDF</button>
              <button onClick={()=>genReport('csv')} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-sm">Exportar CSV</button>
            </div>
            <div className="text-sm mt-6">Reportes disponibles: Fletes por productor, Efectividad de acopiadores, Kg prospectados vs reales.</div>
            <div className="text-xs mt-3 text-slate-500">Utiliza filtro en Huertas Visitadas para refinar y luego exportar.</div>
          </div>
        )}

        {/* CALCULADORA TECAVO - Sección visible en grupo Acopios */}
        {tab === 'calculadora' && (
          <div className="bg-white p-6 rounded-3xl border">
            <h2 className="text-2xl font-semibold mb-2">Calculadora TECAVO</h2>
            <p className="text-sm text-slate-600 mb-4">Vinculada a visitas de huerta. Usa calibres centrales del Superadministrador. Calidad limitada a Calidad A / B / Proceso / Desecho.</p>
            <div className="text-sm mb-4">Abre la calculadora desde "Nueva Visita" o desde cualquier visita en la lista de Huertas Visitadas.</div>
            <button onClick={() => { setCalcVisit(null); setCalcData({est_kg_cut:'', calculation_base:'sample_weight', sample_total_kg:'', observations:'', categories:[]}); setCalcEvals([]); setShowCalculator(true); if (!centralCalibers.length) initCalcCategoriesFromCentral(); }} className="px-6 py-2 bg-emerald-700 text-white rounded-xl">Abrir Calculadora (sin visita previa)</button>
            <div className="mt-4 text-xs text-slate-500">Las proyecciones guardadas se vinculan a la visita y viajan a la Orden de Corte y Lotificación para comparación real vs proyectado.</div>
          </div>
        )}

        <div className="mt-10 pt-4 text-center text-[10px] text-slate-400">Trazabilidad completa. Solo viernes para compromisos de pagos relacionados. Registro auditable.</div>

        {/* CALCULADORA TECAVO MODAL - simplified for syntax stability */}
        {showCalculator && (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-start justify-center p-4" onClick={() => setShowCalculator(false)}>
            <div className="bg-white w-full max-w-3xl rounded-2xl mt-6 p-5" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">Calculadora TECAVO</div>
                <button onClick={() => setShowCalculator(false)}>Cerrar</button>
              </div>
              <div className="text-sm mb-2">Visita: {calcVisit ? calcVisit.orchard_name : '—'} | {calcVisit ? calcVisit.producer : ''}</div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <input placeholder="Kg estimados corte" value={calcData.est_kg_cut} onChange={e=>setCalcData(d=>({...d,est_kg_cut:e.target.value}))} className="border p-2 rounded" />
                <select value={calcData.calculation_base} onChange={e=>setCalcData(d=>({...d,calculation_base:e.target.value}))} className="border p-2 rounded">
                  <option value="sample_weight">Muestra por peso</option>
                  <option value="manual_percent">Manual %</option>
                </select>
              </div>

              <div className="text-xs mb-2">Categorías (usa centrales si cargados):</div>
              <div className="max-h-44 overflow-auto border p-2 rounded mb-2 text-xs">
                {(calcData.categories||[]).slice(0,8).map((c,i)=>(<div key={i}>{c.name}: <input value={c.sample_kg||''} onChange={e=>updateCalcCat(i,'sample_kg',e.target.value)} className="border w-16" /> % {c.projected_percent}</div>))}
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={initCalcCategoriesFromCentral} className="text-xs px-3 py-1 bg-slate-200 rounded">Cargar centrales + A/B/Pro/Des</button>
                <button onClick={recalcAll} className="text-xs px-3 py-1 bg-slate-200 rounded">Recalcular</button>
              </div>

              <div className="flex gap-2">
                <button onClick={()=>saveCalculator(true)} className="px-4 py-1 bg-emerald-700 text-white rounded text-sm">Guardar borrador</button>
                <button onClick={confirmCorteFromCalc} className="px-4 py-1 bg-amber-600 text-white rounded text-sm">Confirmar corte</button>
                <button onClick={() => setShowCalculator(false)} className="px-4 py-1 border rounded text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRMAR CORTE MODAL simple */}
        {confirmCutData && (
          <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-4" onClick={()=>setConfirmCutData(null)}>
            <div className="bg-white w-full max-w-sm rounded-xl p-4" onClick={e=>e.stopPropagation()}>
              <div className="font-bold mb-2">Confirmar Corte (trazabilidad)</div>
              <div className="text-xs mb-2">Productor: {confirmCutData.producer_name} • Huerta: {confirmCutData.orchard_name}</div>
              <input placeholder="Cajas" value={confirmCutData.boxes_count} onChange={e=>setConfirmCutData({...confirmCutData,boxes_count:e.target.value})} className="border w-full mb-2 p-1 text-sm" />
              <input placeholder="Chofer" value={confirmCutData.driver_name} onChange={e=>setConfirmCutData({...confirmCutData,driver_name:e.target.value})} className="border w-full mb-2 p-1 text-sm" />
              <div className="flex gap-2">
                <button onClick={async ()=>{
                  const folio='CORTE-'+Date.now().toString().slice(-6);
                  const pl={folio,cutting_date:confirmCutData.cutting_date,producer_name:confirmCutData.producer_name,orchard_name:confirmCutData.orchard_name,boxes_count:parseInt(confirmCutData.boxes_count)||0,visit_id:confirmCutData.visit_id,calculator_evaluation_id:confirmCutData.calculator_evaluation_id,projection_snapshot:confirmCutData.projection_snapshot};
                  const r=await fetch('/api/cutting-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pl)});
                  const j=await r.json();
                  alert('Orden: '+(j.folio||folio));
                  setConfirmCutData(null);
                  loadAll();
                }} className="flex-1 bg-emerald-700 text-white py-1 rounded text-sm">Emitir</button>
                <button onClick={()=>setConfirmCutData(null)} className="flex-1 border py-1 rounded text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiBox({ label, val }) {
  return <div className="bg-white px-4 py-3 rounded-2xl border">
    <div className="text-[11px] text-slate-600">{label}</div>
    <div className="font-bold text-2xl mt-0.5 tracking-tight">{val}</div>
  </div>;
}
