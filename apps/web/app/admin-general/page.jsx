"use client";

import { useState, useEffect } from "react";
import { 
  LayoutDashboard, Search, CheckCircle, AlertTriangle, 
  FileText, Bell, Clock, TrendingUp, TrendingDown,
  Users, Package, Truck, DollarSign, Calendar,
  Eye, Filter, Download, RefreshCw
} from "lucide-react";

export default function AdminGeneralPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [authorizations, setAuthorizations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [period, setPeriod] = useState("today");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clientePrecios, setClientePrecios] = useState({}); // by customer id  {cid: [{caliber, price}] }

  // General admin: divide module sections + assign tasks with RBAC
  const [sectionAssignments, setSectionAssignments] = useState([]);
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [assignModule] = useState('gastos');
  const [assignSection, setAssignSection] = useState('registro');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('capturista');
  const SECTIONS = ['registro', 'aprobacion', 'config', 'reportes'];

  useEffect(() => {
    if (activeTab === "dashboard") {
      loadDashboard();
    } else if (activeTab === "autorizaciones") {
      loadAuthorizations();
    } else if (activeTab === "alertas") {
      loadAlerts();
    } else if (activeTab === "bitacora") {
      loadAuditLogs();
    } else if (activeTab === "clientes") {
      loadClientes();
    } else if (activeTab === "asignaciones") {
      loadAssignments();
    }
  }, [activeTab, period]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?period=${period}`);
      const data = await res.json();
      setDashboardData(data && !data.error ? data : null);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuthorizations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/authorizations?status=pendiente");
      const data = await res.json();
      setAuthorizations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading authorizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/alerts?status=activa");
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit-log?limit=50");
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/customers/prices')
      ]);
      const cls = cRes.ok ? await cRes.json() : [];
      const prs = pRes.ok ? await pRes.json() : [];
      setClientes(Array.isArray(cls) ? cls : []);
      const grouped = {};
      (prs || []).forEach(p => {
        if (!grouped[p.customer_id]) grouped[p.customer_id] = [];
        grouped[p.customer_id].push(p);
      });
      setClientePrecios(grouped);
    } catch(e){}
    finally { setLoading(false); }
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const [assignRes, usersRes] = await Promise.all([
        fetch('/api/admin/section-assignments?module=gastos'),
        fetch('/api/admin/users')
      ]);
      const assigns = assignRes.ok ? await assignRes.json() : [];
      const usrs = usersRes.ok ? await usersRes.json() : [];
      setSectionAssignments(Array.isArray(assigns) ? assigns : []);
      setAdminUsersList(Array.isArray(usrs) ? usrs : []);
      if (!assignUserId && usrs.length) setAssignUserId(usrs[0].id);
    } catch(e){}
    finally { setLoading(false); }
  };

  const assignSectionTask = async () => {
    if (!assignUserId || !assignSection || !assignRole) return;
    const u = adminUsersList.find(x => x.id === assignUserId);
    try {
      await fetch('/api/admin/section-assignments', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          userId: assignUserId,
          userName: u?.name || 'Usuario',
          moduleName: assignModule,
          sectionName: assignSection,
          role: assignRole,
          assignedBy: 'admin-general'
        })
      });
      await loadAssignments();
    } catch(e){}
  };

  const removeAssignment = async (id) => {
    if (!confirm('Quitar asignación?')) return;
    await fetch(`/api/admin/section-assignments?id=${id}`, {method:'DELETE'});
    await loadAssignments();
  };

  const saveClientePrecio = async (customerId, caliber, price) => {
    try {
      await fetch('/api/customers/prices', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ customerId, weekStartDate: new Date().toISOString().slice(0,10), caliber, pricePerKg: price })
      });
      await loadClientes();
    } catch(e){}
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/global-search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
      setActiveTab("busqueda");
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorization = async (id, action) => {
    if (!confirm(`¿Confirmar ${action === "aprobar" ? "aprobación" : "rechazo"}?`)) return;

    try {
      const res = await fetch("/api/admin/authorizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          reviewedBy: "admin",
          reviewNotes: `${action === "aprobar" ? "Aprobado" : "Rechazado"} desde Administración General`
        })
      });

      if (res.ok) {
        alert(`Solicitud ${action === "aprobar" ? "aprobada" : "rechazada"} exitosamente`);
        loadAuthorizations();
      }
    } catch (error) {
      console.error("Error handling authorization:", error);
      alert("Error al procesar la solicitud");
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resolvedBy: "admin",
          resolutionNotes: "Resuelta desde Administración General"
        })
      });

      if (res.ok) {
        alert("Alerta resuelta exitosamente");
        loadAlerts();
      }
    } catch (error) {
      console.error("Error resolving alert:", error);
      alert("Error al resolver la alerta");
    }
  };

  const generateReport = async (reportType) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/admin/reports?generate=true&reportType=${reportType}&startDate=${today}&endDate=${today}`);
      const data = await res.json();
      
      if (res.ok) {
        alert("Reporte generado exitosamente");
        // Aquí podrías descargar o mostrar el reporte
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Administración General
          </h1>
          <p className="text-gray-600">
            Centro de control maestro del sistema
          </p>
        </div>

        {/* Barra de búsqueda global */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Búsqueda global en el sistema..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "autorizaciones", label: "Autorizaciones", icon: CheckCircle },
              { id: "alertas", label: "Alertas", icon: Bell },
              { id: "bitacora", label: "Bitácora", icon: FileText },
              { id: "reportes", label: "Reportes", icon: TrendingUp },
              { id: "cierres", label: "Cierres Semanales", icon: Calendar },
              { id: "clientes", label: "Clientes & Precios Semanales", icon: Users },
              { id: "asignaciones", label: "Secciones y Asignaciones", icon: Users }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido según tab activo */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Dashboard */}
        {activeTab === "dashboard" && dashboardData && !loading && (
          <div>
            {/* Selector de período */}
            <div className="mb-6 flex gap-2">
              {[
                { value: "today", label: "Hoy" },
                { value: "week", label: "Semana" },
                { value: "month", label: "Mes" }
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    period === p.value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Indicadores principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Ventas Totales</span>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardData.sales.totalSales.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {dashboardData.sales.totalLoads} cargas
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Por Cobrar</span>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardData.accounts.receivable.toLocaleString()}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Por Pagar</span>
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardData.accounts.payable.toLocaleString()}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm font-medium">Gastos</span>
                  <DollarSign className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardData.expenses.total.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Indicadores secundarios */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-gray-600">Autorizaciones</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardData.authorizations.pending}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-gray-600">Alertas Críticas</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardData.alerts.critical}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">Viajes Activos</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardData.trips.active}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">Lotes Activos</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardData.lots.active}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">Nómina</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  ${dashboardData.payroll.total.toLocaleString()}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-gray-600">Cierres</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {dashboardData.closings.pending}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Autorizaciones */}
        {activeTab === "autorizaciones" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Solicitudes Pendientes de Autorización
            </h2>
            
            {authorizations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay solicitudes pendientes
              </p>
            ) : (
              <div className="space-y-4">
                {authorizations.map((auth) => (
                  <div
                    key={auth.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{auth.title}</h3>
                        <p className="text-sm text-gray-600">{auth.description}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          auth.priority === "alta"
                            ? "bg-red-100 text-red-700"
                            : auth.priority === "media"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {auth.priority.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">{auth.module}</span> • {auth.request_type}
                        {auth.amount && ` • $${parseFloat(auth.amount).toLocaleString()}`}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAuthorization(auth.id, "rechazar")}
                          className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition text-sm font-medium"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleAuthorization(auth.id, "aprobar")}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                        >
                          Aprobar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alertas */}
        {activeTab === "alertas" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Alertas del Sistema</h2>
            
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay alertas activas</p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border-l-4 rounded-lg p-4 ${
                      alert.priority === "alta"
                        ? "border-red-500 bg-red-50"
                        : alert.priority === "media"
                        ? "border-yellow-500 bg-yellow-50"
                        : "border-gray-500 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                        <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {alert.module} • {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bitácora */}
        {activeTab === "bitacora" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bitácora del Sistema</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Módulo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Descripción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{log.user_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.module}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reportes */}
        {activeTab === "reportes" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Reportería Ejecutiva</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { type: "ventas", label: "Reporte de Ventas", icon: DollarSign, color: "blue" },
                { type: "utilidades", label: "Reporte de Utilidades", icon: TrendingUp, color: "green" },
                { type: "gastos", label: "Reporte de Gastos", icon: TrendingDown, color: "red" },
                { type: "flujo_efectivo", label: "Flujo de Efectivo", icon: DollarSign, color: "purple" },
                { type: "productividad", label: "Productividad", icon: Package, color: "orange" }
              ].map((report) => (
                <button
                  key={report.type}
                  onClick={() => generateReport(report.type)}
                  className={`p-6 border-2 border-${report.color}-200 rounded-lg hover:bg-${report.color}-50 transition text-left`}
                >
                  <report.icon className={`w-8 h-8 text-${report.color}-600 mb-3`} />
                  <h3 className="font-semibold text-gray-900 mb-2">{report.label}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Generar reporte del día de hoy
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <Download className="w-4 h-4" />
                    Generar
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cierres Semanales */}
        {activeTab === "cierres" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Cierres Semanales (Exclusivo Administración)
            </h2>
            <p className="text-gray-600 mb-6">
              Vista exclusiva de cierres semanales. Desde aquí se pueden aprobar, rechazar o reabrir cierres.
            </p>
            <div className="text-center py-8 text-gray-500">
              Funcionalidad de cierres semanales disponible aquí
            </div>
          </div>
        )}

        {/* CLIENTES + PRECIOS SEMANALES - Integrado unificado */}
        {activeTab === "clientes" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Clientes • Precios de la Semana</h2>
            <p className="text-sm text-gray-500 mb-4">Edita aquí los precios por cliente esta semana. Los valores se enlazan automáticamente a la Nota de Venta en Embarques cuando seleccionas cliente.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Cliente</th>
                    <th className="text-left p-2">Destino</th>
                    <th className="p-2">Precio/kilo Super</th>
                    <th className="p-2">Extra</th>
                    <th className="p-2">Primera</th>
                    <th className="p-2">Mediano</th>
                    <th className="p-2">Guardar</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => {
                    const cps = clientePrecios[c.id] || [];
                    const getP = cal => (cps.find(p => (p.caliber||'').toLowerCase().includes(cal)) || {}).price_per_kg || '';
                    return (
                      <tr key={c.id} className="border-b">
                        <td className="p-2 font-medium">{c.customer_name}</td>
                        <td className="p-2 text-xs text-gray-600">{c.destination || '—'}</td>
                        {['super','extra','primera','mediano'].map((cal, i) => (
                          <td key={i} className="p-2">
                            <input type="number" step="0.01" defaultValue={getP(cal)} className="w-20 border px-1 py-1 rounded text-sm" 
                              onBlur={e => saveClientePrecio(c.id, cal, parseFloat(e.target.value)||0)} />
                          </td>
                        ))}
                        <td className="p-2">
                          <button onClick={() => alert('Precios actualizados para enlazar en Nota de Venta')} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs">Aplicar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-gray-500">Los precios aquí se sincronizan de inmediato con el módulo de Embarques (en la Nota de Venta se autocompletan por calibre).</div>
          </div>
        )}

        {/* General Admin: Dividir secciones de módulos y asignar tareas con RBAC (dentro del grupo) */}
        {activeTab === "asignaciones" && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Gestión de Secciones y Asignaciones de Tareas</h2>
            <p className="text-sm text-gray-500 mb-4">Divide secciones del módulo Gastos y asigna roles a usuarios del grupo de Administración General. Los permisos se aplican con control de acceso basado en roles (RBAC) en el módulo.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asignar */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Asignar Tarea / Sección</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600">Sección del módulo Gastos</label>
                    <select value={assignSection} onChange={e=>setAssignSection(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                      {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Usuario (Grupo Admin)</label>
                    <select value={assignUserId} onChange={e=>setAssignUserId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                      {adminUsersList.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.admin_role || 'admin'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Rol</label>
                    <select value={assignRole} onChange={e=>setAssignRole(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                      <option value="capturista">Capturista (registro)</option>
                      <option value="aprobador">Aprobador (2do nivel)</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="lectura">Solo Lectura</option>
                    </select>
                  </div>
                  <button onClick={assignSectionTask} className="w-full px-4 py-2 bg-emerald-600 text-white rounded text-sm">Asignar Sección / Tarea</button>
                </div>
              </div>

              {/* Lista actual */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Asignaciones Activas (Gastos)</h3>
                {sectionAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin asignaciones aún. Crea algunas para controlar acceso por sección.</p>
                ) : (
                  <div className="space-y-2 text-sm max-h-80 overflow-auto">
                    {sectionAssignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div>
                          <span className="font-medium">{a.user_name}</span> → <span className="text-blue-600">{a.section_name}</span> <span className="text-xs bg-gray-200 px-1 rounded">{a.role}</span>
                        </div>
                        <button onClick={() => removeAssignment(a.id)} className="text-red-500 text-xs">Quitar</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500">Estas asignaciones controlan visibilidad de secciones y botones de aprobación/registro en el módulo de Gastos.</div>
              </div>
            </div>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {activeTab === "busqueda" && searchResults && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Resultados de búsqueda: "{searchResults.query}"
            </h2>
            <p className="text-gray-600 mb-6">
              {searchResults.totalResults} resultados encontrados
            </p>

            <div className="space-y-6">
              {Object.entries(searchResults.results).map(([module, items]) => (
                items.length > 0 && (
                  <div key={module}>
                    <h3 className="font-semibold text-gray-900 mb-3 capitalize">
                      {module.replace(/_/g, ' ')} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                        >
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(item, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
