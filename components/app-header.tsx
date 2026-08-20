import Link from "next/link";
import { AudioLines } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "工作台" },
  { href: "/templates", label: "总结模板" },
  { href: "/settings", label: "设置" },
] as const;

export function AppHeader({ pathname }: { pathname: string }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <AudioLines className="h-4 w-4" />
          </span>
          <span>录音转写总结</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
