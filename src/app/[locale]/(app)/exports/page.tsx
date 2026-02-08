'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { Loader2, Download, FileText, Lock, ChevronRight } from 'lucide-react';
import { formatDate } from '@/i18n/format';
import { useLocale } from '@/i18n/provider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const mockExports = [
  { file: 'matches_confirmed.csv', generated: new Date() },
  { file: 'exceptions_open.csv', generated: new Date() },
  { file: 'month_summary.json', generated: new Date() },
];

const MonthContextHeader = () => {
    const t = useT();
    const month = {
      id: 'june-2024',
      period: t.monthClose.sampleMonths.june,
      status: 'READY' as const
    };
    const statusMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        READY: 'default',
        LOCKED: 'secondary',
    };
  
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">{t.monthClose.context.activeMonth}</span>
          <span className="font-semibold">{month.period}</span>
          <Badge variant={statusMap[month.status]}>{t.monthCloses.status[month.status]}</Badge>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/month-closes/${month.id}`}>
              {t.monthClose.context.viewOverview} <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

export default function ExportsPage() {
  const t = useT();
  const locale = useLocale();
  const [isGenerating, setIsGenerating] = useState(false);
  const [exports, setExports] = useState<any[]>([]);

  // This would come from props or context
  const monthStatus = 'READY'; // MOCK: 'LOCKED' to enable

  const isLocked = monthStatus === 'LOCKED';

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setExports(mockExports);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.exports.title}</h1>
        <p className="text-muted-foreground">{t.exports.description}</p>
      </div>
      
      <MonthContextHeader />

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Button onClick={handleGenerate} disabled={isGenerating || !isLocked}>
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isGenerating ? t.exports.generating : t.exports.cta}
            </Button>
            {!isLocked && (
              <Alert variant="default" className="w-auto">
                <Lock className="h-4 w-4" />
                <AlertTitle>{t.exports.lockedOnly.title}</AlertTitle>
                <AlertDescription>
                  {t.exports.lockedOnly.description}{' '}
                  <Button variant="link" asChild className="p-0 h-auto">
                      <Link href={`/month-closes/june-2024`}>{t.exports.lockedOnly.cta}</Link>
                  </Button>
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
                  <TableHead>{t.exports.table.generated}</TableHead>
                  <TableHead className="text-right">{t.exports.table.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((file, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{file.file}</TableCell>
                    <TableCell>{formatDate(file.generated, locale)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
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
    </div>
  );
}
