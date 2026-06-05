import { useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { Clock3, Film, HardDrive, TriangleAlert, Zap, Download, FolderOpen, X, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ScanResult } from '../types/scan';
import { formatBytes, formatHoursDecimal } from '../lib/format';

type Props = { result: ScanResult | null };

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-left">{icon}{label}</div>
      <div className="stat-right">{value}</div>
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
  rows.push(['Путь', 'Глубина', 'Видео (прямые)', 'Видео (всего)', 'Длительность (часы)', 'Длительность (сек)', 'Размер'].join(','));
  walk(node);
  // UTF-8 BOM чтобы Excel открывал корректно
  return '\uFEFF' + rows.join('\r\n');
}

async function ensureNotificationPermission() {
  let granted = await isPermissionGranted();
  if (!granted) {
    const perm = await requestPermission();
    granted = perm === 'granted';
  }
  return granted;
}

export function StatsPanel({ result }: Props) {
  const summary = result?.summary;
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filePath, setFilePath] = useState('');

  function openModal() {
    if (!result) return;
    setSavedPath(null);
    setErrorMessage(null);
    setFilePath('');
    setModalOpen(true);
  }

  async function choosePath() {
    try {
      const p = await save({
        title: 'Сохранить отчёт',
        defaultPath: 'folder-report.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (p) setFilePath(p);
    } catch {
      setErrorMessage('Не удалось выбрать путь.');
    }
  }

  async function saveReport() {
    if (!result || !filePath) { setErrorMessage('Выберите путь.'); return; }
    setSaving(true);
    setErrorMessage(null);
    try {
      const csv = buildFolderReportCsv(result.tree);
      await invoke('save_report', { path: filePath, content: csv });
      setSavedPath(filePath);
      if (await ensureNotificationPermission()) {
        await sendNotification({ title: 'Отчёт сохранён ✓', body: filePath });
      }
    } catch (err) {
      setErrorMessage(typeof err === 'string' ? err : 'Ошибка при сохранении.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel stats-list">
      <div className="panel-header with-border">
        <h2 className="panel-title">Статистика</h2>
      </div>

      <StatCard icon={<Clock3 className="icon icon-primary" />} label="Общая длительность" value={summary ? formatHoursDecimal(summary.totalDurationSec) : '—'} />
      <StatCard icon={<Film className="icon icon-primary" />} label="Видео" value={summary?.totalVideoFiles ?? 0} />
      <StatCard icon={<HardDrive className="icon icon-primary" />} label="Объём" value={summary ? formatBytes(summary.totalBytes) : '—'} />
      <StatCard icon={<TriangleAlert className="icon icon-primary" />} label="Ошибки" value={summary?.failedFiles ?? 0} />
      <StatCard icon={<Zap className="icon icon-primary" />} label="Кеш-хиты" value={summary?.cacheHits ?? 0} />

      <div className="stats-footer">
        <button className="btn export-btn" onClick={openModal} disabled={!result}>
          <span className="export-btn-glow" />
          <FileSpreadsheet className="icon" />
          Экспорт отчёта
          <Download className="icon export-btn-arrow" />
        </button>
      </div>

      {modalOpen && createPortal(
        <div
          className="em-backdrop"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div className="em-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="em-header">
              <div className="em-header-icon">
                <FileSpreadsheet size={20} />
              </div>
              <div className="em-header-text">
                <h3 className="em-title">Экспорт отчёта</h3>
                <p className="em-subtitle">CSV с деревом папок и метриками видео</p>
              </div>
              <button className="em-close" onClick={() => setModalOpen(false)} disabled={saving}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            {savedPath ? (
              <div className="em-success">
                <div className="em-success-icon-wrap">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <strong className="em-success-title">Отчёт сохранён!</strong>
                  <p className="em-success-path">{savedPath}</p>
                </div>
              </div>
            ) : (
              <div className="em-body">
                <div className="em-field">
                  <label className="em-label">Путь для сохранения</label>
                  <div className="em-path-row">
                    <input
                      className="path-box em-input"
                      type="text"
                      value={filePath}
                      placeholder="Выберите путь через кнопку →"
                      readOnly
                    />
                    <button className="btn btn-secondary em-choose-btn" onClick={choosePath} disabled={saving}>
                      <FolderOpen size={15} />
                      Выбрать
                    </button>
                  </div>
                </div>
                {errorMessage && (
                  <div className="em-error">{errorMessage}</div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="em-footer">
              {savedPath ? (
                <button className="btn btn-primary em-action-btn" onClick={() => setModalOpen(false)}>
                  Готово
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                    Отмена
                  </button>
                  <button
                    className="btn em-save-btn"
                    onClick={saveReport}
                    disabled={saving || !filePath}
                  >
                    {saving
                      ? <><Loader2 size={15} className="spin" /> Сохранение...</>
                      : <><Download size={15} /> Сохранить отчёт</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}