// Anonymous gameplay events -> https://t.garand.dev -> SigNoz (dashboard "Puzzle Express").
// Only random ids and game metrics: never the profile name.
import { locale } from './i18n';
import { createTelemetry } from './telemetry';

export const telemetry = createTelemetry({
  service: 'puzzle-express',
  version: __APP_VERSION__,
  // Only the real site: no events from `vite dev`, previews or forks.
  enabled: import.meta.env.PROD && location.hostname === 'puzzle.garand.dev',
  common: { 'app.lang': locale() },
});
