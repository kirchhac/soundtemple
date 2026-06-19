// All recording audio, analysis JSON, 3D models, and frog research figures
// live in the `humbox-media` R2 bucket served at https://media.humbox.co.
// In dev the env var is unset, so paths fall through unchanged and the local
// `dashboard/public/{audio,data,models_*,frogs}` symlinks take over.
const BASE = (process.env.REACT_APP_MEDIA_BASE_URL || '').replace(/\/+$/, '');

export function mediaUrl(path: string): string {
  if (!BASE) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
}
