import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phone, ticketUrl, folio } = await request.json();

    // Validate phone number format
    if (!phone || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Número de teléfono inválido. Use solo dígitos (10-15 caracteres).' },
        { status: 400 }
      );
    }

    const whatsappToken = process.env.WHATSAPP_BUSINESS_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

    if (!whatsappToken || !whatsappPhoneId) {
      return NextResponse.json(
        { 
          error: 'WhatsApp Business API no está configurado. Configura WHATSAPP_BUSINESS_TOKEN y WHATSAPP_PHONE_ID en las variables de entorno.',
          info: 'Para configurar: 1) Obtén una cuenta WhatsApp Business. 2) Crea una app en Facebook/Meta Developer. 3) Obtén el token de acceso y el ID del teléfono. 4) Añade las variables de entorno.'
        },
        { status: 503 }
      );
    }

    // Format phone number to international format (add country code if needed)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && !formattedPhone.startsWith('52')) {
      // Default to Mexico country code (52) if not specified
      formattedPhone = '52' + formattedPhone;
    }

    // Send message via WhatsApp Business API
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: 'tecavo_ticket',
            language: {
              code: 'es_MX',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: folio,
                  },
                  {
                    type: 'text',
                    text: ticketUrl,
                  },
                ],
              },
            ],
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return NextResponse.json(
        { 
          error: 'Error al enviar mensaje por WhatsApp',
          details: result.error?.message || 'Error desconocido'
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Ticket enviado a ${formattedPhone} por WhatsApp`,
      messageId: result.messages[0].id,
    });

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al enviar por WhatsApp' },
      { status: 500 }
    );
  }
}
