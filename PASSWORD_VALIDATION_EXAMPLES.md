# Password Validation - Visual Examples

## Before This Change

### ❌ Weak Password Accepted
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John"
  }'

# Response: 201 Created ✓
# User registered with weak password!
```

## After This Change

### ✅ Strong Password Required

#### Example 1: Missing Uppercase Letter
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123!",
    "firstName": "John"
  }'

# Response: 400 Bad Request ✗
{
  "statusCode": 400,
  "message": [
    "Password must contain at least one uppercase letter and one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)"
  ],
  "error": "Bad Request"
}
```

#### Example 2: Missing Special Character
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "firstName": "John"
  }'

# Response: 400 Bad Request ✗
{
  "statusCode": 400,
  "message": [
    "Password must contain at least one uppercase letter and one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)"
  ],
  "error": "Bad Request"
}
```

#### Example 3: Too Short
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Pas1!",
    "firstName": "John"
  }'

# Response: 400 Bad Request ✗
{
  "statusCode": 400,
  "message": [
    "Password must be at least 6 characters long"
  ],
  "error": "Bad Request"
}
```

#### Example 4: Valid Strong Password ✓
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John"
  }'

# Response: 201 Created ✓
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "status": "ACTIVE"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Valid Password Examples

All of these passwords would be accepted:

| Password | Length | Uppercase | Special | Status |
|----------|--------|-----------|---------|--------|
| `Password123!` | 13 | ✓ | ✓ | ✅ Valid |
| `MyP@ss1` | 7 | ✓ | ✓ | ✅ Valid |
| `Secure#Pass123` | 14 | ✓ | ✓ | ✅ Valid |
| `Test$123` | 8 | ✓ | ✓ | ✅ Valid |
| `Valid1!` | 7 | ✓ | ✓ | ✅ Valid |
| `Pass1!` | 6 | ✓ | ✓ | ✅ Valid (minimum) |

## Invalid Password Examples

All of these passwords would be rejected:

| Password | Length | Uppercase | Special | Status | Reason |
|----------|--------|-----------|---------|--------|--------|
| `password123!` | 13 | ✗ | ✓ | ❌ Invalid | No uppercase |
| `Password123` | 11 | ✓ | ✗ | ❌ Invalid | No special char |
| `PASSWORD123!` | 12 | ✓ | ✓ | ✅ Valid | Actually valid! |
| `Pass1` | 5 | ✓ | ✗ | ❌ Invalid | Too short + no special |
| `short` | 5 | ✗ | ✗ | ❌ Invalid | Too short + missing both |
| `password` | 8 | ✗ | ✗ | ❌ Invalid | No uppercase + no special |

## Special Characters Accepted

The following special characters are all valid:

```
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ?
```

## Frontend Integration Example

```typescript
// React/TypeScript example
const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
};

// Usage
const handleRegister = async (data) => {
  const passwordErrors = validatePassword(data.password);
  
  if (passwordErrors.length > 0) {
    setErrors(passwordErrors);
    return;
  }
  
  // Proceed with registration
  await registerUser(data);
};
```

## Password Strength Indicator (Recommended)

```typescript
const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
};
```

## Security Best Practices

1. **Display requirements upfront**: Show users what's required before they submit
2. **Real-time validation**: Validate as the user types for better UX
3. **Clear error messages**: Use the server's error messages
4. **Password strength indicator**: Visual feedback helps users create better passwords
5. **Don't log passwords**: Never log actual password values
6. **Server-side validation**: Always rely on server validation as the source of truth

## Testing the API

You can test the password validation using the provided test suite:

```bash
cd main-api
npm test -- src/modules/auth/tests/auth.dto.spec.ts
```

All 16 tests should pass, validating:
- Valid passwords with various special characters
- Invalid passwords missing requirements
- Edge cases (minimum length, etc.)
