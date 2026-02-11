"use client";

/**
 * Matching Flow - UX orchestration for matching operations
 *
 * INVARIANT: All matching operations go through this flow
 * INVARIANT: Match confidence is always shown
 * INVARIANT: Confirmation is always required
 * INVARIANT: Ambiguity is handled cleanly
 */

import React, { useState, useCallback, useMemo } from "react";
import { Functions } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import {
  executeRunMatching,
  executeConfirmMatch,
  executeRejectMatch,
  RunMatchingResult,
} from "../../workflows/match.action";
import { OrchestrationError } from "../../events/errors";
import { explainMatchStatus } from "../../events/explanations";
import { projectMatchList, MatchListItem } from "../../state/projections";
import { MonthCloseStatus, MatchStatus, MatchType, UserRole } from "@/lib/types";

// ============================================================================
// FLOW STATE
// ============================================================================

export interface MatchingFlowState {
  readonly phase: "IDLE" | "RUNNING" | "REVIEWING" | "CONFIRMING" | "COMPLETE" | "ERROR";
  readonly progress: number;
  readonly matchResult?: RunMatchingResult;
  readonly selectedMatchId?: string;
  readonly pendingConfirm: readonly string[];
  readonly pendingReject: readonly string[];
  readonly confirmedIds: readonly string[];
  readonly rejectedIds: readonly string[];
  readonly error?: OrchestrationError;
  readonly explanation: string;
  readonly nextActions: readonly string[];
}

const INITIAL_STATE: MatchingFlowState = {
  phase: "IDLE",
  progress: 0,
  pendingConfirm: [],
  pendingReject: [],
  confirmedIds: [],
  rejectedIds: [],
  explanation: "Ready to run matching",
  nextActions: ["Run matching to find invoice-transaction links"],
};

// ============================================================================
// FLOW PROPS
// ============================================================================

export interface MatchingFlowProps {
  readonly functions: Functions;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly monthCloseStatus: MonthCloseStatus;
  readonly matches: readonly {
    id: string;
    status: MatchStatus;
    matchType: MatchType;
    confidence: number;
    bankTxId: string;
    invoiceId: string;
  }[];
  readonly bankTxMap: Map<string, { amount: number; date: string; description: string }>;
  readonly invoiceMap: Map<string, { amount: number; invoiceNumber: string; supplierName: string }>;
  readonly onMatchConfirmed?: (matchId: string) => void;
  readonly onMatchRejected?: (matchId: string) => void;
  readonly onMatchingComplete?: (result: RunMatchingResult) => void;
  readonly onError?: (error: OrchestrationError) => void;
  readonly children: (props: MatchingFlowRenderProps) => React.ReactNode;
}

export interface MatchingFlowRenderProps {
  readonly state: MatchingFlowState;
  readonly matchList: readonly MatchListItem[];
  readonly proposedMatches: readonly MatchListItem[];
  readonly confirmedMatches: readonly MatchListItem[];
  readonly rejectedMatches: readonly MatchListItem[];
  readonly selectedMatch?: MatchListItem;
  readonly canRunMatching: boolean;
  readonly canConfirmSelected: boolean;
  readonly canRejectSelected: boolean;
  readonly canConfirmAll: boolean;
  readonly runMatching: () => Promise<void>;
  readonly selectMatch: (matchId: string) => void;
  readonly confirmMatch: (matchId: string) => Promise<void>;
  readonly rejectMatch: (matchId: string) => Promise<void>;
  readonly confirmAllProposed: () => Promise<void>;
  readonly getMatchExplanation: (matchId: string) => string;
}

// ============================================================================
// FLOW COMPONENT
// ============================================================================

export function MatchingFlow({
  functions,
  tenantId,
  monthCloseId,
  monthCloseStatus,
  matches,
  bankTxMap,
  invoiceMap,
  onMatchConfirmed,
  onMatchRejected,
  onMatchingComplete,
  onError,
  children,
}: MatchingFlowProps): React.ReactNode {
  const { user } = useAuth();
  const [state, setState] = useState<MatchingFlowState>(INITIAL_STATE);

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  // Project matches for display
  const matchList = useMemo(
    () => projectMatchList(matches, bankTxMap, invoiceMap),
    [matches, bankTxMap, invoiceMap]
  );

  // Filter by status
  const proposedMatches = useMemo(
    () => matchList.filter((m) => m.status === MatchStatus.PROPOSED),
    [matchList]
  );

  const confirmedMatches = useMemo(
    () => matchList.filter((m) => m.status === MatchStatus.CONFIRMED),
    [matchList]
  );

  const rejectedMatches = useMemo(
    () => matchList.filter((m) => m.status === MatchStatus.REJECTED),
    [matchList]
  );

  const selectedMatch = useMemo(
    () => matchList.find((m) => m.id === state.selectedMatchId),
    [matchList, state.selectedMatchId]
  );

  // Determine allowed actions
  const isFinalized = monthCloseStatus === MonthCloseStatus.FINALIZED;
  const canRunMatching = !isFinalized && state.phase !== "RUNNING" && state.phase !== "CONFIRMING";
  const canConfirmSelected = !isFinalized && selectedMatch?.status === MatchStatus.PROPOSED;
  const canRejectSelected = !isFinalized && selectedMatch?.status === MatchStatus.PROPOSED;
  const canConfirmAll = !isFinalized && proposedMatches.length > 0;

  // Run matching handler
  const runMatching = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      phase: "RUNNING",
      progress: 0,
      explanation: "Running matching algorithm...",
      nextActions: ["Please wait"],
    }));

    const result = await executeRunMatching(
      functions,
      { tenantId, monthCloseId },
      { role, monthCloseStatus }
    );

    if (result.success && result.execution) {
      const matchResult = result.execution.result!;
      setState((prev) => ({
        ...prev,
        phase: "REVIEWING",
        progress: 100,
        matchResult,
        explanation: `Found ${matchResult.matched} matches, ${matchResult.ambiguous} ambiguous, ${matchResult.unmatched} unmatched`,
        nextActions: [
          "Review proposed matches",
          "Confirm correct matches",
          "Reject incorrect matches",
        ],
      }));
      onMatchingComplete?.(matchResult);
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
  }, [functions, tenantId, monthCloseId, monthCloseStatus, role, onMatchingComplete, onError]);

  // Select match handler
  const selectMatch = useCallback((matchId: string) => {
    setState((prev) => ({
      ...prev,
      selectedMatchId: matchId,
    }));
  }, []);

  // Confirm match handler
  const confirmMatch = useCallback(
    async (matchId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "CONFIRMING",
        pendingConfirm: [...prev.pendingConfirm, matchId],
        explanation: "Confirming match...",
        nextActions: [],
      }));

      const matchToConfirm = matches.find((m) => m.id === matchId);
      if (!matchToConfirm) {
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          explanation: "Match not found",
          nextActions: [],
        }));
        return;
      }

      const result = await executeConfirmMatch(
        functions,
        { matchId, tenantId, monthCloseId },
        { role, monthCloseStatus, matchStatus: matchToConfirm.status }
      );

      if (result.success) {
        setState((prev) => ({
          ...prev,
          phase: "REVIEWING",
          pendingConfirm: prev.pendingConfirm.filter((id) => id !== matchId),
          confirmedIds: [...prev.confirmedIds, matchId],
          explanation: "Match confirmed",
          nextActions: proposedMatches.length > 1
            ? ["Continue reviewing matches"]
            : ["All matches reviewed"],
        }));
        onMatchConfirmed?.(matchId);
      } else {
        const error = result.error!;
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          pendingConfirm: prev.pendingConfirm.filter((id) => id !== matchId),
          error,
          explanation: error.userMessage,
          nextActions: ["Try again"],
        }));
        onError?.(error);
      }
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role, matches, proposedMatches, onMatchConfirmed, onError]
  );

  // Reject match handler
  const rejectMatch = useCallback(
    async (matchId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "CONFIRMING",
        pendingReject: [...prev.pendingReject, matchId],
        explanation: "Rejecting match...",
        nextActions: [],
      }));

      const matchToReject = matches.find((m) => m.id === matchId);
      if (!matchToReject) {
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          explanation: "Match not found",
          nextActions: [],
        }));
        return;
      }

      const result = await executeRejectMatch(
        functions,
        { matchId, tenantId, monthCloseId },
        { role, monthCloseStatus, matchStatus: matchToReject.status }
      );

      if (result.success) {
        setState((prev) => ({
          ...prev,
          phase: "REVIEWING",
          pendingReject: prev.pendingReject.filter((id) => id !== matchId),
          rejectedIds: [...prev.rejectedIds, matchId],
          explanation: "Match rejected",
          nextActions: proposedMatches.length > 1
            ? ["Continue reviewing matches"]
            : ["All matches reviewed"],
        }));
        onMatchRejected?.(matchId);
      } else {
        const error = result.error!;
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          pendingReject: prev.pendingReject.filter((id) => id !== matchId),
          error,
          explanation: error.userMessage,
          nextActions: ["Try again"],
        }));
        onError?.(error);
      }
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role, matches, proposedMatches, onMatchRejected, onError]
  );

  // Confirm all proposed matches
  const confirmAllProposed = useCallback(async () => {
    for (const match of proposedMatches) {
      await confirmMatch(match.id);
    }
  }, [proposedMatches, confirmMatch]);

  // Get explanation for a match
  const getMatchExplanation = useCallback(
    (matchId: string) => {
      const match = matchList.find((m) => m.id === matchId);
      if (!match) return "Match not found";

      const statusExplanation = explainMatchStatus(match.status);
      return `${statusExplanation.description} Confidence: ${match.confidenceLabel} (${(match.confidence * 100).toFixed(0)}%)`;
    },
    [matchList]
  );

  return children({
    state,
    matchList,
    proposedMatches,
    confirmedMatches,
    rejectedMatches,
    selectedMatch,
    canRunMatching,
    canConfirmSelected,
    canRejectSelected,
    canConfirmAll,
    runMatching,
    selectMatch,
    confirmMatch,
    rejectMatch,
    confirmAllProposed,
    getMatchExplanation,
  });
}

// ============================================================================
// HELPER HOOK
// ============================================================================

export function useMatchingFlow(
  functions: Functions,
  tenantId: string,
  monthCloseId: string,
  monthCloseStatus: MonthCloseStatus
) {
  const { user } = useAuth();
  const [state, setState] = useState<MatchingFlowState>(INITIAL_STATE);

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  const runMatching = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      phase: "RUNNING",
      progress: 0,
      explanation: "Running matching...",
      nextActions: [],
    }));

    const result = await executeRunMatching(
      functions,
      { tenantId, monthCloseId },
      { role, monthCloseStatus }
    );

    if (result.success) {
      setState((prev) => ({
        ...prev,
        phase: "REVIEWING",
        progress: 100,
        matchResult: result.execution?.result,
        explanation: "Matching complete",
        nextActions: ["Review matches"],
      }));
      return result.execution?.result;
    } else {
      setState((prev) => ({
        ...prev,
        phase: "ERROR",
        error: result.error,
        explanation: result.error?.userMessage ?? "Matching failed",
        nextActions: ["Try again"],
      }));
      throw result.error;
    }
  }, [functions, tenantId, monthCloseId, monthCloseStatus, role]);

  const confirmMatch = useCallback(
    async (matchId: string, matchStatus: MatchStatus) => {
      const result = await executeConfirmMatch(
        functions,
        { matchId, tenantId, monthCloseId },
        { role, monthCloseStatus, matchStatus }
      );

      if (!result.success) {
        throw result.error;
      }
      return result.execution?.result;
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role]
  );

  const rejectMatch = useCallback(
    async (matchId: string, matchStatus: MatchStatus) => {
      const result = await executeRejectMatch(
        functions,
        { matchId, tenantId, monthCloseId },
        { role, monthCloseStatus, matchStatus }
      );

      if (!result.success) {
        throw result.error;
      }
      return result.execution?.result;
    },
    [functions, tenantId, monthCloseId, monthCloseStatus, role]
  );

  return {
    state,
    runMatching,
    confirmMatch,
    rejectMatch,
    isRunning: state.phase === "RUNNING",
    isReviewing: state.phase === "REVIEWING",
    hasError: state.phase === "ERROR",
  };
}
