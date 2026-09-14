// Shared configuration for the showcase-events browser examples
// (events-gallery.html + browser-player.html).
//
// Keeping it in one module means the API host is set once, not copy-pasted into
// every page. Set API_BASE and SITE_ID for your system:
//   - Self-hosted Cablecast: https://your-server.example.org/cablecastapi
//   - Reflect+ hosted:       your Reflect+ channel origin + /api  (path is /api,
//                            not /cablecastapi; the payload shape is identical)

export const API_BASE = "https://cablecast.example.org/cablecastapi";
export const SITE_ID = 1;
export const POLL_MS = 15000; // matches the 15s publicsitedata cache

/** URL of the publicsitedata feed for the configured site. */
export const publicSiteDataUrl = () =>
  `${API_BASE}/publicsitedata?site=${SITE_ID}`;

// `thumbnailUrl` (and other asset paths) come back relative to the Cablecast
// host, so prefix them with the origin of API_BASE. An already-absolute URL is
// returned unchanged.
const apiOrigin = new URL(API_BASE).origin;
export const absolute = (path) =>
  path ? (path.startsWith("http") ? path : apiOrigin + path) : "";
