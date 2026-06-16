import ReactDOM from "react-dom/client";

// Fontes self-hosted — mesma política LGPD do app (sem CDN do Google Fonts).
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

// Tokens do produto (paleta papel, fontes, reset), depois os estilos da
// landing — que sobrescrevem o `overflow:hidden` global do tokens.
import "../styles/modules/tokens.css";
import "./landing.css";
import "./gateway.css";
// overlay de conta/acesso (login · cadastro · verificação · reset)
import "./auth-overlay.css";
// modais legais (Termos / Privacidade) reaproveitados no footer da landing
import "../styles/modules/modals.css";
import "../styles/modules/legal.css";

import { AuthProvider } from "../auth/AuthContext";
import { App } from "./App";

// Sem StrictMode: a landing é majoritariamente imperativa (WebGL + GSAP +
// Lenis); o double-mount do StrictMode não agrega segurança aqui.
ReactDOM.createRoot(document.getElementById("landing-root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
