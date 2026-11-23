import sql from "@/app/api/utils/sql";
import {amount, dateKey, fixedConcepts, money, weeklyPortion} from "@/utils/closing-period";

export const fixedExpenseType = 'gasto_fijo_prorrateado';

export function fixedExpense(row) {
  const metadata = JSON.parse(row.notes);
  return {
    ...metadata, id:row.id, concept:row.concept, label:fixedConcepts[row.concept],
    estimate:amount(metadata.estimate), paid:metadata.paymentDate ? amount(row.total) : null,
    paymentDate:metadata.paymentDate ? dateKey(row.expense_date) : null,
  };
}

export async function getFixedExpenses() {
  const rows = await sql`
    SELECT id, concept, notes, expense_date, total FROM expenses
    WHERE expense_type = ${fixedExpenseType}
    ORDER BY expense_date DESC, id DESC
  `;
  return rows.map(fixedExpense);
}

export function allocateFixedExpenses(entries, start, end) {
  const details = entries.filter(entry => entry.from <= end && entry.to >= start).map(entry => ({
    id: entry.id, concept: entry.concept, label: entry.label, from: entry.from, to: entry.to,
    reference: entry.reference, paymentDate: entry.paymentDate, revision: entry.revision,
    estimate: entry.estimate, paid: entry.paid,
    portion: weeklyPortion(entry.paid ?? entry.estimate, entry.from, entry.to, start, end),
    status: entry.paid === null ? 'Estimado' : 'Pagado',
  }));
  const totals = Object.fromEntries(Object.keys(fixedConcepts).map(concept => [
    concept, money(details.filter(row => row.concept === concept).reduce((sum, row) => sum + row.portion, 0))
  ]));
  return {details, totals};
}
