import { openPath } from "@tauri-apps/plugin-opener";
import type { AiAnalysisResult, ScanResult } from "../../types/scan";
import type { ScenarioNote } from "../../types/panel-settings";
import { formatBytes, formatDuration } from "../../lib/format";
import { buildAnalysisMetrics, formatPercent, sortFindings, topBars } from "../../lib/analysis-utils";
import { InfoTip } from "./InfoTip";
import { BarChartCard } from "./BarChartCard";

async function openPathInExplorer(path: string) {
  try { await openPath(path); } catch { /* no-op */ }
}

export function IntelligencePanel({ analysis, result, deletedPaths, scenarioNotes }: {
  analysis: AiAnalysisResult | null; result: ScanResult | null;
  deletedPaths: Set<string>; scenarioNotes: ScenarioNote[];
}) {
  if (!result || !analysis) return <div className="ai-analysis-panel empty-state">Запустите скан, чтобы открыть Intelligence Center.</div>;

  const metrics = buildAnalysisMetrics(analysis, deletedPaths);
  const allFindings = [
    ...analysis.durationBandVideos,
    ...analysis.brokenVideos,
    ...analysis.passiveBehaviorVideos,
  ].filter((item) => !deletedPaths.has(item.path));
  const priorityItems = sortFindings(allFindings, "duration")
    .sort((l, r) => Number(r.isProblem) - Number(l.isProblem))
    .slice(0, 6);
  const scenarioCoverage = topBars(allFindings.map((i) => i.scenarioTitle), 8);

  return (
    <div className="ai-analysis-panel intelligence-panel">
      <div className="intelligence-hero">
        <div>
          <span>Executive Intelligence</span>
          <h3>AI Command Brief</h3>
          <p>Сводка: что проверить первым, какие сценарии чаще встречаются.</p>
        </div>
        <strong>{formatPercent(100 - metrics.issueRate)}</strong>
      </div>
      <div className="enterprise-grid">
        <div className="enterprise-card"><span>Приоритетов <InfoTip text="Самые длинные или важные элементы." /></span><strong>{priorityItems.length}</strong><small>к просмотру</small></div>
        <div className="enterprise-card"><span>Сценариев <InfoTip text="Разных сценариев в AI-результатах." /></span><strong>{scenarioCoverage.length}</strong><small>в выборке</small></div>
        <div className="enterprise-card"><span>Заметок <InfoTip text="Ручные описания сценариев." /></span><strong>{scenarioNotes.length}</strong><small>добавлено</small></div>
        <div className="enterprise-card enterprise-card-accent">
          <span>Decision Grade <InfoTip text="Оценка готовности к просмотру." /></span>
          <strong>{metrics.issueRate <= 10 ? "A" : metrics.issueRate <= 25 ? "B" : "C"}</strong>
          <small>качество выборки</small>
        </div>
      </div>
      <div className="analysis-charts-grid">
        <BarChartCard title="Сценарный радар" bars={scenarioCoverage} empty="Нет сценариев." />
        <div className="chart-card">
          <div className="chart-head">
            <h3>Приоритет просмотра <InfoTip text="Видео, которые лучше открыть первыми." /></h3>
          </div>
          <div className="priority-list">
            {priorityItems.map((item) => (
              <button className="priority-row" type="button" key={item.path} onClick={() => openPathInExplorer(item.path)} title={item.path}>
                <span>{item.scenarioTitle}</span>
                <strong>{item.fileName}</strong>
                <small>{formatDuration(item.roundedDurationSec)} · {formatBytes(item.fileSizeBytes)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-head">
            <h3>Ручные описания <InfoTip text="Сценарные коды, добавленные вручную." /></h3>
          </div>
          {scenarioNotes.length ? (
            <div className="scenario-note-list">
              {scenarioNotes.map((n) => (
                <div className="scenario-note-chip" key={n.code}><strong>{n.code}</strong><span>{n.description}</span></div>
              ))}
            </div>
          ) : <div className="ai-empty-line">Заметок нет. Добавьте их во вкладке Контроль.</div>}
        </div>
      </div>
    </div>
  );
}
