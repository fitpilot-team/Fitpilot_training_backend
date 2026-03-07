# How to Revert Login Bypass

When the backend and database are ready, follow these steps to restore real authentication.

## 1. Open `src/services/auth.ts`

## 2. Revert `login` function
- Remove the `mockResponse` object and the `BYPASS` log.
- Uncomment the `apiClient.post` call.

**Target Code:**
```typescript
async login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);

  // Store token in localStorage
  if (response.access_token) {
    localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
  }

  return response;
}
```

## 3. Revert `register` function
**Target Code:**
```typescript
async register(data: RegisterRequest): Promise<User> {
  return apiClient.post<User>('/auth/register', data);
}
```

## 4. Revert `getCurrentUser` function
**Target Code:**
```typescript
async getCurrentUser(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}
```

## 5. Revert `updateUser` function
**Target Code:**
```typescript
async updateUser(data: UserUpdate): Promise<User> {
  return apiClient.patch<User>('/auth/me', data);
}
```

## 6. Verification
- Ensure your backend is running on `http://localhost:8000` (or configured proxy port).
- Try to log in with real credentials.
- Check the Network tab to ensure requests are hitting the `/auth` endpoints.
