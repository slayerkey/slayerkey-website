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
    if ($name === 'slayerkey_stripe_webhook_secret') return $GLOBALS['stripe_test_secret'] ?? $default;
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
$GLOBALS['whop_test_secret'] = 'ws_test_secret';
check(slayerkey_sales_whop_signing_key('ws_test_secret') === 'ws_test_secret', 'Current Whop ws_ secret uses literal HMAC key bytes');
$legacyKeyBytes = 'legacy_test_key_bytes_1234567890';
$legacySecret = 'whsec_' . rtrim(base64_encode($legacyKeyBytes), '=');
check(slayerkey_sales_whop_signing_key($legacySecret) === $legacyKeyBytes, 'Legacy whsec_ secret decodes Standard Webhooks key bytes');

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
        'user_id' => 'user_test_repeat',
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
$legacyWebhookId = 'msg_test_legacy_whsec';
$legacyPayload = json_decode($webhookBody, true);
$legacyPayload['id'] = $legacyWebhookId;
$legacyPayload['data']['user_id'] = 'user_legacy_secret';
$legacyBody = json_encode($legacyPayload);
$GLOBALS['whop_test_secret'] = $legacySecret;
$legacySignature = 'v1,' . base64_encode(hash_hmac('sha256', $legacyWebhookId . '.' . $webhookTimestamp . '.' . $legacyBody, $legacyKeyBytes, true));
$legacyResult = slayerkey_sales_handle_whop_webhook($legacyBody, $legacyWebhookId, $webhookTimestamp, $legacySignature);
check($legacyResult['status'] === 200 && $legacyResult['body']['ok'] === true, 'Legacy whsec_ Whop signature accepted with decoded key bytes');
$GLOBALS['whop_test_secret'] = 'ws_test_secret';

$invalidWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, 'msg_test_sale_2', $webhookTimestamp, 'v1,invalid');
check($invalidWebhookResult['status'] === 400, 'Invalid Whop signature rejected');

check(str_starts_with(slayerkey_sales_pseudonymous_id('stripe_customer', 'cus_test_123'), 'stripe_customer_'), 'Provider customer ID can be pseudonymized');
check(!str_contains(slayerkey_sales_pseudonymous_id('stripe_customer', 'cus_test_123'), 'cus_test_123'), 'Pseudonymous provider identity hides raw customer ID');

$whopStringPayload = json_decode($webhookBody, true);
$whopStringPayload['id'] = 'msg_test_sale_string_user';
$whopStringPayload['data']['user'] = 'user_string_shape';
unset($whopStringPayload['data']['user_id']);
$whopStringBody = json_encode($whopStringPayload);
$whopStringSignature = 'v1,' . base64_encode(hash_hmac('sha256', 'msg_test_sale_string_user' . '.' . $webhookTimestamp . '.' . $whopStringBody, $GLOBALS['whop_test_secret'], true));
$whopStringResult = slayerkey_sales_handle_whop_webhook($whopStringBody, 'msg_test_sale_string_user', $webhookTimestamp, $whopStringSignature);
check($whopStringResult['status'] === 200 && $whopStringResult['body']['ok'] === true, 'Whop string user ID shape accepted');
$whopStringPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($whopStringPostHog['distinct_id'], 'whop_user_'), 'Whop string user ID shape pseudonymized');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_string_shape'), 'Raw Whop string user ID is not sent to PostHog');

$whopExpandedPayload = json_decode($webhookBody, true);
$whopExpandedPayload['id'] = 'msg_test_sale_expanded_user';
$whopExpandedPayload['data']['user'] = ['id' => 'user_expanded_shape'];
unset($whopExpandedPayload['data']['user_id']);
$whopExpandedBody = json_encode($whopExpandedPayload);
$whopExpandedSignature = 'v1,' . base64_encode(hash_hmac('sha256', 'msg_test_sale_expanded_user' . '.' . $webhookTimestamp . '.' . $whopExpandedBody, $GLOBALS['whop_test_secret'], true));
$whopExpandedResult = slayerkey_sales_handle_whop_webhook($whopExpandedBody, 'msg_test_sale_expanded_user', $webhookTimestamp, $whopExpandedSignature);
check($whopExpandedResult['status'] === 200 && $whopExpandedResult['body']['ok'] === true, 'Whop expanded user shape accepted');
$whopExpandedPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($whopExpandedPostHog['distinct_id'], 'whop_user_'), 'Whop expanded user shape pseudonymized');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_expanded_shape'), 'Raw Whop expanded user ID is not sent to PostHog');

$GLOBALS['stripe_test_secret'] = 'whsec_stripe_test_secret';
$stripeWebhookTimestamp = (string) time();
$stripeWebhookBody = json_encode([
    'id' => 'evt_test_stripe_1',
    'type' => 'checkout.session.completed',
    'data' => [
        'object' => [
            'payment_status' => 'paid',
            'mode' => 'payment',
            'customer' => 'cus_repeat_buyer_123',
        ],
    ],
]);
$stripeWebhookSignature = 't=' . $stripeWebhookTimestamp . ',v1=' . hash_hmac(
    'sha256',
    $stripeWebhookTimestamp . '.' . $stripeWebhookBody,
    $GLOBALS['stripe_test_secret']
);
$stripeWebhookResult = slayerkey_sales_handle_stripe_webhook($stripeWebhookBody, $stripeWebhookSignature);
check($stripeWebhookResult['status'] === 200 && $stripeWebhookResult['body']['ok'] === true, 'Valid Stripe payment webhook accepted');
$stripeWebhookPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check($stripeWebhookPostHog['event'] === 'sale_confirmed', 'Stripe payment captured to PostHog');
check(str_starts_with($stripeWebhookPostHog['distinct_id'], 'stripe_customer_'), 'Stripe sale uses pseudonymous customer identity when available');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'cus_repeat_buyer_123'), 'Raw Stripe customer ID is not sent to PostHog');
check(($stripeWebhookPostHog['properties']['identity_source'] ?? '') === 'stripe_customer_id_hash', 'Stripe identity source is recorded without exposing identity');

$stripePostBeforeDuplicate = $GLOBALS['last_remote_post'][1]['body'];
$stripeDuplicateResult = slayerkey_sales_handle_stripe_webhook($stripeWebhookBody, $stripeWebhookSignature);
check(!empty($stripeDuplicateResult['body']['duplicate']), 'Duplicate Stripe webhook ignored');
check($GLOBALS['last_remote_post'][1]['body'] === $stripePostBeforeDuplicate, 'Duplicate Stripe webhook does not recapture PostHog event');

$stripeInvalidResult = slayerkey_sales_handle_stripe_webhook($stripeWebhookBody, 't=' . $stripeWebhookTimestamp . ',v1=invalid');
check($stripeInvalidResult['status'] === 400, 'Invalid Stripe signature rejected');

$stripeUnpaidBody = json_encode([
    'id' => 'evt_test_stripe_unpaid',
    'type' => 'checkout.session.completed',
    'data' => [
        'object' => [
            'payment_status' => 'unpaid',
            'mode' => 'payment',
        ],
    ],
]);
$stripeUnpaidSignature = 't=' . $stripeWebhookTimestamp . ',v1=' . hash_hmac(
    'sha256',
    $stripeWebhookTimestamp . '.' . $stripeUnpaidBody,
    $GLOBALS['stripe_test_secret']
);
$stripeUnpaidResult = slayerkey_sales_handle_stripe_webhook($stripeUnpaidBody, $stripeUnpaidSignature);
check(!empty($stripeUnpaidResult['body']['ignored']) && ($stripeUnpaidResult['body']['reason'] ?? '') === 'not_paid', 'Unpaid Stripe Checkout Session ignored');

$stripeNoCustomerBody = json_encode([
    'id' => 'evt_test_stripe_no_customer',
    'type' => 'checkout.session.completed',
    'data' => [
        'object' => [
            'payment_status' => 'paid',
            'mode' => 'payment',
        ],
    ],
]);
$stripeNoCustomerSignature = 't=' . $stripeWebhookTimestamp . ',v1=' . hash_hmac(
    'sha256',
    $stripeWebhookTimestamp . '.' . $stripeNoCustomerBody,
    $GLOBALS['stripe_test_secret']
);
$stripeNoCustomerResult = slayerkey_sales_handle_stripe_webhook($stripeNoCustomerBody, $stripeNoCustomerSignature);
check($stripeNoCustomerResult['status'] === 200 && $stripeNoCustomerResult['body']['ok'] === true, 'Stripe sale without Customer still accepted');
$stripeNoCustomerPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($stripeNoCustomerPostHog['distinct_id'], 'sale:stripe:'), 'Stripe sale without Customer falls back to event identity');

if (file_exists($plugin . '/DEPLOYED_ASSETS.json')) {
    $manifest = json_decode(file_get_contents($plugin . '/DEPLOYED_ASSETS.json'), true);
    check(SLAYERKEY_TRACKING_ASSET === $manifest['tracking_js'], 'Built tracking constant');
    check($health['tracking_sha256'] === $manifest['tracking_js_sha256'], 'Manifest/health agreement');
    check(slayerkey_website_preview_map()['dojo-v3']['script'] === $manifest['dojo_js'], 'Built Dojo enqueue');
}
echo "WordPress rendering, REST routes, Whop webhooks, attribution, enqueues and health passed.\n";
