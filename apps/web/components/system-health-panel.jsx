'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Panel de Estado del Sistema
 * Muestra el estado de conexión y salud de todos los módulos críticos
 */
export default function SystemHealthPanel() {
  const router = useRouter();
  const [health, setHealth] = useState({
    database: 'checking',
    weeklyPrices: 'checking',
    inventory: 'checking',
    lots: 'checking',
    loads: 'checking'
  });

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    // Check database
    try {
      const dbCheck = await fetch('/api/lots?limit=1');
      setHealth(prev => ({ ...prev, database: dbCheck.ok ? 'healthy' : 'error' }));
    } catch {
      setHealth(prev => ({ ...prev, database: 'error' }));
    }

    // Check weekly prices
    try {
      const pricesCheck = await fetch('/api/weekly-price-history?limit=1');
      setHealth(prev => ({ ...prev, weeklyPrices: pricesCheck.ok ? 'healthy' : 'warning' }));
    } catch {
      setHealth(prev => ({ ...prev, weeklyPrices: 'warning' }));
    }

    // Check inventory
    try {
      const invCheck = await fetch('/api/inventory?limit=1');
      setHealth(prev => ({ ...prev, inventory: invCheck.ok ? 'healthy' : 'warning' }));
    } catch {
      setHealth(prev => ({ ...prev, inventory: 'warning' }));
    }

    // Check lots
    try {
      const lotsCheck = await fetch('/api/lots?limit=1');
      setHealth(prev => ({ ...prev, lots: lotsCheck.ok ? 'healthy' : 'warning' }));
    } catch {
      setHealth(prev => ({ ...prev, lots: 'warning' }));
    }

    // Check loads
    try {
      const loadsCheck = await fetch('/api/loads?limit=1');
      setHealth(prev => ({ ...prev, loads: loadsCheck.ok ? 'healthy' : 'warning' }));
    } catch {
      setHealth(prev => ({ ...prev, loads: 'warning' }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <i className="ph-fill ph-check-circle text-green-500"></i>;
      case 'warning':
        return <i className="ph-fill ph-warning text-yellow-500"></i>;
      case 'error':
        return <i className="ph-fill ph-x-circle text-red-500"></i>;
      default:
        return <i className="ph ph-circle-notch animate-spin text-slate-400"></i>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy':
        return 'Operativo';
      case 'warning':
        return 'Advertencia';
      case 'error':
        return 'Error';
      default:
        return 'Verificando...';
    }
  };

  const modules = [
    { key: 'database', label: 'Base de Datos', route: null },
    { key: 'weeklyPrices', label: 'Precios Semanales', route: '/historico-precios' },
    { key: 'inventory', label: 'Inventario', route: '/inventory' },
    { key: 'lots', label: 'Lotes', route: '/lots' },
    { key: 'loads', label: 'Embarques', route: '/embarques' }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ph-fill ph-heartbeat text-xl text-blue-600"></i>
          <h3 className="font-semibold text-slate-900">Estado del Sistema</h3>
        </div>
        <button
          onClick={checkSystemHealth}
          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
        >
          <i className="ph ph-arrows-clockwise mr-1"></i>
          Actualizar
        </button>
      </div>

      <div className="space-y-3">
        {modules.map((module) => (
          <div
            key={module.key}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              health[module.key] === 'healthy' ? 'bg-green-50 border-green-200' :
              health[module.key] === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              health[module.key] === 'error' ? 'bg-red-50 border-red-200' :
              'bg-slate-50 border-slate-200'
            } ${module.route ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            onClick={() => module.route && router.push(module.route)}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(health[module.key])}
              <span className="text-sm font-medium text-slate-700">{module.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${
                health[module.key] === 'healthy' ? 'text-green-700' :
                health[module.key] === 'warning' ? 'text-yellow-700' :
                health[module.key] === 'error' ? 'text-red-700' :
                'text-slate-500'
              }`}>
                {getStatusText(health[module.key])}
              </span>
              {module.route && <i className="ph ph-arrow-right text-slate-400"></i>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={() => router.push('/mapa-trazabilidad')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <i className="ph ph-graph"></i>
          Ver Mapa de Trazabilidad
        </button>
        <button
          onClick={() => router.push('/admin/audit-log')}
          className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1"
        >
          <i className="ph ph-shield-check"></i>
          Auditoría
        </button>
      </div>
    </div>
  );
}
