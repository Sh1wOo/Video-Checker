export type ActiveTab = "tree" | "ai" | "control" | "intelligence";
export type AiSort = "duration" | "confidence" | "name";
export type TreeSort = "path" | "name" | "files" | "duration";

export type PanelSettings = {
  showAi: boolean;
  showControl: boolean;
  showIntelligence: boolean;
  showRecovery: boolean;
};

export type AnalysisMetrics = {
  checkedFiles: number;
  shortCount: number;
  durationBandCount: number;
  brokenCount: number;
  behaviorCount: number;
  okCount: number;
  issueRate: number;
  averageShortSec: number;
  averageConfidence: number;
  deletedCount: number;
  durationBars: Array<{ label: string; value: number; percent: number }>;
  scenarioBars: Array<{ label: string; value: number; percent: number }>;
  issueBars: Array<{ label: string; value: number; percent: number }>;
};

export type FolderScenario = {
  path: string;
  name: string;
  owner: string;
  scenarioTitle: string;
  totalVideoFiles: number;
  totalDurationSec: number;
};

export type ScenarioNote = {
  code: string;
  description: string;
};
