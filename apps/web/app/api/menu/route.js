import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^\/+/, '')
  .trim();

const credentialAliases = {
  campo: ['campo', 'acopio', 'accopio'],
  operaciones: ['operaciones'],
  administrador: ['administrador', 'administracion_general', 'administrador_principal'],
  superadministrador: ['superadministrador']
};

const normalizeCredential = (credential) => {
  const clean = normalizeText(credential);
  if (clean === 'accopio' || clean === 'acopio') return 'campo';
  if (clean === 'administracion_general' || clean === 'administrador_principal') return 'administrador';
  return clean;
};

const getAccessRoleKey = (val) => {
  const n = normalizeText(val || '').replace(/[\s_]+/g, '');
  if (!n) return '';
  if (n.includes('acop') || n.includes('campo')) return 'campo';
  if (n.includes('oper')) return 'operaciones';
  if (n.includes('admin')) return 'administrador';
  return n;
};

async function getSessionUser() {
  const cookieStore = await cookies();
  const possibleTokens = [
    cookieStore.get('tecavo_session_token')?.value,
    cookieStore.get('better-auth.session_token')?.value,
  ].filter(Boolean);

  for (const token of possibleTokens) {
    try {
      const sessions = await sql`
        SELECT u.id, u.email, u.name, u.is_super_admin, u.admin_role
        FROM session s
        JOIN "user" u ON s."userId" = u.id
        WHERE s.token = ${token} AND s."expiresAt" > NOW()
        LIMIT 1
      `;
      if (sessions.length) return sessions[0];
    } catch (_) {}

    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const data = JSON.parse(decoded);
      const userId = data.userId || data.id;
      if (userId) {
        const users = await sql`
          SELECT id, email, name, is_super_admin, admin_role
          FROM "user"
          WHERE id = ${userId}
          LIMIT 1
        `;
        if (users.length) return users[0];
      }
    } catch (_) {}
  }
  return null;
}

function parseAccessList(groupAccess) {
  if (Array.isArray(groupAccess)) return groupAccess;
  if (!groupAccess) return [];
  try { return JSON.parse(groupAccess); } catch { return []; }
}

function matchesCredential(module, group, credential) {
  if (!credential || credential === 'superadministrador') return true;
  const credKey = getAccessRoleKey(credential) || normalizeCredential(credential);
  const allowedRaw = credentialAliases[credKey] || credentialAliases[credential] || [credential];
  const allowed = allowedRaw.map(getAccessRoleKey);
  // group_access is the primary visibility grant from Superadministrador distribution
  const access = parseAccessList(module.group_access).map(getAccessRoleKey);
  if (access.length > 0 && access.some(item => allowed.includes(item))) return true;
  // Also allow if the stored raw names contain the cred (robust match)
  const rawAccess = parseAccessList(module.group_access).map(s => normalizeText(s));
  if (rawAccess.some(ra => ra.includes(credKey) || (credKey === 'campo' && (ra.includes('acop') || ra.includes('campo'))))) return true;
  const appliesTo = normalizeCredential(group.applies_to || 'both');
  const appliesKey = getAccessRoleKey(appliesTo);
  return appliesKey === 'both' || appliesKey === credKey || allowed.includes(appliesKey);
}

function matchesUserPermission(module, permissionSet) {
  if (!permissionSet) return true;
  const nameKey = normalizeText(module.module_name);
  const key = normalizeText(module.module_key || module.module_name);
  const routeKey = normalizeText(module.module_route);
  return permissionSet.has(nameKey) || permissionSet.has(key) || permissionSet.has(routeKey);
}

// GET: returns menu for navigation. When a session exists, modules are filtered by that user's saved permissions.
// Use ?includeAll=true to get ALL (including deactivated) for configuration screens.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';
    const useCred = normalizeCredential(searchParams.get('credential'));
    const currentUser = await getSessionUser();
    const isSuperUser = !!(currentUser?.is_super_admin || currentUser?.admin_role === 'superadministrador');

    let permissionSet = null;
    if (currentUser && !isSuperUser && !includeAll) {
      const permissions = await sql`
        SELECT module_name
        FROM user_permissions
        WHERE user_id = ${currentUser.id} AND can_view = true
      `;
      permissionSet = new Set((permissions || []).map(p => normalizeText(p.module_name)));
    }

    let effectiveCred = useCred;
    if (!effectiveCred && currentUser && !isSuperUser) {
      effectiveCred = normalizeCredential(currentUser.admin_role || '');
    }

    const groups = includeAll ? await sql`
      SELECT 
        mg.id,
        mg.group_name,
        mg.group_order,
        mg.is_active,
        mg.applies_to,
        mg.parent_group_id,
        COALESCE(
          json_agg(
            CASE WHEN mm.id IS NOT NULL THEN
              json_build_object(
                'id', mm.id,
                'group_id', mm.group_id,
                'module_name', mm.module_name,
                'module_route', mm.module_route,
                'module_icon', mm.module_icon,
                'module_order', mm.module_order,
                'is_active', mm.is_active,
                'group_access', COALESCE(mm.group_access, '[]'::jsonb),
                'is_sub_module', (mg.parent_group_id IS NOT NULL)
              )
            END
            ORDER BY mm.module_order ASC
          ) FILTER (WHERE mm.id IS NOT NULL),
          '[]'
        ) as modules
      FROM menu_groups mg
      LEFT JOIN menu_modules mm ON mg.id = mm.group_id
      GROUP BY mg.id, mg.group_name, mg.group_order, mg.is_active, mg.applies_to, mg.parent_group_id
      ORDER BY mg.group_order ASC
    ` : await sql`
      SELECT 
        mg.id,
        mg.group_name,
        mg.group_order,
        mg.is_active,
        mg.applies_to,
        mg.parent_group_id,
        COALESCE(
          json_agg(
            CASE WHEN mm.id IS NOT NULL THEN
              json_build_object(
                'id', mm.id,
                'group_id', mm.group_id,
                'module_name', mm.module_name,
                'module_route', mm.module_route,
                'module_icon', mm.module_icon,
                'module_order', mm.module_order,
                'is_active', mm.is_active,
                'group_access', COALESCE(mm.group_access, '[]'::jsonb),
                'is_sub_module', (mg.parent_group_id IS NOT NULL)
              )
            END
            ORDER BY mm.module_order ASC
          ) FILTER (WHERE mm.id IS NOT NULL),
          '[]'
        ) as modules
      FROM menu_groups mg
      LEFT JOIN menu_modules mm ON mg.id = mm.group_id AND mm.is_active = true
      GROUP BY mg.id, mg.group_name, mg.group_order, mg.is_active, mg.applies_to, mg.parent_group_id
      ORDER BY mg.group_order ASC
    `;

    if (includeAll) return NextResponse.json(groups);
    if (useCred === 'superadministrador' && !isSuperUser) return NextResponse.json([]);

    const filtered = (groups || []).map(group => {
      const modules = (group.modules || [])
        .filter(module => module && module.is_active !== false)
        .filter(module => !effectiveCred || matchesCredential(module, group, effectiveCred))
        .filter(module => !permissionSet || permissionSet.size === 0 || matchesUserPermission(module, permissionSet) || matchesCredential(module, group, effectiveCred))
        .map(module => ({ ...module, is_active: module.is_active !== false }));
      return { ...group, modules: modules.map(m => ({...m, is_active: true })) };
    }).filter(group => group.modules.length > 0);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    );
  }
}

// POST: { action: 'add-group' | 'add-module', ... }
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'add-group') {
      const { groupName, groupOrder } = body;
      if (!groupName) {
        return NextResponse.json({ error: 'groupName required' }, { status: 400 });
      }
      const [newGroup] = await sql`
        INSERT INTO menu_groups (group_name, group_order, is_active)
        VALUES (${groupName.trim()}, ${groupOrder || 99}, true)
        RETURNING *
      `;
      return NextResponse.json(newGroup, { status: 201 });
    }

    if (action === 'add-module') {
      const { groupId, moduleName, moduleRoute, moduleIcon } = body;
      if (!groupId || !moduleName || !moduleRoute) {
        return NextResponse.json({ error: 'groupId, moduleName and moduleRoute required' }, { status: 400 });
      }
      // Compute current max order for this group
      const maxOrderRes = await sql`
        SELECT COALESCE(MAX(module_order), 0) as max_order 
        FROM menu_modules 
        WHERE group_id = ${groupId}
      `;
      const nextOrder = (maxOrderRes[0]?.max_order || 0) + 1;

      const [newMod] = await sql`
        INSERT INTO menu_modules 
          (group_id, module_name, module_route, module_icon, module_order, is_active)
        VALUES 
          (${groupId}, ${moduleName.trim()}, ${moduleRoute.trim()}, ${moduleIcon || 'ph-package'}, ${nextOrder}, true)
        RETURNING *
      `;
      return NextResponse.json(newMod, { status: 201 });
    }

    if (action === 'reorder-groups') {
      const { orderedIds } = body; // array of group ids in new visual order
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await sql`UPDATE menu_groups SET group_order = ${i + 1} WHERE id = ${orderedIds[i]}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'reorder-modules') {
      const { groupId, orderedIds } = body;
      if (!groupId || !Array.isArray(orderedIds)) {
        return NextResponse.json({ error: 'groupId and orderedIds required' }, { status: 400 });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await sql`UPDATE menu_modules SET module_order = ${i + 1} WHERE id = ${orderedIds[i]} AND group_id = ${groupId}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'assign-module') {
      const { moduleId, targetGroupId, moduleOrder } = body;
      if (!moduleId || !targetGroupId) {
        return NextResponse.json({ error: 'moduleId and targetGroupId required' }, { status: 400 });
      }
      await sql`UPDATE menu_modules SET group_id = ${targetGroupId}, updated_at = NOW() WHERE id = ${moduleId}`;
      if (moduleOrder !== undefined) {
        await sql`UPDATE menu_modules SET module_order = ${moduleOrder} WHERE id = ${moduleId}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'bulk-assign') {
      const { assignments } = body; // [{moduleId, targetGroupId, moduleOrder?}, ...]
      if (!Array.isArray(assignments)) {
        return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
      }
      for (const a of assignments) {
        if (a.moduleId && a.targetGroupId) {
          await sql`UPDATE menu_modules SET group_id = ${a.targetGroupId}, updated_at = NOW() WHERE id = ${a.moduleId}`;
          if (a.moduleOrder !== undefined) {
            await sql`UPDATE menu_modules SET module_order = ${a.moduleOrder} WHERE id = ${a.moduleId}`;
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'set-group-access') {
      const { moduleId, groupName, granted } = body;
      if (!moduleId || !groupName) {
        return NextResponse.json({ error: 'moduleId and groupName required' }, { status: 400 });
      }
      // build new array
      let current = [];
      const res = await sql`SELECT group_access FROM menu_modules WHERE id=${moduleId}`;
      if (res[0] && res[0].group_access) {
        try { current = Array.isArray(res[0].group_access) ? res[0].group_access : JSON.parse(res[0].group_access); } catch { current = []; }
      }
      const norm = groupName.trim();
      if (granted) {
        if (!current.includes(norm)) current = [...current, norm];
      } else {
        current = current.filter(g => g !== norm);
      }
      await sql`UPDATE menu_modules SET group_access=${JSON.stringify(current)}, updated_at=NOW() WHERE id=${moduleId}`;
      return NextResponse.json({ success: true, group_access: current });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in menu POST:', error);
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

// PUT: update names, icons, routes, active states
export async function PUT(request) {
  try {
    const body = await request.json();
    const { action, groupId, moduleId, ...data } = body;

    if (action === 'update-group' || (!action && groupId)) {
      const fields = [];
      if (data.groupName !== undefined) fields.push(sql`group_name = ${data.groupName.trim()}`);
      if (data.groupOrder !== undefined) fields.push(sql`group_order = ${data.groupOrder}`);
      if (data.isActive !== undefined) fields.push(sql`is_active = ${data.isActive}`);
      if (data.appliesTo !== undefined) fields.push(sql`applies_to = ${data.appliesTo || 'both'}`);

      if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

      if (fields.length === 1) {
        await sql`UPDATE menu_groups SET ${fields[0]}, updated_at = NOW() WHERE id = ${groupId || data.groupId}`;
      } else if (fields.length === 2) {
        await sql`UPDATE menu_groups SET ${fields[0]}, ${fields[1]}, updated_at = NOW() WHERE id = ${groupId || data.groupId}`;
      } else {
        await sql`UPDATE menu_groups SET ${fields[0]}, ${fields[1]}, ${fields[2]}, updated_at = NOW() WHERE id = ${groupId || data.groupId}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'update-module' || (!action && moduleId)) {
      const fields = [];
      if (data.moduleName !== undefined) fields.push(sql`module_name = ${data.moduleName.trim()}`);
      if (data.moduleRoute !== undefined) fields.push(sql`module_route = ${data.moduleRoute.trim()}`);
      if (data.moduleIcon !== undefined) fields.push(sql`module_icon = ${data.moduleIcon}`);
      if (data.isActive !== undefined) fields.push(sql`is_active = ${data.isActive}`);
      if (data.moduleOrder !== undefined) fields.push(sql`module_order = ${data.moduleOrder}`);
      if (data.groupAccess !== undefined) fields.push(sql`group_access = ${JSON.stringify(Array.isArray(data.groupAccess)?data.groupAccess:[])}`);

      if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

      if (fields.length === 1) {
        await sql`UPDATE menu_modules SET ${fields[0]}, updated_at = NOW() WHERE id = ${moduleId || data.moduleId}`;
      } else if (fields.length === 2) {
        await sql`UPDATE menu_modules SET ${fields[0]}, ${fields[1]}, updated_at = NOW() WHERE id = ${moduleId || data.moduleId}`;
      } else {
        await sql`UPDATE menu_modules SET ${fields[0]}, ${fields[1]}, ${fields[2]}, updated_at = NOW() WHERE id = ${moduleId || data.moduleId}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle-group') {
      const { isActive } = body;
      await sql`UPDATE menu_groups SET is_active = ${!!isActive}, updated_at = NOW() WHERE id = ${groupId}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle-module') {
      const { isActive } = body;
      await sql`UPDATE menu_modules SET is_active = ${!!isActive}, updated_at = NOW() WHERE id = ${moduleId}`;
      return NextResponse.json({ success: true });
    }

    if (action === 'move-group') {
      const { direction } = body; // 'up' | 'down'
      const all = await sql`SELECT id, group_order FROM menu_groups ORDER BY group_order ASC`;
      const idx = all.findIndex(g => g.id === groupId);
      if (idx === -1) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

      if (direction === 'up' && idx > 0) {
        // Swap with previous
        const prevId = all[idx - 1].id;
        const curOrder = all[idx].group_order;
        const prevOrder = all[idx - 1].group_order;
        await sql`UPDATE menu_groups SET group_order = ${prevOrder} WHERE id = ${groupId}`;
        await sql`UPDATE menu_groups SET group_order = ${curOrder} WHERE id = ${prevId}`;
      } else if (direction === 'down' && idx < all.length - 1) {
        // Swap with next
        const nextId = all[idx + 1].id;
        const curOrder = all[idx].group_order;
        const nextOrder = all[idx + 1].group_order;
        await sql`UPDATE menu_groups SET group_order = ${nextOrder} WHERE id = ${groupId}`;
        await sql`UPDATE menu_groups SET group_order = ${curOrder} WHERE id = ${nextId}`;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'move-module') {
      const { direction } = body;
      const currentModules = await sql`
        SELECT id, module_order FROM menu_modules 
        WHERE group_id = (SELECT group_id FROM menu_modules WHERE id = ${moduleId}) 
        ORDER BY module_order ASC
      `;
      const idx = currentModules.findIndex(m => m.id === moduleId);
      if (idx < 0) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

      if (direction === 'up' && idx > 0) {
        const prevId = currentModules[idx - 1].id;
        const curOrder = currentModules[idx].module_order;
        const prevOrder = currentModules[idx - 1].module_order;
        await sql`UPDATE menu_modules SET module_order = ${prevOrder} WHERE id = ${moduleId}`;
        await sql`UPDATE menu_modules SET module_order = ${curOrder} WHERE id = ${prevId}`;
      } else if (direction === 'down' && idx < currentModules.length - 1) {
        const nextId = currentModules[idx + 1].id;
        const curOrder = currentModules[idx].module_order;
        const nextOrder = currentModules[idx + 1].module_order;
        await sql`UPDATE menu_modules SET module_order = ${nextOrder} WHERE id = ${moduleId}`;
        await sql`UPDATE menu_modules SET module_order = ${curOrder} WHERE id = ${nextId}`;
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported update action' }, { status: 400 });
  } catch (error) {
    console.error('Error in menu PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: soft delete - deactivate (not hard delete to keep data integrity)
export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);

    const groupId = body.groupId || searchParams.get('groupId');
    const moduleId = body.moduleId || searchParams.get('moduleId');

    if (groupId) {
      // Soft deactivate group + its modules
      await sql`UPDATE menu_groups SET is_active = false WHERE id = ${groupId}`;
      await sql`UPDATE menu_modules SET is_active = false WHERE group_id = ${groupId}`;
      return NextResponse.json({ success: true, message: 'Grupo desactivado' });
    }

    if (moduleId) {
      await sql`UPDATE menu_modules SET is_active = false WHERE id = ${moduleId}`;
      return NextResponse.json({ success: true, message: 'Módulo desactivado' });
    }

    return NextResponse.json({ error: 'groupId or moduleId required for deactivate' }, { status: 400 });
  } catch (error) {
    console.error('Error in menu DELETE:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
