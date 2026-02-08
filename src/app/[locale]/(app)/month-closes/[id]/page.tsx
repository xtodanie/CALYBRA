"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CopyCheck,
  DownloadCloud,
  FileWarning,
  Loader2,
  Receipt,
  Scale,
  UploadCloud,
} from "lucide-react";
import { useT, useLocale } from "@/i18n/provider";
import { formatMoney } from "@/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Status = "NO_CLOSE" | "DRAFT" | "PROCESSING" | "READY" | "LOCKED";

const kpiData: Record<Status, any> = {
    NO_CLOSE: { bankTotal: 0, invoiceTotal: 0, difference: 0, exceptions: 0, highSeverity: 0, progress: 0 },
    DRAFT: { bankTotal: 125430.22, invoiceTotal: 0, difference: 125430.22, exceptions: 0, highSeverity: 0, progress: 20 },
    PROCESSING: { bankTotal: 125430.22, invoiceTotal: 122100.98, difference: 3329.24, exceptions: 0, highSeverity: 0, progress: 50 },
    READY: { bankTotal: 125430.22, invoiceTotal: 122100.98, difference: 3329.24, exceptions: 17, highSeverity: 3, progress: 80 },
    LOCKED: { bankTotal: 125430.22, invoiceTotal: 125430.22, difference: 0, exceptions: 0, highSeverity: 0, progress: 100 },
}

const ActionButton = ({ status, setStatus, t }: { status: Status, setStatus: (status: Status) => void, t: any }) => {
  switch (status) {
    case "NO_CLOSE":
      return (
        <Button size="lg" onClick={() => setStatus("DRAFT")}>
          {t.monthClose.nextAction.cta.NO_CLOSE} <ArrowRight />
        </Button>
      );
    case "DRAFT":
      return <Button size="lg" onClick={() => setStatus("PROCESSING")}>{t.monthClose.nextAction.cta.DRAFT} <ArrowRight /></Button>;
    case "PROCESSING":
      return (
        <Button size="lg" disabled>
          <Loader2 className="animate-spin" />
          {t.monthClose.nextAction.cta.PROCESSING}
        </Button>
      );
    case "READY":
      return <Button size="lg" onClick={() => setStatus("LOCKED")}>{t.monthClose.nextAction.cta.READY} <ArrowRight /></Button>;
    case "LOCKED":
      return <Button size="lg">{t.monthClose.nextAction.cta.LOCKED} <ArrowRight /></Button>;
    default:
      return null;
  }
};

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

const WorkflowPanel = ({ currentStep, t }: { currentStep: number, t: any }) => {
  const steps = [
    { name: t.monthClose.workflow.steps.uploadBankCsv, icon: UploadCloud },
    { name: t.monthClose.workflow.steps.uploadInvoicePdfs, icon: UploadCloud },
    { name: t.monthClose.workflow.steps.reviewMatches, icon: CopyCheck },
    { name: t.monthClose.workflow.steps.resolveExceptions, icon: AlertTriangle },
    { name: t.monthClose.workflow.steps.lockAndExport, icon: DownloadCloud },
  ];

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep -1) return "completed";
    if (stepIndex === currentStep - 1) return "current";
    return "pending";
  };
  
  const currentIcon = (stepIndex: number) => {
    if (stepIndex === 2) return Loader2;
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

export default function MonthCloseDetailPage({ params }: { params: { id: string }}) {
  const [status, setStatus] = useState<Status>("DRAFT");
  const t = useT();
  const locale = useLocale();
  const data = kpiData[status];

  const statusMap: Record<
    Status,
    { text: string; variant: "secondary" | "default" | "destructive" | "outline" | null | undefined; workflowStep: number }
  > = {
    NO_CLOSE: { text: t.monthClose.status.NO_CLOSE, variant: "secondary", workflowStep: 0 },
    DRAFT: { text: t.monthClose.status.DRAFT, variant: "outline", workflowStep: 1 },
    PROCESSING: { text: t.monthClose.status.PROCESSING, variant: "default", workflowStep: 3 },
    READY: { text: t.monthClose.status.READY, variant: "default", workflowStep: 4 },
    LOCKED: { text: t.monthClose.status.LOCKED, variant: "secondary", workflowStep: 5 },
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            {t.monthClose.title}
          </h1>
          <Badge variant={statusMap[status].variant}>
            {statusMap[status].text}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Select defaultValue={params.id}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t.monthClose.monthSelectorPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="june-2024">{t.monthClose.sampleMonths.june}</SelectItem>
              <SelectItem value="may-2024">{t.monthClose.sampleMonths.may}</SelectItem>
              <SelectItem value="april-2024">{t.monthClose.sampleMonths.april}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.bankTotal}</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(data.bankTotal, locale)}</div>
            <p className="text-xs text-muted-foreground">{t.monthClose.kpi.bankTotalDescription}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.invoiceTotal}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(data.invoiceTotal, locale)}</div>
            <p className="text-xs text-muted-foreground">{t.monthClose.kpi.invoiceTotalDescription}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.difference}</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">{formatMoney(data.difference, locale)}</div>
            <p className="text-xs text-muted-foreground">{t.monthClose.kpi.differenceDescription}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.monthClose.kpi.exceptions}</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.exceptions} {t.monthClose.kpi.exceptionsOpen}</div>
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-destructive">{data.highSeverity}</span> {t.monthClose.kpi.exceptionsHighSeverity}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WorkflowPanel currentStep={statusMap[status].workflowStep} t={t} />
        </div>
        <Card className="flex flex-col items-center justify-center p-6">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t.monthClose.nextAction.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-center text-muted-foreground">
              {t.monthClose.nextAction.description[status]}
            </p>
            <ActionButton status={status} setStatus={setStatus} t={t} />
            {status === "PROCESSING" && (
                <div className="w-full mt-2">
                    <Progress value={data.progress} className="w-full" />
                    <p className="text-center text-xs text-muted-foreground mt-2">{data.progress}{t.monthClose.nextAction.progress}</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
