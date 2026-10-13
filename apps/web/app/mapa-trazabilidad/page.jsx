'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mapa de Trazabilidad del Sistema
 * Visualización interactiva de cómo se relacionan todos los módulos
 */
export default function TraceabilityMapPage() {
  const router = useRouter();
  const [activeModule, setActiveModule] = useState(null);

  const modules = [
    {
      id: 'weekly-prices',
      name: 'Histórico de Precios',
      icon: 'ph-coin',
      color: 'amber',
      description: 'Precios semanales autorizados de compra',
      connects: ['cutting-orders', 'lots', 'producer-payments']
    },
    {
      id: 'cutting-orders',
      name: 'Órdenes de Corte',
      icon: 'ph-clipboard-text',
      color: 'green',
      description: 'Solicitudes de corte en huerta',
      connects: ['lots', 'box-control', 'crew', 'brokers']
    },
    {
      id: 'lots',
      name: 'Lotes de Fruta',
      icon: 'ph-package',
      color: 'blue',
      description: 'Registro central de cada lote',
      connects: ['weighings', 'lotification', 'performance', 'inventory', 'costs', 'weekly-prices']
    },
    {
      id: 'weighings',
      name: 'Pesajes',
      icon: 'ph-scales',
      color: 'purple',
      description: 'Ingreso y peso de fruta',
      connects: ['lots']
    },
    {
      id: 'box-control',
      name: 'Control de Cajas',
      icon: 'ph-cube',
      color: 'red',
      description: 'Cajas de campo salidas/retornadas',
      connects: ['cutting-orders']
    },
    {
      id: 'crew',
      name: 'Cuadrilla',
      icon: 'ph-users-three',
      color: 'cyan',
      description: 'Pagos y cierres de cuadrilla',
      connects: ['cutting-orders', 'weekly-closings']
    },
    {
      id: 'lotification',
      name: 'Lotificación',
      icon: 'ph-tag',
      color: 'indigo',
      description: 'Empaque y clasificación',
      connects: ['lots', 'production', 'inventory']
    },
    {
      id: 'performance',
      name: 'Rendimiento',
      icon: 'ph-chart-bar',
      color: 'emerald',
      description: 'Análisis de rendimiento por lote',
      connects: ['lots', 'lotification']
    },
    {
      id: 'inventory',
      name: 'Inventario',
      icon: 'ph-thermometer-cold',
      color: 'sky',
      description: 'Fruta en cámara y materiales',
      connects: ['lots', 'lotification', 'loads', 'materials']
    },
    {
      id: 'production',
      name: 'Producción',
      icon: 'ph-factory',
      color: 'orange',
      description: 'Proceso de empaque',
      connects: ['lotification', 'materials']
    },
    {
      id: 'materials',
      name: 'Materiales',
      icon: 'ph-stack',
      color: 'slate',
      description: 'Cajas, etiquetas, esquineros',
      connects: ['inventory', 'production', 'costs']
    },
    {
      id: 'loads',
      name: 'Cargas',
      icon: 'ph-truck',
      color: 'orange',
      description: 'Despacho de producto',
      connects: ['inventory', 'customers', 'invoices', 'freights']
    },
    {
      id: 'customers',
      name: 'Clientes',
      icon: 'ph-user-circle',
      color: 'teal',
      description: 'Clientes y destinos',
      connects: ['loads', 'invoices', 'customer-accounts']
    },
    {
      id: 'invoices',
      name: 'Facturación',
      icon: 'ph-file-text',
      color: 'violet',
      description: 'Facturas de venta',
      connects: ['loads', 'customers']
    },
    {
      id: 'freights',
      name: 'Fletes',
      icon: 'ph-currency-dollar',
      color: 'pink',
      description: 'Pago de fletes',
      connects: ['loads', 'expenses']
    },
    {
      id: 'costs',
      name: 'Costos',
      icon: 'ph-calculator',
      color: 'rose',
      description: 'Costeo por lote',
      connects: ['lots', 'materials', 'expenses', 'payroll']
    },
    {
      id: 'expenses',
      name: 'Gastos',
      icon: 'ph-receipt',
      color: 'red',
      description: 'Registro de gastos operativos',
      connects: ['costs', 'weekly-closings', 'providers']
    },
    {
      id: 'payroll',
      name: 'Nómina',
      icon: 'ph-currency-dollar',
      color: 'fuchsia',
      description: 'Pago a empleados',
      connects: ['employees', 'costs', 'weekly-closings']
    },
    {
      id: 'employees',
      name: 'Empleados',
      icon: 'ph-user',
      color: 'purple',
      description: 'Personal y permisos',
      connects: ['payroll', 'loans', 'attendance']
    },
    {
      id: 'producer-payments',
      name: 'Pagos a Productores',
      icon: 'ph-calendar-dots',
      color: 'lime',
      description: 'Calendario de pagos',
      connects: ['lots', 'weekly-prices']
    },
    {
      id: 'weekly-closings',
      name: 'Cierres Semanales',
      icon: 'ph-calendar-check',
      color: 'amber',
      description: 'Cierre contable semanal',
      connects: ['expenses', 'payroll', 'crew', 'loads']
    },
    {
      id: 'brokers',
      name: 'Brokers',
      icon: 'ph-handshake',
      color: 'yellow',
      description: 'Comisionistas y notas',
      connects: ['cutting-orders', 'lots']
    }
  ];

  const colorClasses = {
    amber: 'bg-amber-100 border-amber-300 text-amber-900',
    green: 'bg-green-100 border-green-300 text-green-900',
    blue: 'bg-blue-100 border-blue-300 text-blue-900',
    purple: 'bg-purple-100 border-purple-300 text-purple-900',
    red: 'bg-red-100 border-red-300 text-red-900',
    cyan: 'bg-cyan-100 border-cyan-300 text-cyan-900',
    indigo: 'bg-indigo-100 border-indigo-300 text-indigo-900',
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-900',
    sky: 'bg-sky-100 border-sky-300 text-sky-900',
    orange: 'bg-orange-100 border-orange-300 text-orange-900',
    slate: 'bg-slate-100 border-slate-300 text-slate-900',
    teal: 'bg-teal-100 border-teal-300 text-teal-900',
    violet: 'bg-violet-100 border-violet-300 text-violet-900',
    pink: 'bg-pink-100 border-pink-300 text-pink-900',
    rose: 'bg-rose-100 border-rose-300 text-rose-900',
    fuchsia: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900',
    lime: 'bg-lime-100 border-lime-300 text-lime-900',
    yellow: 'bg-yellow-100 border-yellow-300 text-yellow-900'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 text-slate-600 hover:text-slate-900 flex items-center gap-2 font-medium"
          >
            <i className="ph ph-arrow-left"></i>
            Volver al Dashboard
          </button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <i className="ph-fill ph-graph text-3xl text-white"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Mapa de Trazabilidad</h1>
              <p className="text-slate-600 mt-1">
                Visualización interactiva de cómo se relacionan todos los módulos del sistema
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <i className="ph-fill ph-info text-2xl text-blue-600 mt-1"></i>
            <div>
              <p className="text-sm text-slate-700 font-medium mb-1">
                Haz clic en cualquier módulo para ver sus conexiones
              </p>
              <p className="text-xs text-slate-600">
                Las líneas muestran cómo fluyen los datos entre los diferentes módulos del sistema
              </p>
            </div>
          </div>
        </div>

        {/* Modules Grid - con botones Ir y Editar para trazabilidad completa */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
          {modules.map((module) => {
            const isActive = activeModule === module.id;
            const isConnected = activeModule && modules.find(m => m.id === activeModule)?.connects.includes(module.id);
            
            const routeMap = {
              'weekly-prices': '/precios-fruta',
              'cutting-orders': '/cutting-orders',
              'lots': '/fruit-input',
              'weighings': '/fruit-input',
              'box-control': '/box-control',
              'crew': '/cuadrillas',
              'lotification': '/production?tab=rendimiento', // XI/XII: canónica Producción (legacy /lotification-registry solo lectura)
              'performance': '/production',
              'inventory': '/inventory',
              'production': '/production',
              'materials': '/production',
              'loads': '/embarques',
              'customers': '/customers',
              'invoices': '/invoices',
              'freights': '/control-fletes',
              'costs': '/costos-operativos',
              'expenses': '/expenses',
              'payroll': '/control-personal-nomina',
              'employees': '/empleados',
              'producer-payments': '/programacion-pagos',
              'weekly-closings': '/cierres',
              'brokers': '/brokers',
            };
            const route = routeMap[module.id] || '/fruit-input';

            return (
              <div
                key={module.id}
                onClick={() => setActiveModule(activeModule === module.id ? null : module.id)}
                className={`
                  p-4 rounded-xl border-2 transition-all text-left cursor-pointer
                  ${isActive ? 'ring-4 ring-blue-300 scale-105 shadow-xl' : ''}
                  ${isConnected ? 'ring-2 ring-green-300 shadow-lg' : ''}
                  ${!isActive && !isConnected ? 'hover:scale-105 hover:shadow-lg' : ''}
                  ${colorClasses[module.color]}
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <i className={`ph-fill ${module.icon} text-2xl`}></i>
                  {isActive && <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full font-bold">ACTIVO</span>}
                  {!isActive && isConnected && <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full font-bold">CONECTADO</span>}
                </div>
                <h3 className="font-bold text-sm mb-1">{module.name}</h3>
                <p className="text-xs opacity-75 leading-tight">{module.description}</p>
                {module.connects.length > 0 && (
                  <p className="text-xs mt-2 font-semibold opacity-60">{module.connects.length} conexión{module.connects.length !== 1 ? 'es' : ''} • Kilos / Comisiones / Pagos entrelazados</p>
                )}
                <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => router.push(route)} 
                    className="text-[10px] px-2 py-0.5 bg-white/60 rounded hover:bg-white font-medium"
                  >
                    Ir
                  </button>
                  <button 
                    onClick={() => router.push(route)} 
                    className="text-[10px] px-2 py-0.5 bg-white/90 rounded hover:bg-white font-medium border border-current/30"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connections Info */}
        {activeModule && (
          <div className="bg-white rounded-2xl border-2 border-blue-300 shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <i className={`ph-fill ${modules.find(m => m.id === activeModule).icon} text-2xl text-blue-600`}></i>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {modules.find(m => m.id === activeModule).name}
                </h2>
                <p className="text-sm text-slate-600">
                  {modules.find(m => m.id === activeModule).description}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-700">Conectado con:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {modules.find(m => m.id === activeModule).connects.map((connId) => {
                  const connModule = modules.find(m => m.id === connId);
                  if (!connModule) return null;
                  
                  return (
                    <div
                      key={connId}
                      className={`p-3 rounded-lg border flex items-center gap-2 ${colorClasses[connModule.color]}`}
                    >
                      <i className={`ph-fill ${connModule.icon} text-lg`}></i>
                      <span className="text-sm font-medium">{connModule.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Flujo Principal del Sistema */}
        <div className="mt-12 bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-lg p-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <i className="ph-fill ph-flow-arrow text-blue-600"></i>
                Flujo Principal del Sistema
              </h2>
              <p className="text-xs text-slate-600 mt-1">Usa los botones Editar para corregir interacciones, asignaciones de folios, kilos, comisiones y relaciones entre módulos.</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* 1. COMPRA + COMISIONES */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">1</span>
                COMPRA FRUTA + COMISIONES + PROGRAMACIÓN DE PAGOS
                <button onClick={()=>router.push('/programacion-pagos')} className="ml-auto text-[10px] px-2 py-0.5 bg-blue-200 hover:bg-blue-300 rounded font-medium">Editar esta sección</button>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg font-medium flex items-center gap-1.5">
                  Histórico Precios
                  <button onClick={()=>router.push('/precios-fruta')} className="text-xs px-1.5 py-0 bg-amber-200 rounded hover:bg-amber-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-green-100 border border-green-300 rounded-lg font-medium flex items-center gap-1.5">
                  Órdenes de Corte (folio)
                  <button onClick={()=>router.push('/cutting-orders')} className="text-xs px-1.5 py-0 bg-green-200 rounded hover:bg-green-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-purple-100 border border-purple-300 rounded-lg font-medium flex items-center gap-1.5">
                  Ingreso Fruta (pesaje + asignar lote)
                  <button onClick={()=>router.push('/fruit-input')} className="text-xs px-1.5 py-0 bg-purple-200 rounded hover:bg-purple-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg font-medium flex items-center gap-1.5">
                  Lote + Kilos Reales
                  <button onClick={()=>router.push('/fruit-input')} className="text-xs px-1.5 py-0 bg-blue-200 rounded hover:bg-blue-300">Editar</button>
                </span>
              </div>
              <div className="mt-2 ml-6 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-emerald-700">↓ kilos/comisión →</span>
                <span className="px-3 py-1.5 bg-orange-100 border border-orange-300 rounded font-medium flex items-center gap-1.5">
                  Cuadrillas (pago + fletes)
                  <button onClick={()=>router.push('/cuadrillas')} className="text-xs px-1 py-0 bg-orange-200 rounded hover:bg-orange-300">Editar</button>
                </span>
                <span className="px-3 py-2 bg-emerald-100 border border-emerald-300 rounded-lg font-medium flex items-center gap-2">
                  Corredores (comisión)
                  <button onClick={() => router.push('/brokers')} className="text-xs px-1 py-0 bg-emerald-200 rounded hover:bg-emerald-300">Editar</button>
                </span>
                <span className="px-3 py-1.5 bg-lime-100 border border-lime-300 rounded font-medium flex items-center gap-1.5">
                  Programación Pagos (días corte)
                  <button onClick={()=>router.push('/programacion-pagos')} className="text-xs px-1 py-0 bg-lime-200 rounded hover:bg-lime-300">Editar</button>
                </span>
              </div>
            </div>

            {/* 2. PRODUCCIÓN */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">2</span>
                PRODUCCIÓN + LOTIFICACIÓN + TARIMAS
                <button onClick={()=>router.push('/production')} className="ml-auto text-[10px] px-2 py-0.5 bg-green-200 hover:bg-green-300 rounded font-medium">Editar esta sección</button>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg font-medium flex items-center gap-1.5">
                  Lote (desde ingreso)
                  <button onClick={()=>router.push('/fruit-input')} className="text-xs px-1.5 py-0 bg-blue-200 rounded hover:bg-blue-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-indigo-100 border border-indigo-300 rounded-lg font-medium flex items-center gap-1.5">
                  Producción / Lotificación
                  <button onClick={()=>router.push('/production?tab=historial')} className="text-xs px-1.5 py-0 bg-indigo-200 rounded hover:bg-indigo-300">Ver en Producción (canónica)</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-sky-100 border border-sky-300 rounded-lg font-medium flex items-center gap-1.5">
                  Tarimas / Pallets
                  <button onClick={()=>router.push('/inventory')} className="text-xs px-1.5 py-0 bg-sky-200 rounded hover:bg-sky-300">Editar</button>
                </span>
              </div>
            </div>

            {/* 3. VENTA */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">3</span>
                VENTA + CARGA + CLIENTES
                <button onClick={()=>router.push('/embarques')} className="ml-auto text-[10px] px-2 py-0.5 bg-orange-200 hover:bg-orange-300 rounded font-medium">Editar esta sección</button>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-2 bg-sky-100 border border-sky-300 rounded-lg font-medium flex items-center gap-1.5">
                  Inventario
                  <button onClick={()=>router.push('/inventory')} className="text-xs px-1.5 py-0 bg-sky-200 rounded hover:bg-sky-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-orange-100 border border-orange-300 rounded-lg font-medium flex items-center gap-1.5">
                  Carga / Despacho
                  <button onClick={()=>router.push('/embarques')} className="text-xs px-1.5 py-0 bg-orange-200 rounded hover:bg-orange-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-teal-100 border border-teal-300 rounded-lg font-medium flex items-center gap-1.5">
                  Cliente / Factura
                  <button onClick={()=>router.push('/invoices')} className="text-xs px-1.5 py-0 bg-teal-200 rounded hover:bg-teal-300">Editar</button>
                </span>
              </div>
            </div>

            {/* 4. COSTOS + CIERRES */}
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">4</span>
                COSTOS + PAGO CUADRILLAS + CIERRE SEMANAL
                <button onClick={()=>router.push('/expenses')} className="ml-auto text-[10px] px-2 py-0.5 bg-red-200 hover:bg-red-300 rounded font-medium">Editar esta sección</button>
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="px-3 py-2 bg-red-100 border border-red-300 rounded-lg font-medium flex items-center gap-1.5">
                  Gastos
                  <button onClick={()=>router.push('/expenses')} className="text-xs px-1.5 py-0 bg-red-200 rounded hover:bg-red-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-fuchsia-100 border border-fuchsia-300 rounded-lg font-medium flex items-center gap-1.5">
                  Cuadrillas (kilos ingreso + fletes)
                  <button onClick={()=>router.push('/cuadrillas')} className="text-xs px-1.5 py-0 bg-fuchsia-200 rounded hover:bg-fuchsia-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-rose-100 border border-rose-300 rounded-lg font-medium flex items-center gap-1.5">
                  Costos por Lote
                  <button onClick={()=>router.push('/costos-operativos')} className="text-xs px-1.5 py-0 bg-rose-200 rounded hover:bg-rose-300">Editar</button>
                </span>
                <i className="ph-bold ph-arrow-right text-slate-400"></i>
                <span className="px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg font-medium flex items-center gap-1.5">
                  Cierre Semanal
                  <button onClick={()=>router.push('/cierres')} className="text-xs px-1.5 py-0 bg-amber-200 rounded hover:bg-amber-300">Editar</button>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-500">Cada botón permite corregir la interacción del módulo con el flujo completo de fruta, kilos, comisiones y pagos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
