'use client';
import { useT } from '@/i18n/provider';
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
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const mockExceptions = [
  {
    issue: 'Missing Invoice',
    severity: 'High',
    details: 'Bank transaction "STEAKHOUSE SUPPLY CO" for $582.10 has no matching invoice.',
    suggestion: 'Upload invoice or mark as other expense.',
  },
  {
    issue: 'Amount Mismatch',
    severity: 'Medium',
    details: 'Bank tx: $105.50. Invoice #23-456: $102.50. Difference: $3.00.',
    suggestion: 'Check for bank fees or partial payment.',
  },
  {
    issue: 'Unknown Supplier',
    severity: 'Medium',
    details: 'Bank transaction "VENDR-O-MATIC" for $75.00 is not a known supplier.',
    suggestion: 'Assign a supplier to this transaction.',
  },
  {
    issue: 'Duplicate Invoice',
    severity: 'Low',
    details: 'Invoice #9901 from "Linen Services" appears twice.',
    suggestion: 'Verify payment and remove one invoice.',
  }
];

const severityVariantMap: Record<string, "destructive" | "default" | "outline"> = {
  High: 'destructive',
  Medium: 'default',
  Low: 'outline',
};

export default function ExceptionsPage() {
  const t = useT();

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
              {mockExceptions.map((ex, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{ex.issue}</TableCell>
                  <TableCell>
                    <Badge variant={severityVariantMap[ex.severity]}>
                      {t.exceptions.severities[ex.severity.toLowerCase() as keyof typeof t.exceptions.severities]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ex.details}</TableCell>
                  <TableCell className="font-medium">{ex.suggestion}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Resolve <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>{t.exceptions.actions.assign}</DropdownMenuItem>
                        <DropdownMenuItem>{t.exceptions.actions.markAsFee}</DropdownMenuItem>
                        <DropdownMenuItem>{t.exceptions.actions.group}</DropdownMenuItem>
                        <DropdownMenuItem>{t.exceptions.actions.manualMatch}</DropdownMenuItem>
                        <DropdownMenuItem>{t.exceptions.actions.ignore}</DropdownMenuItem>
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
