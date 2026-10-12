'use client';
import { useRouter } from 'next/navigation';

export default function SuperAdminMobileDownload() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center border border-blue-500/20">
              <i className="ph ph-shield-check text-lg"></i>
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
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-xl p-8 mb-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center border-2 border-blue-300">
                <i className="ph ph-shield-check text-5xl text-blue-600"></i>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">App Super Administrador</h1>
                <p className="text-slate-600">Móvil para supervisión remota, notificaciones push, cambios pendientes y aprobaciones del sistema.</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-emerald-900 mb-2">✅ Configurada para notificaciones</h3>
              <p className="text-sm text-emerald-800">Recibe alertas en tiempo real, revisa autorizaciones pendientes y gestiona desde cualquier ubicación.</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-lg">Características principales:</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><i className="ph ph-check-circle text-blue-600 mt-0.5"></i> <span>Dashboard de control rápido</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-blue-600 mt-0.5"></i> <span>Notificaciones push sobre autorizaciones y cambios pendientes</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-blue-600 mt-0.5"></i> <span>Revisión y aprobación de cambios en cualquier módulo</span></li>
                <li className="flex gap-3"><i className="ph ph-check-circle text-blue-600 mt-0.5"></i> <span>Perfil y herramientas del super administrador</span></li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t">
              <button onClick={() => router.push('/super-admin')} className="w-full px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-3">
                <i className="ph ph-arrow-left"></i> Abrir panel Super Admin
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border text-sm text-slate-600">
            Ubicación: <code className="font-mono bg-slate-100 px-2">/home/user/apps/super-admin-mobile</code>. App con login y tabs para uso del super admin desde campo.
          </div>
        </div>
      </main>
    </div>
  );
}
