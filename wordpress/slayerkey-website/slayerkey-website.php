<?php
/**
 * Plugin Name: Slayerkey Website
 * Description: GitHub managed page rendering and analytics foundation for slayerkey.com.
 * Version: 0.1.0
 * Author: Slayerkey
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SLAYERKEY_WEBSITE_VERSION', '0.1.0' );
define( 'SLAYERKEY_POSTHOG_TOKEN', 'phc_m92yxHMa2BTnSu7KmebGKu8sEitMki4oPhdLTKZzcpMc' );
define( 'SLAYERKEY_POSTHOG_HOST', 'https://us.i.posthog.com' );

function slayerkey_website_posthog_snippet() {
    if ( is_admin() ) {
        return;
    }
    ?>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

        posthog.init('<?php echo esc_js( SLAYERKEY_POSTHOG_TOKEN ); ?>', {
            api_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_HOST ); ?>',
            defaults: '2026-05-30'
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
