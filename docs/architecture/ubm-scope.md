# UBM Scope Freeze (Phase 1)

## Domain Boundary
Unified Business Model (UBM) is a read-only projection surface for deterministic intelligence evaluation.

## In-Scope Entities
- `tenant`
- `monthClose`
- `invoice`
- `bankTransaction`
- `match`
- `supplier`
- `product`
- `costSignal`
- `exception`

## Event Types
- `ubm.snapshot.created`
- `ubm.projection.rebuilt`
- `ubm.signal.detected`
- `ubm.exception.raised`

## Memory Granularity
- Structural memory: entity-level snapshots keyed by `tenantId + entityId + version`.
- Event memory: append-only event envelopes.
- Behavioral memory: periodic aggregated metrics.
- Reflection memory: explicit reflection events.

## Explicit Constraint
No AI reasoning logic may live inside UBM projection assembly. UBM stores source-truth projections and deterministic derived metrics only.

## JSON Schema Draft
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UBMProjectionBundle",
  "type": "object",
  "required": ["tenantId", "asOf", "entities", "events"],
  "properties": {
    "tenantId": { "type": "string", "minLength": 1 },
    "asOf": { "type": "string", "format": "date-time" },
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["entityType", "entityId", "version", "payload"],
        "properties": {
          "entityType": { "type": "string" },
          "entityId": { "type": "string" },
          "version": { "type": "integer", "minimum": 1 },
          "payload": { "type": "object" }
        }
      }
    },
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "timestamp", "hash"],
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" },
          "hash": { "type": "string" }
        }
      }
    }
  }
}
```
