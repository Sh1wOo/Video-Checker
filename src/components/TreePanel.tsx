import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { FolderTree as FolderTreeIcon, BrainCircuit, ShieldCheck, Lightbulb } from "lucide-react";
import type { FolderNode, ScanResult, AiAnalysisResult } from "../types/scan";
import type { ActiveTab, ScenarioNote, TreeSort } from "../types/panel-settings";
import { sortFolderTree, flattenTree } from "../lib/analysis-utils";
import { FolderTree } from "./folder-tree/FolderTree";
import { VirtualFolderTree } from "./folder-tree/VirtualFolderTree";
import { AiAnalysisPanel } from "./tree-panel/AiAnalysisPanel";
import { ControlPanel } from "./tree-panel/ControlPanel";
import { IntelligencePanel } from "./tree-panel/IntelligencePanel";
import { InfoModal } from "./tree-panel/InfoModal";
import { InfoTip } from "./tree-panel/InfoTip";

export type { PanelSettings } from "../types/panel-settings";
export { RecoveryPanel } from "./tree-panel/RecoveryPanel";
export { SettingsPanel } from "./tree-panel/SettingsPanel";

const GSAP_TREE_LIMIT = 1800;

type Props = {
  result: ScanResult | null;
  aiAnalysis: AiAnalysisResult | null;
  aiLoading: boolean;
  aiError: string | null;
  treeBuiltFolders?: number;
  settings: import("../types/panel-settings").PanelSettings;
};

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
    const q = treeQuery.trim().toLowerCase();
    return flattenTree(sortedTree)
      .filter((n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
      .slice(0, 12);
  }, [sortedTree, treeQuery]);

  useEffect(() => {
    if (activeTab === "ai" && !settings.showAi) setActiveTab("tree");
    if (activeTab === "control" && !settings.showControl) setActiveTab("tree");
    if (activeTab === "intelligence" && !settings.showIntelligence) setActiveTab("tree");
  }, [activeTab, settings]);

  useEffect(() => {
    function handleInfo(event: Event) {
      setInfoModalText((event as CustomEvent<string>).detail);
    }
    window.addEventListener("video-checker:info", handleInfo);
    return () => window.removeEventListener("video-checker:info", handleInfo);
  }, []);

  return (
    <section className="panel tree-panel">
      <div className="panel-header with-border tree-panel-header">
        <h2 className="panel-title">
          Дерево папок
          <InfoTip text="Здесь собраны результаты скана: структура папок, AI-анализ, контроль качества и сценарии." />
        </h2>
        <div className="panel-tabs">
          <button className={`panel-tab${activeTab === "tree" ? " panel-tab-active" : ""}`} onClick={() => setActiveTab("tree")}>
            <FolderTreeIcon className="icon" />Дерево
          </button>
          {settings.showAi && (
            <button className={`panel-tab${activeTab === "ai" ? " panel-tab-active" : ""}`} onClick={() => setActiveTab("ai")}>
              <BrainCircuit className="icon" />AI Анализ
            </button>
          )}
          {settings.showControl && (
            <button className={`panel-tab${activeTab === "control" ? " panel-tab-active" : ""}`} onClick={() => setActiveTab("control")}>
              <ShieldCheck className="icon" />Контроль
            </button>
          )}
          {settings.showIntelligence && (
            <button className={`panel-tab${activeTab === "intelligence" ? " panel-tab-active" : ""}`} onClick={() => setActiveTab("intelligence")}>
              <Lightbulb className="icon" />Intelligence
            </button>
          )}
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
              {selectedVideoPath && (
                <div className="selected-video-banner">
                  <strong>Выбрано видео:</strong> {selectedVideoPath}
                  {highlightedFolderPath && <small>Папка: {highlightedFolderPath}</small>}
                </div>
              )}
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
          onDeleted={(path) => setDeletedPaths((prev) => new Set(prev).add(path))}
          onOpenFolder={(folderPath, videoPath) => {
            setHighlightedFolderPath(folderPath);
            setSelectedVideoPath(videoPath);
            openPath(folderPath).catch(() => { /* no-op */ });
          }}
        />
      )}

      {infoModalText && <InfoModal text={infoModalText} onClose={() => setInfoModalText(null)} />}
    </section>
  );
}

function TreeManagement({
  query, onQueryChange, sort, onSortChange, matches, root,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  sort: TreeSort;
  onSortChange: (v: TreeSort) => void;
  matches: FolderNode[];
  root: FolderNode;
}) {
  return (
    <div className="management-bar tree-management-bar">
      <InfoTip text="Управление деревом: поиск папки, сортировка и открытие корневого каталога." />
      <label className="management-search">
        <Search className="icon" />
        <input value={query} placeholder="Найти папку в дереве" onChange={(e) => onQueryChange(e.target.value)} />
      </label>
      <select value={sort} onChange={(e) => onSortChange(e.target.value as TreeSort)}>
        <option value="path">Сортировка: путь</option>
        <option value="name">Сортировка: имя</option>
        <option value="files">Сортировка: файлы</option>
        <option value="duration">Сортировка: длительность</option>
      </select>
      <button className="badge badge-open-folder" type="button" onClick={() => openPath(root.path).catch(() => { /* no-op */ })}>
        <ExternalLink className="badge-icon" />Открыть корень
      </button>
      {query.trim() && (
        <div className="tree-search-results">
          {matches.length
            ? matches.map((node) => (
              <button className="tree-search-hit" type="button" key={node.path} onClick={() => openPath(node.path).catch(() => { /* no-op */ })} title={node.path}>
                <span>{node.name}</span>
                <small>{node.totalVideoFiles} видео</small>
              </button>
            ))
            : <span className="tree-search-empty">Совпадений нет</span>}
        </div>
      )}
    </div>
  );
}
