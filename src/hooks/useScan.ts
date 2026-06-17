import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AiAnalysisResult, ProgressEvent, ScanProgress, ScanResult } from "../types/scan";
import type { ScanInputSource } from "../components/ScanToolbar";
import { formatDuration } from "../lib/format";

export type ScanSource =
  | { kind: "pc"; label: string }
  | { kind: "android"; serial: string; label: string; remotePath: string };

export function useScan() {
  const [folderPath, setFolderPathValue] = useState("");
  const [scanSourceLabel, setScanSourceLabel] = useState<string | null>(null);
  const [inputSource, setInputSource] = useState<ScanInputSource>("pc");
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
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

  function resetState() {
    setResult(null);
    setError(null);
    setProgress(null);
    setAiAnalysis(null);
    setAiError(null);
  }

  function setFolderPath(value: string) {
    setFolderPathValue(value);
    setScanSource({ kind: "pc", label: "Этот компьютер" });
    setScanSourceLabel("Этот компьютер");
    resetState();
  }

  function setAndroidFolder(serial: string, remotePath: string, label: string) {
    setFolderPathValue(remotePath);
    setScanSource({ kind: "android", serial, remotePath, label });
    setScanSourceLabel(label);
    resetState();
  }

  async function pickPcFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Выберите папку с видео",
    });

    if (typeof selected === "string") {
      setFolderPath(selected);
    }
  }

  async function runScan() {
    if (!folderPath || loading) return;

    setLoading(true);
    setResult(null);
    setAiAnalysis(null);
    setError(null);
    setAiError(null);
    setProgress(null);

    try {
      await ensureNotificationPermission();

      const res = scanSource?.kind === "android"
        ? await invoke<ScanResult>("android_scan_path", {
            serial: scanSource.serial,
            remotePath: scanSource.remotePath,
          })
        : await invoke<ScanResult>("start_scan", {
            rootPath: folderPath,
          });

      setResult(res);

      await sendNotification({
        title: "Сканирование завершено",
        body: `Видео: ${res.summary.totalVideoFiles}, длительность: ${formatDuration(
          res.summary.totalDurationSec,
        )}`,
      });

      if (scanSource?.kind !== "android") {
        setAiLoading(true);
        try {
          const analysis = await invoke<AiAnalysisResult>("run_ai_analysis", {
            rootPath: folderPath,
          });
          setAiAnalysis(analysis);
        } catch (analysisError) {
          setAiError(
            typeof analysisError === "string" ? analysisError : "Не удалось выполнить AI Анализ",
          );
        } finally {
          setAiLoading(false);
        }
      } else {
        setAiAnalysis(null);
        setAiError("AI-анализ для Android/VR нужно отдельно подключить в backend через временную локальную копию.");
      }
    } catch (e) {
      setError(typeof e === "string" ? e : "Не удалось выполнить сканирование");
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  }

  return {
    dark,
    setDark,
    folderPath,
    setFolderPath,
    inputSource,
    setInputSource,
    scanSourceLabel,
    scanSource,
    loading,
    aiLoading,
    progress,
    result,
    aiAnalysis,
    aiError,
    error,
    percent,
    pickPcFolder,
    runScan,
    setAndroidFolder,
  };
}
