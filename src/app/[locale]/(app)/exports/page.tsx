'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Download, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDate, formatMoney } from '@/i18n/format';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthCloseStatus, MatchStatus } from '@/lib/types';
import type { Match, Invoice, BankTx, MonthClose } from '@/lib/types';

type ExportFile = {
  name: string;
  type: 'matches' | 'invoices' | 'transactions' | 'summary';
  generated: Date;
  content: string;
  rowCount: number;
};

// Month Context Header (uses real user data)
const MonthContextHeader = ({ monthClose }: { monthClose: MonthClose | null }) => {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();

  if (!user?.activeMonthCloseId || !monthClose) {
    return null;
  }

  const statusMap: Record<MonthCloseStatus, "default" | "secondary" | "outline" | "destructive"> = {
    [MonthCloseStatus.DRAFT]: 'outline',
    [MonthCloseStatus.IN_REVIEW]: 'default',
    [MonthCloseStatus.FINALIZED]: 'secondary',
  };

  // Format period from periodStart and periodEnd timestamps
  const formatPeriod = () => {
    if (!monthClose.periodStart || !monthClose.periodEnd) return user.activeMonthCloseId;
    try {
      const start = monthClose.periodStart.toDate();
      return start.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    } catch {
      return user.activeMonthCloseId;
    }
  };

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">{t.monthClose.context.activeMonth}</span>
        <span className="font-semibold">{formatPeriod()}</span>
        <Badge variant={statusMap[monthClose.status]}>{t.monthCloses.status[monthClose.status]}</Badge>
      </div>
      <Button variant="ghost" asChild>
        <Link href={`/month-closes/${user.activeMonthCloseId}`}>
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
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-20 w-full" />
    </CardContent>
  </Card>
);

// Blocking state for missing context
const BlockingState = ({ t }: { t: ReturnType<typeof useT> }) => (
  <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
    <div>
      <h1 className="font-headline text-3xl font-bold tracking-tight">{t.exports.title}</h1>
      <p className="text-muted-foreground">{t.exports.description}</p>
    </div>
    <Card className="border-amber-500">
      <CardContent className="p-4 text-amber-700">
        Please select a month close to generate exports.
      </CardContent>
    </Card>
  </div>
);

// CSV generation helpers
function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map(row => row.map(escapeCsvValue).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ExportsPage() {
  const t = useT();
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();

  const [monthClose, setMonthClose] = useState<MonthClose | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exports, setExports] = useState<ExportFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch month close data
  useEffect(() => {
    if (!user?.tenantId || !user?.activeMonthCloseId) {
      setIsLoading(false);
      return;
    }

    const fetchMonthClose = async () => {
      try {
        const monthCloseRef = doc(db, 'tenants', user.tenantId, 'monthCloses', user.activeMonthCloseId!);
        const monthCloseSnap = await getDoc(monthCloseRef);
        if (monthCloseSnap.exists()) {
          setMonthClose({ id: monthCloseSnap.id, ...monthCloseSnap.data() } as MonthClose);
        }
      } catch (err) {
        console.error('Error fetching month close:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonthClose();
  }, [user?.tenantId, user?.activeMonthCloseId]);

  const isFinalized = monthClose?.status === MonthCloseStatus.FINALIZED;

  // Generate exports from live data
  const handleGenerate = useCallback(async () => {
    if (!user?.tenantId || !user?.activeMonthCloseId) return;

    setIsGenerating(true);
    setError(null);

    try {
      const tenantId = user.tenantId;
      const monthCloseId = user.activeMonthCloseId;

      // Fetch all data in parallel
      const [matchesSnap, invoicesSnap, bankTxSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'tenants', tenantId, 'matches'),
          where('monthCloseId', '==', monthCloseId)
        )),
        getDocs(query(
          collection(db, 'tenants', tenantId, 'invoices'),
          where('monthCloseId', '==', monthCloseId)
        )),
        getDocs(query(
          collection(db, 'tenants', tenantId, 'bankTx'),
          where('monthCloseId', '==', monthCloseId)
        )),
      ]);

      const matches: Match[] = [];
      matchesSnap.forEach((doc) => matches.push({ id: doc.id, ...doc.data() } as Match));

      const invoices: Invoice[] = [];
      invoicesSnap.forEach((doc) => invoices.push({ id: doc.id, ...doc.data() } as Invoice));

      const bankTxs: BankTx[] = [];
      bankTxSnap.forEach((doc) => bankTxs.push({ id: doc.id, ...doc.data() } as BankTx));

      const generatedExports: ExportFile[] = [];
      const now = new Date();

      // 1. Confirmed Matches CSV
      const confirmedMatches = matches.filter(m => m.status === MatchStatus.CONFIRMED);
      const matchesHeaders = ['Match ID', 'Bank Tx IDs', 'Invoice IDs', 'Match Type', 'Score', 'Status'];
      const matchesRows = confirmedMatches.map(m => [
        m.id,
        m.bankTxIds?.join(';') || '',
        m.invoiceIds?.join(';') || '',
        m.matchType || '',
        m.score || 0,
        m.status,
      ]);
      generatedExports.push({
        name: `matches_${monthCloseId}.csv`,
        type: 'matches',
        generated: now,
        content: generateCsv(matchesHeaders, matchesRows),
        rowCount: confirmedMatches.length,
      });

      // 2. Invoices CSV
      const invoicesHeaders = ['Invoice ID', 'Supplier', 'Invoice Number', 'Issue Date', 'Total Gross', 'Needs Review', 'Source File'];
      const invoicesRows = invoices.map(inv => [
        inv.id,
        inv.supplierNameRaw,
        inv.invoiceNumber,
        inv.issueDate,
        inv.totalGross,
        inv.needsReview ? 'Yes' : 'No',
        inv.sourceFileId || '',
      ]);
      generatedExports.push({
        name: `invoices_${monthCloseId}.csv`,
        type: 'invoices',
        generated: now,
        content: generateCsv(invoicesHeaders, invoicesRows),
        rowCount: invoices.length,
      });

      // 3. Bank Transactions CSV
      const txHeaders = ['Tx ID', 'Booking Date', 'Amount', 'Description', 'Fingerprint'];
      const txRows = bankTxs.map(tx => [
        tx.id,
        tx.bookingDate,
        tx.amount,
        tx.descriptionRaw,
        tx.fingerprint || '',
      ]);
      generatedExports.push({
        name: `bank_transactions_${monthCloseId}.csv`,
        type: 'transactions',
        generated: now,
        content: generateCsv(txHeaders, txRows),
        rowCount: bankTxs.length,
      });

      // 4. Summary CSV
      const totalBankAmount = bankTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
      const summaryHeaders = ['Metric', 'Value'];
      const summaryRows = [
        ['Month Close ID', monthCloseId],
        ['Status', monthClose?.status || 'Unknown'],
        ['Total Bank Transactions', bankTxs.length],
        ['Total Bank Amount', totalBankAmount],
        ['Total Invoices', invoices.length],
        ['Total Invoice Amount', totalInvoiceAmount],
        ['Confirmed Matches', confirmedMatches.length],
        ['Difference', totalBankAmount - totalInvoiceAmount],
      ];
      generatedExports.push({
        name: `summary_${monthCloseId}.csv`,
        type: 'summary',
        generated: now,
        content: generateCsv(summaryHeaders, summaryRows),
        rowCount: summaryRows.length,
      });

      setExports(generatedExports);
    } catch (err) {
      console.error('Error generating exports:', err);
      setError('Failed to generate exports. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [user?.tenantId, user?.activeMonthCloseId, monthClose?.status]);

  // Download handler
  const handleDownload = useCallback((exportFile: ExportFile) => {
    downloadCsv(exportFile.name, exportFile.content);
  }, []);

  // Show blocking state if no month selected
  if (!authLoading && (!user?.tenantId || !user?.activeMonthCloseId)) {
    return <BlockingState t={t} />;
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.exports.title}</h1>
        <p className="text-muted-foreground">{t.exports.description}</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <MonthContextHeader monthClose={monthClose} />

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Generate Export Files</CardTitle>
              <CardDescription>
                Export your reconciliation data as CSV files for external use.
              </CardDescription>
              <div className="flex items-start gap-4 pt-4">
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating ? t.exports.generating : t.exports.cta}
                </Button>
                {!isFinalized && (
                  <Alert variant="default" className="w-auto border-amber-500">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">Draft Export</AlertTitle>
                    <AlertDescription className="text-amber-600">
                      This month is not finalized. Export data may change.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {exports.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12" />
                  <p className="mt-4">{t.exports.empty}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.exports.table.file}</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>{t.exports.table.generated}</TableHead>
                      <TableHead className="text-right">{t.exports.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((file) => (
                      <TableRow key={file.name}>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell>{file.rowCount}</TableCell>
                        <TableCell>{formatDate(file.generated, locale)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleDownload(file)}>
                            <Download className="mr-2 h-4 w-4" />
                            {t.exports.download}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
