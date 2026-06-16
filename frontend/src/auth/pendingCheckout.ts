/* ============================================================
   Auth · Checkout pendente — plano escolhido antes do email
   verificar.

   O link de verificação chega por email e reabre a landing em
   outra carga de página — o plano escolhido precisa sobreviver
   a esse ciclo. localStorage, com validação ao ler.
   ============================================================ */

import type { BillingCycle, CheckoutPlan } from "./api";

export interface PendingCheckout {
  plan: CheckoutPlan;
  period: BillingCycle;
}

const CHAVE = "gr.checkout-pendente";

const PLANOS: readonly string[] = ["sinal", "varredura"];
const CICLOS: readonly string[] = ["mensal", "semestral", "anual"];

export function salvarPlanoPendente(p: PendingCheckout): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* storage indisponível (modo privado etc.) — o fluxo segue sem pendência */
  }
}

export function lerPlanoPendente(): PendingCheckout | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as { plan?: unknown; period?: unknown };
    if (
      typeof dado.plan === "string" &&
      PLANOS.includes(dado.plan) &&
      typeof dado.period === "string" &&
      CICLOS.includes(dado.period)
    ) {
      return { plan: dado.plan as CheckoutPlan, period: dado.period as BillingCycle };
    }
    return null;
  } catch {
    return null;
  }
}

export function limparPlanoPendente(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a limpar */
  }
}
