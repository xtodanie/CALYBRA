'use client';

import { useT } from '@/i18n/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Gauge, Clock, Hand, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FrictionData {
  daysToClose: number;
  manualMatchPercent: number;
  exceptionPercent: number;
  frictionScore: number; // 0-100, lower is better
}

interface FrictionCardProps {
  data: FrictionData | null;
  loading?: boolean;
}

export function FrictionCard({ data, loading }: FrictionCardProps) {
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
            <Gauge className="h-5 w-5" />
            {t.analytics.friction.title}
          </CardTitle>
          <CardDescription>{t.analytics.friction.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No friction data available.</p>
        </CardContent>
      </Card>
    );
  }

  const getFrictionLevel = (score: number) => {
    if (score <= 30) return { label: t.analytics.friction.low, color: 'text-primary', bg: 'bg-primary/10' };
    if (score <= 60) return { label: t.analytics.friction.medium, color: 'text-warning', bg: 'bg-warning/10' };
    return { label: t.analytics.friction.high, color: 'text-destructive', bg: 'bg-destructive/10' };
  };

  const level = getFrictionLevel(data.frictionScore);

  const metrics = [
    {
      label: t.analytics.friction.daysToClose,
      value: data.daysToClose,
      unit: 'days',
      icon: Clock,
    },
    {
      label: t.analytics.friction.manualMatchPct,
      value: data.manualMatchPercent.toFixed(1),
      unit: '%',
      icon: Hand,
    },
    {
      label: t.analytics.friction.exceptionsPct,
      value: data.exceptionPercent.toFixed(1),
      unit: '%',
      icon: AlertTriangle,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          {t.analytics.friction.title}
        </CardTitle>
        <CardDescription>{t.analytics.friction.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Friction Score */}
        <div className={cn('flex items-center justify-between rounded-lg p-4', level.bg)}>
          <div>
            <p className="text-sm font-medium">{t.analytics.friction.score}</p>
            <p className={cn('text-3xl font-bold', level.color)}>{data.frictionScore}</p>
          </div>
          <Badge variant="outline" className={level.color}>
            {level.label}
          </Badge>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <metric.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-semibold">
                {metric.value}
                <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
              </p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
