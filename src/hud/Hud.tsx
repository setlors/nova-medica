import type { HTMLAttributes, ReactNode } from "react";
import type { Status } from "../core/types";

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}

export function Panel({
  title,
  actions,
  onClose,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <section className={`panel ${className ?? ""}`} {...rest}>
      {(title || onClose || actions) && (
        <header className="panel-header">
          <h2 className="panel-title">{title}</h2>
          <div className="panel-actions">
            {actions}
            {onClose && (
              <button
                type="button"
                className="panel-close"
                aria-label="Close panel"
                onClick={onClose}
              >
                ×
              </button>
            )}
          </div>
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  ok: "Normal",
  warn: "Attention",
  crit: "Critical",
  unknown: "No data",
};

const STATUS_ICON: Record<Status, string> = {
  ok: "✓",
  warn: "▲",
  crit: "■",
  unknown: "?",
};

/** Status is never conveyed by colour alone: always icon + word. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}
