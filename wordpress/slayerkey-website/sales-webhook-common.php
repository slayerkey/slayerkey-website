<?php
/**
 * Shared helpers for the Slayerkey sales webhooks.
 *
 * This file is loaded by the standalone Stripe and Whop webhook endpoints.
 * Webhook signing secrets are stored in non-autoloaded WordPress options and
 * are never committed to GitHub or sent to PostHog.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function slayerkey_sales_secret_option_name( $provider ) {
    if ( 'stripe' === $provider ) {
        return 'slayerkey_stripe_webhook_secret';
    }

    if ( 'whop' === $provider ) {
        return 'slayerkey_whop_webhook_secret';
    }

    return '';
}

function slayerkey_sales_get_secret( $provider ) {
    $option_name = slayerkey_sales_secret_option_name( $provider );

    if ( '' === $option_name ) {
        return '';
    }

    $value = get_option( $option_name, '' );

    return is_string( $value ) ? trim( $value ) : '';
}

function slayerkey_sales_get_whop_api_key() {
    $value = get_option( 'slayerkey_whop_api_key', '' );
    return is_string( $value ) ? trim( $value ) : '';
}

function slayerkey_sales_pseudonymous_id( $namespace, $value ) {
    if ( ! is_string( $namespace ) || ! preg_match( '/^[A-Za-z0-9_]+$/D', $namespace ) || ! is_scalar( $value ) ) {
        return '';
    }

    $value = trim( (string) $value );
    if ( '' === $value ) {
        return '';
    }

    return $namespace . '_' . hash( 'sha256', $value );
}

function slayerkey_sales_whop_user_id_from_payment( $payment ) {
    if ( ! is_array( $payment ) ) {
        return '';
    }

    if ( isset( $payment['user_id'] ) && is_scalar( $payment['user_id'] ) ) {
        return trim( (string) $payment['user_id'] );
    }

    if ( isset( $payment['user'] ) && is_scalar( $payment['user'] ) ) {
        return trim( (string) $payment['user'] );
    }

    if ( isset( $payment['user'] ) && is_array( $payment['user'] ) && isset( $payment['user']['id'] ) && is_scalar( $payment['user']['id'] ) ) {
        return trim( (string) $payment['user']['id'] );
    }

    return '';
}

function slayerkey_sales_dojo_identity_bridge_config() {
    $url = defined( 'SLAYERKEY_DOJO_IDENTITY_BRIDGE_URL' )
        ? trim( (string) SLAYERKEY_DOJO_IDENTITY_BRIDGE_URL )
        : trim( (string) get_option( 'slayerkey_dojo_identity_bridge_url', 'https://slayerkey-dojo.mystd.workers.dev/internal/customer-identity' ) );
    $secret = defined( 'SLAYERKEY_DOJO_IDENTITY_BRIDGE_SECRET' )
        ? trim( (string) SLAYERKEY_DOJO_IDENTITY_BRIDGE_SECRET )
        : trim( (string) get_option( 'slayerkey_dojo_identity_bridge_secret', '' ) );

    $host = wp_parse_url( $url, PHP_URL_HOST );
    $scheme = wp_parse_url( $url, PHP_URL_SCHEME );
    if ( '' === $url || 'https' !== strtolower( (string) $scheme ) || ! is_string( $host ) || '' === $host ) {
        return new WP_Error( 'dojo_identity_bridge_misconfigured', 'Dojo identity bridge URL is invalid.' );
    }

    return array( 'enabled' => true, 'url' => $url, 'secret' => $secret );
}

function slayerkey_sales_sync_dojo_identity( $whop_user_id, $posthog_distinct_id, $payment_id ) {
    $whop_user_id = is_scalar( $whop_user_id ) ? trim( (string) $whop_user_id ) : '';
    $posthog_distinct_id = is_scalar( $posthog_distinct_id ) ? trim( (string) $posthog_distinct_id ) : '';
    $payment_id = is_scalar( $payment_id ) ? trim( (string) $payment_id ) : '';

    if ( '' === $whop_user_id || '' === $posthog_distinct_id ) {
        return true;
    }
    if ( '' === $payment_id ) {
        return new WP_Error( 'dojo_identity_bridge_missing_payment', 'Dojo identity bridge requires a Whop payment ID.' );
    }

    $config = slayerkey_sales_dojo_identity_bridge_config();
    if ( is_wp_error( $config ) ) {
        return $config;
    }
    if ( empty( $config['enabled'] ) ) {
        return true;
    }

    $body = wp_json_encode(
        array(
            'whop_user_id'        => $whop_user_id,
            'posthog_distinct_id' => $posthog_distinct_id,
            'payment_id'          => $payment_id,
        )
    );
    $timestamp = (string) time();
    $headers = array(
        'Content-Type'          => 'application/json',
        'X-Slayerkey-Timestamp' => $timestamp,
    );
    if ( '' !== $config['secret'] ) {
        $headers['X-Slayerkey-Signature'] = 'sha256=' . hash_hmac( 'sha256', $timestamp . '.' . $body, $config['secret'] );
    }

    $response = wp_remote_post(
        $config['url'],
        array(
            'timeout' => 5,
            'headers' => $headers,
            'body'    => $body,
        )
    );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $status = wp_remote_retrieve_response_code( $response );
    if ( $status < 200 || $status >= 300 ) {
        return new WP_Error( 'dojo_identity_bridge_failed', 'Dojo identity bridge returned HTTP ' . $status . '.' );
    }

    return true;
}

function slayerkey_sales_whop_checkout_plans() {
    return array(
        'plan_eVop6pXsIhHlf' => 'https://whop.com/checkout/plan_eVop6pXsIhHlf/',
        'plan_kaaoYadRlBi4n' => 'https://whop.com/checkout/plan_kaaoYadRlBi4n/',
    );
}

function slayerkey_sales_sanitize_attribution_metadata( $metadata ) {
    if ( ! is_array( $metadata ) ) {
        return array();
    }

    $allowed = array(
        'posthog_distinct_id',
        'posthog_session_id',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'cta_id',
        'cta_location',
        'page_path',
        'route',
    );

    $safe = array();
    foreach ( $allowed as $key ) {
        if ( ! isset( $metadata[ $key ] ) || ! is_scalar( $metadata[ $key ] ) ) {
            continue;
        }

        $value = trim( (string) $metadata[ $key ] );
        if ( '' === $value ) {
            continue;
        }

        $safe[ $key ] = substr( $value, 0, 200 );
    }

    return $safe;
}

function slayerkey_sales_create_whop_checkout_configuration( $plan_id, $metadata = array() ) {
    $plans = slayerkey_sales_whop_checkout_plans();

    if ( ! isset( $plans[ $plan_id ] ) ) {
        return new WP_Error( 'whop_plan_not_allowed', 'Checkout plan is not allowed.' );
    }

    $api_key = slayerkey_sales_get_whop_api_key();
    if ( '' === $api_key ) {
        return new WP_Error( 'whop_api_not_configured', 'Whop API key is not configured.' );
    }

    $body = array(
        'plan_id'      => $plan_id,
        'mode'         => 'payment',
        'redirect_url' => home_url( '/welcome' ),
        'metadata'     => slayerkey_sales_sanitize_attribution_metadata( $metadata ),
    );

    $response = wp_remote_post(
        'https://api.whop.com/api/v1/checkout_configurations',
        array(
            'timeout' => 5,
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( $body ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $status = wp_remote_retrieve_response_code( $response );
    $data   = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( $status < 200 || $status >= 300 || ! is_array( $data ) || empty( $data['purchase_url'] ) ) {
        return new WP_Error( 'whop_checkout_create_failed', 'Whop checkout configuration could not be created.' );
    }

    $purchase_url = esc_url_raw( (string) $data['purchase_url'] );
    $host         = wp_parse_url( $purchase_url, PHP_URL_HOST );

    if ( '' === $purchase_url || ! is_string( $host ) || ! preg_match( '/(^|\.)whop\.com$/i', $host ) ) {
        return new WP_Error( 'whop_checkout_invalid_url', 'Whop returned an invalid checkout URL.' );
    }

    return array(
        'purchase_url' => $purchase_url,
        'id'           => isset( $data['id'] ) && is_scalar( $data['id'] ) ? (string) $data['id'] : '',
    );
}

function slayerkey_sales_whop_events_request( $query = array() ) {
    $api_key = slayerkey_sales_get_whop_api_key();
    if ( '' === $api_key ) {
        return new WP_Error( 'whop_api_not_configured', 'Whop API key is not configured.' );
    }

    $query = is_array( $query ) ? array_filter(
        $query,
        function ( $value ) {
            return null !== $value && '' !== $value;
        }
    ) : array();

    $url = 'https://api.whop.com/api/v1/events';
    if ( ! empty( $query ) ) {
        $url .= '?' . http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );
    }

    $response = wp_remote_get(
        $url,
        array(
            'timeout' => 4,
            'headers' => array(
                'Authorization'    => 'Bearer ' . $api_key,
                'Api-Version-Date' => '2026-09-22-2',
                'Accept'           => 'application/json',
            ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $status = wp_remote_retrieve_response_code( $response );
    $data   = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( $status < 200 || $status >= 300 ) {
        return new WP_Error( 'whop_events_api_failed', 'Whop Events API returned HTTP ' . $status . '.' );
    }

    if ( ! is_array( $data ) || ! isset( $data['data'] ) || ! is_array( $data['data'] ) ) {
        return new WP_Error( 'whop_events_api_invalid_response', 'Whop Events API returned an invalid response.' );
    }

    return $data;
}


function slayerkey_sales_whop_people_request( $identifier ) {
    $api_key = slayerkey_sales_get_whop_api_key();
    if ( '' === $api_key ) {
        return new WP_Error( 'whop_api_not_configured', 'Whop API key is not configured.' );
    }

    $identifier = is_scalar( $identifier ) ? trim( (string) $identifier ) : '';
    if ( '' === $identifier ) {
        return new WP_Error( 'whop_people_invalid_identifier', 'Whop People API requires an identifier.' );
    }

    $response = wp_remote_get(
        'https://api.whop.com/api/v1/people/' . rawurlencode( $identifier ),
        array(
            'timeout' => 4,
            'headers' => array(
                'Authorization'    => 'Bearer ' . $api_key,
                'Api-Version-Date' => '2026-09-22-2',
                'Accept'           => 'application/json',
            ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $status = wp_remote_retrieve_response_code( $response );
    $data   = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( $status < 200 || $status >= 300 ) {
        return new WP_Error( 'whop_people_api_failed', 'Whop People API returned HTTP ' . $status . '.' );
    }

    if ( ! is_array( $data ) ) {
        return new WP_Error( 'whop_people_api_invalid_response', 'Whop People API returned an invalid response.' );
    }

    return $data;
}

function slayerkey_sales_whop_collect_safe_attribution( $value, $path, &$out, $depth = 0 ) {
    if ( $depth > 6 || count( $out ) >= 40 || ! is_array( $value ) ) {
        return;
    }

    $safe_scalar_keys = array(
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'source',
        'source_type',
        'medium',
        'campaign',
        'content',
        'term',
        'channel',
        'tracking_link_id',
        'tracking_link_name',
    );

    foreach ( $value as $key => $item ) {
        $safe_key = strtolower( preg_replace( '/[^a-zA-Z0-9_]+/', '_', (string) $key ) );
        $next_path = '' === $path ? $safe_key : $path . '.' . $safe_key;

        if ( is_array( $item ) ) {
            slayerkey_sales_whop_collect_safe_attribution( $item, $next_path, $out, $depth + 1 );
            continue;
        }

        if ( ! is_scalar( $item ) ) {
            continue;
        }

        $allow_type = 'type' === $safe_key && preg_match( '/(?:source|touch|attribution|tracking|utm)/', $path );
        if ( ! in_array( $safe_key, $safe_scalar_keys, true ) && ! $allow_type ) {
            continue;
        }

        $scalar = trim( (string) $item );
        if ( '' === $scalar ) {
            continue;
        }

        $out[ $next_path ] = substr( $scalar, 0, 200 );
        if ( count( $out ) >= 40 ) {
            return;
        }
    }
}

function slayerkey_sales_whop_safe_attribution_summary( $value ) {
    $out = array();
    slayerkey_sales_whop_collect_safe_attribution( $value, '', $out, 0 );
    return $out;
}

function slayerkey_sales_whop_has_tracking_link_signal( $attribution ) {
    if ( ! is_array( $attribution ) ) {
        return false;
    }

    foreach ( $attribution as $key => $value ) {
        $haystack = strtolower( (string) $key . ' ' . (string) $value );
        if ( false !== strpos( $haystack, 'tracking_link' ) || false !== strpos( $haystack, 'tracking link' ) ) {
            return true;
        }
    }

    return false;
}

function slayerkey_sales_whop_payment_attribution( $whop_user_id, $payment_id ) {
    $whop_user_id = is_scalar( $whop_user_id ) ? trim( (string) $whop_user_id ) : '';
    $payment_id    = is_scalar( $payment_id ) ? trim( (string) $payment_id ) : '';

    if ( '' === $whop_user_id || '' === $payment_id ) {
        return array( 'matched' => false, 'attribution' => array() );
    }

    $result = slayerkey_sales_whop_events_request(
        array(
            'identifier' => $whop_user_id,
            'event'      => 'payment.completed',
            'first'      => 100,
        )
    );

    if ( is_wp_error( $result ) ) {
        return $result;
    }

    foreach ( $result['data'] as $item ) {
        if ( ! is_array( $item ) || 'payment.completed' !== (string) ( $item['event_name'] ?? '' ) ) {
            continue;
        }

        $related_payment_id = '';
        if ( isset( $item['related']['payment']['id'] ) && is_scalar( $item['related']['payment']['id'] ) ) {
            $related_payment_id = trim( (string) $item['related']['payment']['id'] );
        }

        if ( '' === $related_payment_id || ! hash_equals( $payment_id, $related_payment_id ) ) {
            continue;
        }

        $context = isset( $item['context'] ) && is_array( $item['context'] ) ? $item['context'] : array();
        $attribution = array();
        foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term' ) as $field ) {
            if ( ! isset( $context[ $field ] ) || ! is_scalar( $context[ $field ] ) ) {
                continue;
            }

            $value = trim( (string) $context[ $field ] );
            if ( '' !== $value ) {
                $attribution[ $field ] = substr( $value, 0, 200 );
            }
        }

        return array(
            'matched'     => true,
            'attribution' => $attribution,
        );
    }

    return array( 'matched' => false, 'attribution' => array() );
}

function slayerkey_sales_whop_events_diagnostic() {
    $now = time();
    $result = slayerkey_sales_whop_events_request(
        array(
            'from'  => gmdate( 'c', $now - ( 7 * DAY_IN_SECONDS ) ),
            'to'    => gmdate( 'c', $now ),
            'event' => 'payment.completed',
            'first' => 100,
        )
    );

    if ( is_wp_error( $result ) ) {
        return $result;
    }

    $payment_found    = false;
    $attributed_found = false;
    $youtube_found    = false;
    $sample_user_id   = '';
    $sample_payment_id = '';

    foreach ( $result['data'] as $item ) {
        if ( ! is_array( $item ) || 'payment.completed' !== (string) ( $item['event_name'] ?? '' ) ) {
            continue;
        }

        $payment_found = true;
        $context = isset( $item['context'] ) && is_array( $item['context'] ) ? $item['context'] : array();

        foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term' ) as $field ) {
            if ( isset( $context[ $field ] ) && is_scalar( $context[ $field ] ) && '' !== trim( (string) $context[ $field ] ) ) {
                $attributed_found = true;
                break;
            }
        }

        if ( isset( $context['utm_source'] ) && 'youtube' === strtolower( trim( (string) $context['utm_source'] ) ) ) {
            $youtube_found = true;
        }

        if ( '' === $sample_user_id && isset( $item['related']['user']['id'] ) && is_scalar( $item['related']['user']['id'] ) ) {
            $candidate_user = trim( (string) $item['related']['user']['id'] );
            $candidate_payment = isset( $item['related']['payment']['id'] ) && is_scalar( $item['related']['payment']['id'] )
                ? trim( (string) $item['related']['payment']['id'] )
                : '';

            if ( 0 === strpos( $candidate_user, 'user_' ) && '' !== $candidate_payment ) {
                $sample_user_id = $candidate_user;
                $sample_payment_id = $candidate_payment;
            }
        }
    }

    $diagnostic = array(
        'configured'                     => true,
        'events_readable'                 => true,
        'recent_payment_events_found'     => $payment_found,
        'recent_attributed_payment_found' => $attributed_found,
        'recent_youtube_payment_found'    => $youtube_found,
        'person_lookup_attempted'         => false,
        'people_readable'                 => false,
        'person_source_found'             => false,
        'person_attribution'              => array(),
        'journey_readable'                => false,
        'journey_exact_payment_matched'   => false,
        'journey_events_before_purchase'  => 0,
        'journey_source_found'            => false,
        'journey_attribution'             => array(),
        'tracking_link_signal_found'      => false,
    );

    if ( '' === $sample_user_id || '' === $sample_payment_id ) {
        return $diagnostic;
    }

    $diagnostic['person_lookup_attempted'] = true;
    $person = slayerkey_sales_whop_people_request( $sample_user_id );
    if ( is_wp_error( $person ) ) {
        $diagnostic['people_error'] = $person->get_error_message();
    } else {
        $person_attribution = slayerkey_sales_whop_safe_attribution_summary( $person );
        $diagnostic['people_readable'] = true;
        $diagnostic['person_attribution'] = $person_attribution;
        $diagnostic['person_source_found'] = ! empty( $person_attribution );
        $diagnostic['tracking_link_signal_found'] = slayerkey_sales_whop_has_tracking_link_signal( $person_attribution );
    }

    $journey = slayerkey_sales_whop_events_request(
        array(
            'identifier' => $sample_user_id,
            'direction'  => 'asc',
            'first'      => 100,
        )
    );

    if ( is_wp_error( $journey ) ) {
        $diagnostic['journey_error'] = $journey->get_error_message();
        return $diagnostic;
    }

    $diagnostic['journey_readable'] = true;
    $before_purchase = 0;
    $journey_attribution = array();

    foreach ( $journey['data'] as $item ) {
        if ( ! is_array( $item ) ) {
            continue;
        }

        $item_attribution = slayerkey_sales_whop_safe_attribution_summary(
            isset( $item['context'] ) && is_array( $item['context'] ) ? $item['context'] : array()
        );
        foreach ( $item_attribution as $key => $value ) {
            $journey_attribution[ $key ] = $value;
        }

        $related_payment_id = isset( $item['related']['payment']['id'] ) && is_scalar( $item['related']['payment']['id'] )
            ? trim( (string) $item['related']['payment']['id'] )
            : '';

        if ( '' !== $related_payment_id && hash_equals( $sample_payment_id, $related_payment_id ) ) {
            $diagnostic['journey_exact_payment_matched'] = true;
            break;
        }

        $before_purchase++;
    }

    $diagnostic['journey_events_before_purchase'] = $before_purchase;
    $diagnostic['journey_attribution'] = $journey_attribution;
    $diagnostic['journey_source_found'] = ! empty( $journey_attribution );
    $diagnostic['tracking_link_signal_found'] = $diagnostic['tracking_link_signal_found']
        || slayerkey_sales_whop_has_tracking_link_signal( $journey_attribution );

    return $diagnostic;
}

function slayerkey_sales_processed_key( $provider, $event_id ) {
    return 'sk_sale_' . $provider . '_' . md5( $event_id );
}

function slayerkey_sales_is_processed( $provider, $event_id ) {
    if ( '' === $event_id ) {
        return false;
    }

    return (bool) get_transient( slayerkey_sales_processed_key( $provider, $event_id ) );
}

function slayerkey_sales_mark_processed( $provider, $event_id ) {
    if ( '' === $event_id ) {
        return;
    }

    set_transient(
        slayerkey_sales_processed_key( $provider, $event_id ),
        1,
        30 * DAY_IN_SECONDS
    );
}

function slayerkey_sales_posthog_capture_event( $event_name, $distinct_id, $properties = array() ) {
    if ( ! defined( 'SLAYERKEY_POSTHOG_TOKEN' ) || '' === SLAYERKEY_POSTHOG_TOKEN ) {
        return new WP_Error( 'posthog_not_configured', 'PostHog project token is not configured.' );
    }

    $event_name = is_string( $event_name ) ? trim( $event_name ) : '';
    $distinct_id = is_string( $distinct_id ) ? trim( $distinct_id ) : '';
    if ( '' === $event_name || '' === $distinct_id ) {
        return new WP_Error( 'posthog_invalid_event', 'PostHog event name and distinct ID are required.' );
    }

    $payload = array(
        'api_key'     => SLAYERKEY_POSTHOG_TOKEN,
        'event'       => $event_name,
        'distinct_id' => $distinct_id,
        'properties'  => array_merge(
            array( '$process_person_profile' => false ),
            is_array( $properties ) ? $properties : array()
        ),
    );

    $response = wp_remote_post(
        'https://us.i.posthog.com/i/v0/e/',
        array(
            'timeout' => 3,
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'body'    => wp_json_encode( $payload ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $status = wp_remote_retrieve_response_code( $response );
    if ( $status < 200 || $status >= 300 ) {
        return new WP_Error( 'posthog_capture_failed', 'PostHog returned HTTP ' . $status . '.' );
    }

    return true;
}

function slayerkey_sales_posthog_capture( $provider, $event_id, $properties = array(), $distinct_id = '' ) {
    $safe_properties = array_merge(
        array(
            'provider' => $provider,
            'source'   => 'verified_payment_webhook',
        ),
        $properties
    );

    $capture_distinct_id = is_string( $distinct_id ) ? trim( $distinct_id ) : '';
    if ( '' === $capture_distinct_id ) {
        $capture_distinct_id = 'sale:' . $provider . ':' . hash( 'sha256', $event_id );
    }

    return slayerkey_sales_posthog_capture_event( 'sale_confirmed', $capture_distinct_id, $safe_properties );
}

function slayerkey_sales_handle_whop_webhook( $raw_body, $webhook_id, $webhook_timestamp, $signature_header ) {
    $secret = slayerkey_sales_get_secret( 'whop' );

    if ( '' === $secret ) {
        return array(
            'status' => 503,
            'body'   => array( 'ok' => false, 'error' => 'Whop webhook secret is not configured.' ),
        );
    }

    $raw_body          = is_string( $raw_body ) ? $raw_body : '';
    $webhook_id        = is_string( $webhook_id ) ? trim( $webhook_id ) : '';
    $webhook_timestamp = is_string( $webhook_timestamp ) ? trim( $webhook_timestamp ) : '';
    $signature_header  = is_string( $signature_header ) ? trim( $signature_header ) : '';

    if ( '' === $raw_body || '' === $webhook_id || '' === $webhook_timestamp || '' === $signature_header ) {
        return array(
            'status' => 400,
            'body'   => array( 'ok' => false, 'error' => 'Missing Whop payload or signature headers.' ),
        );
    }

    if ( ! ctype_digit( $webhook_timestamp ) ) {
        return array(
            'status' => 400,
            'body'   => array( 'ok' => false, 'error' => 'Invalid Whop timestamp.' ),
        );
    }

    $timestamp = (int) $webhook_timestamp;

    if ( abs( time() - $timestamp ) > 300 ) {
        return array(
            'status' => 400,
            'body'   => array( 'ok' => false, 'error' => 'Whop signature timestamp is outside the allowed window.' ),
        );
    }

    $signed_payload      = $webhook_id . '.' . $webhook_timestamp . '.' . $raw_body;
    $expected_signature  = base64_encode( hash_hmac( 'sha256', $signed_payload, $secret, true ) );
    $provided_signatures = array();

    if ( preg_match_all( '/v1,([A-Za-z0-9+\\/=]+)/', $signature_header, $matches ) ) {
        $provided_signatures = $matches[1];
    }

    $verified = false;
    foreach ( $provided_signatures as $signature ) {
        if ( hash_equals( $expected_signature, $signature ) ) {
            $verified = true;
            break;
        }
    }

    if ( ! $verified ) {
        return array(
            'status' => 400,
            'body'   => array( 'ok' => false, 'error' => 'Invalid Whop signature.' ),
        );
    }

    $event = json_decode( $raw_body, true );

    if ( ! is_array( $event ) || empty( $event['type'] ) ) {
        return array(
            'status' => 400,
            'body'   => array( 'ok' => false, 'error' => 'Invalid Whop event payload.' ),
        );
    }

    $event_type = (string) $event['type'];
    $event_id   = ! empty( $event['id'] ) ? (string) $event['id'] : $webhook_id;

    if ( 'payment.succeeded' !== $event_type ) {
        return array(
            'status' => 200,
            'body'   => array( 'ok' => true, 'ignored' => true ),
        );
    }

    if ( slayerkey_sales_is_processed( 'whop', $event_id ) ) {
        return array(
            'status' => 200,
            'body'   => array( 'ok' => true, 'duplicate' => true ),
        );
    }

    $payment    = isset( $event['data'] ) && is_array( $event['data'] ) ? $event['data'] : array();
    $properties = array(
        'whop_event_type' => $event_type,
    );

    // Keep useful non-PII classification fields, but intentionally omit amount,
    // email, name, card data, address, and other customer/payment details.
    foreach ( array( 'status', 'substatus', 'billing_reason' ) as $field ) {
        if ( isset( $payment[ $field ] ) && is_scalar( $payment[ $field ] ) ) {
            $properties[ 'whop_' . $field ] = (string) $payment[ $field ];
        }
    }

    if ( isset( $payment['product'] ) ) {
        if ( is_string( $payment['product'] ) ) {
            $properties['whop_product_id'] = $payment['product'];
        } elseif ( is_array( $payment['product'] ) && ! empty( $payment['product']['id'] ) ) {
            $properties['whop_product_id'] = (string) $payment['product']['id'];
        }
    }

    if ( isset( $payment['plan'] ) ) {
        if ( is_string( $payment['plan'] ) ) {
            $properties['whop_plan_id'] = $payment['plan'];
        } elseif ( is_array( $payment['plan'] ) && ! empty( $payment['plan']['id'] ) ) {
            $properties['whop_plan_id'] = (string) $payment['plan']['id'];
        }
    }

    $metadata = isset( $payment['metadata'] ) && is_array( $payment['metadata'] )
        ? slayerkey_sales_sanitize_attribution_metadata( $payment['metadata'] )
        : array();

    $whop_user_id = slayerkey_sales_whop_user_id_from_payment( $payment );
    $payment_id = isset( $payment['id'] ) && is_scalar( $payment['id'] ) ? trim( (string) $payment['id'] ) : '';

    $has_checkout_attribution = false;
    foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term' ) as $field ) {
        if ( ! empty( $metadata[ $field ] ) ) {
            $has_checkout_attribution = true;
            break;
        }
    }

    if ( ! $has_checkout_attribution && '' !== $whop_user_id && '' !== $payment_id ) {
        $whop_attribution = slayerkey_sales_whop_payment_attribution( $whop_user_id, $payment_id );
        if ( is_wp_error( $whop_attribution ) ) {
            $properties['whop_attribution_status'] = 'events_api_error';
            error_log( '[Slayerkey Whop webhook] Whop Events attribution lookup failed; sale will still be recorded.' );
        } elseif ( ! empty( $whop_attribution['matched'] ) ) {
            $properties['whop_attribution_status'] = 'payment_event_matched';
            if ( ! empty( $whop_attribution['attribution'] ) && is_array( $whop_attribution['attribution'] ) ) {
                $properties['attribution_source'] = 'whop_events_api';
                foreach ( $whop_attribution['attribution'] as $field => $value ) {
                    if ( empty( $metadata[ $field ] ) ) {
                        $metadata[ $field ] = $value;
                    }
                }
            }
        } else {
            $properties['whop_attribution_status'] = 'payment_event_not_found';
        }
    }

    $posthog_distinct_id = '';
    if ( ! empty( $metadata['posthog_distinct_id'] ) ) {
        $posthog_distinct_id = $metadata['posthog_distinct_id'];
        $properties['journey_linked'] = true;
        $properties['identity_source'] = 'checkout_posthog_distinct_id';
    } else {
        $posthog_distinct_id = slayerkey_sales_pseudonymous_id( 'whop_user', $whop_user_id );
        if ( '' !== $posthog_distinct_id ) {
            $properties['identity_source'] = 'whop_user_id_hash';
        }
    }

    $payment_total = null;
    if ( isset( $payment['final_amount'] ) && is_numeric( $payment['final_amount'] ) ) {
        $payment_total = (float) $payment['final_amount'];
    } elseif ( isset( $payment['total'] ) && is_numeric( $payment['total'] ) ) {
        $payment_total = (float) $payment['total'];
    }
    if ( null !== $payment_total && $payment_total >= 0 ) {
        $properties['revenue'] = $payment_total;
    }
    if ( isset( $payment['currency'] ) && is_scalar( $payment['currency'] ) ) {
        $currency = strtoupper( trim( (string) $payment['currency'] ) );
        if ( preg_match( '/^[A-Z]{3}$/D', $currency ) ) {
            $properties['currency'] = $currency;
        }
    }

    if ( ! empty( $metadata['posthog_session_id'] ) ) {
        $properties['$session_id'] = $metadata['posthog_session_id'];
    }

    foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'cta_id', 'cta_location', 'page_path', 'route' ) as $field ) {
        if ( ! empty( $metadata[ $field ] ) ) {
            $properties[ $field ] = $metadata[ $field ];
        }
    }

    if ( ! empty( $metadata['posthog_distinct_id'] ) ) {
        $identity_sync = slayerkey_sales_sync_dojo_identity( $whop_user_id, $posthog_distinct_id, $payment_id );
        if ( is_wp_error( $identity_sync ) ) {
            error_log( '[Slayerkey Whop webhook] Dojo identity bridge failed before analytics capture: ' . $identity_sync->get_error_message() );

            return array(
                'status' => 500,
                'body'   => array( 'ok' => false, 'error' => 'Customer identity handoff failed; Whop should retry.' ),
            );
        }
    }

    $result = slayerkey_sales_posthog_capture( 'whop', $event_id, $properties, $posthog_distinct_id );

    if ( is_wp_error( $result ) ) {
        error_log( '[Slayerkey Whop webhook] PostHog capture failed: ' . $result->get_error_message() );

        return array(
            'status' => 500,
            'body'   => array( 'ok' => false, 'error' => 'Analytics delivery failed; Whop should retry.' ),
        );
    }

    slayerkey_sales_mark_processed( 'whop', $event_id );

    return array(
        'status' => 200,
        'body'   => array( 'ok' => true ),
    );
}

function slayerkey_sales_json_response( $status, $body ) {
    status_header( $status );
    nocache_headers();
    header( 'Content-Type: application/json; charset=utf-8' );
    echo wp_json_encode( $body ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    exit;
}
