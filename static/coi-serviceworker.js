/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*
 * This service worker intercepts all fetch requests and adds cross-origin
 * isolation headers (COOP & COEP), enabling SharedArrayBuffer on hosts
 * (like GitHub Pages) that don't allow custom HTTP headers.
 *
 * Source: https://github.com/nicoschmitt/coi-serviceworker
 */
let coepCredentialless = false;

if (typeof window === 'undefined') {
    // --- Service Worker scope ---
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener('fetch', function (event) {
        const r = event.request;
        if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') {
            return;
        }

        const request = (coepCredentialless && r.mode === 'no-cors')
            ? new Request(r, { credentials: 'omit' })
            : r;

        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set('Cross-Origin-Embedder-Policy',
                        coepCredentialless ? 'credentialless' : 'require-corp'
                    );
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    // --- Window scope ---
    (async function () {
        const coi = window.coi || {};

        const doReload = coi.doReload || (() => window.location.reload());
        const quiet = coi.quiet || false;

        if (window.crossOriginIsolated !== false) {
            return;
        }

        if (!window.isSecureContext) {
            !quiet && console.log('COOP/COEP Service Worker: Not a secure context, skipping registration.');
            return;
        }

        // Detect credentialless support
        const testResponse = await fetch(window.location.href, { mode: 'no-cors' }).catch(() => null);
        if (testResponse) {
            // Chrome 96+ supports credentialless
            coepCredentialless = !(testResponse.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp');
        }

        // Determine the correct scope based on the script URL
        const scriptUrl = document.currentScript?.src;
        const reg = await navigator.serviceWorker.register(scriptUrl || 'coi-serviceworker.js');

        !quiet && console.log('COOP/COEP Service Worker: Registered worker.', reg);

        reg.addEventListener('updatefound', () => {
            !quiet && console.log('COOP/COEP Service Worker: Update found, installing...');
            reg.installing?.addEventListener('statechange', function () {
                if (this.state === 'activated') {
                    !quiet && console.log('COOP/COEP Service Worker: Activated, reloading page...');
                    doReload();
                }
            });
        });

        // If already controlled, and already cross-origin-isolated, we're good
        if (reg.active && !navigator.serviceWorker.controller) {
            !quiet && console.log('COOP/COEP Service Worker: Found active worker, reloading to take control...');
            doReload();
        }
    })();
}
