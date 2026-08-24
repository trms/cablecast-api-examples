# Showcase Events (Internet Channel)

A **Showcase Event** promotes a live or upcoming stream so it can be featured
ahead of on-demand content. On a Cablecast Internet Channel they fill the "Live
Events" area of the home page. These examples let you build the same thing on
your own site.

## Read events from `publicsitedata`

Everything here is built on a single read-only, no-auth endpoint:

```
GET /cablecastapi/publicsitedata?site={siteId}
```

The response is the full configuration and content for one Internet Channel
site. The live and upcoming events live in the `showcaseEventShows` array, each
already resolved into a show with a title, thumbnail and playback URL:

```jsonc
{
  "liveGalleryTitle": "Live Events",
  "showcaseEventShows": [
    {
      "showId": 1187,
      "title": "City Council Meeting",
      "thumbnailUrl": "/cablecastapi/dynamicthumbnails/8821",
      "showcaseEventStatus": "live",
      "vodUrl": "https://vod.example.org/showcase-2/1187-showcase-event-42/event.m3u8",
      "isLive": true,
      "scheduleStartTime": "2026-08-19T18:00:00-04:00",
      "liveEventStarted": "2026-08-19T18:00:11-04:00",
      "liveBridgeEventStatus": "active"
    }
  ]
}
```

This is the same feed the Cablecast Internet Channel itself renders, so a site
built on it behaves identically to a hosted channel — **including Reflect+**. On
a Reflect+ hosted channel the base path is `/api` instead of `/cablecastapi`
(`GET /api/publicsitedata`); the payload shape is the same.

> Prefer `publicsitedata` for any third-party integration. It is the one showcase
> feed available on both self-hosted Cablecast and Reflect+ hosted channels.

## Event status

Each event carries a server-derived **`showcaseEventStatus`** — read that field
rather than working the status out yourself. The server already applies the
"is it really live / has the encoder come up" rules, and both self-hosted
Cablecast and Reflect+ emit the same values, so you don't have to reimplement any
of it.

| `showcaseEventStatus` | Meaning | Play `vodUrl`? |
|-----------------------|---------|----------------|
| `live` | Streaming now, and confirmed ready. `vodUrl` is the live EVENT playlist. | Yes |
| `upcoming` | Scheduled, not streaming yet. Use `scheduleStartTime` for a countdown or a "starting soon" treatment. | No — keep polling |
| `vod` | The event is over. | Only if a recording/VOD exists |

`showcaseEventStatus` is an **open enum**: only `live`/`upcoming`/`vod` are sent
today, but `canceled` and `error` are reserved and may appear in future. Handle
any value you don't recognise defensively — treat it as **not-live** (don't mount
a player), so a new status can never break your integration.

[`event-status.mjs`](./event-status.mjs) reads `showcaseEventStatus` and adds the
client-side `starting_soon` refinement (the near/far split, from
`scheduleStartTime`), returning `live | starting_soon | upcoming | vod`. It also
falls back to deriving the status from `isLive`/`liveBridgeEventStatus` for older
servers that don't send the field yet, so it's safe against any Cablecast
version. The other examples reuse it (and `wordpress.php` ports it to PHP).

## Files

| File | What it shows |
|------|---------------|
| [`event-status.mjs`](./event-status.mjs) | The status helper the other examples import. |
| [`browser-player.html`](./browser-player.html) | Fetch `publicsitedata`, poll every 15s, mount an HLS player when an event goes live. |
| [`wordpress.php`](./wordpress.php) | A `[cablecast_live_events]` WordPress shortcode listing what's live and upcoming. |
| [`iframe-embed.html`](./iframe-embed.html) | No-code option: iframe the Internet Channel show page and let it handle the whole lifecycle. |

## Playback notes

- `vodUrl` carries the live **EVENT** HLS playlist while an event is live, so
  late joiners can scrub back to the start, and the same URL keeps serving the
  recording for a while after the event ends. Treat post-event playback as best
  effort and handle a failed load.
- Turn on your player's live UI (in video.js, `liveui: true` with source type
  `application/x-mpegURL`) so the scrubber and "back to live" control appear.
- Captions and translated subtitle tracks travel inside the manifest as subtitle
  renditions; players pick them up automatically.
- Poll `publicsitedata` no faster than its 15-second cache. Stop polling once
  you've mounted the player — the manifest keeps the stream current on its own.
- For a durable on-demand copy after the event, the station publishes a normal
  VOD for the show, available through the usual `vods` endpoints.
