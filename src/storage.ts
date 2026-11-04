// Everything a player keeps lives on their own device. Private windows can
// refuse storage, so every read and write is allowed to fail quietly.
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`pc.${key}`);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(`pc.${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
