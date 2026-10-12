'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PrestamosPage() {
  const router = useRouter();

  // Unified module: Asistencia now includes Préstamos y Adelantos.
  // Single capture point. Data flows automatically to Nómina, Gastos, Balance al Día and Cierres.
  useEffect(() => {
    router.replace('/control-personal-nomina?view=deductions');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Redirigiendo al módulo unificado de Asistencia • Préstamos y Adelantos...</p>
        <p className="text-xs text-slate-400 mt-2">Toda la información fluye automáticamente a Nómina, Gastos, Balance y Cierres Semanales.</p>
      </div>
    </div>
  );
}
