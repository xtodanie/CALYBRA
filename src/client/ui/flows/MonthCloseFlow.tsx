"use client";

/**
 * Month Close Flow - UX orchestration for month close operations
 *
 * INVARIANT: All month close operations go through this flow
 * INVARIANT: Inputs are shown before submission
 * INVARIANT: Computed aggregates are displayed
 * INVARIANT: Irreversible confirmation is emphasized
 * INVARIANT: Finality is unmistakable
 */

import React, { useState, useCallback, useMemo } from "react";
import { Functions } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import {
  executeCreateMonthClose,
  executeSubmitForReview,
  executeReturnToDraft,
  executeFinalizeMonth,
  executeComputeAggregates,
  CreateMonthCloseInput,
  TransitionMonthCloseResult,
  ComputeAggregatesResult,
} from "../../workflows/monthClose.action";
import { OrchestrationError } from "../../events/errors";
import {
  explainMonthCloseStatus,
  getContextualGuidance,
} from "../../events/explanations";
import { selectMonthCloseState, selectFlowState, FlowState, MonthCloseState } from "../../state/selectors";
import { projectMonthCloseSummary, MonthCloseSummary } from "../../state/projections";
import { MonthCloseStatus, UserRole } from "@/lib/types";

// ============================================================================
// FLOW STATE
// ============================================================================

export interface MonthCloseFlowState {
  readonly phase: "IDLE" | "CREATING" | "TRANSITIONING" | "COMPUTING" | "FINALIZING" | "COMPLETE" | "ERROR";
  readonly progress: number;
  readonly aggregates?: ComputeAggregatesResult;
  readonly transitionResult?: TransitionMonthCloseResult;
  readonly error?: OrchestrationError;
  readonly explanation: string;
  readonly nextActions: readonly string[];
  readonly warnings: readonly string[];
  readonly showFinalizeConfirmation: boolean;
}

const INITIAL_STATE: MonthCloseFlowState = {
  phase: "IDLE",
  progress: 0,
  explanation: "",
  nextActions: [],
  warnings: [],
  showFinalizeConfirmation: false,
};

// ============================================================================
// FLOW PROPS
// ============================================================================

export interface MonthCloseFlowProps {
  readonly functions: Functions;
  readonly tenantId: string;
  readonly monthClose?: {
    id: string;
    status: MonthCloseStatus;
    periodStart: Date;
    periodEnd: Date;
    currency: "EUR";
  };
  readonly aggregates?: {
    bankTxCount: number;
    invoiceCount: number;
    matchedCount: number;
    unmatchedBankCount: number;
    unmatchedInvoiceCount: number;
    openExceptionsCount: number;
    highExceptionsCount?: number;
    bankTotal: number;
    invoiceTotal: number;
    matchedTotal: number;
    unmatchedBankTotal: number;
    unmatchedInvoiceTotal: number;
  };
  readonly onStatusChange?: (newStatus: MonthCloseStatus) => void;
  readonly onError?: (error: OrchestrationError) => void;
  readonly children: (props: MonthCloseFlowRenderProps) => React.ReactNode;
}

export interface MonthCloseFlowRenderProps {
  readonly state: MonthCloseFlowState;
  readonly monthCloseState?: MonthCloseState;
  readonly summary?: MonthCloseSummary;
  readonly flowProgress: FlowState;
  readonly guidance: readonly string[];
  readonly canCreate: boolean;
  readonly canSubmitForReview: boolean;
  readonly canReturnToDraft: boolean;
  readonly canFinalize: boolean;
  readonly canComputeAggregates: boolean;
  readonly createMonthClose: (input: CreateMonthCloseInput) => Promise<void>;
  readonly submitForReview: () => Promise<void>;
  readonly returnToDraft: () => Promise<void>;
  readonly requestFinalize: () => void;
  readonly confirmFinalize: () => Promise<void>;
  readonly cancelFinalize: () => void;
  readonly computeAggregates: () => Promise<void>;
  readonly getStatusExplanation: () => string;
}

// ============================================================================
// FLOW COMPONENT
// ============================================================================

export function MonthCloseFlow({
  functions,
  tenantId,
  monthClose,
  aggregates,
  onStatusChange,
  onError,
  children,
}: MonthCloseFlowProps): React.ReactNode {
  const { user } = useAuth();
  const [state, setState] = useState<MonthCloseFlowState>(() => {
    if (monthClose) {
      const statusExplanation = explainMonthCloseStatus(monthClose.status);
      return {
        ...INITIAL_STATE,
        explanation: statusExplanation.description,
        nextActions: statusExplanation.nextActions,
        warnings: statusExplanation.warnings ?? [],
      };
    }
    return {
      ...INITIAL_STATE,
      explanation: "No month close selected",
      nextActions: ["Create a new month close or select an existing one"],
    };
  });

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  // Derived state
  const monthCloseState = useMemo(() => {
    if (!monthClose) return undefined;
    return selectMonthCloseState(
      monthClose,
      aggregates?.openExceptionsCount ?? 0,
      aggregates?.highExceptionsCount ?? 0
    );
  }, [monthClose, aggregates]);

  const summary = useMemo(() => {
    if (!monthClose || !aggregates) return undefined;
    return projectMonthCloseSummary(monthClose, aggregates);
  }, [monthClose, aggregates]);

  const flowProgress = useMemo(() => {
    if (!monthClose) {
      return {
        phase: "UPLOAD" as const,
        progress: 0,
        nextAction: "Create a month close to get started",
        blockers: [],
      };
    }
    return selectFlowState(
      monthClose.status,
      aggregates?.bankTxCount ?? 0,
      aggregates?.bankTxCount ?? 0, // Assume parsed
      aggregates?.matchedCount ?? 0,
      aggregates?.matchedCount ?? 0, // Proposed = matched for now
      aggregates?.openExceptionsCount ?? 0
    );
  }, [monthClose, aggregates]);

  const guidance = useMemo(() => {
    if (!monthClose) return ["Create a month close to begin"];
    return getContextualGuidance(
      monthClose.status,
      (aggregates?.bankTxCount ?? 0) > 0 || (aggregates?.invoiceCount ?? 0) > 0,
      true,
      (aggregates?.matchedCount ?? 0) > 0,
      aggregates?.openExceptionsCount ?? 0
    );
  }, [monthClose, aggregates]);

  // Determine allowed actions
  const isDraft = monthClose?.status === MonthCloseStatus.DRAFT;
  const isInReview = monthClose?.status === MonthCloseStatus.IN_REVIEW;
  const isFinalized = monthClose?.status === MonthCloseStatus.FINALIZED;

  const canCreate = !monthClose;
  const canSubmitForReview = isDraft && state.phase !== "TRANSITIONING";
  const canReturnToDraft = isInReview && state.phase !== "TRANSITIONING";
  const canFinalize = isInReview && 
    state.phase !== "FINALIZING" && 
    (aggregates?.openExceptionsCount ?? 0) === 0;
  const canComputeAggregates = !isFinalized && state.phase !== "COMPUTING";

  // Create month close handler
  const createMonthClose = useCallback(
    async (input: CreateMonthCloseInput) => {
      setState((prev) => ({
        ...prev,
        phase: "CREATING",
        progress: 30,
        explanation: "Creating month close...",
        nextActions: [],
      }));

      const result = await executeCreateMonthClose(
        functions,
        input,
        { role }
      );

      if (result.success && result.execution) {
        // Result contains the created month close reference
        setState({
          phase: "COMPLETE",
          progress: 100,
          explanation: "Month close created successfully",
          nextActions: [
            "Upload bank statements",
            "Upload invoices",
            "Run matching when ready",
          ],
          warnings: [],
          showFinalizeConfirmation: false,
        });
        onStatusChange?.(MonthCloseStatus.DRAFT);
      } else {
        const error = result.error!;
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          error,
          explanation: error.userMessage,
          nextActions: ["Try again with different period"],
        }));
        onError?.(error);
      }
    },
    [functions, role, onStatusChange, onError]
  );

  // Submit for review handler
  const submitForReview = useCallback(async () => {
    if (!monthClose) return;

    setState((prev) => ({
      ...prev,
      phase: "TRANSITIONING",
      progress: 50,
      explanation: "Submitting for review...",
      nextActions: [],
    }));

    const result = await executeSubmitForReview(
      functions,
      { monthCloseId: monthClose.id, tenantId },
      { role, monthCloseStatus: monthClose.status }
    );

    if (result.success) {
      const statusExplanation = explainMonthCloseStatus(MonthCloseStatus.IN_REVIEW);
      setState({
        phase: "COMPLETE",
        progress: 100,
        transitionResult: result.execution?.result,
        explanation: "Submitted for review successfully",
        nextActions: statusExplanation.nextActions,
        warnings: statusExplanation.warnings ?? [],
        showFinalizeConfirmation: false,
      });
      onStatusChange?.(MonthCloseStatus.IN_REVIEW);
    } else {
      const error = result.error!;
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error,
        explanation: error.userMessage,
        nextActions: ["Try again"],
      }));
      onError?.(error);
    }
  }, [functions, monthClose, tenantId, role, onStatusChange, onError]);

  // Return to draft handler
  const returnToDraft = useCallback(async () => {
    if (!monthClose) return;

    setState((prev) => ({
      ...prev,
      phase: "TRANSITIONING",
      progress: 50,
      explanation: "Returning to draft...",
      nextActions: [],
    }));

    const result = await executeReturnToDraft(
      functions,
      { monthCloseId: monthClose.id, tenantId },
      { role, monthCloseStatus: monthClose.status }
    );

    if (result.success) {
      const statusExplanation = explainMonthCloseStatus(MonthCloseStatus.DRAFT);
      setState({
        phase: "COMPLETE",
        progress: 100,
        transitionResult: result.execution?.result,
        explanation: "Returned to draft successfully",
        nextActions: statusExplanation.nextActions,
        warnings: [],
        showFinalizeConfirmation: false,
      });
      onStatusChange?.(MonthCloseStatus.DRAFT);
    } else {
      const error = result.error!;
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error,
        explanation: error.userMessage,
        nextActions: ["Try again"],
      }));
      onError?.(error);
    }
  }, [functions, monthClose, tenantId, role, onStatusChange, onError]);

  // Request finalize - shows confirmation
  const requestFinalize = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showFinalizeConfirmation: true,
      warnings: [
        "FINALIZATION IS IRREVERSIBLE",
        "This month close cannot be modified after finalization",
        "All data will be locked permanently",
      ],
    }));
  }, []);

  // Confirm finalize
  const confirmFinalize = useCallback(async () => {
    if (!monthClose) return;

    setState((prev) => ({
      ...prev,
      phase: "FINALIZING",
      progress: 50,
      showFinalizeConfirmation: false,
      explanation: "FINALIZING - THIS IS IRREVERSIBLE...",
      nextActions: [],
      warnings: ["DO NOT CLOSE THIS PAGE"],
    }));

    const result = await executeFinalizeMonth(
      functions,
      { monthCloseId: monthClose.id, tenantId },
      {
        role,
        monthCloseStatus: monthClose.status,
        openExceptionsCount: aggregates?.openExceptionsCount ?? 0,
        highExceptionsCount: aggregates?.highExceptionsCount ?? 0,
      }
    );

    if (result.success) {
      const statusExplanation = explainMonthCloseStatus(MonthCloseStatus.FINALIZED);
      setState({
        phase: "COMPLETE",
        progress: 100,
        transitionResult: result.execution?.result,
        explanation: "MONTH CLOSE FINALIZED SUCCESSFULLY",
        nextActions: statusExplanation.nextActions,
        warnings: statusExplanation.warnings ?? [],
        showFinalizeConfirmation: false,
      });
      onStatusChange?.(MonthCloseStatus.FINALIZED);
    } else {
      const error = result.error!;
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error,
        explanation: error.userMessage,
        nextActions: ["Review error and try again if appropriate"],
        warnings: [],
        showFinalizeConfirmation: false,
      }));
      onError?.(error);
    }
  }, [functions, monthClose, tenantId, role, aggregates, onStatusChange, onError]);

  // Cancel finalize
  const cancelFinalize = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showFinalizeConfirmation: false,
      warnings: [],
    }));
  }, []);

  // Compute aggregates handler
  const computeAggregates = useCallback(async () => {
    if (!monthClose) return;

    setState((prev) => ({
      ...prev,
      phase: "COMPUTING",
      progress: 50,
      explanation: "Computing reconciliation data...",
      nextActions: [],
    }));

    const result = await executeComputeAggregates(
      functions,
      { monthCloseId: monthClose.id, tenantId },
      { role, monthCloseStatus: monthClose.status }
    );

    if (result.success) {
      setState((prev) => ({
        ...prev,
        phase: "IDLE",
        progress: 0,
        aggregates: result.execution?.result,
        explanation: "Aggregates computed successfully",
        nextActions: ["Review the reconciliation summary"],
      }));
    } else {
      const error = result.error!;
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error,
        explanation: error.userMessage,
        nextActions: ["Try again"],
      }));
      onError?.(error);
    }
  }, [functions, monthClose, tenantId, role, onError]);

  // Get status explanation
  const getStatusExplanation = useCallback(() => {
    if (!monthClose) return "No month close selected";
    const explanation = explainMonthCloseStatus(monthClose.status);
    return explanation.description;
  }, [monthClose]);

  return children({
    state,
    monthCloseState,
    summary,
    flowProgress,
    guidance,
    canCreate,
    canSubmitForReview,
    canReturnToDraft,
    canFinalize,
    canComputeAggregates,
    createMonthClose,
    submitForReview,
    returnToDraft,
    requestFinalize,
    confirmFinalize,
    cancelFinalize,
    computeAggregates,
    getStatusExplanation,
  });
}

// ============================================================================
// HELPER HOOK
// ============================================================================

export function useMonthCloseFlow(
  functions: Functions,
  tenantId: string,
  monthCloseId: string | undefined,
  monthCloseStatus: MonthCloseStatus | undefined,
  exceptionCounts?: {
    openExceptionsCount?: number;
    highExceptionsCount?: number;
  }
) {
  const { user } = useAuth();
  const [state, setState] = useState<MonthCloseFlowState>(INITIAL_STATE);

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  const submitForReview = useCallback(async () => {
    if (!monthCloseId || monthCloseStatus !== MonthCloseStatus.DRAFT) return;

    setState((prev) => ({
      ...prev,
      phase: "TRANSITIONING",
      explanation: "Submitting...",
    }));

    const result = await executeSubmitForReview(
      functions,
      { monthCloseId, tenantId },
      { role, monthCloseStatus }
    );

    if (result.success) {
      setState((prev) => ({
        ...prev,
        phase: "COMPLETE",
        explanation: "Submitted for review",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error: result.error,
        explanation: result.error?.userMessage ?? "Failed",
      }));
      throw result.error;
    }
  }, [functions, monthCloseId, tenantId, monthCloseStatus, role]);

  const finalize = useCallback(async () => {
    if (!monthCloseId || monthCloseStatus !== MonthCloseStatus.IN_REVIEW) return;

    setState((prev) => ({
      ...prev,
      phase: "FINALIZING",
      explanation: "FINALIZING...",
    }));

    const result = await executeFinalizeMonth(
      functions,
      { monthCloseId, tenantId },
      {
        role,
        monthCloseStatus,
        openExceptionsCount: exceptionCounts?.openExceptionsCount ?? 0,
        highExceptionsCount: exceptionCounts?.highExceptionsCount ?? 0,
      }
    );

    if (result.success) {
      setState({
        phase: "COMPLETE",
        progress: 100,
        explanation: "FINALIZED",
        nextActions: [],
        warnings: [],
        showFinalizeConfirmation: false,
      });
    } else {
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error: result.error,
        explanation: result.error?.userMessage ?? "Failed",
      }));
      throw result.error;
    }
  }, [functions, monthCloseId, tenantId, monthCloseStatus, role, exceptionCounts]);

  return {
    state,
    submitForReview,
    finalize,
    isTransitioning: state.phase === "TRANSITIONING",
    isFinalizing: state.phase === "FINALIZING",
    isComplete: state.phase === "COMPLETE",
    hasError: state.phase === "ERROR",
  };
}
