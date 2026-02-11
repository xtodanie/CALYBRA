'use client';

import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';
import { ChevronRight, FileWarning, Receipt } from 'lucide-react';

interface PendingItem {
  type: 'unpaid_invoices' | 'payment_without_invoice';
  count: number;
  critical?: boolean;
}

interface PendingItemsCardProps {
  items: PendingItem[];
  onItemClick?: (type: string) => void;
}

export function PendingItemsCard({ items, onItemClick }: PendingItemsCardProps) {
  const t = useT();

  const getItemLabel = (item: PendingItem) => {
    if (item.type === 'unpaid_invoices') {
      return `${item.count} ${t.dashboard.pendingItems.unpaidInvoices}`;
    }
    if (item.count === 1) {
      return `${item.count} ${t.dashboard.pendingItems.paymentsWithoutInvoice}`;
    }
    return `${item.count} ${t.dashboard.pendingItems.paymentsWithoutInvoicePlural}`;
  };

  const getItemIcon = (type: string) => {
    if (type === 'unpaid_invoices') {
      return <FileWarning className="h-4 w-4" />;
    }
    return <Receipt className="h-4 w-4" />;
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Subtle inner highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      
      <div className="p-8">
        <h3 className="mb-6 text-card-title font-semibold text-foreground">
          {t.dashboard.pendingItems.title}
        </h3>

        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.type}
              onClick={() => onItemClick?.(item.type)}
              className={cn(
                'group relative flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors',
                'hover:bg-hover'
              )}
            >
              {/* Critical indicator line */}
              {item.critical && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-destructive" />
              )}

              <div className="flex items-center gap-3">
                <span className={cn(
                  'text-muted-foreground',
                  item.critical && 'text-destructive'
                )}>
                  {getItemIcon(item.type)}
                </span>
                <span className={cn(
                  'text-body font-medium',
                  item.critical ? 'text-destructive' : 'text-foreground'
                )}>
                  {getItemLabel(item)}
                </span>
              </div>
              
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}

          {items.length === 0 && (
            <p className="py-4 text-center text-label text-muted-foreground">
              No pending items
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
