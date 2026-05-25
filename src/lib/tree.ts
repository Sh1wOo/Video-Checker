import type { FolderNode } from "../types/scan";

export type FlatTreeRow = {
  id: string;
  node: FolderNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

export function flattenTree(
  root: FolderNode,
  expanded: Set<string>,
  maxRows = 8000,
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];
  const stack: Array<{ node: FolderNode; depth: number }> = [{ node: root, depth: 0 }];

  while (stack.length > 0 && rows.length < maxRows) {
    const current = stack.pop()!;
    const id = current.node.path || `${current.depth}-${current.node.name}`;
    const children = current.node.children ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = current.depth === 0 || expanded.has(id);

    rows.push({
      id,
      node: current.node,
      depth: current.depth,
      hasChildren,
      expanded: isExpanded,
    });

    if (hasChildren && isExpanded) {
      for (let i = children.length - 1; i >= 0; i -= 1) {
        stack.push({ node: children[i], depth: current.depth + 1 });
      }
    }
  }

  return rows;
}