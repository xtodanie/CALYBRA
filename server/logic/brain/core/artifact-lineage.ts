export interface LineageArtifact {
  readonly artifactId: string;
  readonly parentArtifactId?: string;
  readonly type: string;
  readonly generatedAt: string;
}

export interface ArtifactLineageNode {
  readonly artifactId: string;
  readonly parentArtifactId?: string;
  readonly depth: number;
  readonly children: readonly string[];
}

export interface ArtifactLineageGraph {
  readonly roots: readonly string[];
  readonly nodes: Readonly<Record<string, ArtifactLineageNode>>;
}

interface MutableArtifactLineageNode {
  artifactId: string;
  parentArtifactId?: string;
  depth: number;
  children: string[];
}

export function buildArtifactLineageGraph(artifacts: readonly LineageArtifact[]): ArtifactLineageGraph {
  const ordered = [...artifacts].sort((a, b) => {
    const byTime = Date.parse(a.generatedAt) - Date.parse(b.generatedAt);
    if (byTime !== 0) return byTime;
    return a.artifactId.localeCompare(b.artifactId);
  });

  const nodes: Record<string, MutableArtifactLineageNode> = {};
  for (const artifact of ordered) {
    nodes[artifact.artifactId] = {
      artifactId: artifact.artifactId,
      parentArtifactId: artifact.parentArtifactId,
      depth: 0,
      children: [],
    };
  }

  for (const artifact of ordered) {
    if (!artifact.parentArtifactId) continue;
    const parent = nodes[artifact.parentArtifactId];
    const current = nodes[artifact.artifactId];
    if (!parent || !current) continue;
    parent.children = [...parent.children, current.artifactId].sort((a, b) => a.localeCompare(b));
  }

  const computeDepth = (artifactId: string): number => {
    const node = nodes[artifactId];
    if (!node || !node.parentArtifactId) return 0;
    return computeDepth(node.parentArtifactId) + 1;
  };

  for (const key of Object.keys(nodes)) {
    const node = nodes[key];
    if (!node) continue;
    node.depth = computeDepth(key);
  }

  const roots = Object.values(nodes)
    .filter((node) => !node.parentArtifactId || !nodes[node.parentArtifactId])
    .map((node) => node.artifactId)
    .sort((a, b) => a.localeCompare(b));

  const readonlyNodes: Record<string, ArtifactLineageNode> = {};
  for (const [key, node] of Object.entries(nodes)) {
    readonlyNodes[key] = {
      artifactId: node.artifactId,
      parentArtifactId: node.parentArtifactId,
      depth: node.depth,
      children: [...node.children],
    };
  }

  return { roots, nodes: readonlyNodes };
}
