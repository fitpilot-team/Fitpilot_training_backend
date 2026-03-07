import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/newAuthStore';
import { JWTPayload, ProfessionalContextType, User } from '../types/api';
import { getUserRequest } from '../api/auth/auth.api';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { initializeAuthSession } from '@/api/api.client';

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
    const { token, user: authUser, setUser, authChecked } = useAuthStore();
    const [professional, setProfessional] = useState<JWTPayload | null>(null);
    const [storedUserData, setStoredUserData] = useLocalStorage<User | null>('user_data', null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authChecked) return;
        initializeAuthSession(import.meta.env.VITE_NUTRITION_API_URL).catch(() => {
            // Session stays unauthenticated when refresh cookie is missing/expired.
        });
    }, [authChecked]);

    // Hydrate authStore from localStorage on mount
    useEffect(() => {
        if (!authChecked) return;
        if (!authUser && storedUserData && token) {
            setUser(storedUserData);
        }
    }, [authChecked, authUser, storedUserData, token, setUser]);

    const refreshProfessional = useCallback(async (forceRefresh = false) => {
        if (!authChecked) {
            setIsLoading(true);
            return;
        }

        if (!token) {
            setProfessional(null);
            setStoredUserData(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const decoded = decodeToken(token);
            setProfessional(decoded);
            
            // Avoid redundant fetch if we already have the user data in authStore or localStorage
            // and it seems to belong to the same professional/user
            if (!forceRefresh && authUser && authUser.id === decoded?.sub) {
                // If it's already in the store, we don't necessarily need to fetch again immediately
                // but we might want to sync it to localStorage if not there
                if (!storedUserData) {
                    setStoredUserData(authUser);
                }
                setIsLoading(false);
                return;
            }

            // Fetch full user data from API to ensure we have name, lastname, etc.
            try {
                const user = await getUserRequest();
                setUser(user);
                // setStoredUserData will be triggered by the sync effect
            } catch (fetchError) {
                console.error("Failed to fetch user details", fetchError);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to refresh professional data');
        } finally {
            setIsLoading(false);
        }
    }, [authChecked, token, authUser, storedUserData, setUser, setStoredUserData]);

    useEffect(() => {
        if (!authChecked) {
            setIsLoading(true);
            return;
        }

        refreshProfessional();
    }, [token, authChecked]); // Keep this scoped to auth session state changes

    // Sync authUser to localStorage
    useEffect(() => {
        if (authUser) {
            setStoredUserData(authUser);
        }
    }, [authUser, setStoredUserData]);

    const activeUser = authUser || storedUserData;
    const hasSubscriptionAccess =
        activeUser?.has_active_subscription === true ||
        activeUser?.subscription_vigency?.is_vigent === true;
    const requiresSubscriptionSelection = Boolean(
        activeUser &&
        String(activeUser.role ?? '').toUpperCase() === 'PROFESSIONAL' &&
        !hasSubscriptionAccess
    );

    return (
        <ProfessionalContext.Provider
            value={{
                professional,
                userData: activeUser,
                isLoading: isLoading,
                error,
                requiresSubscriptionSelection,
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
