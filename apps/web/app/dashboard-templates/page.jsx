'use client';

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Check, X, Upload } from "lucide-react";

export default function DashboardTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState({
    templateName: "",
    description: "",
    templateImageUrl: "",
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/dashboard-templates");
      if (!response.ok) throw new Error("Error al cargar plantillas");
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.templateName || !formData.templateImageUrl) {
      alert("Por favor completa los campos requeridos");
      return;
    }

    try {
      const method = editing ? "PUT" : "POST";
      const url = "/api/dashboard-templates";
      const payload = {
        ...formData,
        id: editing?.id,
        fieldsConfig: {
          fields: [
            { name: "lot_number", x: 50, y: 50, size: 24, color: "#000000" },
            { name: "fruit_type", x: 50, y: 100, size: 18, color: "#333333" },
            { name: "producer", x: 50, y: 150, size: 16, color: "#333333" },
            { name: "origin", x: 50, y: 200, size: 16, color: "#333333" },
            { name: "date", x: 50, y: 250, size: 14, color: "#666666" },
            { name: "qr_code", x: 300, y: 50, size: 150, color: "#000000" },
          ],
        },
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Error al guardar plantilla");

      await fetchTemplates();
      setFormData({ templateName: "", description: "", templateImageUrl: "" });
      setImagePreview("");
      setEditing(null);
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta plantilla?")) return;

    try {
      const response = await fetch(`/api/dashboard-templates?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error al eliminar plantilla");
      await fetchTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (template) => {
    setEditing(template);
    setFormData({
      templateName: template.template_name,
      description: template.description || "",
      templateImageUrl: template.template_image_url,
    });
    setImagePreview(template.template_image_url);
    setShowForm(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Error al subir imagen");

      const data = await response.json();
      setFormData({ ...formData, templateImageUrl: data.url });
      setImagePreview(data.url);
    } catch (err) {
      alert("Error al subir la imagen: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Cargando plantillas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              Plantillas de Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Crea y personaliza plantillas para mostrar información de lotes
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setFormData({ templateName: "", description: "", templateImageUrl: "" });
              setImagePreview("");
              setShowForm(!showForm);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus size={20} />
            Nueva Plantilla
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-l-4 border-indigo-600">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editing ? "Editar Plantilla" : "Nueva Plantilla"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de la Plantilla *
                  </label>
                  <input
                    type="text"
                    value={formData.templateName}
                    onChange={(e) =>
                      setFormData({ ...formData, templateName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    placeholder="Ej: Plantilla Premium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    placeholder="Descripción opcional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagen de Fondo *
                </label>
                <div className="space-y-3">
                  {/* Upload button */}
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition">
                    <Upload size={18} className="text-indigo-600 mr-2" />
                    <span className="text-sm font-medium text-indigo-600">
                      {uploading ? "Subiendo..." : "Selecciona una imagen o arrastra"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>

                  {/* URL input as alternative */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">O pega una URL de imagen:</p>
                    <input
                      type="url"
                      value={formData.templateImageUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, templateImageUrl: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                </div>

                {imagePreview && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Vista previa:</p>
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      className="max-h-64 rounded-lg border border-gray-300"
                      onError={() => setImagePreview("")}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                  <Check size={18} />
                  {editing ? "Actualizar" : "Crear"} Plantilla
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setImagePreview("");
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                  <X size={18} />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-600">
              No hay plantillas creadas aún. Crea la primera.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition"
              >
                {template.template_image_url && (
                  <div className="h-48 overflow-hidden bg-gray-100">
                    <img
                      src={template.template_image_url}
                      alt={template.template_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {template.template_name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-4">
                      {template.description}
                    </p>
                  )}
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => handleEdit(template)}
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit2 size={16} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
