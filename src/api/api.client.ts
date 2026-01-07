import axios, { AxiosInstance } from "axios";
import { useAuthStore } from "@/store/newAuthStore";

type CreateClientConfig = {
  baseURL: string;
};

export const createClient = ({ baseURL }: CreateClientConfig): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
  });

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  return client;
};


