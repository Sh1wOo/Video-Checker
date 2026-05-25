import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, Film, Folder as FolderIcon, HardDrive } from "lucide-react";
import type { FolderNode } from "../../types/scan";
import { formatBytes, formatDuration } from "../../lib/format";
import { flattenTree } from "../../lib/tree";

type Props = {
  node: FolderNode;
  height?: number;
  rowHeight?: number;
  maxRows?: number;
};

export function VirtualFolderTree({
  node,
  height = 680,
  rowHeight = 66,
  maxRows = 8000,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([node.path]));
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setExpanded(new Set([node.path]));
    setScrollTop(0);
  }, [node.path]);

  const rows = useMemo(() => flattenTree(node, expanded, maxRows), [node, expanded, maxRows]);

  const totalHeight = rows.length * rowHeight;
  const overscan = 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + height) / rowHeight) + overscan,
  );
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  function toggleRow(id: string, hasChildren: boolean) {
    if (!hasChildren) return;

    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="virtual-tree-shell">
      <div
        className="virtual-tree-viewport"
        style={{ height }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="virtual-tree-spacer" style={{ height: totalHeight }}>
          <div className="virtual-tree-window" style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleRows.map(({ id, node: currentNode, depth, hasChildren, expanded: isExpanded }) => (
              <div key={id} className="tree-row virtual-tree-row" style={{ height: rowHeight - 8 }}>
                <button
                  type="button"
                  className="tree-main-button"
                  onClick={() => toggleRow(id, hasChildren)}
                  aria-expanded={hasChildren ? isExpanded : undefined}
                >
                  <span className="tree-indent" style={{ width: `${depth * 16}px` }} aria-hidden="true" />
                  <span className={`tree-chevron ${isExpanded ? "tree-chevron-open" : ""}`}>
                    {hasChildren ? <ChevronRight className="icon" /> : <span className="tree-chevron-placeholder" />}
                  </span>
                  <span className="tree-folder-icon">
                    <FolderIcon className="icon icon-primary" />
                  </span>
                  <span className="tree-texts">
                    <span className="tree-title">{currentNode.name}</span>
                    <span className="tree-subtitle" title={currentNode.path}>
                      {currentNode.path}
                    </span>
                  </span>
                </button>

                <div className="tree-badges">
                  <span className="badge">
                    <Film className="badge-icon" />
                    {currentNode.totalVideoFiles ?? 0}
                  </span>
                  <span className="badge badge-soft">
                    <Clock3 className="badge-icon" />
                    {formatDuration(currentNode.totalDurationSec ?? 0)}
                  </span>
                  <span className="badge">
                    <HardDrive className="badge-icon" />
                    {formatBytes(currentNode.totalBytes ?? 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {rows.length >= maxRows ? (
        <div className="tree-limit-note">
          Показаны первые {maxRows.toLocaleString("ru-RU")} узлов, чтобы интерфейс не зависал.
        </div>
      ) : null}
    </div>
  );
}