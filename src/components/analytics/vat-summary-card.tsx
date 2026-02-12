'use client';

import { useT, useLocale } from '@/i18n/provider';
import { formatMoney } from '@/i18n/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt } from 'lucide-react';

interface VatBucket {
  rate: number;
  baseAmountCents: number;
  vatAmountCents: number;
}

interface VatSummaryData {
  collectedVatCents: number;
  paidVatCents: number;
  netVatCents: number;
  buckets: readonly VatBucket[];
  currency: string;
}

interface VatSummaryCardProps {
  data: VatSummaryData | null;
  loading?: boolean;
}

export function VatSummaryCard({ data, loading }: VatSummaryCardProps) {
  const t = useT();
  const locale = useLocale();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t.analytics.vatSummary.title}
          </CardTitle>
          <CardDescription>{t.analytics.vatSummary.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.analytics.vatSummary.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const centsToMoney = (cents: number) => formatMoney(cents / 100, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {t.analytics.vatSummary.title}
        </CardTitle>
        <CardDescription>{t.analytics.vatSummary.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t.analytics.vatSummary.collected}</p>
            <p className="text-xl font-semibold text-foreground">{centsToMoney(data.collectedVatCents)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t.analytics.vatSummary.paid}</p>
            <p className="text-xl font-semibold text-foreground">{centsToMoney(data.paidVatCents)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t.analytics.vatSummary.net}</p>
            <p className={`text-xl font-semibold ${data.netVatCents >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {centsToMoney(data.netVatCents)}
            </p>
          </div>
        </div>

        {/* Buckets table */}
        {data.buckets.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">{t.analytics.vatSummary.byRate}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.buckets.map((bucket) => (
                  <TableRow key={bucket.rate}>
                    <TableCell>{bucket.rate}%</TableCell>
                    <TableCell className="text-right">{centsToMoney(bucket.baseAmountCents)}</TableCell>
                    <TableCell className="text-right">{centsToMoney(bucket.vatAmountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
