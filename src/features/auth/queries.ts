import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sendVerification, verifyPhone, signup, getAuthSessions, revokeAuthSession, logoutAllAuthSessions } from "./api";
import { SendVerificationDto, VerifyPhoneDto, SignupDto, AuthSession } from "./types";

export const AUTH_SESSIONS_QUERY_KEY = ["auth-sessions"] as const;

export const useSendVerification = () => {
    return useMutation({
        mutationFn: (data: SendVerificationDto) => sendVerification(data),
    });
};

export const useVerifyPhone = () => {
    return useMutation({
        mutationFn: (data: VerifyPhoneDto) => verifyPhone(data),
    });
};

export const useSignupMutation = () => {
    return useMutation({
        mutationFn: (data: SignupDto) => signup(data),
    });
};

export const useAuthSessions = () => {
    return useQuery<AuthSession[], Error>({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
        queryFn: getAuthSessions,
        staleTime: 1000 * 30,
    });
};

export const useRevokeAuthSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId: number) => revokeAuthSession(sessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: AUTH_SESSIONS_QUERY_KEY });
        },
    });
};

export const useLogoutAllAuthSessions = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: logoutAllAuthSessions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: AUTH_SESSIONS_QUERY_KEY });
        },
    });
};
