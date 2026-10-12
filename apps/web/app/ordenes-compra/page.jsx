"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DownloadReportButton from "@/components/download-report-button";

export default function OrdenesCompraPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterPriority, setFilterPriority] = useState('all');
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    fetchDashboard();
    fetchRequests();
  }, [refreshKey]);

  useEffect(() => {
    applyFilters();
  }, [filterStatus, filterPriority, requests]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/purchase-dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/purchase-requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(r => r.priority === filterPriority);
    }

    setFilteredRequests(filtered);
  };

  const getStatusColor = (status) => {
    const colors = {
      'borrador': 'bg-gray-100 text-gray-700',
      'enviada': 'bg-blue-100 text-blue-700',
      'en revisión': 'bg-yellow-100 text-yellow-700',
      'solicitando cotización': 'bg-purple-100 text-purple-700',
      'cotización recibida': 'bg-indigo-100 text-indigo-700',
      'pendiente autorización': 'bg-orange-100 text-orange-700',
      'aprobada': 'bg-green-100 text-green-700',
      'rechazada': 'bg-red-100 text-red-700',
      'orden de compra generada': 'bg-teal-100 text-teal-700',
      'material recibido': 'bg-emerald-100 text-emerald-700',
      'cerrada': 'bg-gray-100 text-gray-500'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'baja': 'bg-gray-100 text-gray-600',
      'media': 'bg-blue-100 text-blue-600',
      'alta': 'bg-orange-100 text-orange-600',
      'urgente': 'bg-red-100 text-red-600'
    };
    return colors[priority] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Órdenes de Compra</h1>
          <p className="text-gray-600">Gestión centralizada de requisiciones y compras</p>
        </div>

        {/* Dashboard */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Solicitudes del Mes</div>
              <div className="text-3xl font-bold text-gray-900">{dashboard.requestsMonth}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Compras Autorizadas</div>
              <div className="text-3xl font-bold text-green-600">{dashboard.authorized}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Pendientes</div>
              <div className="text-3xl font-bold text-orange-600">{dashboard.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Compras Urgentes</div>
              <div className="text-3xl font-bold text-red-600">{dashboard.urgent}</div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los estatus</option>
                <option value="enviada">Enviada</option>
                <option value="en revisión">En revisión</option>
                <option value="solicitando cotización">Solicitando cotización</option>
                <option value="pendiente autorización">Pendiente autorización</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="material recibido">Material recibido</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas las prioridades</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div className="flex gap-3">
              <DownloadReportButton
                moduleName="Órdenes de Compra"
                title="Reporte de Órdenes de Compra"
                data={filteredRequests}
                columns={[
                  { header: 'Folio', key: 'folio' },
                  { header: 'Fecha', key: 'request_date', format: (val) => new Date(val).toLocaleDateString('es-MX') },
                  { header: 'Área', key: 'area_name' },
                  { header: 'Producto/Servicio', key: 'product_or_service' },
                  { header: 'Solicitante', key: 'user_name' },
                  { header: 'Prioridad', key: 'priority' },
                  { header: 'Estatus', key: 'status' }
                ]}
                format="pdf"
                orientation="landscape"
                includeStats={true}
                stats={{
                  'Total de Solicitudes': filteredRequests.length,
                  'Solicitudes del Mes': dashboard?.requestsMonth || 0,
                  'Autorizadas': dashboard?.authorized || 0,
                  'Pendientes': dashboard?.pending || 0,
                  'Urgentes': dashboard?.urgent || 0
                }}
              />
              <button
                onClick={() => router.push('/ordenes-compra/nueva')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Nueva Solicitud
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Solicitudes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button onClick={() => {}} className="text-xs p-1 float-right">Toggle</button>
          {loading ? (
            <div className="p-12 text-center text-gray-500">Cargando solicitudes...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No hay solicitudes</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto/Servicio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{request.folio}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.request_date).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {request.area_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {request.product_or_service}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.user_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/ordenes-compra/${request.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
