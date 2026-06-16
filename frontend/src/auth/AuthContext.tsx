/* ============================================================
   Auth · Context — sessão do usuário para o app E para a landing.

   Carrega /auth/config + /users/me na montagem e expõe as ações
   de conta. A mesma árvore serve as duas entries (index.html e
   landing.html) — cada uma envolve sua raiz com <AuthProvider/>.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "./api";
import type { AuthConfig, UserRead } from "./api";

export type AuthStatus = "loading" | "anon" | "authed";

export interface AuthContextValue {
  status: AuthStatus;
  user: UserRead | null;
  config: AuthConfig | null;
  /** Loga e devolve o usuário da sessão recém-aberta (ou null se algo falhou). */
  login: (email: string, password: string) => Promise<UserRead | null>;
  /** Cria a conta e abre sessão em seguida (login sem verificação é permitido). */
  register: (email: string, password: string) => Promise<UserRead>;
  logout: () => Promise<void>;
  /** Reconsulta /users/me e sincroniza o estado local. */
  refresh: () => Promise<UserRead | null>;
}

/** Assinatura vigente — active ou trialing liberam o radar. */
export function hasActiveSub(user: UserRead | null): boolean {
  return user?.subscription_status === "active" || user?.subscription_status === "trialing";
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserRead | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);

  const refresh = useCallback(async (): Promise<UserRead | null> => {
    const usuario = await api.me().catch(() => null);
    setUser(usuario);
    setStatus(usuario ? "authed" : "anon");
    return usuario;
  }, []);

  // config + sessão na montagem — status só sai de "loading" quando
  // os dois assentam (config null = backend indisponível: fail-open)
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [cfg, usuario] = await Promise.all([
        api.authConfig().catch(() => null),
        api.me().catch(() => null),
      ]);
      if (!vivo) return;
      setConfig(cfg);
      setUser(usuario);
      setStatus(usuario ? "authed" : "anon");
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<UserRead | null> => {
      await api.login(email, password);
      return refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (email: string, password: string): Promise<UserRead> => {
      const novo = await api.registrar(email, password);
      // abre sessão de imediato (permitido sem verificação) — garante o
      // reenvio do link e o checkout pós-verificação sem novo login
      try {
        await api.login(email, password);
        await refresh();
      } catch {
        /* sem sessão — o fluxo segue; o gate exige verificação de toda forma */
      }
      return novo;
    },
    [refresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, config, login, register, logout, refresh }),
    [status, user, config, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider/>.");
  return ctx;
}
