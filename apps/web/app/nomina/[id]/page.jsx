'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import SignatureCapture from '@/components/signature-capture';

export default function PayrollDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [payrollPeriod, setPayrollPeriod] = useState(null);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [showSignature, setShowSignature] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (params?.id) {
      fetchPayrollDetail();
    }
  }, [params?.id]);

  const fetchPayrollDetail = async () => {
    try {
      setLoading(true);
      
      // Fetch period
      const periodResponse = await fetch(`/api/payroll/periods/${params.id}`);
      if (periodResponse.ok) {
        const periodData = await periodResponse.json();
        setPayrollPeriod(periodData);
      }

      // Fetch individual employee records
      const recordsResponse = await fetch(`/api/payroll/records?period_id=${params.id}`);
      if (recordsResponse.ok) {
        const recordsData = await recordsResponse.json();
        setPayrollRecords(Array.isArray(recordsData) ? recordsData : []);
      }
    } catch (error) {
      console.error('Error fetching payroll:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSignature = (record) => {
    setSelectedRecord(record);
    setShowSignature(true);
  };

  const handleSignatureComplete = async (signatureUrl, recipientName) => {
    try {
      const response = await fetch('/api/signatures/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureUrl,
          recipientName,
          transactionType: 'Nómina',
          transactionId: selectedRecord.id,
          module: 'nomina'
        })
      });

      if (response.ok) {
        alert('Firma guardada exitosamente');
        setShowSignature(false);
        setSelectedRecord(null);
        fetchPayrollDetail();
      } else {
        alert('Error al guardar la firma');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la firma');
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

  if (!payrollPeriod) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-600">Nómina no encontrada</p>
          <button
            onClick={() => router.push('/nomina')}
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/nomina')}
            className="text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-2"
          >
            <span>←</span> Regresar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Detalle de Nómina</h1>
              <p className="text-slate-600 mt-2">
                Período: {payrollPeriod.week_start_date ? new Date(payrollPeriod.week_start_date).toLocaleDateString('es-MX') : 'N/A'} - {payrollPeriod.week_end_date ? new Date(payrollPeriod.week_end_date).toLocaleDateString('es-MX') : 'N/A'}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              payrollPeriod.status === 'aprobado'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {payrollPeriod.status || 'Pendiente'}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-medium text-slate-600 mb-1">Total de Nómina</p>
            <p className="text-2xl font-bold text-slate-900">${parseFloat(payrollPeriod.total_amount || 0).toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-medium text-slate-600 mb-1">Total de Empleados</p>
            <p className="text-2xl font-bold text-slate-900">{payrollPeriod.total_employees || payrollRecords.length}</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-medium text-slate-600 mb-1">Firmas Capturadas</p>
            <p className="text-2xl font-bold text-slate-900">
              {payrollRecords.filter(r => r.recipient_signature_url).length} / {payrollRecords.length}
            </p>
          </div>
        </div>

        {/* Employee Records */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Registros de Empleados</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Empleado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Departamento</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Días</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Horas</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Sueldo Neto</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Firma</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                      No hay registros de empleados
                    </td>
                  </tr>
                ) : (
                  payrollRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900">{record.employee_id || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{record.employee_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{record.department || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-700">{parseFloat(record.days_worked || 0).toFixed(1)}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-700">{parseFloat(record.hours_worked || 0).toFixed(1)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-right text-slate-900">${parseFloat(record.net_salary || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        {record.recipient_signature_url ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            <i className="ph ph-check-circle"></i>
                            Firmado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            <i className="ph ph-warning-circle"></i>
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        {record.recipient_signature_url ? (
                          <button
                            onClick={() => window.open(record.recipient_signature_url, '_blank')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver Firma"
                          >
                            <i className="ph ph-signature text-lg"></i>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRequestSignature(record)}
                            className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Capturar Firma
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature Modal */}
        {showSignature && selectedRecord && (
          <SignatureCapture
            recipientName={selectedRecord.employee_name}
            transactionType="Pago de Nómina"
            onSignatureComplete={handleSignatureComplete}
            onCancel={() => {
              setShowSignature(false);
              setSelectedRecord(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
