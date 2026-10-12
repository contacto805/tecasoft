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
  }, [refreshKey]);

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
              <button onClick={() => router.push('/pallet-configuration')} className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100">Config. Tarimas</button>
            </nav>
          </div>
          <div className="text-sm text-slate-500">Control de materiales y empaque</div>
        </div>
      </header>

      <main className="pt-16 max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Inventario de Materiales</h1>
            <p className="text-slate-500 mt-1">Control de stock de empaque, cajas, tarimas y materiales auxiliares</p>
          </div>
          <button onClick={handleAddMaterial} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            + Agregar Material
          </button>
        </div>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        {/* Materials Table */}
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-2 border-b flex justify-end"><button onClick={()=>{}} className="text-xs px-2 py-0.5 border">Alternar Visibilidad Datos</button></div>
          <div className="p-4 border-b flex justify-between">
            <div className="font-semibold">Stock de Materiales</div>
            <button onClick={handleAddMaterial} className="text-sm text-emerald-600 hover:underline">+ Nuevo</button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4">Material</th>
                <th className="text-left p-4">Clave</th>
                <th className="text-left p-4">Categoría</th>
                <th className="text-left p-4">Disponible</th>
                <th className="text-left p-4">Mínimo</th>
                <th className="text-left p-4">Costo Unit.</th>
                <th className="text-left p-4">Estado</th>
                <th className="p-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">Sin materiales. Agrega uno.</td></tr>
              )}
              {materials.map(m => {
                const low = (m.quantity_available || 0) < (m.minimum_stock || 50);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium">{m.material_name}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{m.clave || '-'}</td>
                    <td className="p-4 text-slate-600">{m.category || '-'}</td>
                    <td className={`p-4 font-medium ${low ? 'text-red-600' : ''}`}>{m.quantity_available} {m.unit}</td>
                    <td className="p-4 text-slate-500">{m.minimum_stock || '-'}</td>
                    <td className="p-4 text-slate-500">${parseFloat(m.cost_per_unit || 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline px-2 py-0.5 text-xs rounded-full ${low ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {low ? 'Bajo stock' : (m.estatus || 'Activo')}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2 justify-end text-sm">
                      <button onClick={() => handleEditMaterial(m)} className="text-blue-600 px-2 py-1">Editar</button>
                      <button onClick={() => handleDeleteMaterial(m.id, m.material_name)} className="text-red-600 px-2 py-1">Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 mt-4">
          Sincronizado con órdenes de compra, gastos y descuentos automáticos en producción.
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
