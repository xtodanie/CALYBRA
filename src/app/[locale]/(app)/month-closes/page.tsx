'use client';
import Link from 'next/link';
import { Loader2, Lock, PlusCircle, RefreshCw } from 'lucide-react';
import { useT, useLocale } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { formatMoney, formatDate } from '@/i18n/format';
import { Button } from '@/components/ui/button';
import { CardPremium, PageContainer, Section } from '@/components/layout/premium-shell';
import { Badge } from '@/components/ui/badge';
import { CreateMonthCloseDialog } from '@/components/month-close/create-month-close-dialog';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { MonthClose } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseClient';
import { useToast } from '@/hooks/use-toast';

const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: 'outline',
  IN_REVIEW: 'default',
  FINALIZED: 'secondary',
};

export default function MonthClosesPage() {
  const t = useT();
  const locale = useLocale();
  const { user, setActiveMonthClose } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [selectedToLock, setSelectedToLock] = useState<MonthClose | null>(null);
  const [closes, setCloses] = useState<MonthClose[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [lockingMonthId, setLockingMonthId] = useState<string | null>(null);
  const [recomputingMonthId, setRecomputingMonthId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const q = query(
      collection(db, 'tenants', user.tenantId, 'monthCloses'),
      orderBy('periodStart', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: MonthClose[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as MonthClose));
        setCloses(data);
        setLoadingError(null);
        setIsLoading(false);
      },
      (error) => {
        console.error('MonthCloses subscription error:', error);
        setLoadingError(error.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSetActive = (id: string) => {
    setActiveMonthClose(id);
  };

  const getCloseProgress = (close: MonthClose) => {
    if (close.status === 'FINALIZED') return 100;
    if (close.status === 'IN_REVIEW') {
      if (close.openExceptionsCount === 0) return 85;
      return 72;
    }

    return 36;
  };

  const handleRecompute = async (close: MonthClose) => {
    setRecomputingMonthId(close.id);
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast({ title: t.monthCloses.actions.recomputed });
    setRecomputingMonthId(null);
  };

  const handleLock = async () => {
    if (!selectedToLock) {
      return;
    }

    setLockingMonthId(selectedToLock.id);
    try {
      const transitionMonthClose = httpsCallable(functions, 'transitionMonthClose');
      await transitionMonthClose({ monthCloseId: selectedToLock.id, toStatus: 'FINALIZED' });
      toast({ title: t.monthCloses.actions.lockSuccess });
      setShowLockDialog(false);
      setSelectedToLock(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.monthCloses.actions.lockError;
      toast({
        variant: 'destructive',
        title: t.monthCloses.actions.lockError,
        description: message,
      });
    } finally {
      setLockingMonthId(null);
    }
  };

  return (
    <PageContainer>
      <Section>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">{t.monthCloses.title}</h1>
            <p className="text-muted-foreground">{t.monthCloses.description}</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="transition-transform hover:scale-[1.02]">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.monthCloses.cta}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${locale}/upload`}>{t.sidebar.upload}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/dashboard`}>{t.sidebar.dashboard}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/exceptions`}>{t.sidebar.exceptions}</Link>
          </Button>
        </div>
      </Section>

      <CreateMonthCloseDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <CardPremium key={idx} className="p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-4 w-20" />
              <Skeleton className="mt-5 h-2 w-full" />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </CardPremium>
          ))}
        </div>
      ) : loadingError ? (
        <CardPremium className="p-8">
          <h2 className="text-h3 font-semibold">{t.monthCloses.errors.title}</h2>
          <p className="mt-2 text-muted-foreground">{t.monthCloses.errors.description}</p>
          <p className="mt-1 text-caption text-destructive">{loadingError}</p>
        </CardPremium>
      ) : closes.length === 0 ? (
        <CardPremium className="p-10 text-center">
          <h2 className="text-h2 font-semibold tracking-tight">{t.monthCloses.empty.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-body text-muted-foreground">{t.monthCloses.empty.description}</p>
          <Button onClick={() => setShowCreateDialog(true)} className="mt-6">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.monthCloses.cta}
          </Button>
        </CardPremium>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {closes.map((close) => {
            const isActive = user?.activeMonthCloseId === close.id;
            const isFinalized = close.status === 'FINALIZED';
            const progress = getCloseProgress(close);

            return (
              <CardPremium key={close.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-h3 font-semibold">
                      {formatDate(close.periodStart.toDate(), locale, { month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-caption text-muted-foreground">
                      {formatDate(close.periodStart.toDate(), locale)} - {formatDate(close.periodEnd.toDate(), locale)}
                    </p>
                    <Badge variant={statusVariantMap[close.status]}>
                      {t.monthCloses.status[close.status as keyof typeof t.monthCloses.status]}
                    </Badge>
                  </div>
                  {isActive ? <Badge variant="secondary">{t.monthCloses.active}</Badge> : null}
                </div>

                <div className="mt-4">
                  <Progress value={progress} aria-label={t.monthCloses.progressLabel} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/70 bg-card/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.monthCloses.table.difference}</p>
                    <p className="mt-1 text-label font-semibold">{formatMoney(close.diff, locale)}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-card/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.monthCloses.table.exceptions}</p>
                    <p className="mt-1 text-label font-semibold">{close.openExceptionsCount}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="focus-visible:ring-2 focus-visible:ring-ring" asChild>
                    <Link href={`/${locale}/month-closes/${close.id}`}>{t.monthCloses.actions.view}</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleRecompute(close)}
                    disabled={recomputingMonthId === close.id}
                  >
                    {recomputingMonthId === close.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {t.monthCloses.actions.recompute}
                  </Button>
                  <Button
                    size="sm"
                    className="focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setSelectedToLock(close);
                      setShowLockDialog(true);
                    }}
                    disabled={isFinalized || lockingMonthId === close.id}
                  >
                    {lockingMonthId === close.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                    {t.monthCloses.actions.lock}
                  </Button>
                  {!isActive ? (
                    <Button size="sm" variant="ghost" className="focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleSetActive(close.id)}>
                      {t.monthCloses.setActive}
                    </Button>
                  ) : null}
                </div>
              </CardPremium>
            );
          })}
        </div>
      )}

      <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.monthCloses.lockModal.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.monthCloses.lockModal.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.monthCloses.lockModal.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLock} disabled={!!lockingMonthId}>
              {lockingMonthId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.monthCloses.lockModal.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
