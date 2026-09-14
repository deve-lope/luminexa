package com.luminexa.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Routes PDF / file downloads through Android DownloadManager, and shows a
 * bundled offline.html immediately when there is no network at launch (avoids
 * a blank / green WebView while the remote SPA fails to load).
 */
public class MainActivity extends BridgeActivity {
    private static final String APP_URL = "https://app.luminex-a.com/";
    private static final String OFFLINE_ASSET = "file:///android_asset/offline.html";
    private static final long LOAD_TIMEOUT_MS = 4000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean showingOffline = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mainHandler.post(this::ensureOfflineFallback);
        mainHandler.postDelayed(this::ensureOfflineFallbackIfStillBlank, LOAD_TIMEOUT_MS);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        bridge.getWebView().setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength
            ) {
                String filename = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.setTitle(filename);
                request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                );
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }
                if (userAgent != null) {
                    request.addRequestHeader("User-Agent", userAgent);
                }

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                }
            }
        });
    }

    private void ensureOfflineFallback() {
        if (!isOnline()) {
            showOfflinePage();
        }
    }

    private void ensureOfflineFallbackIfStillBlank() {
        if (showingOffline) return;
        if (isOnline()) {
            // Remote SPA may still be loading; only intervene when clearly stuck offline
            // or on a blank about:blank / empty page with no host.
            WebView webView = bridge != null ? bridge.getWebView() : null;
            if (webView == null) return;
            String url = webView.getUrl();
            if (url == null || url.isEmpty() || "about:blank".equals(url)) {
                if (!isOnline()) {
                    showOfflinePage();
                }
            }
            return;
        }
        showOfflinePage();
    }

    private void showOfflinePage() {
        if (bridge == null || bridge.getWebView() == null) return;
        showingOffline = true;
        bridge.getWebView().loadUrl(OFFLINE_ASSET);
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        if (caps == null) return false;
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
