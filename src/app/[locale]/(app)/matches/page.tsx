'use client';
import { useT, useLocale } from '@/i18n/provider';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/i18n/format';

const mockProposedMatches = [
  {
    score: 98,
    explanation: 'Amount and supplier name match.',
    bankTx: { date: '2024-06-16', description: 'GLOBAL FOODS INC', amount: 450.75 },
    invoice: { number: 'INV-123', supplier: 'Global Foods Inc.', amount: 450.75 },
  },
  {
    score: 85,
    explanation: 'Amount matches, date is close, supplier alias recognized.',
    bankTx: { date: '2024-06-22', description: 'OFFICE SPLY', amount: 120.00 },
    invoice: { number: '8872', supplier: 'Office Supplies Co.', amount: 120.00 },
  },
];

const mockConfirmedMatches = [
  {
    score: 100,
    explanation: 'Manually confirmed.',
    bankTx: { date: '2024-05-10', description: 'CITY UTILITIES', amount: 210.55 },
    invoice: { number: 'MAY-UTIL-24', supplier: 'City Utilities', amount: 210.55 },
  },
]

export default function MatchesPage() {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.matches.title}</h1>
        <p className="text-muted-foreground">{t.matches.description}</p>
      </div>

      <Tabs defaultValue="proposed">
        <TabsList>
          <TabsTrigger value="proposed">{t.matches.tabs.proposed}</TabsTrigger>
          <TabsTrigger value="confirmed">{t.matches.tabs.confirmed}</TabsTrigger>
        </TabsList>
        <TabsContent value="proposed">
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
                  {mockProposedMatches.map((match, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{match.score}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{match.explanation}</TableCell>
                      <TableCell>
                        <div className="font-medium">{match.bankTx.description}</div>
                        <div>{formatMoney(match.bankTx.amount, locale)} on {match.bankTx.date}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{match.invoice.supplier}</div>
                        <div>#{match.invoice.number} - {formatMoney(match.invoice.amount, locale)}</div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm">{t.matches.reject}</Button>
                        <Button variant="default" size="sm">{t.matches.confirm}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="confirmed">
           <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p>Confirmed matches will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
