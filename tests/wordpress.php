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
    if ($name === 'slayerkey_dojo_identity_bridge_url') return $GLOBALS['dojo_bridge_url'] ?? $default;
    if ($name === 'slayerkey_dojo_identity_bridge_secret') return $GLOBALS['dojo_bridge_secret'] ?? $default;
    return $default;
}
function get_transient($key) { return $GLOBALS['transients'][$key] ?? false; }
function set_transient($key, $value, $ttl) { $GLOBALS['transients'][$key] = $value; return true; }
function wp_remote_post($url, $args) {
    $GLOBALS['last_remote_post'] = [$url, $args];
    $GLOBALS['remote_posts'][] = [$url, $args];
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
function wp_remote_get($url, $args) {
    $GLOBALS['last_remote_get'] = [$url, $args];
    $GLOBALS['remote_gets'][] = [$url, $args];

    if (str_contains($url, '/api/v1/events')) {
        if (!empty($GLOBALS['whop_events_http_status']) && (int) $GLOBALS['whop_events_http_status'] !== 200) {
            return [
                'response' => ['code' => (int) $GLOBALS['whop_events_http_status']],
                'body' => json_encode(['error' => ['message' => 'forbidden']]),
            ];
        }

        $query = [];
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $data = [];

        if (($query['identifier'] ?? '') === 'user_direct_123') {
            $data[] = [
                'event_id' => 'evt_direct_payment',
                'event_name' => 'payment.completed',
                'context' => [
                    'utm_source' => 'youtube',
                    'utm_medium' => 'description',
                    'utm_campaign' => 'yt_30day',
                    'utm_content' => 'cta_3min',
                ],
                'related' => [
                    'payment' => ['id' => 'pay_direct_123'],
                    'user' => ['id' => 'user_direct_123'],
                ],
            ];
        } elseif (empty($query['identifier'])) {
            $data[] = [
                'event_id' => 'evt_recent_payment',
                'event_name' => 'payment.completed',
                'context' => [
                    'utm_source' => 'youtube',
                    'utm_medium' => 'description',
                    'utm_campaign' => 'yt_30day',
                    'utm_content' => 'cta_3min',
                ],
                'related' => [
                    'payment' => ['id' => 'pay_recent'],
                    'user' => ['id' => 'user_recent'],
                ],
            ];
        }

        return [
            'response' => ['code' => 200],
            'body' => json_encode([
                'data' => $data,
                'page_info' => [
                    'has_next_page' => false,
                    'has_previous_page' => false,
                    'end_cursor' => null,
                    'start_cursor' => null,
                ],
            ]),
        ];
    }

    return ['response' => ['code' => 404], 'body' => '{}'];
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
function wp_generate_uuid4() { return '11111111-2222-4333-8444-555555555555'; }
function wp_redirect($location, $status = 302, $x_redirect_by = '') { $GLOBALS['redirect'] = [$location, $status, $x_redirect_by]; return true; }
function sanitize_key($value) { return $value; }
function untrailingslashit($value) { return rtrim($value, '/'); }
function wp_enqueue_script(...$args) { $GLOBALS['enqueued'][] = $args; }
function wp_localize_script($handle, $name, $data) { $GLOBALS['localized'][$name] = $data; }
function check($value, $message) { if (!$value) throw new RuntimeException($message); }

$plugin = $argv[1] ?? __DIR__ . '/../wordpress/slayerkey-website';
require $plugin . '/slayerkey-website.php';
$GLOBALS['whop_api_key'] = 'test_whop_company_api_key_1234567890';
$_SERVER['REQUEST_URI'] = '/';
slayerkey_website_enqueue_tracking();
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
check(isset($GLOBALS['rest_routes']['slayerkey/v1/whop-attribution-health']), 'Whop attribution health route registered');
check($GLOBALS['rest_routes']['slayerkey/v1/whop-attribution-health']['methods'] === 'GET', 'Whop attribution health route is GET-only');
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

$directResult = slayerkey_website_build_direct_dojo_checkout([
    'plan' => 'monthly',
    'utm_source' => 'youtube',
    'utm_medium' => 'description',
    'utm_campaign' => 'yt_30day',
    'utm_content' => 'cta_3min',
]);
check($directResult['ok'] === true, 'Direct Whop redirect creates checkout configuration');
check(str_contains($directResult['destination'], 'whop.com/checkout/'), 'Direct Whop redirect returns hosted checkout URL');
check(($directResult['metadata']['utm_campaign'] ?? '') === 'yt_30day', 'Direct checkout preserves campaign in Whop metadata');
check(($directResult['metadata']['utm_content'] ?? '') === 'cta_3min', 'Direct checkout preserves content in Whop metadata');
check(($directResult['metadata']['route'] ?? '') === 'direct_whop', 'Direct checkout marks direct route');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"event":"begin_checkout"'), 'Direct route emits live PostHog begin_checkout event');

require_once $plugin . '/sales-webhook-common.php';
$GLOBALS['whop_test_secret'] = 'whsec_test_secret';
$webhookId = 'msg_test_sale_1';
$webhookTimestamp = (string) time();
$webhookBody = json_encode([
    'id' => $webhookId,
    'api_version' => 'v1',
    'type' => 'payment.succeeded',
    'data' => [
        'id' => 'pay_direct_123',
        'status' => 'paid',
        'billing_reason' => 'subscription_create',
        'product' => ['id' => 'prod_test'],
        'plan' => ['id' => 'plan_test'],
        'user_id' => 'user_website_linked_private',
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
$GLOBALS['dojo_bridge_url'] = 'https://dojo.example/internal/customer-identity';
$GLOBALS['dojo_bridge_secret'] = 'test_dojo_bridge_secret';
$webhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check($webhookResult['status'] === 200 && $webhookResult['body']['ok'] === true, 'Valid Whop payment webhook accepted');
check(isset($GLOBALS['last_remote_post'][1]['body']) && str_contains($GLOBALS['last_remote_post'][1]['body'], 'sale_confirmed'), 'Whop payment captured to PostHog');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"distinct_id":"visitor_test"'), 'Whop payment reuses the website PostHog identity');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"utm_campaign":"yt_test"'), 'Whop payment carries campaign attribution into PostHog');

$bridgePosts = array_values(array_filter(
    $GLOBALS['remote_posts'] ?? array(),
    function ($item) { return ($item[0] ?? '') === 'https://dojo.example/internal/customer-identity'; }
));
check(count($bridgePosts) >= 1, 'Website payment webhook sends server-side identity handoff to Dojo');
$bridgeRequest = $bridgePosts[count($bridgePosts) - 1][1];
$bridgePayload = json_decode($bridgeRequest['body'] ?? '', true);
check(($bridgePayload['whop_user_id'] ?? '') === 'user_website_linked_private', 'Dojo handoff carries raw Whop ID only server-to-server');
check(($bridgePayload['posthog_distinct_id'] ?? '') === 'visitor_test', 'Dojo handoff carries original website PostHog distinct ID');
check(($bridgePayload['payment_id'] ?? '') === 'pay_direct_123', 'Dojo handoff carries the Whop payment ID for server-side verification');
$bridgeTimestamp = $bridgeRequest['headers']['X-Slayerkey-Timestamp'] ?? '';
$bridgeExpected = 'sha256=' . hash_hmac('sha256', $bridgeTimestamp . '.' . ($bridgeRequest['body'] ?? ''), $GLOBALS['dojo_bridge_secret']);
check(($bridgeRequest['headers']['X-Slayerkey-Signature'] ?? '') === $bridgeExpected, 'Dojo identity handoff is HMAC authenticated');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_website_linked_private'), 'Raw Whop user ID is not sent to PostHog');

$GLOBALS['dojo_bridge_secret'] = '';
$paymentProofBridgeConfig = slayerkey_sales_dojo_identity_bridge_config();
check(!is_wp_error($paymentProofBridgeConfig) && ($paymentProofBridgeConfig['secret'] ?? '') === '', 'Dojo bridge can use Whop payment proof without a shared secret');
$bridgeCountBeforeDirect = count($bridgePosts);


$GLOBALS['transients'] = [];
$directUserId = 'user_direct_123';
$directWebhookId = 'msg_direct_sale_1';
$directWebhookBody = json_encode([
    'id' => $directWebhookId,
    'api_version' => 'v1',
    'type' => 'payment.succeeded',
    'data' => [
        'id' => 'pay_direct_123',
        'status' => 'paid',
        'billing_reason' => 'subscription_create',
        'product' => ['id' => 'prod_test'],
        'plan' => ['id' => 'plan_eVop6pXsIhHlf'],
        'user' => ['id' => $directUserId],
        'final_amount' => 19.99,
        'currency' => 'usd',
        'metadata' => [],
    ],
]);
$directWebhookSignature = 'v1,' . base64_encode(hash_hmac('sha256', $directWebhookId . '.' . $webhookTimestamp . '.' . $directWebhookBody, $GLOBALS['whop_test_secret'], true));
$directWebhookResult = slayerkey_sales_handle_whop_webhook($directWebhookBody, $directWebhookId, $webhookTimestamp, $directWebhookSignature);
check($directWebhookResult['status'] === 200, 'Direct Whop payment webhook accepted');
$directPayload = $GLOBALS['last_remote_post'][1]['body'];
$expectedDirectId = slayerkey_sales_pseudonymous_id('whop_user', $directUserId);
check(str_contains($directPayload, '"distinct_id":"' . $expectedDirectId . '"'), 'Direct Whop buyer uses deterministic pseudonymous identity');
check(!str_contains($directPayload, $directUserId), 'Raw Whop user ID is never sent to PostHog');
check(str_contains($directPayload, '"revenue":19.99'), 'Verified Whop payment carries revenue');
check(str_contains($directPayload, '"currency":"USD"'), 'Verified Whop payment carries currency');
check(str_contains($directPayload, '"utm_source":"youtube"'), 'Direct Whop purchase recovers source from matching Whop payment event');
check(str_contains($directPayload, '"utm_medium":"description"'), 'Direct Whop purchase recovers medium from matching Whop payment event');
check(str_contains($directPayload, '"utm_campaign":"yt_30day"'), 'Direct Whop purchase recovers campaign from matching Whop payment event');
check(str_contains($directPayload, '"utm_content":"cta_3min"'), 'Direct Whop purchase recovers content from matching Whop payment event');
check(str_contains($directPayload, '"attribution_source":"whop_events_api"'), 'Direct Whop purchase records Whop Events API as attribution source');
$bridgePostsAfterDirect = array_values(array_filter(
    $GLOBALS['remote_posts'] ?? array(),
    function ($item) { return str_contains((string) ($item[0] ?? ''), '/internal/customer-identity'); }
));
check(count($bridgePostsAfterDirect) === $bridgeCountBeforeDirect, 'Direct Whop purchase does not require website-to-Dojo identity handoff');
check(($GLOBALS['last_remote_get'][1]['headers']['Authorization'] ?? '') === 'Bearer test_whop_company_api_key_1234567890', 'Whop Events API uses stored company API key');
check(($GLOBALS['last_remote_get'][1]['headers']['Api-Version-Date'] ?? '') === '2026-09-22-2', 'Whop Events API request pins API version');

$GLOBALS['transients'] = [];
$directWebhookId2 = 'msg_direct_sale_2';
$directWebhookBody2 = str_replace($directWebhookId, $directWebhookId2, $directWebhookBody);
$directWebhookSignature2 = 'v1,' . base64_encode(hash_hmac('sha256', $directWebhookId2 . '.' . $webhookTimestamp . '.' . $directWebhookBody2, $GLOBALS['whop_test_secret'], true));
$directWebhookResult2 = slayerkey_sales_handle_whop_webhook($directWebhookBody2, $directWebhookId2, $webhookTimestamp, $directWebhookSignature2);
check($directWebhookResult2['status'] === 200, 'Second direct Whop payment webhook accepted');
check(str_contains($GLOBALS['last_remote_post'][1]['body'], '"distinct_id":"' . $expectedDirectId . '"'), 'Same Whop user keeps same pseudonymous identity across payments');

$GLOBALS['transients'] = [];
$diag = slayerkey_website_whop_attribution_health_response();
check($diag->status === 200, 'Whop attribution health responds successfully');
check(($diag->data['configured'] ?? false) === true, 'Whop attribution health sees stored API key');
check(($diag->data['events_readable'] ?? false) === true, 'Whop Events API is readable');
check(($diag->data['recent_payment_events_found'] ?? false) === true, 'Recent Whop payment events are visible');
check(($diag->data['recent_attributed_payment_found'] ?? false) === true, 'Recent attributed Whop payment event is visible');
check(($diag->data['recent_youtube_payment_found'] ?? false) === true, 'Recent YouTube-attributed Whop payment event is visible');

$GLOBALS['whop_events_http_status'] = 403;
$GLOBALS['transients'] = [];
$diagForbidden = slayerkey_website_whop_attribution_health_response();
check($diagForbidden->status === 200, 'Whop attribution health fails closed to a safe response');
check(($diagForbidden->data['events_readable'] ?? true) === false, 'Whop attribution health reports unreadable events when permission is denied');
unset($GLOBALS['whop_events_http_status']);

$invalidWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, 'msg_test_sale_2', $webhookTimestamp, 'v1,invalid');
check($invalidWebhookResult['status'] === 400, 'Invalid Whop signature rejected');
if (file_exists($plugin . '/DEPLOYED_ASSETS.json')) {
    $manifest = json_decode(file_get_contents($plugin . '/DEPLOYED_ASSETS.json'), true);
    check(SLAYERKEY_TRACKING_ASSET === $manifest['tracking_js'], 'Built tracking constant');
    check($health['tracking_sha256'] === $manifest['tracking_js_sha256'], 'Manifest/health agreement');
    check(slayerkey_website_preview_map()['dojo-v3']['script'] === $manifest['dojo_js'], 'Built Dojo enqueue');
}
echo "WordPress rendering, REST routes, Whop webhooks, attribution, enqueues and health passed.\n";
