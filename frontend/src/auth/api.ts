/* ============================================================
   Auth · API — cliente tipado dos endpoints de conta e billing.

   Contrato único com o backend (fastapi-users + Stripe), montado
   sob /api/v1. Sessão via cookie HTTP-only (genesis_session) —
   o fetch é same-origin e o proxy do Vite cuida do resto.

   Erros viram AuthApiError com `code` (o detail do backend) e
   mensagem pt-BR amigável, pronta para a UI.
   ============================================================ */

const API_BASE = "/api/v1";

// ── tipos do contrato ─────────────────────────────────────────

export type PlanId = "sinal" | "varredura" | "mesa";
export type BillingCycle = "mensal" | "semestral" | "anual";
/** Planos self-serve no checkout — Mesa é venda assistida (mailto). */
export type CheckoutPlan = Exclude<PlanId, "mesa">;

export interface UserRead {
  id: string;
  email: string;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  subscription_status: string | null;
  plan_id: PlanId | null;
  billing_cycle: BillingCycle | null;
  current_period_end: string | null;
}

export interface AuthConfig {
  auth_required: boolean;
  require_subscription: boolean;
  billing_enabled: boolean;
}

export interface CheckoutResponse {
  url: string;
}

// ── erro tipado ───────────────────────────────────────────────

/** Mapa código → mensagem pt-BR amigável (tom da landing: direto, sem jargão). */
const MENSAGENS: Record<string, string> = {
  LOGIN_BAD_CREDENTIALS: "Email ou senha incorretos.",
  REGISTER_USER_ALREADY_EXISTS: "Já existe uma conta com este email.",
  REGISTER_INVALID_PASSWORD: "Senha inválida — use ao menos 8 caracteres.",
  VERIFY_USER_BAD_TOKEN: "Link de verificação inválido ou expirado — peça um novo.",
  VERIFY_USER_ALREADY_VERIFIED: "Este email já foi verificado — basta fazer login.",
  RESET_PASSWORD_BAD_TOKEN: "Link de redefinição inválido ou expirado — peça um novo.",
  EMAIL_NAO_VERIFICADO: "Confirme seu email antes de continuar.",
  NAO_AUTENTICADO: "Sua sessão expirou — faça login novamente.",
  ASSINATURA_NECESSARIA: "É preciso uma assinatura ativa para acessar o radar.",
  ASSINATURA_JA_ATIVA: "Você já tem uma assinatura ativa — gerencie seu plano no portal.",
  BILLING_INDISPONIVEL: "Pagamento ainda não habilitado neste ambiente.",
};

export class AuthApiError extends Error {
  /** Detail do backend (string) ou código sintético (HTTP_xxx / BILLING_INDISPONIVEL). */
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
  }
}

/** Lê o corpo de erro do backend e lança AuthApiError com mensagem amigável. */
async function lancarErro(res: Response): Promise<never> {
  let code = `HTTP_${res.status}`;
  let reason: string | undefined;
  try {
    const body: unknown = await res.json();
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      code = detail;
    } else if (detail && typeof detail === "object") {
      const d = detail as { code?: unknown; reason?: unknown };
      if (typeof d.code === "string") code = d.code;
      if (typeof d.reason === "string") reason = d.reason;
    }
  } catch {
    /* corpo não-JSON — fica o código sintético */
  }
  // 503 neste cliente (auth/billing) = Stripe não configurado no ambiente.
  // O backend manda um detail descritivo, mas a UI mostra a mensagem amigável.
  if (res.status === 503) code = "BILLING_INDISPONIVEL";
  const mensagem =
    MENSAGENS[code] ?? reason ?? "Algo deu errado. Tente novamente em instantes.";
  throw new AuthApiError(code, mensagem, res.status);
}

/** fetch same-origin com JSON — base de todos os endpoints daqui. */
async function pedir(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "same-origin", ...init });
  if (!res.ok) await lancarErro(res);
  return res;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ── auth (fastapi-users) ──────────────────────────────────────

/** POST /auth/register — cria a conta (não loga; login é permitido sem verificação). */
export async function registrar(email: string, password: string): Promise<UserRead> {
  const res = await pedir("/auth/register", jsonInit("POST", { email, password }));
  return res.json();
}

/**
 * POST /auth/login — ATENÇÃO: application/x-www-form-urlencoded com
 * campos `username`/`password` (contrato do fastapi-users). 204 + cookie.
 */
export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password });
  await pedir("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

/** POST /auth/logout — 204, limpa o cookie de sessão. */
export async function logout(): Promise<void> {
  await pedir("/auth/logout", { method: "POST" });
}

/** GET /users/me — usuário da sessão, ou null se não autenticado (401). */
export async function me(): Promise<UserRead | null> {
  const res = await fetch(`${API_BASE}/users/me`, { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) await lancarErro(res);
  return res.json();
}

/** POST /auth/request-verify-token — sempre 202 (sem enumeração de contas). */
export async function requestVerifyToken(email: string): Promise<void> {
  await pedir("/auth/request-verify-token", jsonInit("POST", { email }));
}

/** POST /auth/verify — confirma o email a partir do token do link. */
export async function verify(token: string): Promise<UserRead> {
  const res = await pedir("/auth/verify", jsonInit("POST", { token }));
  return res.json();
}

/** POST /auth/forgot-password — sempre 202 (sem enumeração de contas). */
export async function forgotPassword(email: string): Promise<void> {
  await pedir("/auth/forgot-password", jsonInit("POST", { email }));
}

/** POST /auth/reset-password — define a nova senha a partir do token do link. */
export async function resetPassword(token: string, password: string): Promise<void> {
  await pedir("/auth/reset-password", jsonInit("POST", { token, password }));
}

/** GET /auth/config — público; diz se o ambiente exige auth/assinatura/billing. */
export async function authConfig(): Promise<AuthConfig> {
  const res = await pedir("/auth/config");
  return res.json();
}

// ── billing (Stripe) ──────────────────────────────────────────

/** POST /billing/checkout — abre a sessão de checkout do plano/ciclo. */
export async function checkout(
  plan: CheckoutPlan,
  period: BillingCycle,
): Promise<CheckoutResponse> {
  const res = await pedir("/billing/checkout", jsonInit("POST", { plan, period }));
  return res.json();
}

/** POST /billing/portal — abre o Customer Portal do Stripe. */
export async function portal(): Promise<CheckoutResponse> {
  const res = await pedir("/billing/portal", { method: "POST" });
  return res.json();
}
