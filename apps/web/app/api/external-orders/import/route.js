import { newLotToken } from "@/app/api/utils/lot-portal";
import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { externalApiUrl, orders } = await request.json();

    if (!externalApiUrl || !orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'URL de API y órdenes requeridas' },
        { status: 400 }
      );
    }

    const importedLots = [];
    const errors = [];

    for (const order of orders) {
      try {
        // Map external order to lot structure
        const lot = {
          lot_number: order.lot_number || order.numero_lote || `EXT-${order.id}`,
          producer: order.producer || order.productor || '',
          orchard_name: order.orchard_name || order.huerta || '',
          fruit_type: order.fruit_type || order.tipo_fruta || 'Aguacate',
          date: order.date || order.fecha || new Date().toISOString().split('T')[0],
          fruit_price: parseFloat(order.fruit_price || order.precio_fruta || 0),
          collector_name: order.collector_name || order.acopiador || '',
          commission_amount: parseFloat(order.commission_amount || order.comision || 0),
          payment_days: parseInt(order.payment_days || order.dias_pago || 0),
          is_cut_fruit: order.is_cut_fruit || order.es_fruta_cortada || false,
          origin: order.origin || order.origen || ''
        };

        // Check if lot number already exists
        const existing = await sql`
          SELECT id FROM lots WHERE lot_number = ${lot.lot_number}
        `;

        if (existing.length > 0) {
          errors.push(`Lote ${lot.lot_number} ya existe en el sistema`);
          continue;
        }

        // Insert lot
        const result = await sql`
        WITH new_lot AS (
          INSERT INTO lots (
            lot_number, producer, origin, fruit_type, date, 
            fruit_price, collector_name, commission_amount, 
            payment_days, is_cut_fruit, orchard_name, status
          )
          VALUES (
            ${lot.lot_number}, ${lot.producer}, ${lot.origin}, 
            ${lot.fruit_type}, ${lot.date}, ${lot.fruit_price}, 
            ${lot.collector_name}, ${lot.commission_amount}, 
            ${lot.payment_days}, ${lot.is_cut_fruit}, 
            ${lot.orchard_name}, 'Pendiente'
          )
          RETURNING id, lot_number
        ), new_link AS (
          INSERT INTO public_lot_links (lot_id, public_token, is_active, created_at, updated_at)
          SELECT id, ${newLotToken()}, true, NOW(), NOW() FROM new_lot
          RETURNING lot_id
        )
        SELECT new_lot.* FROM new_lot JOIN new_link ON new_link.lot_id = new_lot.id
        `;

        if (result.length > 0) {
          importedLots.push({
            id: result[0].id,
            lot_number: result[0].lot_number
          });
        }
      } catch (err) {
        console.error(`Error importing order ${order.id}:`, err);
        errors.push(`Error al importar orden ${order.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedLots,
      errors: errors,
      total: orders.length,
      successful: importedLots.length,
      failed: errors.length
    });
  } catch (error) {
    console.error('Error importing orders:', error);
    return NextResponse.json(
      { error: 'Error al importar órdenes: ' + error.message },
      { status: 500 }
    );
  }
}
