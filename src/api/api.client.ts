import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/newAuthStore";

type CreateClientConfig = {
  baseURL: string;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  access_token?: string;
};

const refreshRequests = new Map<string, Promise<string>>();

const normalizeBaseURL = (baseURL: string) => baseURL.replace(/\/+$/, "");

const resolveRefreshPath = (baseURL: string): string => {
  try {
    const parsedBaseURL = new URL(baseURL, window.location.origin);
    const normalizedPath = parsedBaseURL.pathname.replace(/\/+$/, "");
    return normalizedPath.endsWith("/v1") ? "/auth/refresh" : "/v1/auth/refresh";
  } catch {
    return "/v1/auth/refresh";
  }
};

const shouldSkipRefreshFlow = (url?: string): boolean => {
  if (!url) return false;

  return (
    url.includes("/auth/refresh") ||
    url.includes("/auth/login") ||
    url.includes("/auth/send-verification") ||
    url.includes("/auth/verify-phone") ||
    url.includes("/auth/signup")
  );
};

export const refreshAccessToken = async (baseURL: string): Promise<string> => {
  const cacheKey = normalizeBaseURL(baseURL);
  const existingRefresh = refreshRequests.get(cacheKey);

  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = axios
    .post<RefreshResponse>(
      resolveRefreshPath(baseURL),
      {},
      {
        baseURL,
        withCredentials: true,
        timeout: 10000,
      }
    )
    .then(({ data }) => {
      if (!data?.access_token) {
        throw new Error("Refresh endpoint did not return access token");
      }

      useAuthStore.getState().setAuth({ token: data.access_token });
      return data.access_token;
    })
    .catch((error) => {
      useAuthStore.getState().clearAuth();
      throw error;
    })
    .finally(() => {
      refreshRequests.delete(cacheKey);
    });

  refreshRequests.set(cacheKey, refreshPromise);
  return refreshPromise;
};

export const initializeAuthSession = async (baseURL: string): Promise<boolean> => {
  if (useAuthStore.getState().authChecked) {
    return useAuthStore.getState().isAuthenticated;
  }

  try {
    await refreshAccessToken(baseURL);
    return true;
  } catch {
    useAuthStore.getState().clearAuth();
    return false;
  } finally {
    useAuthStore.getState().setAuthChecked(true);
  }
};

export const createClient = ({ baseURL }: CreateClientConfig): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    withCredentials: true,
  });

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    config.withCredentials = true;

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetryableRequestConfig | undefined;

      if (!originalRequest || error.response?.status !== 401) {
        return Promise.reject(error);
      }

      if (originalRequest._retry || shouldSkipRefreshFlow(originalRequest.url)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshedToken = await refreshAccessToken(baseURL);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
  );

  return client;
};


