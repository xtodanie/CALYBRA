'use client';

import { useT } from '@/i18n/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, FileText, CreditCard, GitMerge, Edit } from 'lucide-react';

interface AuditorReplayData {
  asOfDateKey: string;
  bankTxCount: number;
  invoiceCount: number;
  matchCount: number;
  adjustmentCount: number;
  generatedAt: string;
}

interface AuditorReplayCardProps {
  data: AuditorReplayData | null;
  loading?: boolean;
  onDownload?: () => void;
}

export function AuditorReplayCard({ data, loading, onDownload }: AuditorReplayCardProps) {
  const t = useT();

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
            <Shield className="h-5 w-5" />
            {t.analytics.auditor.title}
          </CardTitle>
          <CardDescription>{t.analytics.auditor.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.analytics.auditor.noEvents}</p>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: 'Bank Transactions', count: data.bankTxCount, icon: CreditCard },
    { label: 'Invoices', count: data.invoiceCount, icon: FileText },
    { label: 'Matches', count: data.matchCount, icon: GitMerge },
    { label: 'Adjustments', count: data.adjustmentCount, icon: Edit },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {t.analytics.auditor.title}
        </CardTitle>
        <CardDescription>{t.analytics.auditor.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.analytics.timeline.asOf}:</span>
          <Badge variant="outline">{data.asOfDateKey}</Badge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center rounded-md border p-3 text-center">
              <stat.icon className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xl font-semibold">{stat.count}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Generated timestamp */}
        <p className="text-xs text-muted-foreground">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </p>

        {/* Download button */}
        {onDownload && (
          <Button onClick={onDownload} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {t.analytics.auditor.download}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
