import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, Film } from "lucide-react";
import { formatBytes, formatDuration } from "../lib/format";

export type FolderNode = {
  path: string;
  name: string;
  depth: number;
  directVideoFiles: number;
  totalVideoFiles: number;
  directDurationSec: number;
  totalDurationSec: number;
  directBytes: number;
  totalBytes: number;
  children: FolderNode[];
};

function TreeRow({ node }: { node: FolderNode }) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(node.depth < 2);

  return (
    <div className="tree-block">
      <div
        className="tree-row"
        style={{ marginLeft: `${node.depth * 14}px` }}
      >
        <button
          className="tree-main-button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          type="button"
        >
          <span className="tree-chevron">
            {hasChildren ? (
              <ChevronRight className={`icon ${open ? "rotated" : ""}`} />
            ) : (
              <span className="tree-chevron-placeholder" />
            )}
          </span>

          <span className="tree-folder-icon">
            {open ? (
              <FolderOpen className="icon icon-primary" />
            ) : (
              <Folder className="icon icon-primary" />
            )}
          </span>

          <span className="tree-texts">
            <span className="tree-title">{node.name || node.path}</span>
            <span className="tree-subtitle">{node.path}</span>
          </span>
        </button>

        <div className="tree-badges">
          <span className="badge badge-soft">
            <Film className="icon badge-icon" />
            {node.totalVideoFiles}
          </span>
          <span className="badge">{formatDuration(node.totalDurationSec)}</span>
          <span className="badge">{formatBytes(node.totalBytes)}</span>
        </div>
      </div>

      {open &&
        hasChildren &&
        node.children.map((child) => <TreeRow key={child.path} node={child} />)}
    </div>
  );
}

export function FolderTree({ node }: { node: FolderNode }) {
  return <TreeRow node={node} />;
}