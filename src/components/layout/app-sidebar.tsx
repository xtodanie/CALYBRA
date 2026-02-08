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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";
import {
  Settings,
  CalendarClock,
  UploadCloud,
  CopyCheck,
  AlertTriangle,
  DownloadCloud,
} from "lucide-react";
import { useT } from "@/i18n/provider";

export function AppSidebar() {
  const pathname = usePathname();
  const t = useT();

  const menuItems = [
    { href: "/month-closes", icon: CalendarClock, label: t.sidebar.monthCloses, active: pathname.includes("/month-closes") },
    { href: "/upload", icon: UploadCloud, label: t.sidebar.upload, active: pathname.includes("/upload") },
    { href: "/matches", icon: CopyCheck, label: t.sidebar.matches, active: pathname.includes("/matches") },
    { href: "/exceptions", icon: AlertTriangle, label: t.sidebar.exceptions, active: pathname.includes("/exceptions") },
    { href: "/exports", icon: DownloadCloud, label: t.sidebar.exports, active: pathname.includes("/exports") },
    { href: "/settings", icon: Settings, label: t.sidebar.settings, active: pathname.includes("/settings") },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/month-closes"><Logo /></Link>
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
            <AvatarImage
              src="https://picsum.photos/seed/user/40/40"
              alt="User"
            />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {t.userNav.guestUser}
            </p>
            <p className="truncate text-xs text-sidebar-foreground">
              {t.userNav.guestEmail}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
