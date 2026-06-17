import { invoke } from '@tauri-apps/api/core';
import type { AndroidDevice, AndroidEntry, AndroidStorageInfo } from '../types/android';
import type { ScanResult } from '../types/scan';

export const androidApi = {
  listDevices: (): Promise<AndroidDevice[]> => invoke('android_list_devices'),
  getStorageInfo: (serial: string): Promise<AndroidStorageInfo> =>
    invoke('android_get_storage_info', { serial }),
  listFiles: (serial: string, path: string): Promise<AndroidEntry[]> =>
    invoke('android_list_files', { serial, path }),
  createDir: (serial: string, path: string): Promise<void> =>
    invoke('android_create_dir', { serial, path }),
  delete: (serial: string, path: string, isDir: boolean): Promise<void> =>
    invoke('android_delete', { serial, path, isDir }),
  rename: (serial: string, path: string, newName: string): Promise<string> =>
    invoke('android_rename', { serial, path, newName }),
  move: (serial: string, src: string, dst: string): Promise<void> =>
    invoke('android_move', { serial, src, dst }),
  pullFile: (serial: string, remote: string, local: string): Promise<void> =>
    invoke('android_pull_file', { serial, remote, local }),
  pushFile: (serial: string, local: string, remote: string): Promise<void> =>
    invoke('android_push_file', { serial, local, remote }),
  importFolder: (serial: string, localRoot: string, remoteRoot: string): Promise<void> =>
    invoke('android_import_folder', { serial, localRoot, remoteRoot }),
  scanPath: (serial: string, remotePath: string): Promise<ScanResult> =>
    invoke('android_scan_path', { serial, remotePath }),
};