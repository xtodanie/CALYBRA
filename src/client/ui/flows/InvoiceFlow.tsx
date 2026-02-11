"use client";

/**
 * Invoice Flow - UX orchestration for invoice creation and management
 *
 * INVARIANT: All invoice operations go through this flow
 * INVARIANT: Preview derived data before creation
 * INVARIANT: Confirmation is required
 * INVARIANT: Resulting state is shown
 */

import React, { useState, useCallback } from "react";
import { Functions } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import {
  executeCreateInvoiceFromParse,
  executeCreateInvoiceManual,
  CreateInvoiceFromParseInput,
  CreateInvoiceManualInput,
  CreateInvoiceResult,
} from "../../workflows/createInvoice.action";
import { OrchestrationError } from "../../events/errors";
import { MonthCloseStatus, UserRole } from "@/lib/types";

// ============================================================================
// FLOW STATE
// ============================================================================

export interface InvoiceFlowState {
  readonly phase: "IDLE" | "PREVIEW" | "CREATING" | "COMPLETE" | "ERROR";
  readonly progress: number;
  readonly previewData?: InvoicePreviewData;
  readonly createResult?: CreateInvoiceResult;
  readonly error?: OrchestrationError;
  readonly explanation: string;
  readonly nextActions: readonly string[];
}

export interface InvoicePreviewData {
  readonly invoiceNumber: string;
  readonly supplierName: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly totalGrossFormatted: string;
  readonly vatRate?: number;
  readonly confidence?: number;
  readonly confidenceLabel?: string;
  readonly warnings: readonly string[];
}

const INITIAL_STATE: InvoiceFlowState = {
  phase: "IDLE",
  progress: 0,
  explanation: "Ready to create invoices",
  nextActions: ["Upload an invoice PDF or enter details manually"],
};

// ============================================================================
// FLOW PROPS
// ============================================================================

export interface InvoiceFlowProps {
  readonly functions: Functions;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly monthCloseStatus: MonthCloseStatus;
  readonly onComplete?: (result: CreateInvoiceResult) => void;
  readonly onError?: (error: OrchestrationError) => void;
  readonly children: (props: InvoiceFlowRenderProps) => React.ReactNode;
}

export interface InvoiceFlowRenderProps {
  readonly state: InvoiceFlowState;
  readonly canCreate: boolean;
  readonly canConfirm: boolean;
  readonly canCancel: boolean;
  readonly previewFromParse: (sourceFileId: string, extractedData: ExtractedInvoiceData) => void;
  readonly previewManual: (data: ManualInvoiceData) => void;
  readonly confirmCreate: () => Promise<void>;
  readonly cancelCreate: () => void;
  readonly reset: () => void;
}

export interface ExtractedInvoiceData {
  readonly invoiceNumber: string;
  readonly supplierName: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly vatRate?: number;
  readonly confidence: number;
}

export interface ManualInvoiceData {
  readonly invoiceNumber: string;
  readonly supplierName: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly vatRate?: number;
}

// ============================================================================
// FLOW COMPONENT
// ============================================================================

export function InvoiceFlow({
  functions,
  tenantId,
  monthCloseId,
  monthCloseStatus,
  onComplete,
  onError,
  children,
}: InvoiceFlowProps): React.ReactNode {
  const { user } = useAuth();
  const [state, setState] = useState<InvoiceFlowState>(INITIAL_STATE);
  const [pendingCreate, setPendingCreate] = useState<{
    type: "parse" | "manual";
    input: CreateInvoiceFromParseInput | CreateInvoiceManualInput;
  } | null>(null);

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;
  const isFinalized = monthCloseStatus === MonthCloseStatus.FINALIZED;

  // Determine allowed actions
  const canCreate = !isFinalized && state.phase === "IDLE";
  const canConfirm = state.phase === "PREVIEW" && pendingCreate !== null;
  const canCancel = state.phase === "PREVIEW";

  // Format currency helper
  const formatCurrency = (cents: number): string => {
    const euros = cents / 100;
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(euros);
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.95) return "Very High";
    if (confidence >= 0.85) return "High";
    if (confidence >= 0.7) return "Medium";
    if (confidence >= 0.5) return "Low";
    return "Very Low";
  };

  // Preview from parsed data
  const previewFromParse = useCallback(
    (sourceFileId: string, extractedData: ExtractedInvoiceData) => {
      if (isFinalized) return;

      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const warnings: string[] = [];

      if (extractedData.confidence < 0.7) {
        warnings.push("Low extraction confidence - please verify data");
      }
      if (!extractedData.vatRate) {
        warnings.push("VAT rate could not be extracted");
      }

      const previewData: InvoicePreviewData = {
        invoiceNumber: extractedData.invoiceNumber,
        supplierName: extractedData.supplierName,
        issueDate: extractedData.issueDate,
        totalGross: extractedData.totalGross,
        totalGrossFormatted: formatCurrency(extractedData.totalGross),
        vatRate: extractedData.vatRate,
        confidence: extractedData.confidence,
        confidenceLabel: getConfidenceLabel(extractedData.confidence),
        warnings,
      };

      const input: CreateInvoiceFromParseInput = {
        invoiceId,
        tenantId,
        monthCloseId,
        sourceFileId,
      };

      setPendingCreate({ type: "parse", input });
      setState({
        phase: "PREVIEW",
        progress: 50,
        previewData,
        explanation: "Review the extracted invoice data before creating",
        nextActions: [
          "Verify all fields are correct",
          "Confirm to create the invoice",
          "Cancel to discard",
        ],
      });
    },
    [tenantId, monthCloseId, isFinalized]
  );

  // Preview manual entry
  const previewManual = useCallback(
    (data: ManualInvoiceData) => {
      if (isFinalized) return;

      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const previewData: InvoicePreviewData = {
        invoiceNumber: data.invoiceNumber,
        supplierName: data.supplierName,
        issueDate: data.issueDate,
        totalGross: data.totalGross,
        totalGrossFormatted: formatCurrency(data.totalGross),
        vatRate: data.vatRate,
        warnings: [],
      };

      const input: CreateInvoiceManualInput = {
        invoiceId,
        tenantId,
        monthCloseId,
        supplierName: data.supplierName,
        invoiceNumber: data.invoiceNumber,
        issueDate: data.issueDate,
        totalGross: data.totalGross,
        vatRate: data.vatRate,
      };

      setPendingCreate({ type: "manual", input });
      setState({
        phase: "PREVIEW",
        progress: 50,
        previewData,
        explanation: "Review the invoice data before creating",
        nextActions: [
          "Verify all fields are correct",
          "Confirm to create the invoice",
          "Cancel to discard",
        ],
      });
    },
    [tenantId, monthCloseId, isFinalized]
  );

  // Confirm create
  const confirmCreate = useCallback(async () => {
    if (!pendingCreate) return;

    setState((prev) => ({
      ...prev,
      phase: "CREATING",
      progress: 75,
      explanation: "Creating invoice...",
      nextActions: [],
    }));

    const context = { role, monthCloseStatus };

    let result;
    if (pendingCreate.type === "parse") {
      result = await executeCreateInvoiceFromParse(
        functions,
        pendingCreate.input as CreateInvoiceFromParseInput,
        context
      );
    } else {
      result = await executeCreateInvoiceManual(
        functions,
        pendingCreate.input as CreateInvoiceManualInput,
        context
      );
    }

    if (result.success && result.execution) {
      const createResult = result.execution.result!;
      setState({
        phase: "COMPLETE",
        progress: 100,
        previewData: state.previewData,
        createResult,
        explanation: createResult.needsReview
          ? "Invoice created but needs review due to low confidence"
          : "Invoice created successfully",
        nextActions: [
          "View invoice details",
          "Create another invoice",
          "Run matching to find transactions",
        ],
      });
      setPendingCreate(null);
      onComplete?.(createResult);
    } else {
      const error = result.error!;
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error,
        explanation: error.userMessage,
        nextActions: error.retryable ? ["Try again"] : ["Check data and permissions"],
      }));
      onError?.(error);
    }
  }, [pendingCreate, functions, role, monthCloseStatus, state.previewData, onComplete, onError]);

  // Cancel create
  const cancelCreate = useCallback(() => {
    setPendingCreate(null);
    setState(INITIAL_STATE);
  }, []);

  // Reset
  const reset = useCallback(() => {
    setPendingCreate(null);
    setState(INITIAL_STATE);
  }, []);

  return children({
    state,
    canCreate,
    canConfirm,
    canCancel,
    previewFromParse,
    previewManual,
    confirmCreate,
    cancelCreate,
    reset,
  });
}

// ============================================================================
// HELPER HOOK
// ============================================================================

export function useInvoiceFlow(
  functions: Functions,
  tenantId: string,
  monthCloseId: string,
  monthCloseStatus: MonthCloseStatus
) {
  const [state, setState] = useState<InvoiceFlowState>(INITIAL_STATE);
  const { user } = useAuth();

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  const createFromParse = useCallback(
    async (sourceFileId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "CREATING",
        explanation: "Creating invoice...",
      }));

      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const result = await executeCreateInvoiceFromParse(
        functions,
        { invoiceId, tenantId, monthCloseId, sourceFileId },
        { role, monthCloseStatus }
      );

      if (result.success) {
        setState({
          phase: "COMPLETE",
          progress: 100,
          createResult: result.execution?.result,
          explanation: "Invoice created",
          nextActions: ["Run matching"],
        });
        return result.execution?.result;
      } else {
        setState({
          phase: "ERROR",
          progress: 0,
          error: result.error,
          explanation: result.error?.userMessage ?? "Failed",
          nextActions: ["Try again"],
        });
        throw result.error;
      }
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role]
  );

  const createManual = useCallback(
    async (data: ManualInvoiceData) => {
      setState((prev) => ({
        ...prev,
        phase: "CREATING",
        explanation: "Creating invoice...",
      }));

      const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const result = await executeCreateInvoiceManual(
        functions,
        {
          invoiceId,
          tenantId,
          monthCloseId,
          ...data,
        },
        { role, monthCloseStatus }
      );

      if (result.success) {
        setState({
          phase: "COMPLETE",
          progress: 100,
          createResult: result.execution?.result,
          explanation: "Invoice created",
          nextActions: ["Run matching"],
        });
        return result.execution?.result;
      } else {
        setState({
          phase: "ERROR",
          progress: 0,
          error: result.error,
          explanation: result.error?.userMessage ?? "Failed",
          nextActions: ["Try again"],
        });
        throw result.error;
      }
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    createFromParse,
    createManual,
    reset,
    isCreating: state.phase === "CREATING",
    isComplete: state.phase === "COMPLETE",
    hasError: state.phase === "ERROR",
  };
}
