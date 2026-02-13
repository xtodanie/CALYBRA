'use client';

import { useT } from '@/i18n/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, ShieldCheck } from 'lucide-react';

interface FlightRecorderProjection {
  supplierCostDrift: number;
  supplierReliabilityScore: number;
  exceptionFrequencyTrend: number;
  bankReconciliationStabilityScore: number;
}

interface FlightRecorderEntry {
  decisionId: string;
  contextHash: string;
  policyVersion: string;
  projection: FlightRecorderProjection;
  deterministicAction: string;
  aiAction: string;
  whyFired: string;
  changedFromPrevious: string[];
}

interface FlightRecorderData {
  activePolicyVersion: string;
  generatedAt: string;
  timeline: FlightRecorderEntry[];
}

interface FlightRecorderCardProps {
  data: FlightRecorderData | null;
  loading?: boolean;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function FlightRecorderCard({ data, loading }: FlightRecorderCardProps) {
  const t = useT();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t.analytics.flightRecorder.title}
          </CardTitle>
          <CardDescription>{t.analytics.flightRecorder.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.analytics.flightRecorder.noData}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = data.timeline[data.timeline.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t.analytics.flightRecorder.title}
        </CardTitle>
        <CardDescription>{t.analytics.flightRecorder.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{data.activePolicyVersion}</Badge>
            <span className="text-muted-foreground">{t.analytics.flightRecorder.generatedAt}: {new Date(data.generatedAt).toLocaleString()}</span>
          </div>
          <p className="mt-2 text-muted-foreground">{t.analytics.flightRecorder.why}: {latest?.whyFired}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{t.analytics.flightRecorder.ruleVsAi}</p>
            <p className="text-muted-foreground">Rule: {latest?.deterministicAction}</p>
            <p className="text-muted-foreground">AI: {latest?.aiAction}</p>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{t.analytics.flightRecorder.projections}</p>
            <p className="text-muted-foreground">Cost drift: {pct(latest?.projection.supplierCostDrift ?? 0)}</p>
            <p className="text-muted-foreground">Reliability: {pct(latest?.projection.supplierReliabilityScore ?? 0)}</p>
            <p className="text-muted-foreground">Exceptions trend: {pct(latest?.projection.exceptionFrequencyTrend ?? 0)}</p>
            <p className="text-muted-foreground">Reco stability: {pct(latest?.projection.bankReconciliationStabilityScore ?? 0)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{t.analytics.flightRecorder.timeline}</p>
          <ScrollArea className="h-48 rounded-md border p-2">
            <div className="space-y-2">
              {[...data.timeline].reverse().map((entry) => (
                <div key={entry.decisionId} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{entry.decisionId}</p>
                  <p className="text-muted-foreground">policy={entry.policyVersion} • context={entry.contextHash.slice(0, 16)}</p>
                  <p className="text-muted-foreground">{t.analytics.flightRecorder.whatChanged}: {entry.changedFromPrevious.length ? entry.changedFromPrevious.join(', ') : 'none'}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
