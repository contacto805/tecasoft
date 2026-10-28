import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { getMexicoCityTime } from "@/app/api/utils/mexico-time";

// GET - Obtener registros de asistencia
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const date = searchParams.get('date');

    let query;

    if (date) {
      // Obtener asistencias de un día específico
      query = sql`
        SELECT * FROM attendance_records
        WHERE date = ${date}
        ORDER BY check_in_time DESC
      `;
    } else if (employeeId && startDate && endDate) {
      // Obtener asistencias de un empleado en un rango
      query = sql`
        SELECT * FROM attendance_records
        WHERE employee_id = ${employeeId}
          AND date BETWEEN ${startDate} AND ${endDate}
        ORDER BY date DESC
      `;
    } else if (startDate && endDate) {
      // Obtener todas las asistencias en un rango
      query = sql`
        SELECT * FROM attendance_records
        WHERE date BETWEEN ${startDate} AND ${endDate}
        ORDER BY date DESC, check_in_time DESC
      `;
    } else {
      // Obtener últimos registros
      query = sql`
        SELECT * FROM attendance_records
        ORDER BY date DESC, check_in_time DESC
        LIMIT 100
      `;
    }

    const records = await query;
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Registrar entrada/salida con huella
export async function POST(request) {
  try {
    const { 
      employeeId, 
      employeeName, 
      fingerprintData, 
      type, // 'check_in' o 'check_out'
      deviceId,
      isManual = false,
      manualEntryReason,
      manualEntryBy
    } = await request.json();

    if (!employeeId || !employeeName || !type) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const { date: today, time: mxTime } = getMexicoCityTime();
    const now = new Date(); // server reference is Mexico City authoritative time from this point for all records (date/time fields)

    // 1. Verificar si el empleado tiene huella registrada (solo si no es manual)
    if (!isManual && fingerprintData) {
      const fingerprints = await sql`
        SELECT * FROM employee_fingerprints
        WHERE employee_id = ${employeeId} AND is_active = true
      `;

      if (fingerprints.length === 0) {
        return NextResponse.json(
          { error: 'Empleado no tiene huella registrada' },
          { status: 400 }
        );
      }

      // Aquí iría la validación real de la huella biométrica
      // Por ahora asumimos que la huella coincide
    }

    // 2. Verificar si ya existe un registro para hoy
    const existing = await sql`
      SELECT * FROM attendance_records
      WHERE employee_id = ${employeeId} AND date = ${today}
    `;

    if (type === 'check_in') {
      // Registro de entrada
      if (existing.length > 0 && existing[0].check_in_time) {
        return NextResponse.json(
          { error: 'Ya existe un registro de entrada para hoy', record: existing[0] },
          { status: 409 }
        );
      }

      const nowTs = `${today}T${mxTime}`;
      if (existing.length > 0) {
        // Actualizar registro existente
        const [updated] = await sql`
          UPDATE attendance_records
          SET check_in_time = ${nowTs},
              is_manual = ${isManual},
              manual_entry_reason = ${manualEntryReason || null},
              manual_entry_by = ${manualEntryBy || null},
              device_id = ${deviceId ? parseInt(deviceId) : null},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existing[0].id}
          RETURNING *
        `;
        return NextResponse.json({ success: true, record: updated, action: 'check_in' });
      } else {
        // Crear nuevo registro
        const [created] = await sql`
          INSERT INTO attendance_records (
            employee_id,
            employee_name,
            date,
            check_in_time,
            is_manual,
            manual_entry_reason,
            manual_entry_by,
            device_id,
            status
          )
          VALUES (
            ${employeeId},
            ${employeeName},
            ${today},
            ${nowTs},
            ${isManual},
            ${manualEntryReason || null},
            ${manualEntryBy || null},
            ${deviceId ? parseInt(deviceId) : null},
            'presente'
          )
          RETURNING *
        `;
        try {
          const base = new URL(request.url).origin;
          await fetch(`${base}/api/attendance/calculate`, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ employeeId, date: today })
          });
        } catch(e){}
        return NextResponse.json({ success: true, record: created, action: 'check_in' });
      }
    }

    if (type === 'check_out') {
      // Registro de salida
      if (existing.length === 0 || !existing[0].check_in_time) {
        return NextResponse.json(
          { error: 'No se ha registrado entrada para hoy' },
          { status: 400 }
        );
      }

      if (existing[0].check_out_time) {
        return NextResponse.json(
          { error: 'Ya existe un registro de salida para hoy', record: existing[0] },
          { status: 409 }
        );
      }

      // Calcular horas trabajadas (usando hora oficial CDMX)
      const nowTsOut = `${today}T${mxTime}`;
      const checkIn = new Date(existing[0].check_in_time);
      const checkOut = new Date(nowTsOut);
      const hoursWorked = (checkOut - checkIn) / (1000 * 60 * 60); // convertir ms a horas

      // Importante: NO generar horas extras, solo contar las horas de la jornada laboral
      const standardWorkHours = 8;
      const recordedHours = Math.min(hoursWorked, standardWorkHours);

      const [updated] = await sql`
        UPDATE attendance_records
        SET check_out_time = ${nowTsOut},
            hours_worked = ${recordedHours.toFixed(2)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `;

      // Run advanced engine for fixed/flex + discounts
      try {
        const base = new URL(request.url).origin;
        await fetch(`${base}/api/attendance/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId, date: today })
        });
      } catch(e){}

      return NextResponse.json({ 
        success: true, 
        record: updated, 
        action: 'check_out',
        hoursWorked: recordedHours.toFixed(2)
      });
    }

    return NextResponse.json({ error: 'Tipo de registro inválido' }, { status: 400 });
  } catch (error) {
    console.error('Error registering attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar registro manual (requiere autorización)
export async function PUT(request) {
  try {
    const { 
      recordId, 
      checkInTime, 
      checkOutTime, 
      manualEntryReason, 
      authorizedBy,
      status,
      observations,
      late_minutes,
      hours_worked
    } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'ID de registro requerido' },
        { status: 400 }
      );
    }

    // Obtener el registro actual
    const [current] = await sql`
      SELECT * FROM attendance_records WHERE id = ${parseInt(recordId)}
    `;

    if (!current) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Calcular nuevas horas trabajadas si hay entrada y salida
    let hoursWorked = hours_worked !== undefined ? hours_worked : current.hours_worked;
    if (checkInTime && checkOutTime) {
      const checkIn = new Date(checkInTime);
      const checkOut = new Date(checkOutTime);
      const hours = (checkOut - checkIn) / (1000 * 60 * 60);
      const standardWorkHours = 12;
      hoursWorked = Math.max(0, Math.min(hours, standardWorkHours)).toFixed(2);
    }

    const [updated] = await sql`
      UPDATE attendance_records
      SET check_in_time = ${checkInTime !== undefined ? checkInTime : current.check_in_time},
          check_out_time = ${checkOutTime !== undefined ? checkOutTime : current.check_out_time},
          hours_worked = ${hoursWorked},
          status = ${status !== undefined ? status : current.status},
          observations = ${observations !== undefined ? observations : current.observations},
          late_minutes = ${late_minutes !== undefined ? late_minutes : current.late_minutes},
          is_manual = true,
          manual_entry_reason = ${manualEntryReason || current.manual_entry_reason},
          manual_entry_by = ${authorizedBy || current.manual_entry_by},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(recordId)}
      RETURNING *
    `;

    // Trigger full engine (retardos, flexible, descuentos 50%)
    try {
      const base = new URL(request.url).origin;
      await fetch(`${base}/api/attendance/calculate`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ employeeId: current.employee_id, date: current.date })
      });
    } catch(e){}

    return NextResponse.json({ 
      success: true, 
      record: updated,
      message: 'Registro actualizado manualmente'
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar registro (solo superadmin)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await sql`DELETE FROM attendance_records WHERE id = ${parseInt(id)}`;

    return NextResponse.json({
      success: true,
      message: 'Registro eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
