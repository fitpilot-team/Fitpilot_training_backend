import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiError } from '../types/api';
import { useAuthStore } from '@/store/newAuthStore';
import { refreshAccessToken } from '@/api/api.client';

type RetryableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

const shouldSkipRefreshFlow = (url?: string): boolean => {
  if (!url) return false;

  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/send-verification') ||
    url.includes('/auth/verify-phone') ||
    url.includes('/auth/signup')
  );
};

const resolveTrainingApiBaseURL = (): string => {
  const configuredBase = import.meta.env.VITE_TRAINING_API_URL as string | undefined;

  if (!configuredBase) {
    return '/api';
  }

  const normalized = configuredBase.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const resolveNutritionApiBaseURL = (): string => {
  const configuredBase = import.meta.env.VITE_NUTRITION_API_URL as string | undefined;
  if (!configuredBase) {
    return window.location.origin;
  }
  return configuredBase.replace(/\/+$/, '');
};

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: resolveTrainingApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
  withCredentials: true,
});

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    config.withCredentials = true;

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldSkipRefreshFlow(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const refreshedToken = await refreshAccessToken(resolveNutritionApiBaseURL());
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        originalRequest.withCredentials = true;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();

        if (window.location.pathname !== '/auth/login') {
          window.location.href = '/auth/login';
        }
      }
    }

    // Handle specific error cases
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();

      // Only redirect if not already on login page
      if (window.location.pathname !== '/auth/login') {
        window.location.href = '/auth/login';
      }
    }

    // Extract error message from response
    let errorMessage = 'An unexpected error occurred';

    const detail = error.response?.data?.detail;

    if (typeof detail === 'string') {
      // Simple string error message
      errorMessage = detail;
    } else if (Array.isArray(detail)) {
      // Pydantic validation errors - extract messages
      errorMessage = detail
        .map((err: any) => {
          const field = err.loc?.slice(1).join('.') || 'field';
          return `${field}: ${err.msg}`;
        })
        .join(', ');
    } else if (detail && typeof detail === 'object') {
      // Object error - try to get message
      errorMessage = detail.message || detail.msg || JSON.stringify(detail);
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Return a formatted error
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

// Generic API methods
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return api.get<T>(url, config).then((response) => response.data);
  },

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return api.post<T>(url, data, config).then((response) => response.data);
  },

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return api.put<T>(url, data, config).then((response) => response.data);
  },

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return api.delete<T>(url, config).then((response) => response.data);
  },

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    return api.patch<T>(url, data, config).then((response) => response.data);
  },
};

export default api;
