import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
  containerRef: React.RefObject<HTMLDivElement>;
  totalEmpresas?: number;
}

export default function TopNav({ sections, containerRef, totalEmpresas }: Props) {
  const [active, setActive] = useState(sections[0]?.id);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onScroll = () => {
      const offsets = sections.map((s) => {
        const el = document.getElementById(s.id);
        return el ? { id: s.id, top: el.offsetTop } : { id: s.id, top: 0 };
      });
      const cur = c.scrollTop + 100;
      let pick = offsets[0]?.id;
      for (const o of offsets) {
        if (o.top <= cur) pick = o.id;
      }
      if (pick) setActive(pick);
    };
    c.addEventListener("scroll", onScroll);
    return () => c.removeEventListener("scroll", onScroll);
  }, [containerRef, sections]);

  function goto(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="topnav">
      <span className="topnav-brand">
        DealFlow <em style={{ fontStyle: "italic", color: "var(--t-2)" }}>BR</em>
        <small>M&amp;A SCREENER · RJ/SP</small>
      </span>
      {sections.map((s) => (
        <button
          key={s.id}
          className="topnav-btn"
          data-active={active === s.id}
          onClick={() => goto(s.id)}
        >
          {s.label}
        </button>
      ))}
      <div className="topnav-status">
        <span><span className="dot" /> LIVE</span>
        {totalEmpresas !== undefined && (
          <span>UNIVERSO {totalEmpresas.toLocaleString("pt-BR")}</span>
        )}
        <span>{now.toLocaleTimeString("pt-BR")}</span>
      </div>
    </nav>
  );
}
