"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Circle,
  CopyCheck,
  DownloadCloud,
  FileWarning,
  Loader2,
  Receipt,
  Scale,
  UploadCloud,
} from "lucide-react";

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

const statusMap: Record<
  Status,
  { text: string;- variant: "secondary" | "default" | "destructive" | "outline" | null | undefined; workflowStep: number }
> = {
  NO_CLOSE: { text: "Not Started", variant: "secondary", workflowStep: 0 },
  DRAFT: { text: "Draft", variant: "outline", workflowStep: 1 },
  PROCESSING: { text: "Processing", variant: "default", workflowStep: 3 },
  READY: { text: "Ready for Review", variant: "default", workflowStep: 4 },
  LOCKED: { text: "Locked", variant: "secondary", workflowStep: 5 },
};

const kpiData: Record<Status, any> = {
    NO_CLOSE: { bankTotal: 0, invoiceTotal: 0, difference: 0, exceptions: 0, highSeverity: 0, progress: 0 },
    DRAFT: { bankTotal: 125430.22, invoiceTotal: 0, difference: 125430.22, exceptions: 0, highSeverity: 0, progress: 20 },
    PROCESSING: { bankTotal: 125430.22, invoiceTotal: 122100.98, difference: 3329.24, exceptions: 0, highSeverity: 0, progress: 50 },
    READY: { bankTotal: 125430.22, invoiceTotal: 122100.98, difference: 3329.24, exceptions: 17, highSeverity: 3, progress: 80 },
    LOCKED: { bankTotal: 125430.22, invoiceTotal: 125430.22, difference: 0, exceptions: 0, highSeverity: 0, progress: 100 },
}


const ActionButton = ({ status, setStatus }: { status: Status, setStatus: (status: Status) => void }) => {
  switch (status) {
    case "NO_CLOSE":
      return (
        <Button size="lg" onClick={() => setStatus("DRAFT")}>
          Start a New Month <ArrowRight />
        </Button>
      );
    case "DRAFT":
      return <Button size="lg" onClick={() => setStatus("PROCESSING")}>Upload Bank Statement <ArrowRight /></Button>;
    case "PROCESSING":
      return (
        <Button size="lg" disabled>
          <Loader2 className="animate-spin" />
          Processing Data...
        </Button>
      );
    case "READY":
      return <Button size="lg" onClick={() => setStatus("LOCKED")}>Review Exceptions <ArrowRight /></Button>;
    case "LOCKED":
      return <Button size="lg">Generate Export <ArrowRight /></Button>;
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

const WorkflowPanel = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { name: "Upload Bank CSV", icon: UploadCloud },
    { name: "Upload Invoice PDFs", icon: UploadCloud },
    { name: "Review Proposed Matches", icon: CopyCheck },
    { name: "Resolve Exceptions", icon: AlertTriangle },
    { name: "Lock & Export", icon: DownloadCloud },
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
        <CardTitle>Your Reconciliation Workflow</CardTitle>
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

export default function DashboardPage() {
  const [status, setStatus] = useState<Status>("DRAFT");
  const data = kpiData[status];

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Current Month
          </h1>
          <Badge variant={statusMap[status].variant}>
            {statusMap[status].text}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Select defaultValue="june-2024">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="june-2024">June 2024</SelectItem>
              <SelectItem value="may-2024">May 2024</SelectItem>
              <SelectItem value="april-2024">April 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Total</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.bankTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">From uploaded bank statement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoice Total</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.invoiceTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">From all uploaded invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Difference</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">${data.difference.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">The remaining amount to reconcile</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.exceptions} Open</div>
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-destructive">{data.highSeverity}</span> high severity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WorkflowPanel currentStep={statusMap[status].workflowStep} />
        </div>
        <Card className="flex flex-col items-center justify-center p-6">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-center text-muted-foreground">
              {status === "NO_CLOSE" && "Start by creating a new closing period for the month."}
              {status === "DRAFT" && "It's time to upload your bank statement to get started."}
              {status === "PROCESSING" && "We're analyzing your data. This might take a few moments."}
              {status === "READY" && "Your proposed matches are ready. Time to resolve exceptions."}
              {status === "LOCKED" && "This month is all done. You can now export your reports."}
            </p>
            <ActionButton status={status} setStatus={setStatus} />
            {status === "PROCESSING" && (
                <div className="w-full mt-2">
                    <Progress value={data.progress} className="w-full" />
                    <p className="text-center text-xs text-muted-foreground mt-2">{data.progress}% complete</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
