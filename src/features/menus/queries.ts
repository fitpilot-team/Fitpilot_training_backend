import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMenus, getMenuById, createMenu, updateMenu, deleteMenu, getMenuPool, swapDailyMenu, getMenuPoolCalendar, generateMenuAI, saveMenuDraft, updateMenuDraft, getDrafts, getDraftById } from './api';
import { toast } from 'react-hot-toast';

const resolveErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }

    return fallback;
};

export const useGetMenus = (professionalId?: number) => {
    return useQuery({
        queryKey: ['menus', professionalId],
        queryFn: () => getMenus(professionalId),
        enabled: !!professionalId, // Only fetch if professionalId is available (if strictly required, otherwise remove enabled)
    });
};

export const useGetDrafts = (professionalId?: number, clientId?: number | null) => {
    return useQuery({
        queryKey: ['menus-drafts', professionalId, clientId],
        queryFn: () => getDrafts(professionalId!, clientId),
        enabled: !!professionalId,
    });
};

export const useGetDraftById = (id?: string | null) => {
    return useQuery({
        queryKey: ['menu-draft', id],
        queryFn: () => getDraftById(id!),
        enabled: !!id,
    });
};



export const useGetMenuById = (id: number) => {
    return useQuery({
        queryKey: ['menus', id],
        queryFn: () => getMenuById(id),
        enabled: !!id,
    });
};

export const useCreateMenu = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createMenu,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            queryClient.invalidateQueries({ queryKey: ['menus-pool'] });
            toast.success('Menú creado correctamente');
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error, 'Error al crear el menú'));
        },
    });
};

export const useUpdateMenu = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateMenu(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            queryClient.invalidateQueries({ queryKey: ['menus-pool'] });
            toast.success('Menú actualizado correctamente');
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error, 'Error al actualizar el menú'));
        },
    });
};

export const useDeleteMenu = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteMenu,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            queryClient.invalidateQueries({ queryKey: ['menus-pool'] });
            toast.success('Menú eliminado correctamente');
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error, 'Error al eliminar el menú'));
        },
    });
};

export const useSwapDailyMenu = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: swapDailyMenu,
        onSuccess: async () => {
             await queryClient.invalidateQueries({ queryKey: ['menus-pool'] });
             await queryClient.invalidateQueries({ queryKey: ['menus-pool-calendar'] });
             await queryClient.invalidateQueries({ queryKey: ['menus'] });
        },
    });
};

export const useGetMenuPool = (professionalId?: number, clientId?: number, date?: string) => {
    return useQuery({
        queryKey: ['menus-pool', professionalId, clientId, date],
        queryFn: () => getMenuPool(professionalId!, clientId, date),
        enabled: !!professionalId,
    });
};

export const useGetMenuPoolCalendar = (professionalId?: number, clientId?: number, date?: string) => {
    return useQuery({
        queryKey: ['menus-pool-calendar', professionalId, clientId, date],
        queryFn: () => getMenuPoolCalendar(professionalId!, clientId, date),
        enabled: !!professionalId,
    });
};

export const useGenerateMenuAI = () => {
    return useMutation({
        mutationFn: generateMenuAI,
        onSuccess: () => {
            toast.success('Solicitud enviada para generar menú con IA');
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error, 'Error al solicitar generación con IA'));
        },
    });
};

export const useSaveMenuDraft = () => {
    return useMutation({
        mutationFn: saveMenuDraft,
        onError: () => {
            console.error('Error auto-saving draft');
        },
    });
};

export const useUpdateMenuDraft = () => {
    return useMutation({
        mutationFn: ({ id, data }: { id: number | string; data: any }) => updateMenuDraft(id, data),
        onError: () => {
            console.error('Error updating draft');
        },
    });
};
