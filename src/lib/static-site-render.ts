import { randomBytes } from "crypto"

/**
 * Combines a static site's html + js into one response-ready document with
 * a strict CSP (script-src locked to 'self' + a per-request nonce + the
 * Alpine.js CDN — no 'unsafe-inline' blanket allowance, since that's the
 * actual XSS vector for AI-generated code served straight to the public).
 * Shared by the public route (site/[tenant]/route.ts) and the authenticated
 * draft preview route, so both render identically.
 */
export function renderStaticSite(html: string, js: string): { body: string; headers: Record<string, string> } {
  const nonce = randomBytes(16).toString("base64")

  const helperScript = `<script nonce="${nonce}">
    (function() {
      let _vue = window.Vue;
      function wrapVue(v) {
        if (!v || !v.createApp || v.__sacms_wrapped) return v;
        const _origCreateApp = v.createApp;
        v.createApp = function(...args) {
          const app = _origCreateApp.apply(this, args);
          const _origMount = app.mount;
          app.mount = function(container) {
            const vm = _origMount.call(this, container);
            window.__SACMS_VUE_VM__ = vm;
            return vm;
          };
          return app;
        };
        v.__sacms_wrapped = true;
        return v;
      }
      if (_vue) {
        wrapVue(_vue);
      } else {
        Object.defineProperty(window, 'Vue', {
          configurable: true,
          enumerable: true,
          get() { return _vue; },
          set(v) { _vue = wrapVue(v); }
        });
      }

      function switchVueView(targetName) {
        if (!window.__SACMS_VUE_VM__) return false;
        const vm = window.__SACMS_VUE_VM__;
        const clean = targetName.toLowerCase().trim();
        const candidateKeys = ['currentView', 'activeView', 'activeTab', 'currentTab', 'view', 'page', 'selectedTab'];
        for (const key of candidateKeys) {
          if (key in vm) {
            vm[key] = clean;
            return true;
          }
        }
        return false;
      }

      document.addEventListener('click', function(e) {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href) return;

        if (/^(https?:|\\/\\/|mailto:|tel:)/i.test(href)) {
          if (/^https?:|\\/\\//i.test(href)) {
            e.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          return;
        }

        if (href === '#' || href === '#!' || href.startsWith('javascript:')) {
          e.preventDefault();
          return;
        }

        if (href.startsWith('#')) {
          const id = href.slice(1);
          if (!id) return;
          const targetEl = document.getElementById(id) || document.querySelector(href);
          if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
          switchVueView(id);
          return;
        }

        e.preventDefault();
        const viewSlug = href.replace(/^[\\/\\s]+|[\\/\\s]+$/g, '').toLowerCase();
        if (viewSlug) {
          switchVueView(viewSlug);
          const targetEl = document.getElementById(viewSlug) || document.getElementById('section-' + viewSlug);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }, true);
    })();
  </script>`

  const scriptTag = `${helperScript}\n<script nonce="${nonce}">${js}</script>`
  let body = html
  if (body.includes('<script src="app.js"></script>')) {
    body = body.replace('<script src="app.js"></script>', scriptTag)
  } else if (body.includes("<script src='app.js'></script>")) {
    body = body.replace("<script src='app.js'></script>", scriptTag)
  } else if (body.includes("</body>")) {
    body = body.replace("</body>", `${scriptTag}</body>`)
  } else {
    body = `${body}\n${scriptTag}`
  }

  // The Public REST API this site's js fetches from lives on the apex/
  // wildcard-subdomain domain, not necessarily the exact hostname the site
  // itself is served on — allow both. Derived from config, not hardcoded,
  // so local dev (plain localhost) isn't locked out by CSP.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud"
  const connectSrc = rootDomain.includes("localhost")
    ? "'self' http://localhost:* http://127.0.0.1:*"
    : `'self' https://${rootDomain} https://*.${rootDomain}`

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdn.tailwindcss.com",
    "img-src 'self' https: data:",
    "font-src 'self' https: data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
  ].join("; ")

  return {
    body,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": csp,
    },
  }
}
