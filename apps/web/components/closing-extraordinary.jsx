'use client';

import { useState } from 'react';
import { normalizeExtraordinaryEntry } from '@/utils/closing-extraordinary';

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const inputStyle = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const buttonStyle = 'rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50';

function ExtraordinaryEntries({ type, title, entries, onChange, readOnly, saving }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const rows = entries.filter(entry => entry.type === type);

  const removeDraft = () => {
    setDraft(null);
    setError('');
  };

  const accept = () => {
    try {
      if (entries.length >= 200) throw new Error('Puedes registrar hasta 200 conceptos extraordinarios por cierre.');
      const entry = normalizeExtraordinaryEntry({ ...draft, type, id: crypto.randomUUID() });
      onChange([...entries, entry]);
      removeDraft();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-900">{title}</h4>
        {!readOnly && (
          <button type="button" disabled={saving || !!draft}
            onClick={() => setDraft({ concept: '', amount: '' })}
            className={`${buttonStyle} border border-emerald-200 text-emerald-800`}>
            Agregar
          </button>
        )}
      </div>
      {!rows.length && <p className="text-sm text-slate-500">Sin conceptos registrados.</p>}
      <ul className="divide-y divide-slate-100">
        {rows.map(entry => (
          <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 break-words">{entry.concept}</span>
            <strong className="whitespace-nowrap tabular-nums">{mxn.format(entry.amount)}</strong>
            {!readOnly && (
              <button type="button" disabled={saving} aria-label={`Quitar ${entry.concept}`}
                className={`${buttonStyle} text-red-700`} onClick={() => onChange(entries.filter(item => item.id !== entry.id))}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      {draft && !readOnly && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
            <label className="text-sm text-slate-700">Concepto
              <input value={draft.concept} maxLength={160} disabled={saving} className={inputStyle}
                onChange={event => setDraft({ ...draft, concept: event.target.value })} />
            </label>
            <label className="text-sm text-slate-700">Importe (MXN)
              <input type="number" min="0.01" max="1000000000" step="0.01" disabled={saving}
                value={draft.amount} className={inputStyle} onChange={event => setDraft({ ...draft, amount: event.target.value })} />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={removeDraft} className={`${buttonStyle} text-red-700`}>Quitar borrador</button>
            <button type="button" disabled={saving} onClick={accept} className={`${buttonStyle} bg-emerald-800 text-white`}>Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClosingExtraordinary(props) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">Conceptos extraordinarios</h3>
      {!props.readOnly && <p className="text-sm text-slate-600">Aceptar aplica el importe al resultado. Guarda el cierre para conservar los cambios.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <ExtraordinaryEntries {...props} type="ingreso" title="Ingresos extraordinarios" />
        <ExtraordinaryEntries {...props} type="egreso" title="Egresos extraordinarios" />
      </div>
    </section>
  );
}
