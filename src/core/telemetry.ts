// Tiny anonymous event client for https://t.garand.dev (public-ingest -> SigNoz).
// Copy this file into a project; no dependencies. Source of truth:
// osrs.cloud/infra/public-ingest/client/telemetry.ts
//
//   const t = createTelemetry({ service: 'my-app', version: '1.2.0', enabled: import.meta.env.PROD });
//   t.track('thing.done', { kind: 'x', duration_ms: 1234 });
//
// Every event carries player.id (random, per browser, localStorage) and session.id (per page load).
// Never put names, emails or free text in attributes. Events are sent in batches (fetch keepalive),
// on a timer and when the page is hidden. Failures are dropped silently.

type Attr = string | number | boolean | null | undefined;
type Attrs = Record<string, Attr>;

export interface TelemetryOptions {
  /** OTLP service.name: lowercase slug, e.g. "puzzle-express". */
  service: string;
  version?: string;
  enabled?: boolean;
  endpoint?: string;
  /** Attributes added to every event. */
  common?: Attrs;
}

export interface Telemetry {
  track(event: string, attrs?: Attrs): void;
  flush(): void;
  readonly playerId: string;
}

const PID_KEY = 'garand-telemetry:pid';

function rid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function playerId(): string {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) localStorage.setItem(PID_KEY, (id = rid()));
    return id;
  } catch {
    return rid();
  }
}

function value(v: Exclude<Attr, null | undefined>) {
  if (typeof v === 'boolean') return { boolValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { intValue: v } : { doubleValue: v };
  return { stringValue: v };
}

const kv = (attrs: Attrs) =>
  Object.entries(attrs)
    .filter((e): e is [string, Exclude<Attr, null | undefined>] => e[1] != null && !(typeof e[1] === 'number' && !Number.isFinite(e[1])))
    .map(([key, v]) => ({ key, value: value(v) }));

export function createTelemetry(o: TelemetryOptions): Telemetry {
  const pid = playerId();
  if (o.enabled === false || typeof fetch === 'undefined') return { track() {}, flush() {}, playerId: pid };

  const endpoint = o.endpoint ?? 'https://t.garand.dev/v1/logs';
  const session = rid();
  const resource = kv({ 'service.name': o.service, 'service.version': o.version });
  let queue: object[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!queue.length) return;
    const logRecords = queue;
    queue = [];
    const body = JSON.stringify({
      resourceLogs: [{ resource: { attributes: resource }, scopeLogs: [{ scope: { name: 'garand-telemetry' }, logRecords }] }],
    });
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' }).catch(
      () => {},
    );
  }

  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  addEventListener('pagehide', flush);

  return {
    playerId: pid,
    flush,
    track(event, attrs = {}) {
      queue.push({
        timeUnixNano: String(Date.now() * 1e6),
        attributes: kv({ ...o.common, ...attrs, 'event.name': event, 'player.id': pid, 'session.id': session }),
      });
      if (queue.length >= 20) flush();
      else timer ??= setTimeout(flush, 10_000);
    },
  };
}
