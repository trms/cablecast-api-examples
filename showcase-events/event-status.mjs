// Resolves the display status of a Showcase Event from a `showcaseEventShows`
// entry returned by `GET /cablecastapi/publicsitedata`.
//
// The server already decides the status and returns it as `showcaseEventStatus`:
// the platform applies the "is it really live / has the encoder come up" rules,
// and both self-hosted Cablecast and Reflect+ hosted channels emit the same
// values, so a third-party site behaves identically to a hosted channel. This
// helper just reads that field and adds the cosmetic near/far "starting soon"
// split, which is a client-side choice.

export const STARTING_SOON_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * @param {object} show   One entry from `config.showcaseEventShows`.
 * @param {number} [now]  Milliseconds since epoch; defaults to now. Injectable
 *                        so the same call is testable.
 * @returns {"live"|"starting_soon"|"upcoming"|"vod"}
 */
export function getEventStatus(show, now = Date.now()) {
  // `showcaseEventStatus` is an OPEN enum. Emitted today: "live" | "upcoming" |
  // "vod". Reserved for future use: "canceled" (event called off, will not air)
  // and "error" (event failed to stream) — both are terminal, not-live states
  // with nothing to play. Handle any value you don't recognise defensively by
  // treating it as not-live, so a new status can never break your integration.
  switch (show.showcaseEventStatus) {
    case "live":
      return "live";
    case "upcoming":
      return refineUpcoming(show, now);
    default:
      // "vod", "canceled", "error", or anything unrecognised: not live.
      return "vod";
  }
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
