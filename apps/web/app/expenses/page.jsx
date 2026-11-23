'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FixedExpenses from '@/components/fixed-expenses';

const EXPENSE_TYPES = [
  { value: 'general', label: 'Gasto General' },
  { value: 'fruit_payment', label: 'Abono a Fruta' },
  { value: 'broker_commission', label: 'Abono a Comisión de Corredor' },
  { value: 'payroll_loan', label: 'Préstamo a Cuenta de Nómina' }
];

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterDepartment, setFilterDepartment] = useState('Todos');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Config editable: departamentos y conceptos
  const [departments, setDepartments] = useState([]);
  const [conceptsList, setConceptsList] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newConceptName, setNewConceptName] = useState('');
  const [editDeptId, setEditDeptId] = useState(null);
  const [editConceptId, setEditConceptId] = useState(null);

  // Listas de relaciones
  const [lots, setLots] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [formData, setFormData] = useState({
    productName: '',
    costPerUnit: '',
    quantity: '',
    total: '',
    department: 'Empaque',
    concept: '',
    notes: '',
    expenseDate: new Date().toISOString().split('T')[0],
    photoUrl: '',
    expenseType: 'general',
    relatedId: '',
    documentUrl: '',
    recipientName: ''
  });
  
  const [photoPreview, setPhotoPreview] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);
  const [ticketConfig, setTicketConfig] = useState({
    companyName: 'TECAVO FRUITS',
    address: '',
    phone: '',
    rfc: '',
    logoUrl: '',
    showDate: true,
    showTime: true,
    showFolio: true
  });
  const [showTicketEditor, setShowTicketEditor] = useState(false);

  // Two-level approval + RBAC from general admin group assignments
  const [currentUser, setCurrentUser] = useState(null);
  const [userAssignments, setUserAssignments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Todos'); // Todos | pendiente | aprobado | rechazado
  const [adminUsers, setAdminUsers] = useState([]); // for reference

  useEffect(() => {
    fetchExpenses();
    fetchRelatedData();
    loadConfigData();
  }, [filterDepartment, filterStartDate, filterEndDate, statusFilter]);

  // Carga inicial de configuración de departamentos y conceptos
  useEffect(() => {
    loadConfigData();
  }, []);

  // Load ticket config from global app config (empacadora data)
  useEffect(() => {
    const loadTicketConfig = async () => {
      try {
        const res = await fetch('/api/app-config');
        if (res.ok) {
          const cfg = await res.json();
          const c = cfg.company || {};
          setTicketConfig(prev => ({
            ...prev,
            companyName: c.name || prev.companyName,
            address: c.address || prev.address,
            phone: c.phone || prev.phone,
            rfc: c.rfc || prev.rfc,
            logoUrl: c.logo_url || prev.logoUrl
          }));
        }
      } catch (e) {}
    };
    loadTicketConfig();
  }, []);

  // Load current user and role-based section assignments (general admin group)
  useEffect(() => {
    const loadUserAndAssignments = async () => {
      try {
        const userRes = await fetch('/api/auth/user');
        if (userRes.ok) {
          const u = await userRes.json();
          if (!u.error) {
            setCurrentUser(u);
            // Load assignments for this user on gastos
            const assignRes = await fetch(`/api/admin/section-assignments?module=gastos&userId=${u.id}`);
            if (assignRes.ok) {
              const assigns = await assignRes.json();
              setUserAssignments(Array.isArray(assigns) ? assigns : []);
            }
          }
        }
        // Also load admin users for general admin assignment UI context
        const adminRes = await fetch('/api/admin/users');
        if (adminRes.ok) {
          const admins = await adminRes.json();
          setAdminUsers(Array.isArray(admins) ? admins : []);
        }
      } catch (e) {}
    };
    loadUserAndAssignments();
  }, []);

  const fetchRelatedData = async () => {
    try {
      const [lotsRes, brokersRes, empRes] = await Promise.all([
        fetch('/api/lots'),
        fetch('/api/brokers'),
        fetch('/api/employees')
      ]);

      if (lotsRes.ok) {
        const lotsData = await lotsRes.json();
        setLots(Array.isArray(lotsData) ? lotsData : []);
      }

      if (brokersRes.ok) {
        const brokersData = await brokersRes.json();
        setBrokers(Array.isArray(brokersData) ? brokersData : []);
      }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      }
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  const loadConfigData = async () => {
    try {
      const [areasRes, concRes] = await Promise.all([
        fetch('/api/expense-areas'),
        fetch('/api/expense-concepts')
      ]);
      if (areasRes.ok) {
        const areas = await areasRes.json();
        setDepartments(Array.isArray(areas) ? areas : []);
      }
      if (concRes.ok) {
        const concs = await concRes.json();
        setConceptsList(Array.isArray(concs) ? concs : []);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filterDepartment !== 'Todos') {
        params.append('department', filterDepartment);
      }
      if (filterStartDate) {
        params.append('startDate', filterStartDate);
      }
      if (filterEndDate) {
        params.append('endDate', filterEndDate);
      }
      if (statusFilter !== 'Todos') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/expenses?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Error al obtener gastos');
      }

      const data = await response.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar gastos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Gestores de Departamentos y Conceptos ---
  const addOrUpdateDept = async () => {
    if (!newDeptName.trim()) return;
    try {
      if (editDeptId) {
        await fetch('/api/expense-areas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editDeptId, area_name: newDeptName })
        });
      } else {
        await fetch('/api/expense-areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area_name: newDeptName })
        });
      }
      setNewDeptName('');
      setEditDeptId(null);
      await loadConfigData();
    } catch (e) { alert('Error al guardar depto'); }
  };

  const deleteDept = async (id) => {
    if (!confirm('Eliminar este departamento?')) return;
    await fetch(`/api/expense-areas?id=${id}`, { method: 'DELETE' });
    await loadConfigData();
  };

  const startEditDept = (area) => {
    setEditDeptId(area.id);
    setNewDeptName(area.area_name);
  };

  const addOrUpdateConcept = async () => {
    if (!newConceptName.trim()) return;
    try {
      if (editConceptId) {
        await fetch('/api/expense-concepts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editConceptId, concept_name: newConceptName })
        });
      } else {
        await fetch('/api/expense-concepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concept_name: newConceptName })
        });
      }
      setNewConceptName('');
      setEditConceptId(null);
      await loadConfigData();
    } catch (e) { alert('Error al guardar concepto'); }
  };

  const deleteConcept = async (id) => {
    if (!confirm('Eliminar este concepto?')) return;
    await fetch(`/api/expense-concepts?id=${id}`, { method: 'DELETE' });
    await loadConfigData();
  };

  const startEditConcept = (c) => {
    setEditConceptId(c.id);
    setNewConceptName(c.concept_name);
  };

  // RBAC helpers from general admin group assignments for gastos sections
  const canAccessSection = (section) => {
    if (!userAssignments || userAssignments.length === 0) return true; // no restrictions if none set
    return userAssignments.some(a => 
      a.section_name === section && 
      ['capturista', 'aprobador', 'supervisor', 'lectura'].includes(a.role || '')
    );
  };
  const isGeneralAdmin = currentUser && (currentUser.admin_role?.toLowerCase().includes('admin') || currentUser.is_super_admin);

  // Two-level approval: only second general admin (different from recorder) approves
  const handleApprove = async (expense) => {
    if (!currentUser?.name) {
      alert('No se pudo identificar el usuario actual');
      return;
    }
    if (expense.recorded_by === currentUser.name) {
      if (!confirm('El mismo usuario que registró no puede aprobar. ¿Continuar de todos modos?')) return;
    }
    if (!confirm('¿Aprobar este gasto como segundo administrador general?')) return;

    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expense.id, action: 'approve', approvedBy: currentUser.name })
      });
      if (!res.ok) throw new Error('Error al aprobar');
      await fetchExpenses();
      alert('Gasto aprobado exitosamente por segundo admin');
    } catch (e) {
      alert('Error al aprobar: ' + e.message);
    }
  };

  const handleReject = async (expense) => {
    const reason = prompt('Motivo de rechazo:');
    if (!reason) return;
    try {
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expense.id, action: 'reject', rejectionReason: reason })
      });
      if (res.ok) await fetchExpenses();
    } catch (e) { alert('Error al rechazar'); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate total
      if (name === 'costPerUnit' || name === 'quantity') {
        const cost = parseFloat(name === 'costPerUnit' ? value : updated.costPerUnit) || 0;
        const qty = parseFloat(name === 'quantity' ? value : updated.quantity) || 0;
        updated.total = (cost * qty).toFixed(2);
      }
      
      // Reset relatedId when expense type changes
      if (name === 'expenseType') {
        updated.relatedId = '';
      }
      
      return updated;
    });
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    try {
      setUploading(true);
      const formDataFile = new FormData();
      formDataFile.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataFile
      });
      
      const data = await response.json();
      if (data.url) {
        setFormData(prev => ({ ...prev, photoUrl: data.url }));
        setPhotoPreview(data.url);
        alert('Foto cargada exitosamente');
      } else {
        alert('Error al cargar la foto');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al cargar la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (file) => {
    if (!file) return;
    
    try {
      setUploadingDoc(true);
      const formDataFile = new FormData();
      formDataFile.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataFile
      });
      
      const data = await response.json();
      if (data.url) {
        setFormData(prev => ({ ...prev, documentUrl: data.url }));
        setDocumentPreview(data.url);
        alert('Documento cargado exitosamente');
      } else {
        alert('Error al cargar el documento');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error al cargar el documento');
    } finally {
      setUploadingDoc(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara. Por favor verifica los permisos.');
    }
  };

  const takePhoto = () => {
    if (cameraRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = cameraRef.current.videoWidth;
      canvas.height = cameraRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cameraRef.current, 0, 0);
      canvas.toBlob(blob => {
        handleFileUpload(blob);
        stopCamera();
      });
    }
  };

  const stopCamera = () => {
    if (cameraRef.current && cameraRef.current.srcObject) {
      cameraRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.productName || !formData.costPerUnit || !formData.quantity || !formData.department || !formData.recipientName) {
      alert('Por favor completa todos los campos requeridos (incluyendo Nombre de quien recibe el pago)');
      return;
    }

    if (formData.expenseType !== 'general' && !formData.relatedId) {
      alert('Por favor selecciona la cuenta relacionada');
      return;
    }

    try {
      const url = editingId ? '/api/expenses' : '/api/expenses';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: editingId,
          recordedBy: currentUser?.name || 'Admin',
          recipientName: formData.recipientName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar gasto');
      }

      const result = await response.json();

      await fetchExpenses();
      setShowForm(false);
      setEditingId(null);
      setPhotoPreview(null);
      setDocumentPreview(null);
      
      setFormData({
        productName: '',
        costPerUnit: '',
        quantity: '',
        total: '',
        department: 'Empaque',
        concept: '',
        notes: '',
        expenseDate: new Date().toISOString().split('T')[0],
        photoUrl: '',
        expenseType: 'general',
        relatedId: '',
        documentUrl: '',
        recipientName: ''
      });
      
      alert(editingId ? 'Gasto actualizado exitosamente' : 'Gasto registrado. Use el botón Ticket para imprimir el comprobante térmico 80mm.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setFormData({
      productName: expense.product_name,
      costPerUnit: expense.cost_per_unit,
      quantity: expense.quantity,
      total: expense.total,
      department: expense.department,
      concept: expense.concept || '',
      notes: expense.notes || '',
      expenseDate: expense.expense_date,
      photoUrl: expense.photo_url || '',
      expenseType: expense.expense_type || 'general',
      relatedId: expense.related_id || '',
      documentUrl: expense.document_url || '',
      recipientName: expense.recipient_name || expense.signature_confirmed_by || ''
    });
    setPhotoPreview(expense.photo_url || null);
    setDocumentPreview(expense.document_url || null);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar gasto');
      }

      await fetchExpenses();
      setDeleteConfirm(null);
      alert('Gasto eliminado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setPhotoPreview(null);
    setDocumentPreview(null);
    setShowCamera(false);
    stopCamera();
    setFormData({
      productName: '',
      costPerUnit: '',
      quantity: '',
      total: '',
      department: 'Empaque',
      concept: '',
      notes: '',
      expenseDate: new Date().toISOString().split('T')[0],
      photoUrl: '',
      expenseType: 'general',
      relatedId: '',
      documentUrl: '',
      recipientName: ''
    });
  };

  // Signature flow removed per requirements. Recipient name is captured in form and printed on thermal ticket.

  // Filter expenses by search text
  const filteredExpenses = expenses.filter(expense =>
    expense.product_name.toLowerCase().includes(searchText.toLowerCase()) ||
    expense.department.toLowerCase().includes(searchText.toLowerCase()) ||
    (expense.concept || '').toLowerCase().includes(searchText.toLowerCase()) ||
    expense.notes?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Calculate totals
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.total || 0), 0);
  const departmentTotals = {};
  filteredExpenses.forEach(e => {
    departmentTotals[e.department] = (departmentTotals[e.department] || 0) + parseFloat(e.total || 0);
  });

  const getExpenseTypeLabel = (type) => {
    const found = EXPENSE_TYPES.find(t => t.value === type);
    return found ? found.label : 'Gasto General';
  };

  const getRelatedOptions = () => {
    switch (formData.expenseType) {
      case 'fruit_payment':
        return lots.map(lot => ({ id: lot.id, name: `Lote ${lot.lot_number} - ${lot.producer}` }));
      case 'broker_commission':
        return brokers.map(broker => ({ id: broker.id, name: broker.broker_name }));
      case 'payroll_loan':
        return employees.map(emp => ({ 
          id: emp.employee_id || emp.id, 
          name: `${emp.employee_number || emp.employee_id || ''} — ${emp.employee_name}` 
        }));
      default:
        return [];
    }
  };

  // Print 80mm thermal ticket for expense - name of receiver + signature space
  const printThermalTicket = (expense) => {
    const recipient = expense.recipient_name || expense.signature_confirmed_by || '________________';
    const fecha = expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('es-MX') : '';
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const logoHtml = ticketConfig.logoUrl 
      ? `<img src="${ticketConfig.logoUrl}" style="max-height:40px;max-width:120px;margin:0 auto;display:block;" />` 
      : '';

    const html = `
      <html>
      <head>
        <title>Ticket Gasto ${expense.id}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: monospace; font-size: 11px; width: 80mm; margin: 0; padding: 4px; line-height: 1.3; color: #000; }
          .center { text-align: center; }
          .line { border-bottom: 1px dashed #000; margin: 4px 0; }
          .bold { font-weight: bold; }
          .small { font-size: 9px; }
          .row { display: flex; justify-content: space-between; }
          .sig-box { border: 1px solid #000; height: 50px; margin: 6px 0; text-align: center; line-height: 50px; }
        </style>
      </head>
      <body>
        <div class="center">${logoHtml}</div>
        <div class="center bold">${ticketConfig.companyName || 'EMPA CADORA'}</div>
        ${ticketConfig.address ? `<div class="center small">${ticketConfig.address}</div>` : ''}
        ${ticketConfig.phone ? `<div class="center small">Tel: ${ticketConfig.phone}</div>` : ''}
        ${ticketConfig.rfc ? `<div class="center small">RFC: ${ticketConfig.rfc}</div>` : ''}
        <div class="center bold" style="margin:6px 0;font-size:12px;">RECIBO DE GASTO / PAGO</div>
        <div class="line"></div>
        <div class="row"><span>Folio:</span><span>#${expense.id}</span></div>
        ${ticketConfig.showDate ? `<div class="row"><span>Fecha:</span><span>${fecha}</span></div>` : ''}
        ${ticketConfig.showTime ? `<div class="row"><span>Hora:</span><span>${hora}</span></div>` : ''}
        <div class="line"></div>
        <div><span class="bold">Concepto:</span> ${expense.product_name}</div>
        <div><span class="bold">Depto:</span> ${expense.department} ${expense.concept ? ' / ' + expense.concept : ''}</div>
        <div class="row"><span>Total:</span><span class="bold">$${parseFloat(expense.total || 0).toFixed(2)}</span></div>
        <div class="line"></div>
        <div><span class="bold">Recibe pago:</span></div>
        <div style="margin:4px 0 8px 0; border-bottom:1px solid #000; padding-bottom:2px;">${recipient}</div>
        <div class="bold" style="margin-top:8px;">Firma del receptor:</div>
        <div class="sig-box">____________________________</div>
        <div class="center small" style="margin-top:8px;">Este documento es comprobante de gasto.</div>
        <div class="center small">Impreso para impresora térmica 80mm</div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=300,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 300);
    } else {
      alert('Permita pop-ups para imprimir el ticket.');
    }
  };

  // Save ticket config (updates local + persists company info for tickets via branding if changed)
  const saveTicketConfig = async (newCfg) => {
    setTicketConfig(newCfg);
    // Persist key company fields to system for empacadora data (used globally too)
    try {
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: newCfg.companyName,
          address: newCfg.address,
          phone: newCfg.phone,
          rfc: newCfg.rfc,
          logo_url: newCfg.logoUrl
        })
      });
    } catch (e) {}
    setShowTicketEditor(false);
    alert('Configuración de ticket guardada');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Módulo de Gastos</h1>
            <p className="text-slate-500 mt-2">Registro y control de todos los gastos operativos</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin-general" className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-xl hover:bg-slate-800 flex items-center gap-1">Dashboard del Grupo</a>
            <button
              type="button"
              onClick={() => {
                setNewConceptName('');
                setEditConceptId(null);
                setShowConceptModal(true);
              }}
              className="px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow flex items-center gap-2 text-sm"
            >
              <i className="ph ph-pencil text-lg"></i>
              Editar Conceptos
            </button>
            <button
              type="button"
              onClick={() => setShowTicketEditor(true)}
              className="px-5 py-3 bg-slate-700 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow flex items-center gap-2 text-sm"
            >
              <i className="ph ph-printer text-lg"></i>
              Editar Ticket 80mm
            </button>
            {(canAccessSection('registro') || isGeneralAdmin) && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingId(null);
                  setPhotoPreview(null);
                  setDocumentPreview(null);
                  setShowCamera(false);
                  setFormData({
                    productName: '',
                    costPerUnit: '',
                    quantity: '',
                    total: '',
                    department: 'Empaque',
                    concept: '',
                    notes: '',
                    expenseDate: new Date().toISOString().split('T')[0],
                    photoUrl: '',
                    expenseType: 'general',
                    relatedId: '',
                    documentUrl: '',
                    recipientName: ''
                  });
                }}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 w-fit"
              >
                <i className="ph ph-plus-circle text-lg"></i>
                Agregar Gasto
              </button>
            )}
          </div>
        </div>

        {(canAccessSection('registro') || isGeneralAdmin) && <FixedExpenses editable={!!isGeneralAdmin} />}
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                <span>Departamento</span>
                <button type="button" onClick={() => { setNewDeptName(''); setEditDeptId(null); setShowDeptModal(true); }} className="text-[11px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Editar</button>
              </label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Todos">Todos</option>
                {departments.map(d => (
                  <option key={d.id} value={d.area_name}>{d.area_name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Desde</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Hasta</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Buscar</label>
              <input
                type="text"
                placeholder="Producto, departamento..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {/* Status tabs for two-level approval workflow */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            {['Todos', 'pendiente', 'aprobado', 'rechazado'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {s === 'Todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <div className="ml-auto text-xs text-slate-500 flex items-center">Aprobación de 2 niveles: primer admin registra (pendiente), segundo admin general aprueba</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 font-medium">Total de Gastos</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">${totalExpenses.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-2">{filteredExpenses.length} registros</p>
          </div>

          {Object.entries(departmentTotals).slice(0, 3).map(([dept, total]) => (
            <div key={dept} className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500 font-medium truncate">{dept}</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">${total.toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}
                </h2>
                <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
                  <i className="ph ph-x text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Tipo de Gasto */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Gasto *</label>
                  <select
                    name="expenseType"
                    value={formData.expenseType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {EXPENSE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cuenta Relacionada */}
                {formData.expenseType !== 'general' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {formData.expenseType === 'fruit_payment' && 'Lote de Fruta *'}
                      {formData.expenseType === 'broker_commission' && 'Corredor *'}
                      {formData.expenseType === 'payroll_loan' && 'Empleado *'}
                    </label>
                    <select
                      name="relatedId"
                      value={formData.relatedId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {getRelatedOptions().map(option => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Producto *</label>
                    <input
                      type="text"
                      name="productName"
                      value={formData.productName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nombre del producto"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between items-center">
                      <span>Departamento *</span>
                      <button type="button" onClick={() => { setNewDeptName(''); setEditDeptId(null); setShowDeptModal(true); }} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Editar</button>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.area_name}>{d.area_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between items-center">
                      <span>Concepto</span>
                      <button type="button" onClick={() => { setNewConceptName(''); setEditConceptId(null); setShowConceptModal(true); }} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Editar</button>
                    </label>
                    <select
                      name="concept"
                      value={formData.concept}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar...</option>
                      {conceptsList.map(c => (
                        <option key={c.id} value={c.concept_name}>{c.concept_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Costo Unitario *</label>
                    <input
                      type="number"
                      name="costPerUnit"
                      value={formData.costPerUnit}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad *</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Total</label>
                    <input
                      type="number"
                      name="total"
                      value={formData.total}
                      readOnly
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fecha</label>
                    <input
                      type="date"
                      name="expenseDate"
                      value={formData.expenseDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notas</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>

                {/* Nombre de quien recibe el pago - requerido para ticket */}
                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de quien recibe el pago <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="recipientName"
                    value={formData.recipientName || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nombre completo de la persona que recibe el pago"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Este nombre aparecerá en el ticket térmico 80mm junto con el espacio para firma.</p>
                </div>

                {/* Foto del Recibo / Ticket de Depósito / Comprobante */}
                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Foto del Recibo, Ticket de Depósito o Comprobante</label>
                  
                  {showCamera ? (
                    <div className="space-y-3">
                      <div className="bg-black rounded-lg overflow-hidden">
                        <video
                          ref={cameraRef}
                          autoPlay
                          playsInline
                          className="w-full h-64 object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={takePhoto}
                          disabled={uploading}
                          className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                        >
                          {uploading ? 'Cargando...' : 'Capturar Foto'}
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {photoPreview ? (
                        <div className="relative">
                          <img 
                            src={photoPreview} 
                            alt="Foto del gasto" 
                            className="w-full h-48 object-cover rounded-lg border border-slate-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoPreview(null);
                              setFormData(prev => ({ ...prev, photoUrl: '' }));
                            }}
                            className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                          >
                            <i className="ph ph-x text-lg"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
                          <i className="ph ph-image text-3xl text-slate-400 mb-2 block"></i>
                          <p className="text-slate-600 text-sm">No hay foto cargada</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <i className="ph ph-camera text-lg"></i>
                          Tomar Foto
                        </button>
                        
                        <label className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-2">
                          <i className="ph ph-upload text-lg"></i>
                          Subir Foto
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleFileUpload(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Documento PDF de Transferencia */}
                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-3">Comprobante (PDF / Imagen)</label>
                  
                  {documentPreview ? (
                    <div className="relative bg-slate-50 p-4 rounded-lg border border-slate-300">
                      <div className="flex items-center gap-3">
                        <i className="ph ph-file-pdf text-3xl text-red-600"></i>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">Documento cargado</p>
                          <a
                            href={documentPreview}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver documento
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentPreview(null);
                            setFormData(prev => ({ ...prev, documentUrl: '' }));
                          }}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <i className="ph ph-trash"></i>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block w-full px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                      <i className="ph ph-file-arrow-up text-3xl text-slate-400 mb-2 block"></i>
                      <p className="text-slate-600 text-sm font-medium mb-1">
                        {uploadingDoc ? 'Subiendo...' : 'Subir PDF o Imagen'}
                      </p>
                      <p className="text-slate-400 text-xs">Arrastra o haz clic para seleccionar</p>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleDocumentUpload(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                        disabled={uploadingDoc}
                      />
                    </label>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingId ? 'Actualizar' : 'Guardar'} Gasto
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmar eliminación</h3>
              <p className="text-slate-600 mb-6">¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Config Dept */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-lg">Configurar Departamentos</h3>
                <button onClick={() => { setShowDeptModal(false); setNewDeptName(''); setEditDeptId(null); }} className="text-xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <input value={newDeptName} onChange={e=>setNewDeptName(e.target.value)} placeholder="Nombre depto" className="flex-1 px-3 py-2 border rounded-lg" />
                  <button type="button" onClick={addOrUpdateDept} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{editDeptId ? 'Actualizar' : 'Agregar'}</button>
                </div>
                <div className="max-h-64 overflow-auto divide-y border rounded-lg">
                  {departments.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="text-black">{d.area_name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => startEditDept(d)} className="px-2 py-1 text-black hover:bg-slate-100 rounded"><i className="ph ph-pencil-simple text-base"></i></button>
                        <button onClick={() => deleteDept(d.id)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"><i className="ph ph-x text-base"></i></button>
                      </div>
                    </div>
                  ))}
                  {departments.length === 0 && <div className="p-3 text-sm text-slate-500">Sin departamentos</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Config Conceptos */}
        {showConceptModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-lg">Configurar Conceptos</h3>
                <button onClick={() => { setShowConceptModal(false); setNewConceptName(''); setEditConceptId(null); }} className="text-xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <input value={newConceptName} onChange={e=>setNewConceptName(e.target.value)} placeholder="Nombre de concepto" className="flex-1 px-3 py-2 border rounded-lg" />
                  <button type="button" onClick={addOrUpdateConcept} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{editConceptId ? 'Actualizar' : 'Agregar'}</button>
                </div>
                <div className="max-h-64 overflow-auto divide-y border rounded-lg">
                  {conceptsList.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="text-black">{c.concept_name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => startEditConcept(c)} className="px-2 py-1 text-black hover:bg-slate-100 rounded" title="Editar"><i className="ph ph-pencil-simple text-base"></i></button>
                        <button onClick={() => deleteConcept(c.id)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><i className="ph ph-x text-base"></i></button>
                      </div>
                    </div>
                  ))}
                  {conceptsList.length === 0 && <div className="p-3 text-sm text-slate-500">Sin conceptos</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Editor Modal (80mm thermal) */}
        {showTicketEditor && (
          <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Editar Ticket Térmico 80mm</h3>
                  <p className="text-xs text-slate-500">Configura logotipo y datos de la empacadora para los tickets de gasto</p>
                </div>
                <button onClick={() => setShowTicketEditor(false)} className="text-xl">×</button>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium mb-1">Logotipo</label>
                  <div className="flex gap-2">
                    <input value={ticketConfig.logoUrl} onChange={e => setTicketConfig({...ticketConfig, logoUrl: e.target.value})} className="flex-1 border rounded px-3 py-1.5" placeholder="URL del logo" />
                    <label className="cursor-pointer px-3 py-1.5 bg-slate-100 rounded text-xs flex items-center">Subir
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fd = new FormData(); fd.append('file', f);
                        const r = await fetch('/api/upload', {method:'POST', body: fd});
                        const d = await r.json();
                        if (d.url) setTicketConfig(prev => ({...prev, logoUrl: d.url}));
                      }} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Nombre de la Empacadora</label>
                  <input value={ticketConfig.companyName} onChange={e => setTicketConfig({...ticketConfig, companyName: e.target.value})} className="w-full border rounded px-3 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Dirección</label>
                  <input value={ticketConfig.address} onChange={e => setTicketConfig({...ticketConfig, address: e.target.value})} className="w-full border rounded px-3 py-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Teléfono</label>
                    <input value={ticketConfig.phone} onChange={e => setTicketConfig({...ticketConfig, phone: e.target.value})} className="w-full border rounded px-3 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">RFC</label>
                    <input value={ticketConfig.rfc} onChange={e => setTicketConfig({...ticketConfig, rfc: e.target.value})} className="w-full border rounded px-3 py-1.5" />
                  </div>
                </div>

                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ticketConfig.showDate} onChange={e=>setTicketConfig({...ticketConfig, showDate: e.target.checked})} /> Mostrar fecha</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ticketConfig.showTime} onChange={e=>setTicketConfig({...ticketConfig, showTime: e.target.checked})} /> Mostrar hora</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ticketConfig.showFolio} onChange={e=>setTicketConfig({...ticketConfig, showFolio: e.target.checked})} /> Mostrar folio</label>
                </div>

                <div className="pt-2 flex gap-2">
                  <button onClick={() => saveTicketConfig(ticketConfig)} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold">Guardar Configuración</button>
                  <button onClick={() => setShowTicketEditor(false)} className="flex-1 px-4 py-2 bg-slate-200 rounded-lg">Cancelar</button>
                </div>
                <p className="text-[10px] text-slate-500">El ticket incluye nombre del receptor + espacio para firma manual. Optimizado para impresoras térmicas 80mm.</p>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-500">Cargando gastos...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <i className="ph ph-package text-4xl text-slate-300 mb-3"></i>
              <p className="text-slate-500 text-lg">No hay gastos registrados</p>
              <p className="text-slate-400 text-sm mt-1">Comienza agregando un nuevo gasto</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Producto</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Tipo</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700">Costo</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700">Cantidad</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Departamento</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Concepto</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Fecha</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">Docs</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{expense.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{expense.product_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-2 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-700">
                          {getExpenseTypeLabel(expense.expense_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-slate-700">${parseFloat(expense.cost_per_unit).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-700">{parseFloat(expense.quantity).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-right text-slate-900">${parseFloat(expense.total).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {expense.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {expense.concept || '-'}
                        {expense.recipient_name || expense.signature_confirmed_by ? (
                          <div className="text-[10px] text-emerald-700 mt-0.5">Recibe: {expense.recipient_name || expense.signature_confirmed_by}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(expense.expense_date).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${expense.status === 'aprobado' ? 'bg-green-100 text-green-700' : expense.status === 'rechazado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {expense.status || 'pendiente'}
                        </span>
                        {expense.recorded_by && <div className="text-[10px] text-slate-400 mt-0.5">por {expense.recorded_by}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center justify-center gap-1">
                          {expense.photo_url && (
                            <a href={expense.photo_url} target="_blank" rel="noopener noreferrer">
                              <i className="ph ph-image text-green-600 text-lg" title="Foto"></i>
                            </a>
                          )}
                          {expense.document_url && (
                            <a href={expense.document_url} target="_blank" rel="noopener noreferrer">
                              <i className="ph ph-file-pdf text-red-600 text-lg" title="Documento"></i>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <i className="ph ph-pencil-simple text-lg"></i>
                          </button>
                          <button
                            onClick={() => printThermalTicket(expense)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Imprimir Ticket 80mm"
                          >
                            <i className="ph ph-printer text-lg"></i>
                          </button>
                          {(expense.status === 'pendiente' || !expense.status) && (canAccessSection('aprobacion') || isGeneralAdmin) && (
                            <>
                              <button onClick={() => handleApprove(expense)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Aprobar (2do admin)">✓</button>
                              <button onClick={() => handleReject(expense)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Rechazar">✗</button>
                            </>
                          )}
                          <button
                            onClick={() => setDeleteConfirm(expense.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <i className="ph ph-trash text-lg"></i>
                          </button>
                        </div>
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
