/* ============================================================
   AuthOverlay — conta e acesso, em camada sobre a landing.

   Coerente com a filosofia do Gateway: nada de troca de tela —
   um véu escuro e um cartão de papel sobre o campo do radar.
   Modos: login · signup · forgot · reset · verify-pending ·
   verify-confirm. Deep-linkável via ?auth=... (parse na Landing).

   O checkout pendente (plano escolhido antes do email verificar)
   chega via prop `pending`; quem dispara o checkout de fato é a
   Landing (prop `onCheckout`), dona do redirecionamento.
   ============================================================ */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import gsap from "gsap";
import { hasActiveSub, useAuth } from "../auth/AuthContext";
import {
  AuthApiError,
  forgotPassword,
  requestVerifyToken,
  resetPassword,
  verify,
  type BillingCycle,
  type CheckoutPlan,
} from "../auth/api";
import { limparPlanoPendente, type PendingCheckout } from "../auth/pendingCheckout";

export type AuthOverlayMode =
  | "login"
  | "signup"
  | "forgot"
  | "reset"
  | "verify-pending"
  | "verify-confirm";

interface AuthOverlayProps {
  mode: AuthOverlayMode;
  /** Token dos links de email (?auth=verify|reset&token=...). */
  token?: string | null;
  /** Plano + ciclo aguardando checkout (escolhido antes de verificar). */
  pending: PendingCheckout | null;
  onClose: () => void;
  /** Dispara o checkout do Stripe — a Landing cuida do redirect e dos erros. */
  onCheckout: (plan: CheckoutPlan, period: BillingCycle) => Promise<void>;
  /** Fecha o overlay e rola até os planos (Cap. 5). */
  onGoToPlans: () => void;
}

const ROTULO_PLANO: Record<CheckoutPlan, string> = {
  sinal: "Sinal",
  varredura: "Varredura",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function prefersReduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function validarEmail(v: string): string | null {
  return EMAIL_RE.test(v.trim()) ? null : "Informe um email válido.";
}

function validarSenha(v: string): string | null {
  return v.length >= 8 ? null : "A senha precisa de pelo menos 8 caracteres.";
}

function mensagemDe(err: unknown): string {
  if (err instanceof AuthApiError) return err.message;
  return "Não foi possível falar com o servidor. Tente novamente.";
}

export function AuthOverlay({
  mode: modeProp,
  token,
  pending,
  onClose,
  onCheckout,
  onGoToPlans,
}: AuthOverlayProps) {
  const { user, config, login, register, refresh } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const tituloId = "ax-titulo";

  // modo interno — segue o prop (a Landing pode trocar o modo por fora)
  const [mode, setMode] = useState<AuthOverlayMode>(modeProp);
  useEffect(() => setMode(modeProp), [modeProp]);

  // formulário
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [erroSenha2, setErroSenha2] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null); // erro do backend
  const [aviso, setAviso] = useState<string | null>(null); // notas de sucesso
  const [busy, setBusy] = useState(false);

  // verify-confirm — estado da confirmação do token
  const [confirmacao, setConfirmacao] = useState<"verificando" | "ok" | "erro">("verificando");

  const trocarModo = (novo: AuthOverlayMode, nota?: string) => {
    setMode(novo);
    setErro(null);
    setErroEmail(null);
    setErroSenha(null);
    setErroSenha2(null);
    setAviso(nota ?? null);
  };

  // email exibido/reenviado no verify-pending: o digitado ou o da sessão
  const emailVerificacao = email.trim() || user?.email || "";
  const billingLigado = config?.billing_enabled ?? false;

  // ── entrada — véu + cartão, no padrão do Gateway ─────────────
  useLayoutEffect(() => {
    if (prefersReduced()) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".ax-veil", { autoAlpha: 0, duration: 0.5 }, 0)
        .from(".ax-card", { autoAlpha: 0, y: 22, scale: 0.97, duration: 0.55 }, 0.08);
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── verify-confirm — confirma o token na montagem ────────────
  useEffect(() => {
    if (mode !== "verify-confirm") return;
    if (!token) {
      setConfirmacao("erro");
      setErro("Link de verificação inválido.");
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        await verify(token);
        const u = await refresh();
        if (!vivo) return;
        setConfirmacao("ok");
        // plano pendente + sessão verificada → checkout direto
        if (u && u.is_verified && pending && billingLigado) {
          await onCheckout(pending.plan, pending.period);
        }
      } catch (err) {
        if (!vivo) return;
        if (err instanceof AuthApiError && err.code === "VERIFY_USER_ALREADY_VERIFIED") {
          await refresh();
          setConfirmacao("ok");
          setAviso("Este email já estava verificado.");
        } else {
          setConfirmacao("erro");
          setErro(mensagemDe(err));
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // token/modo definem a confirmação; o resto é leitura pontual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);

  // ── submits ──────────────────────────────────────────────────

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    const eE = validarEmail(email);
    const eS = senha ? null : "Informe sua senha.";
    setErroEmail(eE);
    setErroSenha(eS);
    if (eE || eS) return;
    setBusy(true);
    setErro(null);
    try {
      const u = await login(email.trim(), senha);
      if (u && !u.is_verified) {
        trocarModo("verify-pending");
        return;
      }
      // assinante com plano pendente: nada de 2º checkout (409 no
      // backend) — descarta a pendência e segue para o app
      if (u && hasActiveSub(u)) {
        limparPlanoPendente();
      } else if (u && pending && billingLigado) {
        await onCheckout(pending.plan, pending.period);
        return;
      }
      if (u && config?.require_subscription && !hasActiveSub(u)) {
        onGoToPlans();
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e: FormEvent) => {
    e.preventDefault();
    const eE = validarEmail(email);
    const eS = validarSenha(senha);
    setErroEmail(eE);
    setErroSenha(eS);
    if (eE || eS) return;
    setBusy(true);
    setErro(null);
    try {
      await register(email.trim(), senha);
      trocarModo("verify-pending", "Conta criada — falta só confirmar o email.");
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    const eE = validarEmail(email);
    setErroEmail(eE);
    if (eE) return;
    setBusy(true);
    setErro(null);
    try {
      await forgotPassword(email.trim());
      setAviso("Se existir uma conta com este email, enviamos um link para redefinir a senha.");
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    const eS = validarSenha(senha);
    const eS2 = senha2 === senha ? null : "As senhas não coincidem.";
    setErroSenha(eS);
    setErroSenha2(eS2);
    if (eS || eS2) return;
    if (!token) {
      setErro("Link de redefinição inválido — peça um novo.");
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await resetPassword(token, senha);
      setSenha("");
      setSenha2("");
      trocarModo("login", "Senha redefinida — entre com a nova senha.");
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setBusy(false);
    }
  };

  const reenviarVerificacao = async () => {
    if (!emailVerificacao) {
      setErro("Informe o email da conta para reenviar o link.");
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await requestVerifyToken(emailVerificacao);
      setAviso("Link reenviado — confira sua caixa de entrada (e o spam).");
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setBusy(false);
    }
  };

  // ── blocos reutilizados ──────────────────────────────────────

  const campoEmail = (
    <div className={erroEmail ? "ax-field is-invalid" : "ax-field"}>
      <label className="ax-field__label" htmlFor="ax-email">
        Email
      </label>
      <input
        id="ax-email"
        className="ax-field__input"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (erroEmail) setErroEmail(null);
        }}
        autoFocus
      />
      {erroEmail && <span className="ax-field__err">{erroEmail}</span>}
    </div>
  );

  const campoSenha = (rotulo: string, autoComplete: string, focar = false) => (
    <div className={erroSenha ? "ax-field is-invalid" : "ax-field"}>
      <label className="ax-field__label" htmlFor="ax-senha">
        {rotulo}
      </label>
      <input
        id="ax-senha"
        className="ax-field__input"
        type="password"
        autoComplete={autoComplete}
        value={senha}
        onChange={(e) => {
          setSenha(e.target.value);
          if (erroSenha) setErroSenha(null);
        }}
        autoFocus={focar}
      />
      {erroSenha && <span className="ax-field__err">{erroSenha}</span>}
    </div>
  );

  const chipPlano = pending && (
    <span className="ax-plan">
      Plano escolhido: {ROTULO_PLANO[pending.plan]} · {pending.period}
    </span>
  );

  // cabeçalho por modo
  const cabecalho: Record<AuthOverlayMode, { eyebrow: string; titulo: string }> = {
    login: { eyebrow: "Acesso", titulo: "Entrar no radar" },
    signup: { eyebrow: "Cadastro", titulo: "Criar sua conta" },
    forgot: { eyebrow: "Recuperação", titulo: "Redefinir a senha" },
    reset: { eyebrow: "Recuperação", titulo: "Escolha a nova senha" },
    "verify-pending": { eyebrow: "Verificação", titulo: "Verifique seu email" },
    "verify-confirm": {
      eyebrow: "Verificação",
      titulo:
        confirmacao === "verificando"
          ? "Confirmando seu email…"
          : confirmacao === "ok"
            ? "Email verificado"
            : "Link inválido",
    },
  };

  return (
    <div className="ax-overlay" ref={rootRef}>
      <div className="ax-veil" onClick={onClose} aria-hidden="true" />

      <section className="ax-card" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <span className="ax-card__corner ax-card__corner--tl" aria-hidden="true" />
        <span className="ax-card__corner ax-card__corner--tr" aria-hidden="true" />
        <span className="ax-card__corner ax-card__corner--bl" aria-hidden="true" />
        <span className="ax-card__corner ax-card__corner--br" aria-hidden="true" />

        <button type="button" className="ax-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>

        <span className="ax-eyebrow">{cabecalho[mode].eyebrow}</span>
        <h2 className="ax-title" id={tituloId}>
          {cabecalho[mode].titulo}
        </h2>

        {aviso && (
          <p className="ax-notice" role="status">
            {aviso}
          </p>
        )}
        {erro && (
          <p className="ax-error" role="alert">
            {erro}
          </p>
        )}

        {/* ── login ─────────────────────────────────────────── */}
        {mode === "login" && (
          <form className="ax-form" onSubmit={submitLogin} noValidate>
            {chipPlano}
            {campoEmail}
            {campoSenha("Senha", "current-password")}
            <button type="submit" className="ax-submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <div className="ax-alt">
              <button type="button" className="ax-link" onClick={() => trocarModo("forgot")}>
                Esqueci a senha
              </button>
              <button type="button" className="ax-link" onClick={() => trocarModo("signup")}>
                Criar conta
              </button>
            </div>
          </form>
        )}

        {/* ── signup ────────────────────────────────────────── */}
        {mode === "signup" && (
          <form className="ax-form" onSubmit={submitSignup} noValidate>
            {chipPlano}
            {campoEmail}
            {campoSenha("Senha · mínimo 8 caracteres", "new-password")}
            <button type="submit" className="ax-submit" disabled={busy}>
              {busy ? "Criando…" : "Criar conta"}
            </button>
            <div className="ax-alt">
              <button type="button" className="ax-link" onClick={() => trocarModo("login")}>
                Já tenho conta
              </button>
            </div>
          </form>
        )}

        {/* ── forgot ────────────────────────────────────────── */}
        {mode === "forgot" && (
          <form className="ax-form" onSubmit={submitForgot} noValidate>
            <p className="ax-sub">
              Informe o email da conta — enviamos um link para escolher uma nova senha.
            </p>
            {campoEmail}
            <button type="submit" className="ax-submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviar link"}
            </button>
            <div className="ax-alt">
              <button type="button" className="ax-link" onClick={() => trocarModo("login")}>
                Voltar ao login
              </button>
            </div>
          </form>
        )}

        {/* ── reset ─────────────────────────────────────────── */}
        {mode === "reset" && (
          <form className="ax-form" onSubmit={submitReset} noValidate>
            {campoSenha("Nova senha · mínimo 8 caracteres", "new-password", true)}
            <div className={erroSenha2 ? "ax-field is-invalid" : "ax-field"}>
              <label className="ax-field__label" htmlFor="ax-senha2">
                Confirme a nova senha
              </label>
              <input
                id="ax-senha2"
                className="ax-field__input"
                type="password"
                autoComplete="new-password"
                value={senha2}
                onChange={(e) => {
                  setSenha2(e.target.value);
                  if (erroSenha2) setErroSenha2(null);
                }}
              />
              {erroSenha2 && <span className="ax-field__err">{erroSenha2}</span>}
            </div>
            <button type="submit" className="ax-submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
            <div className="ax-alt">
              <button type="button" className="ax-link" onClick={() => trocarModo("forgot")}>
                Pedir um novo link
              </button>
            </div>
          </form>
        )}

        {/* ── verify-pending ────────────────────────────────── */}
        {mode === "verify-pending" && (
          <div className="ax-form">
            <p className="ax-sub">
              {emailVerificacao ? (
                <>
                  Enviamos um link de verificação para{" "}
                  <strong className="ax-em">{emailVerificacao}</strong>. Abra o email e clique no
                  link para ativar sua conta.
                </>
              ) : (
                <>Enviamos um link de verificação para o email da sua conta.</>
              )}
            </p>
            {pending && (
              <p className="ax-sub ax-sub--mono">
                Assim que o email for verificado, seguimos direto para o checkout do plano{" "}
                {ROTULO_PLANO[pending.plan]} ({pending.period}).
              </p>
            )}
            <button
              type="button"
              className="ax-submit"
              onClick={() => void reenviarVerificacao()}
              disabled={busy}
            >
              {busy ? "Reenviando…" : "Reenviar o link"}
            </button>
            <div className="ax-alt">
              <button type="button" className="ax-link" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* ── verify-confirm ────────────────────────────────── */}
        {mode === "verify-confirm" && (
          <div className="ax-form">
            {confirmacao === "verificando" && (
              <p className="ax-status" role="status">
                Confirmando o link de verificação…
              </p>
            )}

            {confirmacao === "ok" && (
              <>
                <p className="ax-sub">Tudo certo — sua conta está verificada.</p>
                {user ? (
                  config?.require_subscription && !hasActiveSub(user) ? (
                    <button type="button" className="ax-submit" onClick={onGoToPlans}>
                      Ver os planos
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ax-submit"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Abrir o radar
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="ax-submit"
                    onClick={() => trocarModo("login", "Email verificado — entre para continuar.")}
                  >
                    Fazer login
                  </button>
                )}
              </>
            )}

            {confirmacao === "erro" && (
              <>
                <p className="ax-sub">
                  O link pode ter expirado. Peça um novo abaixo — ou faça login, se a conta já
                  estiver verificada.
                </p>
                {/* sem sessão não sabemos o email — pedimos para reenviar */}
                {!user?.email && campoEmail}
                <button
                  type="button"
                  className="ax-submit"
                  onClick={() => void reenviarVerificacao()}
                  disabled={busy}
                >
                  {busy ? "Reenviando…" : "Reenviar o link"}
                </button>
                <div className="ax-alt">
                  <button type="button" className="ax-link" onClick={() => trocarModo("login")}>
                    Fazer login
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
