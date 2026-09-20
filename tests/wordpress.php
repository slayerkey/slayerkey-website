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
    if ($name === 'slayerkey_stripe_webhook_secret') return $GLOBALS['stripe_test_secret'] ?? $default;
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

// Whop signing compatibility.
$GLOBALS['whop_test_secret'] = 'ws_test_secret';
check(in_array('ws_test_secret', slayerkey_sales_whop_signing_keys('ws_test_secret'), true), 'Current Whop ws_ secret uses literal HMAC key bytes');
$legacyKeyBytes = 'legacy_test_key_bytes_1234567890';
$legacySecret = 'whsec_' . rtrim(base64_encode($legacyKeyBytes), '=');
check(in_array($legacyKeyBytes, slayerkey_sales_whop_signing_keys($legacySecret), true), 'Legacy whsec_ secret supports decoded Standard Webhooks key bytes');

// Website-linked Whop journey: metadata should preserve the browser PostHog identity.
$webhookId = 'msg_test_sale_linked';
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
        'user_id' => 'user_should_not_override_linked_identity',
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
$webhookSignature = 'v1,' . base64_encode(hash_hmac(
    'sha256',
    $webhookId . '.' . $webhookTimestamp . '.' . $webhookBody,
    $GLOBALS['whop_test_secret'],
    true
));
$webhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check($webhookResult['status'] === 200 && $webhookResult['body']['ok'] === true, 'Valid Whop payment webhook accepted');
$linkedPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(($linkedPostHog['event'] ?? '') === 'sale_confirmed', 'Whop payment captured to PostHog');
check(($linkedPostHog['distinct_id'] ?? '') === 'visitor_test', 'Whop payment reuses website PostHog identity');
check(($linkedPostHog['properties']['$session_id'] ?? '') === 'session_test', 'Whop payment preserves website PostHog session');
check(($linkedPostHog['properties']['utm_campaign'] ?? '') === 'yt_test', 'Whop payment preserves campaign attribution');
check(($linkedPostHog['properties']['journey_linked'] ?? false) === true, 'Whop payment is marked journey linked');
check(($linkedPostHog['properties']['identity_source'] ?? '') === 'website_posthog_distinct_id', 'Whop linked identity source is explicit');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_should_not_override_linked_identity'), 'Raw Whop user ID is not sent when journey identity exists');

$whopPostBeforeDuplicate = $GLOBALS['last_remote_post'][1]['body'];
$duplicateWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, $webhookId, $webhookTimestamp, $webhookSignature);
check(!empty($duplicateWebhookResult['body']['duplicate']), 'Duplicate Whop webhook ignored');
check($GLOBALS['last_remote_post'][1]['body'] === $whopPostBeforeDuplicate, 'Duplicate Whop webhook does not recapture PostHog event');

$invalidWebhookResult = slayerkey_sales_handle_whop_webhook($webhookBody, 'msg_test_sale_invalid', $webhookTimestamp, 'v1,invalid');
check($invalidWebhookResult['status'] === 400, 'Invalid Whop signature rejected');

// Whop fallback identity when checkout metadata is unavailable.
$fallbackPayload = json_decode($webhookBody, true);
$fallbackPayload['id'] = 'msg_test_sale_fallback_user';
$fallbackPayload['data']['user_id'] = 'user_test_repeat';
unset($fallbackPayload['data']['metadata']);
$fallbackBody = json_encode($fallbackPayload);
$fallbackSignature = 'v1,' . base64_encode(hash_hmac(
    'sha256',
    'msg_test_sale_fallback_user' . '.' . $webhookTimestamp . '.' . $fallbackBody,
    $GLOBALS['whop_test_secret'],
    true
));
$fallbackResult = slayerkey_sales_handle_whop_webhook($fallbackBody, 'msg_test_sale_fallback_user', $webhookTimestamp, $fallbackSignature);
check($fallbackResult['status'] === 200 && $fallbackResult['body']['ok'] === true, 'Whop sale without website metadata accepted');
$fallbackPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($fallbackPostHog['distinct_id'], 'whop_user_'), 'Whop fallback uses pseudonymous buyer identity');
check(($fallbackPostHog['properties']['identity_source'] ?? '') === 'whop_user_id_hash', 'Whop fallback identity source is recorded');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_test_repeat'), 'Raw Whop fallback user ID is not sent to PostHog');

$whopStringPayload = $fallbackPayload;
$whopStringPayload['id'] = 'msg_test_sale_string_user';
$whopStringPayload['data']['user'] = 'user_string_shape';
unset($whopStringPayload['data']['user_id']);
$whopStringBody = json_encode($whopStringPayload);
$whopStringSignature = 'v1,' . base64_encode(hash_hmac(
    'sha256',
    'msg_test_sale_string_user' . '.' . $webhookTimestamp . '.' . $whopStringBody,
    $GLOBALS['whop_test_secret'],
    true
));
$whopStringResult = slayerkey_sales_handle_whop_webhook($whopStringBody, 'msg_test_sale_string_user', $webhookTimestamp, $whopStringSignature);
check($whopStringResult['status'] === 200 && $whopStringResult['body']['ok'] === true, 'Whop string user shape accepted');
$whopStringPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($whopStringPostHog['distinct_id'], 'whop_user_'), 'Whop string user shape pseudonymized');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_string_shape'), 'Raw Whop string user ID is not sent to PostHog');

$whopExpandedPayload = $fallbackPayload;
$whopExpandedPayload['id'] = 'msg_test_sale_expanded_user';
$whopExpandedPayload['data']['user'] = ['id' => 'user_expanded_shape'];
unset($whopExpandedPayload['data']['user_id']);
$whopExpandedBody = json_encode($whopExpandedPayload);
$whopExpandedSignature = 'v1,' . base64_encode(hash_hmac(
    'sha256',
    'msg_test_sale_expanded_user' . '.' . $webhookTimestamp . '.' . $whopExpandedBody,
    $GLOBALS['whop_test_secret'],
    true
));
$whopExpandedResult = slayerkey_sales_handle_whop_webhook($whopExpandedBody, 'msg_test_sale_expanded_user', $webhookTimestamp, $whopExpandedSignature);
check($whopExpandedResult['status'] === 200 && $whopExpandedResult['body']['ok'] === true, 'Whop expanded user shape accepted');
$whopExpandedPostHog = json_decode($GLOBALS['last_remote_post'][1]['body'], true);
check(str_starts_with($whopExpandedPostHog['distinct_id'], 'whop_user_'), 'Whop expanded user shape pseudonymized');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'user_expanded_shape'), 'Raw Whop expanded user ID is not sent to PostHog');

// Legacy whsec_ serialization can verify using decoded key bytes.
$legacyWebhookId = 'msg_test_legacy_whsec';
$legacyPayload = $fallbackPayload;
$legacyPayload['id'] = $legacyWebhookId;
$legacyPayload['data']['user_id'] = 'user_legacy_secret';
$legacyBody = json_encode($legacyPayload);
$GLOBALS['whop_test_secret'] = $legacySecret;
$legacySignature = 'v1,' . base64_encode(hash_hmac(
    'sha256',
    $legacyWebhookId . '.' . $webhookTimestamp . '.' . $legacyBody,
    $legacyKeyBytes,
    true
));
$legacyResult = slayerkey_sales_handle_whop_webhook($legacyBody, $legacyWebhookId, $webhookTimestamp, $legacySignature);
check($legacyResult['status'] === 200 && $legacyResult['body']['ok'] === true, 'Legacy whsec_ Whop signature accepted with decoded key bytes');
$GLOBALS['whop_test_secret'] = 'ws_test_secret';

// Shared Stripe handler regression coverage.
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
check(($stripeWebhookPostHog['event'] ?? '') === 'sale_confirmed', 'Stripe payment captured to PostHog');
check(str_starts_with($stripeWebhookPostHog['distinct_id'], 'stripe_customer_'), 'Stripe sale uses pseudonymous customer identity when available');
check(($stripeWebhookPostHog['properties']['identity_source'] ?? '') === 'stripe_customer_id_hash', 'Stripe identity source is recorded');
check(!str_contains($GLOBALS['last_remote_post'][1]['body'], 'cus_repeat_buyer_123'), 'Raw Stripe Customer ID is not sent to PostHog');

$stripePostBeforeDuplicate = $GLOBALS['last_remote_post'][1]['body'];
$stripeDuplicateResult = slayerkey_sales_handle_stripe_webhook($stripeWebhookBody, $stripeWebhookSignature);
check(!empty($stripeDuplicateResult['body']['duplicate']), 'Duplicate Stripe webhook ignored');
check($GLOBALS['last_remote_post'][1]['body'] === $stripePostBeforeDuplicate, 'Duplicate Stripe webhook does not recapture PostHog event');

$stripeInvalidResult = slayerkey_sales_handle_stripe_webhook(
    $stripeWebhookBody,
    't=' . $stripeWebhookTimestamp . ',v1=invalid'
);
check($stripeInvalidResult['status'] === 400, 'Invalid Stripe signature rejected');

$stripeUnpaidBody = json_encode([
    'id' => 'evt_test_stripe_unpaid',
    'type' => 'checkout.session.completed',
    'data' => ['object' => ['payment_status' => 'unpaid', 'mode' => 'payment']],
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
    'data' => ['object' => ['payment_status' => 'paid', 'mode' => 'payment']],
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
echo "WordPress rendering, REST routes, Whop and Stripe webhooks, attribution, privacy, enqueues and health passed.\n";
