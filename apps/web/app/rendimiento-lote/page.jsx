"use client";

import { useState, useEffect } from "react";
import { Download, RefreshCw, FileText, Image as ImageIcon, TrendingUp, Package, Scale } from "lucide-react";
import { useBranding } from '@/hooks/useBranding';
import jsPDF from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";

export default function LotPerformancePage() {
  const brandingRes = useBranding();
const b = brandingRes && brandingRes.branding ? brandingRes.branding : brandingRes || {};
const logo = b.logo || b.logo_url || '/logo.svg';
const primaryColor = b.primary_color || b.primaryColor || '#059669';
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchLots();
  }, []);

  const fetchLots = async () => {
    try {
      const response = await fetch("/api/lots");
      const data = await response.json();
      setLots(data || []);
    } catch (error) {
      console.error("Error fetching lots:", error);
    }
  };

  const calculatePerformance = async (lotId) => {
    setCalculating(true);
    try {
      const response = await fetch(`/api/lot-performance?lotId=${lotId}&autoCalculate=true`);
      const data = await response.json();
      setPerformance(data);
      setSelectedLot(lotId);
    } catch (error) {
      console.error("Error calculating performance:", error);
    } finally {
      setCalculating(false);
    }
  };

  const downloadPDF = () => {
    if (!performance) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(primaryColor || "#059669");
    doc.text("Rendimiento de Lote", pageWidth / 2, 20, { align: "center" });

    // Información general
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Lote: ${performance.lot_number || "N/A"}`, 20, 35);
    doc.text(`Productor: ${performance.producer || "N/A"}`, 20, 42);
    doc.text(`Corredor: ${performance.broker_name || "N/A"}`, 20, 49);
    doc.text(`Tipo de fruta: ${performance.fruit_type || "N/A"}`, 20, 56);
    doc.text(`Fecha de entrada: ${performance.entry_date ? new Date(performance.entry_date).toLocaleDateString() : "N/A"}`, 20, 63);

    // Datos de entrada
    doc.setFontSize(14);
    doc.setTextColor(primaryColor || "#059669");
    doc.text("Datos de Entrada", 20, 75);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Báscula pública: ${parseFloat(performance.public_scale_weight_kg || 0).toLocaleString()} kg`, 20, 85);
    doc.text(`Total cajas producidas: ${parseFloat(performance.total_boxes_produced || 0).toLocaleString()}`, 20, 92);
    doc.text(`Total kilos producidos: ${parseFloat(performance.total_kg_produced || 0).toLocaleString()} kg`, 20, 99);

    // Rendimiento general
    doc.setFontSize(14);
    doc.setTextColor(primaryColor || "#059669");
    doc.text("Rendimiento General", 20, 111);

    const generalData = [
      ["Rendimiento Total", `${parseFloat(performance.performance_percentage || 0).toFixed(2)}%`],
      ["Proceso", `${parseFloat(performance.process_percentage || 0).toFixed(2)}%`, `${parseFloat(performance.total_kg_process || 0).toLocaleString()} kg`],
      ["Desecho", `${parseFloat(performance.waste_percentage || 0).toFixed(2)}%`, `${parseFloat(performance.total_kg_waste || 0).toLocaleString()} kg`],
      ["Merma", `${parseFloat(performance.shrinkage_percentage || 0).toFixed(2)}%`, `${parseFloat(performance.total_kg_shrinkage || 0).toLocaleString()} kg`]
    ];

    doc.autoTable({
      startY: 115,
      head: [["Concepto", "Porcentaje", "Kilos"]],
      body: generalData,
      theme: "striped",
      headStyles: { fillColor: primaryColor || "#059669" }
    });

    // Rendimiento por calibre
    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(primaryColor || "#059669");
    doc.text("Rendimiento por Calibre", 20, finalY);

    const caliberData = [];
    const calibers = performance.percentage_by_caliber || {};
    const calibersKg = performance.kg_by_caliber || {};

    Object.keys(calibers).forEach(caliber => {
      caliberData.push([
        caliber,
        `${parseFloat(calibers[caliber] || 0).toFixed(2)}%`,
        `${parseFloat(calibersKg[caliber] || 0).toLocaleString()} kg`
      ]);
    });

    doc.autoTable({
      startY: finalY + 4,
      head: [["Calibre", "Porcentaje", "Kilos"]],
      body: caliberData,
      theme: "striped",
      headStyles: { fillColor: primaryColor || "#059669" }
    });

    // Nueva página para calidad
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(primaryColor || "#059669");
    doc.text("Rendimiento por Calidad", 20, 20);

    const qualityData = [];
    const qualities = performance.percentage_by_quality || {};
    const qualitiesKg = performance.kg_by_quality || {};

    Object.keys(qualities).forEach(quality => {
      qualityData.push([
        quality,
        `${parseFloat(qualities[quality] || 0).toFixed(2)}%`,
        `${parseFloat(qualitiesKg[quality] || 0).toLocaleString()} kg`
      ]);
    });

    doc.autoTable({
      startY: 24,
      head: [["Calidad", "Porcentaje", "Kilos"]],
      body: qualityData,
      theme: "striped",
      headStyles: { fillColor: primaryColor || "#059669" }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generado el ${new Date().toLocaleString()} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`Rendimiento_${performance.lot_number || "Lote"}.pdf`);
  };

  const downloadJPG = async () => {
    if (!performance) return;

    const element = document.getElementById("performance-content");
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff"
      });

      const link = document.createElement("a");
      link.download = `Rendimiento_${performance.lot_number || "Lote"}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (error) {
      console.error("Error generating JPG:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logo && <img src={logo} alt="Logo" className="h-12 w-auto" />}
              <div>
                <h1 className="text-3xl font-bold" style={{ color: primaryColor || "#059669" }}>
                  Rendimiento de Lote
                </h1>
                <p className="text-gray-600">Análisis automático de rendimientos por calibre y calidad</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de lote */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccionar Lote
          </label>
          <div className="flex gap-3">
            <select
              value={selectedLot || ""}
              onChange={(e) => {
                const lotId = e.target.value;
                if (lotId) {
                  calculatePerformance(lotId);
                }
              }}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-offset-2"
              style={{ focusRingColor: primaryColor || "#059669" }}
            >
              <option value="">Seleccione un lote...</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot_number} - {lot.producer} ({lot.fruit_type})
                </option>
              ))}
            </select>
            {selectedLot && (
              <button
                onClick={() => calculatePerformance(selectedLot)}
                disabled={calculating}
                className="px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: primaryColor || "#059669" }}
              >
                <RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin" : ""}`} />
                Recalcular
              </button>
            )}
          </div>
        </div>

        {/* Contenido de rendimiento */}
        {performance && (
          <>
            <div id="performance-content" className="bg-white rounded-lg shadow-sm p-6 mb-6">
              {/* Información general */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold mb-4" style={{ color: primaryColor || "#059669" }}>
                  {performance.lot_number}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Productor</p>
                    <p className="font-semibold">{performance.producer}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Corredor</p>
                    <p className="font-semibold">{performance.broker_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipo de fruta</p>
                    <p className="font-semibold">{performance.fruit_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de entrada</p>
                    <p className="font-semibold">
                      {performance.entry_date ? new Date(performance.entry_date).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Báscula pública</p>
                    <p className="font-semibold">{parseFloat(performance.public_scale_weight_kg || 0).toLocaleString()} kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rendimiento total</p>
                    <p className="font-semibold text-green-600 text-xl">
                      {parseFloat(performance.performance_percentage || 0).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Métricas principales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Cajas producidas</p>
                      <p className="text-xl font-bold text-green-900">
                        {parseFloat(performance.total_boxes_produced || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Scale className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Kilos producidos</p>
                      <p className="text-xl font-bold text-blue-900">
                        {parseFloat(performance.total_kg_produced || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-gray-600">Proceso</p>
                      <p className="text-xl font-bold text-orange-900">
                        {parseFloat(performance.process_percentage || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-red-600 transform rotate-180" />
                    <div>
                      <p className="text-sm text-gray-600">Desecho</p>
                      <p className="text-xl font-bold text-red-900">
                        {parseFloat(performance.waste_percentage || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendimiento por calibre */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4" style={{ color: primaryColor || "#059669" }}>
                  Rendimiento por Calibre
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: primaryColor || "#059669" }}>
                        <th className="text-left text-white px-4 py-3 rounded-tl-lg">Calibre</th>
                        <th className="text-right text-white px-4 py-3">Porcentaje</th>
                        <th className="text-right text-white px-4 py-3 rounded-tr-lg">Kilos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(performance.percentage_by_caliber || {}).map(([caliber, percentage], idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-4 py-3 font-semibold">{caliber}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                              {parseFloat(percentage || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {parseFloat((performance.kg_by_caliber || {})[caliber] || 0).toLocaleString()} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rendimiento por calidad */}
              <div>
                <h3 className="text-xl font-bold mb-4" style={{ color: primaryColor || "#059669" }}>
                  Rendimiento por Calidad
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: primaryColor || "#059669" }}>
                        <th className="text-left text-white px-4 py-3 rounded-tl-lg">Calidad</th>
                        <th className="text-right text-white px-4 py-3">Porcentaje</th>
                        <th className="text-right text-white px-4 py-3 rounded-tr-lg">Kilos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(performance.percentage_by_quality || {}).map(([quality, percentage], idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-4 py-3 font-semibold">{quality}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                              {parseFloat(percentage || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {parseFloat((performance.kg_by_quality || {})[quality] || 0).toLocaleString()} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Botones de descarga */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Descargar Reporte</h3>
              <div className="flex gap-3">
                <button
                  onClick={downloadPDF}
                  className="flex-1 px-6 py-3 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition"
                  style={{ backgroundColor: primaryColor || "#059669" }}
                >
                  <FileText className="h-5 w-5" />
                  Descargar PDF
                </button>
                <button
                  onClick={downloadJPG}
                  className="flex-1 px-6 py-3 bg-blue-600 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition"
                >
                  <ImageIcon className="h-5 w-5" />
                  Descargar JPG
                </button>
              </div>
            </div>
          </>
        )}

        {/* Estado vacío */}
        {!performance && !calculating && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Selecciona un lote para ver su rendimiento
            </h3>
            <p className="text-gray-500">
              El sistema calculará automáticamente los rendimientos desde los datos de producción y entrada de fruta
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
