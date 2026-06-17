import { ChevronDown, FolderOpen, Loader2, ScanSearch, Smartphone } from 'lucide-react';

export type ScanInputSource = 'pc' | 'android';

type Props = {
  folderPath: string;
  loading: boolean;
  scanSourceLabel?: string | null;
  source: ScanInputSource;
  onSourceChange: (value: ScanInputSource) => void;
  onFolderPathChange: (value: string) => void;
  onPickFolder: () => void | Promise<void>;
  onRunScan: () => void | Promise<void>;
};

export function ScanToolbar({
  folderPath,
  loading,
  scanSourceLabel,
  source,
  onSourceChange,
  onFolderPathChange,
  onPickFolder,
  onRunScan,
}: Props) {
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

      <div className="source-select-wrap">
        <select
          className="source-select"
          value={source}
          onChange={(e) => onSourceChange(e.target.value as ScanInputSource)}
          disabled={loading}
        >
          <option value="pc">ПК</option>
          <option value="android">Android / VR</option>
        </select>
        <ChevronDown className="icon source-select-icon" />
      </div>

      <button className="btn btn-secondary" type="button" onClick={onPickFolder}>
        {source === 'pc' ? <FolderOpen className="icon" /> : <Smartphone className="icon" />}
        Выбрать папку
      </button>

      <button className="btn btn-primary" type="button" onClick={onRunScan} disabled={!folderPath || loading}>
        {loading ? <Loader2 className="icon spin" /> : <ScanSearch className="icon" />}
        {loading ? 'Сканирование...' : 'Начать подсчёт'}
      </button>

      {scanSourceLabel ? <div className="toolbar-source-badge">{scanSourceLabel}</div> : null}
    </div>
  );
}
