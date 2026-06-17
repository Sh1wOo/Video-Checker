import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { CheckCircle2, FileVideo, FolderOpen, Loader2, RotateCcw, Search, TriangleAlert } from "lucide-react";
import type { AiAnalysisResult } from "../../types/scan";
import { formatBytes } from "../../lib/format";

async function openPathInExplorer(path: string) {
  try { await openPath(path); } catch { /* no-op */ }
}

function getRecoveredPath(path: string): string {
  const sep = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  const fileName = sep >= 0 ? path.slice(sep + 1) : path;
  const dir = path.slice(0, path.length - fileName.length);
  const dot = fileName.lastIndexOf(".");
  return dot > 0
    ? `${dir}${fileName.slice(0, dot)}_recovered${fileName.slice(dot)}`
    : `${dir}${fileName}_recovered`;
}

export function RecoveryPanel({ analysis }: { analysis: AiAnalysisResult | null }) {
  const brokenVideos = analysis?.brokenVideos ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<Set<string>>(() => new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [recoverAll, setRecoverAll] = useState(false);
  const [recoverAllMsg, setRecoverAllMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = brokenVideos.filter(
    (v) => !filter.trim() ||
      v.fileName.toLowerCase().includes(filter.toLowerCase()) ||
      v.path.toLowerCase().includes(filter.toLowerCase()),
  );

  async function recoverOne(path: string, useReference = false) {
    let referencePath: string | null = null;
    if (useReference) {
      const picked = await open({
        title: "Выберите исправное видео с той же камеры (образец)",
        filters: [{ name: "Видео", extensions: ["mp4", "mov", "avi", "mkv", "3gp"] }],
        multiple: false,
      });
      if (!picked) return;
      referencePath = picked as string;
    }
    setRecovering((prev) => new Set(prev).add(path));
    try {
      const outputFolder = path.replace(/[^\\/]+$/, "");
      if (referencePath) {
        await invoke<string>("recover_broken_video_with_reference", { path, outputFolder, referencePath });
      } else {
        await invoke<string>("recover_broken_video", { path, outputFolder });
      }
      setResults((prev) => ({ ...prev, [path]: { ok: true, msg: "Успешно: файл сохранён." } }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [path]: { ok: false, msg: typeof err === "string" ? err : "Ошибка восстановления." },
      }));
    } finally {
      setRecovering((prev) => { const s = new Set(prev); s.delete(path); return s; });
    }
  }

  async function recoverAllFn() {
    setRecoverAll(true);
    setRecoverAllMsg(null);
    const failed: string[] = [];
    for (const v of brokenVideos) {
      const outputFolder = v.path.replace(/[^\\/]+$/, "");
      try {
        await invoke("recover_broken_video", { path: v.path, outputFolder });
        setResults((prev) => ({ ...prev, [v.path]: { ok: true, msg: "Успешно восстановлено." } }));
      } catch (err) {
        failed.push(v.fileName);
        setResults((prev) => ({
          ...prev,
          [v.path]: { ok: false, msg: typeof err === "string" ? err : "Ошибка." },
        }));
      }
    }
    setRecoverAllMsg(
      failed.length === 0
        ? `Все ${brokenVideos.length} файлов восстановлены успешно.`
        : `Восстановлено ${brokenVideos.length - failed.length} из ${brokenVideos.length}. Для оставшихся ${failed.length} попробуйте ручной режим с образцом.`,
    );
    setRecoverAll(false);
  }

  const selectedVideo = brokenVideos.find((v) => v.path === selected) ?? null;
  const doneCount = Object.values(results).filter((r) => r.ok).length;

  return (
    <div className="rp-root">
      <div className="rp-hero">
        <div className="rp-hero-left">
          <span className="rp-eyebrow">AI Восстановление</span>
          <h2 className="rp-title">Восстановление файлов</h2>
          <p className="rp-subtitle">
            Система нашла&nbsp;<strong>{brokenVideos.length}</strong>&nbsp;битых видео.
            {doneCount > 0 && <>&nbsp;Восстановлено: <strong>{doneCount}</strong>.</>}
          </p>
        </div>
        <div className="rp-hero-stats">
          <div className="rp-stat"><span className="rp-stat-num rp-stat-broken">{brokenVideos.length}</span><span className="rp-stat-label">Битых</span></div>
          <div className="rp-stat-divider" />
          <div className="rp-stat"><span className="rp-stat-num rp-stat-ok">{doneCount}</span><span className="rp-stat-label">Готово</span></div>
        </div>
      </div>

      {brokenVideos.length === 0 ? (
        <div className="rp-empty"><span className="rp-empty-icon">🎉</span><strong>Битых файлов не найдено</strong><p>Запустите AI-анализ, чтобы проверить видеотеку.</p></div>
      ) : (
        <>
          <div className="rp-toolbar">
            <div className="management-search">
              <Search className="icon" />
              <input value={filter} placeholder="Фильтр по имени или пути..." onChange={(e) => setFilter(e.target.value)} />
            </div>
            <button className="btn rp-recover-all-btn" onClick={recoverAllFn} disabled={recoverAll || brokenVideos.length === 0}>
              {recoverAll ? <><Loader2 size={15} className="spin" /> Авто-восстановление...</> : <><RotateCcw size={15} /> Восстановить все ({brokenVideos.length})</>}
            </button>
          </div>

          {recoverAllMsg && (
            <div className={`rp-all-result ${recoverAllMsg.includes("оставшихся") ? "rp-all-error" : "rp-all-ok"}`}>{recoverAllMsg}</div>
          )}

          <div className="rp-split">
            <div className="rp-file-list">
              {filtered.length === 0 && <div className="rp-no-match">Нет совпадений</div>}
              {filtered.map((video) => {
                const res = results[video.path];
                return (
                  <button
                    key={video.path}
                    className={`rp-file-card${selected === video.path ? " rp-file-card-active" : ""}${res?.ok ? " rp-file-card-done" : ""}${res && !res.ok ? " rp-file-card-err" : ""}`}
                    onClick={() => setSelected(video.path)}
                  >
                    <div className="rp-file-card-top">
                      <span className="rp-file-icon">{res?.ok ? "✅" : res ? "❌" : recovering.has(video.path) ? "⏳" : "🔴"}</span>
                      <div className="rp-file-card-info">
                        <strong className="rp-file-name">{video.fileName}</strong>
                        <small className="rp-file-issue">{video.issue || "Неизвестная ошибка"}</small>
                      </div>
                    </div>
                    <small className="rp-file-path">{video.parentFolder}</small>
                  </button>
                );
              })}
            </div>

            <div className="rp-detail">
              {!selectedVideo ? (
                <div className="rp-detail-empty"><span>👈</span><p>Выберите файл из списка слева для восстановления</p></div>
              ) : (
                <div className="rp-detail-content">
                  <div className="rp-detail-header">
                    <h3 className="rp-detail-filename">{selectedVideo.fileName}</h3>
                    <span className={`rp-detail-status ${results[selected!]?.ok ? "ok" : "pending"}`}>{results[selected!]?.ok ? "Восстановлен" : "Ожидает"}</span>
                  </div>
                  <div className="rp-meta-grid">
                    <div className="rp-meta-item"><span className="rp-meta-key">Причина</span><span className="rp-meta-val">{selectedVideo.issue || "—"}</span></div>
                    <div className="rp-meta-item"><span className="rp-meta-key">Размер</span><span className="rp-meta-val">{formatBytes(selectedVideo.fileSizeBytes)}</span></div>
                  </div>
                  <div className="rp-path-block">
                    <span className="rp-path-label">Оригинал</span>
                    <code className="rp-path-code">{selectedVideo.path}</code>
                    <span className="rp-path-label">Результат:</span>
                    <code className="rp-path-code rp-path-out">{getRecoveredPath(selectedVideo.path)}</code>
                  </div>
                  {results[selected!] && (
                    <div className={`rp-result-box ${results[selected!].ok ? "ok" : "err"}`}>
                      {results[selected!].ok ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} className="shrink-0" />}
                      <span>{results[selected!].msg}</span>
                    </div>
                  )}
                  <div className="rp-detail-actions">
                    <button className="btn rp-open-btn" onClick={() => openPathInExplorer(selectedVideo.parentFolder)} title="Открыть папку"><FolderOpen size={16} /></button>
                    <div className="rp-recover-group">
                      <button className="btn rp-recover-btn" onClick={() => recoverOne(selectedVideo.path, false)} disabled={recovering.has(selectedVideo.path) || results[selectedVideo.path]?.ok}>
                        {recovering.has(selectedVideo.path) ? <><Loader2 size={15} className="spin" /> Ремонт...</> : results[selectedVideo.path]?.ok ? <><CheckCircle2 size={15} /> Готово</> : <><RotateCcw size={15} /> Авто</>}
                      </button>
                      <button className="btn rp-recover-ref-btn" onClick={() => recoverOne(selectedVideo.path, true)} disabled={recovering.has(selectedVideo.path) || results[selectedVideo.path]?.ok} title="Выбрать здоровое видео с этой же камеры">
                        <FileVideo size={15} /> С образцом
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
