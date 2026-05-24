import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_ENTRIES = 200;
const PERSISTENT_KEY = '@presellia_persistent_logs';

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

  constructor() {
    this.loadLogs();
  }

  private async loadLogs() {
    try {
      const raw = await AsyncStorage.getItem(PERSISTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LogEntry[];
        const merged = [...this.entries, ...parsed];
        const seen = new Set<string>();
        const deduped: LogEntry[] = [];
        for (const item of merged) {
          const key = `${item.ts}-${item.tag}-${item.msg}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }
        this.entries = deduped
          .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
          .slice(0, MAX_ENTRIES);
        this.listeners.forEach((fn) => fn());
      }
    } catch {}
  }

  private add(level: LogLevel, tag: string, msg: string) {
    const entry: LogEntry = { ts: new Date().toISOString(), level, tag, msg };
    this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES);
    this.listeners.forEach((fn) => fn());
    if (__DEV__) {
      const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
      // eslint-disable-next-line no-console
      console.log(`${prefix} [${tag}] ${msg}`);
    }

    if (level === 'error' || level === 'warn' || tag === 'push' || tag === 'api') {
      this.saveToStorage();
    }
  }

  private async saveToStorage() {
    try {
      const toSave = this.entries
        .filter((e) => e.level === 'error' || e.level === 'warn' || e.tag === 'push' || e.tag === 'api')
        .slice(0, 100);
      await AsyncStorage.setItem(PERSISTENT_KEY, JSON.stringify(toSave));
    } catch {}
  }

  info(tag: string, msg: string):  void { this.add('info',  tag, msg); }
  warn(tag: string, msg: string):  void { this.add('warn',  tag, msg); }
  error(tag: string, msg: string): void { this.add('error', tag, msg); }

  getEntries(): LogEntry[]  { return this.entries; }
  
  clear(): void { 
    this.entries = []; 
    this.listeners.forEach((fn) => fn()); 
    AsyncStorage.removeItem(PERSISTENT_KEY).catch(() => {});
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const logger = new Logger();
