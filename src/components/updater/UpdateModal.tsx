import { createPortal } from "react-dom";
import type { UpdateInfo, UpdateProgress, UpdateStatus } from "../../types/updater";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

type Props = {
  open: boolean;
  status: UpdateStatus;
  error: string | null;
  info: UpdateInfo | null;
  progress: UpdateProgress;
  isOnline: boolean;
  onClose: () => void;
  onCheck: () => void;
  onDownload: () => void;
  onRestart: () => void;
};

export function UpdateModal({
  open, status, error, info, progress, isOnline,
  onClose, onCheck, onDownload, onRestart,
}: Props) {
  if (!open) return null;

  const canDownload = status === "available";
  const isBusy = status === "checking" || status === "downloading" || status === "installing";
  const pct = status === "installed" ? 100 : progress.percent;

  return createPortal(
    <div className="info-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Обновление приложения"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chart-head">
          <h3>Обновление приложения</h3>
          <button className="badge" type="button" onClick={onClose}>Закрыть</button>
        </div>

        {!isOnline
          ? <p>Нет сети — проверка недоступна.</p>
          : <p>Здесь можно проверить, скачать и установить новую версию приложения.</p>}

        <div className="scenario-note-list">
          <div className="scenario-note-chip"><strong>Статус</strong><span>{status}</span></div>
          <div className="scenario-note-chip">
            <strong>Версии</strong>
            <span>
              {info ? `${info.currentVersion} → ${info.version}` : "—"}
            </span>
          </div>
          <div className="scenario-note-chip">
            <strong>Скачано</strong>
            <span>
              {formatBytes(progress.downloaded)}
              {progress.contentLength ? ` / ${formatBytes(progress.contentLength)}` : ""}
            </span>
          </div>
          <div className="scenario-note-chip">
            <strong>Скорость</strong>
            <span>{formatBytes(progress.speedBytesPerSec)}/s</span>
          </div>
        </div>

        <div style={{ margin: "12px 0 4px" }}>
          <div className="bar-track">
            <span style={{ width: `${pct}%` }} />
          </div>
          <small style={{ marginTop: 4, display: "block" }}>{pct.toFixed(0)}%</small>
        </div>

        {info?.body ? <p style={{ marginTop: 8 }}>{info.body}</p> : null}
        {error ? <div className="error-box" style={{ marginTop: 8 }}>{error}</div> : null}

        <div className="rp-detail-actions" style={{ marginTop: 16 }}>
          <button className="badge" type="button" onClick={onCheck} disabled={!isOnline || isBusy}>
            Проверить наличие обновлений
          </button>
          <button className="badge badge-open-folder" type="button" onClick={onDownload} disabled={!canDownload}>
            Загрузить последнюю версию
          </button>
          <button className="badge" type="button" onClick={onRestart} disabled={status !== "installed"}>
            Перезапустить приложение
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
