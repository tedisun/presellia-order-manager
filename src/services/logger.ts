// Service de log en mémoire — ring buffer de MAX_ENTRIES entrées.
// Utilisé pour le diagnostic push/API sans dépendance externe.

const MAX_ENTRIES = 200;

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts:    string;
  level: LogLevel;
  tag:   string;
  msg:   string;
}

class Logger {
  private entries:   LogEntry[] = [];
  private listeners: Set<() => void> = new Set();

  private add(level: LogLevel, tag: string, msg: string) {
    const entry: LogEntry = { ts: new Date().toISOString(), level, tag, msg };
    this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES);
    this.listeners.forEach((fn) => fn());
    if (__DEV__) {
      const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
      // eslint-disable-next-line no-console
      console.log(`${prefix} [${tag}] ${msg}`);
    }
  }

  info(tag: string, msg: string):  void { this.add('info',  tag, msg); }
  warn(tag: string, msg: string):  void { this.add('warn',  tag, msg); }
  error(tag: string, msg: string): void { this.add('error', tag, msg); }

  getEntries(): LogEntry[]  { return this.entries; }
  clear():      void        { this.entries = []; this.listeners.forEach((fn) => fn()); }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const logger = new Logger();
