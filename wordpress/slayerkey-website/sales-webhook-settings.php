<?php
/**
 * Admin-only setup page for Slayerkey sales webhook signing secrets.
 *
 * This page stores the secrets in non-autoloaded WordPress options so the
 * values never need to be committed to GitHub or pasted into chat.
 */

$slayerkey_wp_load = dirname( __FILE__, 4 ) . '/wp-load.php';

if ( ! is_readable( $slayerkey_wp_load ) ) {
    http_response_code( 500 );
    exit( 'WordPress bootstrap unavailable.' );
}

require_once $slayerkey_wp_load;
require_once __DIR__ . '/sales-webhook-common.php';

header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );
nocache_headers();

$settings_url = home_url( '/wp-content/plugins/slayerkey-website/sales-webhook-settings.php' );

if ( ! is_user_logged_in() ) {
    wp_safe_redirect( wp_login_url( $settings_url ) );
    exit;
}

if ( ! current_user_can( 'manage_options' ) ) {
    status_header( 403 );
    exit( 'Administrator access required.' );
}

$messages = array();
$errors   = array();

if ( 'POST' === strtoupper( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) ) {
    check_admin_referer( 'slayerkey_sales_webhook_settings' );

    $whop_input   = isset( $_POST['whop_secret'] ) ? trim( sanitize_text_field( wp_unslash( $_POST['whop_secret'] ) ) ) : '';
    $stripe_input = isset( $_POST['stripe_secret'] ) ? trim( sanitize_text_field( wp_unslash( $_POST['stripe_secret'] ) ) ) : '';

    if ( '' !== $whop_input ) {
        if ( 0 !== strpos( $whop_input, 'ws_' ) ) {
            $errors[] = 'Whop secret was not saved because it should begin with ws_.';
        } else {
            update_option( 'slayerkey_whop_webhook_secret', $whop_input, false );
            $messages[] = 'Whop signing secret saved.';
        }
    }

    if ( '' !== $stripe_input ) {
        if ( 0 !== strpos( $stripe_input, 'whsec_' ) ) {
            $errors[] = 'Stripe secret was not saved because it should begin with whsec_.';
        } else {
            update_option( 'slayerkey_stripe_webhook_secret', $stripe_input, false );
            $messages[] = 'Stripe signing secret saved.';
        }
    }

    if ( isset( $_POST['clear_whop'] ) && '1' === $_POST['clear_whop'] ) {
        delete_option( 'slayerkey_whop_webhook_secret' );
        $messages[] = 'Whop signing secret cleared.';
    }

    if ( isset( $_POST['clear_stripe'] ) && '1' === $_POST['clear_stripe'] ) {
        delete_option( 'slayerkey_stripe_webhook_secret' );
        $messages[] = 'Stripe signing secret cleared.';
    }
}

$whop_configured   = '' !== slayerkey_sales_get_secret( 'whop' );
$stripe_configured = '' !== slayerkey_sales_get_secret( 'stripe' );
$whop_endpoint     = home_url( '/wp-content/plugins/slayerkey-website/whop-webhook.php' );
$stripe_endpoint   = home_url( '/wp-content/plugins/slayerkey-website/stripe-webhook.php' );

?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Slayerkey Sales Webhook Setup</title>
    <style>
        :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0f1115;color:#f4f7fb;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:860px;margin:56px auto;padding:0 22px}.card{background:#171a20;border:1px solid #2b313a;border-radius:14px;padding:24px;margin:18px 0}.row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center}.status{font-weight:800;padding:5px 9px;border-radius:999px;background:#272d36}.ok{color:#8ff0b1}.bad{color:#ff9c9c}h1{font-size:30px;margin:0 0 8px}h2{font-size:19px;margin:0 0 12px}p{color:#bdc7d3}code{display:block;overflow-wrap:anywhere;background:#0e1014;border:1px solid #2b313a;border-radius:8px;padding:11px 12px;color:#cde7ff}label{display:block;font-weight:750;margin:14px 0 6px}input[type=password]{width:100%;padding:12px;border:1px solid #39414c;border-radius:8px;background:#0f1217;color:white}button{margin-top:18px;background:#fff;color:#111;border:0;border-radius:8px;padding:11px 16px;font-weight:800;cursor:pointer}.notice{padding:11px 13px;border-radius:8px;margin:10px 0}.success{background:#10291a;color:#9bf2b7}.error{background:#351517;color:#ffb3b3}.small{font-size:13px;color:#94a1af}.clear{margin-top:10px;font-size:13px;color:#aeb8c4}.clear input{vertical-align:-1px}.sep{height:1px;background:#2b313a;margin:22px 0}</style>
</head>
<body>
<div class="wrap">
    <h1>Sales webhook setup</h1>
    <p>Paste each signing secret here once. The values are stored privately in WordPress, are never shown back to you, and are never sent to GitHub or PostHog.</p>

    <?php foreach ( $messages as $message ) : ?>
        <div class="notice success"><?php echo esc_html( $message ); ?></div>
    <?php endforeach; ?>
    <?php foreach ( $errors as $error ) : ?>
        <div class="notice error"><?php echo esc_html( $error ); ?></div>
    <?php endforeach; ?>

    <div class="card">
        <div class="row">
            <h2>Whop</h2>
            <span class="status <?php echo $whop_configured ? 'ok' : 'bad'; ?>"><?php echo $whop_configured ? 'Configured' : 'Not configured'; ?></span>
        </div>
        <p class="small">Use only the <strong>payment.succeeded</strong> event.</p>
        <label>Endpoint URL</label>
        <code><?php echo esc_html( $whop_endpoint ); ?></code>
    </div>

    <div class="card">
        <div class="row">
            <h2>Stripe</h2>
            <span class="status <?php echo $stripe_configured ? 'ok' : 'bad'; ?>"><?php echo $stripe_configured ? 'Configured' : 'Not configured'; ?></span>
        </div>
        <p class="small">Use the <strong>checkout.session.completed</strong> snapshot event from your live account.</p>
        <label>Endpoint URL</label>
        <code><?php echo esc_html( $stripe_endpoint ); ?></code>
    </div>

    <form method="post" class="card">
        <?php wp_nonce_field( 'slayerkey_sales_webhook_settings' ); ?>
        <h2>Save signing secrets</h2>
        <p class="small">Leave a field blank to keep the currently saved value.</p>

        <label for="whop_secret">Whop signing secret</label>
        <input id="whop_secret" name="whop_secret" type="password" autocomplete="off" placeholder="ws_...">
        <?php if ( $whop_configured ) : ?>
            <label class="clear"><input type="checkbox" name="clear_whop" value="1"> Clear saved Whop secret</label>
        <?php endif; ?>

        <div class="sep"></div>

        <label for="stripe_secret">Stripe signing secret</label>
        <input id="stripe_secret" name="stripe_secret" type="password" autocomplete="off" placeholder="whsec_...">
        <?php if ( $stripe_configured ) : ?>
            <label class="clear"><input type="checkbox" name="clear_stripe" value="1"> Clear saved Stripe secret</label>
        <?php endif; ?>

        <button type="submit">Save secrets</button>
    </form>
</div>
</body>
</html>
