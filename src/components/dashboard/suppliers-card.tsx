'use client';

import { cn } from '@/lib/utils';
import { useT, useLocale } from '@/i18n/provider';
import { formatMoney } from '@/i18n/format';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Supplier {
  name: string;
  amount: number;
  trend: number; // percentage change, positive = up
}

interface SuppliersCardProps {
  suppliers: Supplier[];
  isLoading?: boolean;
}

export function SuppliersCard({
  suppliers,
  isLoading = false,
}: SuppliersCardProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {/* Subtle inner highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-50/5 to-transparent" />
      
      <div className="p-8">
        <h3 className="mb-6 text-h3 font-semibold text-foreground">
          {t.dashboard.suppliers.title}
        </h3>

        <div className="space-y-4">
          {isLoading ? (
            // Skeleton loader
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-5 w-32" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            ))
          ) : (
            suppliers.slice(0, 5).map((supplier) => (
              <div
                key={supplier.name}
                className={cn(
                  'group flex items-center justify-between rounded-lg px-3 py-3 transition-colors',
                  'hover:bg-hover'
                )}
              >
                <span className="text-body font-medium text-foreground">
                  {supplier.name}
                </span>
                
                <div className="flex items-center gap-6">
                  <span className="text-body font-semibold text-foreground">
                    {formatMoney(supplier.amount, locale)}
                  </span>
                  
                  <div className={cn(
                    'flex items-center gap-1 text-caption font-medium',
                    supplier.trend >= 0 ? 'text-trend-up' : 'text-trend-down'
                  )}>
                    {supplier.trend >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span>
                      {supplier.trend >= 0 ? '+' : ''}{supplier.trend}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
