'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EmpleadosPage() {
  const router = useRouter();

  // Unified: Empleados + Nómina + Asistencia en un solo panel. Préstamos accesible por botón.
  useEffect(() => {
    router.replace('/control-personal-nomina?view=empleados');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Redirigiendo al panel unificado...</p>
      </div>
    </div>
  );
}
