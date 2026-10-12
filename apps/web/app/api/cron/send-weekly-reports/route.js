import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER || "user",
    pass: process.env.SMTP_PASS || "pass"
  }
});

export async function GET(request) {
  // Security: Verify request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the previous week's start and end date
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSaturday = new Date(today);
    lastSaturday.setDate(today.getDate() - (dayOfWeek === 0 ? 1 : dayOfWeek + 1));
    const weekBefore = new Date(lastSaturday);
    weekBefore.setDate(lastSaturday.getDate() - 7);

    const startDate = weekBefore.toISOString().split('T')[0];
    const endDate = lastSaturday.toISOString().split('T')[0];

    // Fetch all lotification records for the week
    const records = await sql`
      SELECT lr.*
      FROM lotification_records lr
      LEFT JOIN lots l ON lr.lot_id = l.id
      WHERE DATE(l.date) >= ${startDate} AND DATE(l.date) <= ${endDate}
    `;

    // Calculate totals
    const totals = {
      total_10kg_boxes_super: 0,
      total_10kg_boxes_extra: 0,
      total_10kg_boxes_primera: 0,
      total_10kg_boxes_mediano: 0,
      total_10kg_boxes_tercera: 0,
      total_10kg_boxes_cuarta: 0,
      total_10kg_boxes_super_b: 0,
      total_10kg_boxes_extra_b: 0,
      total_10kg_boxes_primera_b: 0,
      total_10kg_boxes_mediano_b: 0,
      total_10kg_boxes_tercera_b: 0,
      total_6kg_boxes_extra: 0,
      total_6kg_boxes_primera: 0,
      total_6kg_boxes_mediano: 0,
      total_6kg_boxes_tercera: 0,
      total_kg_processed: 0,
      total_kg_waste: 0,
      total_kg_loss: 0
    };

    records.forEach(record => {
      totals.total_10kg_boxes_super += record.grade_super || 0;
      totals.total_10kg_boxes_extra += record.grade_extra || 0;
      totals.total_10kg_boxes_primera += record.grade_primera || 0;
      totals.total_10kg_boxes_mediano += record.grade_mediano || 0;
      totals.total_10kg_boxes_tercera += record.grade_tercera || 0;
      totals.total_10kg_boxes_cuarta += record.grade_cuarta || 0;
      totals.total_10kg_boxes_super_b += record.grade_super_b || 0;
      totals.total_10kg_boxes_extra_b += record.grade_extra_b || 0;
      totals.total_10kg_boxes_primera_b += record.grade_primera_b || 0;
      totals.total_10kg_boxes_mediano_b += record.grade_mediano_b || 0;
      totals.total_10kg_boxes_tercera_b += record.grade_tercera_b || 0;
      totals.total_6kg_boxes_extra += record.grade_extra_6kg || 0;
      totals.total_6kg_boxes_primera += record.grade_primera_6kg || 0;
      totals.total_6kg_boxes_mediano += record.grade_mediano_6kg || 0;
      totals.total_6kg_boxes_tercera += record.grade_tercera_6kg || 0;
      totals.total_kg_processed += parseFloat(record.total_kg_processed) || 0;
      totals.total_kg_waste += parseFloat(record.total_kg_waste) || 0;
      totals.total_kg_loss += parseFloat(record.total_kg_loss) || 0;
    });

    // Insert report
    const reportResult = await sql`
      INSERT INTO weekly_lotification_reports (
        week_start_date,
        week_end_date,
        total_10kg_boxes_super,
        total_10kg_boxes_extra,
        total_10kg_boxes_primera,
        total_10kg_boxes_mediano,
        total_10kg_boxes_tercera,
        total_10kg_boxes_cuarta,
        total_10kg_boxes_super_b,
        total_10kg_boxes_extra_b,
        total_10kg_boxes_primera_b,
        total_10kg_boxes_mediano_b,
        total_10kg_boxes_tercera_b,
        total_6kg_boxes_extra,
        total_6kg_boxes_primera,
        total_6kg_boxes_mediano,
        total_6kg_boxes_tercera,
        total_kg_processed,
        total_kg_waste,
        total_kg_loss,
        email_sent,
        sent_at
      ) VALUES (
        ${startDate},
        ${endDate},
        ${totals.total_10kg_boxes_super},
        ${totals.total_10kg_boxes_extra},
        ${totals.total_10kg_boxes_primera},
        ${totals.total_10kg_boxes_mediano},
        ${totals.total_10kg_boxes_tercera},
        ${totals.total_10kg_boxes_cuarta},
        ${totals.total_10kg_boxes_super_b},
        ${totals.total_10kg_boxes_extra_b},
        ${totals.total_10kg_boxes_primera_b},
        ${totals.total_10kg_boxes_mediano_b},
        ${totals.total_10kg_boxes_tercera_b},
        ${totals.total_6kg_boxes_extra},
        ${totals.total_6kg_boxes_primera},
        ${totals.total_6kg_boxes_mediano},
        ${totals.total_6kg_boxes_tercera},
        ${totals.total_kg_processed},
        ${totals.total_kg_waste},
        ${totals.total_kg_loss},
        true,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const report = reportResult[0];

    // Build email HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0f766e 0%, #06b6d4 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          h2 { margin: 0; font-size: 24px; }
          .subtitle { font-size: 14px; opacity: 0.9; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f0f9ff; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #e0f2fe; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .summary-box { background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 6px; padding: 20px; margin-bottom: 20px; }
          .summary-box h3 { margin-top: 0; color: #0f766e; }
          .metric-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe; }
          .metric-row:last-child { border-bottom: none; }
          .metric-label { font-weight: 500; }
          .metric-value { font-weight: bold; color: #0f766e; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Reporte Semanal de Lotificación</h2>
            <div class="subtitle">Semana del ${new Date(startDate).toLocaleDateString('es-MX')} al ${new Date(endDate).toLocaleDateString('es-MX')}</div>
          </div>

          <div class="summary-box">
            <h3>⚖️ Resumen General</h3>
            <div class="metric-row">
              <span class="metric-label">Total kg Procesado:</span>
              <span class="metric-value">${totals.total_kg_processed.toFixed(2)} kg</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total kg Desperdicio:</span>
              <span class="metric-value" style="color: #ea580c;">${totals.total_kg_waste.toFixed(2)} kg</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total kg Pérdida:</span>
              <span class="metric-value" style="color: #dc2626;">${totals.total_kg_loss.toFixed(2)} kg</span>
            </div>
          </div>

          <h3>📦 Cajas de 10kg por Grado</h3>
          <table>
            <thead>
              <tr>
                <th>Grado</th>
                <th style="text-align: right;">Cajas</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Super</td><td style="text-align: right;">${totals.total_10kg_boxes_super}</td></tr>
              <tr><td>Extra</td><td style="text-align: right;">${totals.total_10kg_boxes_extra}</td></tr>
              <tr><td>Primera</td><td style="text-align: right;">${totals.total_10kg_boxes_primera}</td></tr>
              <tr><td>Mediano</td><td style="text-align: right;">${totals.total_10kg_boxes_mediano}</td></tr>
              <tr><td>Tercera</td><td style="text-align: right;">${totals.total_10kg_boxes_tercera}</td></tr>
              <tr><td>Cuarta</td><td style="text-align: right;">${totals.total_10kg_boxes_cuarta}</td></tr>
              <tr><td>Super B</td><td style="text-align: right;">${totals.total_10kg_boxes_super_b}</td></tr>
              <tr><td>Extra B</td><td style="text-align: right;">${totals.total_10kg_boxes_extra_b}</td></tr>
              <tr><td>Primera B</td><td style="text-align: right;">${totals.total_10kg_boxes_primera_b}</td></tr>
              <tr><td>Mediano B</td><td style="text-align: right;">${totals.total_10kg_boxes_mediano_b}</td></tr>
              <tr><td>Tercera B</td><td style="text-align: right;">${totals.total_10kg_boxes_tercera_b}</td></tr>
            </tbody>
          </table>

          <h3>📦 Cajas de 6kg por Grado</h3>
          <table>
            <thead>
              <tr>
                <th>Grado</th>
                <th style="text-align: right;">Cajas</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Extra</td><td style="text-align: right;">${totals.total_6kg_boxes_extra}</td></tr>
              <tr><td>Primera</td><td style="text-align: right;">${totals.total_6kg_boxes_primera}</td></tr>
              <tr><td>Mediano</td><td style="text-align: right;">${totals.total_6kg_boxes_mediano}</td></tr>
              <tr><td>Tercera</td><td style="text-align: right;">${totals.total_6kg_boxes_tercera}</td></tr>
            </tbody>
          </table>

          <div class="footer">
            <p>Este es un reporte automático generado por Tecavo Fruits</p>
            <p>RFC: TFR230302EU5</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@tecavofruits.com",
      to: "contacto@tecavofruits.com",
      subject: `📊 Reporte Semanal de Lotificación - ${startDate} al ${endDate}`,
      html: htmlContent
    });

    return NextResponse.json({
      success: true,
      message: `Reporte generado y enviado para la semana ${startDate} al ${endDate}`,
      recordsCount: records.length,
      totals
    });

  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
