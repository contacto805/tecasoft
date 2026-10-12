"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function PreciosFrutaPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('calc');
  const [calibres, setCalibres] = useState([]);
  const [costos, setCostos] = useState([]);
  const [publicados, setPublicados] = useState([]);
  const [currentPublished, setCurrentPublished] = useState(null);

  const [modo, setModo] = useState('venta_a_compra');

  const [preciosVenta, setPreciosVenta] = useState({
    super_extra: 45, extra: 42, primera: 39, mediano: 36, tercera: 33, cuarta: 16, proceso: 17, canica: 16, desecho: 16
  });
  const [preciosCompra, setPreciosCompra] = useState({
    super_extra: 38, extra: 35, primera: 32, mediano: 29, tercera: 27, cuarta: 12, proceso: 13, canica: 11, desecho: 11
  });

  const [preciosCalculados, setPreciosCalculados] = useState(null);

  const [baseKg, setBaseKg] = useState(22600);
  const [detalleCostos, setDetalleCostos] = useState([
    { id:'tr01', grupo:'Transporte y trámites', concepto:'FLETE TERRESTRE', cantidad:1, unidades:'SERVICIO', precio_usd:4705.88, precio_mxn:80000, precio_kilo:3.54 },
    { id:'tr02', grupo:'Transporte y trámites', concepto:'SEGURO Y TRAMITE', cantidad:1, unidades:'SERVICIO', precio_usd:588.24, precio_mxn:10000, precio_kilo:0.44 },
    { id:'ma01', grupo:'Materiales y Empaque', concepto:'TARIMA', cantidad:24, unidades:'PIEZA', precio_usd:0, precio_mxn:200, precio_kilo:0.21 },
    { id:'ma02', grupo:'Materiales y Empaque', concepto:'ESQUINERO 2.10', cantidad:96, unidades:'PIEZA', precio_usd:0, precio_mxn:13, precio_kilo:0.06 },
    { id:'ma03', grupo:'Materiales y Empaque', concepto:'FLEJE', cantidad:216, unidades:'METROS', precio_usd:0, precio_mxn:8, precio_kilo:0.01 },
    { id:'ma04', grupo:'Materiales y Empaque', concepto:'CORTE Y ACARREO', cantidad:1, unidades:'PIEZA', precio_usd:3, precio_mxn:2, precio_kilo:0.19 },
    { id:'ma05', grupo:'Materiales y Empaque', concepto:'COMISIONES', cantidad:288, unidades:'PIEZA', precio_usd:0, precio_mxn:5, precio_kilo:0.50 },
    { id:'ma06', grupo:'Materiales y Empaque', concepto:'CLAVO', cantidad:192, unidades:'PIEZA', precio_usd:0.90, precio_mxn:0.0076, precio_kilo:0.0076 },
    { id:'ma07', grupo:'Materiales y Empaque', concepto:'OPERATIVOS EMPAQUE', cantidad:1, unidades:'SERVICIO', precio_usd:1.00, precio_mxn:1.00, precio_kilo:1.00 },
    { id:'ma08', grupo:'Materiales y Empaque', concepto:'UTILIDAD', cantidad:1, unidades:'SERVICIO', precio_usd:2.00, precio_mxn:2.00, precio_kilo:2.00 },
    { id:'ma09', grupo:'Materiales y Empaque', concepto:'CAJA DE PLÁSTICO DE 10 KGS', cantidad:2664, unidades:'PIEZA', precio_usd:16.82, precio_mxn:2.68, precio_kilo:2.68 },
    { id:'ma10', grupo:'Materiales y Empaque', concepto:'Rebote', cantidad:0, unidades:'-', precio_usd:0, precio_mxn:0, precio_kilo:0 },
  ]);

  const [semana, setSemana] = useState(23);
  const [fechaInicio, setFechaInicio] = useState('2026-06-02');
  const [fechaFin, setFechaFin] = useState('2026-06-08');
  const [responsable, setResponsable] = useState('Jefe de Acopio - Ing. Huber Rojo');
  const [telefono1, setTelefono1] = useState('459 107 04 36');
  const [telefono2, setTelefono2] = useState('459 134 45 76');
  const [telefono3, setTelefono3] = useState('');
  const [direccion, setDireccion] = useState('Km 4.5 Carretera Tacámbaro-Pátzcuaro, El Testerazo, Tacámbaro, Michoacán');
  const [plantilla, setPlantilla] = useState('premium');

  const [isPublishing, setIsPublishing] = useState(false);
  const previewRef = useRef(null);

  // MOTOR DE FÓRMULAS DINÁMICAS
  const [formulaRefs, setFormulaRefs] = useState({ 
    d8:22600, e7:0, o14:30, r12:1, k14:42, h25:8.46, t14:42, r14:7, 
    tipoCambio: 17.2, base100: 1.8, base150: 3.2, base180: 5.5, basePela: -3.5,
    kgPorCaja6: 6, kgPorCaja10: 10 
  });

  const [formulaRows, setFormulaRows] = useState([
    {id:15,label:'FLETE TERRESTRE',g:4705.88,e:1,precio_kilo:null},
    {id:16,label:'SEGURO Y TRAMITE',g:588.24,e:1,precio_kilo:null},
    {id:17,label:'TARIMA',g:200,e:1,precio_kilo:null},
    {id:18,label:'COMISIONES',g:5,e:1,precio_kilo:null},
    {id:19,label:'OTROS (editable)',g:13,e:1,precio_kilo:null}
  ]);

  // Editing state for EXCEL formulas (only through EDIT button)
  const [editingFormulaRowId, setEditingFormulaRowId] = useState(null);

  // Direct price compra override (editable without button)
  const [precioCompraOverride, setPrecioCompraOverride] = useState(null);

  const [campoResults, setCampoResults] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [campoLatest, setCampoLatest] = useState(null);
  const [csvRows, setCsvRows] = useState([]);

  // Nueva tabla editable 5 cols x 9 filas - full formato: lock + bg color + cell type + text color + font style
  const [tableCells, setTableCells] = useState(() => {
    const init = {};
    const cols = ['A', 'B', 'C', 'D', 'E'];
    for (let r = 1; r <= 9; r++) {
      cols.forEach(col => {
        const id = `${col}${r}`;
        init[id] = { 
          raw: (r === 1 && col === 'A' ? '12.5' : ((r === 2 && col === 'B') ? '=A1*2' : '')), 
          color: '#f1f5f9', 
          locked: false,
          type: 'numero',
          textColor: '#111827',
          bold: false,
          italic: false
        };
      });
    }
    return init;
  });
  const [selCell, setSelCell] = useState('A1');
  const [isTableEditing, setIsTableEditing] = useState(false);
  const [isCostosEditing, setIsCostosEditing] = useState(false);

  // NEW DESTINATION COST ENGINE STATE
  const [destinos, setDestinos] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [selectedDestinoId, setSelectedDestinoId] = useState(null);
  const [destinoCostResult, setDestinoCostResult] = useState(null);
  const [destinoValores, setDestinoValores] = useState([]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulador, setSimulador] = useState({ precioFruta: 0, utilidadKg: 0, utilidadPct: 0, pallets: 24, cajasPorPallet: 156, kgPorCaja: 6, flete: 80000, tipoCambio: 17.2 });
  const [showMatrix, setShowMatrix] = useState(false);

  useEffect(() => { loadCalibres(); loadCostos(); loadPublicados(); loadCampoLatest(); checkSuper(); loadTablaEditable(); loadDetalleCostos(); loadDestinos(); loadConceptos(); }, []);

  useEffect(() => {
    if (selectedDestinoId) {
      loadDestinoValores(selectedDestinoId).then(() => asegurarValoresPorDefecto(selectedDestinoId));
      calcularCostoDestino(selectedDestinoId, 0, 0);
    }
  }, [selectedDestinoId]);

  async function checkSuper() {
    try {
      const r = await fetch('/api/auth/check-super-admin');
      if (r.ok) {
        const j = await r.json();
        setIsSuperAdmin(!!j.isSuperAdmin);
      }
    } catch (_) { setIsSuperAdmin(false); }
  }

  async function loadCampoLatest() {
    const r = await fetch('/api/precios-fruta/campo?latest=true');
    if (r.ok) setCampoLatest(await r.json());
  }

  async function loadCalibres() {
    const res = await fetch('/api/precios-fruta/calibres');
    if (res.ok) setCalibres(await res.json());
  }
  async function loadCostos() {
    const res = await fetch('/api/precios-fruta/costos');
    if (res.ok) {
      const data = await res.json();
      const cEdit = {}; data.forEach(c => cEdit[c.concepto] = Number(c.valor)||0);
    }
  }
  async function loadPublicados() {
    const res = await fetch('/api/precios-fruta/publicados');
    if (res.ok) {
      const list = await res.json();
      setPublicados(Array.isArray(list)?list:[]);
    }
    const ra = await fetch('/api/precios-fruta/publicados?activo=true');
    if (ra.ok) setCurrentPublished(await ra.json());
  }

  async function loadTablaEditable() {
    try {
      const r = await fetch('/api/precios-fruta/tabla-editable');
      if (r.ok) {
        const data = await r.json();
        const incoming = (data && data.cells && typeof data.cells === 'object') ? data.cells : {};
        if (Object.keys(incoming).length > 0) {
          const cols = ['A','B','C','D','E'];
          const full = {};
          for (let rN = 1; rN <= 9; rN++) {
            cols.forEach(col => {
              const id = `${col}${rN}`;
              full[id] = incoming[id] ? { ...incoming[id] } : { raw: '', color: '#f1f5f9', locked: false, type: 'numero', textColor: '#111827', bold: false, italic: false };
            });
          }
          setTableCells(full);
        }
      }
    } catch (_) {}
  }

  function editarTabla() {
    setIsTableEditing(true);
  }

  async function guardarTabla() {
    try {
      const res = await fetch('/api/precios-fruta/tabla-editable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cells: tableCells })
      });
      const resp = await res.json().catch(() => ({}));
      if (res.ok && resp.success) {
        await loadTablaEditable();
        setIsTableEditing(false);
      } else {
        alert('Error al guardar la tabla' + (resp.error ? ': ' + resp.error : ''));
      }
    } catch (e) {
      alert('Error al guardar la tabla');
    }
  }

  async function loadDetalleCostos() {
    try {
      const r = await fetch('/api/precios-fruta/costos-detalle');
      if (r.ok) {
        const data = await r.json();
        if (data && Array.isArray(data.rows) && data.rows.length > 0) {
          setDetalleCostos(data.rows.map(r => ({...r, cantidad: Number(r.cantidad)||0, precio_usd:Number(r.precio_usd)||0, precio_mxn:Number(r.precio_mxn)||0, precio_kilo:Number(r.precio_kilo)||0 })));
        }
      }
    } catch (_) {}
  }

  async function loadDestinos() {
    try {
      const r = await fetch('/api/precios-fruta/destinos');
      if (r.ok) {
        const d = await r.json();
        setDestinos(Array.isArray(d) ? d : []);
        if (!selectedDestinoId && d.length) setSelectedDestinoId(d[0].id);
      }
    } catch (_) {}
  }
  async function loadConceptos() {
    try {
      const r = await fetch('/api/precios-fruta/costo-conceptos');
      if (r.ok) setConceptos(await r.json() || []);
    } catch (_) {}
  }
  async function loadDestinoValores(destId) {
    if (!destId) return [];
    const r = await fetch(`/api/precios-fruta/destino-valores?destino_id=${destId}`);
    const data = r.ok ? (await r.json() || []) : [];
    setDestinoValores(data);
    return data;
  }
  async function calcularCostoDestino(destId, precioFruta = 0, utilidad = 0) {
    if (!destId) return null;
    const url = `/api/precios-fruta/destino-costos?destino_id=${destId}&precio_fruta=${precioFruta}&utilidad=${utilidad}`;
    const r = await fetch(url);
    if (r.ok) {
      const data = await r.json();
      setDestinoCostResult(data);
      return data;
    }
    return null;
  }

  async function updateDestinoField(destId, field, val) {
    const num = parseFloat(val);
    setDestinos(prev => prev.map(d => d.id === destId ? { ...d, [field]: isNaN(num) ? d[field] : num } : d));
    // auto recalc on change
    setTimeout(() => recalcularSeleccionado(), 120);
  }

  async function actualizarValorConcepto(row, field, val) {
    const num = parseFloat(val) || 0;
    setDestinoValores(prev => prev.map(v => {
      if ((v.id && v.id === row.id) || v.concepto_id === row.concepto_id) {
        return { ...v, [field]: num };
      }
      return v;
    }));
  }

  async function guardarValoresDestino() {
    if (!selectedDestinoId) return;
    await fetch('/api/precios-fruta/destino-valores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destino_id: selectedDestinoId, valores: destinoValores.map(v => ({ concepto_id: v.concepto_id || v.id, cantidad: v.cantidad, precio_unitario: v.precio_unitario })) })
    });
    alert('Configuración de destino guardada. Motor usará estos valores.');
    await loadDestinoValores(selectedDestinoId);
    await calcularCostoDestino(selectedDestinoId);
  }

  async function recalcularSeleccionado() {
    if (selectedDestinoId) await calcularCostoDestino(selectedDestinoId, simulador.precioFruta || 0, simulador.utilidadKg || 0);
  }

  async function asegurarValoresPorDefecto(destId) {
    // auto seed default values from conceptos for the validation example if empty
    if (!destId || destinoValores.length > 0) return;
    const defs = conceptos.map((c, i) => ({
      concepto_id: c.id,
      cantidad: c.nombre.includes('Flete') || c.nombre.includes('Seguro') ? 1 : (c.nombre.includes('Tarima') ? 24 : (c.nombre.includes('Esquinero') ? 96 : 1)),
      precio_unitario: c.precio_unitario || 0
    }));
    if (defs.length) {
      await fetch('/api/precios-fruta/destino-valores', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ destino_id: destId, valores: defs }) });
      await loadDestinoValores(destId);
    }
  }

  async function guardarDetalleCostos() {
    try {
      const res = await fetch('/api/precios-fruta/costos-detalle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: detalleCostos })
      });
      if (res.ok) {
        setIsCostosEditing(false);
      } else {
        alert('Error al guardar costos detallados');
      }
    } catch (e) {
      alert('Error al guardar');
    }
  }

  function cancelarEdicionCostos() {
    loadDetalleCostos();
    setIsCostosEditing(false);
  }

  function updateDetalle(id, col, v) {
    if (col === 'concepto' || col === 'unidades' || col === 'grupo') {
      setDetalleCostos(prev => prev.map(r => r.id === id ? {...r, [col]: v} : r));
      return;
    }
    const val = Number(v)||0;
    setDetalleCostos(prev => prev.map(r => {
      if (r.id === id) {
        const nr = {...r, [col]: val};
        if (col === 'precio_kilo') {
          const pv = Number(val);
          nr.precio_kilo = Number.isFinite(pv) ? Number(pv.toFixed(4)) : (Number(val)||0);
        } else if (baseKg > 0) {
          const unit = nr.precio_mxn || nr.precio_usd || 0;
          nr.precio_kilo = Number(((nr.cantidad * unit) / baseKg).toFixed(4));
        }
        return nr;
      }
      return r;
    }));
  }

  function agregarFilaDetalle() {
    const newId = 'det-' + Date.now();
    setDetalleCostos(prev => [...prev, {
      id: newId, grupo: 'Materiales y Empaque', concepto: 'NUEVO CONCEPTO',
      cantidad: 1, unidades: 'PIEZA', precio_usd: 0, precio_mxn: 0, precio_kilo: 0
    }]);
  }
  function eliminarFilaDetalle(id) {
    setDetalleCostos(prev => prev.filter(r => r.id !== id));
  }

  const sumCostosDetalle = (detalleCostos||[]).reduce((s,b)=>s+(Number(b.precio_kilo)||0),0);
  const subTransporte = (detalleCostos||[]).filter(r=> (r.grupo||'').includes('Transporte')).reduce((s,b)=>(s+(Number(b.precio_kilo)||0)),0);
  const subMateriales = (detalleCostos||[]).filter(r=> (r.grupo||'').includes('Empaque') || (r.grupo||'').includes('Material')).reduce((s,b)=>(s+(Number(b.precio_kilo)||0)),0);

  // Nueva tabla: cálculos de fórmulas reactivos
  const computedValues = useMemo(() => {
    const res = {};
    const get = (id, stack = []) => {
      if (res[id] !== undefined) return res[id];
      if (stack.includes(id)) return 0; // evitar ciclo
      const cell = tableCells[id];
      if (!cell) return 0;
      const raw = (cell.raw || '').trim();
      if (!raw || !raw.startsWith('=')) {
        const n = Number(raw);
        const v = Number.isFinite(n) ? n : 0;
        res[id] = v;
        return v;
      }
      let expr = raw.slice(1).replace(/\s/g, '');
      expr = expr.replace(/([A-E])(\d{1,2})/gi, (_, col, rn) => {
        const key = col.toUpperCase() + rn;
        const sub = get(key, [...stack, id]);
        return Number.isFinite(sub) ? sub : 0;
      });
      try {
        if (!/^[\d+\-*/().]+$/.test(expr)) { res[id] = 0; return 0; }
        const v = new Function('return ' + expr)();
        const vv = Number.isFinite(v) ? v : 0;
        res[id] = vv;
        return vv;
      } catch { res[id] = 0; return 0; }
    };
    Object.keys(tableCells).forEach(k => get(k));
    return res;
  }, [tableCells]);

  function formatCellValue(val, cell) {
    const t = (cell && cell.type) || 'numero';
    const num = Number(val) || 0;
    if (t === 'moneda') return '$' + num.toFixed(2);
    if (t === 'porcentaje') return (num * 100).toFixed(1) + '%';
    if (t === 'texto') return String(val || '');
    return num.toFixed(2);
  }

  function updateTableCell(id, patch) {
    setTableCells(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function setCellRaw(id, raw) {
    if (tableCells[id]?.locked) return;
    updateTableCell(id, { raw });
  }
  function toggleLock(id) {
    const curr = tableCells[id]?.locked;
    updateTableCell(id, { locked: !curr });
  }
  function setCellColor(id, color) {
    updateTableCell(id, { color });
  }

  function setCellType(id, type) {
    updateTableCell(id, { type });
  }
  function setCellTextColor(id, color) {
    updateTableCell(id, { textColor: color });
  }
  function toggleCellBold(id) {
    const curr = !!(tableCells[id]?.bold);
    updateTableCell(id, { bold: !curr });
  }
  function toggleCellItalic(id) {
    const curr = !!(tableCells[id]?.italic);
    updateTableCell(id, { italic: !curr });
  }

  function resetTable() {
    const init = {};
    const cols = ['A','B','C','D','E'];
    for (let r = 1; r <= 9; r++) {
      cols.forEach(col => {
        const id = `${col}${r}`;
        init[id] = { raw: '', color: '#f1f5f9', locked: false, type: 'numero', textColor: '#111827', bold: false, italic: false };
      });
    }
    setTableCells(init);
    setSelCell('A1');
  }

  function toggleColumnLock(col) {
    const ids = Array.from({length:9}, (_,i) => `${col}${i+1}`);
    const curr = !!(tableCells[ids[0]] && tableCells[ids[0]].locked);
    const newL = !curr;
    setTableCells(prev => {
      const n = { ...prev };
      ids.forEach(id => {
        if (n[id]) n[id] = { ...n[id], locked: newL };
      });
      return n;
    });
  }

  function setColumnColor(col, color) {
    const ids = Array.from({length:9}, (_,i) => `${col}${i+1}`);
    setTableCells(prev => {
      const n = { ...prev };
      ids.forEach(id => {
        if (n[id]) n[id] = { ...n[id], color };
      });
      return n;
    });
  }

  function setColumnType(col, type) {
    const ids = Array.from({length:9}, (_,i) => `${col}${i+1}`);
    setTableCells(prev => {
      const n = { ...prev };
      ids.forEach(id => { if (n[id]) n[id] = { ...n[id], type }; });
      return n;
    });
  }
  function setColumnTextColor(col, color) {
    const ids = Array.from({length:9}, (_,i) => `${col}${i+1}`);
    setTableCells(prev => {
      const n = { ...prev };
      ids.forEach(id => { if (n[id]) n[id] = { ...n[id], textColor: color }; });
      return n;
    });
  }

  // Live derived calcs: memoized NO side-effects = no client loop or exception on click-edit fields
  const livePreciosCalculados = useMemo(() => calcular(), [preciosVenta, preciosCompra, sumCostosDetalle, modo]);
  const liveCampoResults = useMemo(() => calcularMotorExcel(), [preciosVenta, preciosCompra, sumCostosDetalle, formulaRefs, formulaRows, baseKg, precioCompraOverride]);

  function calcular() {
    const sumCostos = sumCostosDetalle || 0;
    let result = {};
    const keys = ['super_extra','extra','primera','mediano','tercera','cuarta','proceso','canica','desecho'];
    if (modo === 'venta_a_compra') {
      keys.forEach(k => { const v = Number(preciosVenta[k]||0); result[k] = Math.max(0, Number((v - sumCostos).toFixed(2))); });
    } else {
      keys.forEach(k => { const v = Number(preciosCompra[k]||0); result[k] = Number((v + sumCostos + 3).toFixed(2)); });
    }
    return result;
  }

  // MOTOR EXCEL - Traducción literal al español según reglas dadas
  // Replicación completa de fórmulas. No usa Excel externo. Motor interno dinámico.
  function calcularMotorExcel() {
    const d8 = Number(formulaRefs.d8) || 1;
    const e7 = Number(formulaRefs.e7) || 0;
    const o14 = Number(formulaRefs.o14) || 0;
    const r12 = Number(formulaRefs.r12) || 1;
    const k14 = Number(formulaRefs.k14) || 0;
    const h25 = Number(formulaRefs.h25) || 0;
    const t14 = Number(formulaRefs.t14) || 0;
    const r14 = Number(formulaRefs.r14) || 0;
    const tc = Number(formulaRefs.tipoCambio) || 17.2;
    const b100 = Number(formulaRefs.base100) || 1.8;
    const b150 = Number(formulaRefs.base150) || 3.2;
    const b180 = Number(formulaRefs.base180) || 5.5;
    const bPela = Number(formulaRefs.basePela) || -3.5;
    const kg6 = Number(formulaRefs.kgPorCaja6) || 6;
    const kg10 = Number(formulaRefs.kgPorCaja10) || 10;

    const filasCalc = formulaRows.map(rw => {
      const gVal = Number(rw.g)||0;
      const eVal = Number(rw.e)||0;
      const manual = rw.precio_kilo != null ? Number(rw.precio_kilo) : null;
      const calc = (gVal * eVal) / (Number(d8)||1);
      const costo = manual != null ? manual : calc;
      return { ...rw, costoCalculated: Number(costo.toFixed(4)) };
    });
    const sumaUnit = filasCalc.reduce((acc,f)=> acc + (f.costoCalculated||0),0);

    const costoUnitario = Number(sumaUnit.toFixed(4));
    const diffMargen = Number((k14 - h25).toFixed(2));
    const precioUnit = Number((t14 / r12).toFixed(2));
    const esc6 = Number((r14 * kg6).toFixed(2));
    const esc10 = Number((r14 * kg10).toFixed(2));
    const ajuste = Number((o14 + e7).toFixed(2));

    const precioCompraBase = Math.max(0, Number((preciosVenta.extra || 38) - sumaUnit).toFixed(2));
    const precioCampoFinal = (precioCompraOverride != null && !isNaN(Number(precioCompraOverride)))
      ? Number(precioCompraOverride)
      : precioCompraBase;

    const vSugerido = Number((precioCampoFinal + sumaUnit + 3).toFixed(2));
    const utilidad = Number((vSugerido - sumaUnit).toFixed(2));

    const p100 = Number((precioCompraBase + b100).toFixed(2));
    const p150 = Number((precioCompraBase + b150).toFixed(2));
    const p180 = Number((precioCompraBase + b180).toFixed(2));
    const pelaPalo = Number((precioCompraBase + bPela).toFixed(2));

    const baseExtra = precioCompraBase;
    const calibersBoard = {
      super_extra: Math.max(0, Number((preciosVenta.super_extra || 45) - (sumaUnit * 0.97)).toFixed(2)),
      extra: baseExtra,
      primera: Math.max(0, Number((preciosVenta.primera || 39) - sumaUnit - 1.5).toFixed(2)),
      mediano: Math.max(0, Number((preciosVenta.mediano || 36) - sumaUnit - 2).toFixed(2)),
      tercera: Math.max(0, Number((preciosVenta.tercera || 33) - sumaUnit - 3).toFixed(2)),
      cuarta: Math.max(0, Number((preciosVenta.cuarta || 16) - sumaUnit).toFixed(2)),
      proceso: Math.max(0, Number((preciosVenta.proceso || 17) - sumaUnit).toFixed(2)),
      canica: Math.max(0, Number((preciosVenta.canica || 16) - sumaUnit - 1).toFixed(2)),
      desecho: Math.max(0, Number((preciosVenta.desecho || 16) - sumaUnit - 3).toFixed(2))
    };

    const c6 = Number(((calibersBoard.extra * kg6) + (sumaUnit * kg6) * 0.6).toFixed(2));
    const c6mxn = Number(c6.toFixed(2));
    const c6usd = Number((c6 / tc).toFixed(2));

    const c10 = Number(((calibersBoard.extra * kg10) + (sumaUnit * kg10) * 0.6).toFixed(2));
    const c10mxn = Number(c10.toFixed(2));
    const c10usd = Number((c10 / tc).toFixed(2));

    const resObj = {
      costoUnitario, sumaGastosUnitarios: sumaUnit, diferenciaMargen: diffMargen,
      precioUnitario: precioUnit,
      precioEscenario6: esc6, precioEscenario10: esc10,
      ajustePrecioBase: ajuste, precioCampoSemanal: precioCampoFinal,
      precioVentaSugerido: vSugerido, utilidadEstimada: utilidad, filas: filasCalc,
      precio_100: p100, precio_150: p150, precio_180: p180, precio_pela_palo: pelaPalo,
      tipo_cambio: tc,
      calibers: calibersBoard,
      caja6_mxn: c6mxn, caja6_usd: c6usd,
      caja10_mxn: c10mxn, caja10_usd: c10usd,
      campo_operativos_6: c6, campo_operativos_10: c10
    };
    return resObj;
  }

  useEffect(() => {
    if (campoLatest) {
      const merge = {
        precioCampoSemanal: Number(campoLatest.precio_de_compra)||0,
        precio_100: Number(campoLatest.precio_100)||0,
        precio_150: Number(campoLatest.precio_150)||0,
        precio_180: Number(campoLatest.precio_180)||0,
        precio_pela_palo: Number(campoLatest.precio_pela_palo)||0,
        tipo_cambio: Number(campoLatest.tipo_cambio)||17.2,
        caja6_mxn: Number(campoLatest.caja_6kg_mxn)||0,
        caja6_usd: Number(campoLatest.precio_venta_usd_6kg)||0,
        caja10_mxn: Number(campoLatest.caja_10kg)||0,
        caja10_usd: Number(campoLatest.precio_venta_usd_10kg)||0
      };
      setCampoResults(cur => ({...(cur||{}), ...merge }));
    }
  }, [campoLatest]);

  function updateFormulaRef(key, val) {
    const num = Number(val);
    setFormulaRefs(prev => ({...prev, [key]: isNaN(num) ? prev[key] : num }));
  }

  function parseAndApplyCSV(text) {
    if (!text) return;
    const lines = text.trim().split(/\r?\n/);
    const rows = lines.map(l => l.split(',').map(v=>v.trim()));
    setCsvRows(rows);
    rows.forEach(row => {
      const key = (row[0]||'').toUpperCase();
      const v1 = Number(row[1]); 
      if (!isFinite(v1)) return;
      if (key.includes('D8') || key.includes('BASE') || key.includes('KG')) updateFormulaRef('d8', v1);
      if (key.includes('E7') || key.includes('AJUSTE')) updateFormulaRef('e7', v1);
      if (key.includes('R14') || key.includes('BASE R')) updateFormulaRef('r14', v1);
      if (key.includes('FLETE') && v1 > 100) updateFormulaRow(15,'g', v1);
      if (key.includes('SEGURO')) updateFormulaRow(16,'g', v1);
      if (key.includes('TIPO CAMBIO') || key.includes('TC')) updateFormulaRef('tipoCambio', v1);
      if (key.includes('100')) updateFormulaRef('base100', v1);
      if (key.includes('150')) updateFormulaRef('base150', v1);
      if (key.includes('180')) updateFormulaRef('base180', v1);
    });
  }

  async function handleCSVUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    parseAndApplyCSV(txt);
    alert('CSV cargado y aplicado al motor. Los precios se recalculan automáticamente.');
    e.target.value = '';
  }
  function updateFormulaRow(id, field, val) {
    if (field === 'precio_kilo') {
      const num = Number(val);
      setFormulaRows(prev => prev.map(r => r.id === id ? {...r, [field]: isNaN(num) ? null : num } : r));
      return;
    }
    const num = Number(val);
    setFormulaRows(prev => prev.map(r => r.id === id ? {...r, [field]: isNaN(num)?r[field]:num } : r));
  }
  function agregarFilaFormula() {
    const newId = (formulaRows.length ? Math.max(...formulaRows.map(x=>x.id)) : 14) + 1;
    setFormulaRows(prev => [...prev, {id: newId, label:'NUEVO CONCEPTO CAMPO', g:10, e:1, precio_kilo: null}]);
  }
  function eliminarFilaFormula(id) {
    setFormulaRows(prev => prev.filter(r => r.id !== id));
  }

  async function publicar() {
    if (!livePreciosCalculados) { alert('Calcula primero'); return; }
    setIsPublishing(true);
    try {
      const imgUrl = await generateAndUploadImage();
      const pay = {
        semana: parseInt(semana), fecha_inicio: fechaInicio, fecha_fin: fechaFin,
        tipo_calculo: modo==='venta_a_compra'?'compra':'venta',
        super_extra: livePreciosCalculados.super_extra || 0, extra: livePreciosCalculados.extra || 0,
        primera: livePreciosCalculados.primera || 0, mediano: livePreciosCalculados.mediano || 0,
        tercera: livePreciosCalculados.tercera || 0, cuarta: livePreciosCalculados.cuarta || 0,
        proceso: livePreciosCalculados.proceso || 0, canica: livePreciosCalculados.canica || 0,
        desecho: livePreciosCalculados.desecho || 0,
        responsable, telefono_1: telefono1, telefono_2: telefono2, direccion,
        plantilla, imagen_url: imgUrl, usuario_publico:'superadmin'
      };
      const r = await fetch('/api/precios-fruta/publicados', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(pay)});
      if (r.ok) { alert('Precios publicados'); loadPublicados(); }
    } catch(e){ alert('Error: '+e.message); } finally { setIsPublishing(false); }
  }

  async function sincronizarCampo() {
    const r = liveCampoResults || calcularMotorExcel();
    if (!r) { alert('Motor debe calcular primero'); return; }
    const payload = {
      semana: parseInt(semana),
      fecha_actualizacion: fechaInicio,
      calibre_precios_compra: 'EXTRA',
      precio_de_venta: preciosVenta?.extra || 42,
      precio_de_compra: r && r.precioCampoSemanal ? r.precioCampoSemanal : 0,
      precios_en_campo: r.precioCampoSemanal,
      campo_operativos_6kg: r.campo_operativos_6,
      caja_6kg_mxn: r.caja6_mxn,
      precio_venta_usd_6kg: r.caja6_usd,
      campo_operativos_10kg: r.campo_operativos_10,
      caja_10kg: r.caja10_mxn,
      precio_venta_usd_10kg: r.caja10_usd,
      tipo_cambio: r.tipo_cambio,
      precio_100: r.precio_100,
      precio_150: r.precio_150,
      precio_180: r.precio_180,
      precio_pela_palo: r.precio_pela_palo,
      concepto_costo_operativo: 'FLETE+SEGURO+MATERIALS',
      precio_por_kilo: r.costoUnitario,
      creado_por: isSuperAdmin ? 'SUPERADMIN' : 'ACOPIO'
    };
    const res = await fetch('/api/precios-fruta/campo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
      alert('Guardado en Precios_Fruta_Campo. Tablero actualizado.');
      loadCampoLatest();
    } else {
      alert('Guardado con error');
    }
  }

  async function generateAndUploadImage() {
    if (!previewRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(previewRef.current, {scale:2, backgroundColor:'#fff'});
    const blob = await (await fetch(canvas.toDataURL('image/jpeg',0.92))).blob();
    const fd = new FormData(); fd.append('file', blob, `precios-campo-sem${semana}.jpg`);
    const up = await fetch('/api/upload', {method:'POST', body: fd});
    const j = await up.json();
    return j.url || j.fileUrl || null;
  }

  async function descargarJPG() {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(previewRef.current, {scale:2, backgroundColor:'#fff'});
    const a = document.createElement('a'); a.download=`precios-campo-semana-${semana}.jpg`; a.href=canvas.toDataURL('image/jpeg',0.95); a.click();
  }
  async function descargarPDF() {
    const jsPDF = (await import('jspdf')).default;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(previewRef.current, {scale:2});
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    doc.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',12,15,186,0);
    doc.save(`precios-campo-semana-${semana}.pdf`);
  }

  function compartir(medio) {
    const txt = `Precios Fruta en Campo Semana ${semana} - ${responsable}. FLETE/SEGURO: 3.54 USD + 0.44. Precio Campo: ${liveCampoResults?.precioCampoSemanal || '-'}`;
    if (medio==='wsp') window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
    else if (medio==='copy') { navigator.clipboard.writeText(txt); alert('Copiado'); }
  }

  const PrecioBanner = ({data,isPreview,sumCostos,plantilla: plantillaSel = 'premium'}) => {
    const p = data || livePreciosCalculados || {};
    const sem = data ? data.semana : semana;

    const tpl = plantillaSel || 'premium';
    let headerCls = 'bg-emerald-900 text-white';
    let theadCls = 'text-white bg-emerald-800';
    let accent = 'emerald';
    let wrapperCls = 'bg-white border';

    if (tpl === 'clasico') {
      headerCls = 'bg-slate-800 text-white';
      theadCls = 'text-white bg-slate-700';
      accent = 'slate';
    } else if (tpl === 'minimal') {
      headerCls = 'bg-zinc-800 text-white';
      theadCls = 'text-white bg-zinc-700';
      wrapperCls = 'bg-white border border-zinc-300';
      accent = 'zinc';
    } else if (tpl === 'oscuro') {
      headerCls = 'bg-zinc-950 text-white';
      theadCls = 'text-white bg-zinc-900';
      wrapperCls = 'bg-zinc-950 text-white border border-zinc-800';
      accent = 'zinc';
    }

    return (
      <div ref={isPreview?previewRef:null} className={`w-full max-w-4xl mx-auto border rounded-3xl overflow-hidden ${wrapperCls}`} style={{color: tpl==='oscuro'?'#fff':'#000000'}}>
        <div className={`px-8 py-5 flex items-center gap-3 ${headerCls}`}>
          <div className="font-black text-2xl tracking-widest">TECAVO FRUITS</div>
          <div className="flex-1 text-center font-bold tracking-[2px] text-lg">PRECIOS DE LA FRUTA EN CAMPO</div>
          <div className="text-xs text-right opacity-75">SEMANA {sem}</div>
        </div>
        <div className="p-6" style={{color: tpl==='oscuro'?'#fff':'#000000'}}>
          <table className="w-full mb-6 text-sm">
            <thead><tr className={theadCls}><th className="px-4 py-1 text-left">CALIBRE</th><th className="px-4 py-1 text-right">PRECIO KG</th></tr></thead>
            <tbody>
              {[['super_extra','SUPER EXTRA'],['extra','EXTRA'],['primera','PRIMERA'],['mediano','MEDIANO'],['tercera','TERCERA'],['cuarta','CUARTA'],['proceso','PROCESO'],['canica','CANICA'],['desecho','DESECHO']].map(([k,l])=>(
                <tr key={k} className={tpl==='oscuro' ? 'border-b border-zinc-700' : 'border-b'}>
                  <td className="px-4 py-1.5 font-semibold">{l}</td>
                  <td className="px-4 py-1.5 text-right font-extrabold text-xl" style={{color: tpl==='oscuro'?'#fff':'#000000'}}>${Number(p[k]||0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={`text-xs border-t pt-2 ${tpl==='oscuro' ? 'border-zinc-700 text-zinc-300' : ''}`}>
            COSTOS OPERATIVOS POR KG: <span className="font-black">${Number(sumCostos||sumCostosDetalle||12.44).toFixed(2)}</span> — Transporte e Insurance visibles
          </div>
        </div>
      </div>
    );
  };

  const res = livePreciosCalculados || {};

  function camposResultsToCalibers(k) {
    if (!liveCampoResults || !liveCampoResults.calibers) return 0;
    return liveCampoResults.calibers[k] || 0;
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex justify-between mb-2">
        <div><div className="text-3xl font-bold text-emerald-900">Precios de Fruta en Campo</div><div className="text-sm text-emerald-600">Sección de la pestaña Cortes • Motor Excel dinámico + calculadora vivos • Todos en negro</div></div>
        <button onClick={()=>router.push('/')} className="text-sm border px-4 py-1.5 rounded-xl">Volver</button>
      </div>

      {/* SECCIONES DE LA PESTAÑA CORTES */}
      <div className="flex flex-wrap gap-2 mb-5 text-sm">
        <button onClick={() => router.push('/acopios')} className="px-4 py-1.5 rounded-xl border bg-white hover:bg-white/90 font-medium">Acopios</button>
        <button onClick={() => router.push('/cutting-orders')} className="px-4 py-1.5 rounded-xl border bg-white hover:bg-white/90 font-medium">Orden de corte</button>
        <button onClick={() => router.push('/precios-fruta')} className="px-4 py-1.5 rounded-xl bg-emerald-700 text-white font-medium">Precios de fruta</button>
      </div>

      <div className="flex gap-2 mb-6 border-b pb-1">
        {['calc','tablero','disenos','historial'].map(t => <button key={t} onClick={()=>setActiveTab(t)} className={`px-6 py-2 font-medium rounded-t border-b-2 ${activeTab===t?'border-black text-black':'text-slate-500 border-transparent'}`}>{t==='calc'?'Calculadoras':t==='tablero'?'Tablero Precios Campo':t==='disenos'?'Diseños':'Historial'}</button>)}
      </div>

      {activeTab==='calc' && (
        <>
          <div className="flex gap-3 mb-4">
            <button className={`flex-1 py-3 rounded-xl font-semibold ${modo==='venta_a_compra'?'bg-black text-white':'border'}`} onClick={()=>setModo('venta_a_compra')}>COMPRA desde VENTA</button>
            <button className={`flex-1 py-3 rounded-xl font-semibold ${modo==='compra_a_venta'?'bg-black text-white':'border'}`} onClick={()=>setModo('compra_a_venta')}>VENTA desde COMPRA</button>
          </div>

          <div className="bg-white p-7 rounded-3xl border mb-8">
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-100 rounded-xl p-4">
                <div className="font-bold mb-2 text-sm tracking-wide" style={{color:'#000000'}}>INGRESA PRECIOS</div>
                <div className="space-y-1">
                  {[
                    ['super_extra','SUPER'],
                    ['extra','EXTRA'],
                    ['primera','PRIMERA'],
                    ['mediano','MEDIANO'],
                    ['tercera','TERCERA'],
                    ['proceso','PROCESO'],
                    ['desecho','DESECHO']
                  ].map(([k, label]) => {
                    const v = modo==='venta_a_compra' ? preciosVenta[k] : preciosCompra[k];
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <div className="w-20 text-xs font-semibold" style={{color:'#000000'}}>{label}</div>
                        <input value={v} type="number" step="0.01" className="border px-2 flex-1 py-1 text-xl font-mono bg-white" style={{color:'#000000'}} onChange={e=>{const nv=Number(e.target.value)||0; if(modo==='venta_a_compra')setPreciosVenta({...preciosVenta,[k]:nv}); else setPreciosCompra({...preciosCompra,[k]:nv}); }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-emerald-100 rounded-xl p-4">
                <div className="font-bold mb-2 text-sm tracking-wide" style={{color:'#000000'}}>RESULTADOS CALCULADORA</div>
                <div className="space-y-1">
                  {[
                    ['super_extra','SUPER'],
                    ['extra','EXTRA'],
                    ['primera','PRIMERA'],
                    ['mediano','MEDIANO'],
                    ['tercera','TERCERA'],
                    ['proceso','PROCESO'],
                    ['desecho','DESECHO']
                  ].map(([k, label]) => (
                    <div key={k} className="flex items-center gap-2 rounded-lg border border-emerald-300 p-1.5 bg-white/70">
                      <div className="w-20 text-xs font-semibold" style={{color:'#000000'}}>{label}</div>
                      <div className="flex-1 text-right text-2xl font-extrabold" style={{color:'#000000'}}>${Number(res[k]||0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* NEW: MOTOR DE COSTOS POR DESTINO - Arquitectura completa */}
            <div className="my-6 border border-emerald-900/30 rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="uppercase text-xs font-extrabold tracking-widest" style={{color:'#000000'}}>COSTOS DETALLADOS POR DESTINO — Motor ERP (kg)</div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => { setIsSimulatorOpen(!isSimulatorOpen); }} className="px-3 py-1 rounded bg-amber-600 text-white">SIMULAR COSTO DESTINO</button>
                  <button onClick={() => setShowMatrix(!showMatrix)} className="px-3 py-1 rounded border">MATRIZ DESTINOS</button>
                  <select value={selectedDestinoId || ''} onChange={e => setSelectedDestinoId(parseInt(e.target.value))} className="border px-2 py-1 rounded text-xs">
                    <option value="">— Selecciona destino —</option>
                    {destinos.map(d => <option key={d.id} value={d.id}>{d.nombre} ({d.pais})</option>)}
                  </select>
                </div>
              </div>

              {/* Tarjetas de métricas clave */}
              {destinoCostResult && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                  {[
                    ['KG TOTALES', destinoCostResult.kg_totales],
                    ['COSTO FRUTA/KG', (simulador.precioFruta || 0)],
                    ['COSTO LOGÍSTICO/KG', destinoCostResult.subtotal_transporte_kg],
                    ['COSTO EMPAQUE/KG', destinoCostResult.subtotal_empaque_kg],
                    ['COSTO OPERATIVO/KG', destinoCostResult.costo_operativo_kg],
                    ['COSTO TOTAL DESTINO/KG', destinoCostResult.costo_total_puesto_destino_kg],
                    ['UTILIDAD/KG', destinoCostResult.utilidad_kg],
                    ['PRECIO OBJETIVO/KG', destinoCostResult.precio_objetivo_kg],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
                      <div className="text-[9px] uppercase tracking-widest text-emerald-700">{label}</div>
                      <div className="text-xl font-black tabular-nums text-emerald-950">{Number(val||0).toFixed(4)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Datos generales del destino (editables) */}
              {selectedDestinoId && destinos.find(d=>d.id===selectedDestinoId) && (
                <div className="mb-3 text-xs bg-slate-50 p-2 rounded border flex flex-wrap gap-3">
                  {(() => { const d = destinos.find(x=>x.id===selectedDestinoId); return (
                    <>
                      <span className="font-semibold">{d.nombre}</span>
                      <span>Pallets: <input type="number" className="w-14 border px-1" value={d.pallets} onChange={e=>updateDestinoField(d.id,'pallets',e.target.value)} /></span>
                      <span>Cajas/pallet: <input type="number" className="w-14 border px-1" value={d.cajas_por_pallet} onChange={e=>updateDestinoField(d.id,'cajas_por_pallet',e.target.value)} /></span>
                      <span>Kg/caja: <input type="number" step="0.1" className="w-14 border px-1" value={d.kg_por_caja} onChange={e=>updateDestinoField(d.id,'kg_por_caja',e.target.value)} /></span>
                      <span>Tipo cambio: <input type="number" step="0.01" className="w-16 border px-1" value={d.tipo_cambio} onChange={e=>updateDestinoField(d.id,'tipo_cambio',e.target.value)} /></span>
                      <button onClick={() => recalcularSeleccionado()} className="px-2 py-0.5 bg-black text-white rounded text-[10px]">RECALCULAR</button>
                    </>
                  ); })()}
                </div>
              )}

              {/* Tabla de conceptos con tipos de cálculo */}
              <div className="overflow-x-auto border rounded mb-3">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-emerald-800 text-white">
                      <th className="p-1.5 text-left pl-2">CONCEPTO</th>
                      <th className="p-1.5">CANT</th>
                      <th className="p-1.5">TIPO CÁLCULO</th>
                      <th className="p-1.5">PREC. MXN</th>
                      <th className="p-1.5">PREC/KG</th>
                      <th className="p-1.5">CAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(destinoValores.length ? destinoValores : conceptos).slice(0,12).map((v, idx) => {
                      const row = destinoValores[idx] || v;
                      const concepto = row.concepto || row;
                      const cant = row.cantidad || (row.nombre === 'Flete terrestre' ? 1 : row.nombre === 'Tarima' ? 24 : 1);
                      const pu = row.precio_unitario || concepto.precio_unitario || 0;
                      const costoKg = destinoCostResult?.desglose?.find(x => x.nombre === concepto.nombre)?.costo_kg || (pu / (destinoCostResult?.kg_totales || 22464));
                      return (
                        <tr key={idx} className="border-b">
                          <td className="pl-2 py-1 font-medium">{concepto.nombre || row.nombre}</td>
                          <td className="text-center"><input type="number" className="w-14 border text-center" value={cant} onChange={e => actualizarValorConcepto(row, 'cantidad', e.target.value)} /></td>
                          <td className="text-center text-[10px]">{concepto.tipo_calculo || row.tipo_calculo || 'POR_UNIDAD'}</td>
                          <td className="text-center"><input type="number" step="0.01" className="w-20 border text-right" value={pu} onChange={e => actualizarValorConcepto(row, 'precio_unitario', e.target.value)} /></td>
                          <td className="text-center font-black tabular-nums">{Number(costoKg || 0).toFixed(4)}</td>
                          <td className="text-[10px] text-slate-500">{concepto.categoria}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-900 text-white font-bold">
                      <td colSpan={3} className="pl-2 py-1">GRAN TOTAL COSTO OPERATIVO / KG</td>
                      <td></td>
                      <td className="text-center text-lg">{(destinoCostResult?.costo_operativo_kg || 0).toFixed(4)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-2 text-xs">
                <button onClick={() => guardarValoresDestino()} className="px-4 py-1 bg-black text-white rounded">GUARDAR CONFIG DESTINO</button>
                <button onClick={() => calcularCostoDestino(selectedDestinoId, simulador.precioFruta, simulador.utilidadKg)} className="px-4 py-1 border rounded">RECALCULAR</button>
                <div className="text-emerald-700 pt-1">KG totales referencia: {destinoCostResult?.kg_totales || 22464} (24×156×6)</div>
              </div>

              {/* SIMULADOR */}
              {isSimulatorOpen && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="font-semibold text-sm mb-2">SIMULADOR — Cambia valores y ve impacto inmediato</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                    {Object.keys(simulador).map(k => (
                      <div key={k}>
                        <label className="block text-[10px]">{k}</label>
                        <input type="number" step="0.01" className="border w-full px-1 py-0.5" value={simulador[k]} onChange={e => setSimulador({...simulador, [k]: parseFloat(e.target.value)||0})} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { 
                    // call engine with overrides
                    const ov = conceptos.map((c,i) => ({ concepto_id: c.id, cantidad: simulador.pallets || 24, precio_unitario: (c.nombre.includes('Flete')?simulador.flete: c.precio_unitario), nombre: c.nombre, categoria: c.categoria, tipo: c.tipo_calculo }));
                    fetch('/api/precios-fruta/destino-costos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({destino_id: selectedDestinoId, precio_fruta_kg: simulador.precioFruta, overrides: ov})}).then(r=>r.json()).then(setDestinoCostResult);
                  }} className="mt-2 px-3 py-1 bg-amber-700 text-white rounded text-xs">APLICAR SIMULACIÓN (temporal)</button>
                  <div className="text-[10px] mt-1 text-amber-700">La simulación no modifica datos oficiales hasta "Guardar como configuración".</div>
                </div>
              )}

              {/* MATRIZ SIMPLE */}
              {showMatrix && (
                <div className="mt-3 text-xs border p-2 rounded">
                  <div className="font-bold mb-1">MATRIZ PRECIO FRUTA + COSTO DESTINO (ejemplo)</div>
                  <table className="w-full border-collapse">
                    <thead><tr className="bg-slate-100"><th>CALIBRE</th><th>PRECIO FRUTA</th><th>HONDURAS</th><th>USA</th><th>MÉXICO</th></tr></thead>
                    <tbody>
                      {['EXTRA','PRIMERA','MEDIANO'].map(cal => (
                        <tr key={cal} className="border-b">
                          <td>{cal}</td>
                          <td>{(liveCampoResults?.calibers?.[cal.toLowerCase()] || 35).toFixed(2)}</td>
                          <td className="font-black">{((destinoCostResult?.costo_total_puesto_destino_kg || 14.16) + 35).toFixed(2)}</td>
                          <td className="font-black">—</td>
                          <td className="font-black">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[10px] mt-1">Al seleccionar celda se mostraría desglose completo (Precio fruta + Flete/kg + ... + Utilidad = Precio objetivo).</div>
                </div>
              )}

              <div className="text-[10px] mt-2 text-black/60">Centralizado en DestinationCostEngine. Guarda variables originales. Recalcula siempre en backend. Trazabilidad vía historial. Validado contra 22,464 kg y 14.15775641 MXN/kg.</div>
            </div>

            {/* COMPAT: mantener sums para resto de la página (banners, etc) */}
            {(() => { 
              // keep old sums for live calculations
              const s = (detalleCostos||[]).reduce((a,b)=>a+(Number(b.precio_kilo)||0),0); 
              return null; 
            })()}

            {/* TABLA 5 COLUMNAS 9 FILAS: tipo de celda (num/moneda/%), color por celda, forma letra (bold/italic), bloquear, color de col. */}
            <div className="mt-7 border bg-slate-50 rounded-2xl p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold tracking-widest uppercase">TABLA EDITABLE (5 COL • 9 FILAS)</div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {!isTableEditing ? (
                    <button onClick={editarTabla} className="px-3 py-0.5 rounded bg-emerald-700 text-white">✏️ EDITAR</button>
                  ) : (
                    <>
                      <button onClick={guardarTabla} className="px-3 py-0.5 rounded bg-black text-white">💾 GUARDAR</button>
                      <button onClick={() => setIsTableEditing(false)} className="px-3 py-0.5 border rounded text-xs bg-white">CANCELAR</button>
                    </>
                  )}
                  <button onClick={() => toggleLock(selCell)} className="px-2 py-0.5 rounded border bg-white hover:bg-white/80" disabled={!isTableEditing}>{(tableCells[selCell]||{}).locked ? '🔓 DESBLOQ' : '🔒 BLOQ'}</button>
                  <input type="color" value={(tableCells[selCell]||{}).color || '#f1f5f9'} onChange={e=>setCellColor(selCell, e.target.value)} className="w-6 h-6 rounded border p-0" title="Fondo de celda" disabled={!isTableEditing} />
                  <span className="text-[9px] px-1">TIPO</span>
                  <select 
                    value={(tableCells[selCell]||{}).type || 'numero'} 
                    onChange={e=>setCellType(selCell, e.target.value)}
                    className="border text-[10px] px-1 py-0 rounded bg-white"
                    disabled={!isTableEditing}
                  >
                    <option value="numero">Número</option>
                    <option value="moneda">Moneda</option>
                    <option value="porcentaje">Porcentaje</option>
                    <option value="texto">Texto</option>
                  </select>
                  <input type="color" value={(tableCells[selCell]||{}).textColor || '#111827'} onChange={e=>setCellTextColor(selCell, e.target.value)} className="w-5 h-5 rounded border p-0" title="Color texto" disabled={!isTableEditing} />
                  <button onClick={() => toggleCellBold(selCell)} className={`px-1.5 py-0.5 rounded border text-xs font-bold ${ (tableCells[selCell]||{}).bold ? 'bg-black text-white' : 'bg-white' }`} disabled={!isTableEditing}>B</button>
                  <button onClick={() => toggleCellItalic(selCell)} className={`px-1.5 py-0.5 rounded border italic text-xs ${ (tableCells[selCell]||{}).italic ? 'bg-black text-white' : 'bg-white' }`} disabled={!isTableEditing}>I</button>
                  <button onClick={resetTable} className="px-2 py-0.5 border rounded bg-white text-xs" disabled={!isTableEditing}>REINICIAR</button>
                  <span className="font-mono pl-1">Sel: <strong>{selCell}</strong></span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm w-full" style={{minWidth:'640px'}}>
                  <thead>
                    <tr>
                      <th className="border bg-emerald-800 text-white px-2 py-0.5 w-7 text-[10px]">#</th>
                      {['A','B','C','D','E'].map(col => (
                        <th key={col} className="border bg-emerald-800 text-white px-1 py-0.5 text-center" style={{minWidth:'90px'}}>
                          <div className="text-xs font-bold">{col}</div>
                          <div className="flex justify-center gap-0.5 mt-0.5 items-center flex-wrap">
                            <button onClick={() => toggleColumnLock(col)} className="text-[9px] px-0.5 py-px bg-white/20 hover:bg-white/40 rounded" title="Bloquear columna" disabled={!isTableEditing}>🔒</button>
                            <input 
                              type="color" 
                              value={(tableCells[`${col}1`] || {}).color || '#f1f5f9'} 
                              onChange={e => setColumnColor(col, e.target.value)} 
                              className="w-3 h-3 border p-0 rounded" 
                              title="Color fondo col." 
                              disabled={!isTableEditing}
                            />
                            <select 
                              value={(tableCells[`${col}1`] || {}).type || 'numero'} 
                              onChange={e => setColumnType(col, e.target.value)} 
                              className="text-[8px] px-0 py-0 w-12 bg-white/70 border rounded" 
                              disabled={!isTableEditing}
                            >
                              <option value="numero">Nº</option>
                              <option value="moneda">$</option>
                              <option value="porcentaje">%</option>
                              <option value="texto">Txt</option>
                            </select>
                            <input 
                              type="color" 
                              value={(tableCells[`${col}1`] || {}).textColor || '#111827'} 
                              onChange={e => setColumnTextColor(col, e.target.value)} 
                              className="w-3 h-3 border p-0 rounded" 
                              title="Color texto col." 
                              disabled={!isTableEditing}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({length: 9}, (_,ri) => ri+1).map(row => (
                      <tr key={row}>
                        <td className="border text-center bg-white text-[10px] font-mono text-emerald-900 px-0.5">{row}</td>
                        {['A','B','C','D','E'].map(col => {
                          const id = col + row;
                          const c = tableCells[id] || {raw:'', color:'#f1f5f9', locked:false, type:'numero', textColor:'#111827', bold:false, italic:false};
                          const v = computedValues[id] || 0;
                          const isSel = selCell === id;
                          const displayValue = formatCellValue(v, c);
                          const cellStyle = { 
                            background: c.color || '#f1f5f9',
                            color: c.textColor || '#111827',
                            fontWeight: c.bold ? '700' : 'normal',
                            fontStyle: c.italic ? 'italic' : 'normal'
                          };
                          return (
                            <td key={col} onClick={() => setSelCell(id)} className={`border p-px relative align-top cursor-pointer ${isSel ? 'ring-1 ring-offset-0 ring-emerald-600' : ''}`} style={{background:c.color}}>
                              <input 
                                value={c.raw} 
                                disabled={!isTableEditing || c.locked} 
                                onChange={e => setCellRaw(id, e.target.value)} 
                                className="block w-full px-1 py-px bg-transparent text-xs font-mono border-0 outline-none" 
                                placeholder={c.locked ? 'bloqueado' : ''} 
                              />
                              <div className="text-right px-1 text-emerald-900/70 text-[9px] tabular-nums font-semibold pb-px" style={cellStyle} title="Resultado">{displayValue}</div>
                              {c.locked && <div className="absolute top-0 right-0 text-[8px] pr-0.5 pt-0.5">🔒</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-1 text-[9px] leading-tight text-gray-500">{isTableEditing ? 'Modo edición: edita valores y formatos. Al GUARDAR quedan persistentes en la base.' : 'Solo lectura. Presiona EDITAR para modificar y guardar datos guardados.'} Valores o fórmulas (=A1+B2). Click celda, elige TIPO/COLOR/FORMATO(letra) arriba. Botones col sobre header cuando se edita.</div>
            </div>

          </div>

          <div>
            <div className="mb-3 font-semibold flex flex-wrap gap-2 items-center">
              <span className="mr-1">VISTA PREVIA</span>
              {['premium','clasico','minimal','oscuro'].map(tpl => (
                <button
                  key={tpl}
                  onClick={() => setPlantilla(tpl)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-2xl border transition-all ${plantilla === tpl ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm' : 'bg-white hover:bg-slate-100 border-slate-300'}`}
                >
                  {tpl === 'premium' ? 'Premium' : tpl === 'clasico' ? 'Clásico' : tpl === 'minimal' ? 'Minimal' : 'Oscuro'}
                </button>
              ))}
            </div>
            <PrecioBanner isPreview sumCostos={sumCostosDetalle} plantilla={plantilla} />

            <div className="pt-3 flex flex-wrap gap-2">
              <button onClick={publicar} disabled={isPublishing} className="bg-black text-white px-8 py-3 text-sm font-semibold rounded-2xl">PUBLICAR PRECIOS CAMPO</button>
              <button onClick={descargarJPG} className="px-5 py-3 bg-white border rounded-xl text-sm">JPG</button>
              <button onClick={descargarPDF} className="px-5 py-3 bg-white border rounded-xl text-sm">PDF</button>
              <button onClick={()=>compartir('wsp')} className="px-5 py-3 bg-white border rounded-xl text-sm">WhatsApp</button>
            </div>
          </div>
        </>
      )}

      {activeTab==='disenos' && (<div className="py-10"><PrecioBanner isPreview sumCostos={sumCostosDetalle} plantilla={plantilla} /></div>)}
      {activeTab==='tablero' && (
        <div className="mb-10">
          <div className="mb-4">
            <div className="text-xl font-bold tracking-tight mb-1" style={{color:'#000000'}}>TABLERO VISUAL PRECIOS DE FRUTA EN CAMPO</div>
            <div className="text-sm text-black">Diseño tipo corporativo Canva. Datos dinámicos sobre plantilla visual. Actualiza al modificar cualquier entrada del motor.</div>
          </div>

          {isSuperAdmin && (
            <div className="bg-emerald-50 border p-4 rounded-2xl mb-4">
              <div className="uppercase text-xs font-bold tracking-[1px] mb-2" style={{color:'#000000'}}>SUPERADMIN • SINCRONIZACIÓN CSV Y GUARDADO INTERNO</div>
              <div className="flex flex-wrap gap-3">
                <label className="px-5 py-2 bg-black text-white rounded-xl text-sm cursor-pointer">
                  IMPORTAR CSV (formato referencia Excel)
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />
                </label>
                <button onClick={sincronizarCampo} className="px-6 py-2 rounded-xl border-2 border-black font-bold text-sm" style={{color:'#000'}}>GUARDAR SNAPSHOT EN PRECIOS_FRUTA_CAMPO</button>
                <div className="text-xs text-black pt-2">Se actualiza sin depender del CSV externo después de carga.</div>
              </div>
              {csvRows.length > 0 && <div className="text-[10px] text-emerald-900 mt-1 font-mono">{csvRows.length} filas importadas aplicadas al motor.</div>}
            </div>
          )}

          <div ref={previewRef} className="max-w-[1060px] mx-auto bg-white border-[12px] border-emerald-900 rounded-3xl overflow-hidden shadow-2xl p-0" style={{color:'#000000'}}>
            <div className="bg-emerald-900 px-8 py-4 text-white flex justify-between items-center">
              <div>
                <div className="font-black text-[28px] tracking-[2.5px]">TECAVO FRUITS</div>
                <div className="text-xs opacity-80 -mt-0.5">PRECIOS DE COMPRA EN CAMPO • SEMANA {semana}</div>
              </div>
              <div className="text-right text-xs">
                <div>F. ACTUALIZACIÓN: {fechaInicio}</div>
                <div>{responsable}</div>
              </div>
            </div>

            <div className="p-7 pb-2" style={{background:'#fff', color:'#000000'}}>
              <div className="uppercase font-bold text-sm tracking-widest mb-2 text-emerald-800">PRECIOS POR CALIBRE</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-5">
                {[['super_extra','SUPER'],['extra','EXTRA'],['primera','PRIMERA'],['mediano','MEDIANO'],['tercera','TERCERA'],['cuarta','CUARTA'],['proceso','PROCESO'],['canica','CANICA'],['desecho','DESECHO']].map(([k, lbl]) => {
                  const val = (liveCampoResults?.calibers ? liveCampoResults.calibers[k] : 0) || camposResultsToCalibers(k) || 0;
                  return (
                    <div key={k} className="border border-black rounded-2xl bg-white h-14 flex flex-col items-center justify-center px-1 text-center">
                      <div className="uppercase font-extrabold text-[10px] tracking-wide" style={{color:'#000000'}}>{lbl}</div>
                      <div className="text-[22px] font-black leading-none tabular-nums" style={{color:'#000000'}}>${Number(val||0).toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="uppercase font-bold text-sm tracking-widest mb-2 text-emerald-800">PRECIOS ESPECIALES / TIERS</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mb-6">
                {[
                  {label: '100 +', val: liveCampoResults?.precio_100},
                  {label: '150 +', val: liveCampoResults?.precio_150},
                  {label: '180 +', val: liveCampoResults?.precio_180},
                  {label: 'PELA PALO', val: liveCampoResults?.precio_pela_palo}
                ].map((x,i)=>(
                  <div key={`tier-${x.label}`} className="rounded-2xl p-2 h-14 border border-black bg-white flex flex-col items-center justify-center">
                    <div className="text-[10px] tracking-[1px] font-black" style={{color:'#000000'}}>{x.label}</div>
                    <div className="text-2xl font-extrabold leading-none tabular-nums" style={{color:'#000000'}}>${Number(x.val||0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-emerald-900/95 text-white text-center text-sm tracking-wide flex flex-wrap items-center justify-between">
              <div>ULTIMA SINCRONIZACIÓN INTERNA: {campoLatest?.created_at ? new Date(campoLatest.created_at).toLocaleString('es-MX') : 'PENDIENTE'}</div>
              <div>SEMANA {semana} — {fechaFin}</div>
            </div>
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={sincronizarCampo} className="px-7 py-2 bg-emerald-900 text-white rounded-2xl text-sm font-semibold">GUARDAR EN Precios_Fruta_Campo (TABLA INTERNA)</button>
            <button onClick={descargarJPG} className="border px-5 py-2 text-sm bg-white rounded-xl">DESCARGAR JPG (Canva)</button>
            <button onClick={descargarPDF} className="border px-5 py-2 text-sm bg-white rounded-xl">DESCARGAR PDF</button>
          </div>
          <div className="text-xs mt-2 text-black/70">Los valores cambian automáticamente al editar datos del motor. Sin archivos externos después de primer sincronización.</div>
        </div>
      )}

      {activeTab==='historial' && (<div className="py-4 space-y-3">
        {publicados.length===0 && <div>Sin publicaciones.</div>}
        {publicados.map(p => <div key={p.id} className="border rounded p-4 text-sm">Semana {p.semana} • {p.fecha_inicio} → {p.fecha_fin} • {p.tipo_calculo}</div>)}
      </div>)}
    </div>
  );
}
