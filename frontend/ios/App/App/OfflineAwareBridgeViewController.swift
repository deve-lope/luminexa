import UIKit
import WebKit
import Network
import Capacitor

/**
 * Capacitor's server.errorPath only appears after WKWebView reports a navigation
 * failure. On iOS, airplane-mode / DNS stalls often leave a blank green WebView
 * instead. This controller shows a bundled offline.html immediately when there
 * is no network, and after a short load timeout if the remote SPA never arrives.
 */
class OfflineAwareBridgeViewController: CAPBridgeViewController {
    private let pathMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.luminexa.offline-monitor")
    private var loadTimeoutWork: DispatchWorkItem?
    private var showingOffline = false
    private var remoteLoadFinished = false

    private let appURL = URL(string: "https://app.luminex-a.com/")!
    private let loadTimeoutSeconds: TimeInterval = 4

    override func viewDidLoad() {
        super.viewDidLoad()
        startPathMonitor()
        scheduleLoadTimeout()
        observeRemoteLoad()
    }

    deinit {
        pathMonitor.cancel()
        loadTimeoutWork?.cancel()
    }

    private func observeRemoteLoad() {
        // Capacitor owns the navigation delegate; poll URL / title briefly after launch.
        // When the remote SPA loads, the host becomes app.luminex-a.com.
        Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            guard let host = self.webView?.url?.host?.lowercased() else { return }
            if host.contains("luminex-a.com") {
                self.remoteLoadFinished = true
                self.showingOffline = false
                self.loadTimeoutWork?.cancel()
                timer.invalidate()
            } else if host.isEmpty == false,
                      self.webView?.url?.isFileURL == true || host == "localhost" {
                // Bundled offline page (file:// or capacitor localhost) — keep waiting for network.
            }
        }
    }

    private func startPathMonitor() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if path.status == .satisfied {
                    if self.showingOffline {
                        self.reloadRemoteApp()
                    }
                } else {
                    self.showOfflinePage()
                }
            }
        }
        pathMonitor.start(queue: monitorQueue)

        // Immediate check — don't wait for the first monitor callback.
        if pathMonitor.currentPath.status != .satisfied {
            DispatchQueue.main.async { [weak self] in
                self?.showOfflinePage()
            }
        }
    }

    private func scheduleLoadTimeout() {
        loadTimeoutWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            if self.remoteLoadFinished || self.showingOffline { return }
            // Still on the empty/green WebView — show offline instead of hanging forever.
            self.showOfflinePage()
        }
        loadTimeoutWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + loadTimeoutSeconds, execute: work)
    }

    private func showOfflinePage() {
        guard let webView = webView else { return }
        if showingOffline { return }
        showingOffline = true
        loadTimeoutWork?.cancel()

        if let bundled = Bundle.main.url(forResource: "offline", withExtension: "html") {
            webView.loadFileURL(bundled, allowingReadAccessTo: bundled.deletingLastPathComponent())
            return
        }
        // Fallback to Capacitor errorPath if the native copy is missing.
        if let errorURL = bridge?.config.errorPathURL {
            webView.load(URLRequest(url: errorURL))
        }
    }

    private func reloadRemoteApp() {
        showingOffline = false
        remoteLoadFinished = false
        scheduleLoadTimeout()
        webView?.load(URLRequest(url: appURL))
    }
}
