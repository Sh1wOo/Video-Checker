import type { AiAnalysisResult, AiVideoFinding, FolderNode } from "../types/scan";
import type { AnalysisMetrics, AiSort, FolderScenario, TreeSort } from "../types/panel-settings";

export function sortFolderTree(node: FolderNode, sortBy: TreeSort): FolderNode {
  const sortedChildren = node.children
    .map((child) => sortFolderTree(child, sortBy))
    .sort((left, right) => {
      if (sortBy === "files") return right.totalVideoFiles - left.totalVideoFiles;
      if (sortBy === "duration") return right.totalDurationSec - left.totalDurationSec;
      if (sortBy === "name") return left.name.localeCompare(right.name, "ru", { sensitivity: "base" });
      return left.path.localeCompare(right.path, "ru", { sensitivity: "base" });
    });
  return { ...node, children: sortedChildren };
}

export function flattenTree(root: FolderNode): FolderNode[] {
  const nodes: FolderNode[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.shift();
    if (!node) continue;
    nodes.push(node);
    stack.unshift(...node.children);
  }
  return nodes;
}

export function filterFindings(
  items: AiVideoFinding[],
  query: string,
  deletedPaths: Set<string>,
): AiVideoFinding[] {
  const value = query.trim().toLowerCase();
  return items.filter((item) => {
    if (deletedPaths.has(item.path)) return false;
    if (!value) return true;
    return [item.fileName, item.path, item.issue, item.scenario, item.scenarioTitle, item.detectedAction]
      .some((text) => text.toLowerCase().includes(value));
  });
}

export function sortFindings(items: AiVideoFinding[], sort: AiSort): AiVideoFinding[] {
  return [...items].sort((left, right) => {
    if (sort === "confidence") return right.confidence - left.confidence;
    if (sort === "name") return left.fileName.localeCompare(right.fileName, "ru");
    return right.roundedDurationSec - left.roundedDurationSec;
  });
}

export function buildAnalysisMetrics(
  analysis: AiAnalysisResult,
  deletedPaths: Set<string>,
): AnalysisMetrics {
  const shortVideos = analysis.shortVideos.filter((item) => !deletedPaths.has(item.path));
  const durationBandVideos = analysis.durationBandVideos.filter((item) => !deletedPaths.has(item.path));
  const brokenVideos = analysis.brokenVideos.filter((item) => !deletedPaths.has(item.path));
  const behaviorVideos = analysis.passiveBehaviorVideos.filter((item) => !deletedPaths.has(item.path));
  const checkedFiles = Math.max(analysis.totalVideoFiles - deletedPaths.size, 0);
  const brokenCount = brokenVideos.length;
  const behaviorCount = behaviorVideos.length;
  const okCount = Math.max(checkedFiles - brokenCount - behaviorCount, 0);
  const issueRate = checkedFiles ? ((brokenCount + behaviorCount) / checkedFiles) * 100 : 0;
  const averageShortSec = durationBandVideos.length
    ? durationBandVideos.reduce((sum, item) => sum + item.roundedDurationSec, 0) / durationBandVideos.length
    : 0;
  const averageConfidence = behaviorVideos.length
    ? behaviorVideos.reduce((sum, item) => sum + item.confidence, 0) / behaviorVideos.length
    : 0;

  return {
    checkedFiles,
    shortCount: shortVideos.length,
    durationBandCount: durationBandVideos.length,
    brokenCount,
    behaviorCount,
    okCount,
    issueRate,
    averageShortSec,
    averageConfidence,
    deletedCount: deletedPaths.size,
    durationBars: topBars(durationBandVideos.map((item) => `${item.durationBucketSec} сек`), 8),
    scenarioBars: topBars([...durationBandVideos, ...behaviorVideos].map((item) => item.scenarioTitle), 5),
    issueBars: topBars([...brokenVideos, ...behaviorVideos].map((item) => item.detectedAction), 5),
  };
}

export function topBars(values: string[], limit: number) {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = Math.max(...rows.map(([, v]) => v), 1);
  return rows.map(([label, value]) => ({ label, value, percent: (value / max) * 100 }));
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

export function formatUnixDate(value: number): string {
  if (!value) return "неизвестно";
  return new Date(value * 1000).toLocaleString("ru-RU");
}

export function toFolderScenario(folder: FolderNode): FolderScenario {
  return {
    path: folder.path,
    name: folder.name,
    owner: inferFolderOwner(folder),
    scenarioTitle: inferFolderScenarioTitle(folder),
    totalVideoFiles: folder.totalVideoFiles,
    totalDurationSec: folder.totalDurationSec,
  };
}

export function inferFolderScenarioTitle(folder: FolderNode): string {
  const text = `${folder.path} ${folder.name}`.toLowerCase();
  if (containsAny(text, ["выклад", "вклад", "расклад", "разлож", "товар", "вещ", "предмет", "item", "place"])) return "Выкладка вещей";
  if (containsAny(text, ["упаков", "pack", "box", "короб"])) return "Упаковка";
  if (containsAny(text, ["собир", "sort", "комплект", "набор"])) return "Сборка заказа";
  if (containsAny(text, ["телефон", "phone", "mobile", "смартф"])) return "Телефон";
  if (containsAny(text, ["кур", "smok", "cigar", "сигар"])) return "Курение";
  if (containsAny(text, ["еда", "ест", "eat", "food", "обед"])) return "Еда";
  if (containsAny(text, ["общ", "talk", "говор", "разговор"])) return "Общение";
  if (containsAny(text, ["ожидан", "idle", "безд", "ничего", "stand"])) return "Бездействие";
  return humanizeFolderName(folder.name);
}

export function inferFolderOwner(folder: FolderNode): string {
  const source = folder.name || folder.path.split(/[/\\]/).pop() || "";
  const tokens = source
    .replace(/\.[^.]+$/, "")
    .split(/[_\-\s]+/)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && !/^\d{1,2}\.\d{1,2}$/.test(t));
  const personTokens = tokens.slice(0, 2).map(capitalizeToken);
  return personTokens.length ? personTokens.join(" ") : "Не определён";
}

function humanizeFolderName(name: string): string {
  const words = name
    .replace(/\.[^.]+$/, "")
    .split(/[_\-\s]+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .slice(0, 3)
    .map(capitalizeToken);
  return words.length ? words.join(" ") : "Сценарий папки";
}

function capitalizeToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}
