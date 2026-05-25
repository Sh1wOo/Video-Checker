import type { ScanResult } from "../types/scan";
import { FolderTree } from "./folder-tree/FolderTree";
import { VirtualFolderTree } from "./folder-tree/VirtualFolderTree";

type Props = {
  result: ScanResult | null;
  treeBuiltFolders?: number;
};

const GSAP_TREE_LIMIT = 1800;

export function TreePanel({ result, treeBuiltFolders = 0 }: Props) {
  const useVirtualTree = treeBuiltFolders > GSAP_TREE_LIMIT;

  return (
    <section className="panel tree-panel">
      <div className="panel-header with-border">
        <h2 className="panel-title">Дерево папок</h2>
      </div>

      <div className="tree-scroll tree-scroll-virtualized">
        {!result ? (
          <div className="empty-state">Выберите папку и запустите подсчёт.</div>
        ) : useVirtualTree ? (
          <VirtualFolderTree node={result.tree} height={680} rowHeight={66} maxRows={8000} />
        ) : (
          <FolderTree node={result.tree} />
        )}
      </div>
    </section>
  );
}