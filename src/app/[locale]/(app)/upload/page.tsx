
'use client';
import Link from 'next/link';
import { useT, useLocale } from '@/i18n/provider';
import { CardPremium, PageContainer, Section } from '@/components/layout/premium-shell';
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
import { AlertCircle, ChevronRight, Download, Loader2, UploadCloud } from 'lucide-react';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { FileRejection } from 'react-dropzone';

type Translations = ReturnType<typeof useT>;
type ImportKind = 'BANK_CSV' | 'INVOICE_PDF';
type PendingImport = { files: File[]; kind: ImportKind } | null;


const MonthContextHeader = ({ monthClose }: { monthClose: MonthClose }) => {
    const t = useT();
    const locale = useLocale();
    const statusMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        DRAFT: 'outline',
        IN_REVIEW: 'default',
        FINALIZED: 'secondary'
    };

        return (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="text-sm font-medium text-muted-foreground">{t.monthClose.context.activeMonth}</span>
                                        <span className="font-semibold">{formatDate(monthClose.periodStart.toDate(), locale, { month: 'long', year: 'numeric'})}</span>
                    <Badge variant={statusMap[monthClose.status]}>{t.monthCloses.status[monthClose.status]}</Badge>
        </div>
                <Button variant="ghost" className="self-start sm:self-auto" asChild>
                    <Link href={`/${locale}/month-closes/${monthClose.id}`}>
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
        const locale = useLocale();
    return (
            <CardPremium className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">{t.monthClose.context.noActiveMonth.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t.monthClose.context.noActiveMonth.description}</p>
        <Button asChild className="mt-4">
                    <Link href={`/${locale}/month-closes`}>{t.monthClose.context.noActiveMonth.cta}</Link>
        </Button>
            </CardPremium>
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
                                <AlertDescription>{t.jobs.errors[job.error.messageKey as keyof typeof t.jobs.errors] ?? t.jobs.errors.GENERIC}</AlertDescription>
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
    const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<FileAsset[]>([]);
  const [activeMonth, setActiveMonth] = useState<MonthClose | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
    const [pendingImport, setPendingImport] = useState<PendingImport>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

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

    const handleFileUpload = async (files: File[], kind: ImportKind) => {
    if (!user || !monthCloseId) {
        toast({
            variant: "destructive",
            title: t.upload.notifications.errorTitle,
            description: t.monthClose.context.noActiveMonth.description,
        });
        return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);

    const batch = writeBatch(db);
    const createJob = httpsCallable(functions, 'createJob');
    const pendingJobs: { fileAssetId: string; storagePath: string; kind: ImportKind }[] = [];
    let filesUploadedCount = 0;
    let filesProcessedCount = 0;

    for (const file of files) {
        try {
            const sha256 = await calculateSHA256(file);
            const fileAssetRef = doc(collection(db, 'tenants', user.tenantId, 'fileAssets'));
            
            const fileExtension = kind === 'BANK_CSV' ? 'csv' : 'pdf';
            const subFolder = kind === 'BANK_CSV' ? 'bank' : 'invoices';
            
            const storagePath = `tenants/${user.tenantId}/monthCloses/${monthCloseId}/${subFolder}/${fileAssetRef.id}.${fileExtension}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);

            // Client creates fileAsset with PENDING_UPLOAD (allowed by rules)
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

            // Queue job creation for after batch commit (jobs are server-authoritative)
            pendingJobs.push({
                fileAssetId: fileAssetRef.id,
                storagePath: storagePath,
                kind: kind,
            });
            filesUploadedCount++;

        } catch (error) {
            console.error("Upload error:", error);
            toast({
                variant: "destructive",
                title: t.upload.notifications.errorTitle,
                description: `${file.name}: ${(error as Error).message}`,
            });
        } finally {
            filesProcessedCount++;
            setUploadProgress(Math.round((filesProcessedCount / files.length) * 100));
        }
    }
    
    if (filesUploadedCount > 0) {
        // Commit fileAsset batch first
        await batch.commit();
        
        // Create jobs via server-authoritative callable (triggers processJob automatically)
        for (const pending of pendingJobs) {
            try {
                await createJob({
                    monthCloseId,
                    fileAssetId: pending.fileAssetId,
                    storagePath: pending.storagePath,
                    kind: pending.kind,
                });
            } catch (jobError) {
                console.error("Job creation failed:", jobError);
                // Continue with other jobs - individual failures don't block batch
            }
        }
        
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
        setUploadProgress(0);
  };

    const handleValidationErrors = (rejections: FileRejection[]) => {
        const messages = rejections.flatMap((rejection) =>
            rejection.errors.map((err) => `${rejection.file.name}: ${err.message}`)
        );
        setValidationErrors(messages);
    };

    const handleRequestImport = (files: File[], kind: ImportKind) => {
        if (!files.length) {
            return;
        }

        setValidationErrors([]);
        setPendingImport({ files, kind });
    };

    const confirmImport = async () => {
        if (!pendingImport) {
            return;
        }

        await handleFileUpload(pendingImport.files, pendingImport.kind);
        setPendingImport(null);
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
        <PageContainer>
            <Section>
                <div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight">{t.upload.title}</h1>
                    <p className="text-muted-foreground">{t.upload.description}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/${locale}/month-closes`}>{t.monthCloses.title}</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={`/${locale}/invoices`}>{t.sidebar.invoices}</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={`/${locale}/exceptions`}>{t.sidebar.exceptions}</Link>
                    </Button>
                </div>
            </Section>
      
      {isLoadingMonth ? <Skeleton className="h-20 w-full" /> : !activeMonth ? <NoActiveMonth t={t} /> : (
      <>
        <MonthContextHeader monthClose={activeMonth} />

                {validationErrors.length > 0 ? (
                    <Alert variant="destructive">
                        <AlertTitle>{t.upload.validation.title}</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-5">
                                {validationErrors.map((err) => (
                                    <li key={err}>{err}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {isUploading ? (
                    <CardPremium className="p-6" aria-live="polite">
                        <div className="flex items-center justify-between">
                            <p className="text-body font-medium">{t.upload.progress.title}</p>
                            <p className="text-caption text-muted-foreground">{uploadProgress}%</p>
                        </div>
                        <Progress value={uploadProgress} className="mt-3" />
                    </CardPremium>
                ) : null}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <CardPremium className="p-6">
                <FileUploader
                title={t.upload.bankCsv.title}
                description={t.upload.bankCsv.description}
                cta={t.upload.bankCsv.cta}
                dropzoneText={t.upload.bankCsv.dropzone}
                                onFilesSelected={(files) => handleRequestImport(files, 'BANK_CSV')}
                                onValidationErrors={handleValidationErrors}
                accept={{ 'text/csv': ['.csv'] }}
                multiple={false}
                disabled={isUploading}
                                progressPct={isUploading ? uploadProgress : undefined}
                />
                        </CardPremium>
                        <CardPremium className="p-6">
                <FileUploader
                title={t.upload.invoicePdfs.title}
                description={t.upload.invoicePdfs.description}
                cta={t.upload.invoicePdfs.cta}
                dropzoneText={t.upload.invoicePdfs.dropzone}
                                onFilesSelected={(files) => handleRequestImport(files, 'INVOICE_PDF')}
                                onValidationErrors={handleValidationErrors}
                accept={{ 'application/pdf': ['.pdf'] }}
                multiple={true}
                disabled={isUploading}
                                progressPct={isUploading ? uploadProgress : undefined}
                />
                        </CardPremium>
        </div>

                <CardPremium className="p-6">
                        <Section title={t.upload.processing.title} subtitle={t.upload.processing.description}>
                                {tenantId && (
                                    <JobsList monthCloseId={activeMonth.id} tenantId={tenantId} />
                                )}
                        </Section>
                </CardPremium>

                <CardPremium className="p-6">
                        <Section title={t.upload.uploadedFiles.title} subtitle={t.upload.uploadedFiles.description}>
                <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
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
                                                        <TableRow key={file.id} className={file.parseStatus === 'FAILED' ? 'bg-destructive/5' : undefined}>
                                <TableCell className="font-medium">{file.filename}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{t.upload.uploadedFiles.kinds[file.kind as keyof typeof t.upload.uploadedFiles.kinds]}</Badge>
                                </TableCell>
                                <TableCell>{file.createdAt ? formatDate(file.createdAt.toDate(), locale) : '...'}</TableCell>
                                <TableCell>
                                                                        <Badge variant={file.parseStatus === 'FAILED' ? 'destructive' : file.parseStatus === 'PENDING' ? 'default' : 'outline'}>
                                                                            {t.upload.uploadedFiles.statuses[(file.parseStatus ?? 'PENDING') as keyof typeof t.upload.uploadedFiles.statuses]}
                                                                        </Badge>
                                                                        {file.parseStatus === 'FAILED' && file.parseError ? (
                                                                            <p className="mt-1 text-xs text-destructive">{file.parseError}</p>
                                                                        ) : null}
                                </TableCell>
                                <TableCell className="text-right">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload(file)}
                                    disabled={!!downloadingFileId || file.parseStatus !== 'PARSED'}
                                >
                                    {downloadingFileId === file.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    {t.exports.download}
                                </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                                                        <div className="flex flex-col items-center gap-2 py-4">
                                                                            <UploadCloud className="h-5 w-5 text-muted-foreground" />
                                                                            <span>{t.upload.uploadedFiles.empty}</span>
                                                                        </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
                        </Section>
                </CardPremium>
      </>
      )}

            <AlertDialog open={!!pendingImport} onOpenChange={(open) => !open && setPendingImport(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t.upload.confirmImport.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingImport
                                ? t.upload.confirmImport.description
                                        .replace('{count}', String(pendingImport.files.length))
                                        .replace('{kind}', pendingImport.kind === 'BANK_CSV' ? t.upload.bankCsv.title : t.upload.invoicePdfs.title)
                                : t.upload.confirmImport.description.replace('{count}', '0').replace('{kind}', '')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t.upload.confirmImport.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmImport} disabled={isUploading}>
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t.upload.confirmImport.confirm}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
  );
}
