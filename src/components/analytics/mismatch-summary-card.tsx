'use client';

import { useT } from '@/i18n/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, CreditCard, FileText, DollarSign, TrendingUp } from 'lucide-react';

interface MismatchSummaryData {
  bankTxWithoutInvoice: readonly string[];
  invoiceMatchedWithoutBankTx: readonly string[];
  partialPayments: readonly string[];
  overpayments: readonly string[];
}

interface MismatchSummaryCardProps {
  data: MismatchSummaryData | null;
  loading?: boolean;
}

export function MismatchSummaryCard({ data, loading }: MismatchSummaryCardProps) {
  const t = useT();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t.analytics.mismatch.title}
          </CardTitle>
          <CardDescription>{t.analytics.mismatch.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.analytics.mismatch.noMismatches}</p>
        </CardContent>
      </Card>
    );
  }

  const totalGaps =
    data.bankTxWithoutInvoice.length +
    data.invoiceMatchedWithoutBankTx.length +
    data.partialPayments.length +
    data.overpayments.length;

  if (totalGaps === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            {t.analytics.mismatch.title}
          </CardTitle>
          <CardDescription>{t.analytics.mismatch.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{t.analytics.mismatch.noMismatches}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const gaps = [
    {
      label: t.analytics.mismatch.bankWithoutInvoice,
      count: data.bankTxWithoutInvoice.length,
      icon: CreditCard,
      variant: 'destructive' as const,
    },
    {
      label: t.analytics.mismatch.invoiceWithoutBank,
      count: data.invoiceMatchedWithoutBankTx.length,
      icon: FileText,
      variant: 'destructive' as const,
    },
    {
      label: t.analytics.mismatch.partialPayments,
      count: data.partialPayments.length,
      icon: DollarSign,
      variant: 'secondary' as const,
    },
    {
      label: t.analytics.mismatch.overpayments,
      count: data.overpayments.length,
      icon: TrendingUp,
      variant: 'secondary' as const,
    },
  ].filter((g) => g.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          {t.analytics.mismatch.title}
          <Badge variant="outline" className="ml-2">{totalGaps}</Badge>
        </CardTitle>
        <CardDescription>{t.analytics.mismatch.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {gaps.map((gap) => (
            <div key={gap.label} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <gap.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{gap.label}</span>
              </div>
              <Badge variant={gap.variant}>{gap.count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
