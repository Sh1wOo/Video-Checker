import { Info } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  function dispatch(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("video-checker:info", { detail: text }));
  }
  return (
    <span
      className="info-tip"
      role="button"
      tabIndex={0}
      aria-label="Открыть описание блока"
      onClick={dispatch}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dispatch(e); } }}
    >
      <Info className="info-icon" />
    </span>
  );
}
