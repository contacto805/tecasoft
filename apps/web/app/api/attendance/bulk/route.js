import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST - Crear registro de asistencia manual en bloque
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      employeeId,
      employeeName,
      date,
      checkInTime,
      checkOutTime,
      status,
      observations,
      isManual,
      manualEntryReason,
      manualEntryBy,
      late_minutes,
      hours_worked
    } = data;

    if (!employeeId || !employeeName || !date) {
      return NextResponse.json(
        { error: 'Datos incompletos: se requiere ID de empleado, nombre y fecha' },
        { status: 400 }
      );
    }

    // Check if record exists
    const existing = await sql`
      SELECT * FROM attendance_records
      WHERE employee_id = ${employeeId} AND date = ${date}
    `;

    let record;

    const prev = existing[0] || {};
    const useCheckIn = checkInTime || prev.check_in_time || null;
    const useCheckOut = checkOutTime || prev.check_out_time || null;
    const providedHours = hours_worked !== undefined ? hours_worked : undefined;
    const hCalc = providedHours !== undefined ? providedHours : (prev.hours_worked || 0);

    if (existing.length > 0) {
      // Update existing
      [record] = await sql`
        UPDATE attendance_records
        SET 
          status = ${status || prev.status || 'presente'},
          check_in_time = ${useCheckIn},
          check_out_time = ${useCheckOut},
          hours_worked = ${hCalc},
          observations = ${observations !== undefined ? observations : (prev.observations || null)},
          late_minutes = ${late_minutes !== undefined ? late_minutes : (prev.late_minutes || 0)},
          is_manual = ${isManual !== undefined ? isManual : true},
          manual_entry_reason = ${manualEntryReason || prev.manual_entry_reason || 'Actualizado'},
          manual_entry_by = ${manualEntryBy || prev.manual_entry_by || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
    } else {
      // Create new
      [record] = await sql`
        INSERT INTO attendance_records (
          employee_id,
          employee_name,
          date,
          check_in_time,
          check_out_time,
          hours_worked,
          status,
          observations,
          late_minutes,
          is_manual,
          manual_entry_reason,
          manual_entry_by
        )
        VALUES (
          ${employeeId},
          ${employeeName},
          ${date},
          ${useCheckIn},
          ${useCheckOut},
          ${hCalc},
          ${status || 'presente'},
          ${observations || null},
          ${late_minutes !== undefined ? late_minutes : 0},
          ${isManual !== undefined ? isManual : true},
          ${manualEntryReason || 'Registro'},
          ${manualEntryBy || null}
        )
        RETURNING *
      `;
    }

    // Trigger advanced engine (fijo/flexible, descuentos medio turno, etc)
    try {
      const base = new URL(request.url).origin;
      await fetch(`${base}/api/attendance/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date })
      });
    } catch(e){}

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Error creating bulk attendance:', error);
    return NextResponse.json({ error: 'No fue posible registrar la asistencia' }, { status: 500 });
  }
}
