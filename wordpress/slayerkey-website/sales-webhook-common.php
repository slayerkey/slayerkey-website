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

function slayerkey_sales_safe_client_reference_id( $value ) {
    if ( ! is_string( $value ) ) {
        return '';
    }

    $value = trim( $value );

    if ( '' === $value || strlen( $value ) > 200 || ! preg_match( '/^[A-Za-z0-9_-]+$/D', $value ) ) {
        return '';
    }

    return $value;
}

function slayerkey_sales_posthog_capture( $provider, $event_id, $properties = array(), $distinct_id = '' ) {
    if ( ! defined( 'SLAYERKEY_POSTHOG_TOKEN' ) || '' === SLAYERKEY_POSTHOG_TOKEN ) {
        return new WP_Error( 'posthog_not_configured', 'PostHog project token is not configured.' );
    }

    $safe_properties = array_merge(
        array(
            '$process_person_profile' => false,
            'provider'                => $provider,
            'source'                  => 'verified_payment_webhook',
        ),
        $properties
    );

    $analytics_distinct_id = slayerkey_sales_safe_client_reference_id( $distinct_id );

    if ( '' === $analytics_distinct_id ) {
        $analytics_distinct_id = 'sale:' . $provider . ':' . hash( 'sha256', $event_id );
    }

    $payload = array(
        'api_key'     => SLAYERKEY_POSTHOG_TOKEN,
        'event'       => 'sale_confirmed',
        'distinct_id' => $analytics_distinct_id,
        'properties'  => $safe_properties,
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

    $result = slayerkey_sales_posthog_capture( 'whop', $event_id, $properties );

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
