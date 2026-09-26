import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { readAttempts, saveAttempts, type Attempt } from "./storage";
import "./style.css";
import { RhythmGame } from "./game/RhythmGame";
import { HarmonicaGame } from "./harmonica/HarmonicaGame";
import { Parents } from "./Parents";

type View = "piano" | "harmonica" | "parents";

export function App() {
  const [view, setView] = useState<View>("piano"),
    // The instrument the child was on, so the parent panel sends them back to it.
    [child, setChild] = useState<"piano" | "harmonica">("piano"),
    [attempts, setAttempts] = useState(readAttempts);
  const save = (a: Attempt) =>
    setAttempts((prev) => {
      const list = [...prev, a].slice(-1000);
      saveAttempts(list);
      return list;
    });
  const go = (v: View) => {
    if (v !== "parents") setChild(v);
    setView(v);
    scrollTo?.(0, 0);
  };
  if (view === "parents") return <Parents attempts={attempts} onBack={() => go(child)} />;
  if (view === "harmonica")
    return <HarmonicaGame onPiano={() => go("piano")} onParents={() => go("parents")} onSave={save} />;
  return <RhythmGame onExit={() => go("parents")} onHarmonica={() => go("harmonica")} onSave={save} />;
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
