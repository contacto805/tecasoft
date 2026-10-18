import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

/**
 * INVENTARIO INTELIGENTE DE MATERIALES (FASE 03 V7)
 * Fuente única: materials_inventory + purchase_receptions (entradas) + material_deductions (salidas/consumos)
 * NO duplicar inventario. Fórmula: EXISTENCIA = INICIAL + ENTRADAS - CONSUMOS - SALIDAS + DEV + AJUSTES
 * Costo promedio ponderado móvil. Códigos de barras, conversiones exactas, alertas.
 * Tarimas integradas vía categoría 'Tarima' + pallet_materials.
 */

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const lowStock = searchParams.get('lowStock') === 'true';

    let where = sql`WHERE 1=1`;
    if (q) where = sql`${where} AND (material_name ILIKE ${'%'+q+'%'} OR codigo_interno ILIKE ${'%'+q+'%'} OR barcode ILIKE ${'%'+q+'%'})`;
    if (category) where = sql`${where} AND category = ${category}`;
    if (lowStock) where = sql`${where} AND quantity_available <= COALESCE(stock_min, 0)`;

    const materials = await sql`
      SELECT 
        *,
        (quantity_available * COALESCE(costo_promedio, cost_per_unit, 0)) as valor_total,
        CASE WHEN quantity_available <= COALESCE(stock_min, 0) THEN true ELSE false END as stock_bajo
      FROM materials_inventory
      ${where}
      ORDER BY material_name ASC
    `;
    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Error fetching materials' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      material_name, category, quantity_available, unit, minimum_stock, reorder_quantity, 
      cost_per_unit, clave, estatus, codigo_interno, barcode, proveedor, unidad_base, 
      factor_conversion, stock_min, stock_max, ubicacion, codigo_barras_fabricante 
    } = body;

    if (!material_name) {
      return NextResponse.json({ error: 'Material name is required' }, { status: 400 });
    }

    const trimmedName = material_name.trim();
    // Prevent dup by name or barcode if provided
    const existing = await sql`
      SELECT id FROM materials_inventory 
      WHERE LOWER(TRIM(material_name)) = LOWER(${trimmedName}) 
        OR (barcode IS NOT NULL AND barcode = ${barcode || ''} AND barcode != '')
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ya existe un material con ese nombre o código de barras' }, { status: 409 });
    }

    // Generate unique barcode if not provided (Code128 compatible simple)
    let finalBarcode = barcode;
    if (!finalBarcode) {
      const ts = Date.now().toString().slice(-8);
      finalBarcode = `MAT-${ts}`;
    }

    const result = await sql`
      INSERT INTO materials_inventory (
        material_name, category, quantity_available, unit, minimum_stock, reorder_quantity, 
        cost_per_unit, clave, estatus, codigo_interno, barcode, proveedor, unidad_base, 
        factor_conversion, stock_min, stock_max, ubicacion, codigo_barras_fabricante,
        costo_promedio
      )
      VALUES (
        ${trimmedName}, ${category || null}, ${quantity_available || 0}, ${unit || 'unidad'}, 
        ${minimum_stock || 0}, ${reorder_quantity || 0}, ${cost_per_unit || 0}, ${clave || null}, 
        ${estatus || 'Activo'}, ${codigo_interno || null}, ${finalBarcode}, ${proveedor || null}, 
        ${unidad_base || 'unidad'}, ${factor_conversion || 1}, ${stock_min || minimum_stock || 0}, 
        ${stock_max || 0}, ${ubicacion || null}, ${codigo_barras_fabricante || null},
        ${cost_per_unit || 0}
      )
      RETURNING *
    `;

    // Log movement for new material (initial stock)
    if (quantity_available > 0) {
      await sql`
        INSERT INTO movements (entity_type, entity_id, movement_type, qty, unit, module, reference, notes, created_at)
        VALUES ('material', ${result[0].id}, 'ENTRADA_INICIAL', ${quantity_available}, ${unit || 'unidad'}, 'inventario', ${finalBarcode}, 'Alta inicial de material', CURRENT_TIMESTAMP)
      `;
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error creating material:', error);
    return NextResponse.json({ error: 'Error creating material' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { 
      id, quantity_available, quantity_change, cost_per_unit, stock_min, stock_max, 
      ubicacion, estatus, codigo_interno, barcode, proveedor 
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Material ID required' }, { status: 400 });
    }

    const [current] = await sql`SELECT * FROM materials_inventory WHERE id = ${parseInt(id)}`;
    if (!current) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    let newQty = quantity_available;
    if (quantity_change !== undefined) {
      const factor = parseFloat(current.factor_conversion || 1) || 1;
      const delta = parseFloat(quantity_change) * factor;
      newQty = Math.max(0, parseFloat(current.quantity_available || 0) + delta);
    }

    // Update promedio ponderado if cost changes on entrada
    let newCostoProm = current.costo_promedio || current.cost_per_unit || 0;
    if (cost_per_unit !== undefined && newQty > 0) {
      const oldQty = parseFloat(current.quantity_available || 0);
      const oldCost = parseFloat(current.costo_promedio || current.cost_per_unit || 0);
      const newC = parseFloat(cost_per_unit);
      const totalQty = oldQty + (newQty - oldQty); // if entrada
      if (totalQty > 0) {
        newCostoProm = ((oldQty * oldCost) + ((newQty - oldQty) * newC)) / totalQty;
      }
    }

    const result = await sql`
      UPDATE materials_inventory
      SET 
        quantity_available = ${newQty !== undefined ? newQty : current.quantity_available},
        cost_per_unit = ${cost_per_unit !== undefined ? cost_per_unit : current.cost_per_unit},
        costo_promedio = ${newCostoProm},
        stock_min = ${stock_min !== undefined ? stock_min : current.stock_min},
        stock_max = ${stock_max !== undefined ? stock_max : current.stock_max},
        ubicacion = ${ubicacion !== undefined ? ubicacion : current.ubicacion},
        estatus = ${estatus || current.estatus},
        codigo_interno = ${codigo_interno !== undefined ? codigo_interno : current.codigo_interno},
        barcode = ${barcode !== undefined ? barcode : current.barcode},
        proveedor = ${proveedor !== undefined ? proveedor : current.proveedor},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Log movement if qty changed
    if (quantity_change !== undefined || quantity_available !== undefined) {
      const delta = (newQty !== undefined ? newQty : current.quantity_available) - parseFloat(current.quantity_available || 0);
      if (Math.abs(delta) > 0.001) {
        await sql`
          INSERT INTO movements (entity_type, entity_id, movement_type, qty, qty_before, qty_after, unit, module, reference, notes, created_at)
          VALUES ('material', ${id}, ${delta > 0 ? 'ENTRADA' : 'SALIDA'}, ${Math.abs(delta)}, ${current.quantity_available}, ${newQty}, ${current.unit}, 'inventario', ${current.barcode}, 'Ajuste/consumo/entrada material', CURRENT_TIMESTAMP)
        `;
      }
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating material:', error);
    return NextResponse.json({ error: 'Error updating material' }, { status: 500 });
  }
}

// DELETE disabled to preserve history (per rules)
export async function DELETE() {
  return NextResponse.json({ error: 'Eliminación deshabilitada. Usa estatus inactivo.' }, { status: 405 });
}
