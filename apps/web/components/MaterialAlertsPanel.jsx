'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function MaterialAlertsPanel() {
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/material-alerts/triggered');
        if (res.ok) {
          const alerts = await res.json();
          setTriggeredAlerts(Array.isArray(alerts) ? alerts : []);
        }
      } catch (_) {}
      finally { setLoading(false); }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 35000);
    return () => clearInterval(interval);
  }, []);

  if (loading || triggeredAlerts.length === 0) return null;

  return (
    <>
      {/* Small non-intrusive trigger — does not cover bottom nav */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-16 right-3 z-[90] flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-full shadow border border-amber-700"
        title="Ver alertas de materiales"
      >
        <AlertCircle size={14} />
        <span>{triggeredAlerts.length} materiales</span>
      </button>

      {/* Modal emergente centrado — no tapa la barra de navegación inferior */}
      {showModal && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-amber-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle size={18} /> Alertas de Materiales
              </div>
              <button onClick={() => setShowModal(false)} className="p-1"><X size={18} /></button>
            </div>

            <div className="max-h-[60vh] overflow-auto p-1">
              {triggeredAlerts.map((alert, idx) => (
                <div key={alert.id || idx} className="p-3 border-b last:border-b-0">
                  <div className="font-semibold text-sm">{alert.material_name}</div>
                  <div className="text-[11px] text-slate-500">{alert.category}</div>
                  <div className="mt-1 text-xs grid grid-cols-2 gap-x-3">
                    <div>Stock: <span className="font-bold">{parseFloat(alert.quantity_available || 0).toFixed(1)}</span></div>
                    <div>Umbral: <span className="font-bold">{parseFloat(alert.alert_threshold || 0).toFixed(1)}</span></div>
                  </div>
                  {alert.alert_message && <div className="mt-1 text-[11px] text-amber-700">{alert.alert_message}</div>}
                  <div className="mt-1 h-1 bg-amber-100 rounded">
                    <div className="h-1 bg-amber-600 rounded" style={{width: `${Math.min(parseFloat(alert.percentage_of_threshold || 30), 100)}%`}} />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t bg-slate-50 flex gap-2">
              <a href="/materials" className="flex-1 text-center text-sm py-2 rounded bg-white border">Ir a Inventario de Materiales</a>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
