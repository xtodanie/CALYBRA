'use client';
import { useT, useLocale } from '@/i18n/provider';
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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatMoney } from '@/i18n/format';
import Link from 'next/link';

const mockExceptionsData = [
  {
    type: 'MISSING_INVOICE',
    severity: 'High',
    data: { description: 'STEAKHOUSE SUPPLY CO', amount: 582.10 },
  },
  {
    type: 'AMOUNT_MISMATCH',
    severity: 'Medium',
    data: { bankAmount: 105.50, invoiceNumber: '23-456', invoiceAmount: 102.50, difference: 3.00 },
  },
  {
    type: 'UNKNOWN_SUPPLIER',
    severity: 'Medium',
    data: { description: 'VENDR-O-MATIC', amount: 75.00 },
  },
  {
    type: 'DUPLICATE_INVOICE',
    severity: 'Low',
    data: { invoiceNumber: '9901', supplier: 'Linen Services' },
  },
];

type ExceptionType = keyof typeof mockExceptionsData[0]['data'];

const severityVariantMap: Record<string, "destructive" | "default" | "outline"> = {
  High: 'destructive',
  Medium: 'default',
  Low: 'outline',
};

const MonthContextHeader = () => {
    const t = useT();
    // Mock data for now, would come from context/props
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

export default function ExceptionsPage() {
  const t = useT();
  const locale = useLocale();

  const formatString = (str: string, data: any) => {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      if (data.hasOwnProperty(key)) {
        let value = data[key];
        if (typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('difference'))) {
            return formatMoney(value, locale);
        }
        return value;
      }
      return match;
    });
  };
  
  const getResolveActions = (type: keyof typeof t.exceptions.types) => {
    const actions = t.exceptions.resolveActions[type] || t.exceptions.resolveActions.generic;
    return Object.entries(actions).map(([key, label]) => (
        <DropdownMenuItem key={key}>{label}</DropdownMenuItem>
    ));
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
              {mockExceptionsData.map((ex, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{t.exceptions.types[ex.type as keyof typeof t.exceptions.types]}</TableCell>
                  <TableCell>
                    <Badge variant={severityVariantMap[ex.severity]}>
                      {t.exceptions.severities[ex.severity.toLowerCase() as keyof typeof t.exceptions.severities]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatString(t.exceptions.details[ex.type  as keyof typeof t.exceptions.details], ex.data)}</TableCell>
                  <TableCell className="font-medium">{t.exceptions.suggestions[ex.type as keyof typeof t.exceptions.suggestions]}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {t.exceptions.resolve} <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {getResolveActions(ex.type as keyof typeof t.exceptions.types)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
