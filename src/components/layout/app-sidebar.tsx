
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import {
  Settings,
  CalendarClock,
  UploadCloud,
  CopyCheck,
  AlertTriangle,
  DownloadCloud,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const t = useT();
  const locale = useLocale();
  const { user, loading } = useAuth();

  const operationsItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t.sidebar.dashboard, active: pathname.includes("/dashboard") },
    { href: "/month-closes", icon: CalendarClock, label: t.sidebar.monthCloses, active: pathname.includes("/month-closes") },
    { href: "/upload", icon: UploadCloud, label: t.sidebar.upload, active: pathname.includes("/upload") },
  ];

  const accountingItems = [
    { href: "/invoices", icon: FileText, label: t.sidebar.invoices, active: pathname.includes("/invoices") },
    { href: "/matches", icon: CopyCheck, label: t.sidebar.matches, active: pathname.includes("/matches") },
    { href: "/exceptions", icon: AlertTriangle, label: t.sidebar.exceptions, active: pathname.includes("/exceptions") },
    { href: "/exports", icon: DownloadCloud, label: t.sidebar.exports, active: pathname.includes("/exports") },
    { href: "/settings", icon: Settings, label: t.sidebar.settings, active: pathname.includes("/settings") },
  ];

  return (
    <aside className="h-full w-[var(--app-sidebar-collapsed)] border-r border-border bg-sidebar md:w-[var(--app-sidebar-expanded)]">
      <div className="flex h-full flex-col">
      <div className="p-3 pb-2">
        <Link href={`/${locale}/dashboard`} className="rounded-md p-1 transition-transform duration-200 hover:scale-[1.01]">
          <Logo />
        </Link>
        <div className="h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-2">
        <div className="space-y-2">
          <p className="hidden px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70 md:block">
            {t.sidebar.groups.workspace}
          </p>
          <nav className="space-y-1">
            {operationsItems.map(({ href, icon: Icon, label, active }) => (
              <Link
                key={href}
                href={`/${locale}${href}`}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground transition-all duration-200 hover:scale-[1.01] hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground md:justify-start",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-elevation-2 ring-1 ring-sidebar-ring/60"
                )}
                aria-label={label}
              >
                    <Icon />
                    <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-2">
          <p className="hidden px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70 md:block">
            {t.sidebar.groups.finance}
          </p>
        <nav className="space-y-1">
          {accountingItems.map(({ href, icon: Icon, label, active }) => (
            <Link
              key={href}
              href={`/${locale}${href}`}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground transition-all duration-200 hover:scale-[1.01] hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground md:justify-start",
                active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-elevation-2 ring-1 ring-sidebar-ring/60"
              )}
              aria-label={label}
            >
                  <Icon />
                  <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>
        </div>
      </div>
      <div className="p-0">
        <Separator className="mx-0 mb-2 w-full bg-sidebar-border/80" />
        <div className="flex items-center justify-center gap-3 p-3 md:justify-start">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user?.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          {loading ? (
             <div className="hidden space-y-1 md:block">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
             </div>
          ) : (
            <div className="hidden overflow-hidden md:block">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {user?.email}
              </p>
              <p className="truncate text-xs text-sidebar-foreground">
                {t.roles[user?.role as keyof typeof t.roles] || user?.role}
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </aside>
  );
}
