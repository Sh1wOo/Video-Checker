import { TriangleAlert } from 'lucide-react';
import type { ScanProgress } from '../types/scan';
import { formatBytes } from '../lib/format';

type Props = {
  progress: ScanProgress | null;
  percent: number;
  error: string | null;
};

export function ProgressSection({ progress, percent, error }: Props) {
  return (
    <div className="progress-section">
      <div className="progress-bar" aria-label="Прогресс сканирования">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="progress-grid">
        <div className="meta-item">Файлы: {progress ? `${progress.scannedFiles} / ${progress.totalFiles}` : '—'}</div>
        <div className="meta-item">Размер: {progress ? `${formatBytes(progress.scannedBytes)} / ${formatBytes(progress.totalBytes)}` : '—'}</div>
        <div className="meta-item">Скорость: {progress ? `${progress.speedMibPerSec.toFixed(2)} МБ/с` : '—'}</div>
        <div className="meta-item">Время: {progress ? `${progress.elapsedSec.toFixed(2)} с` : '—'}</div>
        <div className="meta-item">Папок в дереве: {progress ? progress.treeBuiltFolders : '—'}</div>
      </div>

      <div className="current-path" title={progress?.currentPath || 'Ожидание запуска'}>
        {progress?.currentPath || 'Ожидание запуска'}
      </div>

      {error && (
        <div className="error-box" role="alert">
          <TriangleAlert className="icon" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
