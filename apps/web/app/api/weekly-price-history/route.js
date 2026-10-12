import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// GET - Obtener histórico de precios semanales
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    const weekNumber = searchParams.get('weekNumber');
    const weekYear = searchParams.get('weekYear');
    const status = searchParams.get('status');
    const currentWeek = searchParams.get('currentWeek');

    // Obtener semana actual
    if (currentWeek === 'true') {
      const [week] = await sql`
        SELECT * FROM weekly_price_history
        WHERE week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE
        ORDER BY week_start_date DESC
        LIMIT 1
      `;
      
      if (!week) {
        // Crear semana actual si no existe
        const today = new Date();
        const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const weekNum = Math.ceil((monday - new Date(monday.getFullYear(), 0, 1)) / 604800000);
        
        const [newWeek] = await sql`
          INSERT INTO weekly_price_history (
            week_number, week_year, week_start_date, week_end_date, status
          ) VALUES (
            ${weekNum},
            ${monday.getFullYear()},
            ${monday.toISOString().split('T')[0]},
            ${sunday.toISOString().split('T')[0]},
            'pending'
          ) RETURNING *
        `;
        
        return NextResponse.json(newWeek);
      }
      
      return NextResponse.json(week);
    }

    // Obtener semana específica por ID
    if (weekId) {
      const [week] = await sql`
        SELECT * FROM weekly_price_history WHERE id = ${parseInt(weekId)}
      `;
      return NextResponse.json(week);
    }

    // Obtener semana específica por número y año
    if (weekNumber && weekYear) {
      const [week] = await sql`
        SELECT * FROM weekly_price_history 
        WHERE week_number = ${parseInt(weekNumber)} AND week_year = ${parseInt(weekYear)}
      `;
      return NextResponse.json(week);
    }

    // Listar todas las semanas con filtros
    let query = sql`SELECT * FROM weekly_price_history WHERE 1=1`;
    
    if (status) {
      query = sql`
        SELECT * FROM weekly_price_history 
        WHERE status = ${status}
        ORDER BY week_year DESC, week_number DESC
      `;
    } else {
      query = sql`
        SELECT * FROM weekly_price_history 
        ORDER BY week_year DESC, week_number DESC
      `;
    }

    const weeks = await query;
    return NextResponse.json(weeks);
  } catch (error) {
    console.error('Error fetching weekly price history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear nueva semana de precios
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      weekNumber,
      weekYear,
      weekStartDate,
      weekEndDate,
      capturedBy,
      notes
    } = body;

    // Verificar si ya existe
    const [existing] = await sql`
      SELECT id FROM weekly_price_history 
      WHERE week_number = ${weekNumber} AND week_year = ${weekYear}
    `;

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un registro para esta semana' },
        { status: 400 }
      );
    }

    const [result] = await sql`
      INSERT INTO weekly_price_history (
        week_number, week_year, week_start_date, week_end_date,
        status, captured_by, captured_at
      ) VALUES (
        ${weekNumber}, ${weekYear}, ${weekStartDate}, ${weekEndDate},
        'captured', ${capturedBy}, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating weekly price history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar semana de precios
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, status, notes, closedBy } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de semana requerido' },
        { status: 400 }
      );
    }

    let updateData = { updated_at: 'CURRENT_TIMESTAMP' };
    
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (closedBy) {
      updateData.closed_by = closedBy;
      updateData.closed_at = 'CURRENT_TIMESTAMP';
    }

    const [result] = await sql`
      UPDATE weekly_price_history
      SET 
        status = COALESCE(${status || null}, status),
        notes = COALESCE(${notes || null}, notes),
        closed_by = COALESCE(${closedBy || null}, closed_by),
        closed_at = CASE WHEN ${closedBy || null} IS NOT NULL THEN CURRENT_TIMESTAMP ELSE closed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    // Registrar en auditoría
    if (status === 'closed' || status === 'reopened') {
      await sql`
        INSERT INTO price_history_audit (
          week_history_id, action, user_name, timestamp
        ) VALUES (
          ${parseInt(id)},
          ${status === 'closed' ? 'Cerrar Semana' : 'Reabrir Semana'},
          ${closedBy},
          CURRENT_TIMESTAMP
        )
      `;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating weekly price history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar semana (solo superadmin)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`DELETE FROM weekly_price_history WHERE id = ${parseInt(id)}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting weekly price history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
