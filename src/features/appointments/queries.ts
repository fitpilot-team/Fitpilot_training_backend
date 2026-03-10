
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteAppointment, getAppointments, insertAppointment, updateAppointment, startConsultation, finishConsultation, createAppointmentDraft, updateAppointmentDraft, getAppointmentDraft } from "./api";
import { IAppointment, CreateAppointmentDraftRequest, UpdateAppointmentDraftRequest } from "./types";


export const useGetAppointments = (professionalId: number | string) => {
    return useQuery<IAppointment[], Error>({
        queryKey: ["appointments", professionalId],
        queryFn: () => getAppointments(professionalId),
        enabled: !!professionalId,
        staleTime: 1000 * 60 * 5,
    });
};

export const useInsertAppointment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (appointmentData: Partial<IAppointment>) => insertAppointment(appointmentData),
        onSuccess: () => {
            // Invalidate the appointments query to refetch the data
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
    });
};

export const useDeleteAppointment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => deleteAppointment(id),
        onSuccess: () => {
            // Invalidate the appointments query to refetch the data
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
    });
};

export const useUpdateAppointment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<IAppointment> }) => updateAppointment(id, data),
        onSuccess: () => {
            // Invalidate the appointments query to refetch the data
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
    });
};

export const useStartConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => startConsultation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
    });
};

export const useFinishConsultation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, durationSeconds, notes }: { id: number; durationSeconds: number; notes?: string }) =>
            finishConsultation(id, durationSeconds, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
    });
};

export const useCreateAppointmentDraft = () => {
    return useMutation({
        mutationFn: (data: CreateAppointmentDraftRequest) => createAppointmentDraft(data),
    });
};

export const useUpdateAppointmentDraft = () => {
    return useMutation({
        mutationFn: ({ appointmentId, data }: { appointmentId: number; data: UpdateAppointmentDraftRequest }) => 
            updateAppointmentDraft(appointmentId, data),
    });
};

export const useGetAppointmentDraft = (appointmentId: number) => {
    return useQuery({
        queryKey: ["appointment-draft", appointmentId],
        queryFn: () => getAppointmentDraft(appointmentId),
        enabled: !!appointmentId,
        retry: false
    });
};
