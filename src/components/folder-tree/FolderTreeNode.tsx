import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  ChevronRight,
  Clock3,
  Film,
  Folder as FolderIcon,
  FolderOpen,
  HardDrive,
} from "lucide-react";
import type { FolderNode } from "../../types/scan";
import { formatBytes, formatHoursDecimal } from "../../lib/format";

type Props = {
  node: FolderNode;
  depth?: number;
  highlightPath?: string | null;
};

export function FolderTreeNode({ node, depth = 0, highlightPath }: Props) {
  const hasChildren = Boolean(node.children?.length);
  const [expanded, setExpanded] = useState(depth === 0);
  const [opening, setOpening] = useState(false);

  const childrenWrapRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!hasChildren || !childrenWrapRef.current) return;

    const wrap = childrenWrapRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.killTweensOf(wrap);
    if (chevronRef.current) gsap.killTweensOf(chevronRef.current);

    if (reduceMotion) {
      wrap.style.height = expanded ? "auto" : "0px";
      wrap.style.opacity = expanded ? "1" : "0";
      wrap.style.overflow = expanded ? "visible" : "hidden";
      if (chevronRef.current) {
        chevronRef.current.style.transform = expanded ? "rotate(90deg)" : "rotate(0deg)";
      }
      return;
    }

    if (expanded) {
      wrap.style.display = "block";
      wrap.style.overflow = "hidden";
      wrap.style.opacity = "1";
      wrap.style.height = "auto";
      const targetHeight = wrap.scrollHeight;
      wrap.style.height = "0px";

      requestAnimationFrame(() => {
        gsap.to(wrap, {
          height: targetHeight,
          opacity: 1,
          duration: 0.28,
          ease: "power2.out",
          onComplete: () => {
            wrap.style.height = "auto";
            wrap.style.opacity = "1";
            wrap.style.overflow = "visible";
          },
        });
      });
    } else {
      const currentHeight = wrap.scrollHeight;
      wrap.style.height = `${currentHeight}px`;
      wrap.style.opacity = "1";
      wrap.style.overflow = "hidden";

      requestAnimationFrame(() => {
        gsap.to(wrap, {
          height: 0,
          opacity: 0,
          duration: 0.22,
          ease: "power2.inOut",
          onComplete: () => {
            wrap.style.height = "0px";
            wrap.style.opacity = "0";
            wrap.style.overflow = "hidden";
          },
        });
      });
    }

    if (chevronRef.current) {
      gsap.to(chevronRef.current, {
        rotate: expanded ? 90 : 0,
        duration: 0.24,
        ease: "power2.out",
      });
    }
  }, [expanded, hasChildren]);

  async function handleOpenFolder() {
    if (opening) return;
    setOpening(true);
    try {
      await openPath(node.path);
    } catch (error) {
      console.error("Не удалось открыть папку:", error);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="tree-block">
      <div className={`tree-row tree-depth-${depth % 6} ${node.path === highlightPath ? "tree-row-highlight" : ""}`} style={{ marginLeft: `${depth * 14}px` }}>
        <button
          type="button"
          className="tree-main-button"
          onClick={() => hasChildren && setExpanded((value) => !value)}
          aria-expanded={hasChildren ? expanded : undefined}
        >
          <span ref={chevronRef} className="tree-chevron">
            {hasChildren ? (
              <ChevronRight className="icon" />
            ) : (
              <span className="tree-chevron-placeholder" />
            )}
          </span>

          <span className="tree-folder-icon">
            <FolderIcon className="icon icon-primary" />
          </span>

          <span className="tree-texts">
            <span className="tree-title">{node.name}</span>
            <span className="tree-subtitle" title={node.path}>
              {node.path}
            </span>
          </span>
        </button>

        <div className="tree-badges">
          <span className="badge">
            <Film className="badge-icon" />
            {node.totalVideoFiles}
          </span>
          <span className="badge badge-soft">
            <Clock3 className="badge-icon" />
            {formatHoursDecimal(node.totalDurationSec)}
          </span>
          <span className="badge">
            <HardDrive className="badge-icon" />
            {formatBytes(node.totalBytes)}
          </span>

          <button
            type="button"
            className="badge badge-open-folder"
            onClick={handleOpenFolder}
            title="Открыть папку"
          >
            <FolderOpen className="badge-icon" />
            {opening ? "Открытие..." : "Открыть"}
          </button>
        </div>
      </div>

      {hasChildren ? (
        <div
          ref={childrenWrapRef}
          className="tree-children-wrap"
          style={{
            height: expanded ? "auto" : 0,
            opacity: expanded ? 1 : 0,
            overflow: expanded ? "visible" : "hidden",
          }}
        >
          <div className="tree-children">
            {node.children.map((child) => (
              <FolderTreeNode key={child.path} node={child} depth={depth + 1} highlightPath={highlightPath} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}