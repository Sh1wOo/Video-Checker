import { useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { Clock3, Film, HardDrive, TriangleAlert, Zap } from 'lucide-react';
import type { ScanResult } from '../types/scan';
import { formatBytes, formatHoursDecimal } from '../lib/format';

type Props = {
  result: ScanResult | null;
};

type ExportState = {
  open: boolean;
  path: string;
  filename: string;
};

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-left">
        {icon}
        <span>{label}</span>
      </div>
      <div className="stat-right">
        <div>{value}</div>
        {sub ? <div className="stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

function escapeCsv(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function buildFolderReportCsv(node: ScanResult['tree']) {
  const rows: string[] = [];

  function walk(folder: typeof node) {
    rows.push([
      escapeCsv(folder.path),
      escapeCsv(folder.depth),
      escapeCsv(folder.directVideoFiles),
      escapeCsv(folder.totalVideoFiles),
      escapeCsv(formatHoursDecimal(folder.totalDurationSec)),
      escapeCsv(folder.totalDurationSec),
      escapeCsv(formatBytes(folder.totalBytes)),
    ].join(','));

    folder.children.forEach(walk);
  }

  rows.push([
    'Путь',
    'Глубина',
    'Видео (прямые)',
    'Видео (всего)',
    'Длительность (часы)',
    'Длительность (сек)',
    'Размер',
  ].join(','));

  walk(node);
  return rows.join('\r\n');
}

async function ensureNotificationPermission() {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  return granted;
}

export function StatsPanel({ result }: Props) {
  const summary = result?.summary;
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>({
    open: false,
    path: "",
    filename: "folder-report.csv",
  });

  function handleOpenExportModal() {
    if (!result) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setExportState({ open: true, path: "", filename: "folder-report.csv" });
  }

  async function handleChoosePath() {
    try {
      const filePath = await save({
        title: 'Выберите место для отчёта',
        defaultPath: exportState.filename,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (filePath) {
        setExportState((prev) => ({ ...prev, path: filePath }));
      }
    } catch (error) {
      setErrorMessage(typeof error === 'string' ? error : 'Не удалось выбрать путь.');
    }
  }

  async function handleSaveReport() {
    if (!result) return;
    if (!exportState.path) {
      setErrorMessage('Сначала выберите путь для сохранения.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const csv = buildFolderReportCsv(result.tree);
      await invoke('save_report', { path: exportState.path, content: csv });
      setStatusMessage(`Отчёт сохранён: ${exportState.path}`);
      setExportState((prev) => ({ ...prev, open: false }));

      if (await ensureNotificationPermission()) {
        await sendNotification({
          title: 'Отчёт сохранён',
          body: `Файл сохранён по пути ${exportState.path}`,
        });
      }
    } catch (error) {
      setErrorMessage(typeof error === 'string' ? error : 'Не удалось сохранить отчёт.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Статистика</h2>
          <p className="panel-subtitle">Здесь отображаются основные метрики сканирования и сохранение отчётов.</p>
        </div>
      </div>

      <div className="stats-list">
        <StatCard icon={<Clock3 className="icon" />} label="Общая длительность" value={summary ? formatHoursDecimal(summary.totalDurationSec) : '—'} />
        <StatCard icon={<Film className="icon" />} label="Видео" value={summary?.totalVideoFiles ?? 0} />
        <StatCard icon={<HardDrive className="icon" />} label="Объём" value={summary ? formatBytes(summary.totalBytes) : '—'} />
        <StatCard icon={<TriangleAlert className="icon" />} label="Ошибки" value={summary?.failedFiles ?? 0} />
        <StatCard icon={<Zap className="icon" />} label="Кеш-хиты" value={summary?.cacheHits ?? 0} />
      </div>

      <div className="stats-footer">
        <button className="badge badge-open-folder big-export-button" type="button" onClick={handleOpenExportModal} disabled={!result || saving}>
          <Zap className="badge-icon" />
          {saving ? 'Сохранение...' : 'Экспорт отчёта'}
        </button>
      </div>

      {statusMessage ? <div className="panel-notice">{statusMessage}</div> : null}
      {errorMessage ? <div className="panel-error">{errorMessage}</div> : null}

      {exportState.open ? (
        <div className="export-modal-backdrop" role="presentation" onClick={() => setExportState((prev) => ({ ...prev, open: false }))}>
          <div className="export-modal" role="dialog" aria-modal="true" aria-label="Экспорт отчёта" onClick={(event) => event.stopPropagation()}>
            <div className="chart-head">
              <h3>Экспорт отчёта</h3>
              <button className="badge" type="button" onClick={() => setExportState((prev) => ({ ...prev, open: false }))}>
                Закрыть
              </button>
            </div>
            <div className="export-form-row">
              <label>
                Имя файла
                <input
                  value={exportState.filename}
                  onChange={(event) => setExportState((prev) => ({ ...prev, filename: event.target.value }))}
                  placeholder="folder-report.csv"
                />
              </label>
              <label>
                Путь для файла
                <div className="export-path-row">
                  <input type="text" value={exportState.path} placeholder="Выберите путь" readOnly />
                  <button className="badge badge-open-folder" type="button" onClick={handleChoosePath}>
                    Выбрать
                  </button>
                </div>
              </label>
            </div>
            <div className="export-modal-actions">
              <button className="badge badge-open-folder" type="button" onClick={handleSaveReport} disabled={!exportState.path || saving}>
                {saving ? 'Сохранение...' : 'Сохранить отчёт'}
              </button>
              <button className="badge" type="button" onClick={() => setExportState((prev) => ({ ...prev, open: false }))}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
