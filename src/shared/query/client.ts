import { QueryClient } from "@tanstack/react-query";

const ONE_MINUTE = 60 * 1000;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * ONE_MINUTE,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 30 * ONE_MINUTE,
      },
    },
  });
}

export const appQueryClient = createAppQueryClient();
