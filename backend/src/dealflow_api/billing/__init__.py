"""Billing · Stripe Checkout + Customer Portal + webhook de assinatura.

Degradação graciosa (mesmo padrão de data/protestos.py): sem
DEALFLOW_STRIPE_SECRET_KEY, checkout/portal respondem 503; sem
DEALFLOW_STRIPE_WEBHOOK_SECRET, o webhook responde 503.

Preços: lookup_keys "{plan}_{period}" criados por scripts/stripe_seed.py.
Ver docs/site-architecture.md (Fase D) para o contrato completo.
"""
