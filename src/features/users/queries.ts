import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, getUserById, getUsers, updateUser, updateProfilePicture, lookupPhone, validatePhone } from "./api";
import { IUserProfessionalClient } from "./types";

export const useUsers = () => {
    return useQuery<IUserProfessionalClient[], Error>({
        queryKey: ["users"],
        queryFn: getUsers,
    });
};

export const useUser = (id?: number) => {
    return useQuery<IUserProfessionalClient, Error>({
        queryKey: ["users", id],
        //@ts-ignore
        queryFn: () => getUserById(id!),
        enabled: !!id && id > 0,
    });
};

export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["professional-clients"] });
        },
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<IUserProfessionalClient> }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
};

export const useUpdateProfilePicture = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateProfilePicture,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
};

export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
};

export const useValidatePhone = () => {
    const mutation = useMutation({
        mutationFn: async (phoneNumber: string) => {
            const users = await getUsers();
            const exists = users.some(u => u.phone_number?.replace(/\s+/g, '') === phoneNumber.replace(/\s+/g, ''));
            
            if (exists) {
                throw new Error("El número de teléfono ya está registrado con otro usuario.");
            }
            
            return validatePhone(phoneNumber);
        },
    });

    return mutation;
};

export const useLookupPhone = () => {
    const mutation = useMutation({
        mutationFn: (phoneNumber: string) => lookupPhone(phoneNumber),
    });

    return mutation;
};
