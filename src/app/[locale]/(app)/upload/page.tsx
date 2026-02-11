
'use client';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AlertCircle, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, storage, functions } from '@/lib/firebaseClient';
import { collection, doc, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import type { FileAsset, Job, MonthClose } from '@/lib/types';
import { formatDate } from '@/i18n/format';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type Translations = ReturnType<typeof useT>;


const MonthContextHeader = ({ monthClose }: { monthClose: MonthClose }) => {
    const t = useT();
    const statusMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        DRAFT: 'outline',
        IN_REVIEW: 'default',
        FINALIZED: 'secondary'
    };

    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">{t.monthClose.context.activeMonth}</span>
          <span className="font-semibold">{formatDate(monthClose.periodStart.toDate(), useLocale(), { month: 'long', year: 'numeric'})}</span>
          <Badge variant={statusMap[monthClose.status]}>{t.monthCloses.status[monthClose.status]}</Badge>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/month-closes/${monthClose.id}`}>
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

function NoActiveMonth({ t }: { t: Translations }) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">{t.monthClose.context.noActiveMonth.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t.monthClose.context.noActiveMonth.description}</p>
        <Button asChild className="mt-4">
          <Link href="/month-closes">{t.monthClose.context.noActiveMonth.cta}</Link>
        </Button>
      </div>
    );
}

function JobsList({ monthCloseId, tenantId }: { monthCloseId: string; tenantId: string }) {
    const t = useT();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [fileAssets, setFileAssets] = useState<Record<string, FileAsset>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const jobsQuery = query(
            collection(db, 'jobs'),
            where('tenantId', '==', tenantId),
            where('monthCloseId', '==', monthCloseId)
        );
        const assetsQuery = query(
            collection(db, 'tenants', tenantId, 'fileAssets'),
            where('monthCloseId', '==', monthCloseId)
        );

        const unsubJobs = onSnapshot(jobsQuery, (snapshot) => {
            const jobsData: Job[] = [];
            snapshot.forEach(doc => jobsData.push({ id: doc.id, ...doc.data() } as Job));
            setJobs(jobsData);
            setIsLoading(false);
        });

        const unsubAssets = onSnapshot(assetsQuery, (snapshot) => {
            const assetsData: Record<string, FileAsset> = {};
            snapshot.forEach(doc => {
                assetsData[doc.id] = { id: doc.id, ...doc.data() } as FileAsset
            });
            setFileAssets(assetsData);
        });

        return () => {
            unsubJobs();
            unsubAssets();
        }
        }, [monthCloseId, tenantId]);
    
    if (isLoading) {
        return <Loader2 className="mx-auto h-8 w-8 animate-spin" />
    }
    
    if (jobs.length === 0) {
        return <p className="text-center text-sm text-muted-foreground">{t.upload.processing.empty}</p>
    }

    return (
        <div className="space-y-4">
            {jobs.map(job => {
                const file = fileAssets[job.refFileId];
                return (
                    <div key={job.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                           <div className="flex flex-col gap-1">
                               <p className="font-medium">{file?.filename || '...'}</p>
                               <p className="text-sm text-muted-foreground">{t.jobs.types[job.type as keyof typeof t.jobs.types]}</p>
                           </div>
                           <Badge variant={job.status === 'COMPLETED' ? 'outline' : 'default'}>
                                {t.jobs.statuses[job.status as keyof typeof t.jobs.statuses]}
                            </Badge>
                        </div>
                        <Progress value={job.progress.pct} className="mt-3 mb-1" />
                        <p className="text-xs text-muted-foreground text-center">{t.jobs.steps[job.progress.stepKey as keyof typeof t.jobs.steps]} ({job.progress.pct}%)</p>
                        {job.status === 'FAILED' && job.error &&
                            <Alert variant="destructive" className="mt-2">
                                <AlertTitle>{t.upload.notifications.errorTitle}</AlertTitle>
                                <AlertDescription>{t.jobs.errors[job.error.messageKey as keyof typeof t.jobs.errors]}</AlertDescription>
                            </Alert>
                        }
                    </div>
                )
            })}
        </div>
    )
}

export default function UploadPage() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  const [activeMonth, setActiveMonth] = useState<MonthClose | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const monthCloseId = user?.activeMonthCloseId;
    const tenantId = user?.tenantId;
  
  useEffect(() => {
        if (!monthCloseId || !tenantId) {
      setActiveMonth(null);
      setIsLoadingMonth(false);
      return;
    }
    setIsLoadingMonth(true);
        const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'monthCloses', monthCloseId), (doc) => {
      if (doc.exists()) {
        setActiveMonth({ id: doc.id, ...doc.data() } as MonthClose);
      } else {
        setActiveMonth(null);
      }
      setIsLoadingMonth(false);
    });
        return () => unsub();
    }, [monthCloseId, tenantId]);


    useEffect(() => {
        if (!monthCloseId || !tenantId) {
      setUploadedFiles([]);
      return;
    };

    const q = query(
        collection(db, 'tenants', tenantId, 'fileAssets'),
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
    }, [tenantId, monthCloseId]);

  const handleFileUpload = async (files: File[], kind: 'BANK_CSV' | 'INVOICE_PDF') => {
    if (!user || !monthCloseId) {
        toast({
            variant: "destructive",
            title: t.upload.notifications.errorTitle,
            description: t.monthClose.context.noActiveMonth.description,
        });
        return;
    }
    
    setIsUploading(true);

    const batch = writeBatch(db);
    let filesUploadedCount = 0;

    for (const file of files) {
        try {
            const sha256 = await calculateSHA256(file);
            const fileAssetRef = doc(collection(db, 'tenants', user.tenantId, 'fileAssets'));
            
            const fileExtension = kind === 'BANK_CSV' ? 'csv' : 'pdf';
            const subFolder = kind === 'BANK_CSV' ? 'bank' : 'invoices';
            
            const storagePath = `tenants/${user.tenantId}/monthCloses/${monthCloseId}/${subFolder}/${fileAssetRef.id}.${fileExtension}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);

            batch.set(fileAssetRef, {
                schemaVersion: 1,
                tenantId: user.tenantId,
                monthCloseId: monthCloseId,
                kind: kind,
                filename: file.name,
                storagePath: storagePath,
                sha256: sha256,
                status: 'PENDING_UPLOAD',
                parseStatus: 'PENDING',
                parseError: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            const jobRef = doc(collection(db, 'jobs'));
            batch.set(jobRef, {
                schemaVersion: 1,
                tenantId: user.tenantId,
                monthCloseId: monthCloseId,
                type: kind === 'BANK_CSV' ? 'PARSE_BANK_CSV' : 'PARSE_INVOICE_PDF',
                status: 'PENDING',
                progress: { stepKey: 'jobs.steps.queued', pct: 0 },
                error: null,
                refFileId: fileAssetRef.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            filesUploadedCount++;

        } catch (error) {
            console.error("Upload error:", error);
            toast({
                variant: "destructive",
                title: t.upload.notifications.errorTitle,
                description: `${file.name}: ${(error as Error).message}`,
            });
        }
    }
    
    if (filesUploadedCount > 0) {
        await batch.commit();
        
        // Transition status via server function (client cannot set status)
        const transitionMonthClose = httpsCallable(functions, 'transitionMonthClose');
        try {
            await transitionMonthClose({ monthCloseId, toStatus: 'IN_REVIEW' });
        } catch (transitionError) {
            // Log but don't fail - files were uploaded successfully
            console.warn("Status transition failed:", transitionError);
        }
        
        toast({
            title: t.upload.notifications.successTitle,
            description: t.upload.notifications.successDescription.replace('{count}', filesUploadedCount.toString()),
        });
    }
    
    setIsUploading(false);
  };
  
  const getSignedDownloadUrl = httpsCallable(functions, 'getSignedDownloadUrl');

  const handleDownload = async (file: FileAsset) => {
    setDownloadingFileId(file.id);
    try {
        const result = await getSignedDownloadUrl({ fileAssetId: file.id });
        const { url } = result.data as { url: string };
        window.open(url, '_blank');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.jobs.errors.GENERIC;
        console.error("Download failed:", error);
        toast({
            variant: "destructive",
            title: t.upload.notifications.downloadErrorTitle,
            description: message,
        });
    } finally {
        setDownloadingFileId(null);
    }
  }


  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.upload.title}</h1>
        <p className="text-muted-foreground">{t.upload.description}</p>
      </div>
      
      {isLoadingMonth ? <Skeleton className="h-20 w-full" /> : !activeMonth ? <NoActiveMonth t={t} /> : (
      <>
        <MonthContextHeader monthClose={activeMonth} />
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
            <CardHeader>
                <CardTitle>{t.upload.processing.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{t.upload.processing.description}</p>
            </CardHeader>
            <CardContent className="p-6">
                                {tenantId && (
                                    <JobsList monthCloseId={activeMonth.id} tenantId={tenantId} />
                                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <h3 className="text-lg font-medium">{t.upload.uploadedFiles.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.upload.uploadedFiles.description}</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
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
                                <Button variant="outline" size="sm" onClick={() => handleDownload(file)} disabled={!!downloadingFileId}>
                                    {downloadingFileId === file.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
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
      </>
      )}
    </div>
  );
}
