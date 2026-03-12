import type { PropsWithChildren } from "react";
import {
  QueryClientProvider,
  QueryErrorResetBoundary,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { appQueryClient } from "./client";

export function AppQueryProvider({ children }: PropsWithChildren) {
  return (
    <QueryErrorResetBoundary>
      <QueryClientProvider client={appQueryClient}>
        {children}
        {import.meta.env.DEV ? (
          <ReactQueryDevtools buttonPosition="bottom-left" initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </QueryErrorResetBoundary>
  );
}
