<?php
/**
 * Plugin Name: Slayerkey Website
 * Description: GitHub managed page rendering and analytics foundation for slayerkey.com.
 * Version: 0.1.22
 * Author: Slayerkey
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SLAYERKEY_WEBSITE_VERSION', '0.1.22' );
define( 'SLAYERKEY_POSTHOG_TOKEN', 'phc_m92yxHMa2BTnSu7KmebGKu8sEitMki4oPhdLTKZzcpMc' );
define( 'SLAYERKEY_POSTHOG_HOST', 'https://edge.slayerkey.com' );
define( 'SLAYERKEY_POSTHOG_UI_HOST', 'https://us.posthog.com' );

function slayerkey_website_preview_map() {
    return array(
        'dojo-v3' => array(
            'title'       => 'Training Dojo v3',
            'file'        => 'previews/dojo-v3/index.html',
            'theme_shell' => true,
            'style'       => 'previews/dojo-v3/dojo.css',
            'script'      => 'previews/dojo-v3/dojo.js',
        ),
        'system-v3' => array(
            'title' => 'Improvement System v3',
            'file'  => 'previews/system-v3/index.html',
        ),
        'coaching-v3' => array(
            'title' => 'Coaching v3',
            'file'  => 'previews/coaching-v3/index.html',
        ),
    );
}

function slayerkey_website_preview_slug_from_request() {
    static $resolved = false;
    static $slug = null;

    if ( $resolved ) {
        return $slug;
    }

    $resolved = true;

    if ( empty( $_SERVER['REQUEST_URI'] ) ) {
        return null;
    }

    $path = wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH );

    if ( ! is_string( $path ) ) {
        return null;
    }

    if ( preg_match( '#^/preview/([a-z0-9-]+)/?$#', $path, $matches ) ) {
        $candidate = sanitize_key( $matches[1] );
        $previews = slayerkey_website_preview_map();

        if ( isset( $previews[ $candidate ] ) ) {
            $slug = $candidate;
        }
    }

    return $slug;
}

function slayerkey_website_is_private_preview_request() {
    return null !== slayerkey_website_preview_slug_from_request();
}

function slayerkey_website_preview_body_classes( $classes ) {
    $slug = slayerkey_website_preview_slug_from_request();

    if ( null === $slug ) {
        return $classes;
    }

    $classes[] = 'slayerkey-private-preview';
    $classes[] = 'slayerkey-preview-' . $slug;

    return array_values( array_unique( $classes ) );
}
add_filter( 'body_class', 'slayerkey_website_preview_body_classes' );

function slayerkey_website_is_public_work_request() {
    if ( empty( $_SERVER['REQUEST_URI'] ) ) {
        return false;
    }

    $path = wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH );

    if ( ! is_string( $path ) ) {
        return false;
    }

    return '/work' === untrailingslashit( $path );
}

function slayerkey_website_render_404() {
    global $wp_query;

    if ( $wp_query instanceof WP_Query ) {
        $wp_query->set_404();
    }

    status_header( 404 );
    nocache_headers();

    $template = get_404_template();

    if ( $template ) {
        include $template;
        exit;
    }

    wp_die( esc_html__( 'Not Found', 'slayerkey-website' ), esc_html__( 'Not Found', 'slayerkey-website' ), array( 'response' => 404 ) );
}

function slayerkey_website_prepare_preview_html( $html, $slug ) {
    $asset_base = plugin_dir_url( __FILE__ ) . 'previews/' . rawurlencode( $slug ) . '/assets/';
    $shared_base = plugin_dir_url( __FILE__ ) . 'previews/shared/';

    $html = str_replace(
        array( 'src="assets/', "src='assets/", 'href="assets/', "href='assets/" ),
        array( 'src="' . esc_url( $asset_base ), "src='" . esc_url( $asset_base ), 'href="' . esc_url( $asset_base ), "href='" . esc_url( $asset_base ) ),
        $html
    );
    $html = str_replace( '__SLAYERKEY_PREVIEW_SHARED__', esc_url( $shared_base ), $html );

    // Keep accidental checkout clicks from preview pages out of production campaign attribution.
    return str_replace( 'utm_source=slayerkey_site', 'utm_source=private_preview', $html );
}

function slayerkey_website_prepare_public_html( $html, $slug ) {
    $html = slayerkey_website_prepare_preview_html( $html, $slug );

    // The same verified source powers preview and production. Restore production attribution on live.
    return str_replace( 'utm_source=private_preview', 'utm_source=slayerkey_site', $html );
}

function slayerkey_website_prepare_public_dojo_html( $html ) {
    return slayerkey_website_prepare_public_html( $html, 'dojo-v3' );
}

function slayerkey_website_asset_version( $relative_path ) {
    $path = plugin_dir_path( __FILE__ ) . ltrim( $relative_path, '/' );

    if ( is_readable( $path ) ) {
        $mtime = filemtime( $path );

        if ( false !== $mtime ) {
            return SLAYERKEY_WEBSITE_VERSION . '.' . $mtime;
        }
    }

    return SLAYERKEY_WEBSITE_VERSION;
}

function slayerkey_website_render_private_preview() {
    $slug = slayerkey_website_preview_slug_from_request();

    if ( null === $slug ) {
        return;
    }

    if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
        slayerkey_website_render_404();
    }

    $previews = slayerkey_website_preview_map();
    $preview = $previews[ $slug ];
    $preview_file = plugin_dir_path( __FILE__ ) . $preview['file'];

    if ( ! is_readable( $preview_file ) ) {
        slayerkey_website_render_404();
    }

    $html = file_get_contents( $preview_file );

    if ( false === $html ) {
        slayerkey_website_render_404();
    }

    $html = slayerkey_website_prepare_preview_html( $html, $slug );

    global $wp_query;

    if ( $wp_query instanceof WP_Query ) {
        $wp_query->is_404 = false;
        $wp_query->is_page = true;
    }

    show_admin_bar( false );
    status_header( 200 );
    nocache_headers();
    header( 'X-Robots-Tag: noindex, nofollow, noarchive', true );

    if ( ! empty( $preview['theme_shell'] ) ) {
        if ( ! empty( $preview['style'] ) ) {
            wp_enqueue_style(
                'slayerkey-private-preview-' . $slug,
                plugin_dir_url( __FILE__ ) . $preview['style'],
                array(),
                slayerkey_website_asset_version( $preview['style'] )
            );
        }

        if ( ! empty( $preview['script'] ) ) {
            wp_enqueue_script(
                'slayerkey-private-preview-' . $slug,
                plugin_dir_url( __FILE__ ) . $preview['script'],
                array(),
                slayerkey_website_asset_version( $preview['script'] ),
                true
            );
        }

        get_header();
        echo "\n<!-- Slayerkey private preview: " . esc_html( $slug ) . " -->\n";
        echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        get_footer();
        exit;
    }

    header( 'Content-Type: text/html; charset=' . get_option( 'blog_charset' ) );
    $preview_meta = '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="slayerkey-preview" content="' . esc_attr( $slug ) . '">';

    if ( false !== stripos( $html, '</head>' ) ) {
        $html = preg_replace( '/<\/head>/i', $preview_meta . '</head>', $html, 1 );
    } else {
        $html = $preview_meta . $html;
    }

    echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    exit;
}
add_action( 'template_redirect', 'slayerkey_website_render_private_preview', 0 );

function slayerkey_website_is_public_dojo_request() {
    if ( is_admin() || slayerkey_website_is_private_preview_request() || slayerkey_website_is_public_work_request() ) {
        return false;
    }

    return is_front_page();
}

function slayerkey_website_public_dojo_body_classes( $classes ) {
    if ( slayerkey_website_is_public_dojo_request() ) {
        $classes[] = 'slayerkey-live-dojo';
        $classes[] = 'slayerkey-live-dojo-v3';
    }

    return array_values( array_unique( $classes ) );
}
add_filter( 'body_class', 'slayerkey_website_public_dojo_body_classes' );

function slayerkey_website_render_public_dojo() {
    if ( ! slayerkey_website_is_public_dojo_request() ) {
        return;
    }

    $previews = slayerkey_website_preview_map();
    $preview = $previews['dojo-v3'];
    $preview_file = plugin_dir_path( __FILE__ ) . $preview['file'];

    if ( ! is_readable( $preview_file ) ) {
        return;
    }

    $html = file_get_contents( $preview_file );

    if ( false === $html ) {
        return;
    }

    $html = slayerkey_website_prepare_public_dojo_html( $html );

    if ( ! empty( $preview['style'] ) ) {
        wp_enqueue_style(
            'slayerkey-live-dojo-v3',
            plugin_dir_url( __FILE__ ) . $preview['style'],
            array(),
            slayerkey_website_asset_version( $preview['style'] )
        );
    }

    if ( ! empty( $preview['script'] ) ) {
        $script_handle = 'slayerkey-live-dojo-v3';
        wp_enqueue_script(
            $script_handle,
            plugin_dir_url( __FILE__ ) . $preview['script'],
            array(),
            slayerkey_website_asset_version( $preview['script'] ),
            true
        );

        // The chooser is created by dojo.js. Keep preview attribution private, but rewrite live links.
        wp_add_inline_script(
            $script_handle,
            "(function(){function fixDojoAttribution(){document.querySelectorAll('#sk-plan-chooser a[href*=\"utm_source=private_preview\"]').forEach(function(link){link.href=link.href.replace('utm_source=private_preview','utm_source=slayerkey_site');});}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fixDojoAttribution);}else{fixDojoAttribution();}if('MutationObserver' in window){new MutationObserver(fixDojoAttribution).observe(document.documentElement,{childList:true,subtree:true});}})();",
            'after'
        );
    }

    global $wp_query;
    if ( $wp_query instanceof WP_Query ) {
        $wp_query->is_404 = false;
        $wp_query->is_page = true;
    }

    status_header( 200 );
    get_header();
    echo "\n<!-- Slayerkey live Dojo v3 -->\n";
    echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    get_footer();
    exit;
}
add_action( 'template_redirect', 'slayerkey_website_render_public_dojo', 1 );

function slayerkey_website_render_public_work() {
    if ( ! slayerkey_website_is_public_work_request() ) {
        return;
    }

    // The portfolio project was archived on 2026-08-22. Keep /work unavailable.
    slayerkey_website_render_404();
}
add_action( 'template_redirect', 'slayerkey_website_render_public_work', 1 );

function slayerkey_website_version_marker() {
    if ( is_admin() ) {
        return;
    }

    echo "\n<!-- Slayerkey Website " . esc_html( SLAYERKEY_WEBSITE_VERSION ) . " active -->\n";
}
add_action( 'wp_head', 'slayerkey_website_version_marker', 0 );

function slayerkey_website_file_sha256( $relative_path ) {
    $path = plugin_dir_path( __FILE__ ) . ltrim( $relative_path, '/' );

    if ( ! is_readable( $path ) ) {
        return null;
    }

    $hash = hash_file( 'sha256', $path );
    return false === $hash ? null : $hash;
}

function slayerkey_website_health_response() {
    $deploy_marker_path = plugin_dir_path( __FILE__ ) . 'DEPLOYED_COMMIT.txt';
    $deployed_commit = null;

    if ( is_readable( $deploy_marker_path ) ) {
        $marker = trim( (string) file_get_contents( $deploy_marker_path ) );
        $deployed_commit = '' === $marker ? null : $marker;
    }

    $dojo_index_path = plugin_dir_path( __FILE__ ) . 'previews/dojo-v3/index.html';
    $dojo_index = is_readable( $dojo_index_path ) ? file_get_contents( $dojo_index_path ) : false;

    return rest_ensure_response(
        array(
            'plugin_active' => true,
            'version' => SLAYERKEY_WEBSITE_VERSION,
            'deployed_commit' => $deployed_commit,
            'posthog_host' => SLAYERKEY_POSTHOG_HOST,
            'posthog_ui_host' => SLAYERKEY_POSTHOG_UI_HOST,
            'tracking_asset' => plugin_dir_url( __FILE__ ) . 'assets/js/tracking.js',
            'private_previews_enabled' => true,
            'public_dojo_enabled' => true,
            'public_work_enabled' => false,
            'public_work_archived' => true,
            'dojo_assets' => array(
                'index_sha256' => slayerkey_website_file_sha256( 'previews/dojo-v3/index.html' ),
                'js_sha256' => slayerkey_website_file_sha256( 'previews/dojo-v3/dojo.js' ),
                'css_sha256' => slayerkey_website_file_sha256( 'previews/dojo-v3/dojo.css' ),
                'contains_derek' => false !== $dojo_index && false !== strpos( $dojo_index, 'std-derekvictory.png' ),
            ),
            'hooks' => array(
                'version_marker_registered' => false !== has_action( 'wp_head', 'slayerkey_website_version_marker' ),
                'posthog_snippet_registered' => false !== has_action( 'wp_head', 'slayerkey_website_posthog_snippet' ),
                'tracking_enqueue_registered' => false !== has_action( 'wp_enqueue_scripts', 'slayerkey_website_enqueue_tracking' ),
                'private_preview_registered' => false !== has_action( 'template_redirect', 'slayerkey_website_render_private_preview' ),
                'public_dojo_registered' => false !== has_action( 'template_redirect', 'slayerkey_website_render_public_dojo' ),
                'public_work_registered' => false !== has_action( 'template_redirect', 'slayerkey_website_render_public_work' ),
            ),
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
    if ( is_admin() || slayerkey_website_is_private_preview_request() || slayerkey_website_is_public_work_request() ) {
        return;
    }
    ?>
    <script>
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

        posthog.init('<?php echo esc_js( SLAYERKEY_POSTHOG_TOKEN ); ?>', {
            api_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_HOST ); ?>',
            ui_host: '<?php echo esc_js( SLAYERKEY_POSTHOG_UI_HOST ); ?>',
            defaults: '2026-05-30',
            strict_script_versioning: true
        });
    </script>
    <?php
}
add_action( 'wp_head', 'slayerkey_website_posthog_snippet', 1 );

function slayerkey_website_enqueue_tracking() {
    if ( is_admin() || slayerkey_website_is_private_preview_request() || slayerkey_website_is_public_work_request() ) {
        return;
    }

    wp_enqueue_script(
        'slayerkey-website-tracking',
        plugin_dir_url( __FILE__ ) . 'assets/js/tracking.js',
        array(),
        slayerkey_website_asset_version( 'assets/js/tracking.js' ),
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
