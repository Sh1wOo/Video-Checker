import type { PanelSettings } from "../../types/panel-settings";
import type { UpdateStatus, UpdateInfo } from "../../types/updater";

export type SettingsPanelUpdaterProps = {
  status: UpdateStatus;
  isOnline: boolean;
  updateInfo: UpdateInfo | null;
  error: string | null;
  checkForUpdates: (openModalOnAvailable?: boolean) => Promise<boolean>;
  setIsModalOpen: (value: boolean) => void;
};

export function SettingsPanel({
  settings,
  onChange,
  updater,
}: {
  settings: PanelSettings;
  onChange: (settings: PanelSettings) => void;
  updater?: SettingsPanelUpdaterProps;
}) {
  const options: Array<{ key: keyof PanelSettings; label: string; desc: string; emoji: string; color: string }> = [
    { key: "showAi", label: "AI Анализ", desc: "Блок AI-результатов: короткие видео, сценарии 6–30 сек, битые файлы.", emoji: "🤖", color: "#38bdf8" },
    { key: "showControl", label: "Контроль качества", desc: "Ручное управление очередью проверки, удаление подозрительных файлов.", emoji: "🛡️", color: "#a78bfa" },
    { key: "showIntelligence", label: "Intelligence Center", desc: "Стратегические метрики, приоритеты просмотра и Executive Dashboard.", emoji: "💡", color: "#fbbf24" },
    { key: "showRecovery", label: "Восстановление файлов", desc: "Страница восстановления битых видео с AI-разметкой проблем.", emoji: "🔧", color: "#34d399" },
  ];

  const enabledCount = options.filter((o) => settings[o.key]).length;

  return (
    <div className="sp-root" style={{ paddingBottom: "60px" }}>
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
              style={{ strokeDasharray: `${(enabledCount / options.length) * 163.4} 163.4` }}
            />
          </svg>
          <span className="sp-ring-num">{enabledCount}</span>
        </div>
      </div>

      <div className="sp-grid">
        {options.map((option) => (
          <div
            key={option.key}
            className={`sp-card${settings[option.key] ? " sp-card-on" : ""}`}
            style={{ "--sp-accent": option.color } as React.CSSProperties}
          >
            <div className="sp-card-top">
              <span className="sp-emoji">{option.emoji}</span>
              <span className="sp-card-label">{option.label}</span>
              <label className="switch-control">
                <input
                  type="checkbox"
                  checked={settings[option.key]}
                  onChange={(e) => onChange({ ...settings, [option.key]: e.target.checked })}
                />
                <span className="switch-track"><span className="switch-thumb" /></span>
              </label>
            </div>
            <p className="sp-card-desc">{option.desc}</p>
            <div className="sp-card-bar" />
          </div>
        ))}
      </div>

      {/* Блок обновлений */}
      <div className="scenario-knowledge-card" style={{ marginTop: "24px" }}>
        <div className="chart-head">
          <h3>Обновления приложения</h3>
        </div>
        <div className="scenario-note-list">
          <div className="scenario-note-chip">
            <strong>Сеть</strong>
            <span>{updater?.isOnline ? "Online" : "Нет сети"}</span>
          </div>
          <div className="scenario-note-chip">
            <strong>Статус</strong>
            <span>{updater?.status ?? "idle"}</span>
          </div>
          <div className="scenario-note-chip">
            <strong>Версии</strong>
            <span>
              {updater?.updateInfo
                ? `${updater.updateInfo.currentVersion} → ${updater.updateInfo.version}`
                : "Новых версий нет"}
            </span>
          </div>
        </div>
        {updater?.error
          ? <div className="error-box" style={{ marginTop: "8px" }}>{updater.error}</div>
          : null}
        <div className="rp-detail-actions" style={{ marginTop: "12px" }}>
          <button
            className="badge badge-open-folder"
            type="button"
            disabled={!updater?.isOnline}
            onClick={() => void updater?.checkForUpdates(true)}
          >
            Проверить наличие обновлений
          </button>
          <button
            className="badge"
            type="button"
            onClick={() => updater?.setIsModalOpen(true)}
          >
            Открыть центр обновления
          </button>
        </div>
      </div>
    </div>
  );
}
