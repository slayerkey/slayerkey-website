<?php
/**
 * Plugin Name: Slayerkey Website
 * Description: GitHub managed page rendering and analytics foundation for slayerkey.com.
 * Version: 0.1.4
 * Author: Slayerkey
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SLAYERKEY_WEBSITE_VERSION', '0.1.4' );
define( 'SLAYERKEY_POSTHOG_TOKEN', 'phc_m92yxHMa2BTnSu7KmebGKu8sEitMki4oPhdLTKZzcpMc' );
define( 'SLAYERKEY_POSTHOG_HOST', 'https://edge.slayerkey.com' );
define( 'SLAYERKEY_POSTHOG_UI_HOST', 'https://us.posthog.com' );
define( 'SLAYERKEY_POSTHOG_BROWSER_DIAG_OPTION', 'slayerkey_posthog_browser_diag_014' );

function slayerkey_website_diagnostic_marker() {
    if ( is_admin() ) {
        return;
    }

    echo "\n<!-- Slayerkey Website " . esc_html( SLAYERKEY_WEBSITE_VERSION ) . " active -->\n";
}
add_action( 'wp_head', 'slayerkey_website_diagnostic_marker', 0 );

function slayerkey_website_browser_diagnostic_callback( WP_REST_Request $request ) {
    $params = $request->get_json_params();
    $state  = isset( $params['state'] ) ? sanitize_key( $params['state'] ) : '';

    $allowed_states = array(
        'snippet_executed',
        'sdk_loaded',
        'posthog_loaded',
        'sdk_error',
    );

    if ( ! in_array( $state, $allowed_states, true ) ) {
        return new WP_Error( 'invalid_state', 'Invalid diagnostic state.', array( 'status' => 400 ) );
    }

    update_option(
        SLAYERKEY_POSTHOG_BROWSER_DIAG_OPTION,
        array(
            'state' => $state,
            'plugin_version' => SLAYERKEY_WEBSITE_VERSION,
            'tested_at' => time(),
        ),
        false
    );

    return rest_ensure_response( array( 'ok' => true ) );
}

function slayerkey_website_health_response() {
    return rest_ensure_response(
        array(
            'plugin_active' => true,
            'version' => SLAYERKEY_WEBSITE_VERSION,
            'posthog_host' => SLAYERKEY_POSTHOG_HOST,
            'posthog_ui_host' => SLAYERKEY_POSTHOG_UI_HOST,
            'tracking_asset' => plugin_dir_url( __FILE__ ) . 'assets/js/tracking.js',
            'browser_diagnostic' => get_option( SLAYERKEY_POSTHOG_BROWSER_DIAG_OPTION, null ),
            'hooks' => array(
                'diagnostic_marker_registered' => false !== has_action( 'wp_head', 'slayerkey_website_diagnostic_marker' ),
                'posthog_snippet_registered' => false !== has_action( 'wp_head', 'slayerkey_website_posthog_snippet' ),
                'tracking_enqueue_registered' => false !== has_action( 'wp_enqueue_scripts', 'slayerkey_website_enqueue_tracking' ),
            ),
        )
    );
}

function slayerkey_website_register_health_routes() {
    register_rest_route(
        'slayerkey/v1',
        '/health',
        array(
            'methods' => 'GET',
            'callback' => 'slayerkey_website_health_response',
            'permission_callback' => '__return_true',
        )
    );

    register_rest_route(
        'slayerkey/v1',
        '/browser-diagnostic',
        array(
            'methods' => 'POST',
            'callback' => 'slayerkey_website_browser_diagnostic_callback',
            'permission_callback' => '__return_true',
        )
    );
}
add_action( 'rest_api_init', 'slayerkey_website_register_health_routes' );

function slayerkey_website_posthog_snippet() {
    if ( is_admin() ) {
        return;
    }

    $diagnostic_url = rest_url( 'slayerkey/v1/browser-diagnostic' );
    ?>
    <script>
        (function () {
            function skBrowserDiagnostic(state) {
                try {
                    fetch('<?php echo esc_url( $diagnostic_url ); ?>', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state: state }),
                        keepalive: true,
                        credentials: 'same-origin'
                    }).catch(function () {});
                } catch (e) {}
            }

            skBrowserDiagnostic('snippet_executed');
            window.__slayerkeyBrowserDiagnostic = skBrowserDiagnostic;
        })();

        !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(/\/$/,"")+"/static/array.js",p.onload=function(){window.__slayerkeyBrowserDiagnostic&&window.__slayerkeyBrowserDiagnostic('sdk_loaded')},p.onerror=function(){window.__slayerkeyBrowserDiagnostic&&window.__slayerkeyBrowserDiagnostic('sdk_error');p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

        posthog.init('<?php echo esc_js( SLAYERKEY_POSTHOG_TOKEN ); ?>', {
            api_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_HOST ); ?>',
            ui_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_UI_HOST ); ?>',
            defaults: '2026-05-30',
            strict_script_versioning: true,
            loaded: function (ph) {
                window.__slayerkeyPostHogLoaded = true;
                window.__slayerkeyBrowserDiagnostic && window.__slayerkeyBrowserDiagnostic('posthog_loaded');
                ph.capture('browser integration smoke test', {
                    source: 'slayerkey-wordpress-plugin',
                    plugin_version: '<?php echo esc_js( SLAYERKEY_WEBSITE_VERSION ); ?>',
                    transport: 'managed-reverse-proxy'
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
