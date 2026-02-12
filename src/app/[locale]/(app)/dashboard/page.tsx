'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from '@/i18n/provider';
import {
  BankVsInvoicesCard,
  SuppliersCard,
  PendingItemsCard,
} from '@/components/dashboard';
import { CardPremium, PageContainer, Section } from '@/components/layout/premium-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowUpRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/i18n/format';

const SAMPLE_SUPPLIERS = [
  { name: 'Coca-Cola', amount: 1230, trend: 12 },
  { name: 'PepsiCo', amount: 980, trend: -5 },
  { name: 'Nestlé', amount: 2150, trend: 8 },
  { name: 'Danone', amount: 875, trend: 0 },
  { name: 'Unilever', amount: 1560, trend: 15 },
];

const TREND_SERIES = [
  { label: 'W1', invoices: 9200, bank: 8900 },
  { label: 'W2', invoices: 10100, bank: 9800 },
  { label: 'W3', invoices: 11050, bank: 10820 },
  { label: 'W4', invoices: 12230, bank: 12010 },
];

type ViewState = 'loading' | 'ready' | 'empty' | 'error';

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>('loading');

  const [dashboardData] = useState({
    totalInvoices: 42580,
    totalBank: 41900,
    pendingCount: 2,
    status: 'pending' as 'pending' | 'reconciled' | 'critical',
    suppliers: SAMPLE_SUPPLIERS,
    pendingItems: [
      { type: 'unpaid_invoices' as const, count: 3, critical: false },
      { type: 'payment_without_invoice' as const, count: 1, critical: true },
    ],
  });

  const difference = dashboardData.totalInvoices - dashboardData.totalBank;
  const suppliersCount = dashboardData.suppliers.length;
  const pendingItemsCount = dashboardData.pendingItems.length;

  const isHealthy = difference <= 1200;

  const activityItems = useMemo(
    () => [
      t.dashboard.activity.items.importsCompleted,
      t.dashboard.activity.items.reviewStarted,
      t.dashboard.activity.items.exceptionsUpdated,
    ],
    [t]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (suppliersCount === 0 && pendingItemsCount === 0) {
        setViewState('empty');
      } else {
        setViewState('ready');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [pendingItemsCount, suppliersCount]);

  const handlePendingItemClick = (type: string) => {
    if (type === 'unpaid_invoices') {
      router.push(`/${locale}/invoices`);
    } else {
      router.push(`/${locale}/exceptions`);
    }
  };

  if (viewState === 'loading') {
    return (
      <PageContainer>
        <div className="space-y-4 pb-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-[36rem]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
        <CardPremium className="mt-6 p-6">
          <p className="text-body text-muted-foreground">{t.dashboard.states.loading}</p>
        </CardPremium>
      </PageContainer>
    );
  }

  if (viewState === 'error') {
    return (
      <PageContainer>
        <CardPremium className="p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="inline-flex w-fit items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-caption text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {t.dashboard.states.errorTitle}
              </p>
              <p className="text-body text-muted-foreground">{t.dashboard.states.errorDescription}</p>
            </div>
            <Button onClick={() => setViewState('loading')}>{t.dashboard.states.errorCta}</Button>
          </div>
        </CardPremium>
      </PageContainer>
    );
  }

  if (viewState === 'empty') {
    return (
      <PageContainer>
        <CardPremium className="p-10 text-center">
          <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-h1 font-semibold tracking-tight">{t.dashboard.states.emptyTitle}</h1>
            <p className="text-body text-muted-foreground">{t.dashboard.states.emptyDescription}</p>
            <Button onClick={() => router.push(`/${locale}/upload`)}>{t.dashboard.states.emptyCta}</Button>
          </div>
        </CardPremium>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Section>
        <div className="space-y-2">
          <h1 className="text-h1 font-semibold tracking-tight text-foreground">{t.dashboard.hero.title}</h1>
          <p className="max-w-3xl text-body text-muted-foreground">{t.dashboard.hero.subtitle}</p>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-1 text-caption text-success">
          <CheckCircle2 className="h-4 w-4" />
          {t.dashboard.states.success}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/${locale}/upload`)}>
            {t.sidebar.upload}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/${locale}/exceptions`)}>
            {t.sidebar.exceptions}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/${locale}/month-closes`)}>
            {t.sidebar.monthCloses}
          </Button>
        </div>
      </Section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CardPremium className="p-5">
          <p className="text-caption text-muted-foreground">{t.dashboard.bankVsInvoices.totalInvoices}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-display">
            {formatMoney(dashboardData.totalInvoices, locale)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-caption text-success">
            <TrendingUp className="h-3.5 w-3.5" />
            {t.dashboard.hero.invoicesTrend}
          </p>
        </CardPremium>
        <CardPremium className="p-5">
          <p className="text-caption text-muted-foreground">{t.dashboard.bankVsInvoices.totalBankPayments}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-display">
            {formatMoney(dashboardData.totalBank, locale)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-caption text-success">
            <TrendingUp className="h-3.5 w-3.5" />
            {t.dashboard.hero.bankTrend}
          </p>
        </CardPremium>
        <CardPremium className="p-5">
          <p className="text-caption text-muted-foreground">{t.dashboard.bankVsInvoices.difference}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-warning md:text-display">
            {formatMoney(difference, locale)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-caption text-warning">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t.dashboard.hero.differenceTrend}
          </p>
        </CardPremium>
        <CardPremium className="p-5">
          <p className="text-caption text-muted-foreground">{t.dashboard.hero.status}</p>
          <p className="mt-2 inline-flex items-center rounded-md border border-border/70 bg-card/60 px-3 py-1 text-label">
            {isHealthy ? t.dashboard.hero.healthy : t.dashboard.hero.warning}
          </p>
          <Button className="mt-4 w-full" variant="outline" onClick={() => router.push(`/${locale}/month-closes`)}>
            {t.dashboard.hero.cta}
          </Button>
        </CardPremium>
      </div>

      <div className="mt-6">
        <BankVsInvoicesCard
          totalInvoices={dashboardData.totalInvoices}
          totalBank={dashboardData.totalBank}
          pendingCount={dashboardData.pendingCount}
          status={dashboardData.status}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <CardPremium className="p-6">
          <Section title={t.dashboard.bankVsInvoices.title} subtitle={t.dashboard.nav.summary}>
            <div className="mb-3 flex items-center gap-4 text-caption text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
                {t.dashboard.bankVsInvoices.totalInvoices}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
                {t.dashboard.bankVsInvoices.totalBankPayments}
              </span>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TREND_SERIES}>
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="invoices" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="bank" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </CardPremium>

        <CardPremium className="p-6">
          <Section title={t.dashboard.activity.title} subtitle={t.dashboard.activity.description}>
            <div className="space-y-3" role="list" aria-label={t.dashboard.activity.title}>
              {activityItems.map((item) => (
                <div key={item} role="listitem" className="rounded-md border border-border/70 bg-card/60 px-3 py-2 text-body">
                  {item}
                </div>
              ))}
            </div>
          </Section>
        </CardPremium>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SuppliersCard suppliers={dashboardData.suppliers} isLoading={false} />
        <PendingItemsCard items={dashboardData.pendingItems} onItemClick={handlePendingItemClick} />
      </div>
    </PageContainer>
  );
}
