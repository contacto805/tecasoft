# 📱 WhatsApp Business API Integration Guide
## Tecavo Soft Mobile Applications

---

## 🎯 Overview

Both mobile applications (`cutting-orders-mobile` and `fruit-intake-mobile`) now include complete WhatsApp Business API integration for sending real-time notifications to users.

---

## 📋 Features Implemented

### **Cutting Orders Mobile App**
- ✅ Send cutting order details via WhatsApp
- ✅ Send order status updates
- ✅ Send order completion notifications
- ✅ Full error handling and response logging
- ✅ Phone number formatting (Mexico country code support)
- ✅ Configuration validation

### **Fruit Intake Mobile App**
- ✅ Send individual fruit intake notifications
- ✅ Send daily intake summaries
- ✅ Send weight threshold alerts
- ✅ Send batch completion notifications
- ✅ Full error handling and response logging
- ✅ Phone number formatting (Mexico country code support)
- ✅ Configuration validation

---

## 🔧 Setup Instructions

### **Step 1: Get WhatsApp Business API Credentials**

1. **Go to Meta Business Suite**
   - Visit: https://business.facebook.com/
   - Log in with your Facebook account

2. **Create a WhatsApp Business Account** (if you don't have one)
   - Click on "Settings" → "Business Settings"
   - Navigate to "Accounts" → "WhatsApp Accounts"
   - Click "Add" and follow the setup wizard

3. **Get Your API Credentials**
   
   Navigate to: **WhatsApp → API Setup**
   
   You'll need three values:
   
   - **Phone Number ID**: Found in "Phone numbers" section
     - Example: `123456789012345`
   
   - **Business Account ID**: Found in "WhatsApp Business Account" section
     - Example: `987654321098765`
   
   - **Access Token**: Click "Generate Token" or use existing one
     - Example: `EAABsbCS1iHgBO7ZC8wZBmPJofqwer...` (very long string)

### **Step 2: Configure Environment Variables**

#### **For Cutting Orders Mobile:**

Edit `/home/user/apps/cutting-orders-mobile/.env`:

```bash
# Existing configuration (don't change these)
EXPO_PUBLIC_API_URL=https://iai185uz7sad1pes63f15.web-preview.appgen.com
EXPO_NO_CORS=true
EXPO_PACKAGER_PROXY_URL=https://8081-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_PROXY_BASE_URL=https://8081-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_APP_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_BACKEND_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_BASE_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com

# WhatsApp Business API Configuration (ADD YOUR VALUES HERE)
EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID_HERE
EXPO_PUBLIC_WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_BUSINESS_ACCOUNT_ID_HERE
EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
```

#### **For Fruit Intake Mobile:**

Edit `/home/user/apps/fruit-intake-mobile/.env`:

```bash
# Existing configuration (don't change these)
EXPO_PUBLIC_API_URL=https://iai185uz7sad1pes63f15.web-preview.appgen.com
EXPO_NO_CORS=true
EXPO_PACKAGER_PROXY_URL=https://8081-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_PROXY_BASE_URL=https://8081-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_APP_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_BACKEND_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com
EXPO_PUBLIC_BASE_URL=https://3000-i8jlridhqdgtk8kkjv5qo.prev.appgen.com

# WhatsApp Business API Configuration (ADD YOUR VALUES HERE)
EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID_HERE
EXPO_PUBLIC_WHATSAPP_BUSINESS_ACCOUNT_ID=YOUR_BUSINESS_ACCOUNT_ID_HERE
EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN=YOUR_ACCESS_TOKEN_HERE
```

### **Step 3: Restart the Apps**

After updating the `.env` files, restart both mobile apps for the changes to take effect.

---

## 📱 Usage

### **Cutting Orders Mobile App**

1. **Send Order Notification:**
   - View any cutting order in the app
   - Tap the "📱 WhatsApp" button next to the order
   - Enter the recipient's phone number
   - Tap "Enviar" to send

2. **Message Format:**
   ```
   🔪 NUEVA ORDEN DE CORTE
   ━━━━━━━━━━━━━━━━━━
   📋 Folio: CORTE-2024-12345678
   📅 Fecha: 15/01/2024
   
   👨‍🌾 Productor: Juan Pérez
   🏞️ Huerto: Los Pinos
   📍 Ubicación: Hermosillo, Sonora
   
   🚛 Transporte:
   • Tipo: Doble
   • Placas: ABC-123-XYZ
   • Chofer: Pedro García
   • Tel: 6441234567
   
   👷 Cuadrilla:
   • Jefe: Luis Martínez
   • Tel: 6449876543
   • Trabajadores: 15
   • Método de pago: Por kilos
   
   📦 Cajas solicitadas: 500
   
   ⏰ Punto de reunión:
   • Lugar: Entrada principal
   • Hora: 06:00 AM
   ```

### **Fruit Intake Mobile App**

1. **Send Individual Intake:**
   - View any fruit intake record
   - Tap the "📱 Enviar por WhatsApp" button
   - Enter the recipient's phone number
   - Tap "Enviar" to send

2. **Send Daily Summary:**
   - Tap the "📊 Resumen WhatsApp" card at the top
   - Enter the recipient's phone number
   - Tap "Enviar Resumen" to send

3. **Message Formats:**

   **Individual Intake:**
   ```
   📦 NUEVO INGRESO DE FRUTA
   ━━━━━━━━━━━━━━━━━━
   📋 ID: 123
   📅 Fecha: 15/01/2024 10:30 AM
   
   🏷️ Lote: LOT-2024-001
   👨‍🌾 Productor: Juan Pérez
   
   ⚖️ Peso: 1500.50 kg
   
   📍 Origen: Hermosillo
   ```

   **Daily Summary:**
   ```
   📊 RESUMEN DIARIO DE INGRESOS
   ━━━━━━━━━━━━━━━━━━
   📅 Fecha: 15/01/2024
   
   📈 Totales:
   • Ingresos: 25
   • Peso total: 37500.75 kg
   • Promedio: 1500.03 kg/ingreso
   
   📦 Por Lote:
   • LOT-2024-001: 10 ingresos, 15000.00 kg
   • LOT-2024-002: 15 ingresos, 22500.75 kg
   ```

---

## 🔍 Phone Number Formatting

The WhatsApp service automatically formats phone numbers:

- **10 digits** (e.g., `6441234567`) → Adds Mexico country code: `526441234567`
- **12 digits with country code** (e.g., `526441234567`) → Uses as-is
- **Removes all non-numeric characters** (spaces, dashes, parentheses)

**Examples:**
- Input: `644-123-4567` → Formatted: `526441234567`
- Input: `(644) 123 4567` → Formatted: `526441234567`
- Input: `52 644 123 4567` → Formatted: `526441234567`

---

## 🛠️ API Functions Reference

### **Cutting Orders Mobile (`services/whatsapp.js`)**

```javascript
import WhatsAppService from '../services/whatsapp';

// Send cutting order notification
const result = await WhatsAppService.sendCuttingOrderNotification(order, phoneNumber);

// Send order status update
const result = await WhatsAppService.sendOrderStatusUpdate(order, 'completed', phoneNumber);

// Send order completion notification
const result = await WhatsAppService.sendOrderCompletionNotification(order, phoneNumber);

// Test connection
const result = await WhatsAppService.testWhatsAppConnection(phoneNumber);

// Validate configuration
const validation = WhatsAppService.validateWhatsAppConfig();
```

### **Fruit Intake Mobile (`services/whatsapp.js`)**

```javascript
import WhatsAppService from '../services/whatsapp';

// Send fruit intake notification
const result = await WhatsAppService.sendFruitIntakeNotification(intake, phoneNumber);

// Send daily summary
const result = await WhatsAppService.sendDailyIntakeSummary(intakes, phoneNumber);

// Send weight threshold alert
const result = await WhatsAppService.sendWeightThresholdAlert(lot, currentWeight, threshold, phoneNumber);

// Send batch completion notification
const result = await WhatsAppService.sendBatchCompletionNotification(batch, phoneNumber);

// Test connection
const result = await WhatsAppService.testWhatsAppConnection(phoneNumber);

// Validate configuration
const validation = WhatsAppService.validateWhatsAppConfig();
```

---

## ⚠️ Error Handling

All WhatsApp functions return a consistent response structure:

**Success Response:**
```javascript
{
  success: true,
  messageId: "wamid.HBgNNTIxNTU1NTU1NTU1NRUCABIYFj...",
  to: "526441234567",
  data: { /* Full API response */ }
}
```

**Error Response:**
```javascript
{
  success: false,
  error: "Invalid phone number",
  code: "131031",
  details: { /* Full error details */ }
}
```

**Common Errors:**
- **Missing configuration**: Check `.env` file has all three variables
- **Invalid phone number**: Ensure number is valid and registered with WhatsApp
- **Expired token**: Regenerate access token in Meta Business Suite
- **Rate limits**: WhatsApp has message rate limits (check Meta Business Suite)

---

## 📊 Response Logging

All WhatsApp API calls are logged to the console:

**Success Log:**
```
✅ WhatsApp message sent successfully: {
  to: "526441234567",
  messageId: "wamid.HBgNNTU...",
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

**Error Log:**
```
❌ WhatsApp send error: {
  message: "Invalid phone number",
  response: { error: {...} },
  status: 400
}
```

---

## 🔒 Security Notes

1. **Never commit `.env` files** with real credentials to version control
2. **Access tokens are sensitive** - treat them like passwords
3. **Rotate tokens periodically** for security
4. **Use test phone numbers** during development
5. **Monitor usage** in Meta Business Suite to detect abuse

---

## 📚 Additional Resources

- **WhatsApp Business API Documentation**: https://developers.facebook.com/docs/whatsapp
- **Meta Business Suite**: https://business.facebook.com/
- **WhatsApp Business API Setup Guide**: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

---

## ✅ Testing Checklist

Before deploying to production:

- [ ] WhatsApp Business Account created
- [ ] All three environment variables configured in both `.env` files
- [ ] Test message sent successfully from Cutting Orders app
- [ ] Test message sent successfully from Fruit Intake app
- [ ] Phone number formatting works correctly
- [ ] Error handling displays user-friendly messages
- [ ] Daily summary generates correct totals
- [ ] All notification types tested

---

## 🎉 Integration Complete!

Your Tecavo Soft mobile applications now have full WhatsApp Business API integration with:

✅ Real-time notifications  
✅ Formatted business messages  
✅ Daily summaries and reports  
✅ Comprehensive error handling  
✅ Phone number auto-formatting  
✅ Configuration validation  

**Ready for production use!**

---

**Questions or Issues?**

Contact your development team or refer to the Meta WhatsApp Business API documentation.
