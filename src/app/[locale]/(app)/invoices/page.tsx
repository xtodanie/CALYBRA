'use client';

/**
 * Invoice Truth Viewer
 *
 * Read-only page displaying canonical invoices exactly as written by ingestion.
 *
 * INVARIANTS:
 * - Tenant-scoped: queries only tenants/{tenantId}/invoices
 * - Month-scoped: filtered by activeMonthCloseId
 * - Live-updating: uses onSnapshot subscription
 * - Read-only: no mutations, no business logic
 * - Deterministic: displays ingestion output only
 *
 * PROHIBITED:
 * - No editing
 * - No invoice status mutation
 * - No deletion
 * - No linking to matches
 * - No business logic
 * - No summary calculations
 * - No client writes
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { subscribeToInvoices } from '@/lib/firestore/invoices';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronRight, FileText } from 'lucide-react';
import { formatMoney, formatDate } from '@/i18n/format';
import type { Invoice } from '@/lib/types';

// === BLOCKING STATES ===

interface BlockingStateProps {
  title: string;
  message: string;
}

const BlockingState = ({ title, message }: BlockingStateProps) => (
  <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
    <div>
      <h1 className="font-headline text-3xl font-bold tracking-tight">{title}</h1>
    </div>
    <Card className="border-amber-500">
      <CardContent className="p-4 text-amber-700">
        {message}
      </CardContent>
    </Card>
  </div>
);

// === LOADING STATE ===

const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-4 space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

// === EMPTY STATE ===

const EmptyState = ({ message }: { message: string }) => (
  <Card>
    <CardContent className="p-8 text-center text-muted-foreground">
      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
      <p>{message}</p>
    </CardContent>
  </Card>
);

// === ERROR STATE ===

const ErrorState = ({ message }: { message: string }) => (
  <Card className="border-destructive">
    <CardContent className="p-4 flex items-center gap-2 text-destructive">
      <AlertCircle className="h-5 w-5" />
      <span>{message}</span>
    </CardContent>
  </Card>
);

// === MONTH CONTEXT HEADER ===

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
        <span className="text-sm font-medium text-muted-foreground">
          {t.monthClose.context.activeMonth}
        </span>
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

// === MAIN PAGE ===

export default function InvoicesPage() {
  const t = useT();
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to invoices with proper cleanup
  useEffect(() => {
    // Guard: require user, tenantId, and activeMonthCloseId
    if (!user?.tenantId || !user?.activeMonthCloseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToInvoices({
      tenantId: user.tenantId,
      monthCloseId: user.activeMonthCloseId,
      onData: (data) => {
        setInvoices(data);
        setIsLoading(false);
      },
      onError: (err) => {
        // Surface permission denied explicitly
        if (err.code === 'permission-denied') {
          setError(t.invoices.errors.permissionDenied);
        } else {
          setError(err.message || t.invoices.errors.loadFailed);
        }
        setIsLoading(false);
      },
    });

    // Cleanup: unsubscribe on unmount or when tenant/month changes
    return () => unsubscribe();
  }, [user?.tenantId, user?.activeMonthCloseId, t.invoices.errors]);

  // === RENDER STATES ===

  // Auth loading
  if (authLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <Skeleton className="h-10 w-48" />
        <LoadingSkeleton />
      </div>
    );
  }

  // Blocking: no user
  if (!user) {
    return (
      <BlockingState
        title={t.invoices.title}
        message={t.invoices.blocking.userNotProvisioned}
      />
    );
  }

  // Blocking: no tenant
  if (!user.tenantId) {
    return (
      <BlockingState
        title={t.invoices.title}
        message={t.invoices.blocking.tenantNotResolved}
      />
    );
  }

  // Blocking: no active month
  if (!user.activeMonthCloseId) {
    return (
      <BlockingState
        title={t.invoices.title}
        message={t.invoices.blocking.noActivePeriod}
      />
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      {/* Page Header */}
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          {t.invoices.title}
        </h1>
        <p className="text-muted-foreground">{t.invoices.description}</p>
      </div>

      {/* Month Context */}
      <MonthContextHeader />

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : invoices.length === 0 ? (
        <EmptyState message={t.invoices.empty} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.invoices.table.invoiceNumber}</TableHead>
                  <TableHead>{t.invoices.table.vendor}</TableHead>
                  <TableHead className="text-right">
                    {t.invoices.table.totalGross}
                  </TableHead>
                  <TableHead>{t.invoices.table.currency}</TableHead>
                  <TableHead>{t.invoices.table.issueDate}</TableHead>
                  <TableHead>{t.invoices.table.dueDate}</TableHead>
                  <TableHead>{t.invoices.table.sourceJobId}</TableHead>
                  <TableHead>{t.invoices.table.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{invoice.supplierNameRaw}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(invoice.totalGross, locale)}
                    </TableCell>
                    <TableCell>EUR</TableCell>
                    <TableCell>
                      {formatDate(invoice.issueDate, locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {/* dueDate is optional - display if present */}
                      {(invoice as Invoice & { dueDate?: string }).dueDate
                        ? formatDate(
                            (invoice as Invoice & { dueDate?: string }).dueDate!,
                            locale,
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {invoice.sourceFileId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.createdAt
                        ? formatDate(invoice.createdAt.toDate(), locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
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
