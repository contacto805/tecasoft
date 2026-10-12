import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phone, message, template, templateParams } = await request.json();

    // Validate required fields
    if (!phone) {
      return NextResponse.json(
        { error: 'El número de teléfono es requerido' },
        { status: 400 }
      );
    }

    if (!message && !template) {
      return NextResponse.json(
        { error: 'Debe proporcionar un mensaje o un template' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Número de teléfono inválido. Use solo dígitos (10-15 caracteres).' },
        { status: 400 }
      );
    }

    const whatsappToken = process.env.WHATSAPP_BUSINESS_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

    if (!whatsappToken || !whatsappPhoneId) {
      console.error('WhatsApp API not configured - missing credentials');
      return NextResponse.json(
        { 
          error: 'WhatsApp Business API no está configurado',
          info: 'Configura WHATSAPP_BUSINESS_TOKEN y WHATSAPP_PHONE_ID en las variables de entorno'
        },
        { status: 503 }
      );
    }

    // Format phone number to international format
    let formattedPhone = phone.replace(/\D/g, '');
    
    // Add Mexico country code (52) if no country code present
    if (!formattedPhone.startsWith('1') && !formattedPhone.startsWith('52')) {
      formattedPhone = '52' + formattedPhone;
    }

    console.log('Sending WhatsApp message:', {
      to: formattedPhone,
      hasMessage: !!message,
      hasTemplate: !!template,
      timestamp: new Date().toISOString()
    });

    let messageBody;

    // Send with template (structured message)
    if (template) {
      messageBody = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: template,
          language: {
            code: 'es_MX',
          },
          components: templateParams ? [
            {
              type: 'body',
              parameters: templateParams.map(param => ({
                type: 'text',
                text: param,
              })),
            },
          ] : undefined,
        },
      };
    } else {
      // Send plain text message
      messageBody = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      };
    }

    // Call WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', {
        status: response.status,
        error: result.error,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json(
        { 
          error: 'Error al enviar mensaje por WhatsApp',
          details: result.error?.message || 'Error desconocido',
          errorCode: result.error?.code,
          errorType: result.error?.type
        },
        { status: response.status }
      );
    }

    console.log('WhatsApp message sent successfully:', {
      messageId: result.messages?.[0]?.id,
      to: formattedPhone,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Mensaje enviado exitosamente a ${formattedPhone}`,
      messageId: result.messages?.[0]?.id,
      whatsappStatus: result.messages?.[0]?.message_status,
    });

  } catch (error) {
    console.error('WhatsApp send error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor al enviar por WhatsApp',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check WhatsApp API status
export async function GET() {
  const whatsappToken = process.env.WHATSAPP_BUSINESS_TOKEN;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

  const isConfigured = !!(whatsappToken && whatsappPhoneId);

  return NextResponse.json({
    configured: isConfigured,
    phoneId: isConfigured ? whatsappPhoneId : null,
    message: isConfigured 
      ? 'WhatsApp API está configurado correctamente' 
      : 'WhatsApp API no está configurado. Agrega WHATSAPP_BUSINESS_TOKEN y WHATSAPP_PHONE_ID',
  });
}
