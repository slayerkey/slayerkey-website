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

$raw_body   = file_get_contents( 'php://input' );
$sig_header = isset( $_SERVER['HTTP_STRIPE_SIGNATURE'] ) ? trim( wp_unslash( $_SERVER['HTTP_STRIPE_SIGNATURE'] ) ) : '';

$result = slayerkey_sales_handle_stripe_webhook(
    false === $raw_body ? '' : $raw_body,
    $sig_header
);

slayerkey_sales_json_response( $result['status'], $result['body'] );
