import { createPortal } from "react-dom";

export function InfoModal({ text, onClose }: { text: string; onClose: () => void }) {
  return createPortal(
    <div className="info-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Описание блока"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chart-head">
          <h3>Что показывает этот блок</h3>
          <button className="badge" type="button" onClick={onClose}>Закрыть</button>
        </div>
        <p>{text}</p>
      </div>
    </div>,
    document.body,
  );
}
