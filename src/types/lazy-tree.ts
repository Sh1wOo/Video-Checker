export type FolderChild = {
  name: string;
  path: string;
  hasChildren: boolean;
  totalVideoFiles: number;
  totalDurationSec: number;
  totalBytes: number;
};

export type LazyScanSummary = {
  rootPath: string;
  totalVideoFiles: number;
  totalDurationSec: number;
  totalBytes: number;
  elapsedSec: number;
  failedFiles: number;
  cacheHits: number;
  indexedFolders: number;
};

export type LazyScanResult = {
  summary: LazyScanSummary;
  root: FolderChild;
};
