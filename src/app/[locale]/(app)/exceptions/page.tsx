'use client';
import { useEffect, useState, useCallback } from 'react';
import { useT } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { db, functions } from '@/lib/firebaseClient';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ExceptionKind, ExceptionSeverity, ExceptionStatus } from '@/lib/types';
import type { Exception } from '@/lib/types';

// Callable for resolving exceptions
const resolveExceptionCallable = httpsCallable<
  { exceptionId: string; action: { type: string; reason?: string } },
  { success: boolean }
>(functions, 'resolveException');

// Map severity to badge variant
const severityVariantMap: Record<ExceptionSeverity, "destructive" | "default" | "outline"> = {
  [ExceptionSeverity.HIGH]: 'destructive',
  [ExceptionSeverity.MEDIUM]: 'default',
  [ExceptionSeverity.LOW]: 'outline',
};

// Map kind to i18n key
const kindToI18nKey: Record<ExceptionKind, string> = {
  [ExceptionKind.BANK_NO_INVOICE]: 'BANK_NO_INVOICE',
  [ExceptionKind.INVOICE_NO_BANK]: 'INVOICE_NO_BANK',
  [ExceptionKind.AMOUNT_MISMATCH]: 'AMOUNT_MISMATCH',
  [ExceptionKind.DUPLICATE]: 'DUPLICATE',
  [ExceptionKind.AMBIGUOUS]: 'AMBIGUOUS',
  [ExceptionKind.UNKNOWN_SUPPLIER]: 'UNKNOWN_SUPPLIER',
};

// Month Context Header (uses real user data)
const MonthContextHeader = () => {
  const t = useT();
  const { user } = useAuth();

  if (!user?.activeMonthCloseId) {
    return null;
  }

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
      <h1 className="font-headline text-3xl font-bold tracking-tight">{t.exceptions.title}</h1>
      <p className="text-muted-foreground">{t.exceptions.description}</p>
    </div>
    <Card className="border-amber-500">
      <CardContent className="p-4 text-amber-700">
        Please select a month close to view exceptions.
      </CardContent>
    </Card>
  </div>
);

export default function ExceptionsPage() {
  const t = useT();
  const { user, loading: authLoading } = useAuth();

  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  // Fetch exceptions with live subscription
  useEffect(() => {
    if (!user?.tenantId || !user?.activeMonthCloseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Exceptions are in a root-level collection with tenantId filter
    const exceptionsQuery = query(
      collection(db, 'exceptions'),
      where('tenantId', '==', user.tenantId),
      where('monthCloseId', '==', user.activeMonthCloseId),
      where('status', '==', ExceptionStatus.OPEN),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      exceptionsQuery,
      (snapshot) => {
        const exceptionDocs: Exception[] = [];
        snapshot.forEach((doc) => {
          exceptionDocs.push({ id: doc.id, ...doc.data() } as Exception);
        });
        setExceptions(exceptionDocs);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching exceptions:', err);
        setError('Failed to load exceptions. Please try again.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId, user?.activeMonthCloseId]);

  // Resolve exception handler
  const handleResolve = useCallback(async (exceptionId: string, actionType: string, reason?: string) => {
    setResolvingIds((prev) => new Set(prev).add(exceptionId));
    try {
      await resolveExceptionCallable({
        exceptionId,
        action: { type: actionType, ...(reason ? { reason } : {}) },
      });
      // Exception will be removed from list via onSnapshot
    } catch (err) {
      console.error('Error resolving exception:', err);
      setError('Failed to resolve exception. Please try again.');
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(exceptionId);
        return next;
      });
    }
  }, []);

  // Get label for exception kind
  const getKindLabel = (kind: ExceptionKind): string => {
    const key = kindToI18nKey[kind];
    // Try to get from i18n, fallback to formatted kind
    const typesObj = t.exceptions?.types as Record<string, string> | undefined;
    if (typesObj && key in typesObj) {
      return typesObj[key];
    }
    // Fallback: format the enum value
    return kind.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  };

  // Get suggestion for exception kind
  const getSuggestion = (kind: ExceptionKind): string => {
    const suggestions: Record<ExceptionKind, string> = {
      [ExceptionKind.BANK_NO_INVOICE]: 'Upload the missing invoice or mark as non-invoice transaction',
      [ExceptionKind.INVOICE_NO_BANK]: 'Verify if payment was received or mark as unpaid',
      [ExceptionKind.AMOUNT_MISMATCH]: 'Review amounts and confirm if difference is acceptable',
      [ExceptionKind.DUPLICATE]: 'Remove duplicate entry or confirm both are valid',
      [ExceptionKind.AMBIGUOUS]: 'Review and select the correct match',
      [ExceptionKind.UNKNOWN_SUPPLIER]: 'Add supplier to known suppliers or ignore',
    };
    return suggestions[kind] || 'Review and resolve';
  };

  // Show blocking state if no month selected
  if (!authLoading && (!user?.tenantId || !user?.activeMonthCloseId)) {
    return <BlockingState t={t} />;
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">{t.exceptions.title}</h1>
          <p className="text-muted-foreground">{t.exceptions.description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t.exceptions.groupBy} <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>{t.exceptions.groups.type}</DropdownMenuItem>
            <DropdownMenuItem>{t.exceptions.groups.severity}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MonthContextHeader />

      {error && <ErrorState message={error} />}

      {isLoading ? (
        <LoadingSkeleton />
      ) : exceptions.length === 0 ? (
        <EmptyState message="No open exceptions for this month. All issues have been resolved!" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.exceptions.table.issue}</TableHead>
                  <TableHead>{t.exceptions.table.severity}</TableHead>
                  <TableHead className="w-1/3">{t.exceptions.table.details}</TableHead>
                  <TableHead>{t.exceptions.table.suggestion}</TableHead>
                  <TableHead className="text-right">{t.exceptions.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">{getKindLabel(ex.kind)}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariantMap[ex.severity]}>
                        {ex.severity.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ex.suggestedActionParams?.description || ex.suggestedActionKey || 'Review required'}
                    </TableCell>
                    <TableCell className="font-medium">{getSuggestion(ex.kind)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={resolvingIds.has(ex.id)}>
                            {resolvingIds.has(ex.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                {t.exceptions.resolve} <ChevronDown className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleResolve(ex.id, 'RESOLVE_WITH_MATCH')}>
                            Resolve with Match
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResolve(ex.id, 'MARK_AS_EXPENSE')}>
                            Mark as Expense
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResolve(ex.id, 'IGNORE', 'Manually reviewed')}>
                            Ignore
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
