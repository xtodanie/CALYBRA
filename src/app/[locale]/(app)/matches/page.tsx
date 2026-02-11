'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
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
import { formatMoney } from '@/i18n/format';
import { ChevronRight } from 'lucide-react';

const initialProposedMatches = [
  {
    id: 1,
    score: 98,
    explanationKey: 'amountAndName',
    bankTx: { date: '2024-06-16', description: 'GLOBAL FOODS INC', amount: 450.75 },
    invoice: { number: 'INV-123', supplier: 'Global Foods Inc.', amount: 450.75 },
  },
  {
    id: 2,
    score: 85,
    explanationKey: 'amountAndDate',
    bankTx: { date: '2024-06-22', description: 'OFFICE SPLY', amount: 120.00 },
    invoice: { number: '8872', supplier: 'Office Supplies Co.', amount: 120.00 },
  },
];

const initialConfirmedMatches = [
  {
    id: 3,
    score: 100,
    explanationKey: 'manualConfirmation',
    bankTx: { date: '2024-05-10', description: 'CITY UTILITIES', amount: 210.55 },
    invoice: { number: 'MAY-UTIL-24', supplier: 'City Utilities', amount: 210.55 },
  },
]

type MatchRow = (typeof initialProposedMatches)[number];

const MonthContextHeader = () => {
    const t = useT();
    // Mock data for now, would come from context/props
    const month = {
      id: 'june-2024',
      period: t.monthClose.sampleMonths.june,
      status: 'IN_REVIEW' as const
    };
    const statusMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        IN_REVIEW: 'default',
        FINALIZED: 'secondary',
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

export default function MatchesPage() {
  const t = useT();
  const locale = useLocale();

  const [proposedMatches, setProposedMatches] = useState<MatchRow[]>(initialProposedMatches);
  const [confirmedMatches, setConfirmedMatches] = useState<MatchRow[]>(initialConfirmedMatches);

  const handleConfirm = (matchToConfirm: MatchRow) => {
    setProposedMatches(current => current.filter(m => m.id !== matchToConfirm.id));
    setConfirmedMatches(current => [...current, { ...matchToConfirm, score: 100, explanationKey: 'manualConfirmation' }]);
  }

  const handleReject = (matchToReject: MatchRow) => {
    setProposedMatches(current => current.filter(m => m.id !== matchToReject.id));
    // In a real app, this would likely create an exception
  }

  const MatchTable = ({ matches, isProposed }: { matches: MatchRow[]; isProposed: boolean }) => (
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
              {matches.length > 0 ? matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="text-center">
                    <Badge variant={match.score < 90 ? "secondary" : "default"}>{match.score}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.matches.explanations[match.explanationKey as keyof typeof t.matches.explanations]}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{match.bankTx.description}</div>
                    <div>{formatMoney(match.bankTx.amount, locale)} on {match.bankTx.date}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{match.invoice.supplier}</div>
                    <div>#{match.invoice.number} - {formatMoney(match.invoice.amount, locale)}</div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {isProposed ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => handleReject(match)}>{t.matches.reject}</Button>
                            <Button variant="default" size="sm" onClick={() => handleConfirm(match)}>{t.matches.confirm}</Button>
                        </>
                    ) : (
                        <Badge variant="outline">{t.matches.confirmed}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        {isProposed ? t.matches.empty.proposed : t.matches.empty.confirmed}
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
  )

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.matches.title}</h1>
        <p className="text-muted-foreground">{t.matches.description}</p>
      </div>

      <MonthContextHeader />

      <Tabs defaultValue="proposed">
        <TabsList>
          <TabsTrigger value="proposed">{t.matches.tabs.proposed} ({proposedMatches.length})</TabsTrigger>
          <TabsTrigger value="confirmed">{t.matches.tabs.confirmed} ({confirmedMatches.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="proposed">
          <MatchTable matches={proposedMatches} isProposed={true} />
        </TabsContent>
        <TabsContent value="confirmed">
           <MatchTable matches={confirmedMatches} isProposed={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
