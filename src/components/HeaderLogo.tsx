import type { ReactNode } from "react";
import { Mail, Send, Camera } from "lucide-react";
import './headerLogo.css'

type Props = {
  logo?: string;
  icon?: ReactNode;
};

const TELEGRAM_URL = "https://t.me/sh1woo";
const EMAIL_URL = "mailto:zuromr@gmail.com";
const INSTAGRAM_URL = "https://www.instagram.com/sh1woo_/";

export function HeaderLogo({ logo, icon }: Props) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        {logo ? (
          <img src={logo} alt="" className="brand-mark-image" />
        ) : (
          <div className="brand-mark-fallback">{icon}</div>
        )}
      </div>

      <div className="brand-copy">
        <h1 className="hero-title">Видеосканнер</h1>
        <p className="hero-subtitle">
          Быстрый подсчёт длительности видео по папкам,
          специально для манеджеров DataLight Эгоцентрика Советская.
        </p>
        <p className="hero-subtitle">Разработал: Яцун Никита Витальевич, баги и предложения сюда:</p>

        <div className="brand-links" aria-label="Контакты разработчика">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-link"
            title="Telegram: @sh1woo"
            aria-label="Открыть Telegram @sh1woo"
          >
            <Send className="brand-link-icon" />
            <span>Telegram</span>
          </a>

          <a
            href={EMAIL_URL}
            className="brand-link"
            title="zuromr@gmail.com"
            aria-label="Написать на почту zuromr@gmail.com"
          >
            <Mail className="brand-link-icon" />
            <span>Email</span>
          </a>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-link"
            title="Instagram: @sh1woo_"
            aria-label="Открыть Instagram @sh1woo_"
          >
            <Camera className="brand-link-icon" />
            <span>Instagram</span>
          </a>
        </div>
      </div>
    </div>
  );
}