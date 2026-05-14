import { CONTROLADOR, dpoMailto } from "../../legal/dpo";

interface Props {
  onOpenTermos: () => void;
  onOpenPrivacidade: () => void;
  onOpenQuemSomos: () => void;
}

/**
 * Rodapé legal · sempre visível.
 *
 * Cumpre dois propósitos:
 *  1. Identificar o controlador (LGPD art. 9º I e art. 41 §1º II).
 *  2. Dar acesso permanente aos documentos legais e ao canal do Encarregado
 *     (LGPD art. 18 — direitos do titular).
 */
export default function Footer({ onOpenTermos, onOpenPrivacidade, onOpenQuemSomos }: Props) {
  return (
    <footer className="legal-footer" aria-label="Rodapé legal">
      <div className="legal-footer-left">
        <span className="legal-footer-brand">DealFlow <em>BR</em></span>
        <span className="legal-footer-controlador">
          {CONTROLADOR.razao_social} · CNPJ {CONTROLADOR.cnpj}
        </span>
      </div>
      <nav className="legal-footer-links" aria-label="Documentos legais">
        <button type="button" className="legal-footer-link" onClick={onOpenQuemSomos}>
          Quem somos
        </button>
        <span className="legal-footer-sep" aria-hidden="true">·</span>
        <button type="button" className="legal-footer-link" onClick={onOpenTermos}>
          Termos de Uso
        </button>
        <span className="legal-footer-sep" aria-hidden="true">·</span>
        <button type="button" className="legal-footer-link" onClick={onOpenPrivacidade}>
          Política de Privacidade
        </button>
        <span className="legal-footer-sep" aria-hidden="true">·</span>
        <a
          href={dpoMailto("contato com o Encarregado")}
          className="legal-footer-link"
          title="Fale com o Encarregado pelo Tratamento de Dados (LGPD art. 41)"
        >
          Encarregado · LGPD
        </a>
      </nav>
    </footer>
  );
}
