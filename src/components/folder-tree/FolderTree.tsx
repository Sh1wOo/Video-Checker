import type { FolderNode } from "../../types/scan";
import { FolderTreeNode } from "./FolderTreeNode";

type Props = {
  node: FolderNode;
  highlightPath?: string | null;
};

export function FolderTree({ node, highlightPath }: Props) {
  return (
    <div className="tree-root">
      <FolderTreeNode node={node} highlightPath={highlightPath} />
    </div>
  );
}