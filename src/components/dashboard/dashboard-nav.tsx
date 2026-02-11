'use client';

import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';

interface DashboardNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DashboardNav({ activeTab, onTabChange }: DashboardNavProps) {
  const t = useT();

  const tabs = [
    { id: 'summary', label: t.dashboard.nav.summary },
    { id: 'reconciled', label: t.dashboard.nav.reconciled },
    { id: 'pending', label: t.dashboard.nav.pending },
    { id: 'download', label: t.dashboard.nav.download },
    { id: 'business', label: t.dashboard.nav.myBusiness },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-border/50 bg-secondary px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'relative px-4 py-4 text-label font-medium transition-colors',
            'hover:text-foreground',
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted-foreground'
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute inset-x-4 -bottom-px h-0.5 bg-primary shadow-[0_0_8px_rgba(31,143,106,0.4)]" />
          )}
        </button>
      ))}
    </nav>
  );
}
