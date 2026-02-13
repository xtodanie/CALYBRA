import {
  CanonicalEventEnvelope,
  toEventHashMaterial,
  validateEventEnvelope,
} from "../contracts/event-envelope";
import { stableSha256Hex } from "./hash";

export interface AppendOnlyEventStore {
  append(event: CanonicalEventEnvelope): void;
  appendMany(events: readonly CanonicalEventEnvelope[]): void;
  readAll(): readonly CanonicalEventEnvelope[];
  readByTenant(tenantId: string): readonly CanonicalEventEnvelope[];
  getById(eventId: string): CanonicalEventEnvelope | undefined;
}

function compareEvents(left: CanonicalEventEnvelope, right: CanonicalEventEnvelope): number {
  const leftTime = Date.parse(left.timestamp);
  const rightTime = Date.parse(right.timestamp);
  const byTimestamp = leftTime - rightTime;
  if (byTimestamp !== 0) {
    return byTimestamp;
  }
  return left.id.localeCompare(right.id);
}

export class InMemoryAppendOnlyEventStore implements AppendOnlyEventStore {
  private readonly events: CanonicalEventEnvelope[] = [];

  append(event: CanonicalEventEnvelope): void {
    const validation = validateEventEnvelope(event);
    if (!validation.valid) {
      throw new Error(`invalid event envelope: ${validation.errors.join("; ")}`);
    }

    if (this.events.some((existing) => existing.id === event.id)) {
      throw new Error(`duplicate event id: ${event.id}`);
    }

    const expectedHash = stableSha256Hex(toEventHashMaterial(event));
    if (expectedHash !== event.hash) {
      throw new Error(`invalid event hash for ${event.id}`);
    }

    const previous = this.events[this.events.length - 1];
    if (!previous && event.parent_id) {
      throw new Error("first event cannot declare parent_id");
    }
    if (previous && previous.id !== event.parent_id) {
      throw new Error(`event parent mismatch for ${event.id}`);
    }

    this.events.push(Object.freeze({ ...event }));
  }

  appendMany(events: readonly CanonicalEventEnvelope[]): void {
    for (const event of events) {
      this.append(event);
    }
  }

  readAll(): readonly CanonicalEventEnvelope[] {
    return [...this.events].sort(compareEvents);
  }

  readByTenant(tenantId: string): readonly CanonicalEventEnvelope[] {
    return this.readAll().filter((event) => event.context.tenantId === tenantId);
  }

  getById(eventId: string): CanonicalEventEnvelope | undefined {
    const found = this.events.find((event) => event.id === eventId);
    return found ? { ...found } : undefined;
  }
}
