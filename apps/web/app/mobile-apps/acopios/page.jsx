'use client';
import { useRouter } from 'next/navigation';

export default function AcopiosMobileDownload() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center border border-emerald-500/20">
              <i className="ph ph-tree text-lg"></i>
            </div>
            <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
          </div>
          <button onClick={() => router.push('/mobile-apps')} className="p-2 text-slate-400 hover:text-slate-600">
            <i className="ph ph-x text-xl"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-xl p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 bg-emerald-100 rounded-2xl flex items-center justify-center border-2 border-emerald-300">
                <i className="ph ph-tree text-5xl text-emerald-600"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Acopios de Campo</h1>
                <p className="text-slate-600">App móvil de campo para prospección de huertas, registro de calibres y visitas con GPS.</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-emerald-900 mb-2">✅ App Móvil Lista</h3>
              <p className="text-sm text-emerald-800">Enlaza automáticamente con el módulo de Acopios. Soporta modo offline y sincronización.</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Funciones principales:</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><i className="ph ph-check-circle text-emerald-600 mt-0.5"></i> <span>Registro de visitas a huertas con GPS y evaluación de calibres</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-emerald-600 mt-0.5"></i> <span>Fotos de evidencia + negociaciones en sitio</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-emerald-600 mt-0.5"></i> <span>Control de rutas/jornadas y combustible</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-emerald-600 mt-0.5"></i> <span>Sincronización con el sistema central de Acopios</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-emerald-600 mt-0.5"></i> <span>Login con PIN, trabaja offline luego sincroniza</span></li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t">
              <div className="bg-emerald-50 p-4 rounded-xl mb-6 text-xs text-emerald-700">
                📍 Carpeta: <code className="font-mono bg-white px-2">/home/user/apps/acopios-mobile</code>
              </div>

              <button onClick={() => router.push('/acopios')} className="w-full px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-3">
                <i className="ph ph-arrow-left"></i> Ir al módulo web de Acopios
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border text-sm text-slate-600">
            <b>Para usar:</b> Instala la app Expo Go en tu teléfono. Ejecuta Expo en acopios-mobile y escanea QR. Se conectará automáticamente al sistema.
          </div>
        </div>
      </main>
    </div>
  );
}
