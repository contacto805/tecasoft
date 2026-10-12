'use client';

import { useRouter } from 'next/navigation';

export default function PageHeader({ title, onSave = () => {}, showSave = false }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between mb-6 pb-3 border-b">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--mod-tab-bg, #3E2723)', color: 'var(--mod-tab-text, #ffffff)' }}>
          <button onClick={() => router.back()} className="px-2.5 py-1.5 hover:opacity-80" title="Ir hacia atrás" style={{ color: 'inherit' }}>
            <i className="ph ph-arrow-left text-base"></i>
          </button>
          <button onClick={() => window.history.forward()} className="px-2.5 py-1.5 hover:opacity-80" title="Ir hacia adelante" style={{ color: 'inherit' }}>
            <i className="ph ph-arrow-right text-base"></i>
          </button>
          <button onClick={() => router.push('/')} className="px-3 py-1.5 hover:opacity-80 flex items-center gap-1 border-l" title="Ir a Home" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.35)' }}>
            <i className="ph ph-house text-sm"></i><span className="text-sm font-medium" style={{ color: 'inherit' }}>Home</span>
          </button>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tighter">{title}</h1>
      </div>
      {showSave && onSave && (
        <button
          onClick={onSave}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm rounded-lg font-medium"
        >
          Guardar cambios
        </button>
      )}
    </div>
  );
}
