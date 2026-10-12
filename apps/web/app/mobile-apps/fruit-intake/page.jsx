'use client';

import { useRouter } from 'next/navigation';

export default function FruitIntakeAppDownload() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
              <img src="/logo.svg" alt="Tecavo Fruits Soft" className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
          </div>
          <button onClick={() => router.push('/mobile-apps')} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <i className="ph ph-x text-xl"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          
          {/* App Info Card */}
          <div className="bg-white rounded-2xl border-2 border-brand-200 shadow-xl p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 bg-brand-100 rounded-2xl flex items-center justify-center border-2 border-brand-300">
                <i className="ph ph-plant text-5xl text-brand-600"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Ingreso de Fruta</h1>
                <p className="text-slate-600">Aplicación móvil para registro de ingreso de fruta en campo</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-emerald-900 mb-2">✅ App Móvil Completada</h3>
              <p className="text-sm text-emerald-800">La aplicación está lista para usarse. Enlace automático con el sistema de Ingreso de Fruta.</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Características planificadas:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="ph ph-check-circle text-green-600 text-xl mt-0.5"></i>
                  <span className="text-slate-700">Registro rápido de ingreso de fruta desde campo</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ph ph-check-circle text-green-600 text-xl mt-0.5"></i>
                  <span className="text-slate-700">Captura de peso con fotografía integrada</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ph ph-check-circle text-green-600 text-xl mt-0.5"></i>
                  <span className="text-slate-700">Sincronización automática con el sistema central</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ph ph-check-circle text-green-600 text-xl mt-0.5"></i>
                  <span className="text-slate-700">Escaneo de códigos de barras y QR</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ph ph-check-circle text-green-600 text-xl mt-0.5"></i>
                  <span className="text-slate-700">Compatible con iOS y Android</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                onClick={() => router.push('/mobile-apps')}
                className="w-full px-6 py-3 bg-slate-600 text-white font-medium rounded-xl hover:bg-slate-700 shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <i className="ph ph-arrow-left text-lg"></i>
                Volver a Apps Móviles
              </button>
            </div>
          </div>

          {/* Development Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <i className="ph ph-info text-2xl text-blue-600"></i>
              <div>
                <h3 className="font-bold text-blue-900 mb-2">Siguiente Paso: Generar APK</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Para distribuir esta aplicación móvil de uso interno:
                </p>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Abre Expo Go o ejecuta <code>cd /home/user/apps && npx expo start</code> desde fruit-intake-mobile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Escanea QR de Expo o descarga APK (npx expo export:android / build)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Registra ingresos con peso, lote y foto cuando uses la app desde campo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Los datos se sincronizan automáticamente al módulo web Ingreso de Fruta</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
