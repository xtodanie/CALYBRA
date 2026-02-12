'use client';

import { useT, useLocale } from '@/i18n/provider';
import { formatMoney } from '@/i18n/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, Lightbulb } from 'lucide-react';

interface TimelineEntry {
  asOfDay: number | null;
  asOfDate: string;
  revenueCents: number;
  expenseCents: number;
  vatCents: number;
  unmatchedBankCount: number;
  unmatchedInvoiceCount: number;
  unmatchedTotalCount: number;
}

interface TimelineData {
  periodEnd: string;
  asOfDays: readonly number[];
  entries: readonly TimelineEntry[];
  insights: readonly string[];
}

interface TimelineCardProps {
  data: TimelineData | null;
  loading?: boolean;
}

export function TimelineCard({ data, loading }: TimelineCardProps) {
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
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.analytics.timeline.title}
          </CardTitle>
          <CardDescription>{t.analytics.timeline.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.analytics.timeline.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const centsToMoney = (cents: number) => formatMoney(cents / 100, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t.analytics.timeline.title}
        </CardTitle>
        <CardDescription>{t.analytics.timeline.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timeline table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.analytics.timeline.dayLabel}</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-center">Unmatched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => (
                <TableRow key={entry.asOfDate}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {entry.asOfDay === null ? 'Final' : `${t.analytics.timeline.dayLabel} ${entry.asOfDay}`}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.asOfDate}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-primary">{centsToMoney(entry.revenueCents)}</TableCell>
                  <TableCell className="text-right text-destructive">{centsToMoney(entry.expenseCents)}</TableCell>
                  <TableCell className="text-right">{centsToMoney(entry.vatCents)}</TableCell>
                  <TableCell className="text-center">
                    {entry.unmatchedTotalCount > 0 ? (
                      <Badge variant="destructive">{entry.unmatchedTotalCount}</Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">{t.analytics.timeline.insights}</span>
            </div>
            <ul className="space-y-1">
              {data.insights.map((insight, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">• {insight}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
