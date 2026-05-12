import AgentRoom from "../components/AgentRoom/AgentRoom";

export default function Home() {
  return (
    <main className="container">
      <h1>DealFlow BR</h1>
      <p>Triagem M&amp;A médio porte RJ/SP — 60k empresas single-plant.</p>
      <AgentRoom />
      {/* TODO: <FilterPanel /> + <ResultsTable /> */}
    </main>
  );
}
