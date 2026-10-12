'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

export function PalletMaterialsModal({
  isOpen,
  onClose,
  batchId,
  lotId,
  onSuccess
}) {
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deductedMaterials, setDeductedMaterials] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/pallet-configurations');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch (err) {
      setError('Error al cargar configuraciones de tarimas');
      console.error(err);
    }
  };

  const handleApply = async () => {
    if (!selectedConfig || !quantity) {
      setError('Selecciona una configuración y cantidad');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/pallet-configurations/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_config_id: selectedConfig.id,
          quantity: parseInt(quantity),
          production_batch_id: batchId,
          lot_id: lotId
        })
      });

      const data = await res.json();

      if (res.ok) {
        setDeductedMaterials(data.deductedMaterials);
        setSuccess(data.message);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 2000);
      } else if (data.insufficientMaterials) {
        // Show insufficient materials warning
        const materials = data.insufficientMaterials
          .map(m => `${m.name}: necesitas ${m.needed} ${m.unit}, tienes ${m.available}`)
          .join('\n');
        setError(`Inventario insuficiente:\n\n${materials}`);
      } else {
        setError(data.error || 'Error al aplicar configuración');
      }
    } catch (err) {
      setError('Error al aplicar configuración');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentConfig = configs.find(c => c.id === selectedConfig?.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Aplicar Configuración de Tarima</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Alerts */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap text-sm">{error}</div>
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Configuration Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecciona una Configuración de Tarima
            </label>
            <select
              value={selectedConfig?.id || ''}
              onChange={(e) => {
                const config = configs.find(c => c.id === parseInt(e.target.value));
                setSelectedConfig(config);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Selecciona una configuración --</option>
              {configs.map(config => (
                <option key={config.id} value={config.id}>
                  {config.pallet_name} ({config.material_count || 0} materiales)
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Tarimas
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Current Configuration Details */}
          {currentConfig && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">
                Detalles de Configuración
              </h3>
              
              <div className="space-y-2 text-sm mb-4 text-blue-800">
                {currentConfig.boxes_capacity && (
                  <p>
                    <span className="font-medium">Capacidad:</span> {currentConfig.boxes_capacity} cajas
                  </p>
                )}
                {currentConfig.total_weight_kg && (
                  <p>
                    <span className="font-medium">Peso por Tarima:</span> {currentConfig.total_weight_kg} kg
                  </p>
                )}
                {currentConfig.description && (
                  <p>
                    <span className="font-medium">Descripción:</span> {currentConfig.description}
                  </p>
                )}
              </div>

              {/* Materials Required */}
              <div>
                <p className="font-medium text-blue-900 mb-2">Materiales Requeridos por Tarima:</p>
                <div className="space-y-1">
                  {currentConfig.materials?.map(material => (
                    <div key={material.id} className="flex justify-between text-sm bg-white rounded p-2">
                      <span>{material.material_name}</span>
                      <span className="font-medium">
                        {material.quantity_required} {material.unit}
                      </span>
                    </div>
                  ))}
                  {(!currentConfig.materials || currentConfig.materials.length === 0) && (
                    <p className="text-gray-600 text-sm">No hay materiales configurados</p>
                  )}
                </div>

                {/* Total Materials Needed */}
                {currentConfig.materials && currentConfig.materials.length > 0 && quantity > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="font-medium text-blue-900 mb-2">Total de Materiales Necesarios:</p>
                    <div className="space-y-1">
                      {currentConfig.materials.map(material => (
                        <div key={material.id} className="flex justify-between text-sm">
                          <span>{material.material_name}</span>
                          <span className="font-medium text-blue-600">
                            {(material.quantity_required * quantity).toFixed(2)} {material.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deducted Materials Result */}
          {deductedMaterials && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3">Materiales Deducidos</h3>
              <div className="space-y-2">
                {deductedMaterials.map((material, index) => (
                  <div key={index} className="flex justify-between text-sm text-green-800 bg-white rounded p-2">
                    <span>{material.material_name}</span>
                    <span className="font-medium">
                      -{material.quantity_deducted} {material.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={loading || !selectedConfig}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Aplicando...' : 'Aplicar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}
