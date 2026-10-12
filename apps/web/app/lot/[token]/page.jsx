'use client';

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function PublicLotDashboard({ params }) {
  const [dashboard, setDashboard] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = (await params).token;
        const tokenValue = token;
        const [dashRes, cfgRes, pubRes] = await Promise.all([
          fetch(`/api/lot-dashboard?token=${tokenValue}`),
          fetch(`/api/public-dashboard-config`),
          fetch(`/api/public-lots?token=${tokenValue}`)
        ]);

        const cfg = await cfgRes.json().catch(() => null);
        let data = null;
        if (dashRes.ok) {
          data = await dashRes.json();
        }
        if (!data && pubRes.ok) {
          const pl = await pubRes.json();
          // adapt to shape expected
          if (pl && pl.lot) {
            data = { 
              ...pl.lot, 
              public_token: pl.token,
              lot_number: pl.lot.lot_number,
              producer: pl.lot.producer,
              fruit_type: pl.lot.fruit_type,
              total_kg_received: pl.lot.total_kg || pl.lot.total_kg_received,
              date: pl.lot.date,
              status: pl.lot.status || 'active'
            };
          }
        }

        if (!data) throw new Error("No se pudo cargar el dashboard");

        setDashboard(data);
        setConfig(cfg || null);
      } catch (err) {
        setError(err.message || "Error al cargar el dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [params]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-700">Cargando información del lote...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-700">{error || "No se encontró el lote"}</p>
        </div>
      </div>
    );
  }

  const lotInfo = {
    lot_number: dashboard.lot_number || dashboard.lot_number || "N/A",
    fruit_type: dashboard.fruit_type || "N/A",
    producer: dashboard.producer || "N/A",
    origin: dashboard.origin || dashboard.municipality || "N/A",
    date: dashboard.date ? format(new Date(dashboard.date), "dd/MM/yyyy", { locale: es }) : "N/A",
    total_kg_received: dashboard.total_kg_received || dashboard.total_kg || null,
    total_kg_packed: dashboard.total_kg_packed || null,
    status: dashboard.status || "Activo",
  };

  // Priorizar imagen de plantilla editable cargada desde admin config
  const templateImage = 
    config?.header_image_url || 
    config?.template_image_url || 
    dashboard.dashboard_image_url || 
    dashboard.template_image_url || null;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/lot/${dashboard.public_token}` : "";

  const bgImage = templateImage || null;
  const displayCompany = config?.company_name || "Tecavo Fruits";

  return (
    <div className="min-h-screen bg-[#0a111f] p-4 md:p-6">
      <div className="max-w-[960px] mx-auto">
        {/* Top branding */}
        <div className="flex justify-between items-center mb-4 text-white/80 text-sm">
          <div className="font-semibold tracking-widest">{displayCompany}</div>
          <div className="uppercase text-xs tracking-[3px]">Dashboard Público • Solo Lectura</div>
        </div>

        {/* Main visual container: editable plantilla as large background */}
        <div className="relative bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200">
          {bgImage ? (
            <div className="relative w-full">
              <div className="aspect-[16/10] relative overflow-hidden bg-slate-200">
                <img
                  src={bgImage}
                  alt="Plantilla editable del Dashboard"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Professional overlay layer on top of the editable template */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60"></div>
                
                <div className="absolute inset-0 p-9 md:p-14 flex flex-col justify-between text-white">
                  {/* Large header on image */}
                  <div>
                    <div className="inline-block bg-white/95 text-slate-950 px-6 py-2 rounded-2xl font-black text-4xl md:text-[52px] tracking-tighter mb-3 shadow-sm">
                      LOTE {lotInfo.lot_number}
                    </div>
                    <p className="font-medium text-2xl md:text-3xl tracking-tight drop-shadow">{lotInfo.fruit_type}</p>
                  </div>

                  <div className="space-y-1 text-sm md:text-[15px]">
                    <div className="flex items-baseline gap-4"><span className="opacity-70 w-24">Productor</span><span className="font-semibold text-lg md:text-2xl">{lotInfo.producer}</span></div>
                    <div className="flex items-baseline gap-4"><span className="opacity-70 w-24">Origen</span><span className="font-semibold">{lotInfo.origin}</span></div>
                    <div className="flex items-baseline gap-4"><span className="opacity-70 w-24">Fecha</span><span className="font-semibold">{lotInfo.date}</span></div>
                    {lotInfo.total_kg_received && <div className="flex items-baseline gap-4"><span className="opacity-70 w-24">Kg recibidos</span><span className="font-semibold">{parseFloat(lotInfo.total_kg_received).toLocaleString('es-MX')} kg</span></div>}
                  </div>

                  {/* QR floating on the image - prominent but integrated */}
                  <div className="flex justify-end">
                    <div className="bg-white p-4 rounded-2xl shadow-xl">
                      <QRCodeCanvas value={publicUrl} size={138} level="H" includeMargin={false} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback clean visual if no template yet */
            <div className="p-10 md:p-14 bg-gradient-to-br from-slate-900 to-black text-white">
              <div className="uppercase tracking-[4px] text-sm mb-2 opacity-60">LOTE REGISTRADO</div>
              <div className="text-[70px] leading-none font-black tracking-[-2.4px] mb-4">{lotInfo.lot_number}</div>
              <div className="text-3xl font-semibold mb-10">{lotInfo.fruit_type}</div>

              <div className="grid grid-cols-2 gap-x-9 gap-y-4 text-lg">
                <div><span className="opacity-60 block text-xs tracking-widest">PRODUCTOR</span> {lotInfo.producer}</div>
                <div><span className="opacity-60 block text-xs tracking-widest">ORIGEN</span> {lotInfo.origin}</div>
                <div><span className="opacity-60 block text-xs tracking-widest">FECHA</span> {lotInfo.date}</div>
                {lotInfo.total_kg_received && <div><span className="opacity-60 block text-xs tracking-widest">KILOS RECIBIDOS</span> {parseFloat(lotInfo.total_kg_received).toLocaleString('es-MX')} kg</div>}
              </div>
              <div className="mt-10 flex justify-end">
                <div className="bg-white p-4 rounded-2xl"><QRCodeCanvas value={publicUrl} size={140} level="H" /></div>
              </div>
            </div>
          )}

          {/* Clean extra info saliendo de plantilla */}
          <div className="p-9 md:p-12 bg-white border-t text-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
              <div>
                <div className="uppercase text-xs tracking-[3px] text-slate-500 mb-1">ESTATUS</div>
                <div className="text-3xl font-semibold text-emerald-700">{lotInfo.status}</div>
              </div>
              <div>
                <div className="uppercase text-xs tracking-[3px] text-slate-500 mb-1">FRUTA</div>
                <div className="text-2xl font-medium">{lotInfo.fruit_type}</div>
              </div>
              <div>
                <div className="uppercase text-xs tracking-[3px] text-slate-500 mb-1">IDENTIFICADOR PÚBLICO</div>
                <div className="font-mono text-lg break-all">{dashboard.public_token?.slice(0, 10)}…</div>
              </div>
            </div>
            <div className="text-xs text-slate-400 border-t pt-5 mt-9 tracking-wide">Escanea el código QR en la imagen principal para ver este dashboard. Este acceso es exclusivo para el lote asociado. No se permite acceso a otros datos ni navegación interna.</div>
          </div>
        </div>

        <div className="text-center text-white/50 mt-6 text-xs tracking-widest">TECAVO • DASHBOARD PÚBLICO POR QR • SOLO CONSULTA</div>
      </div>
    </div>
  );
}
