import { ArtifactCompaction, CompactableArtifact } from "./artifact-compactor";
import { stableSha256Hex } from "./hash";

export interface CompactionVerification {
  readonly valid: boolean;
  readonly reason?: string;
}

export function verifyCompaction(
  compaction: ArtifactCompaction,
  artifacts: readonly CompactableArtifact[],
): CompactionVerification {
  const ordered = [...artifacts].sort((a, b) => a.artifactId.localeCompare(b.artifactId));
  const fromIndex = ordered.findIndex((item) => item.artifactId === compaction.fromArtifactId);
  const toIndex = ordered.findIndex((item) => item.artifactId === compaction.toArtifactId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex > toIndex) {
    return { valid: false, reason: "invalid compaction range" };
  }

  const window = ordered.slice(fromIndex, toIndex + 1);
  if (window.length !== compaction.artifactCount) {
    return { valid: false, reason: "artifact count mismatch" };
  }

  const expectedHash = stableSha256Hex({
    tenantId: compaction.tenantId,
    monthKey: compaction.monthKey,
    fromArtifactId: compaction.fromArtifactId,
    toArtifactId: compaction.toArtifactId,
    artifactHashes: window.map((item) => item.hash),
  });

  if (expectedHash !== compaction.hash) {
    return { valid: false, reason: "compaction hash mismatch" };
  }

  return { valid: true };
}
