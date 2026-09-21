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

    $posthog_distinct_id = '';
    if ( ! empty( $metadata['posthog_distinct_id'] ) ) {
        $posthog_distinct_id = $metadata['posthog_distinct_id'];
        $properties['journey_linked'] = true;
        $properties['identity_source'] = 'checkout_posthog_distinct_id';
    } else {
        $whop_user_id = slayerkey_sales_whop_user_id_from_payment( $payment );
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

    foreach ( array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'cta_id', 'cta_location', 'page_path', 'route' ) as $field ) {
        if ( ! empty( $metadata[ $field ] ) ) {
            $properties[ $field ] = $metadata[ $field ];
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
