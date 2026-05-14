import type { Contato, Empresa } from "../../api/client";
import { useContato } from "../../hooks/useContato";
import { useLegal } from "../../legal/useLegal";

interface Props {
  empresa: Empresa;
}

function fmtCep(cep: string | null): string | null {
  if (!cep) return null;
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return cep;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

function fmtTelefone(ddd: string | null, num: string | null): string | null {
  if (!num) return null;
  const cleanNum = num.replace(/\D/g, "");
  if (!cleanNum) return null;
  const cleanDdd = (ddd ?? "").replace(/\D/g, "");
  const dddPart = cleanDdd ? `(${cleanDdd}) ` : "";
  // Brasil: 8 ou 9 dígitos
  if (cleanNum.length === 8) return `${dddPart}${cleanNum.slice(0, 4)}-${cleanNum.slice(4)}`;
  if (cleanNum.length === 9) return `${dddPart}${cleanNum.slice(0, 5)}-${cleanNum.slice(5)}`;
  return `${dddPart}${cleanNum}`;
}

function buildEndereco(c: Contato): string {
  const parts = [
    [c.tipo_logradouro, c.logradouro].filter(Boolean).join(" "),
    c.numero,
    c.complemento,
    c.bairro,
    c.municipio_nome,
    c.sigla_uf,
    fmtCep(c.cep),
  ].filter((p) => p && String(p).trim());
  return parts.join(" · ");
}

function buildMapsUrl(c: Contato): string {
  const q = buildEndereco(c);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function buildLinkedInUrl(empresa: Empresa, c: Contato | null): string {
  const cidade = c?.municipio_nome ? ` ${c.municipio_nome}` : "";
  const q = `${empresa.razao_social}${cidade}`;
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(q)}`;
}

function buildGoogleUrl(empresa: Empresa, c: Contato | null): string {
  const cidade = c?.municipio_nome ? ` ${c.municipio_nome}` : "";
  const q = `"${empresa.razao_social}"${cidade}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export default function ContatoPanel({ empresa }: Props) {
  const { data: c, loading } = useContato(empresa.cnpj);
  const { openTermos, openPrivacidade } = useLegal();

  if (loading) {
    return (
      <div className="contato-panel">
        <h4>Contato</h4>
        <div className="contato-loading sk sk-line" style={{ height: 60 }} />
      </div>
    );
  }

  const telefone1 = c ? fmtTelefone(c.ddd_1, c.telefone_1) : null;
  const telefone2 = c ? fmtTelefone(c.ddd_2, c.telefone_2) : null;
  const rawTel1 = c?.telefone_1 ? `${c.ddd_1 ?? ""}${c.telefone_1}`.replace(/\D/g, "") : null;
  const endereco = c ? buildEndereco(c) : null;

  return (
    <div className="contato-panel">
      <h4>Contato</h4>

      <div className="contato-grid">
        {endereco && (
          <div className="contato-row contato-row--full">
            <span className="contato-label">Endereço</span>
            <a
              href={buildMapsUrl(c!)}
              target="_blank"
              rel="noopener noreferrer"
              className="contato-value contato-link"
            >
              {endereco}
              <span className="contato-link-arrow"> ↗</span>
            </a>
          </div>
        )}

        {telefone1 && rawTel1 && (
          <div className="contato-row">
            <span className="contato-label">Telefone</span>
            <a href={`tel:+55${rawTel1}`} className="contato-value contato-link">
              {telefone1}
            </a>
          </div>
        )}

        {telefone2 && (
          <div className="contato-row">
            <span className="contato-label">Telefone 2</span>
            <span className="contato-value">{telefone2}</span>
          </div>
        )}

        {c?.email && (
          <div className="contato-row contato-row--full">
            <span className="contato-label">Email</span>
            <a href={`mailto:${c.email}`} className="contato-value contato-link mono">
              {c.email}
            </a>
          </div>
        )}
      </div>

      <div className="contato-actions">
        <a
          href={buildLinkedInUrl(empresa, c)}
          target="_blank"
          rel="noopener noreferrer"
          className="contato-action-btn"
        >
          <LinkedInIcon /> LinkedIn
        </a>
        <a
          href={buildGoogleUrl(empresa, c)}
          target="_blank"
          rel="noopener noreferrer"
          className="contato-action-btn"
        >
          <GoogleIcon /> Google
        </a>
        {c && (
          <a
            href={buildMapsUrl(c)}
            target="_blank"
            rel="noopener noreferrer"
            className="contato-action-btn"
          >
            <MapsIcon /> Maps
          </a>
        )}
      </div>

      <p className="contato-caveat">
        Contato oficial do registro Receita Federal — frequentemente
        desatualizado ou do contador. Tratar como <em>ponto de partida</em>,
        não como canal validado.
      </p>

      <div className="lgpd-notice" role="note">
        <span className="lgpd-notice-label">LGPD · uso responsável</span>
        <span className="lgpd-notice-text">
          O contato pode pertencer a terceiro (contador, ex-sócio). Use
          exclusivamente para abordagem M&amp;A B2B legítima — vedado
          marketing em massa, cobrança ou qualquer finalidade discriminatória.{" "}
          <button type="button" className="lgpd-notice-link" onClick={openTermos}>
            Termos de Uso
          </button>{" "}
          ·{" "}
          <button type="button" className="lgpd-notice-link" onClick={openPrivacidade}>
            Privacidade
          </button>
        </span>
      </div>
    </div>
  );
}

// ── Ícones SVG (mantém zero-deps) ──────────────────────────────────

const LinkedInIcon = () => (
  <svg className="ca-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.5 18.5V10h-3v8.5h3zM7 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11.5 10v-5c0-2.5-1.5-3.5-3-3.5-1.3 0-2 .7-2.5 1.4V10h-3v8.5h3v-4.7c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5v4.7h2.5z" />
  </svg>
);

const GoogleIcon = () => (
  <svg className="ca-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const MapsIcon = () => (
  <svg className="ca-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
