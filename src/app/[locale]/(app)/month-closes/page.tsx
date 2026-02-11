'use client';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { useT, useLocale } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { formatMoney, formatDate } from '@/i18n/format';
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
import { CreateMonthCloseDialog } from '@/components/month-close/create-month-close-dialog';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { MonthClose } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const statusVariantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: 'outline',
  IN_REVIEW: 'default',
  FINALIZED: 'secondary',
};

export default function MonthClosesPage() {
  const t = useT();
  const locale = useLocale();
  const { user, setActiveMonthClose } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [closes, setCloses] = useState<MonthClose[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(false);
      },
      (error) => {
        console.error('MonthCloses subscription error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSetActive = (id: string) => {
    setActiveMonthClose(id);
  };

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
          <Button onClick={() => setShowCreateDialog(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.monthCloses.cta}
          </Button>
        </div>
      </div>
      
      <CreateMonthCloseDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.monthCloses.table.period}</TableHead>
                <TableHead>{t.monthCloses.table.status}</TableHead>
                <TableHead className="text-right">{t.monthCloses.table.difference}</TableHead>
                <TableHead className="text-right">{t.monthCloses.table.exceptions}</TableHead>
                <TableHead className="text-right">{t.monthCloses.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : closes.length > 0 ? (
                closes.map((close) => (
                  <TableRow key={close.id} className={user?.activeMonthCloseId === close.id ? 'bg-muted/50' : ''}>
                    <TableCell className="font-medium">
                      <Button variant="link" asChild className="p-0">
                        <Link href={`/month-closes/${close.id}`}>{formatDate(close.periodStart.toDate(), locale, { month: 'long', year: 'numeric'})}</Link>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[close.status]}>
                        {t.monthCloses.status[close.status as keyof typeof t.monthCloses.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(close.diff, locale)}</TableCell>
                    <TableCell className="text-right">{close.openExceptionsCount}</TableCell>
                    <TableCell className="text-right">
                      {user?.activeMonthCloseId === close.id ? (
                        <Badge variant="outline">{t.monthCloses.active}</Badge>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleSetActive(close.id)}>
                          {t.monthCloses.setActive}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {t.monthCloses.empty.title}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isLoading && closes.length === 0 && (
         <Card className="mt-4 text-center">
            <CardHeader>
                <CardTitle>{t.monthCloses.empty.title}</CardTitle>
                <CardDescription>{t.monthCloses.empty.description}</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => setShowCreateDialog(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t.monthCloses.cta}
                </Button>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
