# User Roles & Permissions Management System

## Overview
Superadmins can now manage user access and permissions through a dedicated admin panel. Control which modules each user can access and what actions they can perform.

## Features

### 1. User Management Panel
- **Location**: Admin → Gestión de Usuarios y Permisos tab
- **View all registered users**: Name, email, permission count
- **Select users**: Click to manage their permissions
- **Quick actions**: Assign/revoke all modules at once

### 2. Module Access Control
Manage permissions for 9 core modules:
- Inventario (Inventory)
- Configuración de Producción (Production Config)
- Ingreso de Fruta (Fruit Input)
- Registro de Lotificación (Lot Registration)
- Selección de Lotes (Lot Selection)
- Órdenes de Corte (Cutting Orders)
- Módulo de Cargas (Loads)
- Control de Cajas (Box Control)
- Lotificación (Lotification Registry)

### 3. Permission Levels
For each module, assign:
- **Ver** (View) - Can see the module
- **Crear** (Create) - Can create new records
- **Editar** (Edit) - Can modify existing records
- **Borrar** (Delete) - Can delete records

## Usage

### Assigning Permissions

1. **Open Admin Panel**
   - Click avatar → Configuración
   - Click "Gestión de Usuarios y Permisos" tab

2. **Select User**
   - Browse users list on the left
   - Click user to select them

3. **Configure Module Access**
   - Each module shows 4 checkboxes: Ver, Crear, Editar, Borrar
   - Check/uncheck as needed for each module
   - Use "Asignar Todo" to grant all permissions at once
   - Use "Revocar Todo" to remove all permissions at once

4. **Save Changes**
   - Click "Guardar Permisos" button
   - Confirmation message appears
   - Changes apply immediately

### Example Scenarios

**Field Staff** (Limited Access)
- ✅ Inventario: Ver, Crear, Editar
- ✅ Ingreso de Fruta: Ver, Crear
- ✅ Control de Cajas: Ver, Crear, Editar
- ❌ All others: No access

**Production Manager** (Full Module Access)
- ✅ All modules: Ver, Crear, Editar, Borrar
- ❌ (System admin controls only)

**Viewer Account** (Read-Only)
- ✅ All modules: Ver only
- ❌ Crear, Editar, Borrar: Off

## Database Schema

### user_permissions Table
```sql
CREATE TABLE user_permissions (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES "user"(id),
  module_name TEXT,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, module_name)
);
```

## API Reference

### Get All Users & Permissions
```bash
GET /api/user-permissions
Response: Array of users with permissions
```

### Get Single User Permissions
```bash
GET /api/user-permissions?userId={id}
Response: Array of permission records
```

### Update User Permissions
```bash
POST /api/user-permissions
Body: {
  "userId": "user-id",
  "permissions": [
    {
      "id": null,
      "module_name": "inventory",
      "can_view": true,
      "can_create": true,
      "can_edit": true,
      "can_delete": false
    }
  ]
}
```

### Update Single Permission
```bash
PUT /api/user-permissions
Body: {
  "id": 1,
  "moduleData": {
    "can_view": true,
    "can_create": false,
    "can_edit": false,
    "can_delete": false
  }
}
```

### Delete Permission
```bash
DELETE /api/user-permissions?id={permissionId}
DELETE /api/user-permissions?userId={userId}  // Delete all
```

## Implementation Notes

### Frontend Integration
Permissions are currently managed via the admin panel. To enforce them on module pages:

1. Fetch user permissions on page load
2. Check if user has `can_view` for that module
3. Hide create/edit/delete buttons based on permissions
4. Show read-only UI or redirect if no view access

Example:
```javascript
const [permissions, setPermissions] = useState([]);

useEffect(() => {
  const fetchPerms = async () => {
    const res = await fetch(`/api/user-permissions?userId=${user.id}`);
    setPermissions(await res.json());
  };
  fetchPerms();
}, [user.id]);

const canEdit = permissions.some(p => p.module_name === 'inventory' && p.can_edit);
```

### Superadmin Account
The superadmin (contacto@tecavofruits.com) always has full access to all modules regardless of database permissions. Only they can:
- Access the Admin Configuration panel
- Manage other users' permissions
- Modify system settings

## Future Enhancements
- Role-based access (Viewer, Editor, Manager, Admin)
- Permission enforcement on module pages
- Activity logs for permission changes
- Bulk import/export of permissions
- Permission templates for common use cases

## Support
For issues with the permissions system:
1. Verify user exists in the system
2. Check that module_name matches exactly
3. Ensure user_id is correct
4. Review database for orphaned records
