'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DownloadReportButton from '@/components/download-report-button';

export default function InventoryPage() {
  const router = useRouter();
  
  const [editingSlot, setEditingSlot] = useState(null);
  const [warehouseSlots, setWarehouseSlots] = useState({}); // poblado desde pallet_output_summary (fuente única)

  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [pendingInventoryItems, setPendingInventoryItems] = useState([]);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

  // WhatsApp Inventario - Estado modal y función exacta del spec
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const buildInventarioWhatsappMessage = () => {
    // Combinar tarimas completas: asignadas en frío + pendientes de ubicación (fuente pallet_output_summary)
    const allTarimas = [];

    Object.values(warehouseSlots || {}).forEach(s => {
      if (!s) return;
      allTarimas.push({
        presentation: s.presentation || '10 kg',
        caliber: s.caliber || '',
        class_name: s.quality || s.class_name || 'A',
        tarimas: 1,
        cajas: parseInt(s.boxes) || 0
      });
    });

    (pendingInventoryItems || []).forEach(p => {
      const is6 = (p.pallet_type || '').toLowerCase().includes('6');
      const boxesPer = is6 ? 40 : 96;
      const tar = parseInt(p.pallet_count) || 1;
      allTarimas.push({
        presentation: is6 ? '6 kg' : '10 kg',
        caliber: p.caliber || '',
        class_name: p.class_name || 'A',
        tarimas: tar,
        cajas: tar * boxesPer
      });
    });

    const init = () => ({ Super: {t:0,c:0}, Extra: {t:0,c:0}, Primera: {t:0,c:0}, Mediano: {t:0,c:0}, Tercera: {t:0,c:0}, Cuartas: {t:0,c:0} });
    const g6 = init();
    const g10exp = init();
    const g10nac = init();
    const gsemis = init();

    allTarimas.forEach(item => {
      const pres = (item.presentation || '').toLowerCase();
      const cal = (item.caliber || '').toLowerCase();
      const cls = (item.class_name || '').toLowerCase();

      let gkey = '10 Kg Exportación';
      if (pres.includes('6')) gkey = '6 Kg';
      else if (cal.includes('semi')) gkey = 'Semis';
      else if (cls.includes('nacional') || cls.includes('b') || cls.includes('segunda')) gkey = '10 Kg Nacional';

      const g = gkey === '6 Kg' ? g6 : gkey === 'Semis' ? gsemis : gkey === '10 Kg Nacional' ? g10nac : g10exp;

      let gk = 'Extra';
      if (cal.includes('super')) gk = 'Super';
      else if (cal.includes('primera')) gk = 'Primera';
      else if (cal.includes('mediano')) gk = 'Mediano';
      else if (cal.includes('tercera')) gk = 'Tercera';
      else if (cal.includes('cuarta') || cal.includes('cuartas')) gk = 'Cuartas';

      g[gk].t += item.tarimas;
      g[gk].c += item.cajas;
    });

    const fmt = (o) => `Super ${o.Super.t} Tarimas ${o.Super.c} cajas
Extra ${o.Extra.t} Tarimas ${o.Extra.c} cajas
Primera ${o.Primera.t} Tarimas ${o.Primera.c} cajas
Mediano ${o.Mediano.t} Tarimas ${o.Mediano.c} cajas
Tercera ${o.Tercera.t} Tarimas ${o.Tercera.c} cajas
Cuartas ${o.Cuartas.t} Tarimas ${o.Cuartas.c} cajas`;

    const msg = `Clase A

6 Kg
${fmt(g6)}

10 Kg Exportación
${fmt(g10exp)}

10 Kg Nacional
${fmt(g10nac)}

Semis
${fmt(gsemis)}`;

    return msg;
  };

  const handleCompartirWhatsapp = () => {
    const msg = buildInventarioWhatsappMessage();
    setWhatsappMessage(msg);
    setShowWhatsappModal(true);
  };

  const FIXED_WHATSAPP = '524433736931';
  const confirmarWhatsapp = () => {
    setShowWhatsappModal(false);
    const encoded = encodeURIComponent(whatsappMessage);
    // Redirección rígida al número fijo del administrador (como exige el spec)
    window.open(`https://wa.me/${FIXED_WHATSAPP}?text=${encoded}`, '_blank');
  };
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

  // Lista de calibres completa (incluyendo nuevas categorías Semi)
  const allCalibres = [
    "Super (40's)", "Extra (48's)", "Primera (60's)", "Mediano (70's)",
    "Tercera (84's)", "Cuarta", "Super Semi", "Extra Semi", "Primera Semi",
    "Mediano Semi", "Tercera Semi"
  ];

  // Resumen automático calculado desde Mapa de Almacén (actualiza al instante)
  const getResumenDesdeMapa = () => {
    const summary10kg = {};
    const summary6kg = {};
    let total = 0;

    Object.values(warehouseSlots).forEach((slot) => {
      if (!slot || !slot.boxes) return;
      const b = parseInt(slot.boxes) || 0;
      const cal = slot.caliber || 'Sin calibre';
      const pres = (slot.presentation || '10 kg').toLowerCase();
      const is6kg = pres.includes('6');

      total += b;

      if (is6kg) {
        summary6kg[cal] = (summary6kg[cal] || 0) + b;
      } else {
        summary10kg[cal] = (summary10kg[cal] || 0) + b;
      }
    });

    const now = new Date().toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    return { summary10kg, summary6kg, total, lastUpdated: now };
  };

  // Load materials, units, and lots from database
  useEffect(() => {
    loadMaterials();
    loadUnits();
    loadLots();
    loadTarimas();
  }, []);

  // Cargar tarimas reales desde pallet_output_summary (fuente única del sistema para ubicaciones en frío)
  // Esto asegura consistencia con producción, embarques y demás módulos
  const loadTarimas = async () => {
    try {
      const [pRes, pendRes] = await Promise.all([
        fetch('/api/pallet-output'),
        fetch('/api/production/pending-inventory')
      ]);
      const allPallets = pRes.ok ? await pRes.json() : [];
      const pending = pendRes.ok ? await pendRes.json() : [];

      setPendingInventoryItems(Array.isArray(pending) ? pending : []);

      // Construir slots ocupados desde pallet_output_summary (misma lógica que embarques/producción)
      const newSlots = {};
      (Array.isArray(allPallets) ? allPallets : []).forEach((p) => {
        const slot = (p.warehouse_slot || p.ubicacion_actual || '').toUpperCase().trim();
        if (!slot) return;
        if (['EMBARCADA', 'CANCELADA'].includes((p.estado || '').toUpperCase())) return;
        const is6 = (p.pallet_type || '').toLowerCase().includes('6');
        const boxesPerPallet = is6 ? 40 : 96;
        newSlots[slot] = {
          date: p.cold_date ? new Date(p.cold_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : (p.packing_date ? new Date(p.packing_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''),
          boxes: (p.pallet_count || 1) * boxesPerPallet,
          caliber: p.caliber || '',
          quality: p.class_name || 'A',
          lot_id: p.lot_id || null,
          presentation: is6 ? '6 kg' : '10 kg',
          folio: p.folio_tarima || ('TAR-' + String(p.id).padStart(6, '0')),
          pallet_id: p.id
        };
      });
      setWarehouseSlots(newSlots);
    } catch (e) {
      // mantener estado anterior si falla
    }
  };

  // Resumen derivado del mapa (se recalcula en cada render cuando cambian las posiciones)
  const resumen = getResumenDesdeMapa();

  const loadMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error loading materials:', err);
      setError('Error cargando materiales');
    }
  };

  const loadUnits = async () => {
    try {
      const response = await fetch('/api/measurement-units');
      if (response.ok) {
        const data = await response.json();
        setUnits(data);
        // Update default unit if exists
        if (data.length > 0 && !formData.unit) {
          setFormData(prev => ({ ...prev, unit: data[0].unit_name }));
        }
      }
    } catch (err) {
      console.error('Error loading units:', err);
    }
  };

  const loadLots = async () => {
    try {
      const response = await fetch('/api/lots?status=selection');
      if (response.ok) {
        const data = await response.json();
        setLots(data);
      }
    } catch (err) {
      console.error('Error loading lots:', err);
    }
  };

  // (carga de pending integrada en loadTarimas para usar fuente única pallet_output_summary)

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
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al agregar unidad');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (unitId, unitName) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar la unidad "${unitName}"?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/measurement-units?id=${unitId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar unidad');
      }

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
    setShowAddMaterialModal(true);
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
    setShowAddMaterialModal(true);
  };

  const handleSaveMaterial = async () => {
    const trimmedName = formData.material_name.trim();
    if (!trimmedName) {
      setError('El nombre del material es requerido');
      return;
    }

    // Prevent duplicate names when adding (frontend check)
    if (!editingMaterial) {
      const isDuplicate = materials.some(m => 
        (m.material_name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        setError('Ya existe un material con ese nombre. No se permiten duplicados.');
        return;
      }
    }

    // If editing and changing name, check against others
    if (editingMaterial && (editingMaterial.material_name || '').trim().toLowerCase() !== trimmedName.toLowerCase()) {
      const isDuplicate = materials.some(m => 
        m.id !== editingMaterial.id && 
        (m.material_name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        setError('Ya existe un material con ese nombre. No se permiten duplicados.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const url = editingMaterial ? `/api/materials/${editingMaterial.id}` : '/api/materials';
      const method = editingMaterial ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMaterial?.id,
          ...formData,
          material_name: trimmedName,
          quantity_available: formData.quantity_available ? parseFloat(formData.quantity_available) : 0,
          minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : 0,
          reorder_quantity: formData.reorder_quantity ? parseFloat(formData.reorder_quantity) : 0,
          cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
          clave: formData.clave || null,
          estatus: formData.estatus || 'Activo'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Handle duplicate from backend (409)
        if (response.status === 409) {
          throw new Error(errorData.error || 'Ya existe un material con ese nombre');
        }
        throw new Error(errorData.error || 'Error al guardar material');
      }

      setSuccess(editingMaterial ? 'Material actualizado exitosamente' : 'Material agregado exitosamente');
      setShowAddMaterialModal(false);
      loadMaterials();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al guardar material');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (materialId, materialName) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el material "${materialName}"?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar material');
      }

      setSuccess('Material eliminado exitosamente');
      loadMaterials();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al eliminar material');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSlot = (slotId) => {
    setEditingSlot(slotId);
  };

  // Nueva lógica: clic en espacio del mapa abre popup con lista de pendientes para asignar
  const [assignSlot, setAssignSlot] = useState(null);

  const handleSlotClick = (slotId) => {
    setAssignSlot(slotId);
  };

  const closeAssignModal = () => setAssignSlot(null);

  const handleSaveSlot = async (slotId, data) => {
    const slotData = { presentation: '10 kg', ...data };
    setWarehouseSlots(prev => ({
      ...prev,
      [slotId]: slotData
    }));
    setEditingSlot(null);

    // Registrar/actualizar en backend (warehouse map)
    try {
      await fetch('/api/warehouse-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          lotId: slotData.lot_id || 0,
          caliber: slotData.caliber,
          className: slotData.quality || 'A',
          boxes: parseInt(slotData.boxes) || 0,
          kilos: Math.round((parseInt(slotData.boxes) || 0) * 10), // estimación
          notes: `Posición actualizada - ${slotData.presentation || '10 kg'}`
        })
      });
    } catch (_) { /* mantener consistencia en memoria si falla la red */ }
  };

  const handleClearSlot = async (slotId) => {
    const newSlots = { ...warehouseSlots };
    delete newSlots[slotId];
    setWarehouseSlots(newSlots);
    setEditingSlot(null);

    // Registrar limpieza
    try {
      await fetch(`/api/warehouse-map?slotId=${encodeURIComponent(slotId)}`, {
        method: 'DELETE'
      });
    } catch (_) {}
  };

  const handleAssignPendingToSlot = async (slotId, pendingItem) => {
    if (!confirm(`¿Asignar la tarima "${pendingItem.lot_number || pendingItem.folio_tarima || 'Sin nombre'}" a la posición ${slotId}?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/production/assign-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_output_id: pendingItem.id,
          slot_id: slotId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error asignando tarima a posición');
      }

      setSuccess(`Tarima asignada exitosamente a la posición ${slotId}`);
      setTimeout(() => setSuccess(''), 3000);

      // Recargar desde fuente única para consistencia total en todos los módulos
      await loadTarimas();
    } catch (err) {
      setError(err.message || 'Error asignando tarima');
    } finally {
      setLoading(false);
    }
  };

  const EditSlotModal = ({ slotId, onClose }) => {
    const currentData = warehouseSlots[slotId] || { date: '', boxes: '', caliber: '', quality: '', lot_id: null };
    const [slotFormData, setSlotFormData] = useState({ presentation: '10 kg', ...currentData });

    const calibers = ["Super (40's)", "Extra (48's)", "Primera (60's)", "Mediano (70's)", "Tercera (84's)", "Cuarta", "Super Semi", "Extra Semi", "Primera Semi", "Mediano Semi", "Tercera Semi"];
    const qualities = ['Calidad A', 'Calidad B', 'Calidad C', 'Proceso', 'Desecho'];
    const presentations = ['6 kg', '10 kg'];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Editar Posición {slotId}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
              <input
                type="text"
                value={slotFormData.date}
                onChange={(e) => setSlotFormData({ ...slotFormData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="15 Ene 2024"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número de Cajas</label>
              <input
                type="number"
                value={slotFormData.boxes}
                onChange={(e) => setSlotFormData({ ...slotFormData, boxes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="180"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Presentación</label>
              <select
                value={slotFormData.presentation || '10 kg'}
                onChange={(e) => setSlotFormData({ ...slotFormData, presentation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {presentations.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lote *</label>
              <select
                value={slotFormData.lot_id || ''}
                onChange={(e) => setSlotFormData({ ...slotFormData, lot_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">Seleccionar lote en proceso</option>
                {lots.length > 0 ? (
                  lots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} - {lot.producer}
                    </option>
                  ))
                ) : (
                  <option disabled>No hay lotes en proceso de selección</option>
                )}
              </select>
              <p className="text-xs text-slate-500 mt-1">Se muestran solo lotes en proceso de selección</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Calibre</label>
              <select
                value={slotFormData.caliber}
                onChange={(e) => setSlotFormData({ ...slotFormData, caliber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">Seleccionar calibre</option>
                {calibers.map(caliber => (
                  <option key={caliber} value={caliber}>{caliber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Calidad</label>
              <select
                value={slotFormData.quality}
                onChange={(e) => setSlotFormData({ ...slotFormData, quality: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">Seleccionar calidad</option>
                {qualities.map(quality => (
                  <option key={quality} value={quality}>{quality}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleSaveSlot(slotId, slotFormData)}
              className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700"
            >
              Guardar
            </button>
            <button
              onClick={() => handleClearSlot(slotId)}
              className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100"
            >
              Vaciar
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const MaterialModal = ({ onClose }) => {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">
                {editingMaterial ? '✏️ Editar Material' : '➕ Agregar Material'}
              </h3>
              <p className="text-blue-100 mt-1 text-sm">{editingMaterial ? 'Actualiza los detalles del material' : 'Registra un nuevo material en el catálogo y existencias'}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Material *</label>
              <input
                type="text"
                value={formData.material_name}
                onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Ej. Cajas Master 10kg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Ej. Empaque"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clave</label>
                <input
                  type="text"
                  value={formData.clave}
                  onChange={(e) => setFormData({ ...formData, clave: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej. CAJ-10KG"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estatus</label>
                <select
                  value={formData.estatus}
                  onChange={(e) => setFormData({ ...formData, estatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  value={formData.quantity_available}
                  onChange={(e) => setFormData({ ...formData, quantity_available: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                <div className="flex gap-2">
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Seleccionar unidad</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.unit_name}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowUnitsModal(true)}
                    className="px-3 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 border border-slate-300"
                    title="Agregar o quitar unidades"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo</label>
                <input
                  type="number"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reordenar</label>
                <input
                  type="number"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="0"
                />
              </div>
            </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo por Unidad</label>
                <input
                  type="number"
                  value={formData.cost_per_unit}
                  onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 border border-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveMaterial}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors flex items-center gap-2"
            >
              {loading ? '⏳ Guardando...' : (editingMaterial ? '✓ Actualizar' : '➕ Agregar Material')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const UnitsModal = ({ onClose }) => {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-slate-900 mb-4">Gestionar Unidades de Medida</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Add New Unit Section */}
          <div className="mb-6 pb-6 border-b border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">Agregar Nueva Unidad</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newUnitInput}
                  onChange={(e) => setNewUnitInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej. gramos, bolsas, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Abreviatura (opcional)</label>
                <input
                  type="text"
                  value={newUnitAbbr}
                  onChange={(e) => setNewUnitAbbr(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej. g, bol"
                />
              </div>
              <button
                onClick={handleAddUnit}
                disabled={loading || !newUnitInput.trim()}
                className="w-full px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:bg-slate-300"
              >
                {loading ? 'Agregando...' : '+ Agregar Unidad'}
              </button>
            </div>
          </div>

          {/* Units List */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Unidades Existentes</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {units.length === 0 ? (
                <p className="text-sm text-slate-500">No hay unidades disponibles</p>
              ) : (
                units.map(unit => (
                  <div key={unit.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-900">{unit.unit_name}</p>
                      {unit.abbreviation ? <p className="text-xs text-slate-500">Abreviatura: {unit.abbreviation}</p> : null}
                    </div>
                    <button
                      onClick={() => handleDeleteUnit(unit.id, unit.unit_name)}
                      disabled={loading}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded font-medium text-sm disabled:text-slate-400"
                      title="Eliminar unidad"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  };

    return (
      <>
        <div className="min-h-screen flex flex-col font-sans">
          {/* Top Navigation */}
    <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 text-brand-700">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                        <img src="/logo.svg" alt="Tecavo Fruits Soft" className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
                </div>
                
                <nav className="hidden lg:flex items-center gap-1">
                    <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Dashboard Principal
                    </button>
                    <button onClick={() => router.push('/inventory')} className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                        Inventario Fruta
                    </button>
                    <button onClick={() => router.push('/materials')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Inventario Materiales
                    </button>
                    <button onClick={() => router.push('/embarques')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Embarques
                    </button>
                    <button onClick={() => router.push('/acopios')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Acopios
                    </button>
                    <button onClick={() => router.push('/cutting-orders')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Orden de corte
                    </button>
                    <button onClick={() => router.push('/precios-fruta')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Precios de fruta
                    </button>
                    <button onClick={() => router.push('/fruit-input')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Ingreso de Fruta
                    </button>
                    <button onClick={() => router.push('/lot-registration')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Registro de Lotificación
                    </button>
                </nav>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            </div>
        </div>
    </header>

    <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            
            {/* Page Title */}
            <section className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventario de Fruta</h1>
                    <p className="text-slate-500 mt-1">Control de tarimas, inventario en frío y ubicaciones en cámaras. Para materiales ver módulo separado.</p>
                </div>
                <div className="flex gap-3">
                    <DownloadReportButton
                      moduleName="Inventario de Fruta"
                      title="Reporte Inventario Fruta"
                      data={Object.keys(warehouseSlots).map(k => ({ slot: k, ...warehouseSlots[k] }))}
                      columns={[{ header: 'Posición', key: 'slot' }, { header: 'Calibre', key: 'caliber' }, { header: 'Cajas', key: 'boxes' }]}
                      format="pdf"
                    />
                    <button 
                      onClick={handleAddMaterial}
                      className="px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 shadow-sm flex items-center gap-2">
                        <i className="ph ph-plus"></i> Agregar Material
                    </button>
                    <button 
                      onClick={handleCompartirWhatsapp}
                      className="px-4 py-2 bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800 shadow-sm flex items-center gap-2">
                        📱 Compartir Inventario por WhatsApp
                    </button>
                </div>
            </section>

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                {success}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-1">Valor Total Fruta (Frío)</p>
                    <h3 className="text-3xl font-bold text-slate-900">$425,840.00</h3>
                    <p className="text-xs text-emerald-600 mt-2 font-medium">+12% vs semana anterior</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-1">Tarimas en Stock</p>
                    <h3 className="text-3xl font-bold text-slate-900">142</h3>
                    <p className="text-xs text-orange-600 mt-2 font-medium">8 pendientes por despacho</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-500 mb-1">Materiales Críticos</p>
                    <h3 className="text-3xl font-bold text-slate-900">3</h3>
                    <p className="text-xs text-red-600 mt-2 font-medium">Stock bajo: Etiquetas A3</p>
                </div>
            </div>

            {/* Resumen de Cajas por Calibre - Automático desde Mapa de Almacén */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h2 className="font-bold text-lg text-slate-900">Resumen de Cajas por Calibre</h2>
                            <p className="text-sm text-slate-500 mt-1">Contabilizado automáticamente desde Mapa de Almacén • Actualizado: {resumen.lastUpdated}</p>
                        </div>
                        <div className="px-4 py-1.5 bg-brand-100 text-brand-700 rounded-lg text-sm font-semibold">
                            Total cajas disponibles: {resumen.total}
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <div className="space-y-6">
                        {/* Cajas 10kg */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-package text-brand-600"></i>
                                Cajas 10kg - Calibres
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {allCalibres.map((grade) => (
                                    <div key={grade} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                                        <span className="text-sm font-medium text-slate-700">{grade}</span>
                                        <p className="text-lg font-bold text-brand-700 mt-1">{resumen.summary10kg[grade] || 0}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cajas 6kg */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-package text-brand-600"></i>
                                Cajas 6kg - Calibres
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {allCalibres.map((grade) => (
                                    <div key={grade} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                                        <span className="text-sm font-medium text-slate-700">{grade}</span>
                                        <p className="text-lg font-bold text-brand-700 mt-1">{resumen.summary6kg[grade] || 0}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nota de actualización */}
                        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                            Los totales reflejan únicamente las posiciones que tienen datos registrados en el Mapa de Almacén y se actualizan automáticamente al guardar cambios en posiciones.
                        </div>
                    </div>
                </div>
            </div>

            {/* Listado de Tarimas Pendientes de Ubicar - ÚNICAMENTE aquí (no duplicado en mapa ni otros lugares) */}
            {pendingInventoryItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="font-bold text-lg text-slate-900">Listado - Tarimas Pendientes de Ubicar</h2>
                  <p className="text-sm text-slate-500 mt-1">Estas tarimas se asignan directamente desde el Mapa de Frío (clic en espacio vacío)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Folio / Lote</th>
                        <th className="px-4 py-3 text-left">Calibre / Clase</th>
                        <th className="px-4 py-3 text-right">Tarimas</th>
                        <th className="px-4 py-3 text-right">Kg</th>
                        <th className="px-4 py-3 text-left">Empacado</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingInventoryItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium">{item.folio_tarima || 'TAR-' + String(item.id).padStart(6,'0')} • {item.lot_number || '—'}</td>
                          <td className="px-4 py-2">{item.caliber || '—'} / {item.class_name || '—'}</td>
                          <td className="px-4 py-2 text-right font-semibold">{item.pallet_count || 0}</td>
                          <td className="px-4 py-2 text-right">{parseFloat(item.total_kg || 0).toFixed(0)}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{item.packing_date || item.cold_date || '—'}</td>
                          <td className="px-4 py-2"><span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">{item.estado || 'PENDIENTE_UBICACION'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warehouse Map */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-slate-900">Mapa de Almacén</h2>
                        <p className="text-sm text-slate-500 mt-1">Ubicación y estado de tarimas en cámaras frías</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-4 h-4 bg-emerald-100 border border-emerald-400 rounded"></div>
                            <span className="text-slate-600">Ocupado</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-4 h-4 bg-slate-50 border border-slate-300 rounded"></div>
                            <span className="text-slate-600">Vacío</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 overflow-x-auto">
                    <div className="inline-block min-w-full">
                        <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-2">
                            {/* Header row */}
                            <div></div>
                            <div className="text-center font-bold text-slate-700 py-2">Columna A</div>
                            <div className="text-center font-bold text-slate-700 py-2">Columna B</div>
                            <div className="text-center font-bold text-slate-700 py-2">Columna C</div>
                            
                            {/* Generate all rows dynamically */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(row => (
                              <React.Fragment key={`row-${row}`}>
                                <div className="text-center font-bold text-slate-700 py-2">Fila {row}</div>
                                {['A', 'B', 'C'].map(col => {
                                  const slotId = `${col}-${row}`;
                                  const slotData = warehouseSlots[slotId];
                                  const isOccupied = !!slotData;
                                  
                                  return (
                                    <div 
                                      key={slotId}
                                      className={`border-2 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer relative group ${isOccupied ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}
                                      onClick={() => handleSlotClick(slotId)}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.add('border-blue-500', 'bg-blue-100');
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100');
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100');
                                        const itemData = e.dataTransfer.getData('pendingItem');
                                        if (itemData) {
                                          const item = JSON.parse(itemData);
                                          handleAssignPendingToSlot(slotId, item);
                                        }
                                      }}
                                    >
                                      <button 
                                        className="absolute top-1 right-1 bg-white rounded px-2 py-1 text-[10px] text-brand-600 border border-brand-200 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditSlot(slotId);
                                        }}
                                      >
                                        ✏️ Editar
                                      </button>
                                      <div className={`text-xs font-semibold mb-1 ${isOccupied ? 'text-emerald-800' : 'text-slate-400'}`}>
                                        {slotId}
                                      </div>
                                      {isOccupied ? (
                                        <>
                                          <div className="text-[10px] text-slate-600">📅 {slotData.date}</div>
                                          <div className="text-[10px] font-medium text-slate-900">{slotData.boxes} cajas × {slotData.presentation || '10 kg'}</div>
                                          <div className="text-[10px] text-slate-600">Calibre: {slotData.caliber}</div>
                                          <div className="text-[10px] text-brand-600 font-semibold">✓ {slotData.quality}</div>
                                          {slotData.lot_id && lots.find(l => l.id === slotData.lot_id) && (
                                            <div className="text-[9px] text-slate-400 mt-1 font-mono">📦 {lots.find(l => l.id === slotData.lot_id).lot_number}</div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-[10px] text-slate-400">Vacío</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}

                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Inventory Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-bold text-lg text-slate-900">Existencias de Fruta en Almacén</h2>
                        <div className="text-sm text-slate-500">Ve a "Inventario de Materiales" en el menú para materiales</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-4">Material</th>
                                    <th className="px-6 py-4">Clave</th>
                                    <th className="px-6 py-4">Categoría</th>
                                    <th className="px-6 py-4">Stock</th>
                                    <th className="px-6 py-4">Min. Requerido</th>
                                    <th className="px-6 py-4">Costo Unitario</th>
                                    <th className="px-6 py-4">Estatus</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {materials.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                                            No hay materiales registrados. Haz clic en "Agregar Material" para dar de alta.
                                        </td>
                                    </tr>
                                ) : (
                                    materials.map(material => {
                                        const isLow = material.quantity_available < (material.minimum_stock || 50);
                                        return (
                                            <tr key={material.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900">{material.material_name}</td>
                                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{material.clave || '-'}</td>
                                                <td className="px-6 py-4 text-slate-600">{material.category || '-'}</td>
                                                <td className={`px-6 py-4 font-medium ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                                                    {material.quantity_available} {material.unit}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{material.minimum_stock || '-'}</td>
                                                <td className="px-6 py-4 text-slate-500">${parseFloat(material.cost_per_unit || 0).toFixed(2)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${(material.estatus || 'Activo') === 'Inactivo' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {material.estatus || 'Activo'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${isLow ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {isLow ? 'Bajo Stock' : 'Normal'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => handleEditMaterial(material)}
                                                            className="text-blue-600 hover:text-blue-700 font-medium text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                                            title="Editar material"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteMaterial(material.id, material.material_name)}
                                                            className="text-red-600 hover:text-red-700 font-medium text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                            title="Eliminar material"
                                                            disabled={loading}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cold Storage Status Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="font-bold text-lg text-slate-900 mb-6">Estado Frío (Cámaras)</h2>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-slate-700">Cámara 1 - Exportación</span>
                                <span className="text-slate-500">85% ocupado</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full w-[85%] rounded-full"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-slate-700">Cámara 2 - Nacional</span>
                                <span className="text-slate-500">40% ocupado</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full w-[40%] rounded-full"></div>
                            </div>
                        </div>
                        <div className="pt-6 border-t border-slate-100">
                            <p className="text-sm text-slate-500 mb-4">Últimas actividades:</p>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-bold">-</div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Despacho Trailer #42</p>
                                        <p className="text-xs text-slate-400">Hace 2 horas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-bold">+</div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">Entrada Lote #892</p>
                                        <p className="text-xs text-slate-400">Hace 4 horas</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-6 text-sm text-slate-500 text-center">
            Tecavo Fruits Soft &copy; 2023. Todos los derechos reservados.
        </div>
    </footer>
        </div>
        {editingSlot && <EditSlotModal slotId={editingSlot} onClose={() => setEditingSlot(null)} />}
        {showAddMaterialModal && <MaterialModal onClose={() => setShowAddMaterialModal(false)} />}
        {showUnitsModal && <UnitsModal onClose={() => setShowUnitsModal(false)} />}

        {/* Modal de asignación: clic en espacio del mapa → lista de pendientes para ubicar directamente aquí */}
        {assignSlot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeAssignModal}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Asignar a posición {assignSlot}</h3>
                  <p className="text-sm text-slate-500">Selecciona una tarima pendiente de ubicar</p>
                </div>
                <button onClick={closeAssignModal} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              {pendingInventoryItems.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No hay tarimas pendientes de ubicar.</p>
              ) : (
                <div className="space-y-2">
                  {pendingInventoryItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleAssignPendingToSlot(assignSlot, item);
                        closeAssignModal();
                      }}
                      className="w-full text-left p-3 border border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{item.folio_tarima || ('TAR-' + String(item.id).padStart(6,'0'))} • {item.lot_number || 'Sin lote'}</div>
                        <div className="text-sm text-slate-600">{item.caliber || '—'} / {item.class_name || '—'} • {item.pallet_count || 0} tarimas • {parseFloat(item.total_kg||0).toFixed(0)} kg</div>
                      </div>
                      <div className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded">Asignar aquí</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t text-xs text-slate-500">
                La asignación actualiza pallet_output_summary (warehouse_slot + estado) y se refleja en Producción, Embarques y todo el sistema.
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmación WhatsApp - EXACTO al formato solicitado */}
        {showWhatsappModal && (
          <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-4" onClick={() => setShowWhatsappModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-lg font-bold mb-3">📦 Compartir Inventario</div>
              <div className="text-sm mb-4 text-slate-600">
                Generando reporte de inventario... Redirigiendo a WhatsApp de Gerencia
              </div>
              <div className="bg-slate-50 p-3 rounded text-[12px] font-mono whitespace-pre-wrap max-h-[220px] overflow-auto border mb-4">
                {whatsappMessage}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowWhatsappModal(false)} className="flex-1 px-4 py-2 border rounded-xl">Cancelar</button>
                <button onClick={confirmarWhatsapp} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-xl font-medium">Aceptar</button>
              </div>
              <div className="text-[10px] text-center text-slate-400 mt-3">Al presionar Aceptar se abrirá WhatsApp con el mensaje exacto.</div>
            </div>
          </div>
        )}
      </>
    );
  }
