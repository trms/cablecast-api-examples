<?php
/**
 * Cablecast live events for WordPress, built on `GET /cablecastapi/publicsitedata`.
 *
 * Drop this in your theme's functions.php or a small plugin, then use the
 * [cablecast_live_events] shortcode in any page or widget. It reads the site's
 * `showcaseEventShows`, uses the server-derived `showcaseEventStatus` on each
 * event, and lists what is live now and what is coming up.
 *
 * The transient keeps you inside the 15-second publicsitedata cache window, so a
 * burst of traffic does not turn into a burst of API calls.
 *
 * Set CABLECAST_API and CABLECAST_SITE_ID for your system. On a Reflect+ hosted
 * channel the base path is /api instead of /cablecastapi; the payload is the same.
 */

// Guarded so pasting this into functions.php alongside other config (or including
// it more than once) does not raise "constant already defined" warnings.
if ( ! defined( 'CABLECAST_API' ) ) {
	define( 'CABLECAST_API', 'https://cablecast.example.org/cablecastapi' );
}
if ( ! defined( 'CABLECAST_SITE_ID' ) ) {
	define( 'CABLECAST_SITE_ID', 1 );
}
if ( ! defined( 'CABLECAST_STARTING_SOON_THRESHOLD' ) ) {
	define( 'CABLECAST_STARTING_SOON_THRESHOLD', 15 * 60 ); // seconds
}

/**
 * Resolve the display status of one showcaseEventShows entry.
 *
 * Reads the server-derived `showcaseEventStatus` — an OPEN enum. Emitted today:
 * "live" | "upcoming" | "vod". Reserved for future use: "canceled" (event called
 * off, will not air) and "error" (event failed to stream) — both terminal,
 * not-live, nothing to play. Unrecognised values are treated defensively as
 * not-live. Only the near/far "starting soon" split is decided here, from
 * scheduleStartTime. Mirrors event-status.mjs.
 *
 * @return string one of live|starting_soon|upcoming|vod
 */
function cablecast_event_status( $show, $now = null ) {
	$now = $now ?? time();

	switch ( $show['showcaseEventStatus'] ?? null ) {
		case 'live':
			return 'live';
		case 'upcoming':
			if ( ! empty( $show['scheduleStartTime'] ) ) {
				$start = strtotime( $show['scheduleStartTime'] );
				if ( false !== $start ) {
					// "Starting soon" is a window around the scheduled start: within the
					// threshold before it, or just after it. A start far in the past is
					// not "soon", so leave it as plain "upcoming".
					$until_start = $start - $now;
					if ( $until_start <= CABLECAST_STARTING_SOON_THRESHOLD
						&& $until_start >= -CABLECAST_STARTING_SOON_THRESHOLD ) {
						return 'starting_soon';
					}
				}
			}
			return 'upcoming';
		default:
			// "vod", "canceled", "error", or anything unrecognised: not live.
			return 'vod';
	}
}

/**
 * Fetch the site's showcase event shows, cached for 15 seconds.
 *
 * @return array list of showcaseEventShows entries (may be empty)
 */
function cablecast_get_showcase_event_shows() {
	$cache_key = 'cablecast_showcase_shows';
	$cached    = get_transient( $cache_key );
	if ( false !== $cached ) {
		return $cached;
	}

	$url      = add_query_arg(
		array( 'site' => CABLECAST_SITE_ID ),
		// rtrim so a configured trailing slash doesn't produce a double slash in the path.
		rtrim( CABLECAST_API, '/' ) . '/publicsitedata'
	);
	$response = wp_remote_get( $url, array( 'timeout' => 5 ) );

	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		// The feed could not be read; fail soft so the page renders. Cache the empty
		// result for the same short window so an outage does not turn every page view
		// into another API call.
		set_transient( $cache_key, array(), 15 );
		return array();
	}

	$body  = json_decode( wp_remote_retrieve_body( $response ), true );
	$shows = isset( $body['showcaseEventShows'] ) ? $body['showcaseEventShows'] : array();

	set_transient( $cache_key, $shows, 15 );
	return $shows;
}

/**
 * [cablecast_live_events] - renders what is streaming now and what is next.
 */
function cablecast_live_events_shortcode() {
	$shows = cablecast_get_showcase_event_shows();

	$live     = array();
	$upcoming = array();
	foreach ( $shows as $show ) {
		$status = cablecast_event_status( $show );
		if ( 'live' === $status ) {
			$live[] = $show;
		} elseif ( 'starting_soon' === $status || 'upcoming' === $status ) {
			$upcoming[] = $show;
		}
	}

	if ( empty( $live ) && empty( $upcoming ) ) {
		return '<p>No live events scheduled right now.</p>';
	}

	// thumbnailUrl is a path relative to the Cablecast host. Strip whichever API base
	// path is configured — /cablecastapi on self-hosted, /api on Reflect+ — tolerating a
	// trailing slash in the configured value.
	$host = preg_replace( '#/(cablecastapi|api)$#', '', rtrim( CABLECAST_API, '/' ) );
	$out  = '<ul class="cablecast-events">';

	// Tag each row with its liveness from the bucket it was sorted into above, rather
	// than re-deriving it (or second-guessing it against isLive) here. cablecast_event_status
	// is the single source of truth, so a live event stays live even if isLive is absent.
	$rows = array();
	foreach ( $live as $show ) {
		$rows[] = array( $show, true );
	}
	foreach ( $upcoming as $show ) {
		$rows[] = array( $show, false );
	}

	foreach ( $rows as $row ) {
		list( $show, $is_live ) = $row;
		// scheduleStartTime can be missing or unparseable; guard so a bad entry does not
		// print the Unix epoch (or emit a notice) as the start time.
		$start = ! empty( $show['scheduleStartTime'] ) ? strtotime( $show['scheduleStartTime'] ) : false;
		$when  = $is_live
			? 'Live now'
			: ( false !== $start ? 'Starts ' . date_i18n( 'M j, g:i a', $start ) : 'Upcoming' );

		$out .= '<li>';
		if ( ! empty( $show['thumbnailUrl'] ) ) {
			$out .= sprintf( '<img src="%s" alt="" />', esc_url( $host . $show['thumbnailUrl'] ) );
		}
		$out .= sprintf(
			'<strong>%s</strong> <span>%s</span>',
			esc_html( $show['title'] ),
			esc_html( $when )
		);
		if ( $is_live && ! empty( $show['vodUrl'] ) ) {
			// vodUrl carries the live HLS manifest once the event is live.
			$out .= sprintf(
				'<div data-hls="%s" class="cablecast-player"></div>',
				esc_url( $show['vodUrl'] )
			);
		}
		$out .= '</li>';
	}

	return $out . '</ul>';
}
add_shortcode( 'cablecast_live_events', 'cablecast_live_events_shortcode' );
