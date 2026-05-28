import { FolderOpen, Loader2, ScanSearch } from 'lucide-react';

type Props = {
  folderPath: string;
  loading: boolean;
  onFolderPathChange: (value: string) => void;
  onPickFolder: () => void | Promise<void>;
  onRunScan: () => void | Promise<void>;
};

export function ScanToolbar({ folderPath, loading, onFolderPathChange, onPickFolder, onRunScan }: Props) {
  return (
    <div className="toolbar">
      <input
        className="path-box"
        type="text"
        value={folderPath}
        placeholder="Папка не выбрана"
        title={folderPath || 'Папка не выбрана'}
        onChange={(event) => onFolderPathChange(event.target.value)}
        disabled={loading}
      />

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
