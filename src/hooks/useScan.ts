import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { ProgressEvent, ScanProgress, ScanResult } from "../types/scan";
import { formatDuration } from "../lib/format";

export function useScan() {
  const [folderPath, setFolderPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(
    document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const unlistenPromise = listen<ProgressEvent>("scan://event", (event) => {
      const payload = event.payload;

      if ("scannedFiles" in payload) {
        setProgress({
          scannedFiles: payload.scannedFiles,
          totalFiles: payload.totalFiles,
          scannedBytes: payload.scannedBytes,
          totalBytes: payload.totalBytes,
          speedMibPerSec: payload.speedMibPerSec,
          elapsedSec: payload.elapsedSec,
          currentPath: payload.currentPath,
          treeBuiltFolders: payload.treeBuiltFolders,
        });
      } else {
        setProgress({
          scannedFiles: payload.scanned_files,
          totalFiles: payload.total_files,
          scannedBytes: payload.scanned_bytes,
          totalBytes: payload.total_bytes,
          speedMibPerSec: payload.speed_mib_per_sec,
          elapsedSec: payload.elapsed_sec,
          currentPath: payload.current_path,
          treeBuiltFolders: payload.tree_built_folders,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const percent = useMemo(() => {
    if (!progress?.totalFiles) return 0;
    return (progress.scannedFiles / progress.totalFiles) * 100;
  }, [progress]);

  async function ensureNotificationPermission() {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  }

  async function pickFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Выберите папку с видео",
    });

    if (typeof selected === "string") {
      setFolderPath(selected);
      setResult(null);
      setError(null);
      setProgress(null);
    }
  }

  async function runScan() {
    if (!folderPath || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setProgress(null);

    try {
      await ensureNotificationPermission();

      const res = await invoke<ScanResult>("start_scan", {
        rootPath: folderPath,
      });

      setResult(res);

      await sendNotification({
        title: "Сканирование завершено",
        body: `Видео: ${res.summary.totalVideoFiles}, длительность: ${formatDuration(
          res.summary.totalDurationSec,
        )}`,
      });
    } catch (e) {
      setError(typeof e === "string" ? e : "Не удалось выполнить сканирование");
    } finally {
      setLoading(false);
    }
  }

  return {
    dark,
    setDark,
    folderPath,
    loading,
    progress,
    result,
    error,
    percent,
    pickFolder,
    runScan,
  };
}