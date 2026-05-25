import { FolderOpen, Loader2, ScanSearch } from 'lucide-react';

type Props = {
  folderPath: string;
  loading: boolean;
  onPickFolder: () => void | Promise<void>;
  onRunScan: () => void | Promise<void>;
};

export function ScanToolbar({ folderPath, loading, onPickFolder, onRunScan }: Props) {
  return (
    <div className="toolbar">
      <div className="path-box" title={folderPath || 'Папка не выбрана'}>
        {folderPath || 'Папка не выбрана'}
      </div>

      <button className="btn btn-secondary" type="button" onClick={onPickFolder}>
        <FolderOpen className="icon" />
        Выбрать папку
      </button>

      <button className="btn btn-primary" type="button" onClick={onRunScan} disabled={!folderPath || loading}>
        {loading ? <Loader2 className="icon spin" /> : <ScanSearch className="icon" />}
        {loading ? 'Сканирование...' : 'Начать подсчёт'}
      </button>
    </div>
  );
}
