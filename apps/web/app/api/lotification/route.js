import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  let lotId = null;
  try {
    const { searchParams } = new URL(request.url);
    lotId = searchParams.get('lotId');

    if (lotId) {
      // RECONCILIATION (BLOQUE 04): lotification_records / lotification_registry / lot_selection_results / lot_performance are legacy.
      // Canonical yield/selection is ONLY from production_selection_details + fruit_input_weighings (Ingreso de Fruta reception confirmed).
      // NEVER sum multiple sources as if they were additional productions. This is read-only view.
      const [lot] = await sql`SELECT * FROM lots WHERE id = ${parseInt(lotId)}`;
      const prod = await sql`
        SELECT 
          caliber, class_name,
          COALESCE(SUM(boxes_10kg),0) as boxes_10,
          COALESCE(SUM(boxes_6kg),0) as boxes_6,
          COALESCE(SUM(total_kg),0) as total_kg
        FROM production_selection_details 
        WHERE lot_id = ${parseInt(lotId)}
        GROUP BY caliber, class_name
      `;
      const [fiw] = await sql`
        SELECT COALESCE(SUM(total_kg_weighed),0) as received_kg 
        FROM fruit_input_weighings WHERE lot_id = ${parseInt(lotId)}
      `;
      return NextResponse.json({ 
        lot, 
        canonical_from_production: prod, 
        received_kg: fiw?.received_kg || 0,
        note: 'Use /production as single canonical source for Producción. Legacy structures preserved for history only. No parallel captures.'
      });
    }

    const records = await sql`
      SELECT 
        lr.*,
        l.lot_number,
        l.producer,
        l.origin,
        l.fruit_type,
        l.date as lot_date
      FROM lotification_records lr
      LEFT JOIN lots l ON lr.lot_id = l.id
      ORDER BY lr.created_at DESC
    `;
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error in lotification GET:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // RECONCILIATION: Writes to lotification_records are legacy.
    // Canonical selection must be done exclusively via /api/production and production_selection_details (matriz Calibre/Clase/Cajas10/6kg/%/Precio/Total/Proceso/Desecho/Merma).
    // No parallel capture. This keeps historical compatibility but does not count as new production.
    const {
      lotId,
      boxSize10kg,
      boxSize6kg,
      gradeSuper,
      gradeExtra,
      gradePrimera,
      gradeMediano,
      gradeTercera,
      gradeCuarta,
      gradeSuperB,
      gradeExtraB,
      gradePrimeraB,
      gradeMedianoB,
      gradeTerceraB,
      gradeExtra6kg,
      gradePrimera6kg,
      gradeMediano6kg,
      gradeTercera6kg,
      totalKgProcessed,
      totalKgWaste,
      totalKgLoss,
      notes
    } = body;

    const result = await sql`
      INSERT INTO lotification_records (
        lot_id,
        box_size_10kg,
        box_size_6kg,
        grade_super,
        grade_extra,
        grade_primera,
        grade_mediano,
        grade_tercera,
        grade_cuarta,
        grade_super_b,
        grade_extra_b,
        grade_primera_b,
        grade_mediano_b,
        grade_tercera_b,
        grade_extra_6kg,
        grade_primera_6kg,
        grade_mediano_6kg,
        grade_tercera_6kg,
        total_kg_processed,
        total_kg_waste,
        total_kg_loss,
        notes
      ) VALUES (
        ${lotId},
        ${boxSize10kg || 0},
        ${boxSize6kg || 0},
        ${gradeSuper || 0},
        ${gradeExtra || 0},
        ${gradePrimera || 0},
        ${gradeMediano || 0},
        ${gradeTercera || 0},
        ${gradeCuarta || 0},
        ${gradeSuperB || 0},
        ${gradeExtraB || 0},
        ${gradePrimeraB || 0},
        ${gradeMedianoB || 0},
        ${gradeTerceraB || 0},
        ${gradeExtra6kg || 0},
        ${gradePrimera6kg || 0},
        ${gradeMediano6kg || 0},
        ${gradeTercera6kg || 0},
        ${totalKgProcessed || 0},
        ${totalKgWaste || 0},
        ${totalKgLoss || 0},
        ${notes || ''}
      )
      RETURNING *
    `;

    return NextResponse.json({ ...result[0], _warning: 'LEGACY: Use /production for new canonical selection. Old structures for migration only.' });
  } catch (error) {
    console.error('Error in lotification POST:', error);
    return NextResponse.json({ error: 'Failed to create (legacy path)' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      boxSize10kg,
      boxSize6kg,
      gradeSuper,
      gradeExtra,
      gradePrimera,
      gradeMediano,
      gradeTercera,
      gradeCuarta,
      gradeSuperB,
      gradeExtraB,
      gradePrimeraB,
      gradeMedianoB,
      gradeTerceraB,
      gradeExtra6kg,
      gradePrimera6kg,
      gradeMediano6kg,
      gradeTercera6kg,
      totalKgProcessed,
      totalKgWaste,
      totalKgLoss,
      notes
    } = await request.json();

    const result = await sql`
      UPDATE lotification_records
      SET
        box_size_10kg = ${boxSize10kg || 0},
        box_size_6kg = ${boxSize6kg || 0},
        grade_super = ${gradeSuper || 0},
        grade_extra = ${gradeExtra || 0},
        grade_primera = ${gradePrimera || 0},
        grade_mediano = ${gradeMediano || 0},
        grade_tercera = ${gradeTercera || 0},
        grade_cuarta = ${gradeCuarta || 0},
        grade_super_b = ${gradeSuperB || 0},
        grade_extra_b = ${gradeExtraB || 0},
        grade_primera_b = ${gradePrimeraB || 0},
        grade_mediano_b = ${gradeMedianoB || 0},
        grade_tercera_b = ${gradeTerceraB || 0},
        grade_extra_6kg = ${gradeExtra6kg || 0},
        grade_primera_6kg = ${gradePrimera6kg || 0},
        grade_mediano_6kg = ${gradeMediano6kg || 0},
        grade_tercera_6kg = ${gradeTercera6kg || 0},
        total_kg_processed = ${totalKgProcessed || 0},
        total_kg_waste = ${totalKgWaste || 0},
        total_kg_loss = ${totalKgLoss || 0},
        notes = ${notes || ''},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ ...result[0], _warning: 'LEGACY update only. Prefer /production for new data.' });
  } catch (error) {
    console.error('Error in lotification PUT:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`DELETE FROM lotification_records WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in lotification DELETE:', error);
    return NextResponse.json({ success: true });
  }
}
