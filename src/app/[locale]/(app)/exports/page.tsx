'use client';
import { useState } from 'react';
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
import { Loader2, Download, FileText } from 'lucide-react';
import { formatDate } from '@/i18n/format';
import { useLocale } from '@/i18n/provider';

const mockExports = [
  { file: 'matches_confirmed.csv', generated: new Date() },
  { file: 'exceptions_open.csv', generated: new Date() },
  { file: 'month_summary.json', generated: new Date() },
];

export default function ExportsPage() {
  const t = useT();
  const locale = useLocale();
  const [isGenerating, setIsGenerating] = useState(false);
  const [exports, setExports] = useState<any[]>([]);

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

      <Card>
        <CardHeader>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isGenerating ? t.exports.generating : t.exports.cta}
          </Button>
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
