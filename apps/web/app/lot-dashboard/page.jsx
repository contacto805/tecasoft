'use client';

import { useEffect, useState } from "react";
import { Plus, Copy, ExternalLink, Trash2, Check } from "lucide-react";
import QRCode from "qrcode.react";

export default function LotDashboard() {
  const [lots, setLots] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLot, setSelectedLot] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lotsRes, templatesRes, dashboardsRes] = await Promise.all([
        fetch("/api/lots"),
        fetch("/api/dashboard-templates"),
        fetch("/api/lot-dashboard"),
      ]);

      if (!lotsRes.ok || !templatesRes.ok || !dashboardsRes.ok) {
        throw new Error("Error al cargar datos");
      }

      const lotsData = await lotsRes.json();
      const templatesData = await templatesRes.json();
      const dashboardsData = await dashboardsRes.json();

      setLots(Array.isArray(lotsData) ? lotsData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setDashboards(Array.isArray(dashboardsData) ? dashboardsData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async (e) => {
    e.preventDefault();
    if (!selectedLot || !selectedTemplate) {
      alert("Por favor selecciona un lote y una plantilla");
      return;
    }

    try {
      const response = await fetch("/api/lot-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: parseInt(selectedLot),
          templateId: parseInt(selectedTemplate),
        }),
      });

      if (!response.ok) throw new Error("Error al crear dashboard");

      await fetchData();
      setSelectedLot("");
      setSelectedTemplate("");
      alert("Dashboard creado exitosamente");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (lotId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este dashboard?")) return;

    try {
      const response = await fetch(`/api/lot-dashboard?lotId=${lotId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error al eliminar");
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getLotInfo = (lotId) => {
    return lots.find((l) => l.id === lotId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">
            Dashboards de Lotes
          </h1>
          <p className="text-gray-600 mt-2">
            Asigna plantillas a lotes y genera dashboards públicos con QR
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Create Dashboard Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-l-4 border-indigo-600">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Crear Dashboard para Lote
          </h2>
          <form onSubmit={handleCreateDashboard} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Lote *
                </label>
                <select
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="">-- Selecciona un lote --</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} - {lot.fruit_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Plantilla *
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="">-- Selecciona una plantilla --</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.template_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Crear Dashboard
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Dashboards List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Dashboards Creados
          </h2>
          {dashboards.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="text-gray-600">
                No hay dashboards creados aún. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {dashboards.map((dashboard) => {
                const lotInfo = getLotInfo(dashboard.lot_id);
                const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/lot/${dashboard.public_token}`;

                return (
                  <div
                    key={dashboard.id}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition"
                  >
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Info */}
                        <div className="md:col-span-2">
                          <h3 className="text-xl font-bold text-slate-900 mb-4">
                            Lote #{lotInfo?.lot_number || "N/A"}
                          </h3>
                          <div className="space-y-2 text-sm text-gray-600">
                            <p>
                              <span className="font-medium">Fruta:</span>{" "}
                              {lotInfo?.fruit_type || "N/A"}
                            </p>
                            <p>
                              <span className="font-medium">Productor:</span>{" "}
                              {lotInfo?.producer || "N/A"}
                            </p>
                            <p>
                              <span className="font-medium">Origen:</span>{" "}
                              {lotInfo?.origin || "N/A"}
                            </p>
                            <p>
                              <span className="font-medium">Plantilla:</span>{" "}
                              {dashboard.template_name}
                            </p>
                          </div>
                        </div>

                        {/* QR */}
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-sm text-gray-600 mb-3">Código QR</p>
                          <QRCodeCanvas
                            value={publicUrl}
                            size={120}
                            level="H"
                            includeMargin={true}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => copyToClipboard(publicUrl, dashboard.id)}
                            className={`px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm ${
                              copied === dashboard.id
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 hover:bg-blue-200 text-blue-700"
                            }`}
                          >
                            {copied === dashboard.id ? (
                              <>
                                <Check size={16} />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy size={16} />
                                Copiar URL
                              </>
                            )}
                          </button>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700"
                          >
                            <ExternalLink size={16} />
                            Ver
                          </a>
                          <button
                            onClick={() => handleDelete(dashboard.lot_id)}
                            className="px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm bg-red-100 hover:bg-red-200 text-red-700"
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
