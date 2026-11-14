'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NominaPage() {
  const router = useRouter();

  // Fusión: Nómina + Asistencia en un solo panel unificado (todo converge aquí)
  // Sueldo desde módulo Empleados, Bonos y Descuentos (asistencia + préstamos/adelantos) en el módulo.
  useEffect(() => {
    router.replace('/control-personal-nomina?view=payroll');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Redirigiendo al panel unificado de Asistencia y Nómina...</p>
        <p className="text-xs text-slate-400 mt-1">Sueldo desde empleados • Bonos y descuentos integrados</p>
      </div>
    </div>
  );
}
