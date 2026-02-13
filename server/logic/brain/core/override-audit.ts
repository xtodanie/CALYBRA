export interface OverrideEvent {
  readonly decisionId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly atIso: string;
}

export interface OverrideSummary {
  readonly count: number;
  readonly byActor: Readonly<Record<string, number>>;
}

export function summarizeOverrides(events: readonly OverrideEvent[]): OverrideSummary {
  const byActor: Record<string, number> = {};
  for (const event of events) {
    byActor[event.actorId] = (byActor[event.actorId] ?? 0) + 1;
  }
  return { count: events.length, byActor };
}
