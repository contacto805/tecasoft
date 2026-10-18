'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MaterialsInventoryPage() {
  const router = useRouter();

  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

  // FASE 04: Embedded pallet config + simulator inside Materials (full integration)
  const [palletConfigs, setPalletConfigs] = useState([]);
  const [simConfig, setSimConfig] = useState(null);
  const [simOverrides, setSimOverrides] = useState({ kg_por_caja: 10, cajas_por_tarima: 96 });
  const [simResult, setSimResult] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard'); // 1.Dashboard 2.Catalogo 3.Entrada 4.Salida 5.Tarimas 6.Costos 7.Movimientos 8.Proveedores 9.Reportes 10.Config
  const [movements, setMovements] = useState([]);
  const [providers, setProviders] = useState([]);
  const [formData, setFormData] = useState({
    material_name: '',
    category: '',
    quantity_available: '',
    unit: 'unidades',
    minimum_stock: '',
    reorder_quantity: '',
    cost_per_unit: '',
    clave: '',
    estatus: 'Activo'
  });

  useEffect(() => {
    loadMaterials();
    loadUnits();
    loadPalletConfigs();
    if (activeSection === 'movimientos') loadMovements();
    if (activeSection === 'proveedores') loadProviders();
  }, [refreshKey, activeSection]);

  const loadMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  };

  const loadUnits = async () => {
    try {
      const response = await fetch('/api/measurement-units');
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
        if (data.length > 0 && !formData.unit) {
          setFormData(prev => ({ ...prev, unit: data[0].unit_name }));
        }
      }
    } catch (err) {
      console.error('Error loading units:', err);
    }
  };

  const loadPalletConfigs = async () => {
    try {
      const res = await fetch('/api/pallet-configurations');
      if (res.ok) {
        const d = await res.json();
        setPalletConfigs(Array.isArray(d) ? d : []);
      }
    } catch (_) {}
  };

  const loadMovements = async () => {
    try {
      const res = await fetch('/api/movements?entity_type=material');
      if (res.ok) {
        const d = await res.json();
        setMovements(Array.isArray(d) ? d : []);
      }
    } catch (_) { setMovements([]); }
  };

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/purchase-order-suppliers');
      if (res.ok) {
        const d = await res.json();
        setProviders(Array.isArray(d) ? d : []);
      }
    } catch (_) { setProviders([]); }
  };

  const runSimulator = async (cfg) => {
    if (!cfg) return;
    try {
      const res = await fetch('/api/pallet-configurations');
      const all = res.ok ? await res.json() : [];
      const fresh = all.find(c => c.id === cfg.id) || cfg;

      const kgCaja = parseFloat(simOverrides.kg_por_caja || fresh.kg_por_caja || 10);
      const cPorT = parseInt(simOverrides.cajas_por_tarima || fresh.cajas_por_tarima || fresh.boxes_capacity || 96);
      const kgT = cPorT * kgCaja;

      let sum = 0;
      (fresh.materials || []).forEach(m => {
        const q = parseFloat(m.quantity_required || 0);
        const overrideCost = simOverrides.costo_override && simOverrides.costo_override[m.material_id];
        const c = parseFloat(overrideCost || m.effective_cost_per_unit || m.inventory_cost || m.last_known_cost || 0);
        sum += q * c;
      });

      const porCaja = cPorT > 0 ? sum / cPorT : 0;
      const porKg = kgT > 0 ? sum / kgT : 0;

      setSimResult({
        kg_tarima: kgT.toFixed(2),
        costo_tarima: sum.toFixed(2),
        costo_por_caja: porCaja.toFixed(2),
        costo_por_kg: porKg.toFixed(2),
        tipo: 'COSTO ESTÁNDAR (precios vigentes del Inventario de Materiales)'
      });
    } catch (e) { /* silent */ }
  };

  const handleAddUnit = async () => {
    if (!newUnitInput.trim()) {
      setError('El nombre de la unidad es requerido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/measurement-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_name: newUnitInput.trim(),
          abbreviation: newUnitAbbr.trim() || null,
          category: null
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al agregar unidad');
      }
      setSuccess('Unidad de medida agregada exitosamente');
      setNewUnitInput('');
      setNewUnitAbbr('');
      loadUnits();
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al agregar unidad');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (unitId, unitName) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar la unidad "${unitName}"?`)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/measurement-units?id=${unitId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.error));
      setSuccess('Unidad de medida eliminada exitosamente');
      loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al eliminar unidad');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = () => {
    setEditingMaterial(null);
    setFormData({
      material_name: '', category: '', quantity_available: '', unit: units[0]?.unit_name || 'unidades',
      minimum_stock: '', reorder_quantity: '', cost_per_unit: '', clave: '', estatus: 'Activo'
    });
    setShowAddModal(true);
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setFormData({
      material_name: material.material_name || '',
      category: material.category || '',
      quantity_available: material.quantity_available || '',
      unit: material.unit || 'unidades',
      minimum_stock: material.minimum_stock || '',
      reorder_quantity: material.reorder_quantity || '',
      cost_per_unit: material.cost_per_unit || '',
      clave: material.clave || '',
      estatus: material.estatus || 'Activo'
    });
    setShowAddModal(true);
  };

  const handleSaveMaterial = async () => {
    const trimmedName = formData.material_name.trim();
    if (!trimmedName) {
      setError('El nombre del material es requerido');
      return;
    }
    // duplicate check etc.
    if (!editingMaterial) {
      const isDuplicate = materials.some(m => (m.material_name || '').trim().toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicate) { setError('Ya existe un material con ese nombre'); return; }
    }
    setLoading(true);
    setError('');
    try {
      const url = editingMaterial ? `/api/materials/${editingMaterial.id}` : '/api/materials';
      const method = editingMaterial ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          material_name: trimmedName,
          quantity_available: formData.quantity_available ? parseFloat(formData.quantity_available) : 0,
          minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : 0,
          reorder_quantity: formData.reorder_quantity ? parseFloat(formData.reorder_quantity) : 0,
          cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
        })
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Error al guardar material');
      setSuccess(editingMaterial ? 'Material actualizado' : 'Material agregado');
      setShowAddModal(false);
      loadMaterials();
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      setSuccess('Material eliminado');
      loadMaterials();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span onClick={() => router.push('/')} className="font-bold text-xl cursor-pointer">Tecavo Fruits Soft</span>
            <nav className="flex items-center gap-2 text-sm">
              <button onClick={() => router.push('/inventory')} className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">Inventario Fruta</button>
              <button className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 font-medium">Inventario de Materiales</button>
              <button onClick={() => router.push('/bascula')} className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">Báscula Digital</button>
            </nav>
          </div>
          <div className="text-sm text-slate-500">Control de materiales y empaque</div>
        </div>
      </header>

      <main className="pt-16 max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario de Materiales</h1>
            <p className="text-slate-500 mt-1">Control de stock de empaque, cajas, tarimas y materiales auxiliares • FASE 04 Motor de Costos por Tarima integrado</p>
          </div>
          <button onClick={handleAddMaterial} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            + Agregar Material
          </button>
        </div>

        {/* 10 SECCIONES - Tabs */}
        <div className="flex flex-wrap gap-1 mb-4 text-sm">
          {[
            {k:'dashboard', l:'1. Dashboard'},
            {k:'catalogo', l:'2. Catálogo'},
            {k:'entrada', l:'3. Entrada'},
            {k:'salida', l:'4. Salida y Consumo'},
            {k:'tarimas', l:'5. Config. Tarimas'},
            {k:'costos', l:'6. Costos Unitarios'},
            {k:'movimientos', l:'7. Movimientos'},
            {k:'proveedores', l:'8. Proveedores'},
            {k:'reportes', l:'9. Reportes'},
            {k:'config', l:'10. Configuración'}
          ].map(s => (
            <button key={s.k} onClick={()=>setActiveSection(s.k)} className={`px-3 py-1 rounded border ${activeSection===s.k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-slate-50'}`}>{s.l}</button>
          ))}
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* SECCIONES DINÁMICAS */}
        {activeSection === 'dashboard' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-4">1. Dashboard de Inventario Materiales</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 border rounded">Total materiales: <b>{materials.length}</b></div>
              <div className="p-3 border rounded">Bajo stock: <b className="text-red-600">{materials.filter(m=>(m.quantity_available||0)<(m.minimum_stock||50)).length}</b></div>
              <div className="p-3 border rounded">Tarimas configuradas: <b>{palletConfigs.length}</b></div>
              <div className="p-3 border rounded">Valor estimado inventario: <b>${materials.reduce((s,m)=>s + (parseFloat(m.quantity_available||0)*parseFloat(m.cost_per_unit||0)),0).toFixed(2)}</b></div>
            </div>
            <div className="mt-4 text-xs text-slate-500">Fórmula oficial: EXISTENCIA = INICIAL + ENTRADAS - CONSUMOS - SALIDAS + DEV + AJUSTES. Único stock, sin duplicados.</div>
          </div>
        )}

        {activeSection === 'catalogo' && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b flex justify-between"><div className="font-semibold">2. Catálogo de Materiales</div><button onClick={handleAddMaterial} className="text-sm text-emerald-600">+ Nuevo</button></div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left p-4">Material</th><th>Clave</th><th>Categoría</th><th>Disponible</th><th>Mínimo</th><th>Costo</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody className="divide-y">
                {materials.length===0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Sin materiales.</td></tr>}
                {materials.map(m => {
                  const low = (m.quantity_available||0) < (m.minimum_stock||50);
                  return <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium">{m.material_name}</td>
                    <td className="p-4 font-mono text-xs">{m.clave||'-'}</td>
                    <td className="p-4">{m.category||'-'}</td>
                    <td className={`p-4 ${low?'text-red-600':''}`}>{m.quantity_available} {m.unit}</td>
                    <td className="p-4">{m.minimum_stock||'-'}</td>
                    <td className="p-4">${parseFloat(m.cost_per_unit||0).toFixed(2)}</td>
                    <td className="p-4"><span className={`px-2 py-0.5 text-xs rounded ${low?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{low?'Bajo stock':(m.estatus||'Activo')}</span></td>
                    <td className="p-4 flex gap-2"><button onClick={()=>handleEditMaterial(m)} className="text-blue-600">Editar</button><button onClick={()=>handleDeleteMaterial(m.id,m.material_name)} className="text-red-600">Eliminar</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeSection === 'entrada' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">3. Entrada de Materiales</h2>
            <p className="text-sm text-slate-500 mb-4">Escanee código, busque, ingrese cantidad, proveedor, adjunte remisión/foto. Genera movimiento único. Vincula con purchase_receptions si aplica. Stock actualizado por fórmula oficial.</p>
            <button onClick={handleAddMaterial} className="px-4 py-2 bg-emerald-600 text-white rounded">Registrar Entrada / Alta Material</button>
            <div className="mt-3 text-xs">Usa /api/purchase-receptions o entrada manual para actualizar stock (no duplica gastos).</div>
          </div>
        )}

        {activeSection === 'salida' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">4. Salida y Consumo</h2>
            <p className="text-sm text-slate-500">Consumos desde Producción (único service apply para tarimas). Ajustes requieren motivo y autorización. Alertas de stock bajo automáticas.</p>
            <div className="text-xs mt-2">Vinculados a Lote • Corrida • Tarima • Material • Costo aplicado • Usuario • Fecha.</div>
          </div>
        )}

        {(activeSection === 'tarimas' || activeSection === 'costos') && (
          <div className="mt-2 bg-white border rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold">5. Configuración de Tarimas + 6. Costos Unitarios</h2>
            <p className="text-sm text-slate-500 mb-4">Modelos configurables. Fórmulas: KG_TARIMA = CAJAS × KG_CAJA • COSTO_MATERIAL_i = Q_i × COSTO_i • COSTO_TARIMA = SUMA • POR CAJA / POR KG. Simulador actualizado con precios de Inventario.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="font-medium mb-2">Modelos configurados</div>
                <div className="space-y-2 max-h-60 overflow-auto text-sm">
                  {palletConfigs.length === 0 && <div className="text-xs text-slate-500">Sin configuraciones.</div>}
                  {palletConfigs.map(c => (
                    <div key={c.id} className="border p-2 rounded flex justify-between">
                      <div>
                        <div className="font-medium">{c.pallet_name}</div>
                        <div className="text-xs">{c.destino||''} • {c.cajas_por_tarima||c.boxes_capacity} cajas • {c.kg_por_caja||10} kg/caja</div>
                      </div>
                      <button onClick={()=>{setSimConfig(c); runSimulator(c);}} className="text-xs px-2 py-0.5 bg-emerald-100 rounded">Simular</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-medium mb-2">Simulador COSTO ESTÁNDAR vs REAL</div>
                {!simConfig && <div className="text-xs text-slate-500">Selecciona modelo para simular.</div>}
                {simConfig && <div className="border p-3 rounded bg-slate-50 text-sm">
                  <div className="font-semibold">{simConfig.pallet_name}</div>
                  <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                    <label>Kg/caja <input type="number" value={simOverrides.kg_por_caja} onChange={e=>setSimOverrides({...simOverrides,kg_por_caja:e.target.value})} className="border w-16 px-1"/></label>
                    <label>Cajas/tarima <input type="number" value={simOverrides.cajas_por_tarima} onChange={e=>setSimOverrides({...simOverrides,cajas_por_tarima:e.target.value})} className="border w-16 px-1"/></label>
                  </div>
                  <button onClick={()=>runSimulator(simConfig)} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Calcular (precios actuales + histórico)</button>
                  {simResult && <div className="mt-3 text-xs">
                    <div>KG_TARIMA = {simResult.kg_tarima}</div>
                    <div>COSTO ESTÁNDAR: ${simResult.costo_tarima_std} / caja ${simResult.costo_por_caja_std} / kg ${simResult.costo_por_kg_std}</div>
                    <div>COSTO REAL: ${simResult.costo_tarima_real} / caja ${simResult.costo_por_caja_real} / kg ${simResult.costo_por_kg_real}</div>
                    <div className="text-emerald-700">{simResult.tipo}</div>
                    <div className="text-[10px] mt-1">No modificar costos históricos con precios actuales. Conexión con COSTO_INTEGRAL_TARIMA = fruta + corte + materiales + empaque.</div>
                  </div>}
                </div>}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-slate-500">Al confirmar producción: consumo físico vía servicio transaccional único. Reportes en Cierre Semanal incluyen diferencia estándar/real, tarimas por presentación.</div>
          </div>
        )}

        {activeSection === 'movimientos' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">7. Movimientos de Materiales</h2>
            <table className="w-full text-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Material</th><th>Cantidad</th><th>Referencia</th></tr></thead>
            <tbody>{movements.length===0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">Sin movimientos registrados.</td></tr> : movements.slice(0,10).map((m,i)=><tr key={i}><td>{m.created_at?.slice(0,10)}</td><td>{m.movement_type}</td><td>{m.reference}</td><td>{m.qty}</td><td>{m.notes}</td></tr>)}</tbody></table>
          </div>
        )}

        {activeSection === 'proveedores' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">8. Proveedores (Expediente Financiero)</h2>
            <div className="text-xs mb-3">Categorías: Materiales • Cajas • Tarimas • Fletes • Servicios • Combustible • Otros. Cuentas bancarias + saldos + facturas/recepciones.</div>
            <div className="text-sm mb-3">{providers.length ? providers.map(p => (
              <div key={p.id} className="border p-2 mb-1 rounded text-xs">
                {p.supplier_name || p.provider_name} • {p.categoria || p.tipo_proveedor || '—'} • RFC: {p.rfc || '—'}
                <div className="text-[10px] text-slate-500">{p.banco ? p.banco + ' ' + (p.clabe ? 'CLABE ****'+p.clabe.slice(-4) : '') : ''}</div>
              </div>
            )) : 'Proveedores desde purchase_order_suppliers / expense_providers. Agregue en Compras o Gastos.'}</div>
            <div className="text-[10px] text-slate-500">Vincular pagos a cuenta bancaria del proveedor. Saldos desde purchase_orders + receptions + pagos. No duplica gastos al registrar pago.</div>
          </div>
        )}

        {activeSection === 'reportes' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">9. Reportes</h2>
            <p className="text-sm">Cierre semanal: Tarimas producidas • Material consumido • Costo real vs estándar • Diferencias • Existencias finales. Reportes por lote/semana/presentación/material. Valor entradas = movimiento inventario (no gasto comercial).</p>
          </div>
        )}

        {activeSection === 'config' && (
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <h2 className="font-semibold mb-2">10. Configuración</h2>
            <button onClick={()=>setShowUnitsModal(true)} className="px-3 py-1 border rounded text-sm">Gestionar Unidades de Medida (Pieza, Caja, Paquete, Rollo, Metro, Kg, Litro...)</button>
            <div className="mt-2 text-xs">Conversiones exactas. Factor conversión por material. Códigos de barras generados por material.</div>
          </div>
        )}

        {/* Catálogo visible también en modo catalogo o default */}
        {(activeSection === 'catalogo' || activeSection === 'dashboard') && (
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b flex justify-between"><div className="font-semibold">Stock de Materiales (Catálogo)</div><button onClick={handleAddMaterial} className="text-sm text-emerald-600">+ Nuevo</button></div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left p-4">Material</th><th>Clave</th><th>Cat.</th><th>Disponible</th><th>Mín</th><th>Costo</th><th></th></tr></thead>
              <tbody>
                {materials.length===0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Sin materiales.</td></tr>}
                {materials.map(m => {
                  const low = (m.quantity_available||0)<(m.minimum_stock||50);
                  return <tr key={m.id}><td className="p-4">{m.material_name}</td><td className="font-mono text-xs">{m.clave}</td><td>{m.category}</td><td className={low?'text-red-600':''}>{m.quantity_available} {m.unit}</td><td>{m.minimum_stock}</td><td>${parseFloat(m.cost_per_unit||0).toFixed(2)}</td><td><button onClick={()=>handleEditMaterial(m)} className="text-blue-600">Editar</button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FASE 04: MOTOR DE COSTOS POR TARIMA - INTEGRADO EN INVENTARIO DE MATERIALES */}
        <div className="mt-8 bg-white border rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Configuración de Tarimas</h2>
              <p className="text-sm text-slate-500">Modelos (6kg/10kg/etc) • Destino • Presentación • Materiales • Fórmulas • Simulador. COSTO ESTÁNDAR (config + precios actuales) vs COSTO REAL (histórico deducciones). Único servicio transaccional al confirmar producción.</p>
            </div>
            <button onClick={() => router.push('/pallet-configuration')} className="text-sm px-3 py-1.5 border rounded">Módulo Avanzado</button>
          </div>

          {/* Formulas */}
          <div className="mb-4 p-3 bg-slate-50 rounded text-xs border">
            <div className="font-semibold mb-1">FÓRMULAS OFICIALES</div>
            <div>KG_TARIMA = CAJAS_POR_TARIMA × KG_NETOS_POR_CAJA</div>
            <div>COSTO_MATERIAL_i = CANTIDAD_i_EN_UNIDAD_BASE × COSTO_UNITARIO_i</div>
            <div>COSTO_MATERIAL_TARIMA = SUMA(COSTO_MATERIAL_i)</div>
            <div>COSTO_POR_CAJA = COSTO_TARIMA / CAJAS</div>
            <div>COSTO_POR_KG = COSTO_TARIMA / KG_TARIMA</div>
            <div className="mt-1 text-emerald-700">COSTO_INTEGRAL_TARIMA = COSTO_FRUTA + COSTO_CORTE + COSTO_MATERIALES + COSTO_EMPAQUE + OTROS (sin mezclar con costo comercial)</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de configs + selector */}
            <div>
              <div className="font-medium mb-2 flex justify-between">
                <span>Modelos configurados</span>
                <span className="text-xs text-slate-500">Selecciona para simular</span>
              </div>
              <div className="space-y-2 max-h-72 overflow-auto">
                {palletConfigs.length === 0 && <div className="text-xs text-slate-500 p-3 border rounded">Sin configuraciones. Usa el módulo de producción o pallet-configuration para crear modelos (Tarima 6kg CA, 10kg Nacional, etc).</div>}
                {palletConfigs.map(c => (
                  <div key={c.id} onClick={() => { setSimConfig(c); runSimulator(c); }} className={`border p-3 rounded text-sm cursor-pointer ${simConfig?.id===c.id ? 'ring-2 ring-emerald-400 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                    <div className="font-semibold">{c.pallet_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.destino || '—'} • {c.presentacion || c.pallet_type || '—'} • {c.kg_por_caja || 10} kg/caja • {c.cajas_por_tarima || c.boxes_capacity || 96} cajas</div>
                    <div className="text-xs mt-1 text-emerald-600">Materiales: {(c.materials||[]).length} • Costo base cargado del inventario</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulador completo */}
            <div>
              <div className="font-medium mb-2">Simulador (modifica cantidades / costos / presentaciones)</div>
              {!simConfig && <div className="text-xs text-slate-500 p-3 border rounded">Selecciona un modelo para editar y ver costo actualizado con precios vigentes del Inventario de Materiales.</div>}
              {simConfig && (
                <div className="border p-4 rounded bg-white text-sm">
                  <div className="font-bold mb-2">{simConfig.pallet_name}</div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="text-xs">Destino
                      <input value={simConfig.destino || ''} onChange={()=>{}} className="w-full border px-2 py-1 rounded text-sm mt-0.5" disabled />
                    </label>
                    <label className="text-xs">Presentación
                      <input value={simConfig.presentacion || ''} onChange={()=>{}} className="w-full border px-2 py-1 rounded text-sm mt-0.5" disabled />
                    </label>
                    <label className="text-xs">Kg por caja
                      <input type="number" value={simOverrides.kg_por_caja || simConfig.kg_por_caja || 10} onChange={e => { const v = e.target.value; setSimOverrides({...simOverrides, kg_por_caja: v}); runSimulator(simConfig); }} className="w-full border px-2 py-1 rounded text-sm mt-0.5" />
                    </label>
                    <label className="text-xs">Cajas por tarima
                      <input type="number" value={simOverrides.cajas_por_tarima || simConfig.cajas_por_tarima || simConfig.boxes_capacity || 96} onChange={e => { const v = e.target.value; setSimOverrides({...simOverrides, cajas_por_tarima: v}); runSimulator(simConfig); }} className="w-full border px-2 py-1 rounded text-sm mt-0.5" />
                    </label>
                  </div>

                  {/* Materiales configurados + override de costo */}
                  <div className="mb-3">
                    <div className="text-xs font-medium mb-1">Materiales de la tarima (costos desde Inventario actual)</div>
                    {(simConfig.materials || []).length === 0 && <div className="text-xs text-amber-600">Sin materiales vinculados. Edita la configuración para agregar (tarima madera, caja, esquineros, fleje, etc).</div>}
                    {(simConfig.materials || []).map((m, idx) => {
                      const liveCost = parseFloat(m.effective_cost_per_unit || m.inventory_cost || m.last_known_cost || 0);
                      const qty = parseFloat(m.quantity_required || 0);
                      const override = simOverrides.costo_override?.[m.material_id] || liveCost;
                      const costoI = qty * override;
                      return (
                        <div key={idx} className="flex items-center gap-2 border-b py-1 text-xs">
                          <div className="flex-1">{m.material_name}</div>
                          <div className="w-16 text-right">{qty} {m.unit}</div>
                          <div className="w-20">
                            <input type="number" step="0.01" value={override} onChange={e => {
                              const newO = {...(simOverrides.costo_override || {}), [m.material_id]: parseFloat(e.target.value)};
                              setSimOverrides({...simOverrides, costo_override: newO});
                              runSimulator(simConfig);
                            }} className="border w-full px-1 py-0.5 rounded text-xs" />
                          </div>
                          <div className="w-16 text-right font-mono">${costoI.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => runSimulator(simConfig)} className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded">Recalcular con precios actuales del Inventario</button>

                  {simResult && (
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs space-y-1">
                      <div><strong>KG_TARIMA</strong> = {simResult.kg_tarima}</div>
                      <div><strong>COSTO_MATERIAL_TARIMA</strong> = ${simResult.costo_tarima}</div>
                      <div><strong>COSTO_MATERIAL_POR_CAJA</strong> = ${simResult.costo_por_caja}</div>
                      <div><strong>COSTO_MATERIAL_POR_KG</strong> = ${simResult.costo_por_kg}</div>
                      <div className="pt-1 border-t text-emerald-700 font-medium">{simResult.tipo}</div>
                      <div className="text-[10px] text-slate-500">COSTO ESTÁNDAR = configuración + precios actuales. COSTO REAL = consumos históricos reales en material_deductions (no se reescribe).</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-[10px] text-slate-500">
            Al confirmar corrida de Producción se registra el consumo físico mediante servicio único transaccional (pallet-config/apply). Vincula: Lote • Corrida • Tarima • Material • Cantidad • Costo aplicado • Usuario • Fecha. No se descuenta de nuevo al imprimir etiqueta.
          </div>
        </div>

        {/* Add/Edit Material Modal - minimal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center" onClick={() => setShowAddModal(false)}>
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</h3>
              <div className="space-y-3">
                <input placeholder="Nombre *" value={formData.material_name} onChange={e=>setFormData({...formData, material_name:e.target.value})} className="w-full border px-3 py-2 rounded" />
                <input placeholder="Clave / Código" value={formData.clave} onChange={e=>setFormData({...formData, clave:e.target.value})} className="w-full border px-3 py-2 rounded" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Cantidad" type="number" value={formData.quantity_available} onChange={e=>setFormData({...formData, quantity_available:e.target.value})} className="w-full border px-3 py-2 rounded" />
                  <select value={formData.unit} onChange={e=>setFormData({...formData, unit:e.target.value})} className="w-full border px-3 py-2 rounded">
                    {units.map(u=><option key={u.id} value={u.unit_name}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Mínimo" type="number" value={formData.minimum_stock} onChange={e=>setFormData({...formData, minimum_stock:e.target.value})} className="w-full border px-3 py-2 rounded" />
                  <input placeholder="Reordenar" type="number" value={formData.reorder_quantity} onChange={e=>setFormData({...formData, reorder_quantity:e.target.value})} className="w-full border px-3 py-2 rounded" />
                </div>
                <input placeholder="Costo unit. (E)" type="number" step="0.01" value={formData.cost_per_unit} onChange={e=>setFormData({...formData, cost_per_unit:e.target.value})} className="w-full border px-3 py-2 rounded" />
                <input placeholder="Categoría" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full border px-3 py-2 rounded" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded">Cancelar</button>
                <button onClick={handleSaveMaterial} disabled={loading} className="flex-1 py-2 bg-emerald-600 text-white rounded">
                  {loading ? 'Guardando...' : (editingMaterial ? 'Actualizar' : 'Agregar')}
                </button>
              </div>
              <button onClick={() => setShowUnitsModal(true)} className="mt-3 w-full text-xs text-center underline text-slate-500">Gestionar unidades de medida</button>
            </div>
          </div>
        )}

        {/* Units modal */}
        {showUnitsModal && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center" onClick={() => setShowUnitsModal(false)}>
            <div className="bg-white max-w-sm w-full mx-4 p-6 rounded-2xl" onClick={e=>e.stopPropagation()}>
              <h4 className="font-semibold mb-3">Unidades de Medida</h4>
              <div className="max-h-56 overflow-auto space-y-2 mb-4">
                {units.map(u => (
                  <div key={u.id} className="flex justify-between border p-2 rounded text-sm">
                    <span>{u.unit_name} {u.abbreviation && <span className="text-xs">({u.abbreviation})</span>}</span>
                    <button onClick={() => handleDeleteUnit(u.id, u.unit_name)} className="text-red-500">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newUnitInput} onChange={e=>setNewUnitInput(e.target.value)} placeholder="Nueva unidad" className="border flex-1 px-3 py-1 rounded" />
                <input value={newUnitAbbr} onChange={e=>setNewUnitAbbr(e.target.value)} placeholder="Abr." className="border w-16 px-2 py-1 rounded" />
                <button onClick={handleAddUnit} disabled={!newUnitInput.trim()} className="bg-black text-white px-4 rounded text-sm">Agregar</button>
              </div>
              <button onClick={() => setShowUnitsModal(false)} className="w-full mt-4 py-1.5 text-sm border rounded">Cerrar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
