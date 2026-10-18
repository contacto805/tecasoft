'use client';

import React, { useState } from 'react';

export default function PortalTransportistas() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!name.trim() || pin.length !== 6) { setError('Nombre y PIN 6 dígitos'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/transporter-portal/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transporterName: name.trim(), pin })
      });
      const d = await r.json();
      if (d.success) {
        // fetch viajes/fletes reales
        const v = await fetch('/api/logistica_viajes');
        const viajes = v.ok ? await v.json() : [];
        setData({ nombre: name, viajes: Array.isArray(viajes) ? viajes.slice(0, 6) : [] });
      } else setError(d.error || 'Credenciales inválidas');
    } catch { setError('Error'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-emerald-700 text-xs tracking-[3px]">TECAVO FRUITS</div>
          <div className="text-2xl font-semibold">Portal de Transportistas</div>
        </div>
        {!data ? (
          <div className="bg-white rounded-3xl border p-6">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del transportista" className="w-full border px-4 py-3 rounded-2xl mb-2" />
            <input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="PIN 6 dígitos" className="w-full border px-4 py-3 rounded-2xl font-mono tracking-[6px] text-center" />
            <button onClick={login} disabled={loading} className="mt-3 w-full py-3 bg-emerald-800 text-white rounded-2xl">INGRESAR</button>
            {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border p-5">
            <div className="font-semibold mb-2">{data.nombre}</div>
            <div className="text-xs mb-2">Viajes y fletes recientes</div>
            {data.viajes.length === 0 && <div className="text-xs text-slate-500">Sin viajes registrados.</div>}
            {data.viajes.map((v,i) => <div key={i} className="text-sm border-b py-1">{v.folio_viaje || v.folio} • {v.fecha_salida || ''}</div>)}
            <button onClick={() => { setData(null); setName(''); setPin(''); }} className="mt-3 text-xs border px-3 py-1 rounded">Salir</button>
          </div>
        )}
      </div>
    </div>
  );
}
