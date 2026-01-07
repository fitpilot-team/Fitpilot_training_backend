// import { apiClient } from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, User, UserUpdate } from '../types/api';

const AUTH_TOKEN_KEY = 'access_token';

export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    console.log('BYPASS: Logging in with mock credentials', credentials);
    
    // LoginResponse only has tokens, User is fetched separately
    const mockResponse: LoginResponse = {
      access_token: 'mock-token-12345',
      token_type: 'bearer'
    };

    const response = mockResponse;

    // Store token in localStorage
    if (response.access_token) {
      localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
    }

    return response;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<User> {
    // return apiClient.post<User>('/auth/register', data);
    console.log('BYPASS: Registering mock user');
    return {
        id: 'mock-user-id',
        email: data.email,
        full_name: data.full_name,
        role: data.role || 'client',
        preferred_language: 'en',
        is_active: true,
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    // return apiClient.get<User>('/auth/me');
    console.log('BYPASS: Getting mock user');
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                id: 'mock-user-id',
                email: 'mock@example.com',
                full_name: 'Mock User',
                role: 'client',
                preferred_language: 'en',
                is_active: true,
                email_verified: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }, 500);
    });
  },

  /**
   * Update current user profile
   */
  async updateUser(data: UserUpdate): Promise<User> {
    // return apiClient.patch<User>('/auth/me', data);
      console.log('BYPASS: Updating mock user');
      return {
          id: 'mock-user-id',
          email: data.email || 'mock@example.com',
          full_name: data.full_name || 'Mock User',
          role: 'client',
          preferred_language: data.preferred_language || 'en',
          is_active: true,
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
      };
  },

  /**
   * Logout - clear token and redirect
   */
  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.href = '/login';
  },

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  /**
   * Set token manually (useful for testing)
   */
  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },
};
