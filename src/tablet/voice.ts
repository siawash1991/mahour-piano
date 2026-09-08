let active: HTMLAudioElement | null = null;
let endActive: (() => void) | null = null;
export function stopVoice() {
  active?.pause();
  active = null;
  endActive?.();
  endActive = null;
}
export function speakClip(name: string): Promise<boolean> {
  stopVoice();
  return new Promise((resolve) => {
    const a = new Audio(`/voice/${name}.mp3`);
    active = a;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (active === a) {
        active = null;
        endActive = null;
      }
      a.pause();
      resolve(ok);
    };
    const timeout = setTimeout(() => finish(false), 18000);
    endActive = () => finish(false);
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    a.play().catch(() => finish(false));
  });
}
