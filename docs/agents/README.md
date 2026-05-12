# Agentes

8 agentes especializados, organizados em 3 turmas. Cada um tem cartilha aqui.

## Motor (3) — pipeline de dados

| Agente | Persona | Cartilha |
|---|---|---|
| 🕵️ **MATCHER** | Detetive | [matcher.md](matcher.md) |
| 🧮 **ESTIMATOR** | Contador | [estimator.md](estimator.md) |
| 🦉 **ARCHETYPIST** | Naturalista | [archetypist.md](archetypist.md) |

## Produto (3) — interface

| Agente | Persona | Cartilha |
|---|---|---|
| 🎨 **DESIGNER** | Pintor | [designer.md](designer.md) |
| 🔨 **FRONTEND** | Carpinteiro | [frontend.md](frontend.md) |
| 🔧 **BACKEND** | Encanador | [backend.md](backend.md) |

## Suporte (2) — qualidade

| Agente | Persona | Cartilha |
|---|---|---|
| 📚 **ARCHIVIST** | Bibliotecário | [archivist.md](archivist.md) |
| 📋 **AUDITOR** | Inspetor | [auditor.md](auditor.md) |

## Fluxo

```
ARCHIVIST orienta documentação
       ↓
MATCHER → ESTIMATOR → ARCHETYPIST       (motor)
       ↓
BACKEND ← expõe API REST + SSE
       ↑
FRONTEND ← consome API, renderiza
       ↑
DESIGNER → define sprites e layout
       ↓
AUDITOR valida ponta-a-ponta
```

Cada cartilha tem: função, persona pixel art, inputs, outputs, definition of done, dependências, **não faz**.
