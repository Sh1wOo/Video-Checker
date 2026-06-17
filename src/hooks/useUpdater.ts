import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { UpdateInfo, UpdateProgress, UpdateStatus } from "../types/updater";

type TauriUpdate = Awaited<ReturnType<typeof check>>;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({
    chunkLength: 0,
    contentLength: null,
    downloaded: 0,
    percent: 0,
    speedBytesPerSec: 0,
  });

  const speedStartedAt = useRef<number | null>(null);
  const downloadedRef = useRef(0);
  const updateRef = useRef<TauriUpdate>(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      if (status !== "downloading") setStatus("offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [status]);

  const resetProgress = useCallback(() => {
    speedStartedAt.current = null;
    downloadedRef.current = 0;
    setProgress({ chunkLength: 0, contentLength: null, downloaded: 0, percent: 0, speedBytesPerSec: 0 });
  }, []);

  const checkForUpdates = useCallback(async (openModalOnAvailable = false): Promise<boolean> => {
    if (!navigator.onLine) {
      setStatus("offline");
      setError("Нет сети. Проверка обновлений недоступна.");
      return false;
    }
    setStatus("checking");
    setError(null);
    try {
      const update = await check();
      if (!update) {
        updateRef.current = null;
        setUpdateInfo(null);
        setStatus("not-available");
        return false;
      }
      updateRef.current = update;
      setUpdateInfo({
        currentVersion: update.currentVersion,
        version: update.version,
        body: update.body ?? undefined,
        date: update.date ?? undefined,
      });
      setStatus("available");
      if (openModalOnAvailable) setIsModalOpen(true);
      return true;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Не удалось проверить обновления.");
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    const update = updateRef.current;
    if (!update) return;
    resetProgress();
    setStatus("downloading");
    setError(null);
    speedStartedAt.current = Date.now();

    try {
      await update.downloadAndInstall((event) => {
        if (event.event !== "Progress") return;
        const data = event.data as { chunkLength?: number; contentLength?: number } | undefined;
        const chunk = data?.chunkLength ?? 0;
        const total = data?.contentLength ?? null;
        downloadedRef.current += chunk;
        const elapsed = Math.max((Date.now() - (speedStartedAt.current ?? Date.now())) / 1000, 0.001);
        const speed = Math.round(downloadedRef.current / elapsed);
        const pct = total ? Math.min((downloadedRef.current / total) * 100, 100) : 0;
        setProgress({
          chunkLength: chunk,
          contentLength: total,
          downloaded: downloadedRef.current,
          percent: pct,
          speedBytesPerSec: speed,
        });
      });
      setStatus("installed");
    } catch (err) {
      setStatus(navigator.onLine ? "error" : "offline");
      setError(err instanceof Error ? err.message : "Ошибка скачивания обновления.");
    }
  }, [resetProgress]);

const restartApp = useCallback(async () => {
  await relaunch();
}, []);

  useEffect(() => {
    void checkForUpdates(false);
  }, [checkForUpdates]);

  const hasUpdate = status === "available" || status === "downloading" || status === "installed";

  const downloadLabel = useMemo((): string | null => {
    if (!updateInfo) return null;
    return `${updateInfo.currentVersion} → ${updateInfo.version}`;
  }, [updateInfo]);

  const speedLabel = useMemo((): string => formatBytes(progress.speedBytesPerSec) + "/s", [progress.speedBytesPerSec]);

  return {
    status, isOnline, isModalOpen, setIsModalOpen,
    error, updateInfo, progress, hasUpdate, downloadLabel, speedLabel,
    checkForUpdates, downloadAndInstall, restartApp,
  };
}
