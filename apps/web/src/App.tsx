import { SCAFFOLD_READY } from "@buzzer/shared";

export const App = () => (
  <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
    <h1>Buzzer</h1>
    <p>Scaffold ready: {String(SCAFFOLD_READY)}</p>
  </div>
);
