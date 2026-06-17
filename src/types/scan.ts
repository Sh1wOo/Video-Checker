export type FolderNode = {
  path: string;
  name: string;
  depth: number;
  directVideoFiles: number;
  totalVideoFiles: number;
  directDurationSec: number;
  totalDurationSec: number;
  directBytes: number;
  totalBytes: number;
  children: FolderNode[];
};

export type ScanProgress = {
  scannedFiles: number;
  totalFiles: number;
  scannedBytes: number;
  totalBytes: number;
  speedMibPerSec: number;
  elapsedSec: number;
  currentPath?: string | null;
  treeBuiltFolders: number;
};

export type ScanSummary = {
  rootPath: string;
  totalVideoFiles: number;
  totalDurationSec: number;
  totalBytes: number;
  elapsedSec: number;
  failedFiles: number;
  cacheHits: number;
};

export type ScanResult = {
  summary: ScanSummary;
  tree: FolderNode;
};

export type AiVideoFinding = {
  path: string;
  fileName: string;
  durationSec: number;
  roundedDurationSec: number;
  issue: string;
  scenario: string;
  scenarioTitle: string;
  detectedAction: string;
  expectedAction: string;
  confidence: number;
  fileSizeBytes: number;
  extension: string;
  parentFolder: string;
  modifiedUnix: number;
  durationBucketSec: number;
  isProblem: boolean;
  problemKind: string;
};

export type AiAnalysisResult = {
  rootPath: string;
  totalVideoFiles: number;
  checkedFiles: number;
  shortVideos: AiVideoFinding[];
  durationBandVideos: AiVideoFinding[];
  brokenVideos: AiVideoFinding[];
  passiveBehaviorVideos: AiVideoFinding[];
};

export type ProgressEvent =
  | {
      type: "progress";
      scannedFiles: number;
      totalFiles: number;
      scannedBytes: number;
      totalBytes: number;
      speedMibPerSec: number;
      elapsedSec: number;
      currentPath?: string | null;
      treeBuiltFolders: number;
    }
  | {
      type: "Progress";
      scanned_files: number;
      total_files: number;
      scanned_bytes: number;
      total_bytes: number;
      speed_mib_per_sec: number;
      elapsed_sec: number;
      current_path?: string | null;
      tree_built_folders: number;
    };