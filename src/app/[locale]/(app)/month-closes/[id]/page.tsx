"use client";

import { useEffect, useState, use, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CopyCheck,
  DownloadCloud,
  FileWarning,
  Receipt,
  Scale,
  UploadCloud,
  BarChart3,
} from "lucide-react";
import { useT, useLocale } from "@/i18n/provider";
import { formatMoney, formatDate } from "@/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { doc, onSnapshot, getDoc, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { MonthClose, MonthCloseStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  VatSummaryCard,
  MismatchSummaryCard,
  TimelineCard,
  FrictionCard,
  AuditorReplayCard,
} from "@/components/analytics";


const WorkflowStep = ({
  icon,
  title,
  status,
}: {
  icon: React.ElementType;
  title: string;
  status: "completed" | "current" | "pending";
}) => {
  const Icon = icon;
  return (
    <div
      className={cn("flex items-center gap-4", {
        "text-muted-foreground": status === "pending",
        "font-medium": status === "current",
      })}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
        {status === "completed" ? (
          <CheckCircle2 className="h-5 w-5 text-green-400" />
        ) : (
          <Icon
            className={cn("h-5 w-5", { "animate-spin": status === "current" })}
          />
        )}
      </div>
      <span>{title}</span>
    </div>
  );
};

type Translations = ReturnType<typeof useT>;

const WorkflowPanel = ({ status, t }: { status: MonthCloseStatus; t: Translations }) => {
    const statusToStep: Record<MonthCloseStatus, number> = {
      DRAFT: 1,
      IN_REVIEW: 4,
      FINALIZED: 5,
    };
    const currentStep = statusToStep[status] || 0;

  const steps = [
    { name: t.monthClose.workflow.steps.uploadBankCsv, icon: UploadCloud },
    { name: t.monthClose.workflow.steps.uploadInvoicePdfs, icon: UploadCloud },
    { name: t.monthClose.workflow.steps.reviewMatches, icon: CopyCheck },
    { name: t.monthClose.workflow.steps.resolveExceptions, icon: AlertTriangle },
    { name: t.monthClose.workflow.steps.lockAndExport, icon: DownloadCloud },
  ];

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep - 1) return "completed";
    if (stepIndex === currentStep - 1) return "current";
    return "pending";
  };
  
  const currentIcon = (stepIndex: number) => {
    return steps[stepIndex].icon;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t.monthClose.workflow.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {steps.map((step, index) => (
            <WorkflowStep
              key={step.name}
              icon={getStepStatus(index) === 'current' ? currentIcon(index) : step.icon}
              title={step.name}
              status={getStepStatus(index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const KpiCard = ({ title, value, description, icon: Icon, isLoading }: { title: string, value: string, description: string, icon: React.ElementType, isLoading: boolean }) => {
    return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-32 mt-1" /> : <div className="text-2xl font-bold">{value}</div> }
            {isLoading ? <Skeleton className="h-4 w-40 mt-2" /> : <p className="text-xs text-muted-foreground">{description}</p> }
          </CardContent>
        </Card>
    )
}

export default function MonthCloseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const [monthClose, setMonthClose] = useState<MonthClose | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Analytics state
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [vatSummary, setVatSummary] = useState<DocumentData | null>(null);
  const [mismatchSummary, setMismatchSummary] = useState<DocumentData | null>(null);
  const [timeline, setTimeline] = useState<DocumentData | null>(null);
  const [friction, setFriction] = useState<{ daysToClose: number; manualMatchPercent: number; exceptionPercent: number; frictionScore: number } | null>(null);
  const [auditorReplay, setAuditorReplay] = useState<{ asOfDateKey: string; bankTxCount: number; invoiceCount: number; matchCount: number; adjustmentCount: number; generatedAt: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "tenants", user.tenantId, "monthCloses", id);
    const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists() && doc.data().tenantId === user.tenantId) {
            setMonthClose({ id: doc.id, ...doc.data() } as MonthClose);
        } else {
            // Handle error or redirect, doc doesn't exist or tenant mismatch
            setMonthClose(null);
        }
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, id]);

  // Load analytics when month is finalized
  const loadAnalytics = useCallback(async () => {
    if (!user?.tenantId || !monthClose?.periodStart) return;
    
    setAnalyticsLoading(true);
    // Derive monthKey from periodStart (YYYY-MM format)
    const periodDate = monthClose.periodStart.toDate();
    const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      // Try to load from readmodels (for finalized months)
      const readmodelBasePath = `tenants/${user.tenantId}/readmodels`;
      
      const [vatSnap, mismatchSnap, timelineSnap, frictionSnap] = await Promise.all([
        getDoc(doc(db, `${readmodelBasePath}/vatSummary/${monthKey}/snapshot`)),
        getDoc(doc(db, `${readmodelBasePath}/mismatchSummary/${monthKey}/snapshot`)),
        getDoc(doc(db, `${readmodelBasePath}/monthCloseTimeline/${monthKey}/snapshot`)),
        getDoc(doc(db, `${readmodelBasePath}/closeFriction/${monthKey}/snapshot`)),
      ]);

      if (vatSnap.exists()) setVatSummary(vatSnap.data());
      if (mismatchSnap.exists()) setMismatchSummary(mismatchSnap.data());
      if (timelineSnap.exists()) setTimeline(timelineSnap.data());
      if (frictionSnap.exists()) {
        const data = frictionSnap.data();
        setFriction({
          daysToClose: data.daysToClose || 0,
          manualMatchPercent: data.manualMatchPercent || 0,
          exceptionPercent: data.exceptionPercent || 0,
          frictionScore: data.frictionScore || 0,
        });
      }

      // Load auditor replay summary
      const auditorSnap = await getDoc(doc(db, `${readmodelBasePath}/auditorReplay/${monthKey}/snapshot`));
      if (auditorSnap.exists()) {
        const data = auditorSnap.data();
        setAuditorReplay({
          asOfDateKey: data.asOfDateKey,
          bankTxCount: data.bankTx?.length || 0,
          invoiceCount: data.invoices?.length || 0,
          matchCount: data.matches?.length || 0,
          adjustmentCount: data.adjustments?.length || 0,
          generatedAt: data.generatedAt,
        });
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user?.tenantId, monthClose?.periodStart]);

  // Load analytics when month is finalized
  useEffect(() => {
    if (monthClose?.status === "FINALIZED") {
      loadAnalytics();
    }
  }, [monthClose?.status, loadAnalytics]);

  const handleAuditorDownload = useCallback(() => {
    if (!monthClose?.periodStart) return;
    const periodDate = monthClose.periodStart.toDate();
    const monthKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;
    console.log("Download auditor replay for", monthKey);
  }, [monthClose?.periodStart]);


  const statusMap: Record<MonthCloseStatus, { text: string; variant: "secondary" | "default" | "destructive" | "outline" | null | undefined }> = {
    DRAFT: { text: t.monthClose.status.DRAFT, variant: "outline" },
    IN_REVIEW: { text: t.monthClose.status.IN_REVIEW, variant: "default" },
    FINALIZED: { text: t.monthClose.status.FINALIZED, variant: "secondary" },
  };
  
  const NextActionButton = () => {
    if (!monthClose) return null;
    const status = monthClose.status;
    
    switch (status) {
      case "DRAFT":
        return <Button size="lg" asChild><Link href="/upload">{t.monthClose.nextAction.cta.DRAFT} <ArrowRight /></Link></Button>;
      case "IN_REVIEW":
        return <Button size="lg" asChild><Link href="/exceptions">{t.monthClose.nextAction.cta.IN_REVIEW} <ArrowRight /></Link></Button>;
      case "FINALIZED":
        return <Button size="lg" asChild><Link href="/exports">{t.monthClose.nextAction.cta.FINALIZED} <ArrowRight /></Link></Button>;
      default:
        return null;
    }
  };
  
  const periodLabel = monthClose ? formatDate(monthClose.periodStart.toDate(), locale, { month: 'long', year: 'numeric' }) : <Skeleton className="h-8 w-32" />;

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            {periodLabel}
          </h1>
          { !isLoading && monthClose &&
            <Badge variant={statusMap[monthClose.status].variant}>
              {statusMap[monthClose.status].text}
            </Badge>
          }
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
            title={t.monthClose.kpi.bankTotal}
            value={formatMoney(monthClose?.bankTotal || 0, locale)}
            description={t.monthClose.kpi.bankTotalDescription}
            icon={Banknote}
            isLoading={isLoading}
        />
         <KpiCard
            title={t.monthClose.kpi.invoiceTotal}
            value={formatMoney(monthClose?.invoiceTotal || 0, locale)}
            description={t.monthClose.kpi.invoiceTotalDescription}
            icon={Receipt}
            isLoading={isLoading}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.difference}</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> : <div className="text-2xl font-bold text-orange-400">{formatMoney(monthClose?.diff || 0, locale)}</div> }
             {isLoading ? <Skeleton className="h-4 w-36 mt-2" /> : <p className="text-xs text-muted-foreground">{t.monthClose.kpi.differenceDescription}</p> }
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.exceptions}</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> : <div className="text-2xl font-bold">{monthClose?.openExceptionsCount || 0} {t.monthClose.kpi.exceptionsOpen}</div>}
            {isLoading ? <Skeleton className="h-4 w-28 mt-2" /> : <p className="text-xs text-muted-foreground"><span className="font-semibold text-destructive">{monthClose?.highExceptionsCount || 0}</span> {t.monthClose.kpi.exceptionsHighSeverity}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
            {isLoading || !monthClose ? (
                <Card className="h-full"><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="space-y-6 mt-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>
            ): (
                <WorkflowPanel status={monthClose.status} t={t} />
            )}
        </div>
        <Card className="flex flex-col items-center justify-center p-6">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t.monthClose.nextAction.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
             {isLoading || !monthClose ? <Skeleton className="h-10 w-48" /> : (
                <>
                    <p className="text-center text-muted-foreground">
                        {t.monthClose.nextAction.description[monthClose.status]}
                    </p>
                    <NextActionButton />
                    {monthClose.status === "IN_REVIEW" && (
                        <div className="w-full mt-2">
                            <Progress value={50} className="w-full" />
                            <p className="text-center text-xs text-muted-foreground mt-2">50{t.monthClose.nextAction.progress}</p>
                        </div>
                    )}
                </>
             )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section - Only show for finalized months */}
      {monthClose?.status === "FINALIZED" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Analytics & Reports</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <VatSummaryCard data={vatSummary} loading={analyticsLoading} />
            <MismatchSummaryCard data={mismatchSummary} loading={analyticsLoading} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FrictionCard data={friction} loading={analyticsLoading} />
            <AuditorReplayCard 
              data={auditorReplay} 
              loading={analyticsLoading} 
              onDownload={handleAuditorDownload}
            />
          </div>

          <TimelineCard data={timeline} loading={analyticsLoading} />
        </div>
      )}
    </div>
  );
}
