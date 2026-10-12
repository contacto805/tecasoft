import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Email configuration (using simple SMTP - configure with your provider)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER || "user",
    pass: process.env.SMTP_PASS || "pass"
  }
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get('reportId');

  if (reportId) {
    // Get specific report
    const report = await sql`
      SELECT * FROM weekly_lotification_reports 
      WHERE id = ${parseInt(reportId)}
    `;
    return NextResponse.json(report[0] || null);
  }

  // Get all reports
  const reports = await sql`
    SELECT * FROM weekly_lotification_reports
    ORDER BY week_start_date DESC
  `;

  return NextResponse.json(reports);
}

export async function POST(request) {
  const { startDate, endDate, sendEmail } = await request.json();

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
      ${sendEmail ? true : false},
      ${sendEmail ? new Date().toISOString() : null}
    )
    RETURNING *
  `;

  const report = reportResult[0];

  // Send email if requested
  if (sendEmail) {
    const htmlContent = `
      <h2>📊 Reporte Semanal de Lotificación</h2>
      <p><strong>Período:</strong> ${startDate} al ${endDate}</p>
      
      <h3>📦 Cajas de 10kg por Grado</h3>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Grado</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Cajas</th>
        </tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Super</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_super}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Extra</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_extra}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Primera</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_primera}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Mediano</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_mediano}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Tercera</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_tercera}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Cuarta</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_cuarta}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Super B</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_super_b}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Extra B</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_extra_b}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Primera B</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_primera_b}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Mediano B</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_mediano_b}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Tercera B</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_10kg_boxes_tercera_b}</td></tr>
      </table>

      <h3>📦 Cajas de 6kg por Grado</h3>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Grado</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Cajas</th>
        </tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Extra</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_6kg_boxes_extra}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Primera</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_6kg_boxes_primera}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Mediano</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_6kg_boxes_mediano}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Tercera</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_6kg_boxes_tercera}</td></tr>
      </table>

      <h3>📊 Resumen General</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Métrica</th>
          <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Valor</th>
        </tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Total kg Procesado</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_kg_processed.toFixed(2)} kg</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Total kg Desperdicio</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_kg_waste.toFixed(2)} kg</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Total kg Pérdida</td><td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totals.total_kg_loss.toFixed(2)} kg</td></tr>
      </table>
    `;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@tecavofruits.com",
        to: "contacto@tecavofruits.com",
        subject: `📊 Reporte Semanal de Lotificación - ${startDate} al ${endDate}`,
        html: htmlContent
      });
    } catch (error) {
      console.error("Email send error:", error);
      // Don't fail the request if email fails
    }
  }

  return NextResponse.json(report);
}

export async function PUT(request) {
  const { reportId, records } = await request.json();

  // Update report with new aggregated data
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

  const result = await sql`
    UPDATE weekly_lotification_reports
    SET
      total_10kg_boxes_super = ${totals.total_10kg_boxes_super},
      total_10kg_boxes_extra = ${totals.total_10kg_boxes_extra},
      total_10kg_boxes_primera = ${totals.total_10kg_boxes_primera},
      total_10kg_boxes_mediano = ${totals.total_10kg_boxes_mediano},
      total_10kg_boxes_tercera = ${totals.total_10kg_boxes_tercera},
      total_10kg_boxes_cuarta = ${totals.total_10kg_boxes_cuarta},
      total_10kg_boxes_super_b = ${totals.total_10kg_boxes_super_b},
      total_10kg_boxes_extra_b = ${totals.total_10kg_boxes_extra_b},
      total_10kg_boxes_primera_b = ${totals.total_10kg_boxes_primera_b},
      total_10kg_boxes_mediano_b = ${totals.total_10kg_boxes_mediano_b},
      total_10kg_boxes_tercera_b = ${totals.total_10kg_boxes_tercera_b},
      total_6kg_boxes_extra = ${totals.total_6kg_boxes_extra},
      total_6kg_boxes_primera = ${totals.total_6kg_boxes_primera},
      total_6kg_boxes_mediano = ${totals.total_6kg_boxes_mediano},
      total_6kg_boxes_tercera = ${totals.total_6kg_boxes_tercera},
      total_kg_processed = ${totals.total_kg_processed},
      total_kg_waste = ${totals.total_kg_waste},
      total_kg_loss = ${totals.total_kg_loss},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${reportId}
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}
