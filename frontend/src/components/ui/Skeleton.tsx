interface CardsProps {
  count?: number;
}

export function SkeletonCards({ count = 6 }: CardsProps) {
  return (
    <div className="skeleton-stack" aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="sk sk-glyph" />
          <div className="sk-block">
            <div className="sk sk-line sk-line-w70" />
            <div className="sk sk-line sk-line-w40" />
          </div>
          <div className="sk-block">
            <div className="sk sk-line sk-line-w30" />
            <div className="sk sk-line sk-line-large sk-line-w60" />
          </div>
          <div className="sk sk-pill" />
        </div>
      ))}
    </div>
  );
}

interface RowsProps {
  count?: number;
}

export function SkeletonRows({ count = 8 }: RowsProps) {
  return (
    <div aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="sk sk-line sk-line-w30" style={{ height: 10 }} />
          <div className="sk-block">
            <div className="sk sk-line sk-line-w60" />
            <div className="sk sk-line sk-line-w40" />
          </div>
          <div className="sk sk-line sk-line-w70" style={{ height: 10 }} />
          <div className="sk sk-pill" />
        </div>
      ))}
    </div>
  );
}
