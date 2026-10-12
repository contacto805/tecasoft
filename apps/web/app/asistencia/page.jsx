'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AsistenciaPage() {
  const router = useRouter();

  useEffect(() => {
    // Unified module: Asistencia + Préstamos + Adelantos (single capture, automatic propagation)
    router.push('/control-personal-nomina?view=attendance');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Cargando módulo unificado de Asistencia, Préstamos y Adelantos...</p>
        <p className="text-xs text-slate-400 mt-1">La información fluye a Nómina, Gastos, Balance y Cierres.</p>
      </div>
    </div>
  );
}
