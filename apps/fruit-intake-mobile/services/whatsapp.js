/**
 * WhatsApp Business API Integration Module
 * Tecavo Soft - Fruit Intake Mobile App
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
 * Send Fruit Intake Notification via WhatsApp
 * @param {Object} intake - Fruit intake object
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendFruitIntakeNotification = async (intake, recipientPhone) => {
  try {
    const message = `
📦 *NUEVO INGRESO DE FRUTA*
━━━━━━━━━━━━━━━━━━
📋 *ID:* ${intake.id || 'N/A'}
📅 *Fecha:* ${intake.timestamp ? new Date(intake.timestamp).toLocaleString('es-MX') : 'N/A'}

🏷️ *Lote:* ${intake.lot_number || `#${intake.lot_id}` || 'N/A'}
👨‍🌾 *Productor:* ${intake.producer || 'N/A'}

⚖️ *Peso:* ${intake.weight_kg ? intake.weight_kg + ' kg' : 'N/A'}

📍 *Origen:* ${intake.origin || 'N/A'}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
Sistema de Gestión de Fruta
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending fruit intake notification:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Daily Intake Summary via WhatsApp
 * @param {Array} intakes - Array of intake records for the day
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendDailyIntakeSummary = async (intakes, recipientPhone) => {
  try {
    const totalWeight = intakes.reduce((sum, intake) => sum + (intake.weight_kg || 0), 0);
    const totalCount = intakes.length;
    
    const lotsSummary = {};
    intakes.forEach(intake => {
      const lotKey = intake.lot_number || `Lote ${intake.lot_id}`;
      if (!lotsSummary[lotKey]) {
        lotsSummary[lotKey] = { count: 0, weight: 0 };
      }
      lotsSummary[lotKey].count += 1;
      lotsSummary[lotKey].weight += intake.weight_kg || 0;
    });

    let lotsText = '';
    Object.keys(lotsSummary).forEach(lot => {
      lotsText += `\n• ${lot}: ${lotsSummary[lot].count} ingresos, ${lotsSummary[lot].weight.toFixed(2)} kg`;
    });

    const message = `
📊 *RESUMEN DIARIO DE INGRESOS*
━━━━━━━━━━━━━━━━━━
📅 *Fecha:* ${new Date().toLocaleDateString('es-MX')}

📈 *Totales:*
• Ingresos: ${totalCount}
• Peso total: ${totalWeight.toFixed(2)} kg
• Promedio: ${totalCount > 0 ? (totalWeight / totalCount).toFixed(2) : 0} kg/ingreso

📦 *Por Lote:*${lotsText}

⏰ Generado: ${new Date().toLocaleTimeString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending daily summary:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Lot Weight Threshold Alert via WhatsApp
 * @param {Object} lot - Lot object
 * @param {number} currentWeight - Current total weight
 * @param {number} threshold - Weight threshold
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendWeightThresholdAlert = async (lot, currentWeight, threshold, recipientPhone) => {
  try {
    const message = `
⚠️ *ALERTA DE PESO*
━━━━━━━━━━━━━━━━━━
🏷️ *Lote:* ${lot.lot_number || `#${lot.id}` || 'N/A'}

⚖️ *Peso actual:* ${currentWeight.toFixed(2)} kg
📊 *Límite configurado:* ${threshold.toFixed(2)} kg
📈 *Porcentaje:* ${((currentWeight / threshold) * 100).toFixed(1)}%

${currentWeight >= threshold ? '🔴 Límite alcanzado o superado' : '🟡 Aproximándose al límite'}

⏰ ${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending weight alert:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send Batch Completion Notification via WhatsApp
 * @param {Object} batch - Batch object with summary data
 * @param {string} recipientPhone - Recipient phone number
 * @returns {Promise<Object>} Send result
 */
export const sendBatchCompletionNotification = async (batch, recipientPhone) => {
  try {
    const message = `
✅ *LOTE COMPLETADO*
━━━━━━━━━━━━━━━━━━
🏷️ *Lote:* ${batch.lot_number || `#${batch.id}` || 'N/A'}
👨‍🌾 *Productor:* ${batch.producer || 'N/A'}

📊 *Totales:*
• Ingresos: ${batch.total_intakes || 0}
• Peso total: ${batch.total_weight ? batch.total_weight.toFixed(2) + ' kg' : 'N/A'}
• Duración: ${batch.duration || 'N/A'}

✅ *Cerrado:* ${new Date().toLocaleString('es-MX')}

━━━━━━━━━━━━━━━━━━
🏭 *Tecavo Fruits Soft*
`.trim();

    return await sendWhatsAppMessage(recipientPhone, message);
  } catch (error) {
    console.error('Error sending batch completion:', error);
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
  sendFruitIntakeNotification,
  sendDailyIntakeSummary,
  sendWeightThresholdAlert,
  sendBatchCompletionNotification,
  testWhatsAppConnection,
  validateWhatsAppConfig,
};
