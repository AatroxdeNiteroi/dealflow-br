import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

export default function HelpHint({ title, children }: Props) {
  return (
    <span className="help-hint" tabIndex={0}>
      <span className="help-icon" aria-hidden="true">?</span>
      <span className="help-popover" role="tooltip">
        {title && <div className="hp-title">{title}</div>}
        {children}
      </span>
    </span>
  );
}
