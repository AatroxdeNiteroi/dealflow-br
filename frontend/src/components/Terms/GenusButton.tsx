import type { GenusDef } from "./terms";

interface Props {
  label: string;
  genus: GenusDef;
  onOpen: (g: GenusDef) => void;
}

/** Botão "? Sobre X" que abre GenusModal por click.
 *  Mesmo padrão visual do botão do gráfico de círculo. */
export default function GenusButton({ label, genus, onOpen }: Props) {
  return (
    <button
      type="button"
      className="genus-btn"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(genus);
      }}
    >
      ? {label}
    </button>
  );
}
