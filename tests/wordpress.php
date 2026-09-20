<?php
// Exercise real plugin functions with a minimal WordPress API boundary, no database.
define('ABSPATH', __DIR__);
define('DAY_IN_SECONDS', 86400);
function add_action(...$args) {}
function add_filter(...$args) {}
function add_shortcode(...$args) {}
function has_action(...$args) { return true; }
function rest_ensure_response($data) { return $data; }
function register_rest_route($namespace, $route, $args) { $GLOBALS['rest_routes'][$namespace . $route] = $args; }
class WP_REST_Response {
    public $data;
    public $status;
    public function __construct($data, $status = 200) { $this->data = $data; $this->status = $status; }
}
class WP_Error {
    private $message;
    public function __construct($code, $message) { $this->message = $message; }
    public function get_error_message() { return $this->message; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function get_option($name, $default = '') {
    if ($name === 'slayerkey_whop_webhook_secret') return $GLOBALS['whop_test_secret'] ?? $default;
    return $default;
}
function get_transient($key) { return $GLOBALS['transients'][$key] ?? false; }
function set_transient($key, $value, $ttl) { $GLOBALS['transients'][$key] = $value; return true; }
function wp_remote_post($url, $args) { $GLOBALS['last_remote_post'] = [$url, $args]; return ['response' => ['code' => 200]]; }
function wp_remote_retrieve_response_code($response) { return $response['response']['code'] ?? 0; }
function wp_json_encode($value) { return json_encode($value); }
function plugin_dir_path($file) { return dirname($file) . '/'; }
function plugin_dir_url($file) { return 'https://slayerkey.com/wp-content/plugins/slayerkey-website/'; }
function esc_url($value) { return $value; }
function is_admin() { return false; }
function wp_parse_url($url, $component) { return parse_url($url, $component); }
function wp_unslash($value) { return $value; }
function sanitize_key($value) { return $value; }
function untrailingslashit($value) { return rtrim($value, '/'); }
function wp_enqueue_script(...$args) { $GLOBALS['enqueued'][] = $args; }
function check($value, $message) { if (!$value) throw new RuntimeException($message); }

$plugin = $argv[1] ?? __DIR__ . '/../wordpress/slayerkey-website';
require $plugin . '/slayerkey-website.php';
$_SERVER['REQUEST_URI'] = '/';
slayerkey_website_enqueue_tracking();
check($GLOBALS['enqueued'][0][1] === plugin_dir_url('') . SLAYERKEY_TRACKING_ASSET, 'Tracking enqueue URL');
$html = file_get_contents($plugin . '/previews/dojo-v3/index.html');
$public = slayerkey_website_prepare_public_dojo_html($html);
$preview = slayerkey_website_prepare_preview_html($html, 'dojo-v3');
check(str_contains($public, 'srcset="https://slayerkey.com/wp-content/plugins/slayerkey-website/previews/dojo-v3/assets/'), 'First responsive source');
check(!str_contains($public, ', assets/'), 'All responsive candidates resolved');
check(str_contains($preview, 'href="/preview/dojo-v3/#pricing"'), 'Private pricing anchor');
check(str_contains($preview, 'utm_source=private_preview'), 'Preview attribution');
check(!str_contains($public, 'utm_source=private_preview'), 'Public attribution');
check(str_contains($public, 'id="dojoVideoFacade"'), 'Accessible video facade');
check(str_contains($public, 'href="https://www.youtube.com/watch?v=H7hYaHnT6ko"'), 'Native video fallback');
check(!str_contains($public, '<iframe id="dojoVideo"'), 'YouTube iframe deferred');
$health = slayerkey_website_health_response();
check($health['tracking_sha256'] === hash_file('sha256', $plugin . '/' . SLAYERKEY_TRACKING_ASSET), 'Health tracking bytes');
slayerkey_website_register_health_route();
check(isset($GLOBALS['rest_routes']['slayerkey/v1/health']), 'Health REST route registered');
check(isset($GLOBALS['rest_routes']['slayerkey/v1/whop-webhook']), 'Whop REST route registered');
check($GLOBALS['rest_routes']['slayerkey/v1/whop-webhook']['methods'] === 'POST', 'Whop REST route is POST-only');

require_once $plugin . '/sales-webhook-common.php';
$GLOBALS['whop_test_secret'] = 'whsec_test_secret';
$webhookId = 'msg_test_sale_1';
$webhookTimestamp = (string) time();
$webhookBody = json_encode([
    'id' => $webhookId,
    'api_version' => 'v1',
    'type' => 'payment.succeeded',
    'data' => [
        'status' => 'paid',
        'billing_reason' => 'subscription_create',
        'product' => ['id' => 'prod_test'],
        'plan' => ['id' => 'plan_test'],
        'user' => ['id' => 'user_test_repeat'],
    ],
]);
$webhookSignature = 'v1,' . base64_encode(hash_hmac('sha256', $webhookId . '.' . $webhookTimestamp . '.' . $webhookBody, $GLOBALS['whop_test_secret'], true));
$webhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check($webhookResult['status'] === 200 && $webhookResult['body']['ok'] === true, 'Valid Whop payment webhook accepted');
check(isset($GLOBALS['last_remote_post'][1]['body']) && str_contains($GLOBALS['last_remote_post'][1]['body'], 'sale_confirmed'), 'Whop payment captured to PostHog');
$whopPayload = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($whopPayload['distinct_id'], 'whop_user_'), 'Whop sale uses pseudonymous buyer identity');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_test_repeat'), 'Raw Whop user ID is not sent to PostHog');
$whopPostBeforeDuplicate = $GLOBALS['last_remote_post'][1]['body'];
$duplicateWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check(!empty($duplicateWebhookResult['body']['duplicate']), 'Duplicate Whop webhook ignored');
check($GLOBALS['last_remote_post'][1]['body'] === $whopPostBeforeDuplicate, 'Duplicate Whop webhook does not recapture PostHog event');
$invalidWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, 'msg_test_sale_2', $webhookTimestamp, 'v1,invalid');
check($invalidWebhookResult['status'] === 400, 'Invalid Whop signature rejected');

check(slayerkey_sales_safe_client_reference_id('ph_browser_123-abc') === 'ph_browser_123-abc', 'Valid Stripe client reference accepted');
check(str_starts_with(slayerkey_sales_pseudonymous_id('stripe_customer', 'cus_test_123'), 'stripe_customer_'), 'Provider customer ID can be pseudonymized');
check(!str_contains(slayerkey_sales_pseudonymous_id('stripe_customer', 'cus_test_123'), 'cus_test_123'), 'Pseudonymous provider identity hides raw customer ID');
check(slayerkey_sales_safe_client_reference_id('email@example.com') === '', 'PII-shaped invalid Stripe client reference rejected');
check(slayerkey_sales_safe_client_reference_id(str_repeat('a', 201)) === '', 'Oversized Stripe client reference rejected');

$stripeCapture = slayerkey_sales_posthog_capture(
    'stripe',
    'evt_test_stripe_sale',
    ['stripe_event_type' => 'checkout.session.completed'],
    'ph_browser_123-abc'
);
check($stripeCapture === true, 'Stripe PostHog capture accepted');
$stripePayload = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check($stripePayload['distinct_id'] === 'ph_browser_123-abc', 'Stripe sale uses validated browser distinct ID');

$fallbackCapture = slayerkey_sales_posthog_capture(
    'stripe',
    'evt_test_stripe_fallback',
    ['stripe_event_type' => 'checkout.session.completed'],
    'email@example.com'
);
check($fallbackCapture === true, 'Stripe fallback capture accepted');
$fallbackPayload = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($fallbackPayload['distinct_id'], 'sale:stripe:'), 'Invalid Stripe reference falls back to event identity');

$stripeSource = file_get_contents($plugin . '/stripe-webhook.php');
check(str_contains($stripeSource, "client_reference_id"), 'Stripe webhook reads client reference ID');
check(str_contains($stripeSource, "identity_source"), 'Stripe webhook records identity source without exposing the ID');
if (file_exists($plugin . '/DEPLOYED_ASSETS.json')) {
    $manifest = json_decode(file_get_contents($plugin . '/DEPLOYED_ASSETS.json'), true);
    check(SLAYERKEY_TRACKING_ASSET === $manifest['tracking_js'], 'Built tracking constant');
    check($health['tracking_sha256'] === $manifest['tracking_js_sha256'], 'Manifest/health agreement');
    check(slayerkey_website_preview_map()['dojo-v3']['script'] === $manifest['dojo_js'], 'Built Dojo enqueue');
}
echo "WordPress rendering, REST routes, Whop webhooks, attribution, enqueues and health passed.\n";
