'use client';

import { useRouter } from 'next/navigation';

export default function ProductionConfigPage() {
  const router = useRouter();

    return (
      <>
        <div className="min-h-screen flex flex-col font-sans">
          {/* Top Navigation */}
    <header className="fixed top-0 left-0 right-0 w-full z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 text-brand-700">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center border border-brand-500/20">
                        <img src="/logo.svg" alt="Tecavo Fruits Soft" className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Tecavo Fruits Soft</span>
                </div>
                
                <nav className="hidden lg:flex items-center gap-1">
                    <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Dashboard Principal
                    </button>
                    <button onClick={() => router.push('/inventory')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Inventario
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-brand-50 text-brand-700 font-medium text-sm transition-colors cursor-default">
                        Configuración Producción
                    </button>
                    <button onClick={() => router.push('/fruit-input')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Ingreso de Fruta
                    </button>
                    <button onClick={() => router.push('/embarques')} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-sm transition-colors">
                        Embarques
                    </button>
                </nav>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            </div>
        </div>
    </header>

    <main className="flex-1 pt-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            
            {/* Page Title */}
            <section className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración de Producción</h1>
                <p className="text-slate-500 mt-1">Configure los materiales necesarios por tarima para descuento automático de inventario</p>
            </section>

            {/* Configuration Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="font-bold text-lg text-slate-900">Configuración de Calibres y Métricas</h2>
                    <p className="text-sm text-slate-500 mt-1">Defina los calibres de cajas y métricas de producción por lote</p>
                </div>
                <div className="p-6">
                    <div className="space-y-8">
                        {/* Cajas 10kg */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-package text-brand-600"></i>
                                Cajas 10kg - Calibres Disponibles
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                {['Super (40\'s)', 'Extra (48\'s)', 'Primera (60\'s)', 'Mediano (70\'s)', 'Tercera (84\'s)', 'Cuarta'].map((grade) => (
                                    <label key={grade} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                                        <input type="checkbox" defaultChecked className="rounded" />
                                        <span className="text-sm font-medium text-slate-700">{grade}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Cajas 6kg */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-package text-brand-600"></i>
                                Cajas 6kg - Calibres Disponibles
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                {['Extra (48\'s)', 'Primera (60\'s)', 'Mediano (70\'s)', 'Tercera (84\'s)'].map((grade) => (
                                    <label key={grade} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                                        <input type="checkbox" defaultChecked className="rounded" />
                                        <span className="text-sm font-medium text-slate-700">{grade}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Métricas de Producción */}
                        <div className="pt-6 border-t border-slate-200">
                            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-chart-line text-brand-600"></i>
                                Métricas de Producción por Lote
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Total Kg Procesados</label>
                                    <input type="number" placeholder="Cantidad en kg" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" />
                                    <p className="text-xs text-slate-500 mt-1">Kilogramos totales procesados en el lote</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Desecho (kg)</label>
                                    <input type="number" placeholder="Cantidad en kg" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" />
                                    <p className="text-xs text-slate-500 mt-1">Kilogramos descartados por calidad</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Merma (kg)</label>
                                    <input type="number" placeholder="Cantidad en kg" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" />
                                    <p className="text-xs text-slate-500 mt-1">Pérdida por manipulación y daño</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
                        <button className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium flex items-center gap-2">
                            <i className="ph ph-check"></i> Guardar Configuración
                        </button>
                        <button className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            {/* Saved Configurations */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="font-bold text-lg text-slate-900">Configuraciones Guardadas</h2>
                    <p className="text-sm text-slate-500 mt-1">Configuraciones activas de calibres y métricas</p>
                </div>
                <div className="divide-y divide-slate-100">
                    {/* Configuration Card 1 - 10kg */}
                    <div className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">Cajas 10kg - Calibres Estándar</h3>
                                <p className="text-sm text-slate-500 font-mono mt-1">🔖 CONFIG-10KG-STD</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 text-brand-600 hover:bg-brand-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-pencil"></i> Editar
                                </button>
                                <button className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Calibres Disponibles:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
                                {['Super (40\'s)', 'Extra (48\'s)', 'Primera (60\'s)', 'Mediano (70\'s)', 'Tercera (84\'s)', 'Cuarta'].map((grade) => (
                                    <div key={grade} className="text-sm text-slate-700 px-2 py-1 bg-white rounded border border-slate-200">✓ {grade}</div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            💡 Esta configuración define todos los calibres disponibles para cajas de 10kg
                        </div>
                    </div>

                    {/* Configuration Card 2 - 6kg */}
                    <div className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">Cajas 6kg - Calibres Estándar</h3>
                                <p className="text-sm text-slate-500 font-mono mt-1">🔖 CONFIG-6KG-STD</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 text-brand-600 hover:bg-brand-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-pencil"></i> Editar
                                </button>
                                <button className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Calibres Disponibles:</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {['Extra (48\'s)', 'Primera (60\'s)', 'Mediano (70\'s)', 'Tercera (84\'s)'].map((grade) => (
                                    <div key={grade} className="text-sm text-slate-700 px-2 py-1 bg-white rounded border border-slate-200">✓ {grade}</div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            💡 Esta configuración define todos los calibres disponibles para cajas de 6kg
                        </div>
                    </div>

                    {/* Configuration Card 3 - Métricas */}
                    <div className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">Métricas de Producción</h3>
                                <p className="text-sm text-slate-500 font-mono mt-1">🔖 CONFIG-METRICS-STD</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 text-brand-600 hover:bg-brand-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-pencil"></i> Editar
                                </button>
                                <button className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1">
                                    <i className="ph ph-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Métricas Configuradas:</p>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-white rounded border border-slate-200">
                                    <span className="text-sm text-slate-700">📊 Proceso (kg)</span>
                                    <span className="font-semibold text-blue-700">Habilitado</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white rounded border border-slate-200">
                                    <span className="text-sm text-slate-700">🗑️ Desecho (kg)</span>
                                    <span className="font-semibold text-orange-700">Habilitado</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white rounded border border-slate-200">
                                    <span className="text-sm text-slate-700">⚠️ Merma (kg)</span>
                                    <span className="font-semibold text-red-700">Habilitado</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            💡 Estas métricas se registran para cada lote en el módulo de Lotificación Registry
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-6 text-sm text-slate-500 text-center">
            AvoSys Control Central &copy; 2023. Todos los derechos reservados.
        </div>
    </footer>
        </div>
      </>
    );
}
