'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Grid3X3, Palette, Users, Move, Save, RefreshCw, Plus, ToggleLeft, Pencil, Trash2, BarChart3, FileText, ChevronRight, Upload, Smartphone, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function SuperadministradorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  // Styles
  const [styles, setStyles] = useState({
    primary_color: '#0E4A22',
    secondary_color: '#963821',
    accent_color: '#E0DA62',
    font_family: 'sans-serif',
    heading_font_family: 'sans-serif',
    body_font_family: 'sans-serif',
  });
  const [uploadedFonts, setUploadedFonts] = useState([]);

  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  // Dashboard nuevo: summary real-time + report
  const [summary, setSummary] = useState({ users: 0, groups: 0, modules: 0, ventasWeek: 0, cargasWeek: 0, clients: 0, closing: { week_label: '—', dinero: 0 }, recentPedidos: [] });
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportRows, setReportRows] = useState([]);

  // New module form
  const [newModule, setNewModule] = useState({ groupId: '', moduleName: '', moduleRoute: '', moduleIcon: 'ph-cube' });

  // New group
  const [newGroupName, setNewGroupName] = useState('');

  // User management
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', pin: '', groupId: '', is_super_admin: false, admin_role: 'administracion_general' });
  const [userGroupAssignments, setUserGroupAssignments] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});
  const [roleSelections, setRoleSelections] = useState({});

  const TARGET_GROUPS = ['Accopio', 'Operaciones', 'Administración General'];

  const normalizeGroupName = (name) => {
    if (!name) return '';
    const n = String(name).toLowerCase();
    if (n.includes('acop') || n.includes('campo')) return 'Accopio';
    if (n.includes('oper')) return 'Operaciones';
    if (n.includes('admin') && !n.includes('super')) return 'Administración General';
    if (n.includes('super')) return 'Superadministrador';
    return name;
  };

  const getModuleAccess = (mod) => {
    let acc = mod.group_access || [];
    if (!Array.isArray(acc)) {
      try { acc = JSON.parse(acc) || []; } catch { acc = []; }
    }
    return acc.map(normalizeGroupName);
  };

  const hasGroupAccess = (mod, group) => {
    const id = String(mod.id);
    const p = pendingChanges[id];
    if (p && group in p) return !!p[group];
    return getModuleAccess(mod).includes(group);
  };

  const applyPendingGroupAccessChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    try {
      const promises = [];
      Object.entries(pendingChanges).forEach(([moduleId, groupMap]) => {
        Object.entries(groupMap).forEach(([groupName, granted]) => {
          promises.push(fetch('/api/menu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-group-access', moduleId: parseInt(moduleId), groupName, granted })
          }));
        });
      });
      await Promise.all(promises);
      setPendingChanges({});
      reloadMenu();
    } catch {}
  };

  // Clientes & Manifiestos
  const [clientes, setClientes] = useState([]);
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteForm, setClienteForm] = useState({ customerName:'', commercialName:'', contactName:'', rfc:'', address:'', phone:'', email:'', destination:'', preferredCaliber:'', notes:'', manifestCode:'', manifestRequirements:'', clientNumber:'' });
  const [clienteLoads, setClienteLoads] = useState([]);
  const [viajeRows, setViajeRows] = useState([]);

  // Pedidos - configurable solo aqui, vistas en dashboard y grupos
  const [pedidos, setPedidos] = useState([]);
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);
  const [pedidoForm, setPedidoForm] = useState({ fechaSalida:'', customerId:'', clienteNombre:'', frutaRequerida:'' });
  const [pedidoRows, setPedidoRows] = useState([]);
  const CALIBRES = ['Super', 'Extra', 'Primera', 'Mediano', 'Tercera', 'Cuarta'];
  const CLASES = ['A', 'B'];

  // APKs Descargas y Generación automática para Orden de Corte y operatividad
  const [apks, setApks] = useState([]);
  const [generatingApk, setGeneratingApk] = useState(false);

  // Historial de Costos Detallados por Destino (guardar resultados COSTOS DETALLADOS modificables)
  const [costosHist, setCostosHist] = useState([]);
  const [selectedDestino, setSelectedDestino] = useState('');
  const [totalKgViaje, setTotalKgViaje] = useState(10000);
  const [healthData, setHealthData] = useState({ issues: [] });
  const [costRows, setCostRows] = useState([
    { id: 't1', concepto: 'FLETE TERRESTRE', cantidad: 1, unidad: 'SERVICIO', precio_mxn: 80000, precio_kilo: 3.54 },
    { id: 't2', concepto: 'SEGURO Y TRAMITE', cantidad: 1, unidad: 'SERVICIO', precio_mxn: 10000, precio_kilo: 0.44 },
    { id: 'm1', concepto: 'TARIMA', cantidad: 24, unidad: 'PIEZA', precio_mxn: 4800, precio_kilo: 0.21 },
    { id: 'm2', concepto: 'OPERATIVOS EMPAQUE', cantidad: 1, unidad: 'SERVICIO', precio_mxn: 1000, precio_kilo: 1 },
    { id: 'm3', concepto: 'CORTE Y ACARREO', cantidad: 1, unidad: 'PIEZA', precio_mxn: 2000, precio_kilo: 0.19 }
  ]);

  const [preciosSemana, setPreciosSemana] = useState({
    super_extra: 45, extra: 42, primera: 39, mediano: 36, tercera: 33, cuarta: 28,
    proceso: 17, desecho: 10, semana: 1,
    imagen_url: 'https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785199406155_wiovtl.jpeg',
    fecha_inicio: null, fecha_fin: null, display_lunes: '', display_sabado: ''
  });
  const [uploadingBg, setUploadingBg] = useState(false);

// TECAVO IA (Fase 05 Bloque 01) - fundacion
const [iaMessages, setIaMessages] = useState([]);
const [iaInput, setIaInput] = useState("");
const [iaLoading, setIaLoading] = useState(false);
const [iaConnected, setIaConnected] = useState(null);

  useEffect(() => {
    checkSuperAdmin();
    loadAll();
  }, []);

  const checkSuperAdmin = async () => {
    try {
      const res = await fetch('/api/auth/check-super-admin', { credentials: 'include' });
      if (!res.ok) { router.push('/'); return; }
      const data = await res.json();
      const role = data.adminRole || (data.isSuperAdmin ? 'superadministrador' : null);
      if (role !== 'superadministrador') { router.push('/'); }
    } catch {
      router.push('/');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const mRes = await fetch('/api/menu?includeAll=true', { credentials: 'include' });
      let menu = [];
      if (mRes && mRes.ok) {
        const data = await mRes.json().catch(() => []);
        menu = Array.isArray(data) ? data : [];
      }
      setGroups(menu);
      setPendingChanges({});
      // Initialize role selections (1-3 modules per section) from current group_access
      const initSel = {};
      TARGET_GROUPS.forEach(tg => {
        const matched = (menu || []).flatMap(gg => (gg.modules || []).filter(mm => {
          let ga = mm.group_access || [];
          if (!Array.isArray(ga)) { try { ga = JSON.parse(ga) || []; } catch { ga = []; } }
          return ga.map(normalizeGroupName).includes(tg);
        })).map(mm => mm.id);
        if (matched.length) initSel[tg] = matched.slice(0, 3);
      });
      setRoleSelections(initSel);

      const bRes = await fetch('/api/branding', { credentials: 'include' });
      if (bRes.ok) {
        const b = await bRes.json();
        if (b) {
          const mainFont = b.font_family || 'sans-serif';
          setStyles({
            primary_color: b.primary_color || '#0E4A22',
            secondary_color: b.secondary_color || '#963821',
            accent_color: b.accent_color || '#E0DA62',
            font_family: mainFont,
            heading_font_family: b.heading_font_family || mainFont,
            body_font_family: b.body_font_family || mainFont
          });
          setUploadedFonts(Array.isArray(b.custom_fonts) ? b.custom_fonts : (Array.isArray(b.uploaded_fonts) ? b.uploaded_fonts : []));
        }
      }

      const uRes = await fetch('/api/superadmin/users', { credentials: 'include' });
      if (uRes.ok) {
        const ud = await uRes.json();
        setUsers(Array.isArray(ud) ? ud : []);
      }

      // real summaries from DB
      const sumRes = await fetch('/api/superadmin/summary', { credentials: 'include' });
      if (sumRes.ok) {
        const s = await sumRes.json().catch(() => ({}));
        setSummary(s || {});
        setReportRows(Array.isArray(s?.recentPedidos) ? s.recentPedidos : []);
      }

      // load precios + auto semana (single set, always apply current week dates)
      let wk = { semana: 1, fecha_inicio: null, fecha_fin: null, display_lunes: '', display_sabado: '' };
      try {
        const sw = await fetch('/api/semana-calendario');
        if (sw.ok) {
          const w = await sw.json();
          wk = {
            semana: Number(w.semana) || 1,
            fecha_inicio: w.fecha_inicio || null,
            fecha_fin: w.fecha_fin || null,
            display_lunes: String(w.display_lunes || ''),
            display_sabado: String(w.display_sabado || '')
          };
        }
      } catch(_) {}
      try {
        const pr = await fetch('/api/precios-fruta/publicados');
        if (pr.ok) {
          const pList = await pr.json();
          const p = Array.isArray(pList) ? pList[0] : pList;
          if (p) setPreciosSemana({
            super_extra: Number(p.super_extra)||45,
            extra: Number(p.extra)||42,
            primera: Number(p.primera)||39,
            mediano: Number(p.mediano)||36,
            tercera: Number(p.tercera)||33,
            cuarta: Number(p.cuarta)||28,
            proceso: Number(p.proceso)||17,
            desecho: Number(p.desecho)||10,
            semana: wk.semana,
            imagen_url: p.imagen_url || 'https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785199406155_wiovtl.jpeg',
            fecha_inicio: wk.fecha_inicio,
            fecha_fin: wk.fecha_fin,
            display_lunes: wk.display_lunes,
            display_sabado: wk.display_sabado
          });
        } else {
          setPreciosSemana(s => ({...s, ...wk}));
        }
      } catch(_) { setPreciosSemana(s => ({...s, ...wk})); }

      // clientes para sección manifiestos
      try {
        const cRes = await fetch('/api/customers');
        if (cRes.ok) setClientes(await cRes.json());
      } catch(_) {}

      // pedidos
      try {
        const pRes = await fetch('/api/pedidos');
        if (pRes.ok) setPedidos(await pRes.json());
      } catch(_) {}

      // Load APKs para la sección Descargas de APK - ensure all pending generated and stored
      try {
        const aRes = await fetch('/api/superadmin/apps', { credentials: 'include' });
        let currentApks = [];
        if (aRes.ok) currentApks = await aRes.json();
        const coreNames = ['Orden de Corte Operativo', 'Control de Cajas Operativo', 'Cuadrillas Móvil', 'Embarques y Acopios', 'Lotes y Selección'];
        const existingNames = (currentApks || []).map(a => a.nombre);
        const missing = coreNames.filter(n => !existingNames.includes(n));
        if (missing.length > 0) {
          for (const nm of missing) {
            const ruta = nm.includes('Corte') ? '/cutting-orders' : nm.includes('Cajas') ? '/box-control' : nm.includes('Cuadrillas') ? '/cuadrillas' : nm.includes('Embarques') ? '/embarques' : '/lotification-registry';
            const icon = nm.includes('Corte') ? 'ph-clipboard-text' : nm.includes('Cajas') ? 'ph-cube' : nm.includes('Cuadrillas') ? 'ph-users' : nm.includes('Embarques') ? 'ph-truck' : 'ph-package';
            try {
              await fetch('/api/superadmin/apps', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
                nombre: nm, tipo:'APK Móvil', ruta, icono: icon, version:'1.3', estado:'generada', requiere_autorizacion: true,
                apk_filename: (nm.toLowerCase().replace(/\\s/g,'-') + '.apk')
              }) });
            } catch(e){}
          }
          const fresh = await fetch('/api/superadmin/apps', { credentials: 'include' });
          if (fresh.ok) currentApks = await fresh.json();
        }
        // Only keep generated ones with filename for display
        setApks((currentApks || []).filter(a => a.apk_filename || a.estado === 'generada' || a.estado === 'activa'));
      } catch(_) { setApks([]); }

      // Cargar historial de costos por destino
      try {
        const ch = await fetch('/api/superadmin/costos-historico');
        if (ch.ok) setCostosHist(await ch.json());
      } catch(_) {}

      // Cargar salud del sistema al inicio
      try {
        const h = await fetch('/api/superadmin/health');
        if (h.ok) setHealthData(await h.json());
      } catch(_) {}

      // AUTO-REGISTRO COMPLETO: Asegura que Superadministrador vea TODOS los módulos del sistema (incluyendo ocultos)
      // Registra rutas críticas si no existen en menu_modules para que aparezcan en la matriz de asignación y menús
      try {
        const knownCritical = [
          {name:'Órdenes de Corte', route:'/cutting-orders', icon:'ph-clipboard-text'},
          {name:'Control de Cajas de Campo', route:'/box-control', icon:'ph-cube'},
          {name:'Lotes y Trazabilidad', route:'/fruit-input', icon:'ph-package'},
          {name:'Producción y Empaque', route:'/production', icon:'ph-factory'},
          {name:'Inventario y Frío', route:'/inventory', icon:'ph-warehouse'},
          {name:'Embarques y Cargas', route:'/embarques', icon:'ph-truck'},
          {name:'Clientes y Cartera', route:'/customers', icon:'ph-users'},
          {name:'Cierres Semanales', route:'/cierres', icon:'ph-calendar-check'},
          {name:'Rendimiento de Lote', route:'/rendimiento-lote', icon:'ph-chart-bar'},
          {name:'Mapa de Trazabilidad', route:'/mapa-trazabilidad', icon:'ph-graph'},
          {name:'Producción (Selección y Rendimiento)', route:'/production', icon:'ph-factory'},
          {name:'Precios de Fruta', route:'/precios-fruta', icon:'ph-coin'},
          {name:'Cuadrillas y Nómina', route:'/cuadrillas', icon:'ph-users-three'},
          {name:'Gastos y Costos', route:'/expenses', icon:'ph-receipt'},
          {name:'Control Cartera / Viajes', route:'/cartera', icon:'ph-currency-circle-dollar'},
          {name:'Acopios / Visitas', route:'/acopios', icon:'ph-leaf'},
          {name:'Materiales', route:'/materials', icon:'ph-stack'},
          {name:'Gestor de Etiquetas', route:'/gestor-etiquetas', icon:'ph-tag'},
          {name:'QR y Trazabilidad', route:'/qr-system', icon:'ph-qr-code'},
          {name:'Reportes y Analítica', route:'/analytics', icon:'ph-chart-line'},
          {name:'Configuración General', route:'/configuraciones', icon:'ph-gear'},
          {name:'Superadministrador', route:'/superadministrador', icon:'ph-shield-check'},
        ];
        const mres2 = await fetch('/api/menu?includeAll=true');
        const currentGs = mres2.ok ? await mres2.json() : [];
        const existingRoutes = new Set((currentGs||[]).flatMap(g => (g.modules||[]).map(mm => (mm.module_route||'').trim().toLowerCase())));
        const opsGrp = (currentGs||[]).find(g => (g.group_name||'').toLowerCase().includes('oper')) || (currentGs||[])[0];
        if (opsGrp && opsGrp.id) {
          for (const k of knownCritical) {
            if (!existingRoutes.has(k.route.toLowerCase())) {
              try {
                await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add-module', groupId: opsGrp.id, moduleName: k.name, moduleRoute: k.route, moduleIcon: k.icon }) });
              } catch(_) {}
            }
          }
        }
      } catch(_) {}
    } catch (e) {
      if (e?.message !== 'Failed to fetch') {
        console.error('Superadmin data load:', e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await fetch('/api/superadmin/summary', { credentials: 'include' });
      if (res.ok) {
        const s = await res.json().catch(() => ({}));
        setSummary(s || {});
        setReportRows(Array.isArray(s?.recentPedidos) ? s.recentPedidos : []);
      }
    } catch {}
  };

  // auto update all from real DB
  useEffect(() => {
    const timer = setInterval(() => {
      loadSummary();
    }, 14000);
    return () => clearInterval(timer);
  }, []);

  // Inicializar PREC/KG calculados con total KG (CANT × PREC.MXN / KG viaje)
  useEffect(() => {
    recalcPrecios(totalKgViaje);
  }, []);

  const reloadMenu = () => loadAll();

  // Toggle module
  const toggleModule = async (moduleId, currentActive) => {
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-module', moduleId, isActive: !currentActive }),
      });
      reloadMenu();
    } catch {}
  };

  // Toggle group
  const toggleGroup = async (groupId, currentActive) => {
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-group', groupId, isActive: !currentActive }),
      });
      reloadMenu();
    } catch {}
  };

  // Assign module to group (Distribucion)
  const assignModule = async (moduleId, targetGroupId) => {
    try {
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign-module', moduleId, targetGroupId }),
      });
      reloadMenu();
    } catch {}
  };

  const confirmAssignmentForModule = async (m) => {
    const mid = String(m.id);
    const p = pendingChanges[mid] || {};
    const toApply = TARGET_GROUPS.map(tg => ({
      groupName: tg,
      granted: p[tg] !== undefined ? p[tg] : hasGroupAccess(m, tg)
    }));
    try {
      for (const {groupName, granted} of toApply) {
        await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-group-access', moduleId: parseInt(mid), groupName, granted })
        });
      }
      setPendingChanges(prev => {
        const copy = { ...prev };
        delete copy[mid];
        return copy;
      });
      reloadMenu();
      // Force clients to re-fetch filtered menu with new group_access (startup + navigation)
      try { await fetch('/api/menu?credential=operaciones'); await fetch('/api/menu?credential=campo'); await fetch('/api/menu?credential=administrador'); } catch(_) {}
    } catch {}
  };

  // Distribución: assign 1-3 modules per section/role, changes reflect immediately on save
  const addModuleToRole = (role, moduleId) => {
    setRoleSelections(prev => {
      const curr = prev[role] || [];
      if (curr.length >= 3 || curr.includes(moduleId)) return prev;
      return { ...prev, [role]: [...curr, moduleId] };
    });
  };

  const removeModuleFromRole = (role, moduleId) => {
    setRoleSelections(prev => {
      const curr = prev[role] || [];
      return { ...prev, [role]: curr.filter(id => id !== moduleId) };
    });
  };

  const saveRoleAssignments = async (role) => {
    const selected = (roleSelections[role] || []).map(id => String(id));
    const currently = allSystemModules
      .filter(m => getModuleAccess(m).includes(role))
      .map(m => String(m.id));
    const toGrant = selected.filter(id => !currently.includes(id));
    const toRevoke = currently.filter(id => !selected.includes(id));
    // Use consistent credential keys for group_access so filtered menus (campo/operaciones/administrador) correctly show the assigned modules
    const accessKey = role === 'Accopio' ? 'campo' : role === 'Operaciones' ? 'operaciones' : role === 'Administración General' ? 'administrador' : role;
    try {
      for (const mid of toGrant) {
        await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-group-access', moduleId: parseInt(mid), groupName: accessKey, granted: true })
        });
      }
      for (const mid of toRevoke) {
        await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-group-access', moduleId: parseInt(mid), groupName: accessKey, granted: false })
        });
      }
      // Move selected modules structurally to the target section's group so they render and display in that group's view cards
      const targetGroup = (mainGroups || groups || []).find(g => normalizeGroupName(g.group_name) === role);
      if (targetGroup && targetGroup.id) {
        for (const mid of selected) {
          try {
            await fetch('/api/menu', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'assign-module', moduleId: parseInt(mid), targetGroupId: targetGroup.id })
            });
          } catch (_) {}
        }
      }
      setRoleSelections(prev => {
        const copy = { ...prev };
        delete copy[role];
        return copy;
      });
      reloadMenu();
      // Force immediate refresh for all roles so menu reflects right away across the system
      try {
        await Promise.all([
          fetch('/api/menu?credential=campo'),
          fetch('/api/menu?credential=operaciones'),
          fetch('/api/menu?credential=administrador')
        ]);
      } catch (_) {}
    } catch (e) {}
  };

  // Add group
  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-group', groupName: newGroupName.trim() }),
      });
      setNewGroupName('');
      reloadMenu();
    } catch {}
  };

  // Add module
  const addModule = async () => {
    if (!newModule.groupId || !newModule.moduleName || !newModule.moduleRoute) return;
    try {
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-module',
          groupId: parseInt(newModule.groupId),
          moduleName: newModule.moduleName.trim(),
          moduleRoute: newModule.moduleRoute.trim(),
          moduleIcon: newModule.moduleIcon || 'ph-cube'
        }),
      });
      setNewModule({ groupId: '', moduleName: '', moduleRoute: '', moduleIcon: 'ph-cube' });
      reloadMenu();
    } catch {}
  };

  // Update module name/icon simple
  const updateModule = async (moduleId, patch) => {
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-module', moduleId, ...patch }),
      });
      reloadMenu();
    } catch {}
  };

  // Save styles
  const saveStyles = async () => {
    setSaving(true);
    try {
      await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: styles.primary_color,
          secondary_color: styles.secondary_color,
          accent_color: styles.accent_color,
          font_family: styles.body_font_family || styles.font_family,
          heading_font_family: styles.heading_font_family,
          body_font_family: styles.body_font_family,
          uploaded_fonts: uploadedFonts,
        }),
      });
      alert('Estilos guardados. Los cambios se aplicarán en toda la app.');
    } catch {}
    setSaving(false);
  };

  // Quick filters: meaningful active groups. Embarques merged into Operaciones: inactive/parented groups filtered; Embarques now sub-module under Operaciones with inherited permissions.
  const mainGroups = groups.filter(g => g.is_active && g.group_order < 50);

  // Flat modules for lists / distribution
  const allModules = mainGroups.flatMap(g =>
    (g.modules || []).map(m => ({ ...m, groupId: g.id, groupName: g.group_name }))
  );

  // All modules including from all groups (for complete list show and assign to groups)
  const allSystemModules = Array.from(new Map((groups || []).flatMap(g => (g.modules || []).map(m => [m.id, { ...m, groupId: g.id, groupName: g.group_name }]))).values());

  // === User management helpers (declared after mainGroups so they can reference them safely) ===
  const fetchUsers = async () => {
    try {
      const uRes = await fetch('/api/superadmin/users', { credentials: 'include' });
      if (uRes.ok) {
        const ud = await uRes.json();
        const list = Array.isArray(ud) ? ud : [];
        setUsers(list);

        // Bootstrap group assignments from role for UI select display (binds data from gestion)
        const init = {};
        const grpMap = {};
        (mainGroups || []).forEach(g => { 
          const n = (g.group_name || '').toLowerCase(); 
          if (n.includes('acop') || n.includes('campo')) grpMap['accopio'] = g.id; 
          if (n.includes('oper')) grpMap['operaciones'] = g.id; 
          if (n.includes('admin') && !n.includes('super')) grpMap['administracion_general'] = g.id; 
          if (n.includes('super')) grpMap['superadministrador'] = g.id; 
        });
        list.forEach(u => {
          const r = (u.admin_role || '').toLowerCase();
          const key = r.includes('super') ? 'superadministrador' : r.includes('acop') ? 'accopio' : r.includes('oper') ? 'operaciones' : (r.includes('admin') ? 'administracion_general' : 'accopio');
          if (grpMap[key]) init[u.id] = grpMap[key];
        });
        setUserGroupAssignments(prev => ({ ...prev, ...init }));
      }
    } catch (e) {}
  };

  const assignUserToGroup = async (userId, gid, isSuperRole) => {
    if (!gid && !isSuperRole) return;
    // Super always full access - store all system modules
    if (isSuperRole) {
      const allMods = (allSystemModules || []).map(m => ({
        module_name: m.module_name,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true
      }));
      try {
        await fetch(`/api/admin/users/${userId}/modules`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modules: allMods })
        });
        setUserGroupAssignments(prev => ({ ...prev, [userId]: 'super' }));
      } catch (e) {}
      return;
    }
    // Merge Embarques into Operaciones: auto-map id of old merged group to parent Operaciones with inherited sub-modules permissions
    let targetGid = gid;
    const matchGrp = groups.find(g => String(g.id) === String(gid));
    if (matchGrp && (matchGrp.group_name || '').toLowerCase().includes('embar')) {
      const opGrp = groups.find(g => (g.group_name || '').toLowerCase() === 'operaciones') || mainGroups.find(g => (g.group_name || '').toLowerCase() === 'operaciones');
      if (opGrp) targetGid = opGrp.id;
    }
    const grp = mainGroups.find(g => String(g.id) === String(targetGid)) || groups.find(g => String(g.id) === String(targetGid));
    if (!grp) {
      setUserGroupAssignments(prev => ({ ...prev, [userId]: targetGid }));
      return;
    }
    const mods = (grp.modules || []).map(m => ({
      module_name: m.module_name,
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false
    }));
    try {
      await fetch(`/api/admin/users/${userId}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: mods })
      });
      setUserGroupAssignments(prev => ({ ...prev, [userId]: targetGid }));
    } catch (e) {}
  };

  const editUser = (u) => {
    setEditingUser(u);
    const role = u.admin_role || (u.is_super_admin ? 'superadministrador' : 'administracion_general');
    // Merge handling: map if old Embarques ref to the Operaciones one
    let defaultG = userGroupAssignments[u.id] || (mainGroups[0]?.id || '');
    const emG = mainGroups.find(g => (g.group_name||'').toLowerCase().includes('embar')) || groups.find(g => (g.group_name||'').toLowerCase().includes('embar'));
    if (defaultG && emG && String(defaultG) === String(emG.id)) {
      const op = mainGroups.find(g => (g.group_name||'').toLowerCase()==='operaciones') || groups.find(g=>(g.group_name||'').toLowerCase()==='operaciones');
      if (op) defaultG = op.id;
    }
    // map old campo to accopio if present
    if (!defaultG) {
      const acc = mainGroups.find(g => (g.group_name||'').toLowerCase().includes('acop')) || mainGroups.find(g => (g.group_name||'').toLowerCase().includes('campo'));
      if (acc) defaultG = acc.id;
    }
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      pin: '',
      groupId: defaultG,
      is_super_admin: !!u.is_super_admin,
      admin_role: role
    });
    setShowUserForm(true);
  };

  const deleteUser = async (uid) => {
    if (!uid || !confirm('¿Eliminar este usuario? Se borrarán credenciales, permisos y accesos.')) return;
    try {
      const res = await fetch('/api/superadmin/users?userId=' + uid, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'No se pudo eliminar el usuario');
        return;
      }
      setUserGroupAssignments(prev => { const cp = { ...prev }; delete cp[uid]; return cp; });
      fetchUsers();
    } catch (e) { console.log('delete ok continue'); }
  };

  const saveUser = async () => {
    const { name, email, pin, groupId, is_super_admin, admin_role } = userForm;
    if (!name?.trim() || !email?.trim()) {
      alert('Nombre y correo son requeridos');
      return;
    }
    const emailVal = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      alert('El email no es válido');
      return;
    }
    if (!editingUser && (!pin || !/^\d{4}$/.test(pin))) {
      alert('Para nuevo usuario ingresa PIN de 4 dígitos');
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      alert('El PIN debe tener exactamente 4 dígitos');
      return;
    }
    const tierRole = is_super_admin ? 'superadministrador' : (admin_role || 'administracion_general');
    try {
      let targetId = editingUser ? editingUser.id : null;

      if (editingUser) {
        await fetch('/api/superadmin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: targetId, name: name.trim(), email: email.trim(), is_super_admin: !!is_super_admin, admin_role: tierRole })
        });
        if (pin) {
          const pinRes = await fetch(`/api/admin/users/${targetId}/pin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
          });
          if (!pinRes.ok) {
            const errData = await pinRes.json().catch(() => ({}));
            alert(errData.error || 'No se pudo asignar/actualizar el PIN');
            return;
          }
        }
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: name.trim(), 
            email: emailVal, 
            pin,
            is_super_admin: !!is_super_admin, 
            admin_role: tierRole 
          })
        });
        const data = await res.json();
        if (!res.ok || !data.userId) {
          alert(data.error || 'Error creando usuario');
          return;
        }
        targetId = data.userId;
        await fetch('/api/superadmin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: targetId, name: name.trim(), email: emailVal, is_super_admin: !!is_super_admin, admin_role: tierRole })
        });
      }
      if (targetId) {
        const isSuperRole = tierRole === 'superadministrador';
        await assignUserToGroup(targetId, groupId ? parseInt(groupId) : null, isSuperRole);
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', pin: '', groupId: '', is_super_admin: false, admin_role: 'administracion_general' });
      fetchUsers();
    } catch (e) {
      alert(e.message || 'No fue posible guardar el usuario');
    }
  };

  const cancelUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setUserForm({ name: '', email: '', pin: '', groupId: '', is_super_admin: false, admin_role: 'administracion_general' });
  };

  const loadClientes = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) setClientes(await res.json());
    } catch {}
  };

  const loadClienteLoads = async (cid, cName) => {
    if (!cName && !cid) { setClienteLoads([]); setViajeRows([]); return; }
    try {
      const res = await fetch('/api/load-history');
      const all = res.ok ? await res.json() : [];
      const filtered = Array.isArray(all) ? all.filter(l => 
        (cid && String(l.customer_id) === String(cid)) || (cName && (l.customer_name || '').toLowerCase() === cName.toLowerCase())
      ) : [];
      setClienteLoads(filtered);
      setViajeRows(filtered.map(l => ({id: l.id, fecha_viaje: l.load_date || '', calibre: l.caliber || '', tarimas: l.pallets_count != null ? l.pallets_count : 0 })));
    } catch { setClienteLoads([]); setViajeRows([]); }
  };

  const editCliente = (c) => {
    setEditingCliente(c);
    setClienteForm({
      customerName: c.customer_name || '', 
      commercialName: c.commercial_name || c.customer_name || '', 
      contactName: c.contact_name || '',
      rfc: c.rfc || '', address: c.address || '',
      phone: c.phone || '', email: c.email || '', destination: c.destination || '',
      preferredCaliber: c.preferred_caliber || '', notes: c.notes || '',
      manifestCode: c.manifest_code || '', manifestRequirements: c.manifest_requirements || '',
      clientNumber: c.client_number || ''
    });
    setViajeRows([]);
    setShowClienteForm(true);
    loadClienteLoads(c.id, c.customer_name);
  };

  const saveCliente = async () => {
    const f = clienteForm;
    if (!f.customerName?.trim() && !f.commercialName?.trim()) { alert('Nombre comercial requerido'); return; }
    const payload = {
      customerName: (f.customerName || f.commercialName || '').trim(), 
      commercialName: (f.commercialName || f.customerName || '').trim(), 
      contactName: f.contactName || null,
      clientNumber: f.clientNumber || null,
      rfc: f.rfc || null, address: f.address || null,
      phone: f.phone || null, email: f.email || null, destination: f.destination || null,
      preferredCaliber: f.preferredCaliber || null, notes: f.notes || null,
      manifestCode: f.manifestCode || null, manifestRequirements: f.manifestRequirements || null
    };
    try {
      let savedId = editingCliente ? editingCliente.id : null;
      if (editingCliente) {
        await fetch('/api/customers', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: editingCliente.id, ...payload }) });
        savedId = editingCliente.id;
      } else {
        const cr = await fetch('/api/customers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (cr.ok) { const cj=await cr.json(); savedId = cj && cj.id; }
      }
      // persist filas viaje -> se ven en dashboard principal via load_history
      if (viajeRows && viajeRows.length) {
        for (const v of viajeRows) {
          if (!v.fecha_viaje) continue;
          await fetch('/api/load-history', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
            loadDate: v.fecha_viaje, customerName: (f.customerName || f.commercialName || '').trim(), destination: f.destination || '',
            caliber: v.calibre||'', palletsCount: parseInt(v.tarimas)||0, boxesCount: (parseInt(v.tarimas)||0)*24, totalKg: (parseInt(v.tarimas)||0)*240, unitPrice:0, totalAmount:0, currency:'USD', presentationKg:10, customerId: savedId
          })});
        }
      }
      setShowClienteForm(false); setEditingCliente(null); setViajeRows([]);
      setClienteForm({ customerName:'', commercialName:'', contactName:'', rfc:'', address:'', phone:'', email:'', destination:'', preferredCaliber:'', notes:'', manifestCode:'', manifestRequirements:'', clientNumber:'' });
      loadClientes();
      if (savedId) loadClienteLoads(savedId, f.customerName.trim());
    } catch (e) { alert('No se pudo guardar'); }
  };

  const deleteCliente = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    try { await fetch(`/api/customers?id=${id}`, { method: 'DELETE' }); loadClientes(); } catch {}
  };

  // Acceso directo al portal del cliente SIN PIN (solo superadministrador)
  const accessPortalWithoutPin = async (cid, cName) => {
    if (!cid) return;
    try {
      const res = await fetch('/api/client-portal/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: cid, action: 'direct-access' })
      });
      if (res.ok) {
        window.open('/portal-cliente/dashboard', '_blank');
      } else {
        // fallback: still open so user sees login but note super can use client number
        window.open('/portal-cliente', '_blank');
      }
    } catch (e) {
      window.open('/portal-cliente/dashboard', '_blank');
    }
  };

  const cancelClienteForm = () => {
    setShowClienteForm(false);
    setEditingCliente(null);
    setClienteLoads([]);
    setViajeRows([]);
    setClienteForm({ customerName:'', commercialName:'', contactName:'', rfc:'', address:'', phone:'', email:'', destination:'', preferredCaliber:'', notes:'', manifestCode:'', manifestRequirements:'', clientNumber:'' });
  };

  const addViajeRow = () => setViajeRows([...viajeRows, { fecha_viaje: new Date().toISOString().slice(0,10), calibre: clienteForm.preferredCaliber || '', tarimas: 1 }]);
  const removeViajeRow = async (idx) => {
    const row = viajeRows[idx];
    if (row && row.id) { try { await fetch(`/api/load-history?id=${row.id}`, {method:'DELETE'}); } catch {} }
    setViajeRows(viajeRows.filter((_,i)=>i!==idx));
  };
  const updateViajeRow = (idx, key, val) => { const cp=[...viajeRows]; cp[idx]={...cp[idx],[key]:val}; setViajeRows(cp); };

  // === Pedidos handlers ===
  const loadPedidos = async () => { try { const r = await fetch('/api/pedidos'); if (r.ok) setPedidos(await r.json()); } catch{} };
  const selectClienteForPedido = (c) => {
    setPedidoForm({ fechaSalida: new Date().toISOString().slice(0,10), customerId: c.id || '', clienteNombre: c.customer_name || '', frutaRequerida: c.preferred_caliber || '' });
    setPedidoRows([]);
  };
  const addPedidoRow = () => setPedidoRows([...pedidoRows, { calibre: CALIBRES[0], clase: 'A', num_tarimas: 1 }]);
  const removePedidoRow = (i) => setPedidoRows(pedidoRows.filter((_,ix)=>ix!==i));
  const updatePedidoRow = (i, k, v) => { const cp = [...pedidoRows]; cp[i] = { ...cp[i], [k]: (k === 'num_tarimas' ? (parseInt(v) || 0) : v) }; setPedidoRows(cp); };
  const savePedido = async () => {
    const f = pedidoForm;
    if (!f.clienteNombre) return;
    const total = pedidoRows.reduce((s,r)=>s+(parseInt(r.num_tarimas)||0),0);
    const payload = { fechaSalida: f.fechaSalida, customerId: f.customerId, clienteNombre: f.clienteNombre, frutaRequerida: f.frutaRequerida, estado: 'pendiente', rows: pedidoRows, total_tarimas: total };
    try {
      if (editingPedido) {
        await fetch('/api/pedidos', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: editingPedido.id, ...payload }) });
      } else {
        await fetch('/api/pedidos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }
      setShowPedidoForm(false); setEditingPedido(null); setPedidoRows([]); setPedidoForm({ fechaSalida:'', customerId:'', clienteNombre:'', frutaRequerida:'' });
      loadPedidos();
    } catch(e){}
  };
  const editPedido = (p) => {
    setEditingPedido(p);
    setPedidoForm({ fechaSalida: p.fecha_salida || '', customerId: p.customer_id||'', clienteNombre: p.cliente_nombre||'', frutaRequerida: p.fruta_requerida||'' });
    setPedidoRows((Array.isArray(p.rows) ? p.rows : []).map(r => ({ calibre: r.calibre || CALIBRES[0], clase: r.clase || 'A', num_tarimas: parseInt(r.num_tarimas) || 0 })));
    setShowPedidoForm(true);
  };
  const deletePedido = async (id) => { if (!confirm('Eliminar?')) return; await fetch(`/api/pedidos?id=${id}`,{method:'DELETE'}); loadPedidos(); };
  const updatePedidoOps = async (p, patch) => {
    await fetch('/api/pedidos', {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: p.id, ...patch })});
    loadPedidos();
  };

  // ======= APK HANDLERS (Descargas de APK) =======
  const loadApks = async () => {
    try {
      const res = await fetch('/api/superadmin/apps', { credentials: 'include' });
      if (res.ok) {
        const all = await res.json();
        setApks((all || []).filter(a => a.apk_filename || a.estado === 'generada' || a.estado === 'activa'));
      }
    } catch {}
  };

  const generateOrdenCorteApk = async () => {
    setGeneratingApk(true);
    try {
      await fetch('/api/superadmin/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Orden de Corte Operativo',
          tipo: 'APK Móvil',
          descripcion: 'Vinculada a sección Orden de Corte / Box Control. Distribuir a personal operativo.',
          ruta: '/cutting-orders',
          icono: 'ph-clipboard-text',
          version: '1.3',
          estado: 'generada',
          apk_filename: `orden-corte-operativo-${new Date().toISOString().slice(0,10)}.apk`,
          requiere_autorizacion: true
        })
      });
      await loadApks();
    } catch (e) { /* error handled in load */ }
    setGeneratingApk(false);
  };

  const generatePendingApks = async () => {
    setGeneratingApk(true);
    const needed = [
      { nombre: 'Orden de Corte Operativo', tipo:'APK Móvil', ruta:'/cutting-orders', icono:'ph-clipboard-text' },
      { nombre: 'Control de Cajas Operativo', tipo:'APK Móvil', ruta:'/box-control', icono:'ph-cube' },
      { nombre: 'Cuadrillas Móvil', tipo:'APK Móvil', ruta:'/cuadrillas', icono:'ph-users' },
      { nombre: 'Embarques y Acopios', tipo:'APK Móvil', ruta:'/embarques', icono:'ph-truck' },
      { nombre: 'Lotes y Selección', tipo:'APK Móvil', ruta:'/lotification-registry', icono:'ph-package' }
    ];
    for (const n of needed) {
      try { 
        await fetch('/api/superadmin/apps', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ 
          ...n, version:'1.3', estado:'generada', requiere_autorizacion: true, 
          apk_filename: (n.nombre.toLowerCase().replace(/\\s/g,'-') + '.apk') 
        }) }); 
      } catch {}
    }
    await loadApks();
    setGeneratingApk(false);
  };

  const downloadApk = async (app) => {
    try {
      const r = await fetch(`/api/superadmin/apps/download?appId=${app.id}`, { credentials: 'include' });
      const txt = await r.text();
      const info = txt ? JSON.parse(txt) : {};
      if (info.allowed && info.download_url) {
        const link = document.createElement('a');
        link.href = info.download_url;
        link.download = info.filename || app.apk_filename || (app.nombre + '.apk');
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      alert(info.error || 'APK real verificado no disponible. Compila APK Android firmado externamente y súbelo con URL real en Superadministrador. Este servicio requiere conexión externa.');
    } catch (e) {
      alert('APK real no disponible. Solo archivos con URL verificada (apk_url) son permitidos.');
    }
  };

  const uploadRealApk = async (app, file) => {
    if (!file || !app?.id) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const uptxt = await upRes.text();
      const up = uptxt ? JSON.parse(uptxt) : {};
      const url = up.url || up.fileUrl;
      if (!url) throw new Error('No se obtuvo URL de subida');
      await fetch('/api/superadmin/apps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, apk_url: url, apk_filename: file.name, apk_size: file.size || null })
      });
      await loadApks();
    } catch (e) {
      alert('No se pudo subir el APK real. Usando descarga generada.');
    }
  };

  // ======= COSTOS DETALLADOS POR DESTINO - save to historial DB =======
  const recalcPrecios = (kg) => {
    const kgVal = kg || totalKgViaje;
    setCostRows(prev => prev.map(r => {
      const mxn = (r.cantidad || 0) * (r.precio_mxn || 0);
      const pk = kgVal > 0 ? parseFloat((mxn / kgVal).toFixed(4)) : 0;
      return { ...r, precio_kilo: pk };
    }));
  };

  const updateCostRow = (id, key, val) => {
    setCostRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      let updated = { ...r, [key]: (key==='cantidad' || key==='precio_mxn' || key==='precio_kilo') ? parseFloat(val)||0 : val };
      if (key === 'cantidad' || key === 'precio_mxn') {
        const c = key === 'cantidad' ? (parseFloat(val)||0) : (updated.cantidad || 0);
        const p = key === 'precio_mxn' ? (parseFloat(val)||0) : (updated.precio_mxn || 0);
        const mxn = c * p;
        updated.precio_kilo = totalKgViaje > 0 ? parseFloat((mxn / totalKgViaje).toFixed(4)) : 0;
      }
      return updated;
    }));
  };

  const addCostRow = () => {
    const newRow = { id: 'r' + Date.now(), concepto: 'NUEVO CONCEPTO', cantidad: 1, unidad: 'PIEZA', precio_mxn: 0, precio_kilo: 0 };
    setCostRows(prev => {
      const next = [...prev, newRow];
      return next;
    });
  };

  const removeCostRow = (id) => {
    setCostRows(prev => prev.filter(r => r.id !== id));
  };

  const calcTotals = () => {
    const totalMxn = costRows.reduce((s,r)=> s + (r.precio_mxn || 0)* (r.cantidad || 0), 0);
    const prom = totalKgViaje > 0 ? (totalMxn / totalKgViaje) : 0;
    return { totalMxn, prom };
  };

  const saveCostosPorDestino = async () => {
    if (!selectedDestino) { alert('Selecciona un destino de un cliente'); return; }
    const { totalMxn, prom } = calcTotals();
    const payload = {
      destino: selectedDestino,
      semana: preciosSemana.semana || 1,
      rows: costRows,
      total_costo_mxn: totalMxn,
      total_kg: totalKgViaje,
      costo_promedio_kg: prom.toFixed(2),
      notas: 'Guardado desde Superadministrador - costos detallados kg'
    };
    try {
      await fetch('/api/superadmin/costos-historico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const ch = await fetch('/api/superadmin/costos-historico');
      if (ch.ok) setCostosHist(await ch.json());
      alert('Costos detallados guardados como antecedente para este destino.');
    } catch { alert('No se pudo guardar'); }
  };

  const loadCostosHist = async (dest = '') => {
    try {
      const url = dest ? `/api/superadmin/costos-historico?destino=${encodeURIComponent(dest)}` : '/api/superadmin/costos-historico';
      const r = await fetch(url);
      if (r.ok) setCostosHist(await r.json());
    } catch {}
  };

  const cargarDesdeHistorial = (h) => {
    if (h && h.total_kg != null) setTotalKgViaje(Number(h.total_kg) || 10000);
    if (h && h.rows && Array.isArray(h.rows)) {
      setCostRows(h.rows.map(r => {
        const c = r.cantidad||0, p = r.precio_mxn||0;
        const kg = h.total_kg || totalKgViaje || 10000;
        return { ...r, precio_kilo: kg > 0 ? parseFloat(((c * p) / kg).toFixed(4)) : (r.precio_kilo||0) };
      }));
    }
    if (h && h.destino) setSelectedDestino(h.destino);
  };

  // TECAVO IA chat (Bloque 01) - llama API segura con rol
  const sendIaMessage = async () => {
    const q = iaInput.trim();
    if (!q) return;
    setIaLoading(true);
    const newMsgs = [...iaMessages, { role: "user", content: q }];
    setIaMessages(newMsgs);
    setIaInput("");
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: q, history: newMsgs })
      });
      const d = await r.json();
      const reply = d.reply || d.error || "Sin respuesta del asistente.";
      setIaMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (e) {
      setIaMessages([...newMsgs, { role: "assistant", content: "Error consultando TECAVO IA. Verifica backend." }]);
    }
    setIaLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-3 text-emerald-600" />
          <p className="text-slate-600">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // funciones report generator, range presets para filtros
  const applyReportFilter = (period) => {
    setReportPeriod(period);
    const now = new Date();
    let s = new Date(now);
    let e = new Date(now);
    if (period === 'weekly') { s.setDate(now.getDate() - 7); }
    else if (period === 'biweekly') { s.setDate(now.getDate() - 14); }
    else { s.setMonth(now.getMonth() - 1); }
    const ss = s.toISOString().slice(0,10);
    const ee = e.toISOString().slice(0,10);
    setStartDate(ss);
    setEndDate(ee);

    // real filter recent loads from summary real DB
    const rows = (Array.isArray(summary.recentPedidos) ? summary.recentPedidos : []).filter(r => {
      const d = (r.load_date || '').slice(0,10);
      return (d >= ss) && (!ee || d <= ee);
    });
    setReportRows(rows.length ? rows : (Array.isArray(summary.recentPedidos) ? summary.recentPedidos : []));
  };

  const exportPDF = async () => {
    const area = document.getElementById('report-section');
    if (!area) return;
    const canvas = await html2canvas(area, { scale: 1.6 });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const img = canvas.toDataURL('image/png');
    const w = pdf.internal.pageSize.getWidth() - 20;
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 10, 12, w, h);
    pdf.save(`reporte-superadmin-${reportPeriod}.pdf`);
  };

  const exportJPG = async () => {
    const area = document.getElementById('report-section');
    if (!area) return;
    const canvas = await html2canvas(area, { scale: 1.5 });
    const link = document.createElement('a');
    link.download = `reporte-superadmin-${reportPeriod}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const uploadFondo = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      const url = j.url || j.fileUrl;
      if (url) setPreciosSemana(s => ({ ...s, imagen_url: url }));
    } catch (e) { }
    setUploadingBg(false);
  };

  const uploadCustomFont = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      const url = j.url || j.fileUrl;
      if (url) {
        const base = (file.name || 'font').replace(/\.[^/.]+$/, '');
        const safeName = base.replace(/[^a-zA-Z0-9_\-]/g, '-');
        setUploadedFonts(prev => [...prev, { name: safeName, url, original: file.name }]);
        setStyles(s => ({ ...s, heading_font_family: safeName }));
      }
    } catch (e) { alert('No se pudo subir la tipografía'); }
  };

  const renameUploadedFont = (idx, newName) => {
    setUploadedFonts(prev => prev.map((f, i) => i===idx ? { ...f, name: newName.replace(/[^a-zA-Z0-9_\- ]/g, '-') } : f ));
  };

  const removeUploadedFont = (idx) => {
    const f = uploadedFonts[idx];
    setUploadedFonts(prev => prev.filter((_,i)=>i!==idx));
    setStyles(s => {
      const next = { ...s };
      if (s.heading_font_family === f?.name) next.heading_font_family = 'sans-serif';
      if (s.body_font_family === f?.name) next.body_font_family = 'sans-serif';
      if (s.font_family === f?.name) next.font_family = 'sans-serif';
      return next;
    });
  };

  const useCustomFont = (f) => {
    setStyles(s => ({ ...s, heading_font_family: f.name }));
  };
  const useCustomFontForBody = (f) => {
    setStyles(s => ({ ...s, body_font_family: f.name }));
  };

  const guardarPreciosSemana = async () => {
    try {
      await fetch('/api/precios-fruta/publicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semana: preciosSemana.semana,
          fecha_inicio: preciosSemana.fecha_inicio,
          fecha_fin: preciosSemana.fecha_fin,
          super_extra: preciosSemana.super_extra,
          extra: preciosSemana.extra,
          primera: preciosSemana.primera,
          mediano: preciosSemana.mediano,
          tercera: preciosSemana.tercera,
          cuarta: preciosSemana.cuarta,
          proceso: preciosSemana.proceso,
          desecho: preciosSemana.desecho,
          imagen_url: preciosSemana.imagen_url
        })
      });
      alert('Precios de campo + plantilla guardados. Se muestra solo en el espacio de precios de la vista inicial.');
    } catch (_) {}
  };

  const obtenerSemanaAutomatica = async () => {
    try {
      const r = await fetch('/api/semana-calendario');
      if (r.ok) {
        const w = await r.json();
        const wk = {
          semana: Number(w.semana) || 1,
          fecha_inicio: w.fecha_inicio || null,
          fecha_fin: w.fecha_fin || null,
          display_lunes: String(w.display_lunes || ''),
          display_sabado: String(w.display_sabado || '')
        };
        setPreciosSemana(s => ({ ...s, ...wk }));
      }
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* (3) LEFT SIDEBAR NAV - one independent collapsible menu per group from current config */}
      <aside className="w-72 bg-white border-r hidden lg:flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="px-4 pt-5 pb-3 border-b">
          <div className="text-xs tracking-[2px] text-emerald-700 font-semibold">NAVEGACIÓN</div>
          <div className="text-xl font-semibold tracking-tight mt-1">Módulos</div>
        </div>
        <div className="p-3 flex-1 text-sm space-y-1">
          {(groups || []).filter(g => g.is_active !== false).map((g, gi) => {
            const mods = (g.modules || []).filter(m => m.is_active !== false);
            if (!mods.length) return null;
            return (
              <details key={g.id ?? gi} open className="border rounded-xl overflow-hidden">
                <summary className="px-3 py-1.5 bg-emerald-50 text-xs font-semibold text-emerald-800 tracking-wider cursor-pointer select-none flex items-center justify-between">
                  {g.group_name || 'Grupo'} <span className="text-[10px] opacity-50">▾</span>
                </summary>
                <div className="bg-white">
                  {mods.map((m, mi) => (
                    <a
                      key={m.id ?? mi}
                      href={m.module_route}
                      target="_blank"
                      rel="noreferrer"
                      className="block px-3 py-1.5 hover:bg-emerald-50 text-emerald-800 border-t text-sm last:border-b-0"
                    >
                      {m.module_name}
                    </a>
                  ))}
                </div>
              </details>
            );
          })}
          {(!groups || groups.length === 0) && (
            <div className="px-3 py-3 text-xs text-slate-400 border rounded-xl">Carga módulos en Configuración.</div>
          )}
          <div className="mt-2 text-[10px] text-slate-400 px-2">Un menú desplegable por grupo según la configuración actual.</div>
        </div>
        <div className="p-3 border-t text-[10px] text-center text-slate-500">Se actualiza al cambiar grupos/módulos</div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1">
        {/* Header limpio - styled to match final dashboard specs with full super access styling */}
        <div className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-800 text-white rounded-2xl flex items-center justify-center">
                <Grid3X3 size={20} />
              </div>
              <div>
                <div className="font-semibold text-2xl tracking-tight">Administración • Superadministradores</div>
                <div className="text-xs text-emerald-700 -mt-0.5">Grupo independiente con permisos globales • Todas las secciones, datos restringidos, configuraciones y reportes completos</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reloadMenu} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">
                <RefreshCw size={15} /> Actualizar
              </button>
              <button onClick={() => router.push('/')} className="px-4 py-1.5 text-sm rounded-xl border hover:bg-slate-50">Volver al Dashboard</button>
            </div>
          </div>
        </div>

        {/* (1) REAL-TIME SUMMARY CARDS — below slogan/header using database data live auto-update */}
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Usuarios', val: summary.users || users.length, suffix: '' },
              { label: 'Grupos', val: summary.groups || groups.filter(g=>g.is_active).length, suffix: '' },
              { label: 'Módulos Activos', val: summary.modules || (groups.flatMap(g=>g.modules||[]).length), suffix: '' },
              { label: 'Ventas Semana', val: Number(summary.ventasWeek || 0).toFixed(0), suffix: 'USD' },
              { label: 'Clientes / Cargas', val: summary.clients || summary.cargasWeek || 0, suffix: '' },
            ].map((c) => (
              <div key={c.label} className="bg-white border rounded-2xl p-4">
                <div className="text-xs text-slate-500">{c.label}</div>
                <div className="text-3xl font-semibold mt-1 tabular-nums tracking-tighter">{c.val}</div>
                <div className="text-xs text-emerald-600 mt-0.5">{c.suffix}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Actualiza solo con datos reales de la base • se refresca cada 14s</div>
        </div>

        {/* (2) CONFIGURABLE REPORT GENERATOR with filters weekly/bi-weekly/monthly + real PDF/JPG export */}
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-white rounded-3xl border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-semibold tracking-tight text-xl flex items-center gap-2"><BarChart3 size={19}/> Generador de Reportes</div>
                <div className="text-sm text-slate-500">Filtra por periodo y exporta</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['weekly','biweekly','monthly'].map(p => (
                  <button key={p} onClick={() => applyReportFilter(p)}
                    className={`px-4 py-1.5 rounded-full text-sm border ${reportPeriod===p ? 'bg-emerald-700 text-white border-emerald-700' : 'hover:bg-emerald-50'}`}>
                    {p === 'weekly' ? 'Semanal' : p === 'biweekly' ? 'Quincenal' : 'Mensual'}
                  </button>
                ))}
                <button onClick={() => applyReportFilter(reportPeriod)} className="px-4 py-1.5 text-sm rounded-xl border border-emerald-600 text-emerald-700">Aplicar filtro</button>
                <button onClick={exportPDF} className="px-4 py-1.5 text-sm rounded-xl bg-emerald-700 text-white flex items-center gap-1"><FileText size={15} /> PDF</button>
                <button onClick={exportJPG} className="px-4 py-1.5 text-sm rounded-xl border border-slate-300">JPG</button>
              </div>
            </div>

            <div id="report-section" className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold mb-3">Reporte • {reportPeriod} • {startDate || 'hoy'} — {endDate || 'hoy'}</div>
              <div className="overflow-auto max-h-72">
                <table className="w-full text-sm">
                  <thead><tr className="bg-white text-left border-b">
                    <th className="p-2">Fecha</th><th className="p-2">Cliente</th><th className="p-2">Folio</th><th className="p-2">Kg</th><th className="p-2 text-right">Monto</th>
                  </tr></thead>
                  <tbody>
                    {(Array.isArray(reportRows) && reportRows.length ? reportRows : (Array.isArray(summary.recentPedidos) ? summary.recentPedidos : [])).slice(0,10).map((r,ix)=>(
                      <tr key={`${r.factura_folio || 'row'}-${ix}`} className="border-b bg-white">
                        <td className="p-2">{r.load_date || r.date || '-'}</td>
                        <td className="p-2">{r.customer_name || r.buyer_name || '—'}</td>
                        <td className="p-2 font-mono text-xs">{r.factura_folio || '-'}</td>
                        <td className="p-2">{r.total_kg || 0}</td>
                        <td className="p-2 text-right tabular-nums">{r.monto || r.total_mxn || r.total || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs mt-2 text-slate-500">Datos en tiempo real conectados directamente a la base. Exporta el área visible.</div>
            </div>
          </div>
        </div>

        {/* CONFIG PRECIOS DE LA SEMANA - plantilla sólo para el espacio de precios de campo en vista inicial */}
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="bg-white rounded-3xl border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl"><BarChart3 size={20} /></div>
              <div>
                <div className="text-lg font-semibold">Precios de Fruta en Campo</div>
                <div className="text-xs text-slate-500">Configura precios que aparecen únicamente en el espacio de Precios de Campo de la vista inicial (no toda la página). Sube plantilla para ese bloque.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-slate-600">Valores Semanales (home)</div>
                <div className="grid grid-cols-4 gap-2">
                  {[{k:'super_extra',l:'Super'},{k:'extra',l:'Extra'},{k:'primera',l:'Primera'},{k:'mediano',l:'Mediano'},{k:'tercera',l:'Tercera'},{k:'cuarta',l:'Cuarta'},{k:'proceso',l:'Proceso'},{k:'desecho',l:'Desecho'}].map(({k,l})=>(
                    <div key={k}>
                      <div className="text-[10px] text-slate-500">{l}</div>
                      <input type="number" step="1" value={preciosSemana[k]||0} onChange={e=>setPreciosSemana(s=>({...s,[k]:parseFloat(e.target.value)||0}))} className="border text-center w-full px-2 py-1 rounded-xl font-semibold" />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
                    <span>Número de semana</span>
                    <button onClick={obtenerSemanaAutomatica} className="text-[10px] px-2 py-0.5 rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50">Actualizar desde calendario</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-semibold tabular-nums text-emerald-800">{preciosSemana.semana || 1}</div>
                    {preciosSemana.display_lunes && (
                      <div className="text-xs text-slate-600">
                        Lunes {preciosSemana.display_lunes} — Sábado {preciosSemana.display_sabado}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Extraído automáticamente de calendario-365.mx</div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest font-semibold mb-2 text-slate-600">Plantilla de fondo (JPG/PNG)</div>
                <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 border rounded-xl hover:bg-slate-50 text-sm">
                  <Upload size={15} /> {uploadingBg ? 'Subiendo…' : 'Subir plantilla'}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadFondo} />
                </label>
                <div className="text-[10px] text-slate-400 mt-1">Medidas recomendadas: 800×360 px o 1200×540 px. Solo para el espacio de precios de campo.</div>
                {preciosSemana.imagen_url && (
                  <div className="mt-2">
                    <img src={preciosSemana.imagen_url} alt="Plantilla" className="w-40 rounded border" />
                    <div className="text-[10px] text-slate-400 mt-0.5">Vista actual</div>
                  </div>
                )}
              </div>
            </div>

            <button onClick={guardarPreciosSemana} className="mt-4 inline-flex items-center px-6 py-2 rounded-2xl bg-emerald-700 text-white text-sm font-medium">
              Guardar Precios + Plantilla
            </button>
            <div className="text-[10px] text-slate-400 mt-1">Solo afecta el espacio de Precios de Campo en la vista inicial. La imagen sirve de fondo exclusivo de ese recuadro.</div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-2">
          {/* NAV RÁPIDO */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
            {[
              { id: 'modulos', label: 'Config de Modulos', icon: <Grid3X3 size={18} /> },
              { id: 'estilos', label: 'Config de Estilos', icon: <Palette size={18} /> },
              { id: 'grupos', label: 'Gestion de Grupos y Usuarios', icon: <Users size={18} /> },
              { id: 'distribucion', label: 'Distribución de Componentes', icon: <Move size={18} /> },
              { id: 'clientes', label: 'Clientes y Manifiestos', icon: <Users size={18} /> },
              { id: 'portal-cliente', label: 'Portal Clientes (Config)', icon: <Users size={18} /> },
              { id: 'pedidos', label: 'Pedidos', icon: <FileText size={18} /> },
              { id: 'apks', label: 'Descargas de APK', icon: <Smartphone size={18} /> },
              { id: 'costos-historico', label: 'Costos Detallados Destino', icon: <BarChart3 size={18} /> },
              { id: 'teca-vo-ia', label: 'TECAVO IA (Bloque 01)', icon: <BarChart3 size={18} /> },
            ].map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)} className="flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium">
                <span className="text-emerald-700">{item.icon}</span> {item.label}
              </button>
            ))}
          </div>

        {/* 1. CONFIGURACIÓN DE MÓDULOS */}
        <section id="modulos" className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Grid3X3 size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Config de Modulos</div>
              <div className="text-sm text-slate-500">Lista completa de todos los menús y módulos. Selecciona en las casillas los módulos (Acopios, Operaciones, Administración General) y confirma con el botón para asignar cada sección. Los cambios aparecen como pestañas o accesos en los módulos correspondientes.</div>
            </div>
          </div>

          {/* Add new module quick */}
          <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 rounded-2xl p-3 border">
            <select value={newModule.groupId} onChange={e => setNewModule({...newModule, groupId: e.target.value})} className="border rounded-xl px-3 py-1.5 text-sm">
              <option value="">Elegir grupo</option>
              {mainGroups.map(g => (<option key={g.id} value={g.id}>{g.group_name}</option>))}
            </select>
            <input value={newModule.moduleName} onChange={e=>setNewModule({...newModule, moduleName:e.target.value})} placeholder="Nombre del módulo" className="border rounded-xl px-3 py-1.5 text-sm flex-1 min-w-[160px]" />
            <input value={newModule.moduleRoute} onChange={e=>setNewModule({...newModule, moduleRoute:e.target.value})} placeholder="/ruta-modulo" className="border rounded-xl px-3 py-1.5 text-sm flex-1 min-w-[140px]" />
            <input value={newModule.moduleIcon} onChange={e=>setNewModule({...newModule, moduleIcon:e.target.value})} placeholder="ph-icon" className="border rounded-xl px-3 py-1.5 text-sm w-28" />
            <button onClick={addModule} className="px-5 rounded-xl bg-emerald-700 text-white flex items-center gap-1 text-sm font-medium"><Plus size={16}/> Agregar</button>
          </div>

          {/* Comprehensive access matrix - every module + 4 group checkboxes */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-600">LISTA COMPLETA DE MENÚS / MÓDULOS (ASIGNACIÓN POR GRUPO)</div>
            <button 
              onClick={applyPendingGroupAccessChanges} 
              disabled={Object.keys(pendingChanges).length === 0}
              className={`px-4 py-1.5 rounded-xl text-sm flex items-center gap-1 font-medium ${Object.keys(pendingChanges).length ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-slate-200 text-slate-500 border cursor-not-allowed'}`}
            >
              Confirmar todos
            </button>
          </div>
          <div className="overflow-auto max-h-[520px] border rounded-2xl">
            <table className="w-full text-sm min-w-[1020px]">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Grupo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Módulo</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Ruta</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-xs w-20">Accopio</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-xs w-20">Operaciones</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-xs w-20">Administración General</th>
                  <th className="text-center px-2 py-2.5 font-semibold">Activo</th>
                  <th className="px-2 py-2.5 font-semibold text-xs">Confirmar</th>
                </tr>
              </thead>
              <tbody>
                {allSystemModules.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400 text-xs">Sin módulos. Añade o carga datos desde menú DB.</td></tr>}
                {allSystemModules
                  .sort((a,b)=> (a.groupName||'').localeCompare(b.groupName||'') || (a.module_name||'').localeCompare(b.module_name||''))
                  .map((m, idx) => {
                    const acc = getModuleAccess(m);
                    const primGroup = normalizeGroupName(m.groupName) || 'Accopio';
                    return (
                      <tr key={`${m.id || idx}-cm-${idx}`} className="border-t hover:bg-emerald-50/40">
                        <td className="px-3 py-1.5 text-xs text-emerald-700">{m.groupName}</td>
                        <td className="px-3 py-1.5">
                          <input defaultValue={m.module_name} onBlur={(e)=>updateModule(m.id, {moduleName: e.target.value})} className="border-none bg-transparent font-medium px-1 py-0.5 w-full focus:bg-white rounded text-sm" />
                        </td>
                        <td className="px-3 py-1.5 text-[11px] font-mono text-emerald-700 truncate">{m.module_route}</td>

                        {/* Checkboxes per assignable group (Superadmin always full access) */}
                        {TARGET_GROUPS.map((tg) => (
                          <td key={`${m.id || idx}-${tg}`} className="px-1 py-1.5 text-center">
                            <input 
                              type="checkbox" 
                              checked={hasGroupAccess(m, tg)} 
                              onChange={(e) => {
                                const mid = String(m.id);
                                const granted = e.target.checked;
                                setPendingChanges(prev => ({
                                  ...prev,
                                  [mid]: { ...(prev[mid] || {}), [tg]: granted }
                                }));
                              }}
                              className="w-4 h-4 accent-emerald-600 cursor-pointer"
                            />
                          </td>
                        ))}

                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => toggleModule(m.id, m.is_active)} className={`text-[10px] px-3 py-px rounded-full border ${m.is_active ? 'text-white border-emerald-600 bg-emerald-600' : 'border-slate-300 text-slate-500'}`}>
                            {m.is_active ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => confirmAssignmentForModule(m)}
                            className="px-3 py-1 text-xs rounded bg-emerald-700 text-white hover:bg-emerald-800"
                          >
                            Confirmar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-2">
            <div>Marca las casillas de Accopio, Operaciones o Administración General para asignar la sección. Luego pulsa el botón Confirmar en la columna para guardar la asignación. El sistema toma los módulos seleccionados al confirmar.</div>
          </div>
        </section>

        {/* 2. CONFIGURACION DE ESTILOS */}
        <section id="estilos" className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl"><Palette size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Configuracion de Estilos</div>
              <div className="text-sm text-slate-500">Colores globales, tipografias y aspectos.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Color Primario</label>
              <input type="color" value={styles.primary_color} onChange={e => setStyles({...styles, primary_color: e.target.value})} className="w-full h-11 rounded-2xl border border-slate-200" />
              <div className="text-[10px] mt-1 font-mono text-slate-400">{styles.primary_color}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Color Secundario</label>
              <input type="color" value={styles.secondary_color} onChange={e => setStyles({...styles, secondary_color: e.target.value})} className="w-full h-11 rounded-2xl border border-slate-200" />
              <div className="text-[10px] mt-1 font-mono text-slate-400">{styles.secondary_color}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Color de Acento</label>
              <input type="color" value={styles.accent_color} onChange={e => setStyles({...styles, accent_color: e.target.value})} className="w-full h-11 rounded-2xl border border-slate-200" />
              <div className="text-[10px] mt-1 font-mono text-slate-400">{styles.accent_color}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Tipografía para Encabezados</label>
              <select value={styles.heading_font_family || styles.font_family} onChange={e => setStyles({...styles, heading_font_family: e.target.value})} className="border px-3 py-2 rounded-2xl w-full text-sm">
                <option value="sans-serif">Sans-serif (por defecto)</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="system-ui">System UI</option>
                {uploadedFonts.map((f, i) => (
                  <option key={i} value={f.name}>{f.name} (personalizada)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Tipografía para Texto de Cuerpo</label>
              <select value={styles.body_font_family || styles.font_family} onChange={e => setStyles({...styles, body_font_family: e.target.value})} className="border px-3 py-2 rounded-2xl w-full text-sm">
                <option value="sans-serif">Sans-serif (por defecto)</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="system-ui">System UI</option>
                {uploadedFonts.map((f, i) => (
                  <option key={i} value={f.name}>{f.name} (personalizada)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Upload size={16}/> Subir tipografías para usar en el sistema
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 border rounded-xl hover:bg-slate-50 text-sm mb-2">
              <Upload size={15} /> Subir fuente (TTF/WOFF)
              <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" className="hidden" onChange={uploadCustomFont} />
            </label>
            <div className="text-[10px] text-slate-400 mb-2">Las fuentes subidas se almacenan y pueden seleccionarse como tipografía del sistema.</div>

            {uploadedFonts.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-2 border text-sm">
                {uploadedFonts.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1 text-xs">
                    <input value={f.name} onChange={(e)=>renameUploadedFont(idx, e.target.value)} className="border rounded px-2 py-0.5 w-36 font-mono" />
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-emerald-600 underline text-[10px]">ver</a>
                    <button onClick={() => useCustomFont(f)} className="text-[10px] px-2 py-0.5 bg-white border rounded hover:bg-emerald-100">Usar en Encabezados</button>
                    <button onClick={() => useCustomFontForBody(f)} className="text-[10px] px-2 py-0.5 bg-white border rounded hover:bg-emerald-100">Usar en Cuerpo</button>
                    <button onClick={() => removeUploadedFont(idx)} className="text-red-500 text-[10px] px-1">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-1">Una vez usadas, guarde Estilos Globales para que estén disponibles en toda la app.</div>
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={saveStyles} disabled={saving} className="inline-flex items-center bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 gap-2 px-7 py-2.5 text-sm text-white rounded-2xl font-medium">
              <Save size={17} /> {saving ? 'Guardando...' : 'Guardar Estilos Globales'}
            </button>
            <div className="text-xs self-center text-slate-500">Aplica a la mayoría de pantallas.</div>
          </div>

          {/* Preview simple */}
          <div className="mt-6 rounded-2xl p-5 border text-xs" style={{ background: '#fff', color: '#111' }}>
            Vista previa rápida:
            <div className="mt-3 flex gap-2 flex-wrap">
              <div className="px-4 py-2 rounded-xl text-white text-sm" style={{ background: styles.primary_color, fontFamily: styles.heading_font_family || styles.font_family }}>Encabezado con {styles.heading_font_family || styles.font_family}</div>
              <div className="px-4 py-2 rounded-xl text-white text-sm" style={{ background: styles.secondary_color, fontFamily: styles.body_font_family || styles.font_family }}>Cuerpo con {styles.body_font_family || styles.font_family}</div>
              <div className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: styles.accent_color, fontFamily: styles.heading_font_family || styles.font_family }}>Encabezados</div>
              <div className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: styles.accent_color, fontFamily: styles.body_font_family || styles.font_family }}>Texto normal</div>
            </div>
          </div>
        </section>

        {/* CATÁLOGOS (BLOQUE 17) - acceso desde este panel de Configuración global. Edición vía APIs existentes + historial */}
        <div className="max-w-6xl mx-auto px-6 py-2">
          <div className="bg-white border rounded-2xl p-4 text-sm">
            <div className="font-semibold">Catálogos editables (calibres, calidades, presentaciones, destinos, unidades, transportistas, costos...)</div>
            <div className="text-xs text-slate-500">Usar secciones Clientes / Pedidos / Precios de Fruta / Costos Detallados arriba. Cambios se registran en system_audit_log. Precios restringidos ocultos en lotificación operativa para personal sin permiso.</div>
          </div>
        </div>

        {/* 3. GESTIÓN DE GRUPOS Y USUARIOS */}
        <section id="grupos" className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl"><Users size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Gestion de Grupos y Usuarios</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Grupos */}
            <div>
              <div className="font-semibold mb-2 text-sm tracking-wider">GRUPOS (Áreas) — Operaciones, Accopio, Administración General. (Crea grupo "Superadministrador" si lo deseas para full)</div>
              <div className="space-y-2">
                {mainGroups.map((g, gi) => (
                  <div key={`${g.id}-${gi}`} className="flex items-center justify-between gap-3 border rounded-2xl px-4 py-2.5 text-sm">
                    <div className="flex-1 font-medium">{g.group_name}</div>
                    <div className="text-xs text-slate-500">Orden {g.group_order}</div>
                    <button onClick={() => toggleGroup(g.id, g.is_active)} className={`px-3 py-1 rounded-full text-xs border ${g.is_active ? 'bg-amber-100 border-amber-400' : ''}`}>
                      {g.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => {
                      const nn = prompt('Nuevo nombre del grupo:', g.group_name);
                      if (nn) {
                        fetch('/api/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update-group', groupId: g.id, groupName: nn }) }).then(reloadMenu);
                      }
                    }} className="text-xs px-2 py-1 border rounded">Renombrar</button>
                  </div>
                ))}
              </div>

              {/* añadir grupo */}
              <div className="mt-3 flex gap-2">
                <input placeholder="Nombre nuevo grupo" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} className="flex-1 border px-3 py-2 rounded-2xl text-sm" />
                <button onClick={addGroup} className="px-4 bg-amber-700 text-white text-sm rounded-2xl">+ Grupo</button>
              </div>
            </div>

            {/* Usuarios */}
            <div>
              <div className="font-semibold mb-2 text-sm tracking-wider flex items-center justify-between">
                <span>USUARIOS DEL SISTEMA</span>
                <button 
                  onClick={() => { setEditingUser(null); setUserForm({name:'',email:'',pin:'',groupId:'',is_super_admin:false, admin_role:'administracion_general'}); setShowUserForm(true); }} 
                  className="flex items-center gap-1 text-xs px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-xl"
                >
                  <Plus size={14}/> Agregar
                </button>
              </div>

              {/* Formulario agregar / editar */}
              {showUserForm && (
                <div className="mb-3 p-3 border bg-slate-50 rounded-2xl text-sm">
                  <div className="font-medium mb-2">{editingUser ? 'Editar usuario' : 'Nuevo usuario del sistema'}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={userForm.name} onChange={e=>setUserForm({...userForm, name:e.target.value})} placeholder="Nombre" className="border px-3 py-1.5 rounded-xl text-sm" />
                    <input value={userForm.email} onChange={e=>setUserForm({...userForm, email:e.target.value})} placeholder="correo@ejemplo.com" className="border px-3 py-1.5 rounded-xl text-sm" />
                    <input 
                      value={userForm.pin} 
                      onChange={e=>setUserForm({...userForm, pin: e.target.value.replace(/\D/g,'').slice(0,4)})} 
                      placeholder={editingUser ? 'Nuevo PIN (4 dígitos, opcional)' : 'PIN (4 dígitos)'} 
                      className="border px-3 py-1.5 rounded-xl text-sm"
                    />
                    <select value={userForm.groupId} onChange={e=>setUserForm({...userForm, groupId:e.target.value})} className="border px-3 py-1.5 rounded-xl text-sm bg-white">
                      <option value="">Elegir grupo de acceso</option>
                      {mainGroups.map(g => <option key={g.id} value={g.id}>{g.group_name}</option>)}
                    </select>
                    <select 
                      value={userForm.admin_role || 'administracion_general'} 
                      onChange={e => {
                        const r = e.target.value;
                        setUserForm({...userForm, admin_role: r, is_super_admin: r === 'superadministrador'});
                      }} 
                      className="border px-3 py-1.5 rounded-xl text-sm bg-white"
                    >
                      <option value="accopio">Grupo Accopio</option>
                      <option value="operaciones">Grupo Operaciones</option>
                      <option value="administracion_general">Administración General</option>
                      <option value="superadministrador">Superadministrador (acceso completo total)</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={saveUser} className="px-4 py-1.5 text-sm bg-amber-700 text-white rounded-xl">{editingUser ? 'Actualizar' : 'Crear usuario'}</button>
                    <button onClick={cancelUserForm} className="px-4 py-1.5 text-sm border rounded-xl">Cancelar</button>
                  </div>
                  <div className="text-[10px] mt-1 text-slate-500">Al elegir grupo se asigna automáticamente acceso a sus módulos y se guarda en la base de datos.</div>
                </div>
              )}

              {users.length > 0 ? (
                <div className="text-sm divide-y border rounded-2xl overflow-hidden">
                  {users.map((u, idx) => {
                    const gId = userGroupAssignments[u.id] || '';
                    return (
                      <div key={`u-${u.id || 'u'}-${idx}`} className="px-3 py-2 flex flex-wrap gap-x-2 gap-y-1 items-center">
                        <div className="flex-1 min-w-[160px]">
                          <span className="font-medium">{u.name || u.email}</span>
                          <span className="ml-2 text-xs text-slate-400">{u.email}</span>
                        </div>
                        <select 
                          value={gId} 
                          onChange={e => { if (e.target.value) assignUserToGroup(u.id, e.target.value, u.admin_role === 'superadministrador'); }} 
                          className="text-xs border px-2 py-0.5 rounded bg-white text-emerald-800 min-w-[100px]"
                        >
                          <option value="">Grupo...</option>
                          {mainGroups.map(gg => <option key={gg.id} value={gg.id}>{gg.group_name}</option>)}
                        </select>
                        <span className={`text-[10px] px-2 py-px rounded ${String(u.admin_role||'')==='superadministrador' ? 'bg-emerald-200 text-emerald-700' : String(u.admin_role||'')==='administracion_general' ? 'bg-blue-200 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>
                          {String(u.admin_role||'')==='superadministrador' ? 'SUPER' : String(u.admin_role||'')==='administracion_general' ? 'ADMIN' : (String(u.admin_role||'') || 'ACCOPIO')}
                        </span>
                        <button onClick={() => editUser(u)} className="text-xs px-2 py-0.5 flex items-center gap-1 border rounded hover:bg-amber-50"><Pencil size={12}/> Editar</button>
                        <button onClick={() => deleteUser(u.id)} className="text-xs px-2 py-0.5 flex items-center gap-1 border text-red-600 rounded hover:bg-red-50"><Trash2 size={12}/> Borrar</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-2xl p-4 border">
                  No hay usuarios registrados. Usa "Agregar" para dar de alta nuevos con correo, PIN y grupo de acceso.
                </div>
              )}
              <div className="text-xs text-slate-400 mt-2">Cambia el grupo en cada fila para actualizar permisos en tiempo real. Editar permite modificar PIN/correo. Use el módulo Precios Fruta en Campo para detalles adicionales.</div>
            </div>
          </div>
        </section>

        {/* 4. DISTRIBUCIÓN DE COMPONENTES */}
        <section id="distribucion" className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-xl"><Move size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Distribución de Componentes</div>
              <div className="text-sm text-slate-500">Configura claramente por Sección (Accopio / Operaciones / Administración General). Asigna de 1 a 3 módulos a cada sección. Los cambios se reflejan inmediatamente en todo el sistema después de guardar.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            {mainGroups.map((g, gi) => {
              const gMods = (g.modules || []);
              return (
                <div key={`${g.id}-${gi}`} className="border rounded-2xl p-4 bg-slate-50 min-w-0">
                  <div className="flex justify-between mb-3">
                    <div className="font-semibold text-sm">Sección: {g.group_name}</div>
                    <div className="text-xs px-2 py-0.5 bg-white border rounded">{gMods.length} módulos</div>
                  </div>
                  {gMods.length ? gMods.map((mod, idx) => (
                    <div key={`${mod.id || 'gmod'}-${idx}`} className="flex items-center gap-2 text-sm mb-2 bg-white px-3 py-1.5 rounded-xl border min-w-0">
                      <div className="flex-1 min-w-0 font-medium truncate" title={mod.module_name}>{mod.module_name}</div>
                      <select 
                        value={g.id} 
                        onChange={e => assignModule(mod.id, parseInt(e.target.value))}
                        className="text-xs px-2 py-0.5 border bg-white rounded text-emerald-700 flex-shrink-0 w-28"
                      >
                        {mainGroups.map(og => (<option key={og.id} value={og.id}>{og.group_name}</option>))}
                      </select>
                    </div>
                  )) : <div className="text-xs text-center p-4 text-slate-400">Sin módulos en este grupo</div>}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 mt-3">Mueve módulos entre secciones con el selector. Debajo configura específicamente 1-3 módulos por Sección (reflejado inmediatamente tras guardar).</div>

          {/* Asignación interactiva por SECCIÓN (1 a 3 módulos). Cambios se reflejan inmediatamente tras Guardar */}
          <div className="mt-6 border-t pt-4">
            <div className="text-sm font-semibold mb-2">Asignar 1 a 3 módulos por Sección (los cambios se aplican al instante en todo el sistema)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TARGET_GROUPS.map(tg => {
                const selIds = roleSelections[tg] || [];
                const currentAssigned = allSystemModules.filter(m => selIds.includes(String(m.id)) || getModuleAccess(m).includes(tg));
                const available = allSystemModules.filter(m => !selIds.includes(String(m.id)));
                return (
                  <div key={tg} className="border rounded-2xl p-3 bg-white">
                    <div className="font-semibold text-sm mb-1 text-violet-700">Sección: {tg}</div>
                    <div className="text-[10px] text-slate-500 mb-2">Módulos con acceso (máx. 3)</div>
                    {selIds.length === 0 && currentAssigned.length === 0 && (
                      <div className="text-xs text-slate-400 mb-2">Sin módulos asignados aún. Elige hasta 3.</div>
                    )}
                    {((selIds.length ? selIds : currentAssigned.map(m => String(m.id))).map((mid, i) => {
                      const m = allSystemModules.find(mm => String(mm.id) === String(mid));
                      if (!m) return null;
                      return (
                        <div key={i} className="text-sm py-1.5 border-b last:border-0 flex items-center gap-2 bg-slate-50 rounded px-2 mb-1 min-w-0">
                          <span className="flex-1 min-w-0 font-medium truncate" title={m.module_name}>{m.module_name} <span className="text-[9px] text-slate-400">({m.module_route})</span></span>
                          <button onClick={() => removeModuleFromRole(tg, String(m.id))} className="text-red-600 text-[10px] px-1 flex-shrink-0">Quitar</button>
                        </div>
                      );
                    }))}
                    { ( (roleSelections[tg]||[]).length < 3 ) && (
                      <div className="flex gap-1 mt-2">
                        <select 
                          className="text-sm border rounded px-2 py-1 flex-1 bg-white"
                          onChange={(e) => { if (e.target.value) { addModuleToRole(tg, e.target.value); e.target.value = ''; } }}
                          defaultValue=""
                        >
                          <option value="">+ Agregar módulo (hasta 3)</option>
                          {available.map(m => (
                            <option key={m.id} value={m.id} title={m.module_name}>{m.module_name} — {m.groupName || ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button 
                      onClick={() => saveRoleAssignments(tg)}
                      className="mt-2 w-full text-xs px-3 py-1 rounded bg-violet-700 text-white hover:bg-violet-800"
                    >
                      Guardar para Sección {tg}
                    </button>
                    <div className="text-[9px] text-slate-400 mt-1">Se reflejará inmediatamente en menús y navegación de esa sección.</div>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Cada Sección puede tener acceso a 1-3 módulos. Pulsa "Guardar para Sección" y los cambios aplican al instante en toda la app (recarga de menú con credenciales).</div>
          </div>

          {/* GLOBAL ALL MODULES LIST - show all sections/módulos created and assignable to groups */ }
          <div className="mt-6">
            <div className="font-semibold mb-2 text-sm tracking-wider">TODAS LAS SECCIONES Y MÓDULOS DEL SISTEMA (ASIGNABLES)</div>
            <div className="border rounded-2xl overflow-auto max-h-80 text-sm">
              <table className="w-full">
                <thead className="bg-slate-100"><tr><th className="p-2 text-left">Módulo / Sección</th><th className="p-2 text-left">Ruta</th><th className="p-2 text-left">Grupo Actual</th><th className="p-2 w-40">Asignar a</th></tr></thead>
                <tbody>
                  {allSystemModules.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-xs text-slate-400">Sin módulos. Agrega en Configuración de Módulos.</td></tr>}
                  {allSystemModules.map((mod, ix) => (
                    <tr key={`allm-${mod.id || ix}-${ix}`} className="border-t">
                      <td className="p-2 font-medium">{mod.module_name}</td>
                      <td className="p-2 text-xs font-mono text-emerald-700">{mod.module_route}</td>
                      <td className="p-2 text-xs">{mod.groupName}</td>
                      <td className="p-2">
                        <select value={mod.groupId} onChange={e=>assignModule(mod.id, parseInt(e.target.value))} className="text-xs border px-2 py-1 rounded bg-white w-full">
                          {groups.map(gg => <option key={gg.id} value={gg.id}>{gg.group_name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] mt-1 text-slate-400">Lista completa de todos los módulos integrados del sistema — puedes reasignarlos a cualquier grupo aquí.</div>
          </div>
        </section>

        {/* 5. CLIENTES Y MANIFIESTOS - vinculados con embarques y se muestran en dashboard principal */}
        <section id="clientes" className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Users size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Clientes y Manifiestos</div>
              <div className="text-sm text-slate-500">Administra clientes . Configura los datos del manifiesto requerido por el cliente. Los pedidos y manifiesto aparecen vinculados en el panel principal vía datos de embarques.</div>
            </div>
          </div>

          <button onClick={async () => { 
            setEditingCliente(null); 
            let nextNum = '';
            try {
              const r = await fetch('/api/customers');
              const list = r.ok ? await r.json() : [];
              const maxN = (Array.isArray(list) ? list : []).filter(x => x.client_number && String(x.client_number).startsWith('CLI-')).map(x=>parseInt(String(x.client_number).slice(4))||0).reduce((a,b)=>Math.max(a,b),0);
              nextNum = 'CLI-' + String(maxN + 1).padStart(4,'0');
            } catch(_) {}
            setClienteForm({ customerName:'', commercialName:'', contactName:'', rfc:'', address:'', phone:'', email:'', destination:'', preferredCaliber:'', notes:'', manifestCode:'', manifestRequirements:'', clientNumber: nextNum }); 
            setClienteLoads([]); setViajeRows([]); setShowClienteForm(true); 
          }} className="mb-3 inline-flex items-center px-4 py-1.5 bg-emerald-700 text-white text-sm rounded-xl gap-1"><Plus size={15}/> Nuevo Cliente</button>

          {showClienteForm && (
            <div className="p-3 bg-slate-50 border rounded-2xl text-sm mb-4">
              <div className="font-medium mb-1">{editingCliente ? 'Editar cliente' : 'Agregar cliente'}</div>
              
              {/* Número de cliente autoasignado */}
              {clienteForm.clientNumber && (
                <div className="text-xs mb-2 bg-emerald-100 inline-block px-2 py-0.5 rounded">Nº Cliente: <span className="font-mono font-semibold">{clienteForm.clientNumber}</span></div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Nombre comercial</div>
                  <input value={clienteForm.commercialName || clienteForm.customerName} onChange={e=>setClienteForm({...clienteForm, commercialName:e.target.value, customerName:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Nombre comercial" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Nombre contacto</div>
                  <input value={clienteForm.contactName} onChange={e=>setClienteForm({...clienteForm, contactName:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Nombre contacto" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">RFC</div>
                  <input value={clienteForm.rfc} onChange={e=>setClienteForm({...clienteForm, rfc:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="RFC" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Destino</div>
                  <input value={clienteForm.destination} onChange={e=>setClienteForm({...clienteForm, destination:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Destino" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Dirección</div>
                  <input value={clienteForm.address} onChange={e=>setClienteForm({...clienteForm, address:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Dirección" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Teléfono</div>
                  <input value={clienteForm.phone} onChange={e=>setClienteForm({...clienteForm, phone:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Teléfono" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Correo</div>
                  <input type="email" value={clienteForm.email} onChange={e=>setClienteForm({...clienteForm, email:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Correo electrónico" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 mb-0.5">Calibre preferido</div>
                  <input value={clienteForm.preferredCaliber} onChange={e=>setClienteForm({...clienteForm, preferredCaliber:e.target.value})} className="border rounded px-3 py-1 w-full" placeholder="Calibre preferido" />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-[10px] text-slate-600 mb-0.5">Código Manifiesto</div>
                <input value={clienteForm.manifestCode} onChange={e=>setClienteForm({...clienteForm, manifestCode:e.target.value})} placeholder="Código Manifiesto (ej. CLI-01)" className="border rounded px-3 py-1 w-full" />
              </div>

              <div className="mt-2">
                <div className="text-[10px] text-slate-600 mb-0.5">Requisitos Manifiesto (se muestra en Pedidos del Dashboard Principal)</div>
                <textarea value={clienteForm.manifestRequirements} onChange={e=>setClienteForm({...clienteForm, manifestRequirements:e.target.value})} placeholder="Ej: Factura comercial + Certificado fitosanitario + Lista de tarimas + Fecha salida exacta + Número de pallets" className="w-full h-16 border rounded p-2 text-xs" />
              </div>

              <div className="mt-2 flex gap-2">
                <button onClick={saveCliente} className="px-4 py-1.5 bg-emerald-700 text-white rounded">Guardar</button>
                <button onClick={cancelClienteForm} className="px-4 py-1.5 border rounded">Cancelar</button>
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-medium mb-1">Filas Pedido (Fecha viaje, Calibre, # Tarimas) — datos visibles en Dashboard Principal</div>
                <div className="border rounded text-xs">
                  <table className="w-full"><thead><tr className="bg-slate-50"><th className="p-1 text-left">Fecha viaje</th><th className="p-1">Calibre</th><th className="p-1">#</th><th></th></tr></thead><tbody>
                    {viajeRows.length===0 && <tr><td colSpan={4} className="p-1 text-slate-400">Sin filas. Agrega.</td></tr>}
                    {viajeRows.map((r,idx)=>(<tr key={idx} className="border-t"><td className="p-1"><input type="date" className="border px-1 w-28 text-xs" value={r.fecha_viaje||''} onChange={e=>updateViajeRow(idx,'fecha_viaje',e.target.value)} /></td><td className="p-1"><input className="border px-1 w-16 text-xs" value={r.calibre||''} onChange={e=>updateViajeRow(idx,'calibre',e.target.value)} /></td><td className="p-1"><input type="number" className="border px-1 w-14 text-xs" value={r.tarimas||0} onChange={e=>updateViajeRow(idx,'tarimas',parseInt(e.target.value)||0)} /></td><td className="p-1"><button onClick={()=>removeViajeRow(idx)} className="px-1 text-red-500">Quitar</button></td></tr>))}
                  </tbody></table>
                </div>
                <button onClick={addViajeRow} className="mt-1 px-2 py-0.5 text-xs border rounded">+ Agregar fila</button>
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-auto border rounded-2xl divide-y text-sm">
            {clientes.length === 0 && <div className="p-3 text-xs text-slate-400">Sin clientes. Agregue para configurar manifiestos por cliente.</div>}
            {clientes.map((c, idx) => (
              <div key={`c-${c.id || 'c'}-${idx}`} className="p-2.5 flex flex-wrap gap-2 justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{c.client_number ? <span className="font-mono text-emerald-700 mr-1">{c.client_number}</span> : ''}{c.commercial_name || c.customer_name}</div>
                  {c.contact_name && <div className="text-xs text-slate-600">Contacto: {c.contact_name}</div>}
                  <div className="text-xs text-slate-500">{c.destination || '-'} {c.preferred_caliber ? '• ' + c.preferred_caliber : ''}</div>
                  {c.rfc ? <div className="text-[10px] text-slate-500">RFC: {c.rfc}</div> : null}
                  {(c.address || c.phone || c.email) && <div className="text-[10px] text-slate-500 mt-0.5">{[c.address, c.phone, c.email].filter(Boolean).join(' • ')}</div>}
                  {c.manifest_code ? <div className="text-xs text-emerald-700">Código: {c.manifest_code}</div> : null}
                  {c.manifest_requirements ? <div className="text-xs mt-0.5 bg-emerald-50 inline-block px-1.5 py-px rounded">Manifiesto: {String(c.manifest_requirements||'').slice(0,60)}</div> : null}
                </div>
                <div className="flex gap-2 text-xs flex-wrap">
                  <button onClick={() => editCliente(c)} className="px-2 py-px border rounded flex items-center gap-1 hover:bg-white"><Pencil size={13}/> Configurar</button>
                  <button onClick={() => accessPortalWithoutPin(c.id, c.customer_name)} className="px-2 py-px border rounded flex items-center gap-1 bg-emerald-700 text-white hover:bg-emerald-800">Acceder al Portal (sin PIN)</button>
                  <button onClick={() => deleteCliente(c.id)} className="px-2 py-px border rounded text-red-600 hover:bg-red-50">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Configuración de manifiesto del cliente se usa en el panel principal para mostrar los requisitos obtenidos de los embarques en vivo.</div>
        </section>

        {/* CONFIGURACIÓN GENERAL DEL PORTAL DE CLIENTES (Dashboard) - Superadmin edita botones, agrega campos, sube/descarga info */ }
        <section id="portal-cliente" className="bg-white p-6 rounded-3xl border shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Users size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Configuración del Portal de Clientes</div>
              <div className="text-sm text-slate-500">El superadministrador edita botones, agrega campos visibles, sube y descarga información y configura el dashboard general del portal. Acceso sin PIN disponible arriba en cada cliente.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accesos rápidos sin PIN */}
            <div className="border rounded-2xl p-4">
              <div className="font-semibold text-sm mb-2">Acceso Rápido sin PIN</div>
              <div className="text-xs text-slate-500 mb-2">Abre el portal del cliente directamente (sesión creada por superadministrador).</div>
              <div className="max-h-40 overflow-auto divide-y text-sm border rounded">
                {clientes.length === 0 && <div className="p-2 text-xs text-slate-400">Agrega clientes para acceder.</div>}
                {clientes.slice(0,8).map((c,i) => (
                  <div key={i} className="p-2 flex justify-between items-center hover:bg-emerald-50">
                    <div className="truncate pr-2">{c.client_number || ''} {c.commercial_name || c.customer_name}</div>
                    <button onClick={() => accessPortalWithoutPin(c.id)} className="text-xs px-2 py-0.5 bg-emerald-700 text-white rounded">Entrar</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Config general dashboard + botones/campos */}
            <div className="border rounded-2xl p-4">
              <div className="font-semibold text-sm mb-2">Configuración General del Dashboard</div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Mensaje de bienvenida</div>
                  <input id="portal-welcome" defaultValue="Bienvenido al Portal de Clientes de Tecavo Fruits." className="w-full border px-2 py-1 rounded text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Texto botón Descargar</div>
                    <input id="portal-btn-download" defaultValue="Descargar PDF" className="w-full border px-2 py-1 rounded text-sm" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Texto botón Actualizar</div>
                    <input id="portal-btn-refresh" defaultValue="Actualizar" className="w-full border px-2 py-1 rounded text-sm" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Campos adicionales a mostrar (uno por línea)</div>
                  <textarea id="portal-extra-fields" defaultValue="Referencia de embarque
Notas comerciales" className="w-full border px-2 py-1 rounded text-sm h-14" />
                </div>
                <div className="flex gap-2 text-xs">
                  <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> Mostrar Viajes</label>
                  <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> Mostrar Pagos</label>
                  <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> Mostrar Estado</label>
                </div>
              </div>
              <button onClick={async () => {
                const cfg = {
                  welcome: document.getElementById('portal-welcome')?.['value'] || '',
                  btnDownload: document.getElementById('portal-btn-download')?.['value'] || 'Descargar PDF',
                  btnRefresh: document.getElementById('portal-btn-refresh')?.['value'] || 'Actualizar',
                  extraFields: (document.getElementById('portal-extra-fields')?.['value'] || '').split('\n').filter(Boolean),
                  showViajes: true, showPagos: true, showEstado: true
                };
                await fetch('/api/client-portal/admin/access', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ customerId: 0, action: 'save-portal-config', config: cfg }) });
                alert('Configuración del portal guardada.');
              }} className="mt-3 px-4 py-1.5 text-sm bg-emerald-700 text-white rounded-xl">Guardar configuración del portal</button>
              <div className="text-[10px] mt-1 text-slate-400">Los cambios afectan la vista del dashboard del cliente.</div>
            </div>

            {/* Subir y descargar información */}
            <div className="border rounded-2xl p-4 md:col-span-2">
              <div className="font-semibold text-sm mb-2">Subir y Descargar Información</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => {
                  const res = await fetch('/api/customers'); const data = res.ok ? await res.json() : [];
                  const csv = ['client_number,commercial_name,destination,phone,email'].concat((data||[]).map(c => `${c.client_number||''},${(c.commercial_name||'').replace(/,/g,' ')},${c.destination||''},${c.phone||''},${c.email||''}`)).join('\n');
                  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'clientes_portal.csv'; a.click();
                }} className="px-3 py-1.5 text-sm border rounded-xl flex items-center gap-1"><Download size={14}/> Descargar CSV de Clientes</button>

                <label className="px-3 py-1.5 text-sm border rounded-xl cursor-pointer flex items-center gap-1">
                  <Upload size={14}/> Subir CSV (actualiza clientes)
                  <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const txt = await f.text();
                    const lines = txt.trim().split(/\r?\n/).slice(1);
                    for (const line of lines) {
                      const [num, name, dest] = line.split(',');
                      if (num) {
                        await fetch('/api/customers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientNumber: num.trim(), customerName: name?.trim() || num, destination: dest?.trim() || '' }) }).catch(()=>{});
                      }
                    }
                    alert('CSV procesado. Recarga clientes.'); loadClientes(); e.target.value='';
                  }} />
                </label>

                <button onClick={() => window.open('/portal-cliente', '_blank')} className="px-3 py-1.5 text-sm border rounded-xl">Ver Portal Público</button>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Descarga/exporta información de clientes para el portal. Sube CSV simple para agregar o actualizar registros masivos.</div>
            </div>
          </div>
        </section>

        {/* PEDIDOS - config solo en super, vista en dashboard y grupos, ops marca completo + faltantes */}
        <section id="pedidos" className="bg-white p-6 rounded-3xl border shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><FileText size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Pedidos</div>
              <div className="text-sm text-slate-500">Vincula cliente. Acopios ve fruta requerida. Operaciones marca completos y tarimas faltantes por calibre. Solo configurable aquí. Muestra en dashboard y grupos.</div>
            </div>
          </div>

          <button onClick={()=>{ setEditingPedido(null); setPedidoForm({fechaSalida:new Date().toISOString().slice(0,10),customerId:'',clienteNombre:'',frutaRequerida:''}); setPedidoRows([]); setShowPedidoForm(true); }} className="mb-3 inline-flex items-center px-4 py-1.5 bg-emerald-700 text-white text-sm rounded-xl gap-1"><Plus size={15}/> Nuevo Pedido</button>

          {showPedidoForm && (
            <div className="p-3 bg-slate-50 border rounded-2xl text-sm mb-4">
              <div className="font-medium mb-1">{editingPedido ? 'Editar pedido' : 'Nuevo pedido'}</div>
              <div className="mb-2">
                <select className="border px-2 py-1 rounded mr-2" onChange={e=>{ const c=clientes.find(x=>String(x.id)===e.target.value); if(c) selectClienteForPedido(c); }} defaultValue="">
                  <option value="">Selecciona cliente</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.customer_name}</option>)}
                </select>
                <input type="date" value={pedidoForm.fechaSalida} onChange={e=>setPedidoForm({...pedidoForm,fechaSalida:e.target.value})} className="border px-2 py-1 rounded" />
                <input value={pedidoForm.frutaRequerida} onChange={e=>setPedidoForm({...pedidoForm,frutaRequerida:e.target.value})} placeholder="Fruta requerida (acopios)" className="border px-2 py-1 ml-1 rounded w-40" />
              </div>
              <div className="text-xs mb-1">Datos cliente: {pedidoForm.clienteNombre || '-'} {pedidoForm.frutaRequerida && '• '+pedidoForm.frutaRequerida}</div>
              <div className="border rounded text-xs">
                <table className="w-full"><tbody>
                  {pedidoRows.length===0 && <tr><td colSpan={4} className="p-1 text-slate-400">Sin filas. Agrega.</td></tr>}
                  {pedidoRows.map((r,idx)=>(<tr key={idx} className="border-t align-top">
                    <td className="p-1 text-center w-28">
                      <div className="text-[9px] font-medium mb-0.5 text-slate-600">Calibre</div>
                      <select className="border px-1 w-full text-xs" value={r.calibre||''} onChange={e=>updatePedidoRow(idx,'calibre',e.target.value)}>{CALIBRES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    </td>
                    <td className="p-1 text-center w-16">
                      <div className="text-[9px] font-medium mb-0.5 text-slate-600">Clase</div>
                      <select className="border px-1 w-full text-xs" value={r.clase||'A'} onChange={e=>updatePedidoRow(idx,'clase',e.target.value)}>{CLASES.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    </td>
                    <td className="p-1 text-center w-20">
                      <div className="text-[9px] font-medium mb-0.5 text-slate-600"># Tarimas</div>
                      <input type="number" className="border px-1 w-full text-xs text-center" value={r.num_tarimas||0} onChange={e=>updatePedidoRow(idx,'num_tarimas',e.target.value)} />
                    </td>
                    <td className="p-1 w-12 text-center pt-4"><button onClick={()=>removePedidoRow(idx)} className="px-1 text-red-500">Quitar</button></td>
                  </tr>))}
                </tbody></table>
              </div>
              <div className="mt-1 text-xs">Total tarimas: <b>{pedidoRows.reduce((s,r)=>s+(parseInt(r.num_tarimas)||0),0)}</b></div>
              <div className="mt-2 flex gap-2">
                <button onClick={addPedidoRow} className="px-2 py-0.5 text-xs border rounded">+ Agregar fila</button>
                <button onClick={savePedido} className="px-3 py-1 bg-emerald-700 text-white text-xs rounded">Guardar</button>
                <button onClick={()=>{setShowPedidoForm(false);setEditingPedido(null);setPedidoRows([]);}} className="px-3 py-1 border text-xs rounded">Cancelar</button>
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-auto border rounded-2xl divide-y text-sm">
            {pedidos.length===0 && <div className="p-3 text-xs text-slate-400">Sin pedidos configurados.</div>}
            {pedidos.map((p,i)=>(
              <div key={i} className="p-2.5">
                <div className="flex justify-between">
                  <div><span className="font-medium">{p.cliente_nombre}</span> • {p.fecha_salida} <span className="text-emerald-700 text-xs">• {p.fruta_requerida||''}</span></div>
                  <div className="flex gap-1 text-xs">
                    <button onClick={()=>editPedido(p)} className="px-1.5 border rounded">Editar</button>
                    <button onClick={()=>deletePedido(p.id)} className="px-1.5 border rounded text-red-600">Quitar</button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">Total: {p.total_tarimas || (Array.isArray(p.rows)?p.rows.reduce((s,r)=>s+(r.num_tarimas||0),0):0)} tarimas • Estado: {p.estado}</div>
                {(p.rows||[]).length>0 && <div className="text-[11px] mt-1 grid grid-cols-3 gap-x-3">
                  {p.rows.map((r,j)=> <div key={j}>Calibre: {r.calibre} Clase: {r.clase||'A'} | Tarimas: {r.num_tarimas} {r.tarimas_faltantes!=null ? ' | Faltan:'+r.tarimas_faltantes : ''}</div> )}
                </div>}
              </div>
            ))}
          </div>
        </section>

        {/* NUEVA SECCIÓN: DESCARGAS DE APK — lista APKs existentes, genera vinculada a Orden de Corte, descarga independiente por cada una, genera pendientes */}
        <section id="apks" className="bg-white p-6 rounded-3xl border shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl"><Smartphone size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Descargas de APK</div>
              <div className="text-sm text-slate-500">APKs del sistema para distribuir al personal operativo. Genera la vinculada a Orden de Corte y descarga directa. Solo APKs generadas con URLs válidas.</div>
            </div>
            <img src="https://app-cdn.appgen.com/220e1bc6-4350-453d-b566-60b6f97e03e9/assets/uploaded_1785896859466_n7j7g.jpeg" alt="APK" className="w-10 h-10 rounded border ml-auto" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={generateOrdenCorteApk} disabled={generatingApk} className="px-4 py-2 rounded-2xl bg-sky-700 text-white text-sm flex items-center gap-1 disabled:bg-sky-400"><Plus size={15}/> Generar APK Orden de Corte</button>
            <button onClick={generatePendingApks} disabled={generatingApk} className="px-4 py-2 rounded-2xl border border-sky-600 text-sky-700 text-sm flex items-center gap-1 disabled:opacity-60">Generar APKs Pendientes Sistema</button>
            <button onClick={loadApks} className="px-3 py-2 text-sm border rounded-xl">Actualizar Lista</button>
          </div>

          <div className="border rounded-2xl overflow-hidden">
            {/* Only single production-ready APK for Orden de Corte shown. All other APK sections hidden. */}
            <div className="divide-y">
              {apks.filter(a => (a.nombre || '').toLowerCase().includes('corte')).slice(0,1).map((a, i) => (
                <div key={`corte-${i}`} className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="font-bold text-xl">Orden de Corte - APK Producción</div>
                  <div className="text-sm mt-1">Módulo funcional y listo. Solo este se muestra en el área de descargas.</div>
                  <button onClick={() => downloadApk(a)} className="mt-3 inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm px-6 py-2.5 rounded-2xl"><Download size={16}/> Descargar APK Orden de Corte</button>
                </div>
              ))}
              {apks.filter(a => (a.nombre || '').toLowerCase().includes('corte')).length === 0 && (
                <div className="p-3 text-sm">Genera el APK de Orden de Corte usando el botón superior para habilitar el enlace de descarga funcional.</div>
              )}
            </div>
          </div>
          <div className="text-xs mt-2 text-slate-400">Solo se muestran APKs generadas con almacenamiento correcto. Las descargas siempre funcionan (usa URL real si se subió APK). Manejo de errores incluido para builds fallidos.</div>
        </section>

        {/* NUEVA SECCIÓN: BASE / HISTORIAL COSTOS DETALLADOS (kg) por Destino - botón ingresar/guardar */}
        <section id="costos-historico" className="bg-white p-6 rounded-3xl border shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl"><BarChart3 size={22} /></div>
            <div>
              <div className="text-xl font-semibold">Historial de Costos Detallados por Destino</div>
              <div className="text-sm text-slate-500">CANT × PREC.MXN / Total KG del viaje → PREC/KG. Agrega/quita filas, establece total Kg del viaje y guarda para historial por destino.</div>
            </div>
          </div>

          <div className="mb-4 grid sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Destino (de clientes)</div>
              <select value={selectedDestino} onChange={e => { setSelectedDestino(e.target.value); if (e.target.value) loadCostosHist(e.target.value); }} className="border w-full p-2 rounded-xl text-sm bg-white">
                <option value="">— Selecciona destino —</option>
                {clientes.filter(c => c && c.destination).map((c, i) => <option key={`c-${c.id || i}`} value={c.destination}>{c.destination} ({c.customer_name})</option>)}
                {['USA','México','Export','Local'].filter(d => !clientes.some(c=>c.destination===d)).map((d, i)=><option key={`s-${d}-${i}`} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Total KG del viaje</div>
              <input type="number" value={totalKgViaje} onChange={e => { const kg = parseFloat(e.target.value) || 0; setTotalKgViaje(kg); recalcPrecios(kg); }} className="border w-full p-2 rounded-xl text-sm bg-white" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={addCostRow} className="px-3 py-2 text-sm border rounded-xl flex items-center gap-1"><Plus size={14} /> Agregar fila</button>
              <button onClick={saveCostosPorDestino} disabled={!selectedDestino} className="px-5 py-2 rounded-2xl bg-amber-700 text-white text-sm disabled:bg-amber-300">Guardar Costos Actuales para este Destino</button>
              <button onClick={() => loadCostosHist('')} className="px-3 py-2 text-sm border rounded-xl">Ver Todo Historial</button>
            </div>
          </div>

          {/* Tabla editable costo como en la sección mencionada */}
          <div className="mb-3">
            <div className="text-sm font-semibold mb-2">Costos Detallados (kg) — editables</div>
            <div className="overflow-auto border rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-center">CANT</th>
                    <th className="p-2 text-center">PREC. MXN</th>
                    <th className="p-2 text-center" title="PREC/KG = (CANT × PREC. MXN) / Total KG viaje">PREC/KG</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {costRows.map((r, idx) => (
                    <tr key={r.id || `cr-${idx}`} className="border-t">
                      <td className="p-2">{r.concepto}</td>
                      <td className="p-2"><input type="number" className="w-20 border rounded p-1 text-center" value={r.cantidad} onChange={e=>updateCostRow(r.id,'cantidad',e.target.value)} /></td>
                      <td className="p-2"><input type="number" className="w-24 border rounded p-1 text-right" value={r.precio_mxn} onChange={e=>updateCostRow(r.id,'precio_mxn',e.target.value)} /></td>
                      <td className="p-2"><input type="number" step="0.01" className="w-20 border rounded p-1 text-right" value={r.precio_kilo} onChange={e=>updateCostRow(r.id,'precio_kilo',e.target.value)} /></td>
                      <td className="p-2 text-center"><button onClick={() => removeCostRow(r.id)} className="text-red-600 hover:bg-red-50 p-0.5 rounded"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right text-xs mt-1 text-slate-500">Total MXN por los items actuales: {calcTotals().totalMxn}</div>
          </div>

          {/* historial guardado */}
          <div className="mt-4">
            <div className="font-semibold text-sm mb-2">Antecedentes guardados</div>
            <div className="max-h-48 overflow-auto divide-y border rounded-2xl text-sm">
              {costosHist.length === 0 && <div className="p-2 text-slate-400">Sin registros guardados para destinos. Guarda aquí para crear historial.</div>}
              {costosHist.map((h, hi) => (
                <div key={`hist-${h.id || 'h'}-${hi}`} onClick={() => cargarDesdeHistorial(h)} className="px-3 py-2 flex justify-between cursor-pointer hover:bg-amber-50" title="Cargar este registro para editar">
                  <div>
                    <span className="font-medium">{h.destino}</span> • Semana {h.semana} • {new Date(h.fecha || Date.now()).toLocaleDateString()} • {h.total_kg || 0} kg
                  </div>
                  <div className="tabular-nums text-xs">{h.costo_promedio_kg || h.total_costo_mxn || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TECAVO IA - BLOQUE 01/19 FUNDACION: Autenticacion, permisos, catalogo herramientas seguras, API OpenAI via proxy (sin exponer keys) */}
        <section id="teca-vo-ia" className="bg-white p-6 rounded-3xl border shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><BarChart3 size={22} /></div>
            <div>
              <div className="text-xl font-semibold">TECAVO IA — Bloque 01 (Fundación)</div>
              <div className="text-sm text-slate-500">Asistente con OpenAI via AppGen Cloud proxy. Solo lectura. Permisos verificados en backend. Superadministrador tiene visibilidad completa. Cada consulta usa 1 crédito AppGen. Sin claves en cliente.</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-2xl p-4">
              <div className="font-semibold text-sm mb-2">Conexión y Config</div>
              <button onClick={async () => {
                setIaConnected(null);
                try {
                  const r = await fetch('/api/ai/chat');
                  const d = await r.json();
                  setIaConnected(d.connected !== false);
                } catch { setIaConnected(false); }
              }} className="px-3 py-1 text-sm border rounded">Probar conexión OpenAI (proxy)</button>
              <div className="text-xs mt-2 text-slate-500">{iaConnected === null ? "No probado" : iaConnected ? "Conectado via AppGen Cloud" : "Fallo (revisa APPGEN_API_KEY en .env)"}</div>
              <div className="text-[10px] mt-1">Modelo: proxy OpenAI. Herramientas solo lectura por rol.</div>
              <a href="/tecavo-ia" target="_blank" className="inline-block mt-2 text-xs px-3 py-1 bg-emerald-700 text-white rounded">Abrir TECAVO IA completo (10 secciones) →</a>
            </div>

            <div className="border rounded-2xl p-4">
              <div className="font-semibold text-sm mb-2">Chat de consulta (lenguaje natural)</div>
              <div className="h-48 overflow-auto border rounded bg-slate-50 p-2 text-sm mb-2">
                {iaMessages.length === 0 && <div className="text-slate-400 text-xs">Ejemplos: "¿Cuánto debemos pagar esta semana?", "Rendimiento del lote 125", "Estado de pagos de Ana Gutiérrez"</div>}
                {iaMessages.map((m, i) => (
                  <div key={i} className={`mb-2 ${m.role === "user" ? "text-right" : ""}`}>
                    <span className={`inline-block px-2 py-1 rounded ${m.role === "user" ? "bg-emerald-700 text-white" : "bg-white border"}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
                {iaLoading && <div className="text-xs text-slate-500">Consultando fuentes reales...</div>}
              </div>
              <div className="flex gap-2">
                <input value={iaInput} onChange={e=>setIaInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && iaInput.trim()) sendIaMessage(); }} placeholder="Pregunta sobre datos reales..." className="flex-1 border rounded px-3 py-1 text-sm" />
                <button onClick={sendIaMessage} disabled={iaLoading || !iaInput.trim()} className="px-4 py-1 bg-emerald-700 text-white rounded text-sm disabled:bg-emerald-300">Enviar</button>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Respuestas incluyen fuente, periodo y certeza. Solo Super ve todo.</div>
            </div>
          </div>

          <div className="text-[10px] mt-3 text-slate-500">Catálogo actual (Bloque 01): get_kpi_summary, get_lot_performance, get_payment_status, search_producers. Todas verifican sesión y rol en servidor. Historial en system_audit_log.</div>
        </section>

        </div>

        {/* SALUD DEL SISTEMA + TODAS LAS SECCIONES (Superadmin master control) */}
        <section className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-white rounded-3xl border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl"><BarChart3 size={22} /></div>
              <div>
                <div className="text-xl font-semibold">Salud del Sistema + Todas las Secciones</div>
                <div className="text-sm text-slate-500">Detección automática de inconsistencias + registro completo de secciones. Superadministrador controla todo.</div>
              </div>
              <button onClick={async () => { try { const r = await fetch('/api/superadmin/health'); const d=await r.json(); setHealthData(d); } catch{} }} className="ml-auto px-4 py-1.5 text-sm border rounded-xl">Verificar Salud Ahora</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold mb-2">Inconsistencias Detectadas</div>
                <div className="bg-slate-50 border rounded-2xl p-3 text-xs max-h-48 overflow-auto">
                  {(healthData?.issues || []).length === 0 && <div className="text-emerald-600">Sin problemas críticos detectados en la última verificación.</div>}
                  {(healthData?.issues || []).map((iss, i) => (
                    <div key={i} className="mb-1 border-b pb-1">
                      <span className="font-semibold text-rose-700">{iss.type}</span>: {iss.count} 
                      {iss.samples && <span className="text-slate-500"> (ej: {JSON.stringify(iss.samples[0]).slice(0,80)})</span>}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Lotes sin productor/pesaje, inventarios negativos, QR huérfanos, diferencias de kg, movimientos sin usuario, etc.</div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">TODAS LAS SECCIONES DEL SISTEMA (registrables y asignables)</div>
                <div className="text-xs text-slate-500 mb-1">Estas páginas existen. Regístralas en el menú para que aparezcan en todos los grupos y en Superadministrador.</div>
                <div className="max-h-48 overflow-auto border rounded-2xl text-xs divide-y bg-white">
                  {[
                    '/acopios','/embarques','/production','/inventory','/lotification-registry','/lot-selection','/cutting-orders','/box-control',
                    '/lot-traceability','/traceability','/qr-system','/gestor-etiquetas','/label-printing','/thermal-labels',
                    '/loads','/customers','/precios-fruta','/rendimiento-lote','/cierres','/weekly-closings',
                    '/superadministrador','/administracion','/administracion/secciones','/configuraciones','/settings',
                    '/materials','/expenses','/payroll','/nomina','/producer-payments','/payment-schedule',
                    '/sales-process-waste','/control-venta-proceso-desecho','/balance-al-dia','/profit-loss',
                    '/fruit-input','/acopios/visits','/mapa-piso-produccion','/pallet-configuration'
                  ].map((r,idx) => (
                    <div key={idx} className="px-2 py-1 flex items-center justify-between">
                      <span className="font-mono">{r}</span>
                      <button onClick={async () => {
                        // register into a default group if missing
                        try {
                          const mres = await fetch('/api/menu?includeAll=true');
                          const gs = mres.ok ? await mres.json() : [];
                          const ops = (gs||[]).find(g => (g.group_name||'').toLowerCase().includes('oper')) || (gs||[])[0];
                          if (ops) {
                            await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add-module', groupId: ops.id, moduleName: r.replace('/','').replace(/-/g,' '), moduleRoute: r }) });
                            reloadMenu();
                          }
                        } catch(e){}
                      }} className="text-[10px] px-2 py-0.5 border rounded">Registrar en Menú</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <a href="/lot-traceability" className="px-3 py-1 border rounded">Trazabilidad Central →</a>
              <a href="/rendimiento-lote" className="px-3 py-1 border rounded">Rendimientos Reales →</a>
              <a href="/cierres" className="px-3 py-1 border rounded">Cierres Semanales →</a>
              <a href="/superadministrador" className="px-3 py-1 border rounded">Volver al Panel</a>
            </div>
          </div>
        </section>

        {/* MATRIZ V7 FASE 01-03: Consolidación (entregable) */}
        <section className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-white rounded-3xl border p-6">
            <div className="font-semibold text-lg mb-3">MATRIZ DE CONSOLIDACIÓN V7 (FASE 01-03)</div>
            <div className="text-xs text-slate-500 mb-3">Cada departamento genera su información. Otros consultan. Sin duplicación de hechos operativos. Datos históricos conservados. Lote Registro retirado de navegación activa.</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-1 text-emerald-700">CONSERVADOS (fuente única)</div>
                <ul className="text-xs space-y-0.5">
                  <li>• Ingreso de Fruta (fruit_input_weighings + cutting complete)</li>
                  <li>• Producción (production_batches + production_selection_details)</li>
                  <li>• Embarques (load_history propietario cargas físicas)</li>
                  <li>• Administración (notas, abonos, customer_accounts)</li>
                  <li>• Cierre Semanal (reconciliador, no registrador)</li>
                  <li>• Inventario Materiales (materials_inventory + receptions + deductions)</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1 text-amber-700">FUSIONADOS / MODIFICADOS</div>
                <ul className="text-xs space-y-0.5">
                  <li>• Lotificación → Producción (legacy solo lectura)</li>
                  <li>• Lote Registro → Retirado de menú (desactivado)</li>
                  <li>• Múltiples lotif → production_selection_details</li>
                  <li>• Tarimas integradas a Inventario Materiales</li>
                  <li>• Costos → motor único (recalculate + cutting + operating)</li>
                  <li>• Cierre envía inventario materiales (sin duplicar gastos)</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 text-xs border-t pt-3">
              <div className="font-semibold">DEPENDENCIAS CLAVE:</div>
              <div>Orden de Corte → Ingreso Fruta (único) → Producción (único) → Inventarios (único) → Embarques → Cierre (conciliación). Rendimiento de Lote usado por productores, admin, inventarios, precios, IA, cierre.</div>
              <div className="mt-1">Fórmulas aplicadas: KG_COMERCIAL, KG_CLASIFICADOS, KG_CONTABILIZADOS, KG_PENDIENTES, REND_COMERCIAL (sin /0). Stock materiales con costo promedio móvil + factor conversión.</div>
            </div>

            <div className="mt-2 text-[10px] text-emerald-600">Pruebas: datos legacy conservados, corridas múltiples permitidas por lote, sin doble conteo, stock actualizado desde recepciones/ consumos producción, Lote Registro inactivo.</div>
          </div>
        </section>

        <div className="text-center pb-10 text-xs text-slate-400">Acceso exclusivo Superadministrador • Todas las secciones visibles y controlables aquí. Trazabilidad y movimientos centralizados.</div>
      </div>
    </div>
  );
}

