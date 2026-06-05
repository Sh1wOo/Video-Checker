import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { CheckCircle2, ExternalLink, FolderOpen, Info, Loader2, RotateCcw, Search, Trash2, TriangleAlert } from "lucide-react";
import type { AiAnalysisResult, AiVideoFinding, FolderNode, ScanResult } from "../types/scan";
import { formatBytes, formatDuration, formatHoursDecimal } from "../lib/format";
import { FolderTree } from "./folder-tree/FolderTree";
import { VirtualFolderTree } from "./folder-tree/VirtualFolderTree";
import { FolderTree as FolderTreeIcon, BrainCircuit, ShieldCheck, Lightbulb, FileVideo} from "lucide-react";
import { open } from '@tauri-apps/plugin-dialog';


type Props = {
  result: ScanResult | null;
  aiAnalysis: AiAnalysisResult | null;
  aiLoading: boolean;
  aiError: string | null;
  treeBuiltFolders?: number;
  settings: PanelSettings;
};

type ActiveTab = "tree" | "ai" | "control" | "intelligence";
type AiSort = "duration" | "confidence" | "name";
type TreeSort = "path" | "name" | "files" | "duration";

export type PanelSettings = {
  showAi: boolean;
  showControl: boolean;
  showIntelligence: boolean;
  showRecovery: boolean;
};

type AnalysisMetrics = {
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

type FolderScenario = {
  path: string;
  name: string;
  owner: string;
  scenarioTitle: string;
  totalVideoFiles: number;
  totalDurationSec: number;
};

type ScenarioNote = {
  code: string;
  description: string;
};

const GSAP_TREE_LIMIT = 1800;

export function TreePanel({ result, aiAnalysis, aiLoading, aiError, treeBuiltFolders = 0, settings }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("tree");
  const [treeQuery, setTreeQuery] = useState("");
  const [treeSort, setTreeSort] = useState<TreeSort>("path");
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(() => new Set());
  const [selectedVideoPath, setSelectedVideoPath] = useState<string | null>(null);
  const [highlightedFolderPath, setHighlightedFolderPath] = useState<string | null>(null);
  const [infoModalText, setInfoModalText] = useState<string | null>(null);
  const [scenarioNotes, setScenarioNotes] = useState<ScenarioNote[]>([]);
  const useVirtualTree = treeBuiltFolders > GSAP_TREE_LIMIT;
  const sortedTree = useMemo(() => {
    if (!result) return null;
    return sortFolderTree(result.tree, treeSort);
  }, [result, treeSort]);
  const treeMatches = useMemo(() => {
    if (!sortedTree || !treeQuery.trim()) return [];
    const query = treeQuery.trim().toLowerCase();
    return flattenTree(sortedTree).filter((node) => {
      return node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
    }).slice(0, 12);
  }, [sortedTree, treeQuery]);

  useEffect(() => {
    if (activeTab === "ai" && !settings.showAi) setActiveTab("tree");
    if (activeTab === "control" && !settings.showControl) setActiveTab("tree");
    if (activeTab === "intelligence" && !settings.showIntelligence) setActiveTab("tree");
  }, [activeTab, settings]);

  useEffect(() => {
    function handleInfo(event: Event) {
      const customEvent = event as CustomEvent<string>;
      setInfoModalText(customEvent.detail);
    }

    window.addEventListener("video-checker:info", handleInfo);
    return () => window.removeEventListener("video-checker:info", handleInfo);
  }, []);

  return (
    <section className="panel tree-panel">
      <div className="panel-header with-border tree-panel-header">

          <h2 className="panel-title">
            Дерево папок
            <InfoTip text="Здесь собраны результаты скана: структура папок, AI-анализ, контроль качества и сценарии по папкам." />
          </h2>
<div className="panel-tabs">
  <button
    className={`panel-tab${activeTab === "tree" ? " panel-tab-active" : ""}`}
    onClick={() => setActiveTab("tree")}
  >
    <FolderTreeIcon className="icon" />
    Дерево
  </button>
  {settings.showAi ? (
    <button
      className={`panel-tab${activeTab === "ai" ? " panel-tab-active" : ""}`}
      onClick={() => setActiveTab("ai")}
    >
      <BrainCircuit className="icon" />
      AI Анализ
    </button>
  ) : null}
  {settings.showControl ? (
    <button
      className={`panel-tab${activeTab === "control" ? " panel-tab-active" : ""}`}
      onClick={() => setActiveTab("control")}
    >
      <ShieldCheck className="icon" />
      Контроль
    </button>
  ) : null}
  {settings.showIntelligence ? (
    <button
      className={`panel-tab${activeTab === "intelligence" ? " panel-tab-active" : ""}`}
      onClick={() => setActiveTab("intelligence")}
    >
      <Lightbulb className="icon" />
      Intelligence
    </button>
  ) : null}
</div>

      </div>

      {activeTab === "tree" ? (
        <div className="tree-scroll tree-scroll-virtualized">
          {!result ? (
            <div className="empty-state">Выберите папку и запустите подсчёт.</div>
          ) : (
            <>
              <TreeManagement
                query={treeQuery}
                onQueryChange={setTreeQuery}
                sort={treeSort}
                onSortChange={setTreeSort}
                matches={treeMatches}
                root={sortedTree ?? result.tree}
              />
              {selectedVideoPath ? (
                <div className="selected-video-banner">
                  <strong>Выбрано видео:</strong> {selectedVideoPath}
                  {highlightedFolderPath ? <small>Папка: {highlightedFolderPath}</small> : null}
                </div>
              ) : null}
              {useVirtualTree ? (
                <VirtualFolderTree node={result.tree} height={620} rowHeight={66} maxRows={8000} highlightPath={highlightedFolderPath} />
              ) : (
                <FolderTree node={result.tree} highlightPath={highlightedFolderPath} />
              )}
            </>
          )}
        </div>
      ) : activeTab === "control" ? (
        <ControlPanel
          analysis={aiAnalysis}
          result={result}
          deletedPaths={deletedPaths}
          scenarioNotes={scenarioNotes}
          onScenarioNotesChange={setScenarioNotes}
        />
      ) : activeTab === "intelligence" ? (
        <IntelligencePanel analysis={aiAnalysis} result={result} deletedPaths={deletedPaths} scenarioNotes={scenarioNotes} />
      ) : (
        <AiAnalysisPanel
          analysis={aiAnalysis}
          loading={aiLoading}
          error={aiError}
          hasScan={Boolean(result)}
          deletedPaths={deletedPaths}
          onDeleted={(path) => setDeletedPaths((paths) => new Set(paths).add(path))}
          onOpenFolder={(folderPath, videoPath) => {
            setHighlightedFolderPath(folderPath);
            setSelectedVideoPath(videoPath);
            openPathInExplorer(folderPath);
          }}
        />
      )}
      {infoModalText ? <InfoModal text={infoModalText} onClose={() => setInfoModalText(null)} /> : null}
    </section>
  );
}

function TreeManagement({
  query,
  onQueryChange,
  sort,
  onSortChange,
  matches,
  root,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: TreeSort;
  onSortChange: (value: TreeSort) => void;
  matches: FolderNode[];
  root: FolderNode;
}) {
  return (
    <div className="management-bar tree-management-bar">
      <InfoTip text="Управление деревом: поиск папки, сортировка и открытие корневого каталога." />
      <label className="management-search">
        <Search className="icon" />
        <input value={query} placeholder="Найти папку в дереве" onChange={(event) => onQueryChange(event.target.value)} />
      </label>
      <select value={sort} onChange={(event) => onSortChange(event.target.value as TreeSort)}>
        <option value="path">Сортировка: путь</option>
        <option value="name">Сортировка: имя</option>
        <option value="files">Сортировка: файлы</option>
        <option value="duration">Сортировка: длительность</option>
      </select>
      <button className="badge badge-open-folder" type="button" onClick={() => openPathInExplorer(root.path)}>
        <ExternalLink className="badge-icon" />
        Открыть корень
      </button>
      {query.trim() ? (
        <div className="tree-search-results">
          {matches.length ? matches.map((node) => (
            <button className="tree-search-hit" type="button" key={node.path} onClick={() => openPathInExplorer(node.path)} title={node.path}>
              <span>{node.name}</span>
              <small>{node.totalVideoFiles} видео</small>
            </button>
          )) : <span className="tree-search-empty">Совпадений нет</span>}
        </div>
      ) : null}
    </div>
  );
}

function AiAnalysisPanel({
  analysis,
  loading,
  error,
  hasScan,
  deletedPaths,
  onDeleted,
  onOpenFolder,
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
  const [showDurationBand, setShowDurationBand] = useState(true);
  const [showBroken, setShowBroken] = useState(true);
  const [showIssues, setShowIssues] = useState(true);

  if (!hasScan) {
    return <div className="ai-analysis-panel empty-state">Запустите скан, чтобы получить AI Анализ.</div>;
  }

  if (loading) {
    return <div className="ai-analysis-panel empty-state">AI Анализ выполняется...</div>;
  }

  if (error) {
    return <div className="ai-analysis-panel empty-state">{error}</div>;
  }

  if (!analysis) {
    return <div className="ai-analysis-panel empty-state">AI Анализ пока не готов.</div>;
  }

  const shortVideos = sortFindings(filterFindings(analysis.shortVideos, query, deletedPaths), sort);
  const durationBandVideos = sortFindings(filterFindings(analysis.durationBandVideos, query, deletedPaths), sort);
  const brokenVideos = sortFindings(filterFindings(analysis.brokenVideos, query, deletedPaths), sort);
  const behaviorVideos = sortFindings(filterFindings(analysis.passiveBehaviorVideos, query, deletedPaths), sort);
  const metrics = buildAnalysisMetrics(analysis, deletedPaths);

  const handleOpenFolder = (folderPath: string, videoPath: string) => {
    onOpenFolder?.(folderPath, videoPath);
  };

  return (
    <div className="ai-analysis-panel">
      <div className="ai-summary-grid">
        <div className="ai-summary-card">
          <span>Проверено видео <InfoTip text="Сколько видео удалось разобрать и сколько всего видео найдено сканом." /></span>
          <strong>{analysis.checkedFiles} / {analysis.totalVideoFiles}</strong>
        </div>
        <div className="ai-summary-card">
          <span>0-4 секунды <InfoTip text="Справочная категория: короткие фрагменты сами по себе не считаются проблемой." /></span>
          <strong>{shortVideos.length}</strong>
        </div>
        <div className="ai-summary-card">
          <span>6-30 секунд <InfoTip text="Короткие сценарии: нормальные рабочие видео, которые группируются по секундам и сценариям." /></span>
          <strong>{durationBandVideos.length}</strong>
        </div>
        <div className="ai-summary-card">
          <span>Битые видео <InfoTip text="Видео, которые не удалось прочитать, открыть как медиа или у которых повреждены метаданные." /></span>
          <strong>{brokenVideos.length}</strong>
        </div>
        <div className="ai-summary-card">
          <span>Нарушения сценария 7+ секунд <InfoTip text="Видео, где найдено действие вроде телефона, курения, еды, общения или бездействия дольше 7 секунд." /></span>
          <strong>{analysis.passiveBehaviorVideos.length}</strong>
        </div>
      </div>

      <AnalysisKpis metrics={metrics} />
      <AnalysisCharts metrics={metrics} />

      <div className="management-bar ai-management-bar">
        <InfoTip text="Фильтруйте AI-результаты по названию, папке, сценарию или действию; меняйте сортировку и видимость блоков." />
        <label className="management-search">
          <Search className="icon" />
          <input value={query} placeholder="Фильтр по имени, пути, сценарию" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value as AiSort)}>
          <option value="duration">Сначала длинные</option>
          <option value="confidence">Сначала уверенные</option>
          <option value="name">По имени</option>
        </select>
        <button className={`panel-tab ${showShort ? "panel-tab-active" : ""}`} type="button" onClick={() => setShowShort((value) => !value)}>
          Короткие
        </button>
        <button className={`panel-tab ${showDurationBand ? "panel-tab-active" : ""}`} type="button" onClick={() => setShowDurationBand((value) => !value)}>
          Сценарии 6-30
        </button>
        <button className={`panel-tab ${showBroken ? "panel-tab-active" : ""}`} type="button" onClick={() => setShowBroken((value) => !value)}>
          Битые
        </button>
        <button className={`panel-tab ${showIssues ? "panel-tab-active" : ""}`} type="button" onClick={() => setShowIssues((value) => !value)}>
          Нарушения
        </button>
      </div>

      {showShort ? (
        <AiFindingList
          title="Инфо: видео 0-4 секунды"
          items={shortVideos}
          empty="Видео 0-4 секунды не найдено."
          allowDelete
          onDeleted={onDeleted}
          onOpenFolder={handleOpenFolder}
        />
      ) : null}
      {showDurationBand ? (
        <AiFindingList
          title="Короткие сценарии 6-30 секунд"
          items={durationBandVideos}
          empty="Видео в диапазоне 6-30 секунд не найдено."
          onDeleted={onDeleted}
          onOpenFolder={handleOpenFolder}
        />
      ) : null}
      {showBroken ? (
        <AiFindingList
          title="Битые или повреждённые видео"
          items={brokenVideos}
          empty="Битые видео не найдены."
          onDeleted={onDeleted}
          onOpenFolder={handleOpenFolder}
        />
      ) : null}
      {showIssues ? (
        <AiFindingList
          title="Что не так на видео"
          items={behaviorVideos}
          empty="Нарушений длиннее 7 секунд не найдено."
          onDeleted={onDeleted}
          onOpenFolder={handleOpenFolder}
        />
      ) : null}
    </div>
  );
}

function AnalysisKpis({ metrics }: { metrics: AnalysisMetrics }) {
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

function AnalysisCharts({ metrics }: { metrics: AnalysisMetrics }) {
  const total = Math.max(metrics.checkedFiles, 1);
  const okPercent = (metrics.okCount / total) * 100;
  const shortPercent = (metrics.shortCount / total) * 100;
  const durationBandPercent = (metrics.durationBandCount / total) * 100;
  const brokenPercent = (metrics.brokenCount / total) * 100;
  const behaviorPercent = (metrics.behaviorCount / total) * 100;

  return (
    <div className="analysis-charts-grid">
      <div className="chart-card">
        <div className="chart-head">
          <h3>Структура проверки <InfoTip text="Распределение найденных видео: OK, справочные короткие фрагменты, короткие сценарии, битые файлы и нарушения." /></h3>
          <span>{metrics.checkedFiles} видео</span>
        </div>
        <div className="stacked-chart" aria-label="Структура проверки">
          <span className="stack-ok" style={{ width: `${okPercent}%` }} />
          <span className="stack-short" style={{ width: `${shortPercent}%` }} />
          <span className="stack-band" style={{ width: `${durationBandPercent}%` }} />
          <span className="stack-broken" style={{ width: `${brokenPercent}%` }} />
          <span className="stack-issue" style={{ width: `${behaviorPercent}%` }} />
        </div>
        <div className="chart-legend">
          <span><i className="legend-ok" />OK: {metrics.okCount}</span>
          <span><i className="legend-short" />0-4 сек инфо: {metrics.shortCount}</span>
          <span><i className="legend-band" />Сценарии 6-30: {metrics.durationBandCount}</span>
          <span><i className="legend-broken" />Битые: {metrics.brokenCount}</span>
          <span><i className="legend-issue" />Нарушения: {metrics.behaviorCount}</span>
        </div>
      </div>

      <DurationDashboardCard metrics={metrics} />
      <BarChartCard title="Сценарии с замечаниями" bars={metrics.scenarioBars} empty="Сценарии без замечаний." />
      <BarChartCard title="Типы замечаний" bars={metrics.issueBars} empty="Замечаний не найдено." />
    </div>
  );
}

function DurationDashboardCard({ metrics }: { metrics: AnalysisMetrics }) {
  const maxHeight = 92;

  return (
    <div className="chart-card duration-dashboard-card">
      <div className="chart-head">
        <h3>Короткие сценарии 6-30 <InfoTip text="Вертикальные столбцы показывают распределение коротких сценариев по округлённым секундам." /></h3>
        <span>{metrics.durationBandCount} видео</span>
      </div>
      {metrics.durationBars.length ? (
        <div className="duration-histogram" aria-label="Распределение сценариев 6-30 секунд">
          {metrics.durationBars.map((bar) => (
            <div className="duration-column" key={bar.label}>
              <span style={{ height: `${Math.max(12, (bar.percent / 100) * maxHeight)}px` }} />
              <small>{bar.label.replace(" сек", "")}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="ai-empty-line">Сценарии 6-30 секунд не найдены.</div>
      )}
      <div className="dashboard-mini-row">
        <span><strong>{metrics.brokenCount}</strong> битых</span>
        <span><strong>{metrics.behaviorCount}</strong> нарушений</span>
      </div>
    </div>
  );
}

function BarChartCard({
  title,
  bars,
  empty,
}: {
  title: string;
  bars: AnalysisMetrics["scenarioBars"];
  empty: string;
}) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title} <InfoTip text="Горизонтальный график показывает самые частые значения в выбранной группе." /></h3>
      </div>
      {bars.length ? (
        <div className="bar-chart-list">
          {bars.map((bar) => (
            <div className="bar-chart-row" key={bar.label}>
              <div className="bar-labels">
                <span>{bar.label}</span>
                <small>{bar.value}</small>
              </div>
              <div className="bar-track">
                <span style={{ width: `${bar.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ai-empty-line">{empty}</div>
      )}
    </div>
  );
}

function AiFindingList({
  title,
  items,
  empty,
  allowDelete = false,
  onDeleted,
  onOpenFolder,
}: {
  title: string;
  items: AiAnalysisResult["shortVideos"];
  empty: string;
  allowDelete?: boolean;
  onDeleted?: (path: string) => void;
  onOpenFolder?: (folderPath: string, videoPath: string) => void;
}) {
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  return (
    <div className="ai-finding-section">
      <h3>{title} <InfoTip text="Список видео: название файла, AI-сценарий, причина попадания в блок, путь и быстрые действия." /></h3>
      {items.length === 0 ? (
        <div className="ai-empty-line">{empty}</div>
      ) : (
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
                <button className="badge badge-open-folder ai-open-video" type="button" onClick={() => openVideo(item.path)}>
                  <ExternalLink className="badge-icon" />
                  Открыть видео
                </button>
                <button
                  className="badge badge-open-folder ai-open-video"
                  type="button"
                  disabled={!item.parentFolder}
                  onClick={() => onOpenFolder?.(item.parentFolder, item.path)}
                >
                  <FolderOpen className="badge-icon" />
                  Открыть папку
                </button>
                {allowDelete ? (
                  <button
                    className="badge badge-delete-video ai-open-video"
                    type="button"
                    disabled={deletingPath === item.path}
                    onClick={() => deleteVideo(item.path, setDeletingPath, onDeleted)}
                  >
                    <Trash2 className="badge-icon" />
                    {deletingPath === item.path ? "Удаление..." : "Удалить"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlPanel({
  analysis,
  result,
  deletedPaths,
  scenarioNotes,
  onScenarioNotesChange,
}: {
  analysis: AiAnalysisResult | null;
  result: ScanResult | null;
  deletedPaths: Set<string>;
  scenarioNotes: ScenarioNote[];
  onScenarioNotesChange: (notes: ScenarioNote[]) => void;
}) {
  const totalIssues = (analysis?.brokenVideos.length ?? 0) + (analysis?.passiveBehaviorVideos.length ?? 0);
  const allFolders = result ? flattenTree(result.tree).filter((node) => node.totalVideoFiles > 0) : [];
  const folders = allFolders.slice(0, 8);
  const folderScenarios = allFolders.map(toFolderScenario);
  const qualityKpi = analysis ? 100 - buildAnalysisMetrics(analysis, deletedPaths).issueRate : 0;

  return (
    <div className="ai-analysis-panel control-panel">
      {!result ? (
        <div className="empty-state">Запустите скан, чтобы увидеть контроль качества.</div>
      ) : (
        <>
          <EnterpriseOverview
            checkedFiles={analysis?.checkedFiles ?? 0}
            totalVideoFiles={result.summary.totalVideoFiles}
            totalIssues={totalIssues}
            deletedCount={deletedPaths.size}
            qualityKpi={qualityKpi}
          />

          <div className="ai-summary-grid">
            <div className="ai-summary-card">
              <span>Очередь проверки <InfoTip text="Сколько найденных видео сейчас требует просмотра или решения." /></span>
              <strong>{totalIssues}</strong>
            </div>
            <div className="ai-summary-card">
              <span>Удалено вручную <InfoTip text="Сколько файлов удалено из результатов текущей проверки вручную." /></span>
              <strong>{deletedPaths.size}</strong>
            </div>
            <div className="ai-summary-card">
              <span>Активных папок <InfoTip text="Папки, в которых есть видео и по которым можно определить сценарий." /></span>
              <strong>{folders.length}</strong>
            </div>
          </div>
          <div className="ai-finding-section">
            <h3>Папки с самым большим объёмом видео <InfoTip text="Быстрый доступ к папкам, где сосредоточена основная длительность и количество видео." /></h3>
            <div className="control-folder-list">
              {folders.map((folder) => (
                <button className="control-folder-row" type="button" key={folder.path} onClick={() => openVideo(folder.path)} title={folder.path}>
                  <span>{folder.name}</span>
                  <small>{folder.totalVideoFiles} видео · {formatHoursDecimal(Math.ceil(folder.totalDurationSec))}</small>
                </button>
              ))}
            </div>
          </div>
          <FolderScenarioInventory scenarios={folderScenarios} />
          <ScenarioKnowledgeBase notes={scenarioNotes} onChange={onScenarioNotesChange} />
        </>
      )}
    </div>
  );
}

function IntelligencePanel({
  analysis,
  result,
  deletedPaths,
  scenarioNotes,
}: {
  analysis: AiAnalysisResult | null;
  result: ScanResult | null;
  deletedPaths: Set<string>;
  scenarioNotes: ScenarioNote[];
}) {
  if (!result || !analysis) {
    return <div className="ai-analysis-panel empty-state">Запустите скан, чтобы открыть Intelligence Center.</div>;
  }

  const metrics = buildAnalysisMetrics(analysis, deletedPaths);
  const allFindings = [
    ...analysis.durationBandVideos,
    ...analysis.brokenVideos,
    ...analysis.passiveBehaviorVideos,
  ].filter((item) => !deletedPaths.has(item.path));
  const priorityItems = sortFindings(allFindings, "duration")
    .sort((left, right) => Number(right.isProblem) - Number(left.isProblem))
    .slice(0, 6);
  const scenarioCoverage = topBars(allFindings.map((item) => item.scenarioTitle), 8);

  return (
    <div className="ai-analysis-panel intelligence-panel">
      <div className="intelligence-hero">
        <div>
          <span>Executive Intelligence</span>
          <h3>AI Command Brief</h3>
          <p>Сводка для быстрого решения: что проверить первым, какие сценарии чаще встречаются и где уже есть ручные описания.</p>
        </div>
        <strong>{formatPercent(100 - metrics.issueRate)}</strong>
      </div>
      <div className="enterprise-grid">
        <div className="enterprise-card">
          <span>Приоритетов <InfoTip text="Самые длинные или важные элементы из всех AI-блоков." /></span>
          <strong>{priorityItems.length}</strong>
          <small>готово к просмотру</small>
        </div>
        <div className="enterprise-card">
          <span>Сценариев <InfoTip text="Количество разных коротких сценариев, найденных AI в результатах." /></span>
          <strong>{scenarioCoverage.length}</strong>
          <small>в активной выборке</small>
        </div>
        <div className="enterprise-card">
          <span>Заметок <InfoTip text="Ручные описания сценариев вроде scn-016, которые помогают понимать материал." /></span>
          <strong>{scenarioNotes.length}</strong>
          <small>добавлено вручную</small>
        </div>
        <div className="enterprise-card enterprise-card-accent">
          <span>Decision Grade <InfoTip text="Оценка готовности результатов к управленческому просмотру." /></span>
          <strong>{metrics.issueRate <= 10 ? "A" : metrics.issueRate <= 25 ? "B" : "C"}</strong>
          <small>качество выборки</small>
        </div>
      </div>
      <div className="analysis-charts-grid">
        <BarChartCard title="Сценарный радар" bars={scenarioCoverage} empty="Нет сценариев для радара." />
        <div className="chart-card">
          <div className="chart-head">
            <h3>Приоритет просмотра <InfoTip text="Видео, которые лучше открыть первыми: самые длинные в проблемной/контрольной выборке." /></h3>
          </div>
          <div className="priority-list">
            {priorityItems.map((item) => (
              <button className="priority-row" type="button" key={item.path} onClick={() => openVideo(item.path)} title={item.path}>
                <span>{item.scenarioTitle}</span>
                <strong>{item.fileName}</strong>
                <small>{formatDuration(item.roundedDurationSec)} · {formatBytes(item.fileSizeBytes)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-head">
            <h3>Ручные описания <InfoTip text="Сценарные коды и пояснения, которые вы добавили вручную." /></h3>
          </div>
          {scenarioNotes.length ? (
            <div className="scenario-note-list">
              {scenarioNotes.map((note) => (
                <div className="scenario-note-chip" key={note.code}>
                  <strong>{note.code}</strong>
                  <span>{note.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ai-empty-line">Заметок пока нет. Добавьте их во вкладке Контроль.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EnterpriseOverview({
  checkedFiles,
  totalVideoFiles,
  totalIssues,
  deletedCount,
  qualityKpi,
}: {
  checkedFiles: number;
  totalVideoFiles: number;
  totalIssues: number;
  deletedCount: number;
  qualityKpi: number;
}) {
  const coverage = totalVideoFiles ? (checkedFiles / totalVideoFiles) * 100 : 0;
  const riskLevel = totalIssues === 0 ? "Низкий" : qualityKpi >= 90 ? "Средний" : "Высокий";

  return (
    <div className="enterprise-grid">
      <div className="enterprise-card enterprise-card-accent">
        <span>Enterprise Control Tower <InfoTip text="Сводка для руководителя: покрытие, риск, аудит и состояние проверки." /></span>
        <strong>{riskLevel} риск</strong>
        <small>AI Quality Gate · локальная обработка</small>
      </div>
      <div className="enterprise-card">
        <span>Покрытие анализа <InfoTip text="Доля видео, по которым AI смог получить длительность и включить их в контроль." /></span>
        <strong>{formatPercent(coverage)}</strong>
        <small>{checkedFiles} из {totalVideoFiles}</small>
      </div>
      <div className="enterprise-card">
        <span>Audit Trail <InfoTip text="Счётчик действий, которые можно использовать как основу журнала контроля качества." /></span>
        <strong>{deletedCount}</strong>
        <small>удалений в текущей сессии</small>
      </div>
      <div className="enterprise-card">
        <span>SLA проверки <InfoTip text="Операционный статус: есть ли очередь видео, которые нужно проверить вручную." /></span>
        <strong>{totalIssues ? "В работе" : "OK"}</strong>
        <small>{totalIssues} задач в очереди</small>
      </div>
    </div>
  );
}

function FolderScenarioInventory({ scenarios }: { scenarios: FolderScenario[] }) {
  return (
    <div className="ai-finding-section">
      <h3>Сценарии по всем папкам <InfoTip text="Для каждой папки показано короткое название сценария, предполагаемый автор/участник и объём снятого материала." /></h3>
      <div className="folder-scenario-table">
        {scenarios.slice(0, 80).map((scenario) => (
          <button className="folder-scenario-row" type="button" key={scenario.path} onClick={() => openVideo(scenario.path)} title={scenario.path}>
            <span className="scenario-pill">{scenario.scenarioTitle}</span>
            <strong>{scenario.owner}</strong>
            <span>{scenario.name}</span>
            <small>{scenario.totalVideoFiles} видео · {formatHoursDecimal(Math.ceil(scenario.totalDurationSec))}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScenarioKnowledgeBase({ notes, onChange }: { notes: ScenarioNote[]; onChange: (notes: ScenarioNote[]) => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  function handleSave() {
    const normalizedCode = code.trim();
    const normalizedDescription = description.trim();
    if (!normalizedCode || !normalizedDescription) return;
    const next = notes.filter((note) => note.code.toLowerCase() !== normalizedCode.toLowerCase());
    onChange([...next, { code: normalizedCode, description: normalizedDescription }]);
    setCode("");
    setDescription("");
  }

  return (
    <div className="scenario-knowledge-card">
      <div className="chart-head">
        <h3>Описание сценариев <InfoTip text="Добавьте код вроде scn-016 и человеческое описание, чтобы при просмотре было понятно, что снимали." /></h3>
      </div>
      <div className="scenario-note-form">
        <input value={code} placeholder="scn-016" onChange={(event) => setCode(event.target.value)} />
        <input value={description} placeholder="Что означает сценарий" onChange={(event) => setDescription(event.target.value)} />
        <button className="badge badge-open-folder" type="button" onClick={handleSave}>Сохранить</button>
      </div>
      <div className="scenario-note-list">
        {notes.map((note) => (
          <div className="scenario-note-chip" key={note.code}>
            <strong>{note.code}</strong>
            <span>{note.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span
      className="info-tip"
      role="button"
      tabIndex={0}
      aria-label="Открыть описание блока"
      onClick={(event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("video-checker:info", { detail: text }));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("video-checker:info", { detail: text }));
      }}
    >
      <Info className="info-icon" />
    </span>
  );
}

function InfoModal({ text, onClose }: { text: string; onClose: () => void }) {
  return createPortal(
    <div className="info-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="info-modal" role="dialog" aria-modal="true" aria-label="Описание блока" onClick={(event) => event.stopPropagation()}>
        <div className="chart-head">
          <h3>Что показывает этот блок</h3>
          <button className="badge" type="button" onClick={onClose}>Закрыть</button>
        </div>
        <p>{text}</p>
      </div>
    </div>,
    document.body,
  );
}

async function openPathInExplorer(path: string) {
  try {
    await openPath(path);
  } catch (error) {
    console.error("Не удалось открыть путь:", error);
  }
}

async function openVideo(path: string) {
  return openPathInExplorer(path);
}

export function RecoveryPanel({ analysis }: { analysis: AiAnalysisResult | null }) {
  const brokenVideos = analysis?.brokenVideos ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<Set<string>>(() => new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [recoverAll, setRecoverAll] = useState(false);
  const [recoverAllMsg, setRecoverAllMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const filtered = brokenVideos.filter(v =>
    !filter.trim() ||
    v.fileName.toLowerCase().includes(filter.toLowerCase()) ||
    v.path.toLowerCase().includes(filter.toLowerCase())
  );

  function getRecoveredPath(path: string) {
    const sep = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    const fileName = sep >= 0 ? path.slice(sep + 1) : path;
    const base = path.slice(0, path.length - fileName.length);
    const dot = fileName.lastIndexOf('.');
    return dot > 0
      ? `${base}${fileName.slice(0, dot)}_recovered${fileName.slice(dot)}`
      : `${base}${fileName}_recovered`;
  }

  // Обновлённая функция с поддержкой reference файла
  async function recoverOne(path: string, useReference: boolean = false) {
    let referencePath: string | null = null;
    
    // Если выбрали режим "С образцом", сначала просим пользователя выбрать файл
    if (useReference) {
      const selectedFile = await open({
        title: 'Выберите исправное видео с той же камеры (образец)',
        filters: [{ name: 'Видео', extensions: ['mp4', 'mov', 'avi', 'mkv', '3gp'] }],
        multiple: false,
      });
      
      if (!selectedFile) return; // Пользователь отменил выбор
      referencePath = selectedFile as string;
    }

    setRecovering(prev => new Set(prev).add(path));
    try {
      const outputFolder = path.replace(/[^\\/]+$/, '');
      let msg: any;
      
      if (referencePath) {
        msg = await invoke<string>('recover_broken_video_with_reference', { 
          path, 
          outputFolder, 
          referencePath 
        });
      } else {
        msg = await invoke<string>('recover_broken_video', { 
          path, 
          outputFolder 
        });
      }
      
      setResults(prev => ({ ...prev, [path]: { ok: true, msg: 'Успешно: файл сохранён.' } }));
    } catch (err) {
      setResults(prev => ({ ...prev, [path]: { ok: false, msg: typeof err === 'string' ? err : 'Ошибка восстановления.' } }));
    } finally {
      setRecovering(prev => { const s = new Set(prev); s.delete(path); return s; });
    }
  }

  async function recoverAll_fn() {
    setRecoverAll(true);
    setRecoverAllMsg(null);
    const failed: string[] = [];
    
    for (const v of brokenVideos) {
      try {
        const outputFolder = v.path.replace(/[^\\/]+$/, '');
        // Массово пробуем только авто-восстановление
        await invoke('recover_broken_video', { path: v.path, outputFolder });
        setResults(prev => ({ ...prev, [v.path]: { ok: true, msg: 'Успешно восстановлено.' } }));
      } catch (err) {
        failed.push(v.fileName);
        setResults(prev => ({ ...prev, [v.path]: { ok: false, msg: typeof err === 'string' ? err : 'Ошибка.' } }));
      }
    }
    
    setRecoverAllMsg(
      failed.length === 0
        ? `Все ${brokenVideos.length} файлов восстановлены успешно.`
        : `Восстановлено ${brokenVideos.length - failed.length} из ${brokenVideos.length}. Для оставшихся ${failed.length} попробуйте ручной режим с образцом.`
    );
    setRecoverAll(false);
  }

  const selectedVideo = brokenVideos.find(v => v.path === selected) ?? null;
  const doneCount = Object.values(results).filter(r => r.ok).length;

  return (
    <div className="rp-root">
      {/* Hero Header */}
      <div className="rp-hero">
        <div className="rp-hero-left">
          <span className="rp-eyebrow">AI Восстановление</span>
          <h2 className="rp-title">Восстановление файлов</h2>
          <p className="rp-subtitle">
            Система нашла&nbsp;<strong>{brokenVideos.length}</strong>&nbsp;битых видео.
            {doneCount > 0 && <>&nbsp;Восстановлено: <strong>{doneCount}</strong>.</>}
          </p>
        </div>
        <div className="rp-hero-stats">
          <div className="rp-stat">
            <span className="rp-stat-num rp-stat-broken">{brokenVideos.length}</span>
            <span className="rp-stat-label">Битых</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-num rp-stat-ok">{doneCount}</span>
            <span className="rp-stat-label">Готово</span>
          </div>
        </div>
      </div>

      {brokenVideos.length === 0 ? (
        <div className="rp-empty">
          <span className="rp-empty-icon">🎉</span>
          <strong>Битых файлов не найдено</strong>
          <p>Запустите AI-анализ, чтобы проверить видеотеку на повреждённые файлы.</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="rp-toolbar">
            <div className="management-search">
              <Search className="icon" />
              <input
                value={filter}
                placeholder="Фильтр по имени или пути..."
                onChange={e => setFilter(e.target.value)}
              />
            </div>
            <button
              className="btn rp-recover-all-btn"
              onClick={recoverAll_fn}
              disabled={recoverAll || brokenVideos.length === 0}
            >
              {recoverAll
                ? <><Loader2 size={15} className="spin" /> Авто-восстановление...</>
                : <><RotateCcw size={15} /> Восстановить все ({brokenVideos.length})</>
              }
            </button>
          </div>

          {recoverAllMsg && (
            <div className={`rp-all-result ${recoverAllMsg.includes('оставшихся') ? 'rp-all-error' : 'rp-all-ok'}`}>
              {recoverAllMsg}
            </div>
          )}

          {/* Split layout */}
          <div className="rp-split">
            {/* File list */}
            <div className="rp-file-list">
              {filtered.length === 0 && (
                <div className="rp-no-match">Нет совпадений</div>
              )}
              {filtered.map(video => {
                const res = results[video.path];
                const isRecovering = recovering.has(video.path);
                const isSelected = selected === video.path;
                return (
                  <button
                    key={video.path}
                    className={`rp-file-card${isSelected ? ' rp-file-card-active' : ''}${res?.ok ? ' rp-file-card-done' : ''}${res && !res.ok ? ' rp-file-card-err' : ''}`}
                    onClick={() => setSelected(video.path)}
                  >
                    <div className="rp-file-card-top">
                      <span className="rp-file-icon">
                        {res?.ok ? '✅' : res ? '❌' : isRecovering ? '⏳' : '🔴'}
                      </span>
                      <div className="rp-file-card-info">
                        <strong className="rp-file-name">{video.fileName}</strong>
                        <small className="rp-file-issue">{video.issue || 'Неизвестная ошибка'}</small>
                      </div>
                    </div>
                    <small className="rp-file-path">{video.parentFolder}</small>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="rp-detail">
              {!selectedVideo ? (
                <div className="rp-detail-empty">
                  <span>👈</span>
                  <p>Выберите файл из списка слева для восстановления</p>
                </div>
              ) : (
                <div className="rp-detail-content">
                  <div className="rp-detail-header">
                    <h3 className="rp-detail-filename">{selectedVideo.fileName}</h3>
                    <span className={`rp-detail-status ${results[selected!]?.ok ? 'ok' : 'pending'}`}>
                      {results[selected!]?.ok ? 'Восстановлен' : 'Ожидает'}
                    </span>
                  </div>

                  <div className="rp-meta-grid">
                    <div className="rp-meta-item">
                      <span className="rp-meta-key">Причина</span>
                      <span className="rp-meta-val">{selectedVideo.issue || '—'}</span>
                    </div>
                    <div className="rp-meta-item">
                      <span className="rp-meta-key">Размер</span>
                      <span className="rp-meta-val">{(selectedVideo.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>

                  <div className="rp-path-block">
                    <span className="rp-path-label">Оригинал</span>
                    <code className="rp-path-code">{selectedVideo.path}</code>
                    <span className="rp-path-label">Результат будет сохранён как:</span>
                    <code className="rp-path-code rp-path-out">{getRecoveredPath(selectedVideo.path)}</code>
                  </div>

                  {results[selected!] && (
                    <div className={`rp-result-box ${results[selected!].ok ? 'ok' : 'err'}`}>
                      {results[selected!].ok ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} className="shrink-0" />}
                      <span>{results[selected!].msg}</span>
                    </div>
                  )}

                  <div className="rp-detail-actions">
                    <button
                      className="btn rp-open-btn"
                      onClick={() => openPathInExplorer(selectedVideo.parentFolder)}
                      title="Открыть папку"
                    >
                      <FolderOpen size={16} />
                    </button>
                    
                    <div className="rp-recover-group">
                      <button
                        className="btn rp-recover-btn"
                        onClick={() => recoverOne(selectedVideo.path, false)}
                        disabled={recovering.has(selectedVideo.path) || results[selectedVideo.path]?.ok}
                      >
                        {recovering.has(selectedVideo.path)
                          ? <><Loader2 size={15} className="spin" /> Ремонт...</>
                          : results[selectedVideo.path]?.ok
                            ? <><CheckCircle2 size={15} /> Готово</>
                            : <><RotateCcw size={15} /> Авто</>
                        }
                      </button>
                      <button
                        className="btn rp-recover-ref-btn"
                        onClick={() => recoverOne(selectedVideo.path, true)}
                        disabled={recovering.has(selectedVideo.path) || results[selectedVideo.path]?.ok}
                        title="Выбрать здоровое видео с этой же камеры для починки контейнера"
                      >
                        <FileVideo size={15} /> С образцом
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Заглушка, если вдруг у тебя нет openPathInExplorer в этом файле
// async function openPathInExplorer(path: string) {
//   const { invoke } = await import('@tauri-apps/api/core');
//   await invoke('open_path_in_explorer', { path }).catch(console.error);
// }

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: PanelSettings;
  onChange: (settings: PanelSettings) => void;
}) {
  const options: Array<{
    key: keyof PanelSettings;
    label: string;
    desc: string;
    emoji: string;
    color: string;
    tag?: string;
  }> = [
    {
      key: 'showAi',
      label: 'AI Анализ',
      desc: 'Блок AI-результатов: короткие видео, сценарии 6–30 сек, битые файлы.',
      emoji: '🤖',
      color: '#38bdf8',
      // tag: 'Рекомендуется',
    },
    {
      key: 'showControl',
      label: 'Контроль качества',
      desc: 'Ручное управление очередью проверки, удаление подозрительных файлов.',
      emoji: '🛡️',
      color: '#a78bfa',
    },
    {
      key: 'showIntelligence',
      label: 'Intelligence Center',
      desc: 'Стратегические метрики, приоритеты просмотра и Executive Dashboard.',
      emoji: '💡',
      color: '#fbbf24',
    },
    {
      key: 'showRecovery',
      label: 'Восстановление файлов',
      desc: 'Страница восстановления битых видео с AI-разметкой проблем.',
      emoji: '🔧',
      color: '#34d399',
    },
  ];

  const enabledCount = options.filter(o => settings[o.key]).length;

  return (
    <div className="sp-root" style={{paddingBottom: '60px'}}>
      {/* Hero */}
      <div className="sp-hero">
        <div>
          <span className="sp-eyebrow">Конфигурация интерфейса</span>
          <h2 className="sp-title">Настройки</h2>
          <p className="sp-sub">
            Включено&nbsp;<strong>{enabledCount}</strong>&nbsp;из&nbsp;<strong>{options.length}</strong> панелей.
            Изменения применяются мгновенно.
          </p>
        </div>
        <div className="sp-counter">
          <svg viewBox="0 0 64 64" className="sp-ring-svg">
            <circle cx="32" cy="32" r="26" className="sp-ring-bg" />
            <circle
              cx="32" cy="32" r="26"
              className="sp-ring-fill"
              style={{
                strokeDasharray: `${(enabledCount / options.length) * 163.4} 163.4`,
              }}
            />
          </svg>
          <span className="sp-ring-num">{enabledCount}</span>
        </div>
      </div>

      <div className="sp-grid">
        {options.map(option => (
          <div
            key={option.key}
            className={`sp-card${settings[option.key] ? ' sp-card-on' : ''}`}
            style={{ '--sp-accent': option.color } as React.CSSProperties}
          >
            <div className="sp-card-top">
              <span className="sp-emoji">{option.emoji}</span>
              <div className="sp-card-info">
                <span className="sp-card-label">{option.label}</span>
                {option.tag && <span className="sp-tag">{option.tag}</span>}
              </div>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={settings[option.key]}
                  onChange={e => onChange({ ...settings, [option.key]: e.target.checked })}
                />
                <span className="switch-track"><span className="switch-thumb" /></span>
              </label>
            </div>
            <p className="sp-card-desc">{option.desc}</p>
            <div className="sp-card-bar" />
          </div>
        ))}
      </div>
        {/* <div style={{marginBottom: '20px'}}></div> */}
      {/* <p className="sp-hint">⚡ Изменения применяются мгновенно — без перезапуска приложения.</p> */}
    </div>
  );
}
function sortFolderTree(node: FolderNode, sortBy: TreeSort): FolderNode {
  const sortedChildren = node.children
    .map((child) => sortFolderTree(child, sortBy))
    .sort((left, right) => {
      if (sortBy === "files") {
        return right.totalVideoFiles - left.totalVideoFiles;
      }
      if (sortBy === "duration") {
        return right.totalDurationSec - left.totalDurationSec;
      }
      if (sortBy === "name") {
        return left.name.localeCompare(right.name, "ru", { sensitivity: "base" });
      }
      return left.path.localeCompare(right.path, "ru", { sensitivity: "base" });
    });

  return {
    ...node,
    children: sortedChildren,
  };
}

async function deleteVideo(
  path: string,
  setDeletingPath: (path: string | null) => void,
  onDeleted?: (path: string) => void,
) {
  setDeletingPath(path);
  try {
    await invoke("delete_video_file", { path });
    onDeleted?.(path);
  } catch (error) {
    console.error("Не удалось удалить видео:", error);
  } finally {
    setDeletingPath(null);
  }
}

function flattenTree(root: FolderNode) {
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

function filterFindings(items: AiVideoFinding[], query: string, deletedPaths: Set<string>) {
  const value = query.trim().toLowerCase();
  return items.filter((item) => {
    if (deletedPaths.has(item.path)) return false;
    if (!value) return true;
    return [item.fileName, item.path, item.issue, item.scenario, item.scenarioTitle, item.detectedAction]
      .some((text) => text.toLowerCase().includes(value));
  });
}

function sortFindings(items: AiVideoFinding[], sort: AiSort) {
  return [...items].sort((left, right) => {
    if (sort === "confidence") return right.confidence - left.confidence;
    if (sort === "name") return left.fileName.localeCompare(right.fileName, "ru");
    return right.roundedDurationSec - left.roundedDurationSec;
  });
}

function buildAnalysisMetrics(analysis: AiAnalysisResult, deletedPaths: Set<string>): AnalysisMetrics {
  const shortVideos = analysis.shortVideos.filter((item) => !deletedPaths.has(item.path));
  const durationBandVideos = analysis.durationBandVideos.filter((item) => !deletedPaths.has(item.path));
  const brokenVideos = analysis.brokenVideos.filter((item) => !deletedPaths.has(item.path));
  const behaviorVideos = analysis.passiveBehaviorVideos.filter((item) => !deletedPaths.has(item.path));
  const checkedFiles = Math.max(analysis.totalVideoFiles - deletedPaths.size, 0);
  const shortCount = shortVideos.length;
  const durationBandCount = durationBandVideos.length;
  const brokenCount = brokenVideos.length;
  const behaviorCount = behaviorVideos.length;
  const okCount = Math.max(checkedFiles - brokenCount - behaviorCount, 0);
  const issueRate = checkedFiles ? ((brokenCount + behaviorCount) / checkedFiles) * 100 : 0;
  const averageShortSec = durationBandCount
    ? durationBandVideos.reduce((sum, item) => sum + item.roundedDurationSec, 0) / durationBandCount
    : 0;
  const averageConfidence = behaviorCount
    ? behaviorVideos.reduce((sum, item) => sum + item.confidence, 0) / behaviorCount
    : 0;

  return {
    checkedFiles,
    shortCount,
    durationBandCount,
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

function topBars(values: string[], limit: number) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const rows = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return rows.map(([label, value]) => ({ label, value, percent: (value / max) * 100 }));
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function toFolderScenario(folder: FolderNode): FolderScenario {
  return {
    path: folder.path,
    name: folder.name,
    owner: inferFolderOwner(folder),
    scenarioTitle: inferFolderScenarioTitle(folder),
    totalVideoFiles: folder.totalVideoFiles,
    totalDurationSec: folder.totalDurationSec,
  };
}

function inferFolderScenarioTitle(folder: FolderNode) {
  const text = `${folder.path} ${folder.name}`.toLowerCase();

  if (containsAny(text, ["выклад", "вклад", "расклад", "разлож", "товар", "вещ", "предмет", "item", "place"])) {
    return "Выкладка вещей";
  }
  if (containsAny(text, ["упаков", "pack", "box", "короб"])) {
    return "Упаковка";
  }
  if (containsAny(text, ["собир", "sort", "комплект", "набор"])) {
    return "Сборка заказа";
  }
  if (containsAny(text, ["телефон", "phone", "mobile", "смартф"])) {
    return "Телефон";
  }
  if (containsAny(text, ["кур", "smok", "cigar", "сигар"])) {
    return "Курение";
  }
  if (containsAny(text, ["еда", "ест", "eat", "food", "обед"])) {
    return "Еда";
  }
  if (containsAny(text, ["общ", "talk", "говор", "разговор"])) {
    return "Общение";
  }
  if (containsAny(text, ["ожидан", "idle", "безд", "ничего", "stand"])) {
    return "Бездействие";
  }

  return humanizeFolderName(folder.name);
}

function inferFolderOwner(folder: FolderNode) {
  const ownerSource = folder.name || folder.path.split(/[\\/]/).pop() || "";
  const tokens = ownerSource
    .replace(/\.[^.]+$/, "")
    .split(/[_\-\s]+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !/^\d{1,2}\.\d{1,2}$/.test(token));
  const personTokens = tokens.slice(0, 2).map(capitalizeToken);

  return personTokens.length ? personTokens.join(" ") : "Не определён";
}

function humanizeFolderName(name: string) {
  const words = name
    .replace(/\.[^.]+$/, "")
    .split(/[_\-\s]+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word))
    .slice(0, 3)
    .map(capitalizeToken);

  return words.length ? words.join(" ") : "Сценарий папки";
}

function capitalizeToken(token: string) {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function containsAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function formatUnixDate(value: number) {
  if (!value) return "неизвестно";
  return new Date(value * 1000).toLocaleString("ru-RU");
}