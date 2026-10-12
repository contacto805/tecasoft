'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Componente de navegación contextual de trazabilidad
 * Muestra botones de navegación basados en las relaciones del registro actual
 * 
 * Uso:
 * <TraceabilityNav 
 *   type="lot" 
 *   id={lotId}
 *   data={{ producer, broker, lot_number, etc }}
 * />
 */
export default function TraceabilityNav({ type, id, data = {} }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Define las relaciones de navegación por tipo de entidad
  const navigationMap = {
    // Lote de fruta
    lot: {
      title: 'Navegación del Lote',
      icon: 'ph-package',
      color: 'blue',
      links: [
        { label: 'Orden de Corte', route: '/cutting-orders', icon: 'ph-clipboard-text', condition: data.cutting_order_id },
        { label: 'Pesajes', route: '/fruit-input', icon: 'ph-scales', condition: true },
        { label: 'Rendimiento', route: '/lot-performance', icon: 'ph-chart-bar', condition: true },
        { label: 'Lotificación', route: '/lot-registration', icon: 'ph-tag', condition: true },
        { label: 'Inventario', route: '/inventory', icon: 'ph-thermometer-cold', condition: true },
        { label: 'Embarques', route: '/embarques', icon: 'ph-truck', condition: true },
        { label: 'Costos', route: `/admin/lot-cost-summary?lotId=${id}`, icon: 'ph-currency-dollar', condition: true },
        { label: 'Trazabilidad', route: `/batch-tracking?lotId=${id}`, icon: 'ph-graph', condition: true },
        { label: 'Histórico de Precios', route: `/historico-precios`, icon: 'ph-coin', condition: true }
      ]
    },
    
    // Orden de corte
    cuttingOrder: {
      title: 'Navegación de Orden',
      icon: 'ph-clipboard-text',
      color: 'green',
      links: [
        { label: 'Lote Asociado', route: `/lots/${data.lot_id}`, icon: 'ph-package', condition: data.lot_id },
        { label: 'Productor', route: `/producers?search=${data.producer_name}`, icon: 'ph-user', condition: data.producer_name },
        { label: 'Broker', route: `/brokers?search=${data.broker_name}`, icon: 'ph-handshake', condition: data.broker_name },
        { label: 'Control de Cajas', route: '/box-control', icon: 'ph-cube', condition: true },
        { label: 'Cuadrilla', route: '/crew-management', icon: 'ph-users-three', condition: true },
        { label: 'Histórico de Precios', route: `/historico-precios`, icon: 'ph-coin', condition: true }
      ]
    },
    
    // Carga / Viaje
    load: {
      title: 'Navegación de Carga',
      icon: 'ph-truck',
      color: 'orange',
      links: [
        { label: 'Cliente', route: `/customers?id=${data.customer_id}`, icon: 'ph-user-circle', condition: data.customer_id },
        { label: 'Inventario', route: '/inventory', icon: 'ph-thermometer-cold', condition: true },
        { label: 'Mapa del Trailer', route: `/embarques/${id}/trailer-map`, icon: 'ph-map-pin', condition: true },
        { label: 'Detalles de Lotes', route: `/embarques/${id}/lot-details`, icon: 'ph-list-bullets', condition: true },
        { label: 'Facturación', route: '/invoices', icon: 'ph-file-text', condition: true },
        { label: 'Fletes', route: '/foreign-freights', icon: 'ph-currency-dollar', condition: true }
      ]
    },
    
    // Gasto
    expense: {
      title: 'Navegación de Gasto',
      icon: 'ph-receipt',
      color: 'red',
      links: [
        { label: 'Todos los Gastos', route: '/expenses', icon: 'ph-list', condition: true },
        { label: 'Proveedor', route: `/expense-providers?id=${data.provider_id}`, icon: 'ph-storefront', condition: data.provider_id },
        { label: 'Cierre Semanal', route: '/weekly-closings', icon: 'ph-calendar-check', condition: true },
        { label: 'Reportes', route: '/admin/reports', icon: 'ph-file-pdf', condition: true },
        { label: 'Auditoría', route: '/admin/audit-log', icon: 'ph-shield-check', condition: true }
      ]
    },
    
    // Empleado / Nómina
    employee: {
      title: 'Navegación de Empleado',
      icon: 'ph-user',
      color: 'purple',
      links: [
        { label: 'Nómina', route: '/nomina', icon: 'ph-currency-dollar', condition: true },
        { label: 'Préstamos', route: '/prestamos', icon: 'ph-hand-coins', condition: true },
        { label: 'Asistencias', route: '/attendance', icon: 'ph-calendar-check', condition: true },
        { label: 'Permisos', route: '/admin/users', icon: 'ph-shield', condition: true }
      ]
    },
    
    // Productor
    producer: {
      title: 'Navegación de Productor',
      icon: 'ph-plant',
      color: 'emerald',
      links: [
        { label: 'Lotes', route: `/lots?producer=${data.producer}`, icon: 'ph-package', condition: true },
        { label: 'Órdenes de Corte', route: `/cutting-orders?producer=${data.producer}`, icon: 'ph-clipboard-text', condition: true },
        { label: 'Pagos Programados', route: '/payment-schedule', icon: 'ph-calendar-dots', condition: true },
        { label: 'Histórico de Precios', route: `/historico-precios`, icon: 'ph-coin', condition: true },
        { label: 'Análisis', route: `/admin/producer-analysis?producer=${data.producer}`, icon: 'ph-chart-line', condition: true }
      ]
    },
    
    // Cliente
    customer: {
      title: 'Navegación de Cliente',
      icon: 'ph-user-circle',
      color: 'cyan',
      links: [
        { label: 'Embarques', route: `/embarques?customer=${data.customer_name}`, icon: 'ph-truck', condition: true },
        { label: 'Facturas', route: `/invoices?customer=${data.customer_name}`, icon: 'ph-file-text', condition: true },
        { label: 'Cuenta Corriente', route: `/customer-accounts/${id}`, icon: 'ph-currency-dollar', condition: true },
        { label: 'Etiquetas', route: `/label-templates?customer=${id}`, icon: 'ph-tag', condition: true }
      ]
    },
    
    // Precio Semanal
    weeklyPrice: {
      title: 'Navegación de Precio',
      icon: 'ph-coin',
      color: 'amber',
      links: [
        { label: 'Lotes Relacionados', route: `/historico-precios/${id}/lotes`, icon: 'ph-package', condition: true },
        { label: 'Comparativos', route: `/historico-precios?compare=${id}`, icon: 'ph-chart-line-up', condition: true },
        { label: 'Auditoría', route: `/historico-precios/${id}/audit`, icon: 'ph-shield-check', condition: true },
        { label: 'Reportes', route: `/historico-precios/${id}/report`, icon: 'ph-file-pdf', condition: true }
      ]
    }
  };

  const config = navigationMap[type];
  if (!config) return null;

  const visibleLinks = config.links.filter(link => link.condition !== false);
  if (visibleLinks.length === 0) return null;

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:bg-blue-100' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', hover: 'hover:bg-green-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', hover: 'hover:bg-orange-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', hover: 'hover:bg-red-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', hover: 'hover:bg-cyan-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', hover: 'hover:bg-amber-100' }
  };

  const colors = colorClasses[config.color] || colorClasses.blue;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 mb-6`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className={`ph-fill ${config.icon} text-xl ${colors.text}`}></i>
          <h3 className={`font-semibold ${colors.text}`}>{config.title}</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${colors.text} ${colors.hover}`}
        >
          {expanded ? 'Ocultar' : 'Ver todo'}
          <i className={`ph ${expanded ? 'ph-caret-up' : 'ph-caret-down'} ml-1`}></i>
        </button>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 ${expanded ? '' : 'max-h-20 overflow-hidden'}`}>
        {visibleLinks.map((link, idx) => (
          <button
            key={idx}
            onClick={() => router.push(link.route)}
            className={`flex items-center gap-2 px-3 py-2 bg-white border ${colors.border} rounded-lg ${colors.text} ${colors.hover} transition-all text-sm font-medium text-left`}
          >
            <i className={`ph ${link.icon}`}></i>
            <span className="truncate">{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
