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

export function AppSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { href: "/dashboard", icon: CalendarClock, label: "Month Closes", active: pathname === '/dashboard' },
    { href: "/upload", icon: UploadCloud, label: "Upload", active: pathname.startsWith("/upload") },
    { href: "/matches", icon: CopyCheck, label: "Matches", active: pathname.startsWith("/matches") },
    { href: "/exceptions", icon: AlertTriangle, label: "Exceptions", active: pathname.startsWith("/exceptions") },
    { href: "/exports", icon: DownloadCloud, label: "Exports", active: pathname.startsWith("/exports") },
    { href: "/settings", icon: Settings, label: "Settings", active: pathname.startsWith("/settings") },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
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
              Guest User
            </p>
            <p className="truncate text-xs text-sidebar-foreground">
              guest@example.com
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
