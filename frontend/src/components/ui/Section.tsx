import { useState, type ReactNode } from "react";
import HelpHint from "./HelpHint";

interface Props {
  title: string;
  hintTitle?: string;
  hint?: ReactNode;
  /** Botão custom no header (substitui HelpHint) — usado pra GenusModal etc. */
  hintButton?: ReactNode;
  defaultOpen?: boolean;
  badge?: number;
  children: ReactNode;
}

export default function Section({
  title,
  hintTitle,
  hint,
  hintButton,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="f-section" data-open={open}>
      <button className="f-section-head" onClick={() => setOpen(!open)} type="button">
        <span className="f-section-title">{title}</span>
        {hintButton ? (
          <span onClick={(e) => e.stopPropagation()}>{hintButton}</span>
        ) : (
          hint && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpHint title={hintTitle ?? title}>{hint}</HelpHint>
            </span>
          )
        )}
        {badge !== undefined && badge > 0 && <span className="f-section-count">{badge}</span>}
        <span className="f-section-toggle">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="f-section-body">{children}</div>}
    </div>
  );
}
