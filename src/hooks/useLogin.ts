import { useMutation } from '@tanstack/react-query';
import { loginRequest, LoginResponse, getUserRequest } from '../api/auth/auth.api';
import { useAuthStore } from '@/store/newAuthStore';
import { LoginRequest } from '../types/api';

export const useLoginMutation = () => {

    return useMutation<LoginResponse, Error, LoginRequest>({
        mutationFn: async (credentials) => {
            const data = await loginRequest(credentials);
            
            // Set token immediately so it's available for getUserRequest
            useAuthStore.getState().setAuth({ token: data.access_token });
            
            try {
                const user = await getUserRequest();
                
                // Case insensitive check
                if (user.role?.toLowerCase() === 'client') {
                    useAuthStore.getState().logout();
                    throw new Error('Access denied: Clients cannot login here');
                }
                
                // Set user if valid
                useAuthStore.getState().setUser(user);
                return data;
            } catch (error) {
                // Ensure we logout if anything fails after login
                useAuthStore.getState().logout();
                throw error;
            }
        },
        onSuccess: () => {
            // Token and user are already set in mutationFn
            // This callback acts as a final confirmation or for side effects not critical to the flow
        },
        onError(error) {
            console.log(error);
        },
        
    });
};
