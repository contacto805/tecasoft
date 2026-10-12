'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingDown, CheckCircle2 } from 'lucide-react';

export default function MaterialAlertsPanel() {
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/material-alerts/triggered');
        if (res.ok) {
          const alerts = await res.json();
          setTriggeredAlerts(alerts);
        } else {
          await res.json().catch(() => ({}));
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return null;
  }

  if (triggeredAlerts.length === 0) {
    return null; // Don't show if no alerts
  }

  const getAlertColor = (percentage) => {
    if (percentage <= 10) return 'bg-red-100 border-red-300';
    if (percentage <= 25) return 'bg-orange-100 border-orange-300';
    return 'bg-yellow-100 border-yellow-300';
  };

  const getAlertIcon = (percentage) => {
    if (percentage <= 10) return '#dc2626';
    if (percentage <= 25) return '#ea580c';
    return '#eab308';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition-colors"
      >
        <AlertCircle size={20} />
        <span className="font-semibold">{triggeredAlerts.length} Alertas</span>
      </button>

      {!collapsed && (
        <div className="absolute bottom-full right-0 mb-2 w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="sticky top-0 bg-red-50 border-b border-red-200 px-4 py-3">
            <h3 className="font-bold text-red-900 flex items-center gap-2">
              <AlertCircle size={18} />
              Alertas de Materiales Bajos
            </h3>
            <p className="text-xs text-red-700 mt-1">
              {triggeredAlerts.length} material(es) requieren reorden
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {triggeredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 border-l-4 ${getAlertColor(alert.percentage_of_threshold)}`}
                style={{
                  borderLeftColor: getAlertIcon(alert.percentage_of_threshold),
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {alert.material_name}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {alert.category}
                    </p>
                  </div>
                  <TrendingDown
                    size={16}
                    style={{ color: getAlertIcon(alert.percentage_of_threshold) }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">Stock Actual</p>
                    <p className="font-bold text-gray-900">
                      {parseFloat(alert.quantity_available || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Umbral de Alerta</p>
                    <p className="font-bold text-gray-900">
                      {parseFloat(alert.alert_threshold || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {alert.alert_message && (
                  <div className="mt-2 p-2 bg-white bg-opacity-70 rounded border-l-2 border-gray-400">
                    <p className="text-xs text-gray-700 italic">
                      {alert.alert_message}
                    </p>
                  </div>
                )}

                <div className="mt-2">
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (parseFloat(alert.quantity_available || 0) / parseFloat(alert.alert_threshold || 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {parseFloat(alert.percentage_of_threshold || 0).toFixed(1)}% del umbral
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex gap-2">
            <a
              href="/materials"
              className="flex-1 text-center text-sm font-semibold text-blue-600 hover:text-blue-700 py-2 rounded hover:bg-blue-50 transition-colors"
            >
              Ir a Inventarios
            </a>
            <button
              onClick={() => setCollapsed(true)}
              className="text-sm px-3 py-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
