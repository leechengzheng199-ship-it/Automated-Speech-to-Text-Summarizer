"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppHeader } from "@/components/app-header";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader pathname={pathname} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
