# WhatsApp Business API Integration Setup

## Overview
The Box Control module now supports one-click sending of PDF tickets directly to customer phone numbers via WhatsApp Business API.

## Features
- ✅ Printer detection and selection (plug-and-play)
- ✅ One-click WhatsApp sending from box-control module
- ✅ Automatic phone number formatting
- ✅ Error handling and user feedback

## Setup Instructions

### Step 1: Create WhatsApp Business Account
1. Go to [business.facebook.com](https://business.facebook.com)
2. Create a new Business Account or use existing one
3. Verify your business information

### Step 2: Create Meta App for WhatsApp API
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **Create App** → Select **Business**
3. Choose app name and purpose
4. Add **WhatsApp** product to your app

### Step 3: Get WhatsApp Phone Number
1. In your app dashboard, go to **WhatsApp** → **Getting Started**
2. Choose or register a phone number
3. Copy your **Phone Number ID** (you'll need this)

### Step 4: Generate Access Token
1. Go to **Settings** → **Basic**
2. Copy your **App ID** and **App Secret**
3. Go to **Accounts** → **System Users**
4. Create a new System User or use existing
5. Add **Admin** role
6. Generate a new **Access Token** (valid for 60 days or permanent)
7. Copy the **Access Token** (you'll need this)

### Step 5: Create WhatsApp Message Template
Templates are required for WhatsApp Business API (free tier).

1. In **WhatsApp** → **Message Templates**
2. Click **Create Template**
3. Use this example:
   ```
   Name: tecavo_ticket
   Language: Spanish (es_MX)
   Category: ACCOUNT_UPDATE
   
   Header: Leave blank
   
   Body:
   Folio de ticket: {{1}}
   
   Accede a tu ticket aquí: {{2}}
   
   Footer: Tecavo Fruits Soft
   ```

4. Click **Submit** and wait for approval (usually instant)

### Step 6: Add Environment Variables
Update your `.env` file:

```bash
WHATSAPP_BUSINESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_ID=your_phone_number_id_here
```

Replace:
- `your_access_token_here` → Your permanent access token from Step 4
- `your_phone_number_id_here` → Your phone number ID from Step 3

### Step 7: Verify Setup
1. Go to box-control module
2. Enter a phone number when creating a new movement
3. After creating, click the **📤 WhatsApp** button
4. If setup is correct, you'll see success confirmation
5. Check the recipient's WhatsApp for the ticket

## How It Works

### Printer Detection
- Automatically detects available printers on system startup
- Shows dropdown selector to choose preferred printer
- Remembers selection during session

### WhatsApp Integration
1. Enter customer phone number in the form or use inline input
2. Click **📤 WhatsApp** button next to any ticket
3. System generates PDF ticket
4. Sends via WhatsApp Business API template
5. Shows confirmation with message ID

### Phone Number Format
- Accepts: `+52 1234567890`, `521234567890`, `1234567890`
- Defaults to Mexico country code (52) if not specified
- Automatically formatted for API

## Troubleshooting

### "WhatsApp Business API not configured"
**Solution:** Add `WHATSAPP_BUSINESS_TOKEN` and `WHATSAPP_PHONE_ID` to `.env`

### "Invalid phone number"
**Solution:** Use 10-15 digit format. Examples:
- ✅ `+52 5551234567`
- ✅ `521234567890`
- ❌ `(555) 123-4567` (invalid format)

### "Message not received"
**Possible causes:**
- Phone number doesn't exist or is incorrect
- Message template not approved yet
- Recipient hasn't messaged you first (some phone numbers need opt-in)
- API token expired (regenerate if older than 60 days)

### "Template not approved"
**Solution:** 
- Check WhatsApp Message Templates section
- Template name must exactly match: `tecavo_ticket`
- Parameters must match: {{1}} = folio, {{2}} = ticket URL
- Wait for Meta's automatic approval (usually instant)

## API Details

### WhatsApp Send Endpoint
**POST** `/api/whatsapp/send-ticket`

**Request:**
```json
{
  "phone": "+52 5551234567",
  "ticketUrl": "blob:http://...",
  "folio": "BOX-001"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Ticket enviado a +52 5551234567 por WhatsApp",
  "messageId": "wamid.HBEUFgIBAgkQAQg..."
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "details": "Additional error info"
}
```

## Security Notes
- ✅ Never commit `.env` file with real tokens
- ✅ Use environment variables for sensitive data
- ✅ Tokens should be regenerated periodically
- ✅ Phone numbers are validated before sending
- ✅ API calls use HTTPS only

## Support
For issues with WhatsApp Business API:
- [Meta Business Help](https://www.facebook.com/help/contact/contact-form)
- [WhatsApp Business Documentation](https://www.whatsapp.com/business/api/)
