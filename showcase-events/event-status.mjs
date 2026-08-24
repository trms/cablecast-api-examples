// Resolves the display status of a Showcase Event from a `showcaseEventShows`
// entry returned by `GET /cablecastapi/publicsitedata`.
//
// Prefer the server-derived `showcaseEventStatus` field: the platform already
// applies the "is it really live / has the encoder come up" rules, and both
// self-hosted Cablecast and Reflect+ hosted channels emit the same values, so a
// third-party site behaves identically to a hosted channel. This helper reads
// that field and adds only the cosmetic near/far "starting soon" split, which is
// a client-side choice. For older servers that predate the field it falls back
// to deriving the status from `isLive`/`scheduleStartTime`/`liveBridgeEventStatus`.

export const STARTING_SOON_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * @param {object} show   One entry from `config.showcaseEventShows`.
 * @param {number} [now]  Milliseconds since epoch; defaults to now. Injectable
 *                        so the same call is testable.
 * @returns {"live"|"starting_soon"|"upcoming"|"vod"}
 */
export function getEventStatus(show, now = Date.now()) {
  // `showcaseEventStatus` is an OPEN enum: "live" | "upcoming" | "vod" today,
  // with "canceled"/"error" reserved for future use. Handle unrecognised values
  // defensively — never assume an unknown value means live.
  const serverStatus = show.showcaseEventStatus;
  if (serverStatus) {
    if (serverStatus === "live") return "live";
    if (serverStatus === "upcoming") return refineUpcoming(show, now);
    // "vod", plus any reserved/unknown value: treat as not-live.
    return "vod";
  }

  return deriveEventStatus(show, now);
}

/**
 * Turns the server's `upcoming` into the near/far split the UI wants. The server
 * only ever sends `upcoming`; whether to show a "starting soon" treatment is a
 * client decision made here from `scheduleStartTime`.
 */
function refineUpcoming(show, now) {
  if (show.scheduleStartTime) {
    const startTime = new Date(show.scheduleStartTime).getTime();
    if (!Number.isNaN(startTime) && startTime - now <= STARTING_SOON_THRESHOLD_MS) {
      return "starting_soon";
    }
  }
  return "upcoming";
}

/**
 * Fallback for older Cablecast servers that don't send `showcaseEventStatus`
 * yet. Mirrors the logic the Internet Channel used before the field existed.
 * Once every deployment sends the field, this can be deleted.
 */
export function deriveEventStatus(show, now = Date.now()) {
  const bridgeStatus = show.liveBridgeEventStatus?.toLowerCase() ?? null;

  // How aggressively we trust `isLive` to mean "ready to play" depends on the
  // stream URL:
  // - /showcase recordings publish their EVENT playlist as soon as isLive
  //   flips, so isLive alone is a safe ready signal.
  // - /livebridge streams only serve a manifest once the encoder is up, which
  //   LiveBridge reports as status "active". isLive can flip true before any
  //   segments exist, so mounting a player on isLive alone would 404. For those,
  //   require "active".
  const eventUrl = `${show.vodUrl ?? ""} ${show.liveStreamUrl ?? ""}`;
  const isLiveBridgeStream =
    /\/livebridge/i.test(eventUrl) && !/\/showcase/i.test(eventUrl);

  if (show.isLive && !isLiveBridgeStream) return "live";

  // "active" means the encoder is up and the manifest is serving — the ready
  // signal for /livebridge streams, and an override for a stale isLive=false
  // from a cached /showcase response.
  if (bridgeStatus === "active") return "live";

  if (show.scheduleStartTime) {
    const startTime = new Date(show.scheduleStartTime).getTime();
    if (!Number.isNaN(startTime)) {
      if (startTime > now) {
        return startTime - now <= STARTING_SOON_THRESHOLD_MS
          ? "starting_soon"
          : "upcoming";
      }
      // Scheduled start has passed but the stream is not confirmed live yet.
      // Keep it "starting soon" (rather than dropping to "vod") while LiveBridge
      // still reports scheduled/starting, or inside a 15-minute grace window.
      if (bridgeStatus === "scheduled" || bridgeStatus === "starting") {
        return "starting_soon";
      }
      if (now - startTime <= STARTING_SOON_THRESHOLD_MS) {
        return "starting_soon";
      }
    }
    return "vod";
  }

  return "vod";
}
