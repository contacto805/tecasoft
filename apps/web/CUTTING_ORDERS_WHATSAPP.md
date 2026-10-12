# WhatsApp Business API Integration for Cutting Orders

## Overview
The Cutting Orders module now includes one-click WhatsApp PDF sending functionality matching the box-control implementation.

## Features Added
- **PDF Download** - Generate and download cutting order as PDF
- **JPG Download** - Generate and download cutting order as JPG  
- **WhatsApp Sending** - Send order directly to customer via WhatsApp Business API
- **Phone Number Field** - Temporary input for WhatsApp recipient during order generation

## Usage

### Sending via WhatsApp
1. After generating a cutting order, the confirmation modal appears
2. Enter customer phone number in the WhatsApp field (formats accepted):
   - +52 1234567890
   - 521234567890
   - 1234567890
3. Click **📤 WhatsApp** button
4. Order PDF sends automatically via WhatsApp Business API

### Download Options
- **Descargar PDF** - Saves high-quality PDF for printing or archiving
- **Descargar JPG** - Saves as image for email/messaging

## Configuration

### Required Environment Variables
Add these to your `.env` file to enable WhatsApp sending:

```
WHATSAPP_BUSINESS_TOKEN=your_business_account_token
WHATSAPP_PHONE_ID=your_phone_number_id
```

### Setup Instructions

#### 1. Get WhatsApp Business Token
- Go to https://business.facebook.com
- Navigate to Settings → Business Apps
- Create/select a Business App
- Add WhatsApp product
- Go to WhatsApp API Configuration
- Generate System User Access Token with `whatsapp_business_messaging` scope

#### 2. Get Phone Number ID
- In WhatsApp API Configuration
- Find "Phone Number ID" for your test/production number

#### 3. Create Message Template
- In WhatsApp Manager
- Create new template named: `cutting_order_notification`
- Language: Spanish (es)
- Category: TRANSACTIONAL
- Template text:
```
Estimado cliente,

Adjunto encontrará la orden de corte {{1}}.

Detalles:
- Productor: {{2}}
- Fecha: {{3}}
- Cajas: {{4}}
- Peso Neto: {{5}} kg

Saludos,
Tecavo Fruits
```

#### 4. Add Credentials to .env
```bash
WHATSAPP_BUSINESS_TOKEN=EAAxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_ID=1234567890
```

#### 5. Restart Server
```bash
npm run dev
```

## API Endpoint
- **Route**: `/api/whatsapp/send-ticket`
- **Method**: POST
- **Payload**:
```json
{
  "phone": "+52 1234567890",
  "folio": "CORTE-2024-12345678",
  "type": "cutting_order"
}
```

## Error Handling
- **Missing phone number** - Shows validation message
- **API not configured** - Displays setup instructions in error
- **Invalid phone format** - WhatsApp API validates and returns format error
- **Rate limits** - Respects WhatsApp Business API rate limits

## Test Without API
If `WHATSAPP_BUSINESS_TOKEN` is not set:
- Download/Print functions work normally
- WhatsApp button shows helpful setup message
- No errors are thrown

## Support
For WhatsApp Business API documentation:
https://developers.facebook.com/docs/whatsapp/cloud-api
