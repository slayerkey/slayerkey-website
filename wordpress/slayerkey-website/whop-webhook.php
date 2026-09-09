<?php
/**
 * Public Whop webhook receiver for Slayerkey sales tracking.
 *
 * Endpoint:
 * https://slayerkey.com/wp-content/plugins/slayerkey-website/whop-webhook.php
 *
 * Listens for payment.succeeded and records only a minimal,
 * privacy-preserving sale_confirmed event in PostHog.
 */

$slayerkey_wp_load = dirname( __FILE__, 4 ) . '/wp-load.php';

if ( ! is_readable( $slayerkey_wp_load ) ) {
    http_response_code( 500 );
    exit( 'WordPress bootstrap unavailable.' );
}

require_once $slayerkey_wp_load;
require_once __DIR__ . '/sales-webhook-common.php';

if ( 'POST' !== strtoupper( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) ) {
    header( 'Allow: POST' );
    slayerkey_sales_json_response( 405, array( 'ok' => false, 'error' => 'POST required.' ) );
}

$secret = slayerkey_sales_get_secret( 'whop' );

if ( '' === $secret ) {
    slayerkey_sales_json_response( 503, array( 'ok' => false, 'error' => 'Whop webhook secret is not configured.' ) );
}

$raw_body          = file_get_contents( 'php://input' );
$webhook_id        = isset( $_SERVER['HTTP_WEBHOOK_ID'] ) ? trim( wp_unslash( $_SERVER['HTTP_WEBHOOK_ID'] ) ) : '';
$webhook_timestamp = isset( $_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ) ? trim( wp_unslash( $_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ) ) : '';
$signature_header  = isset( $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ) ? trim( wp_unslash( $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ) ) : '';

if ( false === $raw_body || '' === $raw_body || '' === $webhook_id || '' === $webhook_timestamp || '' === $signature_header ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Missing Whop payload or signature headers.' ) );
}

if ( ! ctype_digit( $webhook_timestamp ) ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Invalid Whop timestamp.' ) );
}

$timestamp = (int) $webhook_timestamp;

if ( abs( time() - $timestamp ) > 300 ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Whop signature timestamp is outside the allowed window.' ) );
}

$signed_payload      = $webhook_id . '.' . $webhook_timestamp . '.' . $raw_body;
$expected_signature  = base64_encode( hash_hmac( 'sha256', $signed_payload, $secret, true ) );
$provided_signatures = array();

if ( preg_match_all( '/v1,([A-Za-z0-9+\/=]+)/', $signature_header, $matches ) ) {
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
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Invalid Whop signature.' ) );
}

$event = json_decode( $raw_body, true );

if ( ! is_array( $event ) || empty( $event['type'] ) ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Invalid Whop event payload.' ) );
}

$event_type = (string) $event['type'];
$event_id   = ! empty( $event['id'] ) ? (string) $event['id'] : $webhook_id;

if ( 'payment.succeeded' !== $event_type ) {
    slayerkey_sales_json_response( 200, array( 'ok' => true, 'ignored' => true ) );
}

if ( slayerkey_sales_is_processed( 'whop', $event_id ) ) {
    slayerkey_sales_json_response( 200, array( 'ok' => true, 'duplicate' => true ) );
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
    slayerkey_sales_json_response( 500, array( 'ok' => false, 'error' => 'Analytics delivery failed; Whop should retry.' ) );
}

slayerkey_sales_mark_processed( 'whop', $event_id );
slayerkey_sales_json_response( 200, array( 'ok' => true ) );
