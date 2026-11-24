import ClosingLots from '@/components/closing-lots';

const sample = {
  kg_recibidos: 9720,
  kg_frio: 2520,
  kg_vendidos: 5040,
  lotes: [
    {
      lot_id: 101, lot_number: 'DEM-101', producer: 'Huerta del Encino', received_on: '2026-11-16',
      kg: 4200, cold_kg: 1680, sold_kg: 2100, cost: 75600, source: 'fruit_input_weighings', source_ids: [51],
      production_ids: [31], process_kg: 300, waste_kg: 100, loss_kg: 20,
      cold_details: [{ id: 201, folio: 'T-201', caliber: 'Primera', kg: 1680, status: 'DISPONIBLE' }],
      sales: [{ load_id: 301, fecha: '2026-11-20', nota: 'DEM-V301', kg: 2100, importe: 63000, moneda: 'MXN', tarimas: [{ id: 202, folio: 'T-202' }] }],
    },
    {
      lot_id: 102, lot_number: 'DEM-102', producer: 'Huerta La Cañada', received_on: '2026-11-18',
      kg: 3300, cold_kg: 840, sold_kg: 840, cost: null, source: 'weighings', source_ids: [52, 53],
      production_ids: [32], process_kg: 200, waste_kg: 80, loss_kg: 40,
      cold_details: [{ id: 203, folio: 'T-203', caliber: 'Extra', kg: 840, status: 'DISPONIBLE' }],
      sales: [{ load_id: 302, fecha: '2026-11-23', nota: 'DEM-V302', kg: 840, importe: 1450, moneda: 'USD', tarimas: [{ id: 204, folio: 'T-204' }] }],
    },
    {
      lot_id: 103, lot_number: 'DEM-103', producer: 'Huerta Los Pinos', received_on: '2026-11-19',
      kg: 2220, cold_kg: 0, sold_kg: 2100, cost: 39960, source: 'fruit_input_weighings', source_ids: [54],
      production_ids: [33], process_kg: 80, waste_kg: 20, loss_kg: 20,
      sales: [{ load_id: 303, fecha: '2026-11-21', nota: 'DEM-V303', kg: 2100, importe: 61950, moneda: 'MXN', tarimas: [{ id: 205, folio: 'T-205' }] }],
      waste_sales: [{ id: 401, fecha: '2026-11-22', folio: 'DEM-P401', importe: 400 }],
    },
  ],
  embarques_sin_recepcion: [{ load_id: 304, nota: 'DEM-V304', lot_id: null }],
  ventas_pendientes_mxn: [{ lot_id: 102, load_id: 302 }],
};

export const metadata = { title: 'Vista previa del cierre semanal | SoftTECAVO', robots: { index: false, follow: false } };

export default function WeeklyClosingPreview() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="text-sm font-semibold text-emerald-800">TECAVO FRUITS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Seguimiento del cierre semanal</h1>
          <p className="mt-2 text-sm text-slate-600">Vista previa con datos de ejemplo. Puedes probar los filtros y abrir la trazabilidad de cada lote.</p>
        </div>
        <ClosingLots origin={sample} start="2026-11-16" end="2026-11-22" sample />
      </div>
    </main>
  );
}
