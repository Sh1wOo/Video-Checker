import { useEffect } from 'react';
import { ChevronRight, Clock3, Film, Folder as FolderIcon, HardDrive, Loader2 } from 'lucide-react';
import type { FolderChild } from '../../types/lazy-tree';
import { useLazyTree } from '../../hooks/useLazyTree';
import { formatBytes, formatDuration } from '../../lib/format';

type RowProps = {
  node: FolderChild;
  depth: number;
  expanded: Set<string>;
  childrenByPath: Record<string, FolderChild[]>;
  loadingByPath: Record<string, boolean>;
  onToggle: (path: string, hasChildren: boolean) => void | Promise<void>;
};

function LazyTreeRow({ node, depth, expanded, childrenByPath, loadingByPath, onToggle }: RowProps) {
  const isExpanded = expanded.has(node.path);
  const isLoading = loadingByPath[node.path];
  const children = childrenByPath[node.path] ?? [];

  return (
    <div className="tree-block">
      <div className="tree-row" style={{ marginLeft: `${depth * 14}px` }}>
        <button
          type="button"
          className="tree-main-button"
          onClick={() => onToggle(node.path, node.hasChildren)}
          aria-expanded={node.hasChildren ? isExpanded : undefined}
        >
          <span className={`tree-chevron ${isExpanded ? 'tree-chevron-open' : ''}`}>
            {node.hasChildren ? <ChevronRight className="icon" /> : <span className="tree-chevron-placeholder" />}
          </span>

          <span className="tree-folder-icon">
            <FolderIcon className="icon icon-primary" />
          </span>

          <span className="tree-texts">
            <span className="tree-title">{node.name}</span>
            <span className="tree-subtitle" title={node.path}>{node.path}</span>
          </span>
        </button>

        <div className="tree-badges">
          <span className="badge">
            <Film className="badge-icon" />
            {node.totalVideoFiles ?? 0}
          </span>
          <span className="badge badge-soft">
            <Clock3 className="badge-icon" />
            {formatDuration(node.totalDurationSec ?? 0)}
          </span>
          <span className="badge">
            <HardDrive className="badge-icon" />
            {formatBytes(node.totalBytes ?? 0)}
          </span>
        </div>
      </div>

      {node.hasChildren && isExpanded ? (
        <div className="tree-children-wrap tree-children-visible">
          <div className="tree-children">
            {isLoading ? (
              <div className="tree-loading-row">
                <Loader2 className="icon spin" />
                <span>Загрузка вложенных папок...</span>
              </div>
            ) : (
              children.map((child) => (
                <LazyTreeRow
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expanded={expanded}
                  childrenByPath={childrenByPath}
                  loadingByPath={loadingByPath}
                  onToggle={onToggle}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  root: FolderChild;
};

export function LazyFolderTree({ root }: Props) {
  const { expanded, childrenByPath, loadingByPath, toggle } = useLazyTree();

  useEffect(() => {
    toggle(root.path, root.hasChildren);
  }, [root.path, root.hasChildren, toggle]);

  return (
    <div className="tree-root">
      <LazyTreeRow
        node={root}
        depth={0}
        expanded={expanded}
        childrenByPath={childrenByPath}
        loadingByPath={loadingByPath}
        onToggle={toggle}
      />
    </div>
  );
}
