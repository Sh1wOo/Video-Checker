export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "offline"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "error";

export type UpdateProgress = {
  chunkLength: number;
  contentLength: number | null;
  downloaded: number;
  percent: number;
  speedBytesPerSec: number;
};

export type UpdateInfo = {
  currentVersion: string;
  version: string;
  body?: string;
  date?: string;
};
