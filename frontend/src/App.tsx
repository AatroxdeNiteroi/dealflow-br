/* ============================================================
   App — raiz do radar (index.html), agora atrás do portão de
   autenticação.

   O portão respeita o /auth/config do ambiente:
   - auth_required=false (default, dev) → app normal, sem atrito;
   - auth_required=true → exige sessão de usuário ativo e email
     verificado; require_subscription soma a exigência de
     assinatura active/trialing.
   Quem não passa volta para a landing (login ou planos).
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, hasActiveSub, useAuth } from "./auth/AuthContext";
import { requestVerifyToken } from "./auth/api";
import { LegalProvider } from "./legal/LegalProvider";
import Home from "./pages/Home";

/** Véu minimalista — segura a tela enquanto config + sessão carregam. */
function VeuCarregando() {
  return (
    <div className="gate-veil" role="status">
      <span className="gate-veil__dot" aria-hidden="true" />
      <span className="gate-veil__txt">carregando o radar…</span>
    </div>
  );
}

/** Sessão aberta, email ainda não verificado — bloqueia com saída honesta. */
function TelaVerifiqueEmail() {
  const { user, logout, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  const reenviar = async () => {
    if (!user?.email) return;
    setBusy(true);
    setNota(null);
    try {
      await requestVerifyToken(user.email);
      setNota("Link reenviado — confira sua caixa de entrada (e o spam).");
    } catch {
      setNota("Não foi possível reenviar agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  };

  const sair = async () => {
    await logout();
    window.location.href = "/landing.html";
  };

  return (
    <div className="gate-verify">
      <div className="gate-verify__card">
        <span className="gate-verify__eyebrow">Verificação</span>
        <h1 className="gate-verify__title">Verifique seu email</h1>
        <p className="gate-verify__txt">
          Enviamos um link de verificação para{" "}
          <strong>{user?.email ?? "o email da sua conta"}</strong>. Abra o email e clique no link
          para liberar o radar.
        </p>
        {nota && (
          <p className="gate-verify__note" role="status">
            {nota}
          </p>
        )}
        <div className="gate-verify__actions">
          <button
            type="button"
            className="header-btn primary"
            onClick={() => void reenviar()}
            disabled={busy}
          >
            {busy ? "Reenviando…" : "Reenviar o link"}
          </button>
          <button type="button" className="header-btn" onClick={() => void refresh()}>
            Já verifiquei
          </button>
          <button type="button" className="header-btn" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

/** Banner sutil pós-checkout — ?checkout=sucesso na URL do app. */
function BannerCheckout() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("checkout") !== "sucesso") return;
    setVisivel(true);
    // limpa a query — o banner não deve reaparecer em refresh
    window.history.replaceState(null, "", window.location.pathname);
    const id = window.setTimeout(() => setVisivel(false), 8000);
    return () => window.clearTimeout(id);
  }, []);

  if (!visivel) return null;
  return (
    <div className="welcome-banner" role="status">
      <span>Assinatura confirmada — bem-vindo ao radar.</span>
      <button type="button" onClick={() => setVisivel(false)} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  );
}

/** Portão do app — decide entre véu, redirecionamento e o radar em si. */
function PortaoDoApp({ children }: { children: ReactNode }) {
  const { status, user, config } = useAuth();

  // config + sessão ainda assentando → véu mínimo, sem flash de conteúdo
  if (status === "loading") return <VeuCarregando />;

  // sem exigência de auth (default dev) ou backend indisponível → app normal
  if (!config || !config.auth_required) return <>{children}</>;

  if (status === "anon" || !user) {
    window.location.replace("/landing.html?auth=login");
    return <VeuCarregando />;
  }
  if (!user.is_verified) return <TelaVerifiqueEmail />;
  if (config.require_subscription && !hasActiveSub(user)) {
    window.location.replace("/landing.html?auth=plans");
    return <VeuCarregando />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <PortaoDoApp>
        <BannerCheckout />
        <LegalProvider>
          <Home />
        </LegalProvider>
      </PortaoDoApp>
    </AuthProvider>
  );
}
