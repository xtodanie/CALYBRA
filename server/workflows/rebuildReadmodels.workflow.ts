/**
 * Rebuild Readmodels Workflow
 * Orchestration wrapper for admin rebuilds.
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";
import { onPeriodFinalizedWorkflow, PeriodFinalizedOutcome } from "./onPeriodFinalized.workflow";
import { CurrencyCode } from "../domain/money";

export interface RebuildReadmodelsInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly actorId: string;
  readonly now: Timestamp;
  readonly currency: CurrencyCode;
}

export async function rebuildReadmodelsWorkflow(
  db: Firestore,
  input: RebuildReadmodelsInput
): Promise<PeriodFinalizedOutcome> {
  return onPeriodFinalizedWorkflow(db, {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    actorId: input.actorId,
    now: input.now,
    currency: input.currency,
  });
}
