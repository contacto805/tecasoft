'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ConfiguracionesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('menu');
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Color settings
  const [colors, setColors] = useState({
    primary_color: '#0E4A22',
    secondary_color: '#963821',
    accent_color: '#E0DA62',
    bg_color: '#ffffff',
    text_color: '#0A3020',
    border_color: '#E0DA62'
  });

  // Typography
  const [typography, setTypography] = useState({
    title_font: 'system-ui',
    body_font: 'system-ui'
  });
  const [customFonts, setCustomFonts] = useState([]);
  const [fontUploadFile, setFontUploadFile] = useState(null);
  const [fontUploadName, setFontUploadName] = useState('');

  // General info
  const [general, setGeneral] = useState({
    company_name: 'Tecavo Fruits',
    company_address: 'Km 4.5 Carretera Tacámbaro-Pátzcuaro, El Testerazo, Tacámbaro, Michoacán',
    phone: ''
  });

  // Menu edit states
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddModule, setShowAddModule] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleRoute, setNewModuleRoute] = useState('');
  const [newModuleIcon, setNewModuleIcon] = useState('ph-gear');

  // Horarios y Asistencia - editable schedules (central source of truth)
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [attendanceConfig, setAttendanceConfig] = useState({ UN_SOLO_DESCUENTO_DIARIO: 'true', DEFAULT_SCHEDULE_FIJO_COMPLETO: '1' });

  // Facturación / Senhub integration config (central)
  const [senhub, setSenhub] = useState({ email: '', access_token: '', refresh_token: '', connected: false });
  const [senhubOtpCode, setSenhubOtpCode] = useState('');
  const [senhubLoading, setSenhubLoading] = useState(false);

  // Impresoras del sistema (las mismas que usa la computadora local)
  const [printers, setPrinters] = useState([]);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [printerForm, setPrinterForm] = useState({ printer_name: '', printer_type: 'Oficina', is_default: false, is_active: true });

  const baseFontOptions = [
    { value: 'system-ui', label: 'Sistema (Default)' },
    { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: '"Roboto", sans-serif', label: 'Roboto' },
    { value: '"Open Sans", sans-serif', label: 'Open Sans' },
    { value: 'serif', label: 'Serif' }
  ];



  useEffect(() => {
    fetchMenu();
    fetchConfig();
    fetchSchedules();
    fetchSenhub();
    fetchPrinters();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu?includeAll=true', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMenu(data);
      } else {
        console.error('fetchMenu failed status:', res.status);
      }
    } catch (e) {
      console.error('fetchMenu error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      // Colors
      const cs = await fetch('/api/color-schemes');
      if (cs.ok) {
        const schemes = await cs.json().catch(() => []);
        const dash = (schemes || []).find(s => s.module_name === 'dashboard' || s.module_name === 'branding');
        if (dash) {
          setColors({
            primary_color: dash.primary_color || '#0E4A22',
            secondary_color: dash.secondary_color || '#963821',
            accent_color: dash.accent_color || '#E0DA62',
            bg_color: dash.bg_color || '#ffffff',
            text_color: dash.text_color || '#0A3020',
            border_color: dash.border_color || '#E0DA62'
          });
        }
      }

      // Settings + branding
      const s = await fetch('/api/settings');
      if (s.ok) {
        const settings = await s.json();
        setTypography({
          title_font: settings.title_font || settings.font_title || 'system-ui',
          body_font: settings.body_font || settings.font_body || 'system-ui'
        });
        setGeneral(g => ({
          ...g,
          company_name: settings.company_name || 'Tecavo Fruits',
          company_address: settings.company_address || 'Km 4.5 Carretera Tacámbaro-Pátzcuaro, El Testerazo, Tacámbaro, Michoacán'
        }));
      }

      const branding = await fetch('/api/branding');
      if (branding.ok) {
        const b = await branding.json();
        const loadedCustom = Array.isArray(b.custom_fonts) ? b.custom_fonts : (typeof b.custom_fonts === 'string' ? JSON.parse(b.custom_fonts || '[]') : []);
        setCustomFonts(loadedCustom);
        setTypography({
          title_font: b.heading_font_family || b.font_family || settings.title_font || settings.font_title || 'system-ui',
          body_font: b.body_font_family || b.font_family || settings.body_font || settings.font_body || 'system-ui'
        });
        setGeneral(g => ({
          ...g,
          company_name: b.company_name || g.company_name,
          phone: b.phone || ''
        }));
      }
    } catch (e) { }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/attendance/schedules?includeConfig=1');
      if (res.ok) {
        const data = await res.json();
        if (data.schedules) {
          setSchedules(data.schedules);
          if (data.configs && Array.isArray(data.configs)) {
            const cfgMap = {};
            data.configs.forEach(c => { cfgMap[c.config_key] = c.config_value; });
            setAttendanceConfig(prev => ({ ...prev, ...cfgMap }));
          }
        } else if (Array.isArray(data)) {
          setSchedules(data);
        }
      }
    } catch (e) {}
  };

  const fetchSenhub = async () => {
    try {
      const s = await fetch('/api/settings');
      if (s.ok) {
        const settings = await s.json();
        setSenhub({
          email: settings.senhub_email || '',
          access_token: settings.senhub_access_token || '',
          refresh_token: settings.senhub_refresh_token || '',
          connected: !!(settings.senhub_access_token || settings.senhub_email)
        });
      }
    } catch (e) {}
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printer-settings');
      if (res.ok) setPrinters(await res.json());
    } catch (e) {}
  };

  // MENU MANAGEMENT
  const getActiveGroups = () => menu.filter(g => g.is_active);

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'add-group', groupName: newGroupName.trim(), groupOrder: menu.length + 1 })
      });
      if (response.ok) {
        setNewGroupName('');
        setShowAddGroup(false);
        await fetchMenu();
        alert('Grupo creado exitosamente');
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Group create failed:', err, 'status:', response.status);
        alert(err.error || 'Error al crear el grupo');
      }
    } catch (error) {
      console.error('Group create error:', error);
      alert('Error al crear el grupo');
    } finally { setSaving(false); }
  };

  const handleAddModule = async () => {
    if (!showAddModule || !newModuleName.trim() || !newModuleRoute.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-module',
          groupId: showAddModule,
          moduleName: newModuleName.trim(),
          moduleRoute: newModuleRoute.trim(),
          moduleIcon: newModuleIcon || 'ph-gear'
        })
      });
      setNewModuleName('');
      setNewModuleRoute('');
      setNewModuleIcon('ph-gear');
      setShowAddModule(null);
      await fetchMenu();
    } finally { setSaving(false); }
  };

  const saveGroup = async (group) => {
    setSaving(true);
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          groupName: group.group_name,
          isActive: group.is_active
        })
      });
      setEditingGroup(null);
      await fetchMenu();
    } finally { setSaving(false); }
  };

  const saveModule = async (mod) => {
    setSaving(true);
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: mod.id,
          moduleName: mod.module_name,
          moduleRoute: mod.module_route,
          moduleIcon: mod.module_icon
        })
      });
      setEditingModule(null);
      await fetchMenu();
    } finally { setSaving(false); }
  };

  const toggleGroup = async (group, active) => {
    await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-group', groupId: group.id, isActive: active })
    });
    await fetchMenu();
  };

  const toggleModule = async (mod, active) => {
    await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-module', moduleId: mod.id, isActive: active })
    });
    await fetchMenu();
  };

  const moveGroup = async (groupId, direction) => {
    await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move-group', groupId, direction })
    });
    await fetchMenu();
  };

  const moveModule = async (moduleId, direction) => {
    await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move-module', moduleId, direction })
    });
    await fetchMenu();
  };

  const deleteGroup = async (groupId) => {
    if (!confirm('¿Desactivar esta pestaña y todos sus módulos?')) return;
    await fetch('/api/menu', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
    await fetchMenu();
  };

  const deleteModule = async (moduleId) => {
    if (!confirm('¿Desactivar este módulo?')) return;
    await fetch('/api/menu', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId })
    });
    await fetchMenu();
  };

  // HORARIOS Y ASISTENCIA - central management (changes propagate to attendance calc, payroll, etc.)
  const startEditSchedule = (sch) => {
    setEditingSchedule({ ...sch });
  };

  const cancelEditSchedule = () => {
    setEditingSchedule(null);
  };

  const updateEditingSchedule = (field, value) => {
    setEditingSchedule(prev => ({ ...prev, [field]: value }));
  };

  const saveSchedule = async () => {
    if (!editingSchedule || !editingSchedule.name) return;
    setSavingSchedule(true);
    try {
      const isNew = !editingSchedule.id;
      const method = isNew ? 'POST' : 'PUT';
      const body = isNew ? editingSchedule : { id: editingSchedule.id, ...editingSchedule };

      const res = await fetch('/api/attendance/schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        await fetchSchedules();
        setEditingSchedule(null);
        alert('Horario guardado. Los cambios se reflejan en el cálculo de asistencia, descuentos y nómina.');
      } else {
        const err = await res.json().catch(()=>({}));
        alert(err.error || 'Error al guardar horario');
      }
    } catch (e) {
      alert('Error al guardar');
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleScheduleActive = async (sch) => {
    await fetch('/api/attendance/schedules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sch.id, is_active: !sch.is_active })
    });
    await fetchSchedules();
  };

  const saveAttendanceConfig = async (key, value) => {
    try {
      // Persist via settings (central) + also ensure attendance_config table
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      // Direct update attendance_config for engine
      await fetch('/api/attendance/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configUpdate: { key, value } })
      }).catch(()=>{});
      setAttendanceConfig(prev => ({ ...prev, [key]: value }));
      alert('Configuración actualizada. Se aplicará en próximos cálculos de asistencia.');
    } catch(e){ alert('Guardado localmente (refresca si no ves efecto)'); }
  };

  // SENHUB FACTURACIÓN - real API link (tokens stored centrally in system_settings)
  const senhubRequestOtp = async () => {
    if (!senhub.email) { alert('Ingresa el email de la cuenta Senhub'); return; }
    setSenhubLoading(true);
    try {
      const res = await fetch('/api/facturacion/senhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', email: senhub.email })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Código OTP enviado al email de Senhub. Ingresa el código abajo.');
      } else {
        alert(data.error || 'Error al solicitar OTP');
      }
    } catch (e) { alert('Error de conexión'); }
    finally { setSenhubLoading(false); }
  };

  const senhubVerifyOtp = async () => {
    if (!senhub.email || !senhubOtpCode) { alert('Email y código requeridos'); return; }
    setSenhubLoading(true);
    try {
      const res = await fetch('/api/facturacion/senhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', email: senhub.email, code: senhubOtpCode })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senhub_email: senhub.email,
            senhub_access_token: data.access_token,
            senhub_refresh_token: data.refresh_token || ''
          })
        });
        await fetchSenhub();
        setSenhubOtpCode('');
        alert('Conexión con Senhub establecida. Tokens guardados.');
      } else {
        alert(data.error || 'Código inválido');
      }
    } catch (e) { alert('Error al verificar'); }
    finally { setSenhubLoading(false); }
  };

  const senhubTest = async () => {
    setSenhubLoading(true);
    try {
      const res = await fetch('/api/facturacion/senhub?action=balance');
      const data = await res.json();
      alert(data.balance !== undefined ? `Saldo Senhub: ${data.balance} créditos` : 'Conexión OK');
    } catch (e) { alert('No se pudo consultar saldo'); }
    finally { setSenhubLoading(false); }
  };

  const saveSenhubAdvanced = async (field, value) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    await fetchSenhub();
  };

  const saveSenhubEmail = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhub_email: senhub.email })
    });
    alert('Email guardado');
  };

  // IMPRESORAS - nombres exactos de la computadora donde corre el sistema
  const startEditPrinter = (p = null) => {
    if (p) {
      setEditingPrinter(p);
      setPrinterForm({
        printer_name: p.printer_name || '',
        printer_type: p.printer_type || 'Oficina',
        is_default: !!p.is_default,
        is_active: p.is_active !== false
      });
    } else {
      setEditingPrinter(null);
      setPrinterForm({ printer_name: '', printer_type: 'Oficina', is_default: false, is_active: true });
    }
  };

  const savePrinter = async () => {
    if (!printerForm.printer_name.trim()) return;
    try {
      const method = editingPrinter ? 'PUT' : 'POST';
      const body = editingPrinter ? { ...printerForm, id: editingPrinter.id } : printerForm;
      await fetch('/api/printer-settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await fetchPrinters();
      setEditingPrinter(null);
      setPrinterForm({ printer_name: '', printer_type: 'Oficina', is_default: false, is_active: true });
    } catch {}
  };

  const deletePrinter = async (id) => {
    if (!confirm('¿Eliminar esta impresora?')) return;
    await fetch(`/api/printer-settings?id=${id}`, { method: 'DELETE' });
    await fetchPrinters();
  };

  const setDefaultPrinter = async (p) => {
    await fetch('/api/printer-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, is_default: true, id: p.id })
    });
    await fetchPrinters();
  };

  // COLORS
  const saveColors = async () => {
    setSaving(true);
    try {
      await fetch('/api/color-schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_name: 'dashboard', ...colors })
      });
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colors)
      });
      alert('✅ Colores actualizados');
    } catch { alert('Error'); }
    finally { setSaving(false); }
  };

  // TYPOGRAPHY + GENERAL
  const saveTypography = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_font: typography.title_font,
          body_font: typography.body_font,
          font_title: typography.title_font,
          font_body: typography.body_font,
          heading_font_family: typography.title_font,
          body_font_family: typography.body_font
        })
      });
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heading_font_family: typography.title_font,
          body_font_family: typography.body_font,
          font_family: typography.body_font,
          custom_fonts: customFonts
        })
      });
      alert('✅ Tipografía guardada y aplicada en todo el sistema');
    } finally { setSaving(false); }
  };

  const uploadCustomFont = async (file, name) => {
    if (!file || !name?.trim()) {
      alert('Selecciona un archivo de fuente y escribe un nombre');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Error al subir el archivo');
      }
      const newFont = { name: name.trim(), url: data.url, filename: file.name };
      const updated = [...(customFonts || []), newFont];
      setCustomFonts(updated);
      // Auto-select the new font for titles as convenience
      setTypography(prev => ({ ...prev, title_font: newFont.name }));
      alert('Tipografía subida correctamente. Selecciona el nombre en los menús y guarda para aplicarla.');
    } catch (e) {
      alert('Error subiendo tipografía: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const removeCustomFont = (idx) => {
    if (!confirm('¿Eliminar esta tipografía personalizada?')) return;
    const updated = customFonts.filter((_, i) => i !== idx);
    setCustomFonts(updated);
  };

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: general.company_name,
          company_address: general.company_address
        })
      });
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...general })
      });
      alert('✅ Información guardada');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-lg"><i className="ph ph-arrow-left" /></button>
            <div>
              <h1 className="font-bold text-xl">Configuraciones</h1>
              <p className="text-xs text-slate-500">Colores • Tipografía • Menú • Nombres</p>
            </div>
          </div>
          <div className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">Super Administrador</div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b mb-6">
          {[
            { id: 'menu', label: 'Pestañas y Módulos', icon: 'ph-list' },
            { id: 'colores', label: 'Colores', icon: 'ph-palette' },
            { id: 'tipografia', label: 'Tipografía', icon: 'ph-text-aa' },
            { id: 'general', label: 'Nombres del Sistema', icon: 'ph-buildings' },
            { id: 'horarios', label: 'Horarios y Asistencia', icon: 'ph-clock' },
            { id: 'facturacion', label: 'Facturación / Senhub', icon: 'ph-file-text' },
            { id: 'impresoras', label: 'Impresoras', icon: 'ph-printer' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === t.id ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              <i className={`ph ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>

        {/* MENU TAB */}
        {activeTab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-600">Administra las pestañas (grupos) y los módulos que aparecen en cada una.</p>
              <button onClick={() => setShowAddGroup(true)} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 flex gap-2 items-center">
                <i className="ph ph-plus" /> Agregar Pestaña
              </button>
            </div>

            {loading ? <div className="text-center py-16 text-slate-400">Cargando menú...</div> : (
              <div className="space-y-4">
                {getActiveGroups().map((g) => {
                  const gMods = (g.modules || []).filter(m => m);
                  return (
                    <div key={g.id} className="bg-white border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 bg-slate-50 border-b flex items-center gap-3">
                        <div className="flex-1 flex items-center gap-3">
                          {editingGroup?.id === g.id ? (
                            <input
                              value={editingGroup.group_name}
                              onChange={e => setEditingGroup({ ...editingGroup, group_name: e.target.value })}
                              className="font-semibold border px-2 py-1 rounded"
                            />
                          ) : (
                            <div className="font-semibold text-lg">{g.group_name}</div>
                          )}
                          <span className="text-xs bg-slate-200 px-2 rounded">orden {g.group_order}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button onClick={() => moveGroup(g.id, 'up')} className="px-2 py-1 hover:bg-slate-200 rounded"><i className="ph ph-arrow-up" /></button>
                          <button onClick={() => moveGroup(g.id, 'down')} className="px-2 py-1 hover:bg-slate-200 rounded"><i className="ph ph-arrow-down" /></button>
                          
                          <button onClick={() => setEditingGroup(g)} className="px-3 py-1 text-sm hover:bg-slate-100 rounded">Editar</button>
                          <button 
                            onClick={() => toggleGroup(g, !g.is_active)} 
                            className={`px-3 py-1 text-sm rounded ${g.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                          >{g.is_active ? 'Activo' : 'Inactivo'}</button>
                          <button onClick={() => setShowAddModule(g.id)} className="px-3 py-1 bg-emerald-600 text-white text-sm rounded flex items-center gap-1"><i className="ph ph-plus" /> Módulo</button>
                          <button onClick={() => deleteGroup(g.id)} className="px-3 py-1 text-red-600 hover:bg-red-50 rounded">Borrar</button>
                        </div>

                        {editingGroup?.id === g.id && (
                          <button onClick={() => saveGroup(editingGroup)} disabled={saving} className="px-4 py-1 ml-2 bg-emerald-600 text-white text-sm rounded">Guardar</button>
                        )}
                      </div>

                      {/* Modules in group */}
                      <div className="divide-y text-sm">
                        {gMods.length === 0 && <div className="px-5 py-3 text-slate-500">Sin módulos en esta pestaña.</div>}
                        {gMods.map(m => (
                          <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2">
                              <span className="inline-block w-5 h-5 text-center"><i className={`ph ${m.module_icon || 'ph-circle'}`} /></span>
                              {editingModule?.id === m.id ? (
                                <>
                                  <input value={editingModule.module_name} onChange={e => setEditingModule({ ...editingModule, module_name: e.target.value })} className="border px-2 rounded text-sm" />
                                  <input value={editingModule.module_route} onChange={e => setEditingModule({ ...editingModule, module_route: e.target.value })} className="border px-2 rounded text-sm w-44 font-mono" />
                                  <input value={editingModule.module_icon} onChange={e => setEditingModule({ ...editingModule, module_icon: e.target.value })} className="border px-2 rounded text-sm w-32" placeholder="ph-gear" />
                                </>
                              ) : (
                                <>
                                  <span className="font-medium">{m.module_name}</span>
                                  <span className="text-xs px-2 py-0.5 bg-slate-100 rounded font-mono">{m.module_route}</span>
                                  <span className="text-xs text-slate-400">icon: {m.module_icon}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button onClick={() => moveModule(m.id, 'up')}><i className="ph ph-arrow-up" /></button>
                              <button onClick={() => moveModule(m.id, 'down')}><i className="ph ph-arrow-down" /></button>
                              <button onClick={() => toggleModule(m, !m.is_active)} className={`px-2 text-xs ${m.is_active ? 'text-emerald-700' : 'text-amber-700'}`}>{m.is_active ? 'ON' : 'OFF'}</button>
                              <button onClick={() => setEditingModule(m)}>Editar</button>
                              <button onClick={() => deleteModule(m.id)} className="text-red-500 px-2">✕</button>
                            </div>

                            {editingModule?.id === m.id && (
                              <button onClick={() => saveModule(editingModule)} className="ml-3 px-3 py-1 bg-emerald-600 text-white text-xs rounded">Guardar</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inline Add Group Modal */}
            {showAddGroup && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddGroup(false)}>
                <div className="bg-white rounded-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-3">Nueva Pestaña</h3>
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nombre de la pestaña" className="w-full border px-3 py-2 rounded mb-3" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowAddGroup(false); setNewGroupName(''); }} className="px-4 py-2">Cancelar</button>
                    <button onClick={handleAddGroup} disabled={saving} className="px-5 py-2 bg-emerald-600 text-white rounded disabled:opacity-60">{saving ? 'Creando...' : 'Crear'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Add Module Modal */}
            {showAddModule && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModule(null)}>
                <div className="bg-white rounded-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
                  <h3 className="font-semibold mb-3">Agregar Módulo</h3>
                  <input value={newModuleName} onChange={e => setNewModuleName(e.target.value)} placeholder="Nombre del módulo" className="w-full border px-3 py-2 rounded mb-2" />
                  <input value={newModuleRoute} onChange={e => setNewModuleRoute(e.target.value)} placeholder="/ruta-del-modulo" className="w-full border px-3 py-2 rounded mb-2 font-mono" />
                  <input value={newModuleIcon} onChange={e => setNewModuleIcon(e.target.value)} placeholder="ph-gear" className="w-full border px-3 py-2 rounded mb-4" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddModule(null)} className="px-4 py-2">Cancelar</button>
                    <button onClick={handleAddModule} className="px-5 py-2 bg-emerald-600 text-white rounded">Agregar</button>
                  </div>
                  <p className="text-[10px] mt-3 text-slate-400">Icono: usa nombres como ph-house, ph-gear, ph-users, usa https://phosphoricons.com</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COLORES TAB */}
        {activeTab === 'colores' && (
          <div className="max-w-xl bg-white p-6 rounded-2xl border">
            <p className="mb-4 text-sm text-slate-600">Colores corporativos principales (se aplican en el sistema)</p>
            
            {['primary_color','secondary_color','accent_color','bg_color','text_color','border_color'].map(key => (
              <div key={key} className="mb-4 flex gap-3 items-center">
                <label className="w-40 text-sm capitalize">{key.replace(/_/g,' ')}</label>
                <input type="color" value={colors[key] || '#000000'} onChange={e=>setColors({...colors, [key]:e.target.value})} className="w-12 h-10 border rounded" />
                <input value={colors[key]} onChange={e=>setColors({...colors,[key]:e.target.value})} className="flex-1 border px-3 py-1 rounded font-mono text-xs" />
              </div>
            ))}

            <button onClick={saveColors} disabled={saving} className="mt-3 px-6 py-2 bg-emerald-600 text-white rounded-xl">Guardar Colores</button>
            
            <div className="mt-8 p-4 rounded" style={{background:colors.bg_color, color:colors.text_color, border:`1px solid ${colors.border_color}`}}>
              Vista previa rápida de colores
            </div>
          </div>
        )}

        {/* TIPOGRAFÍA TAB */}
        {activeTab === 'tipografia' && (
          <div className="max-w-xl bg-white p-6 border rounded-2xl">
            <div className="mb-4">
              <label className="block text-sm mb-2 font-medium">Fuente de Títulos</label>
              <select value={typography.title_font} onChange={e=>setTypography({...typography,title_font:e.target.value})} className="w-full border rounded px-3 py-2">
                {[...baseFontOptions, ...(customFonts || []).map(f => ({ value: f.name || f, label: `📁 Personalizada: ${f.name || f}` }))].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm mb-2 font-medium">Fuente del Cuerpo</label>
              <select value={typography.body_font} onChange={e=>setTypography({...typography,body_font:e.target.value})} className="w-full border rounded px-3 py-2">
                {[...baseFontOptions, ...(customFonts || []).map(f => ({ value: f.name || f, label: `📁 Personalizada: ${f.name || f}` }))].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div className="p-5 rounded bg-slate-50 border mb-5">
              <p style={{fontFamily: typography.title_font}} className="text-2xl mb-2">Título de ejemplo</p>
              <p style={{fontFamily: typography.body_font}} className="text-sm">Texto del cuerpo, ejemplo para ver la tipografía aplicada en párrafos.</p>
            </div>

            {/* Upload custom typography */}
            <div className="border-t pt-4 mt-2">
              <div className="font-semibold text-sm mb-1">Subir tipografía personalizada</div>
              <p className="text-xs text-slate-500 mb-3">Archivos soportados: .ttf, .otf, .woff, .woff2. El nombre que ingreses será la familia de fuente (ej: MiFuente). Se aplicará en todo el sistema después de guardar.</p>
              
              <div className="flex flex-wrap gap-2 items-end mb-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs block mb-1">Archivo de fuente</label>
                  <input 
                    type="file" 
                    accept=".ttf,.otf,.woff,.woff2" 
                    onChange={e => setFontUploadFile(e.target.files?.[0] || null)} 
                    className="text-sm w-full" 
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs block mb-1">Nombre de la fuente</label>
                  <input 
                    value={fontUploadName} 
                    onChange={e => setFontUploadName(e.target.value)} 
                    placeholder="MiFuente" 
                    className="border px-3 py-1.5 rounded text-sm w-full" 
                  />
                </div>
                <button 
                  onClick={() => {
                    if (fontUploadFile && fontUploadName) {
                      uploadCustomFont(fontUploadFile, fontUploadName);
                      setFontUploadFile(null);
                      setFontUploadName('');
                    }
                  }} 
                  disabled={!fontUploadFile || !fontUploadName || saving}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-sm disabled:opacity-50"
                >
                  Subir
                </button>
              </div>

              {customFonts && customFonts.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium mb-1">Tipografías personalizadas disponibles:</div>
                  <div className="space-y-1">
                    {customFonts.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 border rounded px-2 py-1">
                        <span className="font-medium flex-1">{f.name}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{f.filename || ''}</span>
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">ver</a>
                        <button onClick={() => removeCustomFont(idx)} className="text-red-500 px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveTypography} disabled={saving} className="mt-3 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm">Guardar Tipografía</button>
            <p className="text-[10px] text-slate-500 mt-2">Los cambios de tipografía se aplican en todo el sistema (usa la fuente personalizada donde se muestren títulos y textos).</p>
          </div>
        )}

        {/* NOMBRES TAB */}
        {activeTab === 'general' && (
          <div className="max-w-xl bg-white p-6 border rounded-2xl">
            <div className="mb-3">
              <label className="text-sm">Nombre de la empresa</label>
              <input value={general.company_name} onChange={e=>setGeneral({...general,company_name:e.target.value})} className="block w-full border rounded px-3 py-2 mt-1" />
            </div>
            <div className="mb-3">
              <label className="text-sm">Dirección</label>
              <textarea rows={3} value={general.company_address} onChange={e=>setGeneral({...general,company_address:e.target.value})} className="block w-full border rounded px-3 py-2 mt-1" />
            </div>
            <button onClick={saveGeneral} disabled={saving} className="mt-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm">Guardar Nombres</button>
          </div>
        )}

        {/* HORARIOS TAB */}
        {activeTab === 'horarios' && (
          <div className="bg-white border rounded-2xl p-6">
            <div className="mb-4">
              <div className="font-semibold text-lg">Horarios y Asistencia (fuente única)</div>
              <div className="text-xs text-slate-500">Los cambios aquí se aplican automáticamente al cálculo de asistencia, descuentos y nómina.</div>
            </div>

            {/* existing horarios content abbreviated for edit - keep as is but we insert after */}
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Configuración general</div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => saveAttendanceConfig('UN_SOLO_DESCUENTO_DIARIO', attendanceConfig.UN_SOLO_DESCUENTO_DIARIO === 'true' ? 'false' : 'true')} className="px-3 py-1.5 text-xs border rounded bg-white">
                    {attendanceConfig.UN_SOLO_DESCUENTO_DIARIO === 'true' ? '✓ Un solo descuento diario' : 'Múltiples descuentos'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Horarios configurados</div>
                  <button onClick={() => setEditingSchedule({ name: '', schedule_type: 'FIJO', jornada_type: 'COMPLETA', scheduled_entry: '07:00', scheduled_exit: '17:00', is_active: true })} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded">+ Nuevo horario</button>
                </div>

                <div className="space-y-2">
                  {schedules.map((sch) => (
                    <div key={sch.id} className="border rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{sch.name} <span className="text-xs text-slate-500">({sch.schedule_type} • {sch.jornada_type})</span></div>
                        <div className="text-xs text-slate-500">{sch.scheduled_entry} - {sch.scheduled_exit} {sch.meal_start ? `• Comida ${sch.meal_start}-${sch.meal_end}` : ''}</div>
                      </div>
                      <button onClick={() => startEditSchedule(sch)} className="px-3 py-1 text-xs border rounded">Editar</button>
                      <button onClick={() => toggleScheduleActive(sch)} className={`px-3 py-1 text-xs rounded ${sch.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>{sch.is_active ? 'Activo' : 'Inactivo'}</button>
                    </div>
                  ))}
                  {schedules.length === 0 && <div className="text-xs text-slate-500">Sin horarios aún. Crea uno para controlar asistencia.</div>}
                </div>
              </div>
            </div>

            {editingSchedule && (
              <div className="mt-4 border-t pt-4">
                <div className="font-medium mb-2">Editar / Crear horario</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input value={editingSchedule.name || ''} onChange={e=>updateEditingSchedule('name', e.target.value)} placeholder="Nombre" className="border px-3 py-2 rounded text-sm" />
                  <select value={editingSchedule.schedule_type || 'FIJO'} onChange={e=>updateEditingSchedule('schedule_type', e.target.value)} className="border px-3 py-2 rounded text-sm">
                    <option value="FIJO">FIJO</option>
                    <option value="FLEXIBLE">FLEXIBLE</option>
                  </select>
                  <select value={editingSchedule.jornada_type || 'COMPLETA'} onChange={e=>updateEditingSchedule('jornada_type', e.target.value)} className="border px-3 py-2 rounded text-sm">
                    <option value="COMPLETA">COMPLETA</option>
                    <option value="MEDIA">MEDIA</option>
                  </select>
                  <input value={editingSchedule.scheduled_entry || ''} onChange={e=>updateEditingSchedule('scheduled_entry', e.target.value)} placeholder="Entrada HH:MM" className="border px-3 py-2 rounded text-sm" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveSchedule} disabled={savingSchedule} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm">Guardar horario</button>
                  <button onClick={cancelEditSchedule} className="px-4 py-1.5 border rounded text-sm">Cancelar</button>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">Los cambios se reflejan inmediatamente en los cálculos de asistencia y descuentos.</div>
              </div>
            )}
          </div>
        )}

        {/* FACTURACIÓN / SENHUB TAB */}
        {activeTab === 'facturacion' && (
          <div className="bg-white border rounded-2xl p-6 space-y-6">
            <div>
              <div className="font-semibold text-lg">Facturación Electrónica — Enlace Senhub.mx</div>
              <div className="text-xs text-slate-500">Configura la integración con la API de Senhub para timbrar CFDI 4.0 reales desde el sistema (cartera, embarques y facturas). Una sola fuente de verdad.</div>
            </div>

            <div className="border rounded-xl p-4 bg-slate-50">
              <div className="font-medium mb-2">Credenciales Senhub (solo Superadmin)</div>
              <div className="text-xs mb-2 text-amber-600">MODO PRUEBAS (Sandbox) recomendado primero. Los CFDI en sandbox NO son fiscales.</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-600">Email de la cuenta Senhub</label>
                  <input value={senhub.email} onChange={e=>setSenhub({...senhub, email: e.target.value})} placeholder="facturacion@tuempresa.com" className="w-full border px-3 py-2 rounded mt-1 text-sm" />
                  <button onClick={saveSenhubEmail} className="mt-1 text-xs px-3 py-1 border rounded">Guardar email</button>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Ambiente</label>
                  <select onChange={(e) => saveSenhubAdvanced('senhub_sandbox', e.target.value === 'sandbox' ? 'true' : 'false')} className="w-full border px-3 py-2 rounded text-sm mt-1" defaultValue={senhub.sandbox ? 'sandbox' : 'prod'}>
                    <option value="sandbox">Sandbox (Pruebas - sin costo)</option>
                    <option value="prod">Producción (Timbre real SAT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 text-xs">
                <div>
                  <label>RFC Emisor</label>
                  <input placeholder="RFC emisor TECAVO" className="border w-full px-2 py-1 rounded" onBlur={(e)=>saveSenhubAdvanced('senhub_emisor_rfc', e.target.value)} />
                </div>
                <div>
                  <label>Nombre Emisor</label>
                  <input placeholder="TECAVO FRUITS SA DE CV" className="border w-full px-2 py-1 rounded" onBlur={(e)=>saveSenhubAdvanced('senhub_emisor_nombre', e.target.value)} />
                </div>
                <div>
                  <label>CP Lugar Expedición</label>
                  <input placeholder="60000" className="border w-full px-2 py-1 rounded" onBlur={(e)=>saveSenhubAdvanced('senhub_lugar_expedicion', e.target.value)} />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={senhubRequestOtp} disabled={senhubLoading || !senhub.email} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">Solicitar código OTP</button>
                <input value={senhubOtpCode} onChange={e=>setSenhubOtpCode(e.target.value)} placeholder="Código OTP (6 dígitos)" className="border px-3 py-2 rounded text-sm w-40" />
                <button onClick={senhubVerifyOtp} disabled={senhubLoading || !senhubOtpCode} className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50">Verificar y conectar</button>
                <button onClick={senhubTest} disabled={senhubLoading} className="px-4 py-2 border rounded text-sm">Probar saldo</button>
              </div>
              <div className="text-[10px] mt-2 text-slate-500">Tokens y configuración se guardan en backend. Idempotency-Key se genera por factura. Reutiliza la misma llave en reintentos para evitar doble timbrado.</div>
            </div>

            <div className="text-xs text-slate-600">
              Una vez conectado, usa el botón "Timbrar con Senhub" en Cartera → Facturas CFDI o en el módulo de Embarques para generar CFDI timbrados reales (UUID, PDF y XML se guardan automáticamente).
            </div>
          </div>
        )}

        {/* IMPRESORAS TAB */}
        {activeTab === 'impresoras' && (
          <div className="bg-white border rounded-2xl p-6">
            <div className="mb-4">
              <div className="font-semibold text-lg flex items-center gap-2"><i className="ph ph-printer" /> Impresoras del sistema</div>
              <div className="text-xs text-slate-500">Registra las impresoras instaladas en esta computadora. El nombre debe coincidir exactamente con el que aparece en el diálogo de impresión del sistema operativo.</div>
            </div>

            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              Estas serán las mismas impresoras que usa la computadora donde corre Soft Tecavo. Al imprimir documentos o tickets, selecciona una de esta lista en el diálogo del sistema.
            </div>

            <div className="flex justify-end mb-3">
              <button onClick={() => startEditPrinter()} className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-xl flex items-center gap-1"><i className="ph ph-plus" /> Agregar impresora</button>
            </div>

            <div className="space-y-2 mb-4">
              {printers.length === 0 && <div className="text-sm text-slate-500">Aún no hay impresoras registradas. Agrega las que usa esta computadora.</div>}
              {printers.map(p => (
                <div key={p.id} className="border rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {p.printer_name}
                      {p.is_default && <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Predeterminada</span>}
                    </div>
                    <div className="text-xs text-slate-500">{p.printer_type || 'Oficina'} • {p.is_active !== false ? 'Activa' : 'Inactiva'}</div>
                  </div>
                  <button onClick={() => setDefaultPrinter(p)} className="px-3 py-1 text-xs border rounded">Usar por defecto</button>
                  <button onClick={() => startEditPrinter(p)} className="px-3 py-1 text-xs border rounded">Editar</button>
                  <button onClick={() => deletePrinter(p.id)} className="px-2 py-1 text-xs text-red-600">Eliminar</button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mt-2">
              <div className="font-medium mb-2 text-sm">{editingPrinter ? 'Editar impresora' : 'Agregar nueva impresora'}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input 
                  value={printerForm.printer_name} 
                  onChange={e => setPrinterForm({...printerForm, printer_name: e.target.value})} 
                  placeholder="Nombre exacto como aparece en la computadora (ej: HP LaserJet Office)" 
                  className="border px-3 py-2 rounded text-sm" 
                />
                <select value={printerForm.printer_type} onChange={e=>setPrinterForm({...printerForm, printer_type: e.target.value})} className="border px-3 py-2 rounded text-sm">
                  <option value="Oficina">Oficina / A4</option>
                  <option value="Térmica 80mm">Térmica 80mm</option>
                  <option value="Térmica 58mm">Térmica 58mm</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={printerForm.is_default} onChange={e=>setPrinterForm({...printerForm, is_default: e.target.checked})} /> Predeterminada
                </label>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={savePrinter} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm">Guardar impresora</button>
                <button onClick={() => { setEditingPrinter(null); setPrinterForm({ printer_name: '', printer_type: 'Oficina', is_default: false, is_active: true }); }} className="px-4 py-1.5 border rounded text-sm">Limpiar</button>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">Ingresa el nombre tal cual lo muestra Windows / macOS / Linux en la lista de impresoras.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
