import {NextResponse} from "next/server";
import sql from "@/app/api/utils/sql";
import {getVerifiedErpUser} from "@/app/api/utils/erp-session-proof";
import {fixedExpense, fixedExpenseType, getFixedExpenses} from "@/app/api/utils/fixed-expenses";
import {fixedConcepts, money, validDate} from "@/utils/closing-period";

const json = (body, status = 200) => NextResponse.json(body, {status, headers:{'Cache-Control':'no-store'}});
const fail = (error, status) => json({error}, status);
const validMoney = val => val !== '' && val != null && Number(val) >= 0 && Number(val) <= 1000000000;
const canWrite = user => user.is_super_admin || /admin|gasto|contab/i.test(user.admin_role || '');

export async function GET() {
  try {
    if (!await getVerifiedErpUser()) return fail('Inicia sesión en Tecavo Soft.',401);
    return json(await getFixedExpenses());
  } catch (error) {
    console.error('Gastos fijos:',error);
    return fail('No se pudieron consultar los gastos fijos.',500);
  }
}

export async function POST(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user || !canWrite(user)) return fail('Se requiere acceso de administración o gastos.', user ? 403 : 401);
    const {concept, from, to, estimate, requestId, reference: ref} = await request.json();
    const reference = String(ref ?? '').trim();
    if (!Object.hasOwn(fixedConcepts, concept) || !validDate(from) || !validDate(to) || from > to ||
        (Date.parse(to) - Date.parse(from)) / 86400000 > 365 || !validMoney(estimate) ||
        !/^[a-f0-9-]{36}$/.test(requestId || '') || reference.length > 140) {
      return fail('Revisa el concepto, periodo y estimado.',400);
    }
    const metadata = {from, to, reference, requestId, estimate:money(estimate), revision:1,
      history:[{action:'estimado', amount:money(estimate), by:user.id, at:new Date().toISOString()}]};
    const key = concept + '|' + reference.toLocaleLowerCase('es-MX');
    const [, rows] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`,
      sql`
        WITH fixed AS MATERIALIZED (
          SELECT concept,notes::jsonb AS metadata FROM expenses WHERE expense_type = ${fixedExpenseType}
        )
        INSERT INTO expenses (product_name, cost_per_unit, quantity, total, department, notes,
          expense_date, expense_type, concept, recorded_by, status)
        SELECT ${fixedConcepts[concept]}, 0, 1, 0, 'Empaque', ${JSON.stringify(metadata)},
          ${from}::date, ${fixedExpenseType}, ${concept}, ${String(user.id)}, 'pendiente'
        WHERE NOT EXISTS (
          SELECT 1 FROM fixed WHERE concept = ${concept}
            AND lower(metadata->>'reference') = lower(${reference})
            AND (metadata->>'from') <= ${to} AND (metadata->>'to') >= ${from}
        )
        RETURNING *
      `
    ]);
    if (rows.length) return json(fixedExpense(rows[0]),201);
    const [original] = await sql`SELECT * FROM expenses WHERE (CASE WHEN expense_type = ${fixedExpenseType} THEN notes::jsonb->>'requestId' END) = ${requestId}`;
    return original ? json(fixedExpense(original)) : fail('Ya existe un gasto de este concepto y referencia en el periodo.',409);
  } catch (error) {
    console.error('Alta de gasto fijo:',error);
    return fail('No se pudo registrar el gasto fijo.',500);
  }
}

export async function PUT(request) {
  try {
    const user = await getVerifiedErpUser();
    if (!user || !canWrite(user)) return fail('Se requiere acceso de administración o gastos.', user ? 403 : 401);
    const {id, revision, value, paymentDate, invoice, action} = await request.json();
    if (!/^\d+$/.test(String(id)) || !['estimate','pay'].includes(action) || !validMoney(value) ||
        (action === 'pay' && (!validDate(paymentDate) || String(invoice ?? '').length > 140))) {
      return fail('Revisa el importe y la fecha de pago.',400);
    }
    const [original] = await sql`SELECT * FROM expenses WHERE id = ${id} AND expense_type = ${fixedExpenseType}`;
    if (!original) return fail('Gasto fijo no encontrado.',404);
    const metadata = JSON.parse(original.notes);
    if (metadata.revision !== revision) return fail('El gasto cambió. Actualiza antes de editar.',409);
    if (action === 'estimate' && metadata.paymentDate) return fail('El gasto ya tiene un importe real.',409);
    const number = money(value);
    metadata.history.push({action, amount:number, paymentDate:action === 'pay' ? paymentDate : null,
      invoice:action === 'pay' ? String(invoice ?? '').trim() : null, by:user.id, at:new Date().toISOString()});
    metadata.revision++;
    if (action === 'estimate') metadata.estimate = number;
    else {
      metadata.paymentDate = paymentDate;
      metadata.invoice = String(invoice ?? '').trim();
    }
    const [updated] = await sql`
      UPDATE expenses SET
        notes = ${JSON.stringify(metadata)}, total = ${action === 'pay' ? number : 0},
        cost_per_unit = ${action === 'pay' ? number : 0}, expense_date = ${metadata.paymentDate || metadata.from},
        status = ${action === 'pay' ? 'aprobado' : 'pendiente'}, updated_at = NOW()
      WHERE id = ${id} AND notes = ${original.notes}
      RETURNING *
    `;
    return updated ? json(fixedExpense(updated)) : fail('El gasto cambió. Actualiza antes de editar.',409);
  } catch (error) {
    console.error('Actualización de gasto fijo:',error);
    return fail('No se pudo actualizar el gasto fijo.',500);
  }
}
