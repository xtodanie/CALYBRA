import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh overflow-x-hidden bg-gradient-app text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-brand-soft opacity-90" />
      <div className="relative z-10 min-h-svh">{children}</div>
    </div>
  );
}

export function Topbar({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-2 border-b border-border/60 bg-card/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:px-6 lg:px-8">
      {children}
    </header>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>;
}

export function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || subtitle) && (
        <div className="space-y-1">
          {title ? <h2 className="text-h2 font-semibold tracking-tight">{title}</h2> : null}
          {subtitle ? <p className="text-body text-muted-foreground">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function CardPremium({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "glass-card rounded-lg border border-border/60 bg-card/80 shadow-elevation-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevation-3",
        className
      )}
    >
      {children}
    </div>
  );
}
