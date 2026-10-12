import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET inventario por lote o general
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId");
    let where = sql``;
    if (lotId) where = sql`WHERE id_lote = ${parseInt(lotId)}`;

    const rows = await sql`
      SELECT * FROM inventario_bodega 
      ${where}
      ORDER BY updated_at DESC LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: crear o inicializar desde empaque (hereda folio)
export async function POST(request) {
  try {
    const b = await request.json();
    const { id_lote, folio_lote, folio_orden_corte, ...clases } = b;

    if (!id_lote) return NextResponse.json({ error: "id_lote requerido" }, { status: 400 });

    let fl = folio_lote;
    let fo = folio_orden_corte;
    if (!fl) {
      const [l] = await sql`SELECT lot_number, cutting_order_id FROM lots WHERE id = ${parseInt(id_lote)} LIMIT 1`;
      fl = l?.lot_number;
      if (l?.cutting_order_id && !fo) {
        const [co] = await sql`SELECT folio FROM cutting_orders WHERE id = ${l.cutting_order_id} LIMIT 1`;
        fo = co?.folio;
      }
    }

    const [row] = await sql`
      INSERT INTO inventario_bodega (
        id_lote, folio_lote, folio_orden_corte,
        clasea_super_tarimas, clasea_super_cajas,
        clasea_extra_tarimas, clasea_extra_cajas,
        clasea_primera_tarimas, clasea_primera_cajas,
        clasea_mediano_tarimas, clasea_mediano_cajas,
        clasea_tercera_tarimas, clasea_tercera_cajas,
        clasea_cuarta_tarimas, clasea_cuarta_cajas,
        claseb_super_tarimas, claseb_super_cajas,
        claseb_extra_tarimas, claseb_extra_cajas,
        claseb_primera_tarimas, claseb_primera_cajas,
        claseb_mediano_tarimas, claseb_mediano_cajas,
        claseb_tercera_tarimas, claseb_tercera_cajas,
        claseb_cuarta_tarimas, claseb_cuarta_cajas,
        total_tarimas, total_cajas, updated_by
      ) VALUES (
        ${parseInt(id_lote)}, ${fl}, ${fo},
        ${parseInt(clases.clasea_super_tarimas)||0}, ${parseInt(clases.clasea_super_cajas)||0},
        ${parseInt(clases.clasea_extra_tarimas)||0}, ${parseInt(clases.clasea_extra_cajas)||0},
        ${parseInt(clases.clasea_primera_tarimas)||0}, ${parseInt(clases.clasea_primera_cajas)||0},
        ${parseInt(clases.clasea_mediano_tarimas)||0}, ${parseInt(clases.clasea_mediano_cajas)||0},
        ${parseInt(clases.clasea_tercera_tarimas)||0}, ${parseInt(clases.clasea_tercera_cajas)||0},
        ${parseInt(clases.clasea_cuarta_tarimas)||0}, ${parseInt(clases.clasea_cuarta_cajas)||0},
        ${parseInt(clases.claseb_super_tarimas)||0}, ${parseInt(clases.claseb_super_cajas)||0},
        ${parseInt(clases.claseb_extra_tarimas)||0}, ${parseInt(clases.claseb_extra_cajas)||0},
        ${parseInt(clases.claseb_primera_tarimas)||0}, ${parseInt(clases.claseb_primera_cajas)||0},
        ${parseInt(clases.claseb_mediano_tarimas)||0}, ${parseInt(clases.claseb_mediano_cajas)||0},
        ${parseInt(clases.claseb_tercera_tarimas)||0}, ${parseInt(clases.claseb_tercera_cajas)||0},
        ${parseInt(clases.claseb_cuarta_tarimas)||0}, ${parseInt(clases.claseb_cuarta_cajas)||0},
        ${parseInt(clases.total_tarimas)||0}, ${parseInt(clases.total_cajas)||0},
        ${clases.updated_by || 'sistema'}
      ) RETURNING *
    `;
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: actualizar stock (editable por supervisor) + deducción en transito
export async function PUT(request) {
  try {
    const b = await request.json();
    const { id, motivo_ajuste, usuario, pin_autorizado, ...clases } = b;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const [existing] = await sql`SELECT * FROM inventario_bodega WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const isEdit = motivo_ajuste && pin_autorizado;

    const [updated] = await sql`
      UPDATE inventario_bodega SET
        clasea_super_tarimas = COALESCE(${clases.clasea_super_tarimas != null ? parseInt(clases.clasea_super_tarimas) : null}, clasea_super_tarimas),
        clasea_super_cajas = COALESCE(${clases.clasea_super_cajas != null ? parseInt(clases.clasea_super_cajas) : null}, clasea_super_cajas),
        clasea_extra_tarimas = COALESCE(${clases.clasea_extra_tarimas != null ? parseInt(clases.clasea_extra_tarimas) : null}, clasea_extra_tarimas),
        clasea_extra_cajas = COALESCE(${clases.clasea_extra_cajas != null ? parseInt(clases.clasea_extra_cajas) : null}, clasea_extra_cajas),
        clasea_primera_tarimas = COALESCE(${clases.clasea_primera_tarimas != null ? parseInt(clases.clasea_primera_tarimas) : null}, clasea_primera_tarimas),
        clasea_primera_cajas = COALESCE(${clases.clasea_primera_cajas != null ? parseInt(clases.clasea_primera_cajas) : null}, clasea_primera_cajas),
        clasea_mediano_tarimas = COALESCE(${clases.clasea_mediano_tarimas != null ? parseInt(clases.clasea_mediano_tarimas) : null}, clasea_mediano_tarimas),
        clasea_mediano_cajas = COALESCE(${clases.clasea_mediano_cajas != null ? parseInt(clases.clasea_mediano_cajas) : null}, clasea_mediano_cajas),
        clasea_tercera_tarimas = COALESCE(${clases.clasea_tercera_tarimas != null ? parseInt(clases.clasea_tercera_tarimas) : null}, clasea_tercera_tarimas),
        clasea_tercera_cajas = COALESCE(${clases.clasea_tercera_cajas != null ? parseInt(clases.clasea_tercera_cajas) : null}, clasea_tercera_cajas),
        clasea_cuarta_tarimas = COALESCE(${clases.clasea_cuarta_tarimas != null ? parseInt(clases.clasea_cuarta_tarimas) : null}, clasea_cuarta_tarimas),
        clasea_cuarta_cajas = COALESCE(${clases.clasea_cuarta_cajas != null ? parseInt(clases.clasea_cuarta_cajas) : null}, clasea_cuarta_cajas),
        claseb_super_tarimas = COALESCE(${clases.claseb_super_tarimas != null ? parseInt(clases.claseb_super_tarimas) : null}, claseb_super_tarimas),
        claseb_super_cajas = COALESCE(${clases.claseb_super_cajas != null ? parseInt(clases.claseb_super_cajas) : null}, claseb_super_cajas),
        claseb_extra_tarimas = COALESCE(${clases.claseb_extra_tarimas != null ? parseInt(clases.claseb_extra_tarimas) : null}, claseb_extra_tarimas),
        claseb_extra_cajas = COALESCE(${clases.claseb_extra_cajas != null ? parseInt(clases.claseb_extra_cajas) : null}, claseb_extra_cajas),
        claseb_primera_tarimas = COALESCE(${clases.claseb_primera_tarimas != null ? parseInt(clases.claseb_primera_tarimas) : null}, claseb_primera_tarimas),
        claseb_primera_cajas = COALESCE(${clases.claseb_primera_cajas != null ? parseInt(clases.claseb_primera_cajas) : null}, claseb_primera_cajas),
        claseb_mediano_tarimas = COALESCE(${clases.claseb_mediano_tarimas != null ? parseInt(clases.claseb_mediano_tarimas) : null}, claseb_mediano_tarimas),
        claseb_mediano_cajas = COALESCE(${clases.claseb_mediano_cajas != null ? parseInt(clases.claseb_mediano_cajas) : null}, claseb_mediano_cajas),
        claseb_tercera_tarimas = COALESCE(${clases.claseb_tercera_tarimas != null ? parseInt(clases.claseb_tercera_tarimas) : null}, claseb_tercera_tarimas),
        claseb_tercera_cajas = COALESCE(${clases.claseb_tercera_cajas != null ? parseInt(clases.claseb_tercera_cajas) : null}, claseb_tercera_cajas),
        claseb_cuarta_tarimas = COALESCE(${clases.claseb_cuarta_tarimas != null ? parseInt(clases.claseb_cuarta_tarimas) : null}, claseb_cuarta_tarimas),
        claseb_cuarta_cajas = COALESCE(${clases.claseb_cuarta_cajas != null ? parseInt(clases.claseb_cuarta_cajas) : null}, claseb_cuarta_cajas),
        total_tarimas = COALESCE(${clases.total_tarimas != null ? parseInt(clases.total_tarimas) : null}, total_tarimas),
        total_cajas = COALESCE(${clases.total_cajas != null ? parseInt(clases.total_cajas) : null}, total_cajas),
        updated_by = ${usuario || 'supervisor'},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (motivo_ajuste) {
      await sql`
        INSERT INTO pin_audit_log (user_id, module, entity_type, entity_id, campo_modificado, valor_anterior, valor_nuevo, motivo_ajuste, timestamp)
        VALUES (${usuario || 'supervisor'}, 'inventario_bodega', 'inventario_bodega', ${parseInt(id)}, 'stock_bodega', 'ajuste', 'actualizado', ${motivo_ajuste}, CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
