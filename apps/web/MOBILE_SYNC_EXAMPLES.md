# Mobile Sync API - Code Examples & Integration Patterns

Complete code examples for integrating the Mobile Sync API into various mobile platforms and frameworks.

---

## 🔧 JavaScript / TypeScript (Vanilla)

### Basic Fetch Implementation

```javascript
// auth.js
export const registerUser = async (userData) => {
  const { email, password, name, phone } = userData;

  // Validate before sending
  if (!email || !password || !name || !phone) {
    throw new Error('All fields are required');
  }

  try {
    const response = await fetch('/api/mobile-sync', {
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

    return {
      success: true,
      userId: data.userId,
      email: data.email,
      name: data.name,
      registeredAt: data.registeredAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Usage
const result = await registerUser({
  email: 'user@example.com',
  password: 'MyPassword123',
  name: 'John Doe',
  phone: '+51987654321',
});

if (result.success) {
  console.log('User registered:', result.userId);
} else {
  console.error('Error:', result.error);
}
```

---

## ⚛️ React / React Native

### Functional Component with Hooks

```jsx
// SignUpForm.jsx
import { useState } from 'react';

export default function SignUpForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(''); // Clear error on input change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mobile-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.status === 201) {
        // Success - navigate to login or dashboard
        alert(`¡Bienvenido ${data.name}!`);
        window.location.href = '/login';
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
        />
      </div>

      <div className="form-group">
        <label>Full Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Phone</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          required
          placeholder="+51987654321"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Create Account'}
      </button>
    </form>
  );
}
```

### React Native (Expo/RN)

```jsx
// screens/SignUpScreen.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SignUpScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const handleSignUp = async () => {
    const { email, password, name, phone } = formData;

    // Basic validation
    if (!email || !password || !name || !phone) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        'https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com/api/mobile-sync',
        {
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
        }
      );

      const data = await response.json();

      if (response.status === 201) {
        Alert.alert(
          '¡Success!',
          `Welcome ${data.name}! You can now log in.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
        // Store userId for later use
        await AsyncStorage.setItem('lastUserId', data.userId);
      } else {
        Alert.alert('Error', data.message || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Create Account
      </Text>

      <TextInput
        placeholder="Email"
        value={formData.email}
        onChangeText={(text) =>
          setFormData({ ...formData, email: text })
        }
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 10,
          marginBottom: 15,
          borderRadius: 8,
        }}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        placeholder="Password"
        value={formData.password}
        onChangeText={(text) =>
          setFormData({ ...formData, password: text })
        }
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 10,
          marginBottom: 15,
          borderRadius: 8,
        }}
        secureTextEntry
      />

      <TextInput
        placeholder="Full Name"
        value={formData.name}
        onChangeText={(text) =>
          setFormData({ ...formData, name: text })
        }
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 10,
          marginBottom: 15,
          borderRadius: 8,
        }}
      />

      <TextInput
        placeholder="Phone"
        value={formData.phone}
        onChangeText={(text) =>
          setFormData({ ...formData, phone: text })
        }
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          padding: 10,
          marginBottom: 20,
          borderRadius: 8,
        }}
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        onPress={handleSignUp}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#ccc' : '#16a34a',
          padding: 15,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
            Sign Up
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={{ marginTop: 15 }}
      >
        <Text style={{ textAlign: 'center', color: '#666' }}>
          Already have an account? Login
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

---

## 🐦 Flutter / Dart

### Complete Flutter Integration

```dart
// lib/services/auth_service.dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class RegisterRequest {
  final String email;
  final String password;
  final String name;
  final String phone;

  RegisterRequest({
    required this.email,
    required this.password,
    required this.name,
    required this.phone,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'name': name,
    'phone': phone,
  };
}

class RegisterResponse {
  final bool success;
  final String? userId;
  final String message;
  final String? email;
  final String? name;

  RegisterResponse({
    required this.success,
    this.userId,
    required this.message,
    this.email,
    this.name,
  });

  factory RegisterResponse.fromJson(Map<String, dynamic> json) {
    return RegisterResponse(
      success: json['status'] == 'success',
      userId: json['userId'],
      message: json['message'] ?? '',
      email: json['email'],
      name: json['name'],
    );
  }
}

class AuthService {
  static const String _baseUrl =
      'https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com';
  static const String _registerEndpoint = '/api/mobile-sync';

  /// Register a new user with the mobile sync API
  static Future<RegisterResponse> registerUser(
    String email,
    String password,
    String name,
    String phone,
  ) async {
    try {
      final request = RegisterRequest(
        email: email,
        password: password,
        name: name,
        phone: phone,
      );

      final response = await http.post(
        Uri.parse('$_baseUrl$_registerEndpoint'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(request.toJson()),
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () => throw Exception('Request timeout'),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return RegisterResponse.fromJson(data);
      } else {
        return RegisterResponse(
          success: false,
          message: data['message'] ?? 'Registration failed',
        );
      }
    } catch (e) {
      return RegisterResponse(
        success: false,
        message: 'Error: ${e.toString()}',
      );
    }
  }
}
```

### Flutter UI Widget

```dart
// lib/screens/signup_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({Key? key}) : super(key: key);

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleSignUp() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final response = await AuthService.registerUser(
      _emailController.text.trim(),
      _passwordController.text,
      _nameController.text.trim(),
      _phoneController.text.trim(),
    );

    setState(() => _isLoading = false);

    if (response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('¡Welcome ${response.name}!'),
          backgroundColor: Colors.green,
        ),
      );
      // Navigate to login or home
      Navigator.of(context).pushReplacementNamed('/login');
    } else {
      setState(() => _errorMessage = response.message);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(response.message),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sign Up',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Create your Tecavo Fruits Soft account',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 30),
              
              // Email Field
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  prefixIcon: const Icon(Icons.email),
                ),
                validator: (value) {
                  if (value?.isEmpty ?? true) return 'Email is required';
                  if (!value!.contains('@')) return 'Invalid email format';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              
              // Password Field
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Password',
                  hintText: 'Min 8 chars, 1 upper, 1 lower, 1 number',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  prefixIcon: const Icon(Icons.lock),
                ),
                validator: (value) {
                  if (value?.isEmpty ?? true) return 'Password is required';
                  if (value!.length < 8) return 'Min 8 characters';
                  if (!value.contains(RegExp(r'[A-Z]'))) {
                    return 'Need uppercase letter';
                  }
                  if (!value.contains(RegExp(r'[a-z]'))) {
                    return 'Need lowercase letter';
                  }
                  if (!value.contains(RegExp(r'[0-9]'))) {
                    return 'Need number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              
              // Name Field
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Full Name',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  prefixIcon: const Icon(Icons.person),
                ),
                validator: (value) {
                  return (value?.isEmpty ?? true) ? 'Name is required' : null;
                },
              ),
              const SizedBox(height: 16),
              
              // Phone Field
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Phone',
                  hintText: '+51987654321',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  prefixIcon: const Icon(Icons.phone),
                ),
                validator: (value) {
                  if (value?.isEmpty ?? true) return 'Phone is required';
                  final cleaned = value!.replaceAll(RegExp(r'[^\d]'), '');
                  if (cleaned.length < 10) return 'Min 10 digits';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              
              // Error Message
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(color: Colors.red[900]),
                  ),
                ),
              const SizedBox(height: 16),
              
              // Sign Up Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleSignUp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[600],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Create Account',
                          style: TextStyle(fontSize: 16, color: Colors.white),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              
              // Login Link
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pushNamed('/login'),
                  child: RichText(
                    text: const TextSpan(
                      children: [
                        TextSpan(
                          text: "Already have an account? ",
                          style: TextStyle(color: Colors.grey),
                        ),
                        TextSpan(
                          text: "Login",
                          style: TextStyle(
                            color: Colors.green,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## 📱 Swift / iOS (Native)

### iOS URLSession Implementation

```swift
// AuthService.swift
import Foundation

struct RegisterRequest: Codable {
    let email: String
    let password: String
    let name: String
    let phone: String
}

struct RegisterResponse: Codable {
    let status: String
    let message: String
    let userId: String?
    let email: String?
    let name: String?
    let registeredAt: String?
    
    enum CodingKeys: String, CodingKey {
        case status, message, userId, email, name, registeredAt
    }
}

class AuthService {
    static let shared = AuthService()
    private let baseURL = URL(string: "https://3000-if2vdcm3dtla6va1rk1yl.prev.appgen.com")!
    
    func registerUser(
        email: String,
        password: String,
        name: String,
        phone: String,
        completion: @escaping (Result<RegisterResponse, Error>) -> Void
    ) {
        let endpoint = baseURL.appendingPathComponent("/api/mobile-sync")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let registerRequest = RegisterRequest(
            email: email,
            password: password,
            name: name,
            phone: phone
        )
        
        do {
            request.httpBody = try JSONEncoder().encode(registerRequest)
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "No data", code: -1)))
                return
            }
            
            do {
                let response = try JSONDecoder().decode(RegisterResponse.self, from: data)
                completion(.success(response))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
```

### SwiftUI View

```swift
// SignUpView.swift
import SwiftUI

struct SignUpView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var phone = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showLoginSheet = false
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Account Information") {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    
                    SecureField("Password", text: $password)
                    
                    TextField("Full Name", text: $name)
                    
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Create Account")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: handleSignUp) {
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("Sign Up")
                        }
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
            }
        }
    }
    
    private func handleSignUp() {
        isLoading = true
        errorMessage = nil
        
        AuthService.shared.registerUser(
            email: email,
            password: password,
            name: name,
            phone: phone
        ) { result in
            DispatchQueue.main.async {
                isLoading = false
                
                switch result {
                case .success(let response):
                    if response.status == "success" {
                        showLoginSheet = true
                    } else {
                        errorMessage = response.message
                    }
                case .failure(let error):
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}
```

---

## 🤖 Kotlin / Android (Native)

### Retrofit Implementation

```kotlin
// API Models
data class RegisterRequest(
    @SerializedName("email")
    val email: String,
    @SerializedName("password")
    val password: String,
    @SerializedName("name")
    val name: String,
    @SerializedName("phone")
    val phone: String
)

data class RegisterResponse(
    @SerializedName("status")
    val status: String,
    @SerializedName("message")
    val message: String,
    @SerializedName("userId")
    val userId: String?,
    @SerializedName("email")
    val email: String?,
    @SerializedName("name")
    val name: String?
)

// Retrofit Service
interface AuthService {
    @POST("/api/mobile-sync")
    suspend fun registerUser(
        @Body request: RegisterRequest
    ): RegisterResponse
}

// Repository
class AuthRepository {
    private val apiService = RetrofitClient.authService
    
    suspend fun registerUser(
        email: String,
        password: String,
        name: String,
        phone: String
    ): Result<RegisterResponse> = try {
        val request = RegisterRequest(email, password, name, phone)
        val response = apiService.registerUser(request)
        Result.success(response)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

// ViewModel
class SignUpViewModel(private val authRepository: AuthRepository) : ViewModel() {
    private val _uiState = MutableLiveData<SignUpUiState>()
    val uiState: LiveData<SignUpUiState> = _uiState
    
    fun signUp(email: String, password: String, name: String, phone: String) {
        viewModelScope.launch {
            _uiState.value = SignUpUiState.Loading
            
            val result = authRepository.registerUser(email, password, name, phone)
            
            result.onSuccess { response ->
                if (response.status == "success") {
                    _uiState.value = SignUpUiState.Success(response)
                } else {
                    _uiState.value = SignUpUiState.Error(response.message)
                }
            }
            
            result.onFailure { error ->
                _uiState.value = SignUpUiState.Error(error.message ?: "Unknown error")
            }
        }
    }
}

sealed class SignUpUiState {
    object Loading : SignUpUiState()
    data class Success(val response: RegisterResponse) : SignUpUiState()
    data class Error(val message: String) : SignUpUiState()
}
```

---

## 🔐 Common Security Practices

### Input Validation (Before Sending)

```javascript
const validateInput = (formData) => {
  const errors = {};

  // Email validation
  if (!formData.email || !formData.email.includes('@')) {
    errors.email = 'Valid email required';
  }

  // Password validation
  if (formData.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(formData.password)) {
    errors.password = 'Password must contain uppercase letter';
  }
  if (!/[a-z]/.test(formData.password)) {
    errors.password = 'Password must contain lowercase letter';
  }
  if (!/[0-9]/.test(formData.password)) {
    errors.password = 'Password must contain number';
  }

  // Name validation
  if (!formData.name || formData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  // Phone validation
  const phoneDigits = formData.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    errors.phone = 'Phone must have at least 10 digits';
  }

  return errors;
};

// Usage
const errors = validateInput(formData);
if (Object.keys(errors).length > 0) {
  // Show errors to user
  return;
}
```

### Error Handling Pattern

```javascript
const registerWithErrorHandling = async (userData) => {
  try {
    // Validate locally first
    const validationErrors = validateInput(userData);
    if (Object.keys(validationErrors).length > 0) {
      return {
        success: false,
        errors: validationErrors,
      };
    }

    // Make API call
    const response = await fetch('/api/mobile-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    // Handle different HTTP status codes
    switch (response.status) {
      case 201:
        return {
          success: true,
          userId: data.userId,
        };
      case 400:
        return {
          success: false,
          error: data.message,
          type: 'validation',
        };
      case 409:
        return {
          success: false,
          error: 'Email already registered',
          type: 'conflict',
        };
      case 500:
        return {
          success: false,
          error: 'Server error. Please try again later.',
          type: 'server',
        };
      default:
        return {
          success: false,
          error: 'Unexpected error',
        };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error. Check your internet connection.',
      type: 'network',
    };
  }
};
```

---

## 🔗 Storing Credentials After Registration

### LocalStorage (Web)

```javascript
// Save after successful registration
const handleRegistrationSuccess = (data) => {
  localStorage.setItem('userId', data.userId);
  localStorage.setItem('userEmail', data.email);
  localStorage.setItem('userName', data.name);
  localStorage.setItem('registeredAt', data.registeredAt);
};

// Retrieve for login
const getStoredUserInfo = () => {
  return {
    userId: localStorage.getItem('userId'),
    email: localStorage.getItem('userEmail'),
    name: localStorage.getItem('userName'),
  };
};
```

### AsyncStorage (React Native)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save after successful registration
const saveUserInfo = async (data) => {
  try {
    await AsyncStorage.multiSet([
      ['userId', data.userId],
      ['userEmail', data.email],
      ['userName', data.name],
      ['registeredAt', data.registeredAt],
    ]);
  } catch (error) {
    console.error('Failed to save user info:', error);
  }
};

// Retrieve for login
const getUserInfo = async () => {
  try {
    const values = await AsyncStorage.multiGet([
      'userId',
      'userEmail',
      'userName',
    ]);
    return {
      userId: values[0][1],
      email: values[1][1],
      name: values[2][1],
    };
  } catch (error) {
    console.error('Failed to retrieve user info:', error);
  }
};
```

### Keychain (iOS Secure Storage)

```swift
import Security

class KeychainManager {
    static let shared = KeychainManager()
    
    func saveUserCredentials(userId: String, email: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "tecavoUser",
            kSecValueData as String: "\(userId)|\(email)".data(using: .utf8) ?? Data(),
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func retrieveUserCredentials() -> (userId: String, email: String)? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "tecavoUser",
            kSecReturnData as String: true,
        ]
        
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == noErr,
           let data = result as? Data,
           let string = String(data: data, encoding: .utf8) {
            let parts = string.split(separator: "|")
            return (userId: String(parts[0]), email: String(parts[1]))
        }
        return nil
    }
}
```

---

This document provides comprehensive code examples for integrating the Mobile Sync API across all major mobile platforms. Choose the example that matches your tech stack and adapt it to your specific needs.
