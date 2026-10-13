"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * First use of a request-level cache in this codebase (previously every
 * component hand-rolled its own useEffect + Supabase call with no sharing
 * between them). Scoped to the Dashboard page's widgets for now — see
 * TopStats.tsx / TeamStatusWidget.tsx for the first real usage.
 *
 * staleTime: 30s means a query result is reused as-is for 30 seconds
 * before a background refetch is even considered — short enough that
 * nothing here goes meaningfully stale, long enough to actually absorb
 * near-simultaneous requests for the same data (the whole point).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30 * 1000,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
