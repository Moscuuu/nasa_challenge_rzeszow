export default function App() {
  return (
    <div className="layout">
      <header>
        <h1>Analog Finder</h1>
      </header>
      <section data-slot="mars" />
      <section data-slot="soil" />
      <section data-slot="earth" />
      <aside data-slot="card" />
    </div>
  );
}
