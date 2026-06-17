import { Download, RefreshCw, WifiOff } from "lucide-react";
import type { UpdateStatus } from "../../types/updater";

type Props = {
  status: UpdateStatus;
  isOnline: boolean;
  versionLabel: string | null;
  onOpen: () => void;
};

export function UpdateWidget({ status, isOnline, versionLabel, onOpen }: Props) {
  if (!isOnline || status === "offline") {
    return (
      <button className="bottom-dock-button" type="button" onClick={onOpen}>
        <WifiOff className="dock-icon" />
        Нет сети
      </button>
    );
  }

  if (status === "available" || status === "downloading" || status === "installed") {
    return (
      <button className="bottom-dock-button bottom-dock-active" type="button" onClick={onOpen}>
        <Download className="dock-icon" />
        Обновление{versionLabel ? ` (${versionLabel})` : ""}
      </button>
    );
  }

  if (status === "checking") {
    return (
      <button className="bottom-dock-button" type="button" onClick={onOpen}>
        <RefreshCw className="dock-icon" />
        Проверка...
      </button>
    );
  }

  return null;
}
