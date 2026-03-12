import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { createAppQueryClient } from "@/shared/query";

export function createTestQueryClient() {
  return createAppQueryClient();
}

export function createQueryClientWrapper(queryClient = createTestQueryClient()) {
  return function QueryClientWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

export { QueryClient };
