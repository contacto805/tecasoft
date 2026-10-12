import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 8);

    const startStr = today.toISOString().split('T')[0];
    const endStr = limitDate.toISOString().split('T')[0];

    // Show lots whose payment_scheduled_date is today or within the next 8 days
    const lots = await sql`
      SELECT 
        l.*,
        COALESCE(w.total_kg, 0) as total_kg,
        COALESCE(w.total_boxes, 0) as total_boxes,
        COALESCE(l.payment_days, 0) as payment_days,
        l.payment_scheduled_date as payment_due_date
      FROM lots l
      LEFT JOIN (
        SELECT lot_id, SUM(net_weight) as total_kg, SUM(boxes) as total_boxes 
        FROM weighings GROUP BY lot_id
      ) w ON l.id = w.lot_id
      WHERE l.payment_scheduled_date IS NOT NULL 
        AND l.payment_scheduled_date::date >= ${startStr}
        AND l.payment_scheduled_date::date <= ${endStr}
        AND l.status != 'cancelado'
      ORDER BY l.payment_scheduled_date ASC
    `;

    // Group by payment date
    const grouped = {};
    lots.forEach(lot => {
      const paymentDate = lot.payment_scheduled_date;
      if (!grouped[paymentDate]) {
        grouped[paymentDate] = [];
      }
      grouped[paymentDate].push(lot);
    });

    return NextResponse.json({
      total: lots.length,
      grouped,
      lots,
      windowInfo: `Mostrando entradas con pago programado en los próximos 8 días`
    });
  } catch (error) {
    console.error('Error fetching upcoming payments:', error);
    return NextResponse.json({ error: 'Error al cargar los pagos pendientes. Por favor intenta nuevamente.' }, { status: 500 });
  }
}
