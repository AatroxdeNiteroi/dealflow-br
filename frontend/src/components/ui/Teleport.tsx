import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

interface Props {
  sections: Section[];
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function Teleport({ sections, containerRef }: Props) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const scrollTop = container.scrollTop;
      const vh = container.clientHeight;
      const idx = Math.round(scrollTop / vh);
      const sec = sections[Math.min(idx, sections.length - 1)];
      if (sec) setActive(sec.id);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef, sections]);

  function goto(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="teleport" aria-label="seções">
      {sections.map((s) => (
        <div key={s.id} style={{ position: "relative" }}>
          <button
            className="teleport-btn"
            data-active={active === s.id}
            aria-label={s.label}
            onClick={() => goto(s.id)}
          />
          <span className="teleport-label">{s.label}</span>
        </div>
      ))}
    </nav>
  );
}
