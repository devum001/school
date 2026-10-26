type Entry = { promise: Promise<unknown>; expiresAt: number; pending: boolean };
const cancelled = () => new DOMException('Request cancelled', 'AbortError');

// Memory only. Component cancellation detaches a reader, not the shared network request.
export class ReadCache {
  private entries = new Map<string, Entry>();
  private generation = 0;
  private scope = 0;
  constructor(
    private ttlMs = 30000,
    private limit = 100,
  ) {}

  clear() {
    this.scope++;
    this.invalidate();
  }

  invalidate() {
    this.generation++;
    this.entries.clear();
  }

  read<T>(key: string, load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(cancelled());
    let entry = this.entries.get(key);
    if (entry && !entry.pending && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      const generation = this.generation;
      const scope = this.scope;
      const created: Entry = { promise: Promise.resolve(), pending: true, expiresAt: 0 };
      created.promise = Promise.resolve()
        .then(load)
        .then((data) => {
          // Never deliver a previous account's response. A data mutation revalidates reads.
          if (scope !== this.scope) throw cancelled();
          if (generation !== this.generation) return this.read(key, load);
          created.pending = false;
          created.expiresAt = Date.now() + this.ttlMs;
          return data;
        })
        .catch((error: unknown) => {
          if (this.entries.get(key) === created) this.entries.delete(key);
          throw error;
        });
      this.entries.set(key, created);
      while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
      entry = created;
    }
    const promise = entry.promise as Promise<T>;
    if (!signal) return promise;
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(cancelled());
      signal.addEventListener('abort', abort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener('abort', abort);
          if (!signal.aborted) resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      );
    });
  }
}
