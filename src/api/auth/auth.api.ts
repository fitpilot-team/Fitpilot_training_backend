import { createClient } from "../api.client";

type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  // user: {
  //   id: string;
  //   email: string;
  // };
  access_token: string;
  refresh_token: string;
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

export const getUserRequest = async (): Promise<any> => {
  const { data } = await api.get("/auth/me");
  return data;
};
