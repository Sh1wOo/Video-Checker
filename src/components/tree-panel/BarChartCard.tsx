import { InfoTip } from "./InfoTip";

type Bar = { label: string; value: number; percent: number };

export function BarChartCard({ title, bars, empty }: { title: string; bars: Bar[]; empty: string }) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>
          {title}{" "}
          <InfoTip text="Горизонтальный график показывает самые частые значения в выбранной группе." />
        </h3>
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
