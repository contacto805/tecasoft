'use client';

import { useEffect, useState } from 'react';

export default function ExchangeRateWidget() {
  const [rate, setRate] = useState('17.50');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching exchange rate...');
        
        const response = await fetch('/api/exchange-rate', {
          method: 'GET',
          cache: 'no-store'
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Exchange rate data:', data);
        
        if (data && data.rate) {
          setRate(String(data.rate));
          setLastUpdate(new Date().toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }));
          console.log('✅ Exchange rate updated:', data.rate);
        } else {
          console.warn('⚠️ No rate in response, using fallback');
          setRate('17.50');
        }
      } catch (error) {
        console.warn('⚠️ Error fetching exchange rate:', error instanceof Error ? error.message : String(error));
        console.log('💱 Using fallback rate: 17.50 MXN');
        setRate('17.50');
      } finally {
        setLoading(false);
      }
    };

    fetchRate();

    // Actualizar cada 30 minutos
    const interval = setInterval(fetchRate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !rate) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm">
        <div className="w-3 h-3 rounded-full bg-slate-400 animate-pulse"></div>
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div 
      title={`Tipo de cambio actualizado: ${lastUpdate}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:bg-gradient-to-r hover:from-emerald-100 hover:to-teal-100 transition-colors cursor-help"
    >
      <span className="text-emerald-700 font-semibold text-sm">
        1 USD
      </span>
      <span className="text-emerald-600 text-xs">→</span>
      <span className="text-emerald-700 font-bold text-sm">
        ${rate} MXN
      </span>
      <span className="text-emerald-500 text-xs ml-1">
        🇲🇽
      </span>
    </div>
  );
}
