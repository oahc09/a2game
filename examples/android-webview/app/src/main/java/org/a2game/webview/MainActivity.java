package org.a2game.webview;

import android.app.Activity;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** Bundled, trusted SDK only. No JavaScript interface or network fallback. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ROOT = "https://" + HOST + "/app/player/index.html";
    private static final int MAX_FILE_BYTES = 16 * 1024 * 1024;
    private WebView webView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/app/", new LengthAssetHandler(getAssets())).build();
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !isLocal(uri) || !"/app/player/index.html".equals(uri.getPath());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"GET".equals(request.getMethod()) || !isLocal(uri)) return denied();
                WebResourceResponse response = loader.shouldInterceptRequest(uri);
                return response == null ? denied() : response;
            }
        });
        setContentView(webView);
        webView.loadUrl(ROOT);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1
                && uri.getUserInfo() == null && uri.getPath() != null && uri.getPath().startsWith("/app/");
    }
    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("if(window.examplePlayer&&window.examplePlayer.status()==='playing')window.examplePlayer.pause()", null);
            webView.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume(); // Deliberately does not resume gameplay.
    }
    @Override protected void onDestroy() {
        if (webView != null) {
            webView.evaluateJavascript("if(window.examplePlayer)void window.examplePlayer.dispose()", null);
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** AssetLoader's default handler does not supply the resource length expected by ResourceScope. */
    private static final class LengthAssetHandler implements WebViewAssetLoader.PathHandler {
        private final AssetManager assets;
        LengthAssetHandler(AssetManager assets) { this.assets = assets; }
        @Override public WebResourceResponse handle(String path) {
            if (path.isEmpty() || path.startsWith("/") || !path.matches("[A-Za-z0-9_./-]+")) return denied();
            for (String component : path.split("/")) if (component.isEmpty() || component.equals(".") || component.equals("..")) return denied();
            try (InputStream in = assets.open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int n, total = 0;
                while ((n = in.read(buffer)) != -1) {
                    total += n;
                    if (total > MAX_FILE_BYTES) return denied();
                    out.write(buffer, 0, n);
                }
                byte[] bytes = out.toByteArray();
                Map<String, String> headers = new HashMap<>();
                headers.put("Content-Length", Integer.toString(bytes.length));
                headers.put("Cache-Control", "no-store");
                headers.put("X-Content-Type-Options", "nosniff");
                String mime = mimeType(path, bytes);
                return new WebResourceResponse(mime, mime.startsWith("text/") || mime.equals("application/json") ? "utf-8" : null,
                        200, "OK", headers, new ByteArrayInputStream(bytes));
            } catch (IOException error) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
            }
        }
        private static String mimeType(String path, byte[] bytes) {
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".mjs") || path.endsWith(".js")) return "text/javascript";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".css")) return "text/css";
            if (bytes.length >= 8 && (bytes[0] & 255) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G') return "image/png";
            if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W' && bytes[9] == 'A' && bytes[10] == 'V' && bytes[11] == 'E') return "audio/wav";
            return "application/octet-stream";
        }
    }
}
