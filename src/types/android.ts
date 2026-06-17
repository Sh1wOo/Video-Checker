export interface AndroidDevice {
  serial: string;
  state: string;
  model: string;
  displayName: string;
  product?: string;
  device?: string;
}

export interface AndroidStorageInfo {
  label: string;
  mountPath: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  totalHuman: string;
  usedHuman: string;
  freeHuman: string;
}

export interface AndroidEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}