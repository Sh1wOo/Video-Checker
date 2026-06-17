import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { FolderChild } from '../types/lazy-tree';

export function useLazyTree() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenByPath, setChildrenByPath] = useState<Record<string, FolderChild[]>>({});
  const [loadingByPath, setLoadingByPath] = useState<Record<string, boolean>>({});

  const toggle = useCallback(async (path: string, hasChildren: boolean) => {
    if (!hasChildren) return;

    if (!childrenByPath[path] && !loadingByPath[path]) {
      setLoadingByPath((prev) => ({ ...prev, [path]: true }));
      try {
        const children = await invoke<FolderChild[]>('get_folder_children', { path });
        setChildrenByPath((prev) => ({ ...prev, [path]: children }));
      } finally {
        setLoadingByPath((prev) => ({ ...prev, [path]: false }));
      }
    }

    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, [childrenByPath, loadingByPath]);

  const reset = useCallback(() => {
    setExpanded(new Set());
    setChildrenByPath({});
    setLoadingByPath({});
  }, []);

  return {
    expanded,
    childrenByPath,
    loadingByPath,
    toggle,
    reset,
  };
}
