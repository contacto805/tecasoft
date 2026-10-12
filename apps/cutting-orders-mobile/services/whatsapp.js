/**
 * WhatsApp Business API Integration Module
 * Tecavo Soft - Cutting Orders Mobile App
 * 
 * Handles sending notifications via WhatsApp Business API
 */

import axios from 'axios';

const WHATSAPP_API_VERSION = 'v21.0';

/**
 * WhatsApp Service Configuration
 * Reads credentials from environment variables
 */
const WhatsAppConfig = {
  phoneNumberId: process.env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.EXPO_PUBLIC_WHATSAPP_BUSINESS_ACCOUNT_ID,
  accessToken: process.env.EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN,
  apiBaseUrl: `https://graph.facebook.com/${WHATSAPP_API_VERSION}`,
};

/**
 * Validate WhatsApp Configuration
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export const validateWhatsAppConfig = () => {
  const missing = [];
  
  if (!WhatsAppConfig.phoneNumberId) missing.push('EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID');
  if (!WhatsAppConfig.businessAccountId) missing.push('EXPO_PUBLIC_WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (!WhatsAppConfig.accessToken) missing.push('EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN');
  
  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Format phone number to WhatsApp format
 * Removes spaces, dashes, and ensures it starts with country code
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If doesn't start with country code, assume Mexico (52)
  if (!cleaned.startsWith('52') && cleaned.length === 10) {
    cleaned = '52' + cleaned;
  }
  
  return cleaned;
};

/**
 * Send WhatsApp Text Message
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<Object>} API response
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      throw new Error(`WhatsApp no configurado. Variables faltantes: ${validation.missing.join(', ')}`);
    }

    const formattedPhone = formatPhoneNumber(to);
    
    const response = await axios.post(
      `${WhatsAppConfig.apiBaseUrl}/${WhatsAppConfig.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${WhatsAppConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ WhatsApp message sent successfully:', {
      to: formattedPhone,
      messageId: response.data.messages[0].id,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: response.data.messages[0].id,
      to: formattedPhone,
      data: response.data,
    };
  } catch (error) {
    console.error('❌ WhatsApp send error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code,
      details: error.response?.data,
    };
  }
};

/**
 * Send Cutting Order Notification via WhatsApp
 * @param {Object} order - Cutting order object
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendCuttingOrderNotification = async (order, recipientPhone) => {
  try {
    const message = `
🔪 *NUEVA ORDEN DE CORTE*
━━━━━━━━━━━━━━━━━━
📋 *Folio:* ${order.folio || 'N/A'}
📅 *Fecha:* ${order.cutting_date ? new Date(order.cutting_date).toLocaleDateString('es-MX') : 'N/A'}

👨‍🌾 *Productor:* ${order.producer_name || 'N/A'}
🏞️ *Huerto:* ${order.orchard_name || 'N/A'}
📍 *Ubicación:* ${order.location || 'N/A'}

🚛 *Transporte:*
• Tipo: ${order.truck_type || 'N/A'}
• Placas: ${order.truck_plates || 'N/A'}
• Chofer: ${order.driver_name || 'N/A'}
• Tel: ${order.driver_phone || 'N/A'}

👷 *Cuadrilla:*
• Jefe: ${order.crew_chief_name || 'N/A'}
• Tel: ${order.crew_chief_phone || 'N/A'}
• Trabajadores: ${order.crew_workers_count || 'N/A'}
• Método de pago: ${order.crew_payment_method === 'kilos' ? 'Por kilos' : order.crew_payment_method === 'dia' ? 'Por día' : 'N/A'}

📦 *Cajas solicitadas:* ${order.boxes_count || 'N/A'}

⏰ *Punto de reunión:*
• Lugar: ${order.meeting_point || 'N/A'}
• Hora: ${order.meeting_time || 'N/A'}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
Sistema de Gestión de Fruta
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending cutting order notification:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Order Completion Notification via WhatsApp
 * @param {Object} order - Completed order with completion data
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendOrderCompletionNotification = async (order, recipientPhone) => {
  try {
    const message = `
✅ *ORDEN COMPLETADA*
━━━━━━━━━━━━━━━━━━
📋 *Folio:* ${order.folio || 'N/A'}
👨‍🌾 *Productor:* ${order.producer_name || 'N/A'}

📊 *Resultados:*
• Peso neto: ${order.net_weight ? order.net_weight + ' kg' : 'N/A'}
• Cajas devueltas: ${order.returned_boxes || '0'}
• Cajas faltantes: ${order.missing_boxes || '0'}

⏰ *Completado:* ${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending completion notification:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Order Status Update via WhatsApp
 * @param {Object} order - Order object
 * @param {string} status - New status
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendOrderStatusUpdate = async (order, status, recipientPhone) => {
  try {
    const statusText = {
      pending: '⏳ Pendiente',
      in_progress: '🚀 En Proceso',
      completed: '✅ Completada',
      cancelled: '❌ Cancelada',
    }[status] || status;

    const message = `
📢 *ACTUALIZACIÓN DE ORDEN*
━━━━━━━━━━━━━━━━━━
📋 *Folio:* ${order.folio || 'N/A'}
👨‍🌾 *Productor:* ${order.producer_name || 'N/A'}

🔄 *Nuevo Estado:* ${statusText}

⏰ ${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending status update:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Test WhatsApp Connection
 * Sends a test message to verify configuration
 * @param {string} testPhone - Phone number to send test message
 * @returns {Promise<Object>} Test result
 */
export const testWhatsAppConnection = async (testPhone) => {
  try {
    const validation = validateWhatsAppConfig();
    if (!validation.valid) {
      return {
        success: false,
        error: 'WhatsApp no configurado',
        missing: validation.missing,
      };
    }

    const message = `
🧪 *MENSAJE DE PRUEBA*
━━━━━━━━━━━━━━━━━━
✅ WhatsApp API configurado correctamente

📱 ID de Teléfono: ${WhatsAppConfig.phoneNumberId}
🏢 Cuenta de Negocio: ${WhatsAppConfig.businessAccountId}
⏰ ${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(testPhone, message);
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  sendWhatsAppMessage,
  sendCuttingOrderNotification,
  sendOrderCompletionNotification,
  sendOrderStatusUpdate,
  testWhatsAppConnection,
  validateWhatsAppConfig,
};
