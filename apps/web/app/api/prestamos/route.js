import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// Generate automatic folio like PR-2025-0001
async function generateFolio() {
  const year = new Date().getFullYear();
  const max = await sql`SELECT COALESCE(MAX(id), 0) as maxid FROM employee_loans`;
  const nextNum = (max[0]?.maxid || 0) + 1;
  return `PR-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const withDetails = searchParams.get('details') === 'true';

    let loans = await sql`
      SELECT el.*,
             COALESCE(el.remaining_balance, el.amount) as saldo_calculado,
             COALESCE(el.interest_rate, 0) as interest_rate
      FROM employee_loans el
      ORDER BY el.created_at DESC
    `;

    // Attach calculated payment history totals
    if (withDetails || true) {
      const pags = await sql`
        SELECT loan_id, COALESCE(SUM(monto), 0) as total_paid
        FROM employee_loan_payments
        GROUP BY loan_id
      `;
      const paidMap = {};
      pags.forEach(p => { paidMap[p.loan_id] = parseFloat(p.total_paid) || 0; });

      const now = new Date();
      loans = loans.map(l => {
        const original = parseFloat(l.amount) || 0;
        const weekly = parseFloat(l.descuento_semanal) || 0;
        const paid = paidMap[l.id] || 0;
        const remaining = Math.max(0, parseFloat(l.remaining_balance || original) - paid);
        const pct = original > 0 ? Math.round(((original - remaining) / original) * 100) : 0;

        let indicador = 'activo';
        let color = 'yellow';
        if (remaining <= 0 || (l.status || '').toLowerCase() === 'liquidado' || (l.status || '').toLowerCase() === 'paid') {
          indicador = 'liquidado'; color = 'green';
        } else if (l.fecha_inicio_descuento && weekly > 0) {
          const start = new Date(l.fecha_inicio_descuento);
          const expectedWeeks = parseInt(l.num_semanas) || 1;
          const semanasTranscurridas = Math.max(0, Math.floor((now - start) / (1000 * 3600 * 24 * 7)));
          // Atrasado si pasaron mas semanas de lo que permite la cuota y saldo >0 
          if (semanasTranscurridas > expectedWeeks) {
            indicador = 'atrasado'; color = 'red';
          } else if (expectedWeeks - semanasTranscurridas < 3) {
            indicador = 'proximo'; color = 'yellow';
          }
        }

        // Normalize estado to match requested (pendiente / aprobado / rechazado)
        let estado = (l.status || 'pendiente').toLowerCase();
        if (estado === 'activo' || estado === 'active') estado = 'aprobado';
        if (['liquidado', 'paid', 'pagado'].includes(estado)) estado = 'aprobado';

        return {
          ...l,
          monto_original: original,
          total_descontado: paid,
          saldo_pendiente: Math.round(remaining * 100) / 100,
          porcentaje_liquidado: pct,
          indicador,
          color,
          semanas_restantes: Math.max(0, parseInt(l.num_semanas || 1) - Math.max(0, Math.floor((paid / (weekly || 1))))),
          interest_rate: parseFloat(l.interest_rate || 0),
          estado,
          plazo: parseInt(l.num_semanas || 0),
          descuento_semanal_aplicado: weekly
        };
      });
    }

    return NextResponse.json(loans);
  } catch (error) {
    console.error('Error fetching préstamos:', error);
    return NextResponse.json({ error: 'Error al cargar préstamos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    const isAdvance = (data.type || '').toLowerCase().includes('anticipo') || data.type === 'adelanto';

    let descuentoSemanal = parseFloat(data.descuento_semanal) || 0;
    let numSemanas = parseInt(data.num_semanas) || 1;
    let monto = parseFloat(data.amount || data.monto) || 0;

    // Auto calcs from spec
    if (monto > 0 && descuentoSemanal > 0) {
      numSemanas = Math.ceil(monto / descuentoSemanal);
    } else if (isAdvance && monto > 0 && !descuentoSemanal) {
      // Adelanto defaults. If divide into n weeks: 
      const divide = parseInt(data.divide_en_semanas || '1') || 1;
      descuentoSemanal = monto / divide;
      numSemanas = divide;
    }

    const folio = await generateFolio();
    const interestRate = parseFloat(data.interest_rate || data.tasa_interes || 0) || 0;

    const [loan] = await sql`
      INSERT INTO employee_loans (
        employee_id, employee_name, type, amount, 
        reason, payment_terms, notes,
        status,
        folio, fecha_prestamo, descuento_semanal, num_semanas, 
        fecha_inicio_descuento, autorizado_por, remaining_balance,
        interest_rate
      ) VALUES (
        ${data.employee_id}, ${data.employee_name}, ${data.type || 'prestamo'}, ${monto},
        ${data.reason || ''}, ${data.payment_terms || ''}, ${data.notes || ''},
        'pendiente',
        ${folio},
        ${data.fecha_prestamo || new Date().toISOString().split('T')[0]},
        ${descuentoSemanal},
        ${numSemanas},
        ${data.fecha_inicio_descuento || new Date().toISOString().split('T')[0]},
        ${data.autorizado_por || 'Administración'},
        ${monto},
        ${interestRate}
      )
      RETURNING *
    `;

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error creating préstamo:', error);
    return NextResponse.json({ error: 'Error creando registro' }, { status: 500 });
  }
}
