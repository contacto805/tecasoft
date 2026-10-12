'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LotProfitPage() {
  const router = useRouter();
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [profit, setProfit] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load lots
  useEffect(() => {
    const fetchLots = async () => {
      try {
        const response = await fetch('/api/lots');
        if (response.ok) {
          const data = await response.json();
          setLots(data.filter(lot => lot.total_kg_sold > 0));
        }
      } catch (error) {
        console.error('Error loading lots:', error);
      }
    };
    fetchLots();
  }, []);

  const handleSelectLot = async (lot) => {
    setSelectedLot(lot);
    setLoading(true);
    try {
      const response = await fetch(`/api/lot-profit?lotId=${lot.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfit(data);
      }
    } catch (error) {
      console.error('Error loading profit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-yellow-50 via-white to-orange-50">
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-yellow-700 font-bold text-lg tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center border border-yellow-500/20">
              <i className="ph-fill ph-coins text-yellow-600"></i>
            </div>
            Utilidad por Lote
          </button>
        </div>
      </header>

      <main className="flex-1 pt-16 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          
          <section className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Análisis de Utilidad por Lote</h1>
            <p className="text-slate-500 mt-1">Visualiza costos, ingresos y utilidad completa de cada lote</p>
          </section>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
              <i className="ph-fill ph-list text-yellow-600"></i>
              Lotes Vendidos
            </h2>

            {lots.length === 0 ? (
              <div className="text-center py-12">
                <i className="ph ph-inbox text-4xl text-slate-300 mb-3 block"></i>
                <p className="text-slate-500">No hay lotes vendidos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lots.map((lot) => (
                  <div
                    key={lot.id}
                    className="p-4 border border-slate-200 rounded-xl hover:border-yellow-300 hover:bg-yellow-50/30 transition-all cursor-pointer"
                    onClick={() => handleSelectLot(lot)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{lot.lot_number}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Productor: {lot.producer} | Huerta: {lot.orchard_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          Kg Vendidos: {lot.total_kg_sold} | Ingresos: ${lot.total_revenue}
                        </p>
                      </div>
                      {selectedLot?.id === lot.id && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Seleccionado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedLot && profit && (
            <div className="mt-8 space-y-6">
              {/* Profit Summary */}
              <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-8 rounded-2xl shadow-lg text-white">
                <h2 className="text-2xl font-bold mb-6">Resumen Financiero - Lote {selectedLot.lot_number}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                    <div className="text-sm opacity-90">Ingresos Totales</div>
                    <div className="text-3xl font-bold mt-2">${profit.total_revenue.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                    <div className="text-sm opacity-90">Costos Totales</div>
                    <div className="text-3xl font-bold mt-2">${profit.total_cost.toFixed(2)}</div>
                  </div>
                  <div className={`rounded-xl p-4 ${profit.gross_profit >= 0 ? 'bg-green-500/30' : 'bg-red-500/30'} backdrop-blur`}>
                    <div className="text-sm opacity-90">Utilidad Bruta</div>
                    <div className="text-3xl font-bold mt-2">${profit.gross_profit.toFixed(2)}</div>
                  </div>
                  <div className={`rounded-xl p-4 ${profit.profit_margin_percentage >= 0 ? 'bg-green-500/30' : 'bg-red-500/30'} backdrop-blur`}>
                    <div className="text-sm opacity-90">Margen de Ganancia</div>
                    <div className="text-3xl font-bold mt-2">{profit.profit_margin_percentage.toFixed(2)}%</div>
                  </div>
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-chart-line text-green-600"></i>
                  Desglose de Ingresos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-semibold text-slate-900">Ventas Principales</h4>
                    <div className="text-2xl font-bold text-green-600 mt-2">
                      ${profit.revenue_breakdown.main_sales.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {profit.total_kg_sold} kg vendidos
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-slate-900">Ventas de Proceso</h4>
                    <div className="text-2xl font-bold text-blue-600 mt-2">
                      ${profit.revenue_breakdown.process_sales.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <h4 className="font-semibold text-slate-900">Ventas de Desecho</h4>
                    <div className="text-2xl font-bold text-purple-600 mt-2">
                      ${profit.revenue_breakdown.waste_sales.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-chart-pie text-red-600"></i>
                  Desglose de Costos
                </h3>
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-900">Costo de Adquisición de Fruta</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        {profit.total_kg_received} kg × Precio unitario
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        ${profit.cost_breakdown.fruit_acquisition.toFixed(2)}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {((profit.cost_breakdown.fruit_acquisition / profit.total_cost) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-900">Comisión del Corredor</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        ${profit.cost_breakdown.commission.toFixed(2)}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {((profit.cost_breakdown.commission / profit.total_cost) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-900">Otros Gastos (Flete, Cuadrilla)</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        ${profit.cost_breakdown.other_expenses.toFixed(2)}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {((profit.cost_breakdown.other_expenses / profit.total_cost) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center font-bold">
                    <div className="text-slate-900">COSTO TOTAL</div>
                    <div className="text-2xl text-red-600">
                      ${profit.total_cost.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                  <i className="ph-fill ph-gauge text-indigo-600"></i>
                  Indicadores de Rentabilidad
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900">Utilidad por Kg</h4>
                    <div className="text-2xl font-bold text-indigo-600 mt-2">
                      ${profit.profit_per_kg.toFixed(2)}/kg
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Total Kg Ingresados: {profit.total_kg_received} kg
                    </p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl">
                    <h4 className="font-semibold text-slate-900">Rendimiento de Venta</h4>
                    <div className="text-2xl font-bold text-indigo-600 mt-2">
                      {((profit.total_kg_sold / profit.total_kg_received) * 100).toFixed(2)}%
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {profit.total_kg_sold} kg vendidos de {profit.total_kg_received} kg recibidos
                    </p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600">
                  <strong>Estado del Lote:</strong> {profit.status}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
