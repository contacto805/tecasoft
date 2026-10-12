'use client';
import { useRouter } from 'next/navigation';

export default function GastosMobileDownload() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-700">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center border border-teal-500/20">
              <i className="ph ph-receipt text-lg"></i>
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
          <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-xl p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 bg-teal-100 rounded-2xl flex items-center justify-center border-2 border-teal-300">
                <i className="ph ph-receipt text-5xl text-teal-600"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Módulo de Gastos</h1>
                <p className="text-slate-600">App móvil para registro de gastos operativos. Carga instantánea sincronizada.</p>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="font-bold text-slate-900 text-lg">Características principales:</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><i className="ph ph-check-circle text-teal-600 mt-0.5"></i> <span>Captura de gastos rápida desde celular con foto de comprobante</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-teal-600 mt-0.5"></i> <span>Sincronización automática en tiempo real al módulo web de gastos</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-teal-600 mt-0.5"></i> <span>Carga de departamentos y conceptos desde configuración</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-teal-600 mt-0.5"></i> <span>Visualización inmediata de todos los gastos registrados</span></li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t">
              <div className="bg-emerald-50 p-4 rounded-xl mb-6 text-xs text-emerald-700">
                📍 Ubicación de la aplicación móvil: <code className="font-mono bg-white px-2">/home/user/apps/gastos-mobile</code>
              </div>

              <button onClick={() => router.push('/expenses')} className="w-full px-6 py-3 bg-teal-600 text-white font-medium rounded-xl flex items-center justify-center gap-3">
                <i className="ph ph-arrow-left"></i> Ver módulo completo de Gastos
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border text-sm text-slate-600">
            <b>Para usar:</b> Abre Expo Go en tu teléfono, o construye la app Expo con <code>expo start</code> desde carpeta gastos-mobile y escanea el QR.
            La app se conecta automáticamente al sistema web.
          </div>
        </div>
      </main>
    </div>
  );
}
