import type { TermDef } from "./terms";

interface Props {
  term: TermDef;
  onOpen: (term: TermDef) => void;
}

/** Pin clicável (`?`) — substitui o HelpHint para termos do produto.
 *  Onclick abre TermModal premium em vez de tooltip flutuante. */
export default function TermPin({ term, onOpen }: Props) {
  return (
    <button
      className="term-pin"
      type="button"
      aria-label={`Definição: ${term.title}`}
      title={term.title}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(term);
      }}
    >
      ?
    </button>
  );
}
