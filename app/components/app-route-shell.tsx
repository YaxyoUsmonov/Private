"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

const publicRoutes = new Set(["/", "/login", "/auth/callback"]);

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (publicRoutes.has(pathname)) {
    return children;
  }

  return <AppShell>{children}</AppShell>;
}
