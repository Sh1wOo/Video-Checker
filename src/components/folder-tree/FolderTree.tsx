import type { FolderNode } from "../../types/scan";
import { FolderTreeNode } from "./FolderTreeNode";

type Props = {
  node: FolderNode;
};

export function FolderTree({ node }: Props) {
  return (
    <div className="tree-root">
      <FolderTreeNode node={node} />
    </div>
  );
}