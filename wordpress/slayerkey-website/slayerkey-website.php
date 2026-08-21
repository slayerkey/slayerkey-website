<?php
/**
 * Plugin Name: Slayerkey Website
 * Description: GitHub managed page rendering and analytics foundation for slayerkey.com.
 * Version: 0.1.2
 * Author: Slayerkey
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SLAYERKEY_WEBSITE_VERSION', '0.1.2' );
define( 'SLAYERKEY_POSTHOG_TOKEN', 'phc_m92yxHMa2BTnSu7KmebGKu8sEitMki4oPhdLTKZzcpMc' );
define( 'SLAYERKEY_POSTHOG_HOST', 'https://us.i.posthog.com' );
define( 'SLAYERKEY_POSTHOG_SMOKE_OPTION', 'slayerkey_posthog_server_smoke_012' );

function slayerkey_website_diagnostic_marker() {
    if ( is_admin() ) {
        return;
    }

    echo "\n<!-- Slayerkey Website " . esc_html( SLAYERKEY_WEBSITE_VERSION ) . " active -->\n";
}
add_action( 'wp_head', 'slayerkey_website_diagnostic_marker', 0 );

function slayerkey_website_run_server_smoke_test() {
    if ( get_option( SLAYERKEY_POSTHOG_SMOKE_OPTION ) ) {
        return;
    }

    $payload = array(
        'api_key' => SLAYERKEY_POSTHOG_TOKEN,
        'distinct_id' => 'slayerkey-wordpress-server-smoke',
        'event' => 'integration smoke test',
        'properties' => array(
            'source' => 'slayerkey-wordpress-plugin',
            'plugin_version' => SLAYERKEY_WEBSITE_VERSION,
            '$process_person_profile' => false,
        ),
    );

    $response = wp_remote_post(
        SLAYERKEY_POSTHOG_HOST . '/i/v0/e/',
        array(
            'timeout' => 5,
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode( $payload ),
        )
    );

    if ( is_wp_error( $response ) ) {
        update_option(
            SLAYERKEY_POSTHOG_SMOKE_OPTION,
            array(
                'ok' => false,
                'error' => sanitize_text_field( $response->get_error_message() ),
                'tested_at' => time(),
            ),
            false
        );
        return;
    }

    $status = (int) wp_remote_retrieve_response_code( $response );

    update_option(
        SLAYERKEY_POSTHOG_SMOKE_OPTION,
        array(
            'ok' => $status >= 200 && $status < 300,
            'status' => $status,
            'tested_at' => time(),
        ),
        false
    );
}
add_action( 'init', 'slayerkey_website_run_server_smoke_test', 20 );

function slayerkey_website_probe_homepage() {
    $probe_url = add_query_arg( 'slayerkey_health_probe', (string) time(), home_url( '/' ) );
    $response = wp_remote_get(
        $probe_url,
        array(
            'timeout' => 7,
            'redirection' => 3,
            'headers' => array(
                'Cache-Control' => 'no-cache',
            ),
        )
    );

    if ( is_wp_error( $response ) ) {
        return array(
            'ok' => false,
            'error' => sanitize_text_field( $response->get_error_message() ),
        );
    }

    $body = (string) wp_remote_retrieve_body( $response );
    $headers = wp_remote_retrieve_headers( $response );
    $csp = '';

    if ( isset( $headers['content-security-policy'] ) ) {
        $csp = (string) $headers['content-security-policy'];
    }

    return array(
        'ok' => true,
        'status' => (int) wp_remote_retrieve_response_code( $response ),
        'plugin_marker_present' => false !== strpos( $body, 'Slayerkey Website ' . SLAYERKEY_WEBSITE_VERSION . ' active' ),
        'posthog_init_present' => false !== strpos( $body, 'posthog.init(' ),
        'posthog_asset_host_present' => false !== strpos( $body, 'us-assets.i.posthog.com' ) || false !== strpos( $body, 'replace(".i.posthog.com","-assets.i.posthog.com")' ),
        'tracking_asset_present' => false !== strpos( $body, 'slayerkey-website/assets/js/tracking.js' ),
        'csp_present' => '' !== $csp,
        'csp' => '' !== $csp ? sanitize_text_field( $csp ) : null,
    );
}

function slayerkey_website_health_response() {
    return rest_ensure_response(
        array(
            'plugin_active' => true,
            'version' => SLAYERKEY_WEBSITE_VERSION,
            'posthog_host' => SLAYERKEY_POSTHOG_HOST,
            'tracking_asset' => plugin_dir_url( __FILE__ ) . 'assets/js/tracking.js',
            'server_smoke' => get_option( SLAYERKEY_POSTHOG_SMOKE_OPTION, null ),
            'homepage_probe' => slayerkey_website_probe_homepage(),
        )
    );
}

function slayerkey_website_register_health_route() {
    register_rest_route(
        'slayerkey/v1',
        '/health',
        array(
            'methods' => 'GET',
            'callback' => 'slayerkey_website_health_response',
            'permission_callback' => '__return_true',
        )
    );
}
add_action( 'rest_api_init', 'slayerkey_website_register_health_route' );

function slayerkey_website_posthog_snippet() {
    if ( is_admin() ) {
        return;
    }
    ?>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

        posthog.init('<?php echo esc_js( SLAYERKEY_POSTHOG_TOKEN ); ?>', {
            api_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_HOST ); ?>',
            defaults: '2026-05-30',
            loaded: function (ph) {
                window.__slayerkeyPostHogLoaded = true;
                ph.capture('browser integration smoke test', {
                    source: 'slayerkey-wordpress-plugin',
                    plugin_version: '<?php echo esc_js( SLAYERKEY_WEBSITE_VERSION ); ?>'
                });
            }
        });
    </script>
    <?php
}
add_action( 'wp_head', 'slayerkey_website_posthog_snippet', 1 );

function slayerkey_website_enqueue_tracking() {
    if ( is_admin() ) {
        return;
    }

    wp_enqueue_script(
        'slayerkey-website-tracking',
        plugin_dir_url( __FILE__ ) . 'assets/js/tracking.js',
        array(),
        SLAYERKEY_WEBSITE_VERSION,
        true
    );
}
add_action( 'wp_enqueue_scripts', 'slayerkey_website_enqueue_tracking' );

function slayerkey_website_render_page_shortcode( $atts ) {
    $atts = shortcode_atts(
        array(
            'page' => '',
        ),
        $atts,
        'slayerkey_page'
    );

    $page = sanitize_key( $atts['page'] );

    if ( '' === $page ) {
        return '';
    }

    $page_file = plugin_dir_path( __FILE__ ) . 'pages/' . $page . '/live/index.html';

    if ( ! is_readable( $page_file ) ) {
        if ( current_user_can( 'manage_options' ) ) {
            return '<!-- Slayerkey Website: page file not found for ' . esc_html( $page ) . ' -->';
        }

        return '';
    }

    $contents = file_get_contents( $page_file );

    return false === $contents ? '' : $contents;
}
add_shortcode( 'slayerkey_page', 'slayerkey_website_render_page_shortcode' );
