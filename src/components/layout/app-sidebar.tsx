
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
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
import { useT } from "@/i18n/provider";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "../ui/skeleton";

export function AppSidebar() {
  const pathname = usePathname();
  const t = useT();
  const { user, loading } = useAuth();

  const menuItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t.sidebar.dashboard, active: pathname.includes("/dashboard") },
    { href: "/month-closes", icon: CalendarClock, label: t.sidebar.monthCloses, active: pathname.includes("/month-closes") },
    { href: "/upload", icon: UploadCloud, label: t.sidebar.upload, active: pathname.includes("/upload") },
    { href: "/invoices", icon: FileText, label: t.sidebar.invoices, active: pathname.includes("/invoices") },
    { href: "/matches", icon: CopyCheck, label: t.sidebar.matches, active: pathname.includes("/matches") },
    { href: "/exceptions", icon: AlertTriangle, label: t.sidebar.exceptions, active: pathname.includes("/exceptions") },
    { href: "/exports", icon: DownloadCloud, label: t.sidebar.exports, active: pathname.includes("/exports") },
    { href: "/settings", icon: Settings, label: t.sidebar.settings, active: pathname.includes("/settings") },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard"><Logo /></Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map(({ href, icon: Icon, label, active }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton asChild isActive={active} tooltip={label}>
                <Link href={href}>
                  <Icon />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-0">
        <Separator className="mx-0 mb-2 w-full bg-sidebar-border" />
        <div className="flex items-center gap-3 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user?.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          {loading ? (
             <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
             </div>
          ) : (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {user?.email}
              </p>
              <p className="truncate text-xs text-sidebar-foreground">
                {t.roles[user?.role as keyof typeof t.roles] || user?.role}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
