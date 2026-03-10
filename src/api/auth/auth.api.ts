import { createClient } from "../api.client";

type LoginPayload = {
  identifier: string;
  password: string;
  app_type?: string;
};

export type LoginResponse = {
  // user: {
  //   id: string;
  //   email: string;
  // };
  access_token: string;
};

const api = createClient({
  baseURL: import.meta.env.VITE_NUTRITION_API_URL + '/v1',
});

export const loginRequest = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  console.log("payload login", payload);
  const { data } = await api.post<LoginResponse>("/auth/login", payload);
  return data;
};

import { User } from "../../types/api";

export const getUserRequest = async (): Promise<User> => {
  const { data } = await api.get<User>("/auth/me");
  return data;
};

export const logoutRequest = async (): Promise<void> => {
  await api.post("/auth/logout");
};
