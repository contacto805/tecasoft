import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const lotId = searchParams.get('lotId');
    const period = searchParams.get('period'); // 'day', 'week', 'month'

    let whereConditions = sql`WHERE 1=1`;

    if (startDate && endDate) {
      whereConditions = sql`${whereConditions} AND pb.production_date BETWEEN ${startDate} AND ${endDate}`;
    }

    if (lotId) {
      whereConditions = sql`${whereConditions} AND pb.lot_id = ${parseInt(lotId)}`;
    }

    // Get production batches with details
    const reports = await sql`
      SELECT 
        pb.id,
        pb.lot_id,
        pb.production_date,
        pb.packed_boxes_count,
        pb.status,
        l.lot_number,
        l.producer,
        l.orchard_name,
        COUNT(tl.id) as labels_count,
        SUM(tl.pallets_complete) as total_pallets,
        SUM(tl.boxes_96) as total_boxes_96,
        SUM(tl.boxes_156) as total_boxes_156
      FROM production_batches pb
      JOIN lots l ON pb.lot_id = l.id
      LEFT JOIN thermal_labels tl ON tl.production_batch_id = pb.id
      ${whereConditions}
      GROUP BY pb.id, l.lot_number, l.producer, l.orchard_name
      ORDER BY pb.production_date DESC, pb.created_at DESC
    `;

    // Group by period if requested
    if (period) {
      const grouped = {};
      reports.forEach(report => {
        const date = new Date(report.production_date);
        let key;
        
        if (period === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (period === 'week') {
          const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
          key = firstDay.toISOString().split('T')[0];
        } else if (period === 'month') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(report);
      });

      return NextResponse.json({ grouped, reports });
    }

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching production reports:', error);
    return NextResponse.json(
      { error: 'Error fetching production reports' },
      { status: 500 }
    );
  }
}

// Get detailed report for a specific batch
export async function POST(request) {
  try {
    const { production_batch_id } = await request.json();

    if (!production_batch_id) {
      return NextResponse.json(
        { error: 'production_batch_id is required' },
        { status: 400 }
      );
    }

    // Get batch info
    const [batch] = await sql`
      SELECT 
        pb.*,
        l.lot_number,
        l.producer,
        l.orchard_name,
        fiw.total_kg_weighed,
        mb.batch_number
      FROM production_batches pb
      JOIN lots l ON pb.lot_id = l.id
      LEFT JOIN fruit_input_weighings fiw ON fiw.lot_id = l.id
      LEFT JOIN master_batches mb ON mb.id = pb.master_batch_id
      WHERE pb.id = ${parseInt(production_batch_id)}
    `;

    if (!batch) {
      return NextResponse.json(
        { error: 'Production batch not found' },
        { status: 404 }
      );
    }

    // Get all labels for this batch
    const labels = await sql`
      SELECT * FROM thermal_labels
      WHERE production_batch_id = ${parseInt(production_batch_id)}
      ORDER BY created_at ASC
    `;

    // Group by caliber and class
    const summary = labels.reduce((acc, label) => {
      const key = `${label.caliber}_${label.class_name}`;
      if (!acc[key]) {
        acc[key] = {
          caliber: label.caliber,
          class_name: label.class_name,
          pallets: 0,
          boxes_96: 0,
          boxes_156: 0,
          total_kg: 0,
          labels_count: 0
        };
      }
      acc[key].pallets += label.pallets_complete || 0;
      acc[key].boxes_96 += label.boxes_96 || 0;
      acc[key].boxes_156 += label.boxes_156 || 0;
      acc[key].total_kg += parseFloat(label.total_kg || 0);
      acc[key].labels_count += 1;
      return acc;
    }, {});

    return NextResponse.json({
      batch,
      labels,
      summary: Object.values(summary),
      totals: {
        total_pallets: labels.reduce((sum, l) => sum + (l.pallets_complete || 0), 0),
        total_boxes_96: labels.reduce((sum, l) => sum + (l.boxes_96 || 0), 0),
        total_boxes_156: labels.reduce((sum, l) => sum + (l.boxes_156 || 0), 0),
        total_labels: labels.length
      }
    });
  } catch (error) {
    console.error('Error generating detailed report:', error);
    return NextResponse.json(
      { error: 'Error generating detailed report' },
      { status: 500 }
    );
  }
}
