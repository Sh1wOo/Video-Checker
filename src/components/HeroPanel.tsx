import { Moon, ScanSearch, Sun } from 'lucide-react';
import { HeaderLogo } from './HeaderLogo';
import { ScanToolbar } from './ScanToolbar';

type Props = {
  dark: boolean;
  onToggleTheme: () => void;
  folderPath: string;
  loading: boolean;
  onPickFolder: () => void | Promise<void>;
  onRunScan: () => void | Promise<void>;
  logo?: string;
};

export function HeroPanel({ dark, onToggleTheme, folderPath, loading, onPickFolder, onRunScan, logo }: Props) {
  return (
    <section className="panel hero-panel">
      <div className="hero-head">
        <div className="hero-top">
          <HeaderLogo logo={logo} icon={<ScanSearch className="hero-icon" />} />
        </div>

        <div className="hero-actions">
          <button
            className="btn btn-secondary btn-icon"
            type="button"
            aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={dark ? 'Светлая тема' : 'Тёмная тема'}
            onClick={onToggleTheme}
          >
            {dark ? <Sun className="icon" /> : <Moon className="icon" />}
            {dark ? 'Светлая' : 'Тёмная'}
          </button>
        </div>
      </div>

      <ScanToolbar
        folderPath={folderPath}
        loading={loading}
        onPickFolder={onPickFolder}
        onRunScan={onRunScan}
      />
    </section>
  );
}
