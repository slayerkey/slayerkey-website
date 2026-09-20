<?php
/**
 * Public Stripe webhook receiver for Slayerkey sales tracking.
 *
 * Endpoint:
 * https://slayerkey.com/wp-content/plugins/slayerkey-website/stripe-webhook.php
 *
 * Listens for checkout.session.completed and records only a minimal,
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

$secret = slayerkey_sales_get_secret( 'stripe' );

if ( '' === $secret ) {
    slayerkey_sales_json_response( 503, array( 'ok' => false, 'error' => 'Stripe webhook secret is not configured.' ) );
}

$raw_body  = file_get_contents( 'php://input' );
$sig_header = isset( $_SERVER['HTTP_STRIPE_SIGNATURE'] ) ? trim( wp_unslash( $_SERVER['HTTP_STRIPE_SIGNATURE'] ) ) : '';

if ( false === $raw_body || '' === $raw_body || '' === $sig_header ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Missing Stripe payload or signature.' ) );
}

$timestamp  = null;
$signatures = array();

foreach ( explode( ',', $sig_header ) as $part ) {
    $part = trim( $part );
    $pair = explode( '=', $part, 2 );

    if ( 2 !== count( $pair ) ) {
        continue;
    }

    if ( 't' === $pair[0] ) {
        $timestamp = ctype_digit( $pair[1] ) ? (int) $pair[1] : null;
    } elseif ( 'v1' === $pair[0] && '' !== $pair[1] ) {
        $signatures[] = strtolower( $pair[1] );
    }
}

if ( null === $timestamp || empty( $signatures ) ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Malformed Stripe signature header.' ) );
}

if ( abs( time() - $timestamp ) > 300 ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Stripe signature timestamp is outside the allowed window.' ) );
}

$expected_signature = hash_hmac( 'sha256', (string) $timestamp . '.' . $raw_body, $secret );
$verified           = false;

foreach ( $signatures as $signature ) {
    if ( hash_equals( $expected_signature, $signature ) ) {
        $verified = true;
        break;
    }
}

if ( ! $verified ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Invalid Stripe signature.' ) );
}

$event = json_decode( $raw_body, true );

if ( ! is_array( $event ) || empty( $event['id'] ) || empty( $event['type'] ) ) {
    slayerkey_sales_json_response( 400, array( 'ok' => false, 'error' => 'Invalid Stripe event payload.' ) );
}

$event_id   = (string) $event['id'];
$event_type = (string) $event['type'];

if ( 'checkout.session.completed' !== $event_type ) {
    slayerkey_sales_json_response( 200, array( 'ok' => true, 'ignored' => true ) );
}

if ( slayerkey_sales_is_processed( 'stripe', $event_id ) ) {
    slayerkey_sales_json_response( 200, array( 'ok' => true, 'duplicate' => true ) );
}

$session        = isset( $event['data']['object'] ) && is_array( $event['data']['object'] ) ? $event['data']['object'] : array();
$payment_status = isset( $session['payment_status'] ) ? (string) $session['payment_status'] : '';

// A completed Checkout Session can still be unpaid for asynchronous payment methods.
// This endpoint intentionally records only confirmed paid sessions.
if ( 'paid' !== $payment_status ) {
    slayerkey_sales_json_response( 200, array( 'ok' => true, 'ignored' => true, 'reason' => 'not_paid' ) );
}

$properties = array(
    'stripe_event_type' => $event_type,
    'payment_status'    => 'paid',
);

if ( isset( $session['mode'] ) && is_string( $session['mode'] ) ) {
    $properties['checkout_mode'] = $session['mode'];
}

$client_reference_id = slayerkey_sales_safe_client_reference_id(
    isset( $session['client_reference_id'] ) ? $session['client_reference_id'] : ''
);

if ( '' !== $client_reference_id ) {
    $properties['identity_source'] = 'stripe_client_reference_id';
}

$result = slayerkey_sales_posthog_capture(
    'stripe',
    $event_id,
    $properties,
    $client_reference_id
);

if ( is_wp_error( $result ) ) {
    error_log( '[Slayerkey Stripe webhook] PostHog capture failed: ' . $result->get_error_message() );
    slayerkey_sales_json_response( 500, array( 'ok' => false, 'error' => 'Analytics delivery failed; Stripe should retry.' ) );
}

slayerkey_sales_mark_processed( 'stripe', $event_id );
slayerkey_sales_json_response( 200, array( 'ok' => true ) );
