"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useT, useLocale } from '@/i18n/provider';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function ProvisioningErrorDisplay() {
  const t = useT();
  const { retryProvisioning, logout } = useAuth();
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <h1 className="font-headline text-3xl font-bold tracking-tight">
        {t.auth.provisioning.title}
      </h1>
      <p className="max-w-md text-muted-foreground">
        {t.auth.provisioning.description}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => retryProvisioning()}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t.auth.provisioning.retry}
        </Button>
        <Button variant="outline" onClick={() => logout()}>
          {t.auth.provisioning.logout}
        </Button>
      </div>
    </div>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, provisioningError } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !user && !provisioningError) {
      router.replace(`/${locale}/login`);
    }
  }, [user, loading, provisioningError, router, locale]);

  if (provisioningError) {
    return <ProvisioningErrorDisplay />;
  }

  if (loading || !user) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-8">
           <LanguageSwitcher />
           <UserNav />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
