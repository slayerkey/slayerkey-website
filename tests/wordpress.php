<?php
// Exercise real plugin functions with a minimal WordPress API boundary, no database.
define('ABSPATH', __DIR__);
define('DAY_IN_SECONDS', 86400);
define('MINUTE_IN_SECONDS', 60);
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
    if ($name === 'slayerkey_whop_api_key') return $GLOBALS['whop_api_key'] ?? $default;
    return $default;
}
function get_transient($key) { return $GLOBALS['transients'][$key] ?? false; }
function set_transient($key, $value, $ttl) { $GLOBALS['transients'][$key] = $value; return true; }
function wp_remote_post($url, $args) {
    $GLOBALS['last_remote_post'] = [$url, $args];
    if (str_contains($url, '/checkout_configurations')) {
        return [
            'response' => ['code' => 200],
            'body' => json_encode([
                'id' => 'ch_test',
                'purchase_url' => 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?session=ch_test',
            ]),
        ];
    }
    return ['response' => ['code' => 200], 'body' => '{}'];
}
function wp_remote_retrieve_response_code($response) { return $response['response']['code'] ?? 0; }
function wp_remote_retrieve_body($response) { return $response['body'] ?? ''; }
function wp_json_encode($value) { return json_encode($value); }
function plugin_dir_path($file) { return dirname($file) . '/'; }
function plugin_dir_url($file) { return 'https://slayerkey.com/wp-content/plugins/slayerkey-website/'; }
function esc_url($value) { return $value; }
function esc_url_raw($value) { return $value; }
function home_url($path = '') { return 'https://slayerkey.com' . $path; }
function rest_url($path = '') { return 'https://slayerkey.com/wp-json/' . ltrim($path, '/'); }
function sanitize_text_field($value) { return (string) $value; }
function is_admin() { return false; }
function wp_parse_url($url, $component) { return parse_url($url, $component); }
function wp_unslash($value) { return $value; }
function sanitize_key($value) { return $value; }
function untrailingslashit($value) { return rtrim($value, '/'); }
function wp_enqueue_script(...$args) { $GLOBALS['enqueued'][] = $args; }
function wp_localize_script($handle, $name, $data) { $GLOBALS['localized'][$name] = $data; }
function check($value, $message) { if (!$value) throw new RuntimeException($message); }

$plugin = $argv[1] ?? __DIR__ . '/../wordpress/slayerkey-website';
require $plugin . '/slayerkey-website.php';
$_SERVER['REQUEST_URI'] = '/';
slayerkey_website_enqueue_tracking();
$GLOBALS['whop_api_key'] = 'test_whop_company_api_key_1234567890';
check($GLOBALS['enqueued'][0][1] === plugin_dir_url('') . SLAYERKEY_TRACKING_ASSET, 'Tracking enqueue URL');
check(($GLOBALS['localized']['SK_TRACKING_CONFIG']['whop_attribution_enabled'] ?? false) === true, 'Whop attribution localized when API key exists');
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
check(isset($GLOBALS['rest_routes']['slayerkey/v1/whop-checkout']), 'Attributed Whop checkout REST route registered');
check($GLOBALS['rest_routes']['slayerkey/v1/whop-checkout']['methods'] === 'POST', 'Attributed Whop checkout route is POST-only');

$checkoutRequest = new class {
    public function get_json_params() {
        return [
            'plan_id' => 'plan_eVop6pXsIhHlf',
            'metadata' => [
                'posthog_distinct_id' => 'visitor_test',
                'posthog_session_id' => 'session_test',
                'utm_source' => 'youtube',
                'utm_campaign' => 'yt_test',
                'cta_id' => 'dojo-plan-monthly',
            ],
        ];
    }
};
$checkoutResult = slayerkey_website_whop_checkout_response($checkoutRequest);
check($checkoutResult->status === 200, 'Attributed checkout configuration created');
check(($checkoutResult->data['purchase_url'] ?? '') === 'https://whop.com/checkout/plan_eVop6pXsIhHlf/?session=ch_test', 'Attributed checkout returns Whop URL');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], 'visitor_test'), 'Checkout forwards PostHog identity as Whop metadata');

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
        'metadata' => [
            'posthog_distinct_id' => 'visitor_test',
            'posthog_session_id' => 'session_test',
            'utm_source' => 'youtube',
            'utm_campaign' => 'yt_test',
            'cta_id' => 'dojo-plan-monthly',
            'cta_location' => 'plan_chooser_monthly',
            'route' => 'website',
        ],
    ],
]);
$webhookSignature = 'v1,' . base64_encode(hash_hmac('sha256', $webhookId . '.' . $webhookTimestamp . '.' . $webhookBody, $GLOBALS['whop_test_secret'], true));
$webhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check($webhookResult['status'] === 200 && $webhookResult['body']['ok'] === true, 'Valid Whop payment webhook accepted');
check(isset($GLOBALS['last_remote_post'][1]['body']) && str_contains($GLOBALS['last_remote_post'][1]['body'], 'sale_confirmed'), 'Whop payment captured to PostHog');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"distinct_id":"visitor_test"'), 'Whop payment reuses the website PostHog identity');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"utm_campaign":"yt_test"'), 'Whop payment carries campaign attribution into PostHog');
$invalidWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, 'msg_test_sale_2', $webhookTimestamp, 'v1,invalid');
check($invalidWebhookResult['status'] === 400, 'Invalid Whop signature rejected');
if (file_exists($plugin . '/DEPLOYED_ASSETS.json')) {
    $manifest = json_decode(file_get_contents($plugin . '/DEPLOYED_ASSETS.json'), true);
    check(SLAYERKEY_TRACKING_ASSET === $manifest['tracking_js'], 'Built tracking constant');
    check($health['tracking_sha256'] === $manifest['tracking_js_sha256'], 'Manifest/health agreement');
    check(slayerkey_website_preview_map()['dojo-v3']['script'] === $manifest['dojo_js'], 'Built Dojo enqueue');
}
echo "WordPress rendering, REST routes, Whop webhooks, attribution, enqueues and health passed.\n";
