import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// Simple ID generator
function generateId() {
  return `user-${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
}

// Validation function
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  // Minimum 8 characters, at least one uppercase, one lowercase, one number
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

function validatePhone(phone) {
  // Accept phone numbers with 10+ digits (international format)
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name, phone } = body;

    // Validate required fields
    if (!email || !password || !name || !phone) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required fields: email, password, name, phone",
        },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid email format",
        },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          status: "error",
          message: passwordValidation.error,
        },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Invalid phone number format (minimum 10 digits required)",
        },
        { status: 400 }
      );
    }

    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists with this email
    const existingUser = await sql`
      SELECT id, email FROM "user" WHERE LOWER(TRIM(email)) = ${normalizedEmail}
    `;

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "User with this email already exists",
          code: "DUPLICATE_EMAIL",
          existingEmail: normalizedEmail,
        },
        { status: 409 }
      );
    }

    // Generate user ID
    const userId = generateId();

    // Hash password with bcryptjs (12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user record
    const now = new Date().toISOString();
    const userResult = await sql`
      INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
      VALUES (${userId}, ${normalizedEmail}, ${name}, false, ${now}, ${now})
      RETURNING id, email, name
    `;

    // Generate account ID
    const accountId = `account-${Date.now()}${Math.random().toString(36).substring(2, 9)}`;

    // Create account record with hashed password
    const accountResult = await sql`
      INSERT INTO account (
        id,
        "userId", 
        "accountId", 
        "providerId", 
        password, 
        "createdAt", 
        "updatedAt"
      )
      VALUES (
        ${accountId},
        ${userId},
        ${userId},
        'credential',
        ${hashedPassword},
        ${now},
        ${now}
      )
      RETURNING "userId"
    `;

    // Success response
    return NextResponse.json(
      {
        status: "success",
        message: "User registered successfully",
        userId: userId,
        email: normalizedEmail,
        name: name,
        registeredAt: now,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Mobile sync registration error:", error);

    // Check for specific database errors - duplicate key violation
    if (error.message && (error.message.includes("duplicate key") || error.message.includes("unique constraint"))) {
      return NextResponse.json(
        {
          status: "error",
          message: "Email already registered in system",
          code: "DUPLICATE_EMAIL",
        },
        { status: 409 }
      );
    }

    if (error.message.includes("not null constraint")) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing required database fields",
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        status: "error",
        message: "Registration failed. Please try again later.",
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check API health
export async function GET() {
  return NextResponse.json(
    {
      status: "success",
      message: "Mobile sync API is running",
      endpoint: "POST /api/mobile-sync",
      description: "Mobile user registration endpoint",
    },
    { status: 200 }
  );
}
