'use client';

import { cn } from '@/lib/utils';
import { useT, useLocale } from '@/i18n/provider';
import { formatMoney } from '@/i18n/format';

interface BankVsInvoicesCardProps {
  totalInvoices: number;
  totalBank: number;
  pendingCount?: number;
  status?: 'pending' | 'reconciled' | 'critical';
}

export function BankVsInvoicesCard({
  totalInvoices,
  totalBank,
  pendingCount = 0,
  status = 'pending',
}: BankVsInvoicesCardProps) {
  const t = useT();
  const locale = useLocale();
  const difference = totalInvoices - totalBank;

  const getDifferenceColor = () => {
    if (status === 'reconciled') return 'text-primary';
    if (status === 'critical') return 'text-destructive';
    return 'text-warning';
  };

  const getStatusBadge = () => {
    if (status === 'reconciled') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-meta font-medium text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {t.dashboard.bankVsInvoices.reconciled}
        </span>
      );
    }
    if (status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-meta font-medium text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          {t.dashboard.bankVsInvoices.critical}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-meta font-medium text-warning">
        <span className="h-2 w-2 rounded-full bg-warning" />
        {pendingCount} {t.dashboard.bankVsInvoices.pending}
      </span>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Subtle inner highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      
      <div className="flex items-center justify-between p-8">
        <div className="grid flex-1 grid-cols-3 gap-8">
          {/* Total Invoices */}
          <div className="space-y-2">
            <p className="text-label text-muted-foreground">
              {t.dashboard.bankVsInvoices.totalInvoices}
            </p>
            <p className="text-money-md font-bold tracking-tight text-foreground">
              {formatMoney(totalInvoices, locale)}
            </p>
          </div>

          {/* Total Bank */}
          <div className="space-y-2">
            <p className="text-label text-muted-foreground">
              {t.dashboard.bankVsInvoices.totalBankPayments}
            </p>
            <p className="text-money-md font-bold tracking-tight text-foreground">
              {formatMoney(totalBank, locale)}
            </p>
          </div>

          {/* Difference */}
          <div className="space-y-2">
            <p className="text-label text-muted-foreground">
              {t.dashboard.bankVsInvoices.difference}
            </p>
            <p className={cn('text-money-md font-bold tracking-tight', getDifferenceColor())}>
              {formatMoney(difference, locale)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="ml-8">
          {getStatusBadge()}
        </div>
      </div>
    </div>
  );
}
