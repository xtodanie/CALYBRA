"use client";

/**
 * File Ingestion Flow - UX orchestration for file upload and parsing
 *
 * INVARIANT: All file operations go through this flow
 * INVARIANT: Progress is always visible
 * INVARIANT: Errors are always explained
 * INVARIANT: Actions are always guarded
 */

import React, { useState, useCallback } from "react";
import { Functions } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import {
  executeFileIngestion,
  FileIngestionResult,
  FileIngestionInput,
} from "../../workflows/ingestFile.action";
import {
  executeParseFile,
  ParseFileResult,
} from "../../workflows/parseFile.action";
import { OrchestrationError } from "../../events/errors";
import { explainFileAssetStatus, explainParseStatus } from "../../events/explanations";
import { MonthCloseStatus, FileAssetStatus, ParseStatus, UserRole, FileAssetKind } from "@/lib/types";

// ============================================================================
// FLOW STATE
// ============================================================================

export interface FileIngestionFlowState {
  readonly phase: "IDLE" | "UPLOADING" | "PARSING" | "COMPLETE" | "ERROR";
  readonly uploadProgress: number;
  readonly parseProgress: number;
  readonly currentFile?: {
    readonly name: string;
    readonly size: number;
    readonly kind: FileAssetKind;
  };
  readonly uploadResult?: FileIngestionResult;
  readonly parseResult?: ParseFileResult;
  readonly error?: OrchestrationError;
  readonly explanation: string;
  readonly nextActions: readonly string[];
}

const INITIAL_STATE: FileIngestionFlowState = {
  phase: "IDLE",
  uploadProgress: 0,
  parseProgress: 0,
  explanation: "Ready to upload files",
  nextActions: ["Select a bank statement (CSV) or invoice (PDF) to upload"],
};

// ============================================================================
// FLOW PROPS
// ============================================================================

export interface FileIngestionFlowProps {
  readonly functions: Functions;
  readonly storage: {
    uploadFile: (
      path: string,
      file: File,
      onProgress?: (percent: number) => void
    ) => Promise<string>;
  };
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly monthCloseStatus: MonthCloseStatus;
  readonly onComplete?: (result: {
    fileId: string;
    parseResult?: ParseFileResult;
  }) => void;
  readonly onError?: (error: OrchestrationError) => void;
  readonly children: (props: FileIngestionFlowRenderProps) => React.ReactNode;
}

export interface FileIngestionFlowRenderProps {
  readonly state: FileIngestionFlowState;
  readonly canUpload: boolean;
  readonly canParse: boolean;
  readonly canRetry: boolean;
  readonly startUpload: (file: File, kind: FileAssetKind) => Promise<void>;
  readonly startParse: (fileId: string) => Promise<void>;
  readonly retry: () => void;
  readonly reset: () => void;
}

// ============================================================================
// FLOW COMPONENT
// ============================================================================

export function FileIngestionFlow({
  functions,
  storage,
  tenantId,
  monthCloseId,
  monthCloseStatus,
  onComplete,
  onError,
  children,
}: FileIngestionFlowProps): React.ReactNode {
  const { user } = useAuth();
  const [state, setState] = useState<FileIngestionFlowState>(INITIAL_STATE);
  const [lastFile, setLastFile] = useState<{ file: File; kind: FileAssetKind } | null>(null);

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  // Determine what actions are allowed
  const canUpload = state.phase === "IDLE" || state.phase === "ERROR";
  const canParse = state.phase === "COMPLETE" && !!state.uploadResult && !state.parseResult;
  const canRetry = state.phase === "ERROR" && lastFile !== null;

  // Start upload handler
  const startUpload = useCallback(
    async (file: File, kind: FileAssetKind) => {
      setLastFile({ file, kind });

      setState({
        phase: "UPLOADING",
        uploadProgress: 0,
        parseProgress: 0,
        currentFile: {
          name: file.name,
          size: file.size,
          kind,
        },
        explanation: `Uploading ${file.name}...`,
        nextActions: ["Please wait while the file is uploaded"],
      });

      const input: FileIngestionInput = {
        file,
        tenantId,
        monthCloseId,
        kind,
      };

      const context = {
        role,
        monthCloseStatus,
      };

      const result = await executeFileIngestion(functions, storage, input, context);

      if (result.success && result.execution) {
        const exec = result.execution;
        const uploadResult = exec.result!;

        const fileExplanation = explainFileAssetStatus(FileAssetStatus.UPLOADED);

        setState({
          phase: "COMPLETE",
          uploadProgress: 100,
          parseProgress: 0,
          currentFile: {
            name: file.name,
            size: file.size,
            kind,
          },
          uploadResult,
          explanation: fileExplanation.description,
          nextActions: fileExplanation.nextActions,
        });

        // Auto-trigger parse for eligible files
        if (kind === FileAssetKind.BANK_CSV) {
          // Small delay then auto-parse
          setTimeout(() => {
            startParse(uploadResult.fileId);
          }, 500);
        }
      } else {
        const error = result.error!;
        setState({
          phase: "ERROR",
          uploadProgress: 0,
          parseProgress: 0,
          currentFile: {
            name: file.name,
            size: file.size,
            kind,
          },
          error,
          explanation: error.userMessage,
          nextActions: error.retryable
            ? ["Try uploading again", "Check the file format"]
            : ["Check permissions", "Contact support if issue persists"],
        });
        onError?.(error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startParse is stable after mount
    [functions, storage, tenantId, monthCloseId, monthCloseStatus, role, onError]
  );

  // Start parse handler
  const startParse = useCallback(
    async (fileId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "PARSING",
        parseProgress: 0,
        explanation: "Parsing file to extract data...",
        nextActions: ["Please wait while data is extracted"],
      }));

      const parseContext = {
        role,
        fileStatus: FileAssetStatus.UPLOADED,
        parseStatus: "PENDING",
      };

      const result = await executeParseFile(
        functions,
        { fileId, tenantId },
        parseContext
      );

      if (result.success && result.execution) {
        const parseResult = result.execution.result!;
        const parseExplanation = explainParseStatus(ParseStatus.PARSED);

        setState((prev) => ({
          ...prev,
          phase: "COMPLETE",
          parseProgress: 100,
          parseResult,
          explanation: `Extracted ${parseResult.linesExtracted} records. ${parseExplanation.description}`,
          nextActions: parseExplanation.nextActions,
        }));

        onComplete?.({
          fileId,
          parseResult,
        });
      } else {
        const error = result.error!;
        const parseExplanation = explainParseStatus(ParseStatus.FAILED);

        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          parseProgress: 0,
          error,
          explanation: error.userMessage,
          nextActions: parseExplanation.nextActions,
        }));
        onError?.(error);
      }
    },
    [functions, tenantId, role, onComplete, onError]
  );

  // Retry handler
  const retry = useCallback(() => {
    if (lastFile) {
      startUpload(lastFile.file, lastFile.kind);
    }
  }, [lastFile, startUpload]);

  // Reset handler
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setLastFile(null);
  }, []);

  return children({
    state,
    canUpload,
    canParse,
    canRetry,
    startUpload,
    startParse,
    retry,
    reset,
  });
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to use file ingestion flow with simpler API
 */
export function useFileIngestionFlow(
  functions: Functions,
  storage: {
    uploadFile: (
      path: string,
      file: File,
      onProgress?: (percent: number) => void
    ) => Promise<string>;
  },
  tenantId: string,
  monthCloseId: string,
  monthCloseStatus: MonthCloseStatus
) {
  const [state, setState] = useState<FileIngestionFlowState>(INITIAL_STATE);
  const { user } = useAuth();

  const role = (user?.role as UserRole) ?? UserRole.VIEWER;

  const uploadFile = useCallback(
    async (file: File, kind: FileAssetKind) => {
      setState({
        phase: "UPLOADING",
        uploadProgress: 0,
        parseProgress: 0,
        currentFile: { name: file.name, size: file.size, kind },
        explanation: `Uploading ${file.name}...`,
        nextActions: [],
      });

      const result = await executeFileIngestion(
        functions,
        storage,
        { file, tenantId, monthCloseId, kind },
        { role, monthCloseStatus }
      );

      if (result.success) {
        setState((prev) => ({
          ...prev,
          phase: "COMPLETE",
          uploadProgress: 100,
          uploadResult: result.execution?.result,
          explanation: "Upload complete",
          nextActions: ["Parse file to extract data"],
        }));
        return result.execution?.result;
      } else {
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          error: result.error,
          explanation: result.error?.userMessage ?? "Upload failed",
          nextActions: ["Try again"],
        }));
        throw result.error;
      }
    },
    [functions, storage, tenantId, monthCloseId, monthCloseStatus, role]
  );

  const parseFile = useCallback(
    async (fileId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "PARSING",
        parseProgress: 0,
        explanation: "Parsing file...",
        nextActions: [],
      }));

      const result = await executeParseFile(
        functions,
        { fileId, tenantId },
        { role, fileStatus: FileAssetStatus.UPLOADED }
      );

      if (result.success) {
        setState((prev) => ({
          ...prev,
          phase: "COMPLETE",
          parseProgress: 100,
          parseResult: result.execution?.result,
          explanation: "Parse complete",
          nextActions: ["Run matching"],
        }));
        return result.execution?.result;
      } else {
        setState((prev) => ({
          ...prev,
          phase: "ERROR",
          error: result.error,
          explanation: result.error?.userMessage ?? "Parse failed",
          nextActions: ["Retry parse"],
        }));
        throw result.error;
      }
    },
    [functions, tenantId, role]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    uploadFile,
    parseFile,
    reset,
    isUploading: state.phase === "UPLOADING",
    isParsing: state.phase === "PARSING",
    isComplete: state.phase === "COMPLETE",
    hasError: state.phase === "ERROR",
  };
}
