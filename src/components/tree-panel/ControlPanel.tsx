import { useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import type { AiAnalysisResult, FolderNode, ScanResult } from "../../types/scan";
import type { FolderScenario, ScenarioNote } from "../../types/panel-settings";
import { formatHoursDecimal } from "../../lib/format";
import { buildAnalysisMetrics, flattenTree, toFolderScenario } from "../../lib/analysis-utils";
import { InfoTip } from "./InfoTip";

async function openPathInExplorer(path: string) {
  try { await openPath(path); } catch { /* no-op */ }
}

function EnterpriseOverview({ checkedFiles, totalVideoFiles, totalIssues, deletedCount, qualityKpi }: {
  checkedFiles: number; totalVideoFiles: number; totalIssues: number; deletedCount: number; qualityKpi: number;
}) {
  const coverage = totalVideoFiles ? (checkedFiles / totalVideoFiles) * 100 : 0;
  const risk = totalIssues === 0 ? "Низкий" : qualityKpi >= 90 ? "Средний" : "Высокий";
  return (
    <div className="enterprise-grid">
      <div className="enterprise-card enterprise-card-accent">
        <span>Enterprise Control Tower <InfoTip text="Сводка для руководителя: покрытие, риск, аудит." /></span>
        <strong>{risk} риск</strong>
        <small>AI Quality Gate</small>
      </div>
      <div className="enterprise-card">
        <span>Покрытие анализа <InfoTip text="Доля видео, по которым AI смог получить длительность." /></span>
        <strong>{coverage.toFixed(0)}%</strong>
        <small>{checkedFiles} из {totalVideoFiles}</small>
      </div>
      <div className="enterprise-card">
        <span>Audit Trail <InfoTip text="Счётчик удалений в текущей сессии." /></span>
        <strong>{deletedCount}</strong>
        <small>удалений</small>
      </div>
      <div className="enterprise-card">
        <span>SLA проверки <InfoTip text="Операционный статус." /></span>
        <strong>{totalIssues ? "В работе" : "OK"}</strong>
        <small>{totalIssues} задач</small>
      </div>
    </div>
  );
}

function FolderScenarioInventory({ scenarios }: { scenarios: FolderScenario[] }) {
  return (
    <div className="ai-finding-section">
      <h3>Сценарии по всем папкам <InfoTip text="Название сценария, автор и объём материала." /></h3>
      <div className="folder-scenario-table">
        {scenarios.slice(0, 80).map((s) => (
          <button className="folder-scenario-row" type="button" key={s.path} onClick={() => openPathInExplorer(s.path)} title={s.path}>
            <span className="scenario-pill">{s.scenarioTitle}</span>
            <strong>{s.owner}</strong>
            <span>{s.name}</span>
            <small>{s.totalVideoFiles} видео · {formatHoursDecimal(Math.ceil(s.totalDurationSec))}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScenarioKnowledgeBase({ notes, onChange }: { notes: ScenarioNote[]; onChange: (notes: ScenarioNote[]) => void }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  function handleSave() {
    const nc = code.trim(); const nd = desc.trim();
    if (!nc || !nd) return;
    onChange([...notes.filter((n) => n.code.toLowerCase() !== nc.toLowerCase()), { code: nc, description: nd }]);
    setCode(""); setDesc("");
  }
  return (
    <div className="scenario-knowledge-card">
      <div className="chart-head">
        <h3>Описание сценариев <InfoTip text="Добавьте код вроде scn-016 и пояснение." /></h3>
      </div>
      <div className="scenario-note-form">
        <input value={code} placeholder="scn-016" onChange={(e) => setCode(e.target.value)} />
        <input value={desc} placeholder="Что означает сценарий" onChange={(e) => setDesc(e.target.value)} />
        <button className="badge badge-open-folder" type="button" onClick={handleSave}>Сохранить</button>
      </div>
      <div className="scenario-note-list">
        {notes.map((n) => (
          <div className="scenario-note-chip" key={n.code}><strong>{n.code}</strong><span>{n.description}</span></div>
        ))}
      </div>
    </div>
  );
}

export function ControlPanel({ analysis, result, deletedPaths, scenarioNotes, onScenarioNotesChange }: {
  analysis: AiAnalysisResult | null; result: ScanResult | null;
  deletedPaths: Set<string>; scenarioNotes: ScenarioNote[];
  onScenarioNotesChange: (notes: ScenarioNote[]) => void;
}) {
  const totalIssues = (analysis?.brokenVideos.length ?? 0) + (analysis?.passiveBehaviorVideos.length ?? 0);
  const allFolders = result ? flattenTree(result.tree).filter((n: FolderNode) => n.totalVideoFiles > 0) : [];
  const qualityKpi = analysis ? 100 - buildAnalysisMetrics(analysis, deletedPaths).issueRate : 0;
  return (
    <div className="ai-analysis-panel control-panel">
      {!result ? <div className="empty-state">Запустите скан, чтобы увидеть контроль качества.</div> : (
        <>
          <EnterpriseOverview checkedFiles={analysis?.checkedFiles ?? 0} totalVideoFiles={result.summary.totalVideoFiles} totalIssues={totalIssues} deletedCount={deletedPaths.size} qualityKpi={qualityKpi} />
          <div className="ai-summary-grid">
            <div className="ai-summary-card"><span>Очередь проверки <InfoTip text="Видео, требующие просмотра." /></span><strong>{totalIssues}</strong></div>
            <div className="ai-summary-card"><span>Удалено вручную <InfoTip text="Файлов удалено в этой сессии." /></span><strong>{deletedPaths.size}</strong></div>
            <div className="ai-summary-card"><span>Активных папок <InfoTip text="Папки с видео." /></span><strong>{allFolders.slice(0, 8).length}</strong></div>
          </div>
          <div className="ai-finding-section">
            <h3>Папки с наибольшим объёмом <InfoTip text="Быстрый доступ к главным папкам." /></h3>
            <div className="control-folder-list">
              {allFolders.slice(0, 8).map((f) => (
                <button className="control-folder-row" type="button" key={f.path} onClick={() => openPathInExplorer(f.path)} title={f.path}>
                  <span>{f.name}</span>
                  <small>{f.totalVideoFiles} видео · {formatHoursDecimal(Math.ceil(f.totalDurationSec))}</small>
                </button>
              ))}
            </div>
          </div>
          <FolderScenarioInventory scenarios={allFolders.map(toFolderScenario)} />
          <ScenarioKnowledgeBase notes={scenarioNotes} onChange={onScenarioNotesChange} />
        </>
      )}
    </div>
  );
}
