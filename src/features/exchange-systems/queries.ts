import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
import { IExchangeSystem } from "./types";

export const useGetExchangeSystems = () => {
    return useQuery<IExchangeSystem[], Error>({
        queryKey: ["exchange-systems"],
        queryFn: api.getExchangeSystems,
    });
};

export const useGetExchangeSystem = (id: number) => {
    return useQuery<IExchangeSystem, Error>({
        queryKey: ["exchange-systems", id],
        queryFn: () => api.getExchangeSystem(id),
        enabled: !!id,
    });
};
