import { useState } from "react";
import { ExternalLink, FolderOpen, Search, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import type { AiAnalysisResult, AiVideoFinding } from "../../types/scan";
import type { AiSort } from "../../types/panel-settings";
import { formatBytes, formatDuration } from "../../lib/format";
import {
  buildAnalysisMetrics,
  filterFindings,
  formatPercent,
  formatUnixDate,
  sortFindings,
} from "../../lib/analysis-utils";
import { InfoTip } from "./InfoTip";
import { BarChartCard } from "./BarChartCard";

async function openPathInExplorer(path: string) {
  try { await openPath(path); } catch { /* no-op */ }
}

async function deleteVideo(
  path: string,
  setDeletingPath: (p: string | null) => void,
  onDeleted?: (p: string) => void,
) {
  setDeletingPath(path);
  try {
    await invoke("delete_video_file", { path });
    onDeleted?.(path);
  } catch { /* no-op */ } finally {
    setDeletingPath(null);
  }
}

type Metrics = ReturnType<typeof buildAnalysisMetrics>;

function AnalysisKpis({ metrics }: { metrics: Metrics }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card kpi-card-main">
        <span>KPI качества <InfoTip text="Процент найденных видео без битых файлов и поведенческих нарушений." /></span>
        <strong>{formatPercent(100 - metrics.issueRate)}</strong>
        <small>без замечаний после AI анализа</small>
      </div>
      <div className="kpi-card">
        <span>Доля проблем <InfoTip text="Отношение всех замечаний к количеству проверенных видео." /></span>
        <strong>{formatPercent(metrics.issueRate)}</strong>
        <small>{metrics.brokenCount + metrics.behaviorCount} из {metrics.checkedFiles}</small>
      </div>
      <div className="kpi-card">
        <span>Средняя длина сценариев <InfoTip text="Средняя округлённая длительность видео из диапазона коротких сценариев 6-30 секунд." /></span>
        <strong>{formatDuration(Math.ceil(metrics.averageShortSec))}</strong>
        <small>диапазон: 6-30 секунд</small>
      </div>
      <div className="kpi-card">
        <span>Уверенность нарушений <InfoTip text="Средний процент сходства по видео, где найдено проблемное действие." /></span>
        <strong>{formatPercent(metrics.averageConfidence * 100)}</strong>
        <small>по найденным сценариям</small>
      </div>
    </div>
  );
}

function AnalysisCharts({ metrics }: { metrics: Metrics }) {
  const total = Math.max(metrics.checkedFiles, 1);
  const maxH = 92;
  return (
    <div className="analysis-charts-grid">
      <div className="chart-card">
        <div className="chart-head">
          <h3>Структура проверки <InfoTip text="Распределение найденных видео: OK, справочные короткие фрагменты, короткие сценарии, битые файлы и нарушения." /></h3>
          <span>{metrics.checkedFiles} видео</span>
        </div>
        <div className="stacked-chart" aria-label="Структура проверки">
          <span className="stack-ok" style={{ width: `${(metrics.okCount / total) * 100}%` }} />
          <span className="stack-short" style={{ width: `${(metrics.shortCount / total) * 100}%` }} />
          <span className="stack-band" style={{ width: `${(metrics.durationBandCount / total) * 100}%` }} />
          <span className="stack-broken" style={{ width: `${(metrics.brokenCount / total) * 100}%` }} />
          <span className="stack-issue" style={{ width: `${(metrics.behaviorCount / total) * 100}%` }} />
        </div>
        <div className="chart-legend">
          <span><i className="legend-ok" />OK: {metrics.okCount}</span>
          <span><i className="legend-short" />0-4 сек: {metrics.shortCount}</span>
          <span><i className="legend-band" />Сцен. 6-30: {metrics.durationBandCount}</span>
          <span><i className="legend-broken" />Битые: {metrics.brokenCount}</span>
          <span><i className="legend-issue" />Нарушения: {metrics.behaviorCount}</span>
        </div>
      </div>

      <div className="chart-card duration-dashboard-card">
        <div className="chart-head">
          <h3>Короткие сценарии 6-30 <InfoTip text="Вертикальные столбцы показывают распределение коротких сценариев по округлённым секундам." /></h3>
          <span>{metrics.durationBandCount} видео</span>
        </div>
        {metrics.durationBars.length ? (
          <div className="duration-histogram">
            {metrics.durationBars.map((bar) => (
              <div className="duration-column" key={bar.label}>
                <span style={{ height: `${Math.max(12, (bar.percent / 100) * maxH)}px` }} />
                <small>{bar.label.replace(" сек", "")}</small>
              </div>
            ))}
          </div>
        ) : <div className="ai-empty-line">Сценарии 6-30 секунд не найдены.</div>}
        <div className="dashboard-mini-row">
          <span><strong>{metrics.brokenCount}</strong> битых</span>
          <span><strong>{metrics.behaviorCount}</strong> нарушений</span>
        </div>
      </div>

      <BarChartCard title="Сценарии с замечаниями" bars={metrics.scenarioBars} empty="Сценарии без замечаний." />
      <BarChartCard title="Типы замечаний" bars={metrics.issueBars} empty="Замечаний не найдено." />
    </div>
  );
}

function AiFindingList({
  title, items, empty, allowDelete = false, onDeleted, onOpenFolder,
}: {
  title: string;
  items: AiVideoFinding[];
  empty: string;
  allowDelete?: boolean;
  onDeleted?: (path: string) => void;
  onOpenFolder?: (folderPath: string, videoPath: string) => void;
}) {
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  return (
    <div className="ai-finding-section">
      <h3>{title} <InfoTip text="Список видео: название файла, AI-сценарий, причина попадания в блок, путь и быстрые действия." /></h3>
      {items.length === 0
        ? <div className="ai-empty-line">{empty}</div>
        : (
          <div className="ai-finding-list">
            {items.slice(0, 120).map((item) => (
              <div className="ai-finding-row" key={item.path} title={item.path}>
                <div className="ai-finding-main">
                  <span className="scenario-pill">{item.scenarioTitle}</span>
                  <strong>{item.fileName}</strong>
                  <span className="ai-issue">{item.issue}</span>
                  <span>{item.path}</span>
                </div>
                <div className="ai-finding-meta">
                  <span>{formatDuration(item.roundedDurationSec)}</span>
                  <small>AI сценарий: {item.scenarioTitle}</small>
                  <small>{item.detectedAction}</small>
                  <small>Сценарий: {item.scenario}</small>
                  <small>Ожидание: {item.expectedAction}</small>
                  <small>Сходство: {Math.round(item.confidence * 100)}%</small>
                  <small>Размер: {formatBytes(item.fileSizeBytes)}</small>
                  <small>Формат: {item.extension || "не определён"}</small>
                  <small>Папка: {item.parentFolder}</small>
                  <small>Bucket: {item.durationBucketSec} сек</small>
                  <small>Тип: {item.problemKind}</small>
                  <small>Изменён: {formatUnixDate(item.modifiedUnix)}</small>
                  <button
                    className="badge badge-open-folder ai-open-video"
                    type="button"
                    onClick={() => openPathInExplorer(item.path)}
                  >
                    <ExternalLink className="badge-icon" />Открыть видео
                  </button>
                  <button
                    className="badge badge-open-folder ai-open-video"
                    type="button"
                    disabled={!item.parentFolder}
                    onClick={() => onOpenFolder?.(item.parentFolder, item.path)}
                  >
                    <FolderOpen className="badge-icon" />Открыть папку
                  </button>
                  {allowDelete && (
                    <button
                      className="badge badge-delete-video ai-open-video"
                      type="button"
                      disabled={deletingPath === item.path}
                      onClick={() => deleteVideo(item.path, setDeletingPath, onDeleted)}
                    >
                      <Trash2 className="badge-icon" />
                      {deletingPath === item.path ? "Удаление..." : "Удалить"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

export function AiAnalysisPanel({
  analysis, loading, error, hasScan, deletedPaths, onDeleted, onOpenFolder,
}: {
  analysis: AiAnalysisResult | null;
  loading: boolean;
  error: string | null;
  hasScan: boolean;
  deletedPaths: Set<string>;
  onDeleted: (path: string) => void;
  onOpenFolder?: (folderPath: string, videoPath: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AiSort>("duration");
  const [showShort, setShowShort] = useState(true);
  const [showBand, setShowBand] = useState(true);
  const [showBroken, setShowBroken] = useState(true);
  const [showIssues, setShowIssues] = useState(true);

  if (!hasScan) return <div className="ai-analysis-panel empty-state">Запустите скан, чтобы получить AI Анализ.</div>;
  if (loading) return <div className="ai-analysis-panel empty-state">AI Анализ выполняется...</div>;
  if (error) return <div className="ai-analysis-panel empty-state">{error}</div>;
  if (!analysis) return <div className="ai-analysis-panel empty-state">AI Анализ пока не готов.</div>;

  const shortVideos = sortFindings(filterFindings(analysis.shortVideos, query, deletedPaths), sort);
  const bandVideos = sortFindings(filterFindings(analysis.durationBandVideos, query, deletedPaths), sort);
  const brokenVideos = sortFindings(filterFindings(analysis.brokenVideos, query, deletedPaths), sort);
  const behaviorVideos = sortFindings(filterFindings(analysis.passiveBehaviorVideos, query, deletedPaths), sort);
  const metrics = buildAnalysisMetrics(analysis, deletedPaths);

  return (
    <div className="ai-analysis-panel">
      <div className="ai-summary-grid">
        <div className="ai-summary-card"><span>Проверено видео <InfoTip text="Сколько видео удалось разобрать." /></span><strong>{analysis.checkedFiles} / {analysis.totalVideoFiles}</strong></div>
        <div className="ai-summary-card"><span>0-4 сек <InfoTip text="Короткие фрагменты, справочная категория." /></span><strong>{shortVideos.length}</strong></div>
        <div className="ai-summary-card"><span>6-30 сек <InfoTip text="Короткие сценарии." /></span><strong>{bandVideos.length}</strong></div>
        <div className="ai-summary-card"><span>Битые <InfoTip text="Повреждённые видео." /></span><strong>{brokenVideos.length}</strong></div>
        <div className="ai-summary-card"><span>Нарушения 7+ сек <InfoTip text="Телефон, курение, еда, бездействие." /></span><strong>{analysis.passiveBehaviorVideos.length}</strong></div>
      </div>
      <AnalysisKpis metrics={metrics} />
      <AnalysisCharts metrics={metrics} />
      <div className="management-bar ai-management-bar">
        <InfoTip text="Фильтруйте AI-результаты по названию, папке, сценарию или действию." />
        <label className="management-search">
          <Search className="icon" />
          <input value={query} placeholder="Фильтр по имени, пути, сценарию" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as AiSort)}>
          <option value="duration">Сначала длинные</option>
          <option value="confidence">Сначала уверенные</option>
          <option value="name">По имени</option>
        </select>
        <button className={`panel-tab${showShort ? " panel-tab-active" : ""}`} type="button" onClick={() => setShowShort((v) => !v)}>Короткие</button>
        <button className={`panel-tab${showBand ? " panel-tab-active" : ""}`} type="button" onClick={() => setShowBand((v) => !v)}>Сценарии 6-30</button>
        <button className={`panel-tab${showBroken ? " panel-tab-active" : ""}`} type="button" onClick={() => setShowBroken((v) => !v)}>Битые</button>
        <button className={`panel-tab${showIssues ? " panel-tab-active" : ""}`} type="button" onClick={() => setShowIssues((v) => !v)}>Нарушения</button>
      </div>
      {showShort && <AiFindingList title="Инфо: видео 0-4 секунды" items={shortVideos} empty="Видео 0-4 секунды не найдено." allowDelete onDeleted={onDeleted} onOpenFolder={onOpenFolder} />}
      {showBand && <AiFindingList title="Короткие сценарии 6-30 секунд" items={bandVideos} empty="Видео в диапазоне 6-30 секунд не найдено." onDeleted={onDeleted} onOpenFolder={onOpenFolder} />}
      {showBroken && <AiFindingList title="Битые или повреждённые видео" items={brokenVideos} empty="Битые видео не найдены." onDeleted={onDeleted} onOpenFolder={onOpenFolder} />}
      {showIssues && <AiFindingList title="Что не так на видео" items={behaviorVideos} empty="Нарушений длиннее 7 секунд не найдено." onDeleted={onDeleted} onOpenFolder={onOpenFolder} />}
    </div>
  );
}
