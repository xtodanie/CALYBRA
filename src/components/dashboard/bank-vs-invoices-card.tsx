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
        <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-caption font-medium text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {t.dashboard.bankVsInvoices.reconciled}
        </span>
      );
    }
    if (status === 'critical') {
      return (
        <span className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-caption font-medium text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          {t.dashboard.bankVsInvoices.critical}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-caption font-medium text-warning">
        <span className="h-2 w-2 rounded-full bg-warning" />
        {pendingCount} {t.dashboard.bankVsInvoices.pending}
      </span>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {/* Subtle inner highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-50/5 to-transparent" />
      
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
          {/* Total Invoices */}
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              {t.dashboard.bankVsInvoices.totalInvoices}
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-h1">
              {formatMoney(totalInvoices, locale)}
            </p>
          </div>

          {/* Total Bank */}
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              {t.dashboard.bankVsInvoices.totalBankPayments}
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-h1">
              {formatMoney(totalBank, locale)}
            </p>
          </div>

          {/* Difference */}
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              {t.dashboard.bankVsInvoices.difference}
            </p>
            <p className={cn('text-2xl font-bold tracking-tight sm:text-h1', getDifferenceColor())}>
              {formatMoney(difference, locale)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="lg:ml-8">
          {getStatusBadge()}
        </div>
      </div>
    </div>
  );
}
