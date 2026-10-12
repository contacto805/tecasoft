'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranding } from '@/hooks/useBranding';

export default function ClientePortalLogin() {
  const router = useRouter();
  const { branding } = useBranding();
  const primary = branding?.primary_color || '#0E4A22';
  const secondary = branding?.secondary_color || '#963821';

  const [clientNumber, setClientNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!clientNumber.trim() || pin.length !== 6) {
      setError('Ingresa tu número de cliente y el PIN de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/client-portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientNumber: clientNumber.trim().toUpperCase(), pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/portal-cliente/dashboard');
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border" style={{ borderColor: primary + '30' }}>
        <div className="text-center mb-8">
          <div className="mx-auto mb-3" style={{ color: primary }}>
            <span className="text-4xl font-bold tracking-tighter">TECAVO</span>
            <span className="text-xl font-medium"> FRUITS</span>
          </div>
          <div className="text-sm tracking-[3px] text-slate-500">PORTAL DE CLIENTES</div>
          <div className="text-xs text-slate-400 mt-1">Consulta privada de tu información</div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-600">NÚMERO DE CLIENTE</label>
            <input
              type="text"
              value={clientNumber}
              onChange={(e) => setClientNumber(e.target.value.toUpperCase())}
              placeholder="CLI-0001"
              className="w-full border rounded-xl px-4 py-3 text-lg font-mono tracking-widest focus:outline-none"
              style={{ borderColor: primary + '40' }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-600">PIN DE ACCESO (6 DÍGITOS)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full border rounded-xl px-4 py-3 text-2xl font-mono tracking-[8px] text-center focus:outline-none"
                style={{ borderColor: primary + '40' }}
                maxLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-3.5 text-xs text-slate-500 hover:text-slate-700"
              >
                {showPin ? 'OCULTAR' : 'MOSTRAR'}
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: primary }}
          >
            {loading ? 'INGRESANDO...' : 'INGRESAR AL PORTAL'}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] text-slate-400">
          Este acceso es exclusivo para clientes de Tecavo Fruits.<br />Tu información se actualiza automáticamente.
        </div>
      </div>
    </div>
  );
}
