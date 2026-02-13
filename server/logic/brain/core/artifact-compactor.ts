import { stableSha256Hex } from "./hash";

export interface CompactableArtifact {
  readonly artifactId: string;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly type: string;
  readonly generatedAt: string;
  readonly hash: string;
}

export interface ArtifactCompaction {
  readonly summaryId: string;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly fromArtifactId: string;
  readonly toArtifactId: string;
  readonly artifactCount: number;
  readonly hash: string;
}

export function compactArtifactsByWindow(
  artifacts: readonly CompactableArtifact[],
  minWindowSize: number,
): ArtifactCompaction[] {
  if (artifacts.length < minWindowSize || minWindowSize <= 1) {
    return [];
  }

  const ordered = [...artifacts].sort((a, b) => {
    const t = Date.parse(a.generatedAt) - Date.parse(b.generatedAt);
    if (t !== 0) return t;
    return a.artifactId.localeCompare(b.artifactId);
  });

  const chunks: CompactableArtifact[][] = [];
  for (let index = 0; index < ordered.length; index += minWindowSize) {
    const chunk = ordered.slice(index, index + minWindowSize);
    if (chunk.length === minWindowSize) {
      chunks.push(chunk);
    }
  }

  return chunks.map((chunk) => {
    const first = chunk[0] as CompactableArtifact;
    const last = chunk[chunk.length - 1] as CompactableArtifact;
    const hash = stableSha256Hex({
      tenantId: first.tenantId,
      monthKey: first.monthKey,
      fromArtifactId: first.artifactId,
      toArtifactId: last.artifactId,
      artifactHashes: chunk.map((item) => item.hash),
    });

    return {
      summaryId: `cmp:${hash.slice(0, 24)}`,
      tenantId: first.tenantId,
      monthKey: first.monthKey,
      fromArtifactId: first.artifactId,
      toArtifactId: last.artifactId,
      artifactCount: chunk.length,
      hash,
    };
  });
}
