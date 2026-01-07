import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/newAuthStore';
import { JWTPayload, ProfessionalContextType, User } from '../types/api';

const ProfessionalContext = createContext<ProfessionalContextType | undefined>(undefined);

/**
 * Decodes a JWT token without external libraries
 */
const decodeToken = (token: string): JWTPayload | null => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Failed to decode token:', error);
        return null;
    }
};

export const ProfessionalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, user: authUser } = useAuthStore();
    const [professional, setProfessional] = useState<JWTPayload | null>(null);
    const [userData, setUserData] = useState<User | null>(authUser);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshProfessional = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (token) {
                const decoded = decodeToken(token);
                setProfessional(decoded);
            } else {
                setProfessional(null);
            }
            setUserData(authUser);
        } catch (err: any) {
            setError(err.message || 'Failed to refresh professional data');
        } finally {
            setIsLoading(false);
        }
    }, [token, authUser]);

    useEffect(() => {
        refreshProfessional();
    }, [refreshProfessional]);

    // Sync userData when authUser changes in authStore
    useEffect(() => {
        setUserData(authUser);
    }, [authUser]);

    return (
        <ProfessionalContext.Provider
            value={{
                professional,
                userData,
                isLoading: isLoading,
                error,
                refreshProfessional,
            }}
        >
            {children}
        </ProfessionalContext.Provider>
    );
};

export const useProfessional = () => {
    const context = useContext(ProfessionalContext);
    if (context === undefined) {
        throw new Error('useProfessional must be used within a ProfessionalProvider');
    }
    return context;
};
