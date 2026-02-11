/**
 * Client State - Main exports
 *
 * State selectors and UI projections from Firestore data.
 */

// Selectors
export {
  selectMonthCloseState,
  selectFlowState,
  selectMatchState,
  selectFileAssetState,
  selectExceptionSummary,
  selectReconciliationState,
  type MonthCloseState,
  type FlowState,
  type FlowPhase,
  type MatchState,
  type FileAssetState,
  type ExceptionSummary,
  type ReconciliationState,
} from "./selectors";

// Projections
export {
  projectMonthCloseSummary,
  projectMatchList,
  projectFileList,
  projectExceptionList,
  type MonthCloseSummary,
  type MatchListItem,
  type FileListItem,
  type ExceptionListItem,
} from "./projections";
