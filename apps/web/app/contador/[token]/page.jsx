'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Upload, CheckCircle, Calendar, User, MapPin, Loader2, Download, Trash2, ExternalLink, PenTool, Send } from 'lucide-react';

export default function ContadorDashboard() {
  const params = useParams();
  const token = params?.token;
  
  const [lotData, setLotData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [pesadas, setPesadas] = useState([]);
  const [notaEntrada, setNotaEntrada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [contractSignature, setContractSignature] = useState(null);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractText, setContractText] = useState('');
  const [savingContract, setSavingContract] = useState(false);

  const documentTypes = [
    { id: 'constancia_situacion_fiscal', label: 'Constancia de Situación Fiscal (mes en curso)' },
    { id: 'opinion_cumplimiento', label: 'Opinión de Cumplimiento POSITIVA (vigente)' },
    { id: 'identificacion_oficial', label: 'Identificación oficial vigente' },
    { id: 'caratula_estado_cuenta', label: 'Carátula del estado de cuenta bancario' },
    { id: 'contrato_firmado', label: 'Contrato de Compraventa impreso y firmado por el productor' }
  ];

  useEffect(() => {
    if (token) {
      fetchData();
      checkAdminAccess();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contador/${token}`);
      
      if (!response.ok) {
        throw new Error('Enlace inválido o expirado');
      }

      const data = await response.json();
      setLotData(data.lot);
      setPesadas(data.pesadas || []);
      setNotaEntrada(data.notaEntrada || null);
      
      // Obtener documentos subidos 
      const docsResponse = await fetch(`/api/contador/${token}/documents`);
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setDocuments(docsData.documents || []);
      } else {
        setDocuments(data.documents || []);
      }

      // Estado de firma electrónica DocuSign para el contrato
      try {
        const dsRes = await fetch(`/api/contador/${token}/docusign`);
        if (dsRes.ok) {
          const ds = await dsRes.json();
          setContractSignature(ds.signature || null);
          if (ds.signature?.signer_email) setSignerEmail(ds.signature.signer_email);
          if (ds.signature?.signer_name) setSignerName(ds.signature.signer_name);
        }
      } catch (_) {}
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verificar si es superadministrador o encargado de administración
  const checkAdminAccess = async () => {
    try {
      const [superRes, roleRes] = await Promise.all([
        fetch('/api/auth/check-super-admin'),
        fetch('/api/expedientes/access-check')
      ]);
      const s = await superRes.json().catch(() => ({}));
      const r = await roleRes.json().catch(() => ({}));
      setIsAdmin(!!s.isSuperAdmin || !!r.access);
    } catch (_) {
      setIsAdmin(false);
    }
  };

  const handleFileUpload = async (documentType, file) => {
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const response = await fetch(`/api/contador/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir documento');
      }

      await fetchData(); // Recargar datos
      alert('Documento subido exitosamente');
    } catch (err) {
      alert('Error al subir documento: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getContractBlob = async () => {
    const res = await fetch(`/api/lots/${lotData.lot_id}/contract`);
    if (!res.ok) throw new Error('No se generó el contrato');
    return await res.blob();
  };

  const downloadContract = async () => {
    try {
      const blob = await getContractBlob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `Contrato_Lote_${lotData.lot_number || lotData.lot_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(objUrl);
        document.body.removeChild(a);
      }, 900);
    } catch (err) {
      alert('Error al descargar contrato');
    }
  };

  const viewContract = async () => {
    if (!lotData?.lot_id) return;
    try {
      // Fetch as blob + open object URL in new tab: reliable PDF viewer + print option.
      // Avoids direct navigation to /api which can be blocked in preview host.
      const blob = await getContractBlob();
      const objUrl = window.URL.createObjectURL(blob);
      const win = window.open(objUrl, '_blank');
      // Auto focus new tab and allow browser print (user presses Ctrl+P or uses PDF viewer print button)
      if (win) {
        // small delay so PDF renders then user can print
        setTimeout(() => win.focus && win.focus(), 650);
      }
      // IMPORTANT: keep blob alive a moment
      setTimeout(() => window.URL.revokeObjectURL(objUrl), 120000);
    } catch (err) {
      alert('Error al abrir contrato para imprimir');
    }
  };

  const openEditContract = async () => {
    try {
      const res = await fetch('/api/contract-template');
      const data = await res.json();
      setContractText(data.base_text || '');
      setShowEditModal(true);
    } catch {
      setContractText('');
      setShowEditModal(true);
    }
  };

  const handleSaveContractTemplate = async () => {
    if (!contractText || contractText.length < 40) {
      alert('El contrato debe tener más contenido.');
      return;
    }
    setSavingContract(true);
    try {
      const res = await fetch('/api/contract-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_text: contractText })
      });
      if (!res.ok) throw new Error();
      setShowEditModal(false);
      alert('Plantilla de contrato actualizada. La descarga reflejará los cambios.');
    } catch {
      alert('No se pudo guardar, intenta de nuevo.');
    } finally {
      setSavingContract(false);
    }
  };

  const isDocumentUploaded = (docType) => {
    return documents.some(doc => doc.document_type === docType);
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contador/${token}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId })
      });

      if (!response.ok) {
        throw new Error('Error al eliminar documento');
      }

      await fetchData();
      alert('Documento eliminado exitosamente');
    } catch (err) {
      alert('Error al eliminar documento: ' + err.message);
    }
  };

  // --- Acciones DocuSign para el Contrato de Compraventa con cláusula especial ---
  const handleSendToDocuSign = async () => {
    if (!signerEmail || !signerEmail.includes('@')) {
      alert('Ingresa un correo electrónico válido del firmante (productor o representante).');
      return;
    }
    try {
      setSigning(true);
      const res = await fetch(`/api/contador/${token}/docusign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send', 
          signerEmail, 
          signerName: signerName || lotData?.producer_name || lotData?.broker_name || ''
        })
      });
      if (!res.ok) throw new Error('Error enviando a DocuSign');
      await fetchData();
      alert('Contrato enviado a firma electrónica via DocuSign.');
    } catch (e) {
      alert('No se pudo enviar: ' + e.message);
    } finally {
      setSigning(false);
    }
  };

  const handleCompleteSignature = async () => {
    if (!signerEmail || !signerEmail.includes('@')) {
      alert('Ingresa correo del firmante.');
      return;
    }
    try {
      setSigning(true);
      const res = await fetch(`/api/contador/${token}/docusign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'complete-signature', 
          signerEmail, 
          signerName: signerName || lotData?.producer_name || lotData?.broker_name || '' 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar firma');
      await fetchData();
      alert('Contrato registrado como FIRMADO. Archivo vinculado al expediente.');
    } catch (e) {
      alert('Error al completar signature: ' + e.message);
    } finally {
      setSigning(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'pendiente_de_firma': { label: 'Pendiente de firma', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
      'enviado_a_firma': { label: 'Enviado a firma', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
      'firmado': { label: 'Firmado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      'rechazado': { label: 'Rechazado', cls: 'bg-red-100 text-red-800 border-red-300' },
      'vencido_o_cancelado': { label: 'Vencido o cancelado', cls: 'bg-slate-200 text-slate-600 border-slate-300' }
    };
    const m = map[status] || { label: status || 'Pendiente de firma', cls: 'bg-gray-100 text-gray-700' };
    return <span className={`inline-block px-3 py-0.5 text-xs font-medium border rounded-full ${m.cls}`}>{m.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace Inválido</h1>
          <p className="text-gray-600">{error}</p>
          <button onClick={() => window.location.href = '/contador'} className="mt-4 px-6 py-2 bg-emerald-700 text-white rounded-xl text-sm">Ir a acceso con credenciales de administrador</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Header con Logo */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <img 
            src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1784239435811_e9a67.jpeg"
            alt="Tecavo Fruits"
            className="h-16 mx-auto"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Información del Lote */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <FileText className="w-7 h-7 text-green-600" />
            Información del Lote #{lotData.lot_number}
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Productor/Corredor</p>
                <p className="font-semibold text-gray-900">{lotData.producer_name || lotData.broker_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Huerto</p>
                <p className="font-semibold text-gray-900">{lotData.orchard_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Municipio</p>
                <p className="font-semibold text-gray-900">{lotData.municipality || 'No especificado'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Fecha de Corte</p>
                <p className="font-semibold text-gray-900">{lotData.cutting_date}</p>
              </div>
            </div>
          </div>

          {/* Botones Contrato */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => downloadContract()}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-md"
            >
              <FileText className="w-5 h-5" />
              Descargar Contrato (PDF Carta)
            </button>
            <button
              onClick={() => viewContract()}
              className="w-full bg-white border-2 border-emerald-700 text-emerald-800 py-3 px-6 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 font-semibold"
            >
              <ExternalLink className="w-5 h-5" />
              Ver e imprimir contrato
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={openEditContract}
              className="mt-2 w-full text-sm py-2 px-6 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-2"
            >
              ✏️ Editar texto del contrato (solo administradores)
            </button>
          )}
        </div>

        {/* Contrato de Compraventa con Cláusula Especial - DocuSign */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <PenTool className="w-7 h-7 text-emerald-700" />
            <h2 className="text-2xl font-bold text-gray-900">Contrato de Compraventa con Cláusula Especial</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">Este contrato está precargado por defecto y puede ser firmado electrónicamente con DocuSign. El documento firmado se vincula automáticamente al expediente del lote.</p>

          <div className="flex items-center gap-3 mb-4">
            {contractSignature ? getStatusBadge(contractSignature.status) : getStatusBadge('pendiente_de_firma')}
            {contractSignature?.signed_at && (
              <span className="text-xs text-emerald-700">Firmado el {new Date(contractSignature.signed_at).toLocaleDateString('es-MX')}</span>
            )}
          </div>

          {/* Controles firma / envío */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Correo electrónico del firmante (Productor / Representante autorizado)</label>
                <input 
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="correo@productor.com"
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  disabled={signing}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre del firmante</label>
                <input 
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Nombre completo"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  disabled={signing}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleSendToDocuSign} 
                disabled={signing || !signerEmail}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                <Send className="w-4 h-4" /> {signing ? 'Enviando...' : 'Enviar a DocuSign'}
              </button>

              <button 
                onClick={handleCompleteSignature} 
                disabled={signing || !signerEmail}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                <PenTool className="w-4 h-4" /> {signing ? 'Procesando...' : 'Firmar electrónicamente (Registrar firma)'}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">La integración está lista para crear envelopes y recibir Webhooks reales de DocuSign cuando se configuren las credenciales de la cuenta (Integrator Key / Account ID). Actualmente se soporta envío y registro completo del PDF</p>
          </div>

          {/* Datos de firma registrada */}
          {contractSignature && contractSignature.status === 'firmado' && (
            <div className="mt-3 bg-emerald-50 border-emerald-200 border rounded-xl p-4 text-sm">
              <div><span className="font-medium">Firmante:</span> {contractSignature.signer_name} ({contractSignature.signer_email})</div>
              <div><span className="font-medium">Fecha firma:</span> {contractSignature.signed_at ? new Date(contractSignature.signed_at).toLocaleString('es-MX') : ''}</div>
              <button 
                onClick={() => viewContract()} 
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-md"
              >
                Ver documento firmado (imprimible) <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Pesadas y Nota de Entrada de su Fruta */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Calendar className="w-7 h-7 text-green-600" />
            Pesadas y Nota de Entrada
          </h2>

          {notaEntrada ? (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
              <div><span className="font-semibold">Peso total recibido:</span> {Number(notaEntrada.total_kg_weighed || 0).toLocaleString()} kg</div>
              {notaEntrada.public_scale_date && <div><span className="font-semibold">Fecha pesaje / recepción:</span> {String(notaEntrada.public_scale_date).slice(0,10)}</div>}
              {notaEntrada.reception_responsible && <div><span className="font-semibold">Responsable recepción:</span> {notaEntrada.reception_responsible}</div>}
              {notaEntrada.reception_notes && <div className="mt-1"><span className="font-semibold">Notas:</span> {notaEntrada.reception_notes}</div>}
            </div>
          ) : (
            <div className="text-sm text-slate-600 mb-4">La nota de entrada se cargará automáticamente desde el registro del lote.</div>
          )}

          {pesadas.length > 0 ? (
            <div className="border rounded-xl overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha/Hora</th>
                    <th className="px-3 py-2 text-right">Cajas</th>
                    <th className="px-3 py-2 text-right">Peso Bruto</th>
                    <th className="px-3 py-2 text-right">Peso Neto</th>
                    <th className="px-3 py-2 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pesadas.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1.5 text-xs tabular-nums">{String(p.timestamp||'').slice(0,16)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{p.boxes || 0}</td>
                      <td className="px-3 py-1.5 text-right">{Number(p.gross_weight || 0).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{Number(p.net_weight || 0).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">{p.with_pallet ? 'Con tarima' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No hay pesadas individuales registradas. El total aparece en la nota de entrada.</div>
          )}
        </div>

        {/* Instrucciones para subir documentación y elaborar facturas */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-emerald-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">REQUISITOS OBLIGATORIOS PARA PAGO</h2>
          <p className="text-sm text-gray-600 mb-4">Documentación requerida para alta y programación de pagos</p>

          <div className="pt-4 border-t border-emerald-100">
            <h3 className="font-semibold text-lg mb-3 text-emerald-900">INFORMACIÓN IMPORTANTE</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              <li>Proveedores inscritos en RESICO: desglosar la retención de ISR del 1.25%.</li>
              <li>Los pagos se realizarán exclusivamente los días Viernes.</li>
              <li>La recepción de facturas deberá realizarse una semana antes de la fecha programada de pago.</li>
              <li>Fecha límite de recepción: jueves a las 6:00 p.m. Las facturas recibidas posteriormente serán consideradas para la siguiente programación semanal.</li>
            </ul>
          </div>
        </div>

        {/* Subir Documentos */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Upload className="w-7 h-7 text-green-600" />
            Subir Documentación Requerida
          </h2>

          <div className="space-y-4">
            {documentTypes.map((docType) => {
              const uploaded = isDocumentUploaded(docType.id);
              
              return (
                <div 
                  key={docType.id}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    uploaded 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-gray-200 hover:border-green-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-gray-900 flex items-center gap-2">
                      {uploaded && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {docType.label}
                    </label>
                    {uploaded && (
                      <span className="text-sm text-green-700 font-medium">
                        ✓ Subido
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(docType.id, file);
                        e.target.value = '';
                      }
                    }}
                    disabled={uploading}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              );
            })}
          </div>

          {uploading && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-blue-900 font-medium">Subiendo documento...</span>
            </div>
          )}
        </div>

        {/* Documentos Cargados */}
        {documents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <FileText className="w-7 h-7 text-green-600" />
              Documentos Cargados en Google Drive
            </h2>

            <div className="space-y-3">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {doc.file_name}
                      </p>
                        <p className="text-xs text-gray-500">
                        {doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Ver en Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Los documentos se encuentran almacenados de forma segura en Google Drive organizados por productor y fecha de corte.
            </p>
          </div>
        )}
        

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>TECAVO FRUITS S de RL de CV | Calidad • Confianza • Exportación</p>
        </div>
      </div>

      {/* Modal Editar Contrato - solo visible para superadmin / encargado admin */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl p-6 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-xl">Editar plantilla de Contrato de Compraventa</h3>
                <p className="text-xs text-gray-500 mt-1">Los marcadores {`{Nombre de productor}`}, {`{Nombre del huerto}`}, {`{Nombre del municipio}`} se autorellena automáticamente con los datos del productor y huerto del lote.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-lg px-3">✕</button>
            </div>
            <textarea
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              className="w-full border rounded-xl p-4 font-mono text-sm h-[380px] whitespace-pre-wrap"
              placeholder="Texto del contrato..."
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 border rounded-xl">Cancelar</button>
              <button 
                onClick={handleSaveContractTemplate} 
                disabled={savingContract}
                className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl disabled:opacity-50"
              >
                {savingContract ? 'Guardando...' : 'Guardar y aplicar'}
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-3">El cambio se reflejará al descargar nuevamente desde cualquier sección.</p>
          </div>
        </div>
      )}
    </div>
  );
}
