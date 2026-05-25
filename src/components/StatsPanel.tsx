import { Clock3, Film, HardDrive, TriangleAlert, Zap } from 'lucide-react';
import type { ScanResult } from '../types/scan';
import { formatBytes, formatDuration } from '../lib/format';

type Props = {
  result: ScanResult | null;
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-left">
        {icon}
        <span>{label}</span>
      </div>
      <div className="stat-right">
        <div>{value}</div>
        {sub ? <div className="stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

export function StatsPanel({ result }: Props) {
  const summary = result?.summary;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Статистика</h2>
      </div>

      <div className="stats-list">
        <StatCard icon={<Clock3 className="icon" />} label="Общая длительность" value={summary ? formatDuration(summary.totalDurationSec) : '—'} />
        <StatCard icon={<Film className="icon" />} label="Видео" value={summary?.totalVideoFiles ?? 0} />
        <StatCard icon={<HardDrive className="icon" />} label="Объём" value={summary ? formatBytes(summary.totalBytes) : '—'} />
        <StatCard icon={<TriangleAlert className="icon" />} label="Ошибки" value={summary?.failedFiles ?? 0} />
        <StatCard icon={<Zap className="icon" />} label="Кеш-хиты" value={summary?.cacheHits ?? 0} />
      </div>
    </section>
  );
}
