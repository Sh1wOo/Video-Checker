import { useEffect, useMemo, useState } from 'react';
import { Folder, HardDrive, RefreshCcw, Smartphone } from 'lucide-react';
import { androidApi } from '../lib/android-api';
import type { AndroidDevice, AndroidEntry, AndroidStorageInfo } from '../types/android';
import { formatBytes } from '../lib/format';

type PickPayload = {
  serial: string;
  path: string;
  deviceName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick?: (payload: PickPayload) => void;
  onSelect?: (payload: PickPayload) => void;
  onConfirm?: (payload: PickPayload) => void;
};

const ROOT_FALLBACK = '/storage/emulated/0';

export default function AndroidFolderPicker({
  open,
  onClose,
  onPick,
  onSelect,
  onConfirm,
}: Props) {
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<AndroidDevice | null>(null);
  const [storage, setStorage] = useState<AndroidStorageInfo | null>(null);
  const [currentPath, setCurrentPath] = useState(ROOT_FALLBACK);
  const [entries, setEntries] = useState<AndroidEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitHandler = onPick ?? onSelect ?? onConfirm ?? null;

  const headerSubtitle = useMemo(() => {
    if (!selectedDevice) return 'Например: PICO 4 Ultra → Внутренний общий накопитель';
    return `${selectedDevice.displayName} → ${storage?.label ?? 'Внутренний общий накопитель'}`;
  }, [selectedDevice, storage]);

  async function loadDevices() {
    try {
      setLoadingDevices(true);
      setError(null);
      const list = await androidApi.listDevices();
      setDevices(list);

      if (list.length > 0) {
        const active = selectedDevice
          ? list.find((item) => item.serial === selectedDevice.serial) ?? list[0]
          : list[0];
        setSelectedDevice(active);
      } else {
        setSelectedDevice(null);
        setStorage(null);
        setEntries([]);
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Не удалось получить список устройств');
    } finally {
      setLoadingDevices(false);
    }
  }

  async function loadStorageAndFiles(device: AndroidDevice, path = ROOT_FALLBACK) {
    try {
      setLoadingEntries(true);
      setError(null);

      const info = await androidApi.getStorageInfo(device.serial);
      setStorage(info);

      const storageRoot = info.mountPath?.trim() || ROOT_FALLBACK;
      const normalizedPath =
        !path || path === '/' || path === '/sdcard' || path === '/storage'
          ? storageRoot
          : path;

      setCurrentPath(normalizedPath);

      const list = await androidApi.listFiles(device.serial, normalizedPath);
      setEntries(list);
    } catch (e) {
      setEntries([]);
      setError(typeof e === 'string' ? e : 'Не удалось открыть папку');
    } finally {
      setLoadingEntries(false);
    }
  }

  async function openFolder(path: string) {
    if (!selectedDevice) return;
    await loadStorageAndFiles(selectedDevice, path);
  }

  async function goBack() {
    if (!selectedDevice) return;
    const storageRoot = storage?.mountPath || ROOT_FALLBACK;
    if (currentPath === storageRoot) return;

    const trimmed = currentPath.replace(/\/$/, '');
    const idx = trimmed.lastIndexOf('/');
    const next = idx > storageRoot.length ? trimmed.slice(0, idx) : storageRoot;

    await openFolder(next);
  }

  function handleChooseCurrentFolder() {
    if (!selectedDevice) return;

    if (typeof submitHandler !== 'function') {
      setError('В App.tsx не передана функция onPick/onSelect/onConfirm для выбора папки.');
      return;
    }

    submitHandler({
      serial: selectedDevice.serial,
      path: currentPath,
      deviceName: selectedDevice.displayName,
    });
  }

  useEffect(() => {
    if (open) {
      void loadDevices();
    }
  }, [open]);

  useEffect(() => {
    if (open && selectedDevice) {
      void loadStorageAndFiles(selectedDevice, ROOT_FALLBACK);
    }
  }, [open, selectedDevice?.serial]);

  if (!open) return null;

  return (
    <div className="android-picker-overlay" onClick={onClose}>
      <div className="android-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="android-picker-header">
          <div>
            <h2>Выбор папки на Android / VR</h2>
            <p>{headerSubtitle}</p>
          </div>
          <button
            className="android-picker-refresh"
            onClick={() => void loadDevices()}
            disabled={loadingDevices}
            type="button"
          >
            <RefreshCcw size={18} />
            Обновить
          </button>
        </div>

        {error ? <div className="android-picker-error">{error}</div> : null}

        <div className="android-device-list">
          {devices.map((device) => (
            <button
              key={device.serial}
              type="button"
              className={`android-device-card ${selectedDevice?.serial === device.serial ? 'is-active' : ''}`}
              onClick={() => setSelectedDevice(device)}
            >
              <div className="android-device-title">
                <Smartphone size={18} />
                <span>{device.displayName}</span>
              </div>
              <div className="android-device-meta">
                <div>{device.serial}</div>
                <div>Состояние: {device.state}</div>
              </div>
            </button>
          ))}
        </div>

        {selectedDevice && storage ? (
          <div className="android-storage-card">
            <div className="android-device-title">
              <HardDrive size={18} />
              <span>{selectedDevice.displayName} → {storage.label}</span>
            </div>
            <div className="android-storage-meta">
              {storage.freeHuman} свободно из {storage.totalHuman}
            </div>
          </div>
        ) : null}

        <div className="android-picker-toolbar">
          <button
            className="android-picker-back"
            onClick={() => void goBack()}
            disabled={loadingEntries}
            type="button"
          >
            Назад
          </button>

          <input
            className="android-picker-path"
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
          />

          <button
            className="android-picker-open"
            onClick={() => void openFolder(currentPath)}
            disabled={!selectedDevice || loadingEntries}
            type="button"
          >
            Открыть
          </button>
        </div>

        <div className="android-browser-surface">
          {loadingEntries ? <div className="android-browser-empty">Загрузка…</div> : null}
          {!loadingEntries && entries.length === 0 ? (
            <div className="android-browser-empty">Папка пуста.</div>
          ) : null}

          {!loadingEntries && entries.length > 0 ? (
            <div className="android-browser-grid">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className="android-tile"
                  onClick={() => {
                    if (entry.isDir) {
                      void openFolder(entry.path);
                    }
                  }}
                  title={entry.path}
                >
                  <div className="android-tile-icon">
                    <Folder size={28} />
                  </div>
                  <div className="android-tile-name">{entry.name}</div>
                  <div className="android-tile-meta">
                    {entry.isDir ? 'Папка' : formatBytes(entry.size)}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="android-picker-footer">
          <button className="android-picker-cancel" onClick={onClose} type="button">
            Отмена
          </button>
          <button
            className="android-picker-confirm"
            onClick={handleChooseCurrentFolder}
            disabled={!selectedDevice}
            type="button"
          >
            Выбрать эту папку
          </button>
        </div>
      </div>
    </div>
  );
}