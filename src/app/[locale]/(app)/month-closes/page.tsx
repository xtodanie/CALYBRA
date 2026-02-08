'use client';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { useT, useLocale } from '@/i18n/provider';
import { formatMoney } from '@/i18n/format';
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
import { Badge } from '@/components/ui/badge';

const mockData = [
  {
    id: 'june-2024',
    period: 'June 2024',
    status: 'READY',
    difference: 3329.24,
    exceptions: 17,
  },
  {
    id: 'may-2024',
    period: 'May 2024',
    status: 'LOCKED',
    difference: 0,
    exceptions: 0,
  },
  {
    id: 'april-2024',
    period: 'April 2024',
    status: 'LOCKED',
    difference: 0,
    exceptions: 0,
  },
];

const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  READY: 'default',
  LOCKED: 'secondary',
  DRAFT: 'outline',
  PROCESSING: 'default',
};

export default function MonthClosesPage() {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            {t.monthCloses.title}
          </h1>
          <p className="text-muted-foreground">{t.monthCloses.description}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.monthCloses.cta}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.monthCloses.table.period}</TableHead>
                <TableHead>{t.monthCloses.table.status}</TableHead>
                <TableHead className="text-right">{t.monthCloses.table.difference}</TableHead>
                <TableHead className="text-right">{t.monthCloses.table.exceptions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockData.length > 0 ? (
                mockData.map((close) => (
                  <TableRow key={close.id}>
                    <TableCell className="font-medium">
                      <Button variant="link" asChild className="p-0">
                        <Link href={`/month-closes/${close.id}`}>{close.period}</Link>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[close.status]}>
                        {t.monthCloses.status[close.status as keyof typeof t.monthCloses.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(close.difference, locale)}</TableCell>
                    <TableCell className="text-right">{close.exceptions}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    {t.monthCloses.empty.title}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {mockData.length === 0 && (
         <Card className="mt-4 text-center">
            <CardHeader>
                <CardTitle>{t.monthCloses.empty.title}</CardTitle>
                <CardDescription>{t.monthCloses.empty.description}</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t.monthCloses.cta}
                </Button>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
