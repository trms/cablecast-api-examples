<?php
/**
 * Cablecast live events for WordPress, built on `GET /cablecastapi/publicsitedata`.
 *
 * Drop this in your theme's functions.php or a small plugin, then use the
 * [cablecast_live_events] shortcode in any page or widget. It reads the site's
 * `showcaseEventShows`, derives each event's status the same way the Cablecast
 * Internet Channel does, and lists what is live now and what is coming up.
 *
 * The transient keeps you inside the 15-second publicsitedata cache window, so a
 * burst of traffic does not turn into a burst of API calls.
 *
 * Set CABLECAST_API and CABLECAST_SITE_ID for your system. On a Reflect+ hosted
 * channel the base path is /api instead of /cablecastapi; the payload is the same.
 */

define( 'CABLECAST_API', 'https://cablecast.example.org/cablecastapi' );
define( 'CABLECAST_SITE_ID', 1 );

const CABLECAST_STARTING_SOON_THRESHOLD = 15 * 60; // seconds

/**
 * Derive the display status of one showcaseEventShows entry.
 * Mirrors event-status.mjs — see that file for the reasoning behind each branch.
 *
 * @return string one of live|starting_soon|upcoming|vod
 */
function cablecast_event_status( $show, $now = null ) {
	$now           = $now ?? time();
	$bridge_status = isset( $show['liveBridgeEventStatus'] )
		? strtolower( (string) $show['liveBridgeEventStatus'] )
		: null;

	$event_url = ( $show['vodUrl'] ?? '' ) . ' ' . ( $show['liveStreamUrl'] ?? '' );
	$is_livebridge_stream =
		preg_match( '#/livebridge#i', $event_url ) && ! preg_match( '#/showcase#i', $event_url );

	if ( ! empty( $show['isLive'] ) && ! $is_livebridge_stream ) {
		return 'live';
	}
	if ( 'active' === $bridge_status ) {
		return 'live';
	}

	if ( ! empty( $show['scheduleStartTime'] ) ) {
		$start = strtotime( $show['scheduleStartTime'] );
		if ( false !== $start ) {
			if ( $start > $now ) {
				return ( $start - $now ) <= CABLECAST_STARTING_SOON_THRESHOLD
					? 'starting_soon'
					: 'upcoming';
			}
			if ( 'scheduled' === $bridge_status || 'starting' === $bridge_status ) {
				return 'starting_soon';
			}
			if ( ( $now - $start ) <= CABLECAST_STARTING_SOON_THRESHOLD ) {
				return 'starting_soon';
			}
		}
		return 'vod';
	}

	return 'vod';
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
		CABLECAST_API . '/publicsitedata'
	);
	$response = wp_remote_get( $url, array( 'timeout' => 5 ) );

	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		// Non-200 means the feed could not be read; fail soft so the page renders.
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

	// thumbnailUrl is a path relative to the Cablecast host.
	$host = preg_replace( '#/cablecastapi$#', '', CABLECAST_API );
	$out  = '<ul class="cablecast-events">';

	foreach ( array_merge( $live, $upcoming ) as $show ) {
		$is_live = ! empty( $show['isLive'] ) && cablecast_event_status( $show ) === 'live';
		$when    = $is_live
			? 'Live now'
			: 'Starts ' . date_i18n( 'M j, g:i a', strtotime( $show['scheduleStartTime'] ) );

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
