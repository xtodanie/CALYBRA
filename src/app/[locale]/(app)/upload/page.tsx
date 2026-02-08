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
import { ChevronRight, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { FileAsset } from '@/lib/types';
import { formatDate } from '@/i18n/format';

const mockJobs = [
    { name: 'PARSE_BANK_CSV', status: 'COMPLETED', progress: 100},
    { name: 'PARSE_INVOICE_PDF', status: 'RUNNING', progress: 60},
    { name: 'NORMALIZE', status: 'PENDING', progress: 0},
    { name: 'MATCH', status: 'PENDING', progress: 0},
]

const MonthContextHeader = () => {
    const t = useT();
    // Mock data for now, will be replaced with live data in a future step.
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

// Helper function to calculate SHA-256 hash of a file
async function calculateSHA256(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


export default function UploadPage() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  
  // MOCK: This would come from the URL or a context provider
  const monthCloseId = 'june-2024';

  useEffect(() => {
    if (!user || !monthCloseId) return;

    const q = query(
        collection(db, 'fileAssets'),
        where('tenantId', '==', user.tenantId),
        where('monthCloseId', '==', monthCloseId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const files: FileAsset[] = [];
        querySnapshot.forEach((doc) => {
            files.push({ id: doc.id, ...doc.data() } as FileAsset);
        });
        setUploadedFiles(files);
    });

    return () => unsubscribe();
  }, [user, monthCloseId]);

  const handleFileUpload = async (files: File[], kind: 'BANK_CSV' | 'INVOICE_PDF') => {
    if (!user || !monthCloseId) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in and have a month selected to upload files.",
        });
        return;
    }
    
    setIsUploading(true);

    for (const file of files) {
        try {
            const sha256 = await calculateSHA256(file);
            const storagePath = `tenants/${user.tenantId}/monthCloses/${monthCloseId}/${file.name}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);

            await addDoc(collection(db, 'fileAssets'), {
                tenantId: user.tenantId,
                monthCloseId: monthCloseId,
                kind: kind,
                filename: file.name,
                storagePath: storagePath,
                sha256: sha256,
                parseStatus: 'PENDING',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            toast({
                title: t.upload.notifications.successTitle,
                description: `${file.name} ${t.upload.notifications.successDescription}`,
            });

        } catch (error) {
            console.error("Upload error:", error);
            toast({
                variant: "destructive",
                title: t.upload.notifications.errorTitle,
                description: `${file.name}: ${(error as Error).message}`,
            });
        }
    }
    setIsUploading(false);
  };
  
  const handleDownload = async (filePath: string, filename: string) => {
    try {
        const url = await getDownloadURL(ref(storage, filePath));
        const a = document.createElement('a');
        a.href = url;
        // To force download, you might need a proxy or server-side help,
        // for now, this will open in a new tab.
        a.target = '_blank';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error("Download failed:", error);
        toast({
            variant: "destructive",
            title: t.upload.notifications.downloadErrorTitle,
            description: (error as Error).message,
        });
    }
  }


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
              onFilesSelected={(files) => handleFileUpload(files, 'BANK_CSV')}
              accept={{ 'text/csv': ['.csv'] }}
              multiple={false}
              disabled={isUploading}
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
              onFilesSelected={(files) => handleFileUpload(files, 'INVOICE_PDF')}
              accept={{ 'application/pdf': ['.pdf'] }}
              multiple={true}
              disabled={isUploading}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
            <h3 className="text-lg font-medium">{t.upload.uploadedFiles.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.upload.uploadedFiles.description}</p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t.upload.uploadedFiles.table.filename}</TableHead>
                        <TableHead>{t.upload.uploadedFiles.table.kind}</TableHead>
                        <TableHead>{t.upload.uploadedFiles.table.uploadedAt}</TableHead>
                        <TableHead>{t.upload.uploadedFiles.table.status}</TableHead>
                        <TableHead className="text-right">{t.upload.uploadedFiles.table.actions}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {uploadedFiles.length > 0 ? uploadedFiles.map((file) => (
                        <TableRow key={file.id}>
                            <TableCell className="font-medium">{file.filename}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{t.upload.uploadedFiles.kinds[file.kind as keyof typeof t.upload.uploadedFiles.kinds]}</Badge>
                            </TableCell>
                            <TableCell>{file.createdAt ? formatDate(file.createdAt.toDate(), locale) : '...'}</TableCell>
                            <TableCell>
                                <Badge variant={file.parseStatus === 'PENDING' ? 'default' : 'outline'}>{t.upload.uploadedFiles.statuses[file.parseStatus as keyof typeof t.upload.uploadedFiles.statuses]}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                               <Button variant="outline" size="sm" onClick={() => handleDownload(file.storagePath, file.filename)}>
                                   <Download className="mr-2 h-4 w-4" />
                                   {t.exports.download}
                               </Button>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                {t.upload.uploadedFiles.empty}
                            </TableCell>
                        </TableRow>
                    )}
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
