'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, Upload, ExternalLink, RefreshCw } from "lucide-react";

export default function DashboardPublicoQRAdmin() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [lots, setLots] = useState([]);
  const [links, setLinks] = useState([]);
  const [config, setConfig] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(null);
  const [generating, setGenerating] = useState({});

  useEffect(() => {
    checkAccess();
    fetchData();
  }, []);

  const checkAccess = async () => {
    try {
      const res = await fetch("/api/auth/check-super-admin");
      const data = await res.json();
      let authorized = !!data.isSuperAdmin;

      if (!authorized && data.userId) {
        // Allow "Encargado de Administración" who has been assigned any administrative module permissions
        try {
          const modsRes = await fetch(`/api/admin/users/${data.userId}/modules`);
          if (modsRes.ok) {
            const assigned = await modsRes.json();
            authorized = Array.isArray(assigned) && assigned.some(m => m.can_view);
          }
        } catch (_) {}
      }

      setIsAuthorized(authorized);
    } catch (e) {}
    setLoadingAuth(false);
  };

  const fetchData = async () => {
    try {
      const [lotsRes, linkRes, cfgRes] = await Promise.all([
        fetch("/api/lots"),
        fetch("/api/public-lots"),
        fetch("/api/public-dashboard-config")
      ]);
      const l = await lotsRes.json().catch(() => []);
      const lk = await linkRes.json().catch(() => []);
      const cf = await cfgRes.json().catch(() => null);
      
      setLots(Array.isArray(l) ? l : []);
      setLinks(Array.isArray(lk) ? lk : []);
      setConfig(cf);
    } catch (e) {
      console.error(e);
    }
  };

  const getPublicToken = (lotId) => {
    const found = links.find((li) => li.lot_id === lotId);
    return found?.public_token || null;
  };

  const generateQR = async (lotId) => {
    setGenerating(prev => ({ ...prev, [lotId]: true }));
    try {
      const res = await fetch("/api/generate-qr-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: lotId }),
      });
      if (res.ok) {
        await fetchData();
        setMessage("QR generado.");
      } else {
        setMessage("Error generando QR");
      }
    } catch {
      setMessage("Error al generar el QR del lote");
    }
    setTimeout(() => { setMessage(""); setGenerating(prev => ({ ...prev, [lotId]: false })); }, 1200);
  };

  const handleUploadTemplate = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (uploadData?.url) {
        const newUrl = uploadData.url;
        await fetch("/api/public-dashboard-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            header_image_url: newUrl, 
            template_image_url: newUrl 
          })
        });
        setConfig(prev => ({ ...(prev||{}), header_image_url: newUrl, template_image_url: newUrl }));
        setMessage("Plantilla actualizada. La imagen se mostrará en todos los dashboards públicos de lote.");
        await fetchData();
      } else {
        setMessage("Error subiendo imagen. Intenta nuevamente.");
      }
    } catch (err) {
      setMessage("Error al subir la plantilla.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const copyLink = (token) => {
    const full = typeof window !== "undefined" ? `${window.location.origin}/lot/${token}` : `/lot/${token}`;
    navigator.clipboard.writeText(full);
    setCopied(token);
    setTimeout(() => setCopied(null), 1600);
  };

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div>Cargando...</div></div>;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md bg-white border rounded-2xl p-10 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Acceso restringido</h1>
          <p className="text-slate-600 mb-4">Solo Superadministrador y Encargado de Administración pueden configurar el Dashboard público por QR de lote.</p>
          <button onClick={() => router.push("/admin")} className="px-5 py-2 rounded bg-slate-900 text-white text-sm">Volver al panel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard público por QR de lote</h1>
              <p className="text-slate-600 mt-1">Acceso exclusivo solo para Superadministrador y Encargado de Administración</p>
            </div>
            <button onClick={() => router.push("/admin")} className="flex items-center text-sm px-4 py-2 border rounded hover:bg-slate-100">Volver</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {message && <div className="bg-emerald-50 border-l-4 border-emerald-500 px-4 py-2 text-sm text-emerald-800">{message}</div>}

        {/* Plantilla editable */}
        <div className="bg-white border rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-1">Plantilla editable (imagen base JPG)</h2>
          <p className="text-sm text-slate-600 mb-5">Sube o modifica la imagen profesional de fondo. Esta aparecerá dentro de todos los dashboards públicos generados por QR.</p>

          <div className="flex flex-wrap gap-3 items-center">
            <label className="cursor-pointer px-6 py-2 bg-slate-900 text-white shadow rounded-xl flex items-center gap-2 text-sm hover:bg-black">
              <Upload size={18} /> {uploading ? "Subiendo…" : "Subir nueva plantilla JPG"}
              <input type="file" accept="image/jpeg,image/jpg" className="hidden" onChange={handleUploadTemplate} disabled={uploading} />
            </label>

            {config?.header_image_url && (
              <a href={config.header_image_url} target="_blank" className="text-sm underline text-brand-700">Ver imagen actual</a>
            )}
          </div>

          {config?.header_image_url && (
            <div className="mt-4 w-80">
              <img src={config.header_image_url} alt="Plantilla actual" className="rounded-xl border object-cover shadow aspect-video" />
            </div>
          )}
        </div>

        {/* Lista de lotes + QR */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">QR automáticos por lote</h2>
              <p className="text-sm text-slate-600">Se generan automáticamente desde el módulo <span className="font-medium">Ingreso de Fruta</span></p>
            </div>
            <button onClick={fetchData} className="flex gap-2 items-center px-3 py-1.5 rounded text-sm bg-white border">
              <RefreshCw size={16} /> Actualizar
            </button>
          </div>

          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left pl-6 py-3.5 font-medium">Lote</th>
                  <th className="text-left py-3.5 font-medium">Productor</th>
                  <th className="text-left py-3.5 font-medium">Tipo Fruta</th>
                  <th className="py-3.5 text-center font-medium">QR</th>
                  <th className="text-right pr-6 py-3.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lots.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No hay lotes registrados. Registra el primer lote en Ingreso de Fruta.</td></tr>}
                {lots.slice(0, 30).map((lot) => {
                  const tok = getPublicToken(lot.id);
                  const publicUrl = tok ? `/lot/${tok}` : null;
                  return (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="pl-6 py-4 font-semibold">{lot.lot_number}</td>
                      <td className="py-4">{lot.producer}</td>
                      <td className="py-4 text-slate-500">{lot.fruit_type}</td>
                      <td className="py-4 text-center">
                        {tok ? (
                          <div className="inline-block bg-slate-50 p-1.5 rounded">
                            <QRCodeCanvas value={`${typeof window !== "undefined" ? window.location.origin : ""}${publicUrl}`} size={72} level="H" />
                          </div>
                        ) : <span className="text-xs text-amber-600">Sin QR</span>}
                      </td>
                      <td className="text-right pr-6 py-4">
                        <div className="flex gap-2 justify-end items-center">
                          {!tok && (
                            <button onClick={() => generateQR(lot.id)} disabled={generating[lot.id]} className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 transition text-white rounded">
                              {generating[lot.id] ? "..." : "Generar QR"}
                            </button>
                          )}
                          {tok && (
                            <>
                              <button onClick={() => copyLink(tok)} className="inline-flex items-center gap-1 text-xs border px-3 py-1 rounded hover:bg-white">
                                {copied === tok ? <Check size={14}/> : <Copy size={14}/>} {copied === tok ? "Copiado" : "Copiar enlace"}
                              </button>
                              <a href={`/lot/${tok}`} target="_blank" className="inline-flex items-center gap-1 px-3 py-1 text-xs border rounded bg-white hover:bg-slate-50">
                                <ExternalLink size={14} /> Ver público
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] mt-2 text-slate-500 text-center">La información mostrada al escanear el QR es de solo lectura y limitada a este lote. No existe acceso al resto del ERP.</p>
        </div>
      </div>
    </div>
  );
}
