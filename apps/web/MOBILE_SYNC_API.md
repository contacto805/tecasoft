# Mobile Sync API Documentation

## Overview
The Mobile Sync API provides a REST endpoint for mobile apps to register users with the same authentication system used by the web app (Tecavo Fruits Soft).

## Base URL
```
https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync
```

For local development:
```
http://localhost:3000/api/mobile-sync
```

---

## Endpoints

### 1. User Registration
**POST** `/api/mobile-sync`

Register a new mobile user.

#### Request Headers
```
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

#### Required Fields
| Field | Type | Description | Validation |
|-------|------|-------------|-----------|
| `email` | string | User's email address | Valid email format required |
| `password` | string | User's password | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| `name` | string | User's full name | Any non-empty string |
| `phone` | string | User's phone number | Min 10 digits (international format accepted) |

#### Success Response (201 Created)
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

#### Error Responses

**400 Bad Request** - Missing or invalid fields
```json
{
  "status": "error",
  "message": "Missing required fields: email, password, name, phone"
}
```

**400 Bad Request** - Invalid email format
```json
{
  "status": "error",
  "message": "Invalid email format"
}
```

**400 Bad Request** - Weak password
```json
{
  "status": "error",
  "message": "Password must be at least 8 characters"
}
```

**400 Bad Request** - Invalid phone number
```json
{
  "status": "error",
  "message": "Invalid phone number format (minimum 10 digits required)"
}
```

**409 Conflict** - Email already registered
```json
{
  "status": "error",
  "message": "User with this email already exists"
}
```

**500 Internal Server Error** - Server error
```json
{
  "status": "error",
  "message": "Registration failed. Please try again later."
}
```

---

### 2. API Health Check
**GET** `/api/mobile-sync`

Check if the Mobile Sync API is available.

#### Success Response (200 OK)
```json
{
  "status": "success",
  "message": "Mobile sync API is running",
  "endpoint": "POST /api/mobile-sync",
  "description": "Mobile user registration endpoint"
}
```

---

## Password Requirements

Passwords must meet the following criteria:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)

**Valid Examples:**
- `TecavoFruits2025`
- `MyPassword123`
- `SecurePass456`

**Invalid Examples:**
- `password` (no uppercase, no number)
- `PASSWORD123` (no lowercase)
- `Pass123` (only 7 characters)

---

## cURL Examples

### Successful Registration
```bash
curl -X POST https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@tecavofruits.com",
    "password": "Tecavo2025",
    "name": "Juan García",
    "phone": "+51987654321"
  }'
```

### Test Email Already Exists
```bash
curl -X POST https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contacto@tecavofruits.com",
    "password": "NewPass2025",
    "name": "Test User",
    "phone": "+51987654321"
  }'
```

### Test Weak Password
```bash
curl -X POST https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@tecavofruits.com",
    "password": "weak",
    "name": "Test User",
    "phone": "+51987654321"
  }'
```

---

## JavaScript/TypeScript Example

### Using Fetch API
```javascript
const registerUser = async (userData) => {
  try {
    const response = await fetch('/api/mobile-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        phone: userData.phone,
      }),
    });

    const result = await response.json();

    if (result.status === 'success') {
      console.log('Registration successful!');
      console.log('User ID:', result.userId);
      return result;
    } else {
      console.error('Registration failed:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

// Usage
try {
  const newUser = await registerUser({
    email: 'usuario@example.com',
    password: 'TecavoFruits2025',
    name: 'Juan Pérez',
    phone: '+51987654321',
  });
} catch (error) {
  // Handle error
}
```

### Using Axios
```javascript
import axios from 'axios';

const registerUser = async (userData) => {
  try {
    const response = await axios.post('/api/mobile-sync', {
      email: userData.email,
      password: userData.password,
      name: userData.name,
      phone: userData.phone,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};
```

---

## React Native Example

```javascript
const registerUser = async (email, password, name, phone) => {
  try {
    const response = await fetch('https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
        phone,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Usage in a component
const handleRegister = async (formData) => {
  try {
    const result = await registerUser(
      formData.email,
      formData.password,
      formData.name,
      formData.phone
    );
    Alert.alert('Success', `Welcome ${result.name}!`);
    // Navigate to login or dashboard
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

---

## Database Integration

The Mobile Sync API uses the same database tables as the web app:

### Tables
- **`user`** - User profile information
  - id (primary key)
  - email (unique)
  - name
  - emailVerified
  - image
  - createdAt
  - updatedAt

- **`account`** - Authentication credentials
  - userId (foreign key)
  - accountId (unique identifier)
  - providerId ('credential' for email/password)
  - password (bcrypt hashed)
  - createdAt
  - updatedAt

### Password Hashing
Passwords are hashed using **bcryptjs** with 12 salt rounds, matching the web app's security standard.

---

## Authentication After Registration

After successful registration via Mobile Sync API, users can log in using:

1. **Web App** - Login at `/login` with email/password
2. **Mobile App** - Call your mobile app's login endpoint with the registered credentials

The same `userId` is used across all platforms, allowing unified data access.

---

## Rate Limiting

Currently, no rate limiting is enforced. For production, consider implementing:
- Maximum 5 registration attempts per email per hour
- Maximum 10 requests per IP per minute

---

## Error Handling Best Practices

1. **Check HTTP Status Code**
   ```javascript
   if (response.status === 201) {
     // Success
   } else if (response.status === 409) {
     // Email already exists
   } else if (response.status === 400) {
     // Invalid input
   }
   ```

2. **Parse Error Messages**
   ```javascript
   const data = await response.json();
   if (data.status === 'error') {
     console.error(data.message);
   }
   ```

3. **User-Friendly Messages**
   - Show validation errors to the user
   - Log detailed errors server-side for debugging
   - Provide clear instructions for fixing issues

---

## Testing Checklist

- [ ] Test successful registration
- [ ] Test missing fields error
- [ ] Test invalid email format
- [ ] Test weak password
- [ ] Test invalid phone format
- [ ] Test duplicate email (409 conflict)
- [ ] Test with various international phone formats
- [ ] Test with special characters in name
- [ ] Verify user can login with registered credentials
- [ ] Verify user data is accessible in dashboard

---

## Security Considerations

✅ **Implemented:**
- Password hashing with bcryptjs (12 rounds)
- Email validation
- Password strength requirements
- Duplicate email prevention
- HTTPS-only in production

⚠️ **Recommendations:**
- Add rate limiting to prevent brute force attacks
- Implement CAPTCHA for registration form
- Add email verification before account activation
- Log registration attempts for security monitoring
- Implement 2FA for admin accounts

---

## Support & Troubleshooting

### Issue: "Missing required fields"
**Solution:** Ensure all 4 fields (email, password, name, phone) are provided in the request.

### Issue: "Invalid email format"
**Solution:** Check email format. Must be `user@domain.com`

### Issue: "Password must be at least 8 characters"
**Solution:** Password must have min 8 chars, 1 uppercase, 1 lowercase, 1 number.

### Issue: "User with this email already exists"
**Solution:** Use a different email address or implement password reset.

### Issue: "Invalid phone number format"
**Solution:** Phone must have minimum 10 digits. Use international format: +51987654321

For additional support, contact: contacto@tecavofruits.com
