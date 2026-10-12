# Tecavo Fruits Soft - Mobile Sync API Summary

## 📋 Quick Reference

### Endpoint
```
POST https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync
```

### Request Format
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+51987654321"
}
```

### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "User registered successfully",
  "userId": "user-1704067200123abc",
  "email": "user@example.com",
  "name": "John Doe",
  "registeredAt": "2024-01-01T12:00:00.000Z"
}
```

### Error Response Examples

**Missing Fields (400)**
```json
{
  "status": "error",
  "message": "Missing required fields: email, password, name, phone"
}
```

**Weak Password (400)**
```json
{
  "status": "error",
  "message": "Password must contain at least one uppercase letter"
}
```

**Email Already Exists (409)**
```json
{
  "status": "error",
  "message": "User with this email already exists"
}
```

---

## 🔐 Requirements

### Password
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one lowercase letter
- ✅ At least one number

### Email
- ✅ Valid email format
- ✅ Must be unique in the system

### Phone
- ✅ Minimum 10 digits
- ✅ Supports international formats

---

## 🧪 Testing

### Quick Test Page
Visit: `https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/test-mobile-sync`

Features:
- Manual form for custom testing
- Pre-configured test cases
- Real-time response viewer
- Password validation examples

### Test Cases Available
1. ✅ Valid Registration
2. ⚠️ Weak Password
3. ⚠️ Invalid Email
4. ⚠️ Invalid Phone
5. ⚠️ Missing Fields

---

## 📱 Integration Example (JavaScript/React Native)

```javascript
const registerUser = async (userData) => {
  const response = await fetch('/api/mobile-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  return response.json();
};

// Usage
const result = await registerUser({
  email: 'user@example.com',
  password: 'MyPass2025',
  name: 'Juan Pérez',
  phone: '+51987654321',
});

if (result.status === 'success') {
  console.log('User registered:', result.userId);
} else {
  console.error('Error:', result.message);
}
```

---

## 🗂️ Project Files

### Backend
- `/app/api/mobile-sync/route.js` - API endpoint handler

### Frontend
- `/app/test-mobile-sync/page.jsx` - Testing interface

### Documentation
- `MOBILE_SYNC_API.md` - Complete API reference (45+ examples)
- `MOBILE_SYNC_SETUP.md` - Integration guide (code samples in React Native, Flutter, etc.)
- `API_SUMMARY.md` - This file

---

## 🔗 Integration Flow

```
Mobile App Registration Form
  ↓
POST /api/mobile-sync
  ↓
Validate Input (email, password, phone)
  ↓
Hash Password (bcryptjs, 12 rounds)
  ↓
Store in PostgreSQL Database
  ↓
Return User ID (201 Created)
  ↓
Mobile App → Login Screen
  ↓
Same Credentials Work on Web App & Mobile App
```

---

## ✨ Key Features

✅ **Input Validation**
- Email format validation
- Strong password enforcement
- Phone number format checking
- Required field verification

✅ **Security**
- bcryptjs password hashing (12 rounds)
- Unique email constraint
- Case-insensitive duplicate checking
- SQL injection prevention

✅ **Database Integration**
- Shares schema with web app
- Same user ID across platforms
- Audit timestamps (createdAt, updatedAt)
- Transaction support

✅ **Error Handling**
- Descriptive error messages
- Appropriate HTTP status codes
- Field-level validation feedback

✅ **Testing**
- Interactive test interface
- Pre-built test cases
- Real-time response viewing
- No external dependencies

---

## 📊 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Health check success |
| 201 | User registered successfully |
| 400 | Bad request / Validation error |
| 409 | Conflict (email already exists) |
| 500 | Server error |

---

## 🔄 After Registration

### User Can
- ✅ Log in on web app at `/login`
- ✅ Log in on mobile app
- ✅ Access all modules
- ✅ Use same password on both platforms
- ✅ Access shared data (lots, orders, inventory)

### User Cannot
- ❌ Register same email twice
- ❌ Use weak passwords
- ❌ Use invalid phone numbers

---

## 🎯 Use Cases

### 1. Grower Registration
```json
{
  "email": "grower@farm.com",
  "password": "GrowersPass2025",
  "name": "Carlos García",
  "phone": "+51987654321"
}
```

### 2. Truck Driver Mobile Registration
```json
{
  "email": "driver@company.com",
  "password": "DriverPass2025",
  "name": "Juan López",
  "phone": "+51999888777"
}
```

### 3. Quality Inspector
```json
{
  "email": "inspector@tecavo.com",
  "password": "InspectorPass2025",
  "name": "María Rodríguez",
  "phone": "+51975432198"
}
```

---

## 📖 Documentation Files

1. **API_SUMMARY.md** (this file)
   - Quick reference guide
   - Essential information
   - Use cases and examples

2. **MOBILE_SYNC_API.md**
   - Complete endpoint specification
   - 10+ cURL examples
   - JavaScript/TypeScript examples
   - React Native examples
   - Error handling patterns

3. **MOBILE_SYNC_SETUP.md**
   - Setup and configuration
   - React Native integration
   - Flutter integration
   - Security best practices
   - Troubleshooting guide

---

## 🚀 Getting Started

### Step 1: Test the API
Visit: `https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/test-mobile-sync`

### Step 2: Run a Test Case
Click "Test: Valid Registration" button

### Step 3: Review the Response
See success response with userId

### Step 4: Integrate into Your App
Use code examples from `MOBILE_SYNC_SETUP.md`

### Step 5: Deploy
Copy integration code to your mobile app

---

## 💡 Tips

- Always validate input on mobile app before sending
- Implement retry logic for network errors
- Show user-friendly error messages
- Store registered userId for future API calls
- Use same credentials for web and mobile login

---

## 🤝 Support

For issues or questions:
1. Check `MOBILE_SYNC_API.md` for API details
2. Review `MOBILE_SYNC_SETUP.md` for integration help
3. Test on the `/test-mobile-sync` page
4. Check error message in response for details
5. Review code in `/app/api/mobile-sync/route.js`

---

**Status**: ✅ Production Ready
**Version**: 1.0
**Last Updated**: 2024
