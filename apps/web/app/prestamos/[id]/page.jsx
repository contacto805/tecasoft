'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import SignatureCapture from '@/components/signature-capture';

export default function PrestamoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [prestamo, setPrestamo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [addingAbono, setAddingAbono] = useState(false);
  const [newAbono, setNewAbono] = useState({ monto: '', concepto: 'Abono de préstamo', fecha: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if (params?.id) {
      fetchPrestamo();
    }
  }, [params?.id]);

  const fetchPrestamo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/prestamos/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPrestamo(data);
      }
    } catch (error) {
      console.error('Error fetching préstamo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('¿Aprobar este préstamo?')) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/prestamos/${params.id}/approve`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setPrestamo(data);
        
        // Show signature capture modal
        setShowSignature(true);
        alert('Préstamo aprobado. Se ha registrado automáticamente el egreso en Módulo de Gastos (Préstamos).');
      } else {
        alert('Error al aprobar el préstamo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aprobar el préstamo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignatureComplete = async (signatureUrl, recipientName) => {
    try {
      const response = await fetch('/api/signatures/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureUrl,
          recipientName,
          transactionType: prestamo.type === 'anticipo' ? 'Anticipo' : 'Préstamo',
          transactionId: prestamo.id,
          module: 'prestamo'
        })
      });

      if (response.ok) {
        alert('Préstamo aprobado y firma guardada exitosamente');
        setShowSignature(false);
        fetchPrestamo();
      } else {
        alert('Error al guardar la firma');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la firma');
    }
  };

  const handleReject = async () => {
    if (!confirm('¿Rechazar este préstamo?')) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/prestamos/${params.id}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Préstamo rechazado');
        fetchPrestamo();
      } else {
        alert('Error al rechazar el préstamo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al rechazar el préstamo');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const startEdit = () => {
    setEditData({
      employee_name: prestamo.employee_name || '',
      employee_id: prestamo.employee_id || '',
      amount: prestamo.amount || prestamo.monto_original || '',
      descuento_semanal: prestamo.descuento_semanal || '',
      num_semanas: prestamo.num_semanas || prestamo.plazo || '',
      reason: prestamo.reason || '',
      interest_rate: prestamo.interest_rate || prestamo.tasa_interes || '',
      notes: prestamo.notes || ''
    });
    setIsEditing(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const saveEdit = async () => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/prestamos/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (response.ok) {
        const data = await response.json();
        setPrestamo(data);
        setIsEditing(false);
        alert('Movimiento actualizado');
      } else {
        alert('Error al guardar edición');
      }
    } catch (e) {
      alert('Error al editar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAbono = async () => {
    const monto = parseFloat(newAbono.monto);
    if (!monto || monto <= 0) {
      alert('Monto del abono inválido');
      return;
    }
    try {
      setAddingAbono(true);
      const res = await fetch(`/api/prestamos/${params.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto,
          concepto: newAbono.concepto || 'Abono / Pago',
          fecha: newAbono.fecha || undefined,
          applied_by: 'Usuario'
        })
      });
      if (res.ok) {
        setNewAbono({ monto: '', concepto: 'Abono de préstamo', fecha: new Date().toISOString().split('T')[0] });
        fetchPrestamo();
        alert('Abono/pago registrado con folio automático');
      } else {
        alert('Error al registrar abono');
      }
    } catch (e) {
      alert('Error');
    } finally {
      setAddingAbono(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!prestamo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-600">Préstamo no encontrado</p>
          <button
            onClick={() => router.push('/prestamos')}
            className="mt-4 text-brand-600 hover:text-brand-700"
          >
            Regresar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/prestamos')}
            className="text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-2"
          >
            <span>←</span> Regresar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Detalle • Préstamos Trabajadores</h1>
              <p className="text-slate-600 mt-2">Folio: {prestamo.folio || prestamo.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-slate-50">Imprimir</button>
              <button onClick={startEdit} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-slate-50" disabled={isEditing}>Editar</button>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                (prestamo.estado || prestamo.status || '').toLowerCase().includes('rech') ? 'bg-red-100 text-red-700' : (prestamo.estado || prestamo.status || '').toLowerCase().includes('aprob') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {prestamo.estado || prestamo.status || 'Pendiente'}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Información del Préstamo</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Empleado</p>
              <p className="text-base text-slate-900">{prestamo.employee_name || 'N/A'} <span className="text-xs text-slate-500">({prestamo.employee_id})</span></p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Monto solicitado</p>
              <p className="text-base font-bold text-slate-900">${parseFloat(prestamo.amount || prestamo.monto_original || 0).toLocaleString('es-MX')}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Tasa de interés</p>
              <p className="text-base font-semibold text-slate-900">{parseFloat(prestamo.interest_rate || prestamo.tasa_interes || 0)}%</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Plazo</p>
              <p className="text-base text-slate-900">{prestamo.num_semanas || prestamo.plazo || 0} semanas</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Descuento semanal aplicado</p>
              <p className="text-base font-semibold text-emerald-700">${parseFloat(prestamo.descuento_semanal || 0).toLocaleString('es-MX')}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Saldo restante</p>
              <p className="text-base font-bold text-slate-900">${parseFloat(prestamo.remaining_balance || prestamo.saldo_pendiente || prestamo.amount || 0).toLocaleString('es-MX')}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Estado</p>
              <span className={`inline-block text-sm px-4 py-1 rounded-full font-medium ${ (prestamo.status||'').toLowerCase().includes('rech') ? 'bg-red-100 text-red-700' : (prestamo.status||'').toLowerCase()==='aprobado' || (prestamo.status||'').toLowerCase()==='activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700' }`}>{prestamo.estado || prestamo.status || 'Pendiente'}</span>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Motivo</p>
              <p className="text-base text-slate-900">{prestamo.reason || 'N/A'}</p>
            </div>

            {prestamo.notes && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-slate-600 mb-1">Notas</p>
                <p className="text-base text-slate-900">{prestamo.notes}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Fecha de Solicitud</p>
              <p className="text-base text-slate-900">
                {prestamo.created_at ? new Date(prestamo.created_at).toLocaleDateString('es-MX') : 'N/A'}
              </p>
            </div>

            {prestamo.approved_at && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Fecha de Aprobación</p>
                <p className="text-base text-slate-900">
                  {new Date(prestamo.approved_at).toLocaleDateString('es-MX')}
                </p>
              </div>
            )}

            {prestamo.approved_by && (
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Aprobado por</p>
                <p className="text-base text-slate-900">{prestamo.approved_by}</p>
              </div>
            )}

            {prestamo.recipient_signature_url && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-slate-600 mb-2">Firma del Receptor</p>
                <img 
                  src={prestamo.recipient_signature_url} 
                  alt="Firma" 
                  className="border border-slate-300 rounded-lg p-2 bg-white max-w-md"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Firmado por: {prestamo.signature_confirmed_by} - {prestamo.signature_captured_at ? new Date(prestamo.signature_captured_at).toLocaleString('es-MX') : 'N/A'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Signature Modal */}
        {showSignature && (
          <SignatureCapture
            recipientName={prestamo.employee_name}
            transactionType={prestamo.type === 'anticipo' ? 'Anticipo' : 'Préstamo'}
            onSignatureComplete={handleSignatureComplete}
            onCancel={() => setShowSignature(false)}
          />
        )}

        {/* INLINE EDIT FORM for movimiento */}
        {isEditing && (
          <div className="bg-white rounded-lg border p-6 mb-4">
            <h3 className="font-semibold mb-4">Editar Movimiento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="border p-2 rounded" name="employee_name" value={editData.employee_name||''} onChange={handleEditChange} placeholder="Empleado" />
              <input className="border p-2 rounded" name="amount" value={editData.amount||''} onChange={handleEditChange} placeholder="Monto" />
              <input className="border p-2 rounded" name="descuento_semanal" value={editData.descuento_semanal||''} onChange={handleEditChange} placeholder="Desc. semanal" />
              <input className="border p-2 rounded" name="num_semanas" value={editData.num_semanas||''} onChange={handleEditChange} placeholder="Semanas" />
              <input className="border p-2 rounded md:col-span-2" name="reason" value={editData.reason||''} onChange={handleEditChange} placeholder="Motivo" />
              <textarea className="border p-2 rounded md:col-span-2" name="notes" value={editData.notes||''} onChange={handleEditChange} placeholder="Notas" />
            </div>
          </div>
        )}

        {/* Movimientos, abonos y pagos */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="font-bold mb-3">Movimientos • Abonos • Pagos</h3>
          <div className="flex gap-2 mb-3">
            <input type="number" step="0.01" placeholder="Monto abono" value={newAbono.monto} onChange={e=>setNewAbono({...newAbono, monto:e.target.value})} className="border p-2 rounded text-sm flex-1" />
            <input placeholder="Concepto" value={newAbono.concepto} onChange={e=>setNewAbono({...newAbono, concepto:e.target.value})} className="border p-2 rounded text-sm flex-1" />
            <input type="date" value={newAbono.fecha} onChange={e=>setNewAbono({...newAbono, fecha:e.target.value})} className="border p-2 rounded text-sm" />
            <button onClick={handleAddAbono} disabled={addingAbono} className="px-4 py-2 bg-emerald-700 text-white text-sm rounded">{addingAbono ? '...' : 'Registrar Abono'}</button>
          </div>

          {(prestamo.payments && prestamo.payments.length > 0) ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500"><th className="p-2">Folio Movimiento</th><th className="p-2">Monto</th><th className="p-2">Fecha</th><th className="p-2">Concepto</th><th className="p-2">Por</th><th></th></tr></thead>
                <tbody>
                  {prestamo.payments.map((p, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-mono text-xs">{p.folio || `ABO-${p.id}`}</td>
                      <td className="p-2 font-semibold">${parseFloat(p.monto||0).toLocaleString('es-MX')}</td>
                      <td className="p-2">{p.fecha ? new Date(p.fecha).toLocaleDateString('es-MX') : '—'}</td>
                      <td className="p-2">{p.concepto || 'Abono/Pago'}</td>
                      <td className="p-2 text-xs">{p.applied_by || '-'}</td>
                      <td className="p-2"><button onClick={handlePrint} className="text-xs underline">Imprimir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-xs text-slate-500">No hay abonos aún. Registre el primero arriba.</div>}
          <p className="text-[10px] text-slate-500 mt-2">Cada abono, pago o movimiento tiene folio automático.</p>
        </div>

        {/* Actions */}
        {isEditing ? (
          <div className="flex gap-3">
            <button onClick={() => setIsEditing(false)} disabled={actionLoading} className="flex-1 px-6 py-3 border rounded-lg">Cancelar</button>
            <button onClick={saveEdit} disabled={actionLoading} className="flex-1 px-6 py-3 bg-emerald-700 text-white rounded-lg font-medium">{actionLoading ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-4">
              <button onClick={handlePrint} className="flex-1 px-6 py-3 border rounded-lg font-medium">Imprimir movimiento</button>
              <button onClick={startEdit} className="flex-1 px-6 py-3 border border-emerald-700 text-emerald-700 rounded-lg font-medium">Editar movimiento</button>
            </div>
            {(prestamo.estado || prestamo.status || '').toLowerCase() === 'pendiente' && (
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Procesando...' : 'Aprobar'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
