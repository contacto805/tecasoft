'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NuevoPrestamoPage() {
  const router = useRouter();

  // Unified: register new loans/advances inside the Asistencia module (single source of truth)
  useEffect(() => {
    router.replace('/control-personal-nomina?view=deductions');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Registro de Préstamos y Adelantos ahora está en el módulo unificado de Asistencia.</p>
      </div>
    </div>
  );
}
