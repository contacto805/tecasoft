import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      // Get single configuration with materials
      const config = await sql`
        SELECT * FROM pallet_configurations WHERE id = ${parseInt(id)}
      `;

      if (config.length === 0) {
        return NextResponse.json(
          { error: 'Configuración no encontrada' },
          { status: 404 }
        );
      }

      const materials = await sql`
        SELECT pm.*, 
          mi.material_name, mi.category, mi.unit as inventory_unit, mi.cost_per_unit as inventory_cost,
          (CASE 
            WHEN pm.cost_source_type = 'purchase' THEN (SELECT po.unit_price FROM purchase_orders po WHERE po.id = pm.cost_source_id LIMIT 1)
            WHEN pm.cost_source_type = 'expense' THEN (SELECT e.cost_per_unit FROM expenses e WHERE e.id = pm.cost_source_id LIMIT 1)
            ELSE mi.cost_per_unit 
          END) as effective_cost_per_unit
        FROM pallet_materials pm
        JOIN materials_inventory mi ON pm.material_id = mi.id
        WHERE pm.pallet_config_id = ${parseInt(id)}
        ORDER BY pm.id
      `;

      return NextResponse.json({
        ...config[0],
        materials
      });
    }

    // Get all configurations
    const configs = await sql`
      SELECT pc.*, (SELECT COUNT(*) FROM pallet_materials pm WHERE pm.pallet_config_id = pc.id) as material_count
      FROM pallet_configurations pc
      ORDER BY pc.created_at DESC
    `;

    // Load full materials for each config so list view shows details and links
    const configsWithMaterials = await Promise.all(
      configs.map(async (config) => {
        const materials = await sql`
          SELECT pm.*, 
            mi.material_name, mi.category, mi.unit as inventory_unit, mi.cost_per_unit as inventory_cost,
            (CASE 
              WHEN pm.cost_source_type = 'purchase' THEN (SELECT po.unit_price FROM purchase_orders po WHERE po.id = pm.cost_source_id LIMIT 1)
              WHEN pm.cost_source_type = 'expense' THEN (SELECT e.cost_per_unit FROM expenses e WHERE e.id = pm.cost_source_id LIMIT 1)
              ELSE mi.cost_per_unit 
            END) as effective_cost_per_unit
          FROM pallet_materials pm
          JOIN materials_inventory mi ON pm.material_id = mi.id
          WHERE pm.pallet_config_id = ${parseInt(config.id)}
          ORDER BY pm.id
        `;
        return {
          ...config,
          materials
        };
      })
    );

    return NextResponse.json(configsWithMaterials);
  } catch (error) {
    console.error('Error fetching pallet configurations:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuraciones de tarimas' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      pallet_name,
      pallet_type,
      boxes_capacity,
      total_weight_kg,
      description,
      materials
    } = await request.json();

    if (!pallet_name) {
      return NextResponse.json(
        { error: 'El nombre de la tarima es requerido' },
        { status: 400 }
      );
    }

    // Create pallet configuration
    const configResult = await sql`
      INSERT INTO pallet_configurations (
        pallet_name, pallet_type, boxes_capacity, total_weight_kg, description
      ) VALUES (
        ${pallet_name},
        ${pallet_type || null},
        ${boxes_capacity || null},
        ${total_weight_kg || null},
        ${description || null}
      )
      RETURNING *
    `;

    const configId = configResult[0].id;

    // Add materials if provided
    if (Array.isArray(materials) && materials.length > 0) {
      for (const material of materials) {
        await sql`
          INSERT INTO pallet_materials (
            pallet_config_id, material_id, quantity_required, unit, notes,
            cost_source_type, cost_source_id, cost_unit, last_known_cost
          ) VALUES (
            ${configId},
            ${parseInt(material.material_id)},
            ${parseFloat(material.quantity_required)},
            ${material.unit || null},
            ${material.notes || null},
            ${material.cost_source_type || 'inventory'},
            ${material.cost_source_id ? parseInt(material.cost_source_id) : null},
            ${material.cost_unit || material.unit || 'unidad'},
            ${material.last_known_cost ? parseFloat(material.last_known_cost) : null}
          )
        `;
      }
    }

    return NextResponse.json({
      success: true,
      id: configId,
      message: 'Configuración de tarima creada exitosamente'
    });
  } catch (error) {
    console.error('Error creating pallet configuration:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear configuración de tarima' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      pallet_name,
      pallet_type,
      boxes_capacity,
      total_weight_kg,
      description,
      is_active,
      materials
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID de configuración requerido' },
        { status: 400 }
      );
    }

    // Update configuration
    await sql`
      UPDATE pallet_configurations
      SET 
        pallet_name = COALESCE(${pallet_name || null}, pallet_name),
        pallet_type = COALESCE(${pallet_type || null}, pallet_type),
        boxes_capacity = COALESCE(${boxes_capacity || null}, boxes_capacity),
        total_weight_kg = COALESCE(${total_weight_kg || null}, total_weight_kg),
        description = COALESCE(${description || null}, description),
        is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
    `;

    // Update materials if provided
    if (Array.isArray(materials)) {
      // Delete old materials
      await sql`DELETE FROM pallet_materials WHERE pallet_config_id = ${parseInt(id)}`;

      // Add new materials
      for (const material of materials) {
        await sql`
          INSERT INTO pallet_materials (
            pallet_config_id, material_id, quantity_required, unit, notes,
            cost_source_type, cost_source_id, cost_unit, last_known_cost
          ) VALUES (
            ${parseInt(id)},
            ${parseInt(material.material_id)},
            ${parseFloat(material.quantity_required)},
            ${material.unit || null},
            ${material.notes || null},
            ${material.cost_source_type || 'inventory'},
            ${material.cost_source_id ? parseInt(material.cost_source_id) : null},
            ${material.cost_unit || material.unit || 'unidad'},
            ${material.last_known_cost ? parseFloat(material.last_known_cost) : null}
          )
        `;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración de tarima actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error updating pallet configuration:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración de tarima' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de configuración requerido' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM pallet_configurations WHERE id = ${parseInt(id)}`;

    return NextResponse.json({
      success: true,
      message: 'Configuración de tarima eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting pallet configuration:', error);
    return NextResponse.json(
      { error: 'Error al eliminar configuración de tarima' },
      { status: 500 }
    );
  }
}
