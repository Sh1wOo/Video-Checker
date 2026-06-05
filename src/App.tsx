import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./App.css";
import { HeroPanel } from "./components/HeroPanel";
import { ProgressSection } from "./components/ProgressSection";
import { StatsPanel } from "./components/StatsPanel";
import { TreePanel, RecoveryPanel, SettingsPanel, PanelSettings } from "./components/TreePanel";
import { useScan } from "./hooks/useScan";
import { Home, RotateCcw, Settings2} from "lucide-react";
// import logo from "../public/b32d4286-273e-4c5d-9f4f-a0a852f20650.png";

export default function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const [refreshMenu, setRefreshMenu] = useState<{ x: number; y: number } | null>(null);

  const [page, setPage] = useState<"main" | "recovery" | "settings">("main");
  const [panelSettings, setPanelSettings] = useState<PanelSettings>({
    showAi: true,
    showControl: false,
    showIntelligence: false,
    showRecovery: true,
  });
  const {
    dark,
    setDark,
    folderPath,
    setFolderPath,
    loading,
    aiLoading,
    progress,
    result,
    aiAnalysis,
    aiError,
    error,
    percent,
    pickFolder,
    runScan,
  } = useScan();

  useLayoutEffect(() => {
    if (!appRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(".hero-panel", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45 })
        .fromTo(
          ".toolbar > *",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, stagger: 0.06, duration: 0.3 },
          "-=0.18",
        )
        .fromTo(
          ".progress-section > *",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.28 },
          "-=0.16",
        )
        .fromTo(
          ".side-column .panel, .tree-panel",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.38 },
          "-=0.12",
        )
        .fromTo(
          ".stat-card",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.28 },
          "-=0.2",
        );
    }, appRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!error || !appRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".error-box",
        { opacity: 0, y: -8, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: "power2.out" },
      );
    }, appRef);

    return () => ctx.revert();
  }, [error]);

  useEffect(() => {
    if (!result || !appRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".tree-panel, .stat-card",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" },
      );
    }, appRef);

    return () => ctx.revert();
  }, [result]);

  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
      setRefreshMenu({ x: event.clientX, y: event.clientY });
    }

    function handleClick() {
      setRefreshMenu(null);
    }

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <div ref={appRef} className="app-shell">
      <div className="app-container">
        <HeroPanel
          dark={dark}
          onToggleTheme={() => setDark((value) => !value)}
          folderPath={folderPath}
          loading={loading}
          onFolderPathChange={setFolderPath}
          onPickFolder={pickFolder}
          onRunScan={runScan}
          // logo={logo}
        />

        <ProgressSection progress={progress} percent={percent} error={error} />

        <div className="content-grid">
          {page === "main" ? (
            <>
              <div className="side-column">
                <StatsPanel result={result} />
              </div>
              <TreePanel
                result={result}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                aiError={aiError}
                treeBuiltFolders={progress?.treeBuiltFolders ?? 0}
                settings={panelSettings}
              />
            </>
          ) : (
            <div className="page-panel panel">
              {page === "recovery" ? (
                <RecoveryPanel analysis={aiAnalysis} />
              ) : (
                <SettingsPanel settings={panelSettings} onChange={setPanelSettings} />
              )}
            </div>
          )}
        </div>
<nav className="bottom-dock">
  <button
    className={`bottom-dock-button${page === "main" ? " bottom-dock-active" : ""}`}
    onClick={() => setPage("main")}
  >
    <Home className="dock-icon" />
    Главная
  </button>

  {panelSettings.showRecovery ? (
    <>
      <span className="dock-separator" />
      <button
        className={`bottom-dock-button${page === "recovery" ? " bottom-dock-active" : ""}`}
        onClick={() => setPage("recovery")}
      >
        <RotateCcw className="dock-icon" />
        Восстановление
      </button>
    </>
  ) : null}

  <span className="dock-separator" />

  <button
    className={`bottom-dock-button${page === "settings" ? " bottom-dock-active" : ""}`}
    onClick={() => setPage("settings")}
  >
    <Settings2 className="dock-icon" />
    Настройки
  </button>
</nav>
      </div>
      {refreshMenu ? (
        <div className="refresh-context-menu" style={{ left: refreshMenu.x, top: refreshMenu.y }}>
          <button type="button" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      ) : null}
    </div>
  );
}