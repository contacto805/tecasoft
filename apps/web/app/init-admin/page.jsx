'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InitAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Inicializando...');
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        setStatus('Configurando cuenta del administrador...');
        const response = await fetch('/api/auth/setup-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Error desconocido');
          return;
        }

        setStatus('✅ Cuenta configurada correctamente');
        console.log('Admin setup response:', data);

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } catch (err) {
        setError('Error: ' + err.message);
      }
    };

    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <img src="/logo.svg" alt="Tecavo" className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración Inicial</h1>
        </div>

        <p className="text-slate-600 mb-4">{status}</p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 font-mono">
            <strong>Email:</strong> contacto@tecavofruits.com<br />
            <strong>Contraseña:</strong> 2025Tecavo
          </p>
        </div>
      </div>
    </div>
  );
}
