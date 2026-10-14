// Tiny global signal: the preloader finished and intro animations may start.
let loaded = false;
const listeners = new Set<() => void>();

export function onLoaded(cb: () => void) {
  if (loaded) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setLoaded() {
  if (loaded) return;
  loaded = true;
  listeners.forEach((f) => f());
  listeners.clear();
}

export const isLoaded = () => loaded;
