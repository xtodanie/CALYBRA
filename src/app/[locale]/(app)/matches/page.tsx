'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { db, functions } from '@/lib/firebaseClient';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
// formatMoney, formatDate available for future use when displaying denormalized match data
import { MatchStatus } from '@/lib/types';
import type { Match, BankTx, Invoice } from '@/lib/types';

// Callable for transitions
const transitionMatchCallable = httpsCallable<{ matchId: string; toStatus: string }, { success: boolean; status: string }>(
  functions,
  'transitionMatch'
);

// Badge variant mapping for match status
const statusVariantMap: Record<MatchStatus, "default" | "secondary" | "outline" | "destructive"> = {
  [MatchStatus.PROPOSED]: 'outline',
  [MatchStatus.CONFIRMED]: 'default',
  [MatchStatus.REJECTED]: 'destructive',
};

// Month Context Header (uses real user data)
const MonthContextHeader = () => {
  const t = useT();
  const { user } = useAuth();

  if (!user?.activeMonthCloseId) {
    return null;
  }

  // Simple display - just show the active month ID
  // Full monthClose data would require another query
  const monthId = user.activeMonthCloseId;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">{t.monthClose.context.activeMonth}</span>
        <span className="font-semibold">{monthId}</span>
      </div>
      <Button variant="ghost" asChild>
        <Link href={`/month-closes/${monthId}`}>
          {t.monthClose.context.viewOverview} <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

// Empty state
const EmptyState = ({ message }: { message: string }) => (
  <Card>
    <CardContent className="p-8 text-center text-muted-foreground">
      {message}
    </CardContent>
  </Card>
);

// Error state
const ErrorState = ({ message }: { message: string }) => (
  <Card className="border-destructive">
    <CardContent className="p-4 flex items-center gap-2 text-destructive">
      <AlertCircle className="h-5 w-5" />
      <span>{message}</span>
    </CardContent>
  </Card>
);

// Blocking state for missing context
const BlockingState = ({ t }: { t: ReturnType<typeof useT> }) => (
  <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
    <div>
      <h1 className="font-headline text-3xl font-bold tracking-tight">{t.matches.title}</h1>
      <p className="text-muted-foreground">{t.matches.description}</p>
    </div>
    <Card className="border-amber-500">
      <CardContent className="p-4 text-amber-700">
        Please select a month close to view matches.
      </CardContent>
    </Card>
  </div>
);

// Extended match type with resolved data
interface MatchWithDetails extends Match {
  bankTxData: BankTx[];
  invoiceData: Invoice[];
}

export default function MatchesPage() {
  const t = useT();
  const { user, loading: authLoading } = useAuth();

  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioningIds, setTransitioningIds] = useState<Set<string>>(new Set());

  // Fetch matches with live subscription
  useEffect(() => {
    if (!user?.tenantId || !user?.activeMonthCloseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const matchesQuery = query(
      collection(db, 'tenants', user.tenantId, 'matches'),
      where('monthCloseId', '==', user.activeMonthCloseId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      matchesQuery,
      async (snapshot) => {
        const matchDocs: Match[] = [];
        snapshot.forEach((doc) => {
          matchDocs.push({ id: doc.id, ...doc.data() } as Match);
        });

        // For now, we'll display matches without resolving bankTx/invoice details
        // This avoids N+1 queries. In production, could use a cloud function or denormalize.
        const matchesWithDetails: MatchWithDetails[] = matchDocs.map((m) => ({
          ...m,
          bankTxData: [], // Would need separate queries to resolve
          invoiceData: [], // Would need separate queries to resolve
        }));

        setMatches(matchesWithDetails);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching matches:', err);
        setError(err.message || 'Failed to load matches');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId, user?.activeMonthCloseId]);

  // Handle confirm via callable
  const handleConfirm = useCallback(async (matchId: string) => {
    setTransitioningIds((prev) => new Set(prev).add(matchId));
    try {
      await transitionMatchCallable({ matchId, toStatus: MatchStatus.CONFIRMED });
      // UI will update via onSnapshot
    } catch (err) {
      console.error('Failed to confirm match:', err);
      // Could show a toast here
    } finally {
      setTransitioningIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  }, []);

  // Handle reject via callable
  const handleReject = useCallback(async (matchId: string) => {
    setTransitioningIds((prev) => new Set(prev).add(matchId));
    try {
      await transitionMatchCallable({ matchId, toStatus: MatchStatus.REJECTED });
      // UI will update via onSnapshot
    } catch (err) {
      console.error('Failed to reject match:', err);
      // Could show a toast here
    } finally {
      setTransitioningIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  }, []);

  // Wait for auth
  if (authLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <Skeleton className="h-10 w-48" />
        <LoadingSkeleton />
      </div>
    );
  }

  // Blocking state: no user or no activeMonthCloseId
  if (!user?.tenantId || !user?.activeMonthCloseId) {
    return <BlockingState t={t} />;
  }

  // Separate matches by status
  const proposedMatches = matches.filter((m) => m.status === MatchStatus.PROPOSED);
  const confirmedMatches = matches.filter((m) => m.status === MatchStatus.CONFIRMED);
  const rejectedMatches = matches.filter((m) => m.status === MatchStatus.REJECTED);

  const MatchTable = ({
    matchList,
    isProposed,
  }: {
    matchList: MatchWithDetails[];
    isProposed: boolean;
  }) => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return <ErrorState message={error} />;
    }

    if (matchList.length === 0) {
      return (
        <EmptyState
          message={isProposed ? t.matches.empty.proposed : t.matches.empty.confirmed}
        />
      );
    }

    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">{t.matches.table.score}</TableHead>
                <TableHead>{t.matches.table.explanation}</TableHead>
                <TableHead>{t.matches.table.bankTransaction}</TableHead>
                <TableHead>{t.matches.table.invoice}</TableHead>
                <TableHead className="text-right">{t.matches.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchList.map((match) => {
                const isTransitioning = transitioningIds.has(match.id);
                const explanationText =
                  t.matches.explanations[match.explanationKey as keyof typeof t.matches.explanations] ||
                  match.explanationKey;

                return (
                  <TableRow key={match.id}>
                    <TableCell className="text-center">
                      <Badge variant={match.score < 90 ? 'secondary' : 'default'}>
                        {match.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {explanationText}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-muted-foreground">
                        {match.bankTxIds.length} transaction(s)
                      </div>
                      <div className="text-xs">IDs: {match.bankTxIds.join(', ').substring(0, 30)}...</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-muted-foreground">
                        {match.invoiceIds.length} invoice(s)
                      </div>
                      <div className="text-xs">IDs: {match.invoiceIds.join(', ').substring(0, 30)}...</div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {isProposed ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(match.id)}
                            disabled={isTransitioning}
                          >
                            {isTransitioning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              t.matches.reject
                            )}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleConfirm(match.id)}
                            disabled={isTransitioning}
                          >
                            {isTransitioning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              t.matches.confirm
                            )}
                          </Button>
                        </>
                      ) : (
                        <Badge variant={statusVariantMap[match.status]}>
                          {match.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.matches.title}</h1>
        <p className="text-muted-foreground">{t.matches.description}</p>
      </div>

      <MonthContextHeader />

      <Tabs defaultValue="proposed">
        <TabsList>
          <TabsTrigger value="proposed">
            {t.matches.tabs.proposed} ({proposedMatches.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            {t.matches.tabs.confirmed} ({confirmedMatches.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedMatches.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="proposed">
          <MatchTable matchList={proposedMatches} isProposed={true} />
        </TabsContent>
        <TabsContent value="confirmed">
          <MatchTable matchList={confirmedMatches} isProposed={false} />
        </TabsContent>
        <TabsContent value="rejected">
          <MatchTable matchList={rejectedMatches} isProposed={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
