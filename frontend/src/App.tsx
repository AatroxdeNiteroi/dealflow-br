import { LegalProvider } from "./legal/LegalProvider";
import Home from "./pages/Home";

export default function App() {
  return (
    <LegalProvider>
      <Home />
    </LegalProvider>
  );
}
