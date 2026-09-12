import { useEffect, useRef, useState } from "react";
import { board, keyLabel } from "./engine";
import { western, type Step } from "../curriculum";
import { startPianoNote } from "../audio";
export function TouchPiano({
  steps,
  onNote,
  onError,
}: {
  steps: Step[];
  onNote: (m: number) => void;
  onError: () => void;
}) {
  const keys = board(
      steps.flatMap((s) => [s, ...(s.chord || []).map((midi) => ({ midi }))]),
    ),
    held = useRef(new Map<string, { midi: number; release?: () => void }>()),
    callback = useRef(onNote);
  callback.current = onNote;
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const paint = () =>
    setPressed(new Set([...held.current.values()].map((v) => v.midi)));
  const up = (id: string) => {
    held.current.get(id)?.release?.();
    held.current.delete(id);
    paint();
  };
  const down = (id: string, midi: number) => {
    if (held.current.has(id)) return;
    const entry = { midi, release: undefined as undefined | (() => void) };
    held.current.set(id, entry);
    paint();
    callback.current(midi);
    void startPianoNote(midi)
      .then((release) => {
        if (held.current.get(id) === entry) entry.release = release;
        else release();
      })
      .catch(() => {
        up(id);
        onError();
      });
  };
  useEffect(() => {
    const reset = () => {
      held.current.forEach((v) => v.release?.());
      held.current.clear();
      setPressed(new Set());
    };
    const names = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];
    const whites = keys.filter((k) => k.white);
    const keydown = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      const i = names.indexOf(e.key.toLowerCase());
      if (i >= 0 && whites[i]) {
        e.preventDefault();
        down("key-" + e.code, whites[i].midi);
      }
    };
    const keyup = (e: KeyboardEvent) => up("key-" + e.code);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      reset();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [steps]);
  return (
    <div className="touch-piano-wrapper">
      <div
        className="game-piano touch-piano"
        dir="ltr"
        role="group"
        aria-label="پیانوی لمسی"
      >
        {keys.map((k) => (
          <button
            key={k.midi}
            aria-label={`کلید ${western(k.midi)}`}
            aria-pressed={pressed.has(k.midi)}
            className={
              (k.white ? "" : "black ") + (pressed.has(k.midi) ? "pressed" : "")
            }
            style={{ left: k.left + "%", width: k.width + "%" }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              down("pointer-" + e.pointerId, k.midi);
            }}
            onPointerUp={(e) => up("pointer-" + e.pointerId)}
            onPointerCancel={(e) => up("pointer-" + e.pointerId)}
            onLostPointerCapture={(e) => up("pointer-" + e.pointerId)}
            onClick={(e) => {
              if (e.detail === 0) {
                const id = "access-" + k.midi;
                down(id, k.midi);
                setTimeout(() => up(id), 250);
              }
            }}
          >
            <b>{keyLabel(k.midi)}</b>
            <small>{western(k.midi)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
