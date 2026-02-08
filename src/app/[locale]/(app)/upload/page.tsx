'use client';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
import { Card, CardContent } from '@/components/ui/card';
import { FileUploader } from '@/components/file-uploader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatMoney } from '@/i18n/format';
import { ChevronRight } from 'lucide-react';

const mockInvoices = [
  {
    file: 'invoice-123.pdf',
    supplier: 'Global Foods Inc.',
    invoiceNumber: 'INV-123',
    date: '2024-06-15',
    total: 450.75,
    confidence: 95,
    status: 'Parsed',
  },
  {
    file: 'receipt-june.pdf',
    supplier: '?',
    invoiceNumber: '?',
    date: '?',
    total: '?',
    confidence: 30,
    status: 'Needs Review',
  },
  {
    file: 'another-inv.pdf',
    supplier: 'Office Supplies Co.',
    invoiceNumber: '8872',
    date: '2024-06-20',
    total: 120.0,
    confidence: 100,
    status: 'Parsed',
  },
];

const mockJobs = [
    { name: 'PARSE_BANK_CSV', status: 'COMPLETED', progress: 100},
    { name: 'PARSE_INVOICE_PDF', status: 'RUNNING', progress: 60},
    { name: 'NORMALIZE', status: 'PENDING', progress: 0},
    { name: 'MATCH', status: 'PENDING', progress: 0},
]

const MonthContextHeader = () => {
    const t = useT();
    // Mock data for now, would come from context/props
    const month = {
      id: 'june-2024',
      period: t.monthClose.sampleMonths.june,
      status: 'DRAFT' as const
    };
    const statusMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        DRAFT: 'outline'
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

export default function UploadPage() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.upload.title}</h1>
        <p className="text-muted-foreground">{t.upload.description}</p>
      </div>

      <MonthContextHeader />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <FileUploader
              title={t.upload.bankCsv.title}
              description={t.upload.bankCsv.description}
              cta={t.upload.bankCsv.cta}
              dropzoneText={t.upload.bankCsv.dropzone}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <FileUploader
              title={t.upload.invoicePdfs.title}
              description={t.upload.invoicePdfs.description}
              cta={t.upload.invoicePdfs.cta}
              dropzoneText={t.upload.invoicePdfs.dropzone}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
            <h3 className="text-lg font-medium">{t.upload.invoicePdfs.tableTitle}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.upload.invoicePdfs.tableDescription}</p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.upload.invoicePdfs.table.file}</TableHead>
                        <TableHead>{t.upload.invoicePdfs.table.supplier}</TableHead>
                        <TableHead>{t.upload.invoicePdfs.table.invoiceNumber}</TableHead>
                        <TableHead>{t.upload.invoicePdfs.table.date}</TableHead>
                        <TableHead className="text-right">{t.upload.invoicePdfs.table.total}</TableHead>
                        <TableHead className="text-center">{t.upload.invoicePdfs.table.confidence}</TableHead>
                        <TableHead>{t.upload.invoicePdfs.table.status}</TableHead>
                        <TableHead>{t.upload.invoicePdfs.table.actions}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {mockInvoices.map((inv, i) => (
                        <TableRow key={i}>
                            <TableCell className="font-medium">{inv.file}</TableCell>
                            <TableCell>{inv.supplier}</TableCell>
                            <TableCell>{inv.invoiceNumber}</TableCell>
                            <TableCell>{inv.date}</TableCell>
                            <TableCell className="text-right">{typeof inv.total === 'number' ? formatMoney(inv.total, locale) : '?'}</TableCell>
                            <TableCell className="text-center">
                                {inv.confidence < 70 ? (
                                    <Badge variant="destructive">{inv.confidence}% ({t.upload.invoicePdfs.confidenceLow})</Badge>
                                ) : (
                                    <Badge variant="secondary">{inv.confidence}%</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge variant={inv.status === 'Parsed' ? 'outline' : 'default'}>{t.upload.invoicePdfs.statuses[inv.status.replace(" ", "") as keyof typeof t.upload.invoicePdfs.statuses]}</Badge>
                            </TableCell>
                            <TableCell>
                                {inv.confidence < 70 && (
                                     <Button variant="outline" size="sm">{t.upload.invoicePdfs.edit}</Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

       <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium">{t.upload.processing.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.upload.processing.description}</p>
            <div className="space-y-4">
                {mockJobs.map(job => (
                    <div key={job.name}>
                        <div className="flex justify-between mb-1">
                            <p className="text-sm font-medium">{job.name}</p>
                            <p className="text-sm text-muted-foreground">{t.upload.processing.jobStatuses[job.status as keyof typeof t.upload.processing.jobStatuses]} - {job.progress}%</p>
                        </div>
                        <Progress value={job.progress} />
                    </div>
                ))}
            </div>
          </CardContent>
       </Card>
    </div>
  );
}
