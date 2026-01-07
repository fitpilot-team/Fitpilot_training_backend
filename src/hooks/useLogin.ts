import { useMutation } from '@tanstack/react-query';
import { loginRequest, LoginResponse, getUserRequest } from '../api/auth/auth.api';
import { useAuthStore } from '@/store/newAuthStore';
import { LoginRequest } from '../types/api';

export const useLoginMutation = () => {
    const { setAuth, setUser } = useAuthStore();

    return useMutation<LoginResponse, Error, LoginRequest>({
        mutationFn: (credentials) => loginRequest(credentials),
        onSuccess: async (data) => {
            // Update the store with the new token
            setAuth({ token: data.access_token });
            
            try {
                // Fetch user info immediately after login
                const user = await getUserRequest();
                setUser(user);
            } catch (error) {
                console.error("Failed to fetch user info after login", error);
            }
        },
        onError(error, variables, onMutateResult, context) {
            console.log(error);
        },
        
    });
};
