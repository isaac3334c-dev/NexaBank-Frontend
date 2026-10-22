import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Installed now per project phasing (see docs/DECISIONS.md) — not wired to
// any real fetching yet. Defaults are conservative so when real queries are
// added later they don't unexpectedly refetch aggressively on a mobile
// connection.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
