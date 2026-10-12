'use client';

import { useRouter } from 'next/navigation';

/**
 * Panel de navegación rápida flotante
 * Se muestra en la parte inferior derecha de la pantalla
 */
export default function QuickNavPanel() {
  const router = useRouter();

  const quickLinks = [
    { label: 'Nuevo Lote', route: '/lots/new', icon: 'ph-plus-circle', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Nueva Orden', route: '/cutting-orders/new', icon: 'ph-clipboard-text', color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Nuevo Embarque', route: '/embarques', icon: 'ph-truck', color: 'bg-orange-600 hover:bg-orange-700' },
    { label: 'Nuevo Gasto', route: '/expenses/new', icon: 'ph-receipt', color: 'bg-red-600 hover:bg-red-700' },
    { label: 'Búsqueda Global', route: '/admin/global-search', icon: 'ph-magnifying-glass', color: 'bg-purple-600 hover:bg-purple-700' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {quickLinks.map((link, idx) => (
        <button
          key={idx}
          onClick={() => router.push(link.route)}
          className={`${link.color} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 font-medium transition-all hover:scale-105 hover:shadow-xl`}
        >
          <i className={`ph ${link.icon} text-xl`}></i>
          <span className="hidden lg:inline">{link.label}</span>
        </button>
      ))}
    </div>
  );
}
