import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { AuthApiError, deleteAccount, portal, type PlanId } from "../../auth/api";

export type ViewMode = "dashboard" | "screener" | "watchlist";

interface Props {
  onOpenFilters: () => void;
  onOpenAISearch: () => void;
  onOpenMetodologia: () => void;
  totalEmpresas?: number;
  activeFilters: number;
  view: ViewMode;
  watchlistCount: number;
  onGoDashboard: () => void;
  onGoScreener: () => void;
  onGoWatchlist: () => void;
}

// rótulos pt-BR — plano e estado da assinatura (Stripe) na UI
const ROTULO_PLANO: Record<PlanId, string> = {
  sinal: "Sinal",
  varredura: "Varredura",
  mesa: "Mesa",
};
const ROTULO_ASSINATURA: Record<string, string> = {
  active: "assinatura ativa",
  trialing: "período de teste",
  past_due: "pagamento pendente",
  canceled: "assinatura cancelada",
  unpaid: "pagamento em aberto",
  incomplete: "assinatura incompleta",
};

const FilterIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const SearchIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const DashboardIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
  </svg>
);
const UserIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.7" />
    <path d="M5.2 20c0-3.9 3-6.4 6.8-6.4s6.8 2.5 6.8 6.4" />
  </svg>
);

/* ── conta — email, selo do plano e menu (portal Stripe · sair) ── */
function ContaMenu() {
  const { user, config, logout } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [busyPortal, setBusyPortal] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  // clique fora fecha o menu
  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  // cada abertura do menu começa sem erro antigo (não reaparece stale)
  useEffect(() => {
    if (aberto) setErro(null);
  }, [aberto]);

  if (!user) return null; // sem sessão (dev com auth desligada) — header segue limpo

  const abrirPortal = async () => {
    setBusyPortal(true);
    setErro(null);
    try {
      const { url } = await portal();
      window.location.href = url;
    } catch (err) {
      setErro(err instanceof AuthApiError ? err.message : "Não foi possível abrir o portal.");
      setBusyPortal(false);
    }
  };

  const sair = async () => {
    // logout pode 401 (sessão já expirada) — engolimos pra não perder o redirect
    await logout().catch(() => {});
    window.location.href = "/landing.html";
  };

  const excluirConta = async () => {
    if (
      !window.confirm(
        "Tem certeza? Isso apaga sua conta e seus dados de forma permanente. Esta ação não pode ser desfeita.",
      )
    )
      return;
    setBusyDelete(true);
    setErro(null);
    try {
      await deleteAccount();
    } catch (err) {
      setErro(err instanceof AuthApiError ? err.message : "Não foi possível excluir a conta.");
      setBusyDelete(false);
      return;
    }
    // conta apagada — o logout de rede pode 401 (usuário não existe mais);
    // engolimos e seguimos pro redirect.
    await logout().catch(() => {});
    window.location.href = "/landing.html";
  };

  return (
    <div className="acct" ref={raizRef}>
      <button
        type="button"
        className="header-btn"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        title="Conta"
      >
        <UserIcon />
        <span className="acct-email">{user.email}</span>
        {user.plan_id && <span className="acct-badge">{ROTULO_PLANO[user.plan_id]}</span>}
      </button>

      {aberto && (
        <div className="acct-menu" role="menu" aria-label="Conta">
          <div className="acct-menu__head">
            <span className="acct-menu__email">{user.email}</span>
            {user.subscription_status && (
              <span className="acct-menu__status">
                {ROTULO_ASSINATURA[user.subscription_status] ?? user.subscription_status}
              </span>
            )}
          </div>
          {config?.billing_enabled && user.subscription_status && (
            <button
              type="button"
              role="menuitem"
              className="acct-item"
              onClick={() => void abrirPortal()}
              disabled={busyPortal}
            >
              {busyPortal ? "Abrindo o portal…" : "Gerenciar assinatura"}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="acct-item acct-item--danger"
            onClick={() => void excluirConta()}
            disabled={busyDelete}
          >
            {busyDelete ? "Excluindo…" : "Excluir minha conta"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="acct-item acct-item--exit"
            onClick={() => void sair()}
          >
            Sair
          </button>
          {erro && <span className="acct-err">{erro}</span>}
        </div>
      )}
    </div>
  );
}

export default function Header({
  onOpenFilters,
  onOpenAISearch,
  onOpenMetodologia,
  totalEmpresas,
  activeFilters,
  view,
  watchlistCount,
  onGoDashboard,
  onGoScreener,
  onGoWatchlist,
}: Props) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo">Genesis <em>Radar</em></span>
        <span className="tag">M&amp;A · RJ/SP</span>
      </div>

      <nav className="header-nav" aria-label="Seções">
        <button type="button" data-active={view === "dashboard"} onClick={onGoDashboard}>Dashboard</button>
        <button type="button" data-active={view === "screener"} onClick={onGoScreener}>Screener</button>
        <button type="button" data-active={view === "watchlist"} onClick={onGoWatchlist}>
          Watchlist
          {watchlistCount > 0 && <span className="nav-count">{watchlistCount}</span>}
        </button>
      </nav>

      <div className="header-actions">
        {totalEmpresas !== undefined && (
          <span className="live-dot">
            UNIVERSO · {totalEmpresas.toLocaleString("pt-BR")}
          </span>
        )}

        <button className="header-btn ai-search-trigger" onClick={onOpenAISearch} title="Busca com IA · linguagem natural">
          ✦ Busca IA
        </button>

        <button className="header-btn" onClick={onOpenFilters}>
          <FilterIcon /> Filtros
          {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>

        <button className="header-btn" onClick={onOpenMetodologia}>
          Metodologia
        </button>

        {view === "screener" ? (
          <button className="header-btn cta" onClick={onGoDashboard}>
            <DashboardIcon /> Voltar ao dashboard
          </button>
        ) : (
          <button className="header-btn cta" onClick={onGoScreener}>
            <SearchIcon /> Pesquisar empresas
          </button>
        )}

        {/* conta — só aparece quando há sessão */}
        <ContaMenu />
      </div>
    </header>
  );
}
