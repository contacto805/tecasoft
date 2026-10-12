import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Helper to get current user id from session (supports simple PIN login and better-auth)
async function getCurrentUserId() {
  const cookieStore = await cookies();
  const possibleTokens = [
    cookieStore.get("tecavo_session_token")?.value,
    cookieStore.get("better-auth.session_token")?.value,
  ].filter(Boolean);

  for (const token of possibleTokens) {
    if (!token) continue;
    try {
      const sessions = await sql`SELECT s."userId" FROM session s WHERE s.token = ${token} AND s."expiresAt" > NOW() LIMIT 1`;
      if (sessions.length > 0) return sessions[0].userId;
    } catch (_) {}
    try {
      const decoded = Buffer.from(token, "base64").toString();
      const sessionData = JSON.parse(decoded);
      if (sessionData.userId) return sessionData.userId;
    } catch (_) {}
  }
  return null;
}

export async function GET() {
  try {
    const apps = await sql`
      SELECT a.*, 
        (SELECT COUNT(*) FROM mobile_app_authorizations ma WHERE ma.app_id = a.id AND ma.authorized = true) as authorized_count
      FROM apps_generadas a
      ORDER BY a.fecha_generacion DESC, a.id DESC
    `;
    return NextResponse.json(apps);
  } catch (error) {
    console.error("Error fetching generated apps:", error);
    return NextResponse.json({ error: "Error al obtener apps generadas" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, tipo, descripcion, ruta, icono, version, estado, apk_url, apk_filename, apk_size, requiere_autorizacion } = body;

    if (!nombre) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const [newApp] = await sql`
      INSERT INTO apps_generadas (
        nombre, tipo, descripcion, ruta, icono, version, estado,
        apk_url, apk_filename, apk_size, requiere_autorizacion,
        fecha_generacion
      )
      VALUES (
        ${nombre}, 
        ${tipo || 'Móvil'}, 
        ${descripcion || ''}, 
        ${ruta || ''}, 
        ${icono || 'ph-app-window'}, 
        ${version || '1.0'}, 
        ${estado || 'activa'},
        ${apk_url || null},
        ${apk_filename || null},
        ${apk_size || null},
        ${requiere_autorizacion !== false},
        CURRENT_DATE
      )
      RETURNING *
    `;

    return NextResponse.json(newApp, { status: 201 });
  } catch (error) {
    console.error("Error creating generated app:", error);
    return NextResponse.json({ error: "Error al crear app generada" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { 
      id, 
      nombre, tipo, descripcion, ruta, icono, version, estado,
      apk_url, apk_filename, apk_size, requiere_autorizacion
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE apps_generadas 
      SET 
        nombre = ${nombre || ''},
        tipo = ${tipo || 'Móvil'},
        descripcion = ${descripcion || ''},
        ruta = ${ruta || ''},
        icono = ${icono || 'ph-app-window'},
        version = ${version || '1.0'},
        estado = ${estado || 'activa'},
        apk_url = ${apk_url || null},
        apk_filename = ${apk_filename || null},
        apk_size = ${apk_size || null},
        requiere_autorizacion = ${requiere_autorizacion !== false},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (!updated) {
      return NextResponse.json({ error: "App no encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating generated app:", error);
    return NextResponse.json({ error: "Error al actualizar app generada" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM apps_generadas WHERE id = ${parseInt(id)} RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "App no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "App eliminada" });
  } catch (error) {
    console.error("Error deleting generated app:", error);
    return NextResponse.json({ error: "Error al eliminar app generada" }, { status: 500 });
  }
}
