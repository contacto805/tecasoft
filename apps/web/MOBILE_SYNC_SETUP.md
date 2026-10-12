# Mobile Sync API - Setup & Integration Guide

## 🎯 Overview

The Mobile Sync API provides a RESTful endpoint for mobile applications to register users with the Tecavo Fruits Soft system. The API uses the same authentication and database infrastructure as the web application, ensuring seamless integration and data consistency.

## ✅ What's Included

### API Endpoint
- **Route**: `POST /api/mobile-sync`
- **Method**: POST
- **Content-Type**: application/json
- **Response**: JSON

### Backend Components
1. **API Handler** (`/app/api/mobile-sync/route.js`)
   - Input validation
   - Password hashing (bcryptjs with 12 rounds)
   - Database operations
   - Error handling with detailed messages

2. **Database Integration**
   - Stores users in the `user` table
   - Stores passwords in the `account` table
   - Same schema as web authentication
   - Full audit trail with timestamps

3. **Test Interface** (`/app/test-mobile-sync/page.jsx`)
   - Interactive test page for the API
   - Pre-configured test cases
   - Real-time response visualization

### Documentation
- **MOBILE_SYNC_API.md** - Complete API reference with cURL examples
- **MOBILE_SYNC_SETUP.md** - This file (integration guide)

## 🚀 Quick Start

### 1. Access the Test Page
Visit: `https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/test-mobile-sync`

### 2. Test Registration
Click any of the "Quick Tests" buttons:
- ✅ **Valid Registration** - Tests successful user creation
- ⚠️ **Weak Password** - Validates password strength
- ⚠️ **Invalid Email** - Tests email format validation
- ⚠️ **Invalid Phone** - Tests phone number validation
- ⚠️ **Missing Fields** - Tests required field validation

### 3. View API Responses
Each test shows:
- HTTP status code
- JSON response with status and message
- User ID (on success)
- Error details (on failure)

## 📱 Integration with Mobile Apps

### React Native Example

```javascript
// utils/auth.js
export const registerMobileUser = async (email, password, name, phone) => {
  try {
    const response = await fetch(
      'https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    return {
      success: true,
      userId: data.userId,
      email: data.email,
      name: data.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};
```

### Usage in a Component

```javascript
// screens/SignUpScreen.js
import { registerMobileUser } from '../utils/auth';

export default function SignUpScreen() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const handleSignUp = async () => {
    setLoading(true);
    const result = await registerMobileUser(
      form.email,
      form.password,
      form.name,
      form.phone
    );

    if (result.success) {
      Alert.alert('¡Bienvenido!', `Cuenta creada para ${result.name}`);
      navigation.navigate('Login');
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={form.email}
        onChangeText={(text) => setForm({ ...form, email: text })}
      />
      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        value={form.password}
        onChangeText={(text) => setForm({ ...form, password: text })}
      />
      <TextInput
        placeholder="Nombre completo"
        value={form.name}
        onChangeText={(text) => setForm({ ...form, name: text })}
      />
      <TextInput
        placeholder="Teléfono"
        value={form.phone}
        onChangeText={(text) => setForm({ ...form, phone: text })}
      />
      <Button
        title={loading ? 'Registrando...' : 'Crear Cuenta'}
        onPress={handleSignUp}
        disabled={loading}
      />
    </View>
  );
}
```

### Flutter Example

```dart
// services/auth_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class AuthService {
  static const String _baseUrl = 'https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com';

  static Future<Map<String, dynamic>> registerUser({
    required String email,
    required String password,
    required String name,
    required String phone,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/mobile-sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'name': name,
          'phone': phone,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {'success': true, 'userId': data['userId'], 'data': data};
      } else {
        return {'success': false, 'error': data['message']};
      }
    } catch (e) {
      return {'success': false, 'error': 'Network error: $e'};
    }
  }
}
```

## 🔐 Security Features

### Password Validation
The API enforces strong passwords:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)

**Valid Examples:**
- `TecavoFruits2025`
- `MyApp123Secure`
- `SecurePass456`

**Invalid Examples:**
- `password` (no uppercase, no number)
- `PASSWORD123` (no lowercase)
- `Pass123` (only 7 characters)

### Password Storage
- Passwords are hashed using **bcryptjs** with 12 salt rounds
- Same hashing algorithm as web app authentication
- Never stored in plain text
- Salts are unique per password

### Email Validation
- Valid email format required (RFC 5322 compliant)
- Unique email constraint in database
- Case-insensitive duplicate checking

### Phone Number Validation
- Minimum 10 digits required
- Supports international formats:
  - `+51987654321` (country code)
  - `(555) 123-4567` (US format with spaces)
  - `987-654-3210` (dashed format)

### Duplicate Prevention
- Email uniqueness is enforced at database level
- 409 Conflict response for duplicate emails
- User can attempt registration with different email

## 📊 API Response Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | API health check successful |
| 201 | Created | User registered successfully |
| 400 | Bad Request | Invalid input or validation failed |
| 409 | Conflict | Email already exists |
| 500 | Server Error | Internal server error |

## 🔍 API Validation Flow

```
Request JSON
    ↓
Check Required Fields → ❌ 400 Missing fields
    ↓ ✅
Validate Email Format → ❌ 400 Invalid email
    ↓ ✅
Validate Password Strength → ❌ 400 Weak password
    ↓ ✅
Validate Phone Format → ❌ 400 Invalid phone
    ↓ ✅
Check Duplicate Email → ❌ 409 Email exists
    ↓ ✅
Hash Password (bcryptjs)
    ↓
Create User Record
    ↓
Create Account Record with Hash
    ↓
Return 201 Success with User ID
```

## 🗄️ Database Schema

### user table
```sql
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  emailVerified BOOLEAN DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
```

### account table
```sql
CREATE TABLE account (
  id SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id),
  "accountId" TEXT UNIQUE NOT NULL,
  "providerId" TEXT NOT NULL,
  password TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  scope TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
```

## 🧪 Testing the API

### Using cURL
```bash
# Successful registration
curl -X POST https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123",
    "name": "John Doe",
    "phone": "+51987654321"
  }'

# Response
{
  "status": "success",
  "message": "User registered successfully",
  "userId": "user-1704067200123abc",
  "email": "newuser@example.com",
  "name": "John Doe",
  "registeredAt": "2024-01-01T12:00:00.000Z"
}
```

### Using Postman
1. Create new POST request
2. URL: `https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync`
3. Headers:
   - `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "email": "user@example.com",
  "password": "TecavoTest2025",
  "name": "Test User",
  "phone": "+51987654321"
}
```
5. Click Send

### Using the Web Interface
1. Visit `/test-mobile-sync` page
2. Fill in the manual test form
3. Click "Register User"
4. View response in the Result section

## 🔗 Integration Points

### After Mobile Registration
Once a user registers via Mobile Sync API:

1. **Login on Web App**
   - User can log in at `/login` with registered email/password
   - Session is created with HTTP-only cookies
   - Access to all web modules

2. **Login on Mobile App**
   - Use the same email/password with your mobile auth flow
   - Can access mobile-specific endpoints
   - Synchronized user data across platforms

3. **Database Consistency**
   - Same user record shared across web and mobile
   - Password hash is compatible with both platforms
   - User ID (`userId`) is the same on both systems

## ⚙️ Configuration

### Environment Variables
The API uses environment variables set automatically:
- `DATABASE_URL` - PostgreSQL connection string
- No additional configuration needed

### CORS (Cross-Origin Resource Sharing)
- API accepts requests from:
  - Same domain (web app)
  - Mobile apps (no CORS restrictions for native apps)
  - Same origin in development

## 🚨 Error Handling Best Practices

### In Mobile Apps
```javascript
try {
  const result = await registerMobileUser(email, password, name, phone);
  if (result.success) {
    // Navigate to login or dashboard
  } else {
    // Show user-friendly error message
    showError(result.error);
  }
} catch (error) {
  // Handle network errors
  showError('Network connection error. Please try again.');
}
```

### Error Messages by Type
```
Email validation: "Invalid email format"
Password strength: "Password must be at least 8 characters"
Phone validation: "Invalid phone number format (minimum 10 digits)"
Duplicate email: "User with this email already exists"
Missing fields: "Missing required fields: email, password, name, phone"
Server error: "Registration failed. Please try again later."
```

## 📈 Monitoring & Logs

### Server-Side Logs
Successful registrations are logged with:
- Timestamp
- Email address
- User ID generated
- Request origin

### Error Logging
All errors are logged with:
- Error type
- Error message
- Request data (sanitized)
- Stack trace (for debugging)

Access logs via the app's server console during development.

## 🔄 Data Sync Strategy

### User Data Flow

```
Mobile App
  ↓ (registration via /api/mobile-sync)
PostgreSQL Database
  ↓ (shared schema)
Web App ← (login, access data)
  ↓
Inventory, Fruit Input, Lots, etc.
```

### Keeping Data Synchronized
1. Use same `userId` across platforms
2. Query database via API for current data
3. Update records through both web and mobile endpoints
4. Implement conflict resolution if needed

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: "Invalid email format"
- **Cause**: Email doesn't match RFC 5322 pattern
- **Solution**: Use valid email: `user@domain.com`

**Issue**: "Password must be at least 8 characters"
- **Cause**: Password validation failed
- **Solution**: Use min 8 chars, 1 upper, 1 lower, 1 number

**Issue**: "User with this email already exists"
- **Cause**: Email already registered
- **Solution**: Use different email or implement password reset

**Issue**: "Network error"
- **Cause**: App can't reach the server
- **Solution**: Check internet connection, verify base URL

**Issue**: 500 Server Error
- **Cause**: Database connection or server issue
- **Solution**: Check server logs, verify DATABASE_URL env variable

## 📚 Additional Resources

- **Full API Docs**: See `MOBILE_SYNC_API.md`
- **Test Page**: Visit `/test-mobile-sync` in the app
- **Source Code**: Check `/app/api/mobile-sync/route.js`
- **Web Auth Reference**: Compare with `/app/login/page.jsx`

## ✨ Next Steps

1. ✅ Review this setup guide
2. ✅ Visit the test page and run test cases
3. ✅ Integrate Mobile Sync API into your mobile app
4. ✅ Test registration flow end-to-end
5. ✅ Test login with registered credentials
6. ✅ Monitor logs for any issues
7. ✅ Deploy to production

---

**Last Updated**: 2024
**API Version**: 1.0
**Status**: Production Ready
