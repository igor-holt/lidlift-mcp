/**
 * B-E Font Route — injected into coalition-gateway
 * 
 * Add to PLUGIN_ROUTES section in coalition-gateway/src/index.ts:
 *   import { handleFontRoute } from './font_route';
 * 
 * Add to fetch() handler before the 404 fallback:
 *   if (path.startsWith('/fonts/')) return handleFontRoute(request, env);
 * 
 * No new KV, no new R2 required for CSS tiers.
 * For WOFF2: bind an R2 bucket named FONT_ASSETS to the gateway.
 */

// ----------------------------------------------------------------
// B-E CSS CUSTOM PROPERTIES — single source of truth
// Every environment imports this and gets identical rendering.
// ----------------------------------------------------------------
const BE_CSS_VARS = `
:root {
  /* Barcelona-Extropic v1.0 — Seismic Baseline */
  --be-stem:          12px;
  --be-serif:         1px;          /* stem/12 = 1.0 at base size */
  --be-tracking:      0.25em;
  --be-tracking-wide: 0.4em;        /* Kinetic variant */
  --be-weight:        700;          /* Didone heavy stem */
  --be-weight-serif:  300;          /* Thin crossbar weight */
  --be-counter-ratio: 1.2;          /* height:width for O,D,P */
  --be-shear:         0deg;         /* Kinetic: -12deg */

  /* Color tokens */
  --be-ink:           #f0ede8;
  --be-ink-secondary: rgba(240,237,232,0.65);
  --be-ground:        #1a1e24;
  --be-grid:          rgba(60,120,200,0.12);
  --be-hairline:      rgba(255,255,255,0.15);

  /* Font stack — degrades through B-E tiers */
  --be-font:
    'BarcelonaExtropic',            /* Tier 1: real WOFF2 */
    'BarcelonaExtropicSVG',         /* Tier 2: SVG font (inline data URI) */
    'Playfair Display',             /* Tier 3: closest Google Fonts match */
    'Georgia',                      /* Tier 4: system serif */
    serif;                          /* Tier 5: system default */
}
`;

// ----------------------------------------------------------------
// B-E UTILITY CLASSES — same API in every environment
// ----------------------------------------------------------------
const BE_UTILITIES = `
/* Base */
.be { 
  font-family: var(--be-font);
  font-weight: var(--be-weight);
  letter-spacing: var(--be-tracking);
  color: var(--be-ink);
  font-feature-settings: "kern" 1, "liga" 1;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}

/* Display / Hero */
.be-display {
  font-family: var(--be-font);
  font-weight: 900;
  letter-spacing: var(--be-tracking);
  text-transform: uppercase;
  line-height: 1.05;
}

/* Subtitle — thin crossbar weight */
.be-subtitle {
  font-family: var(--be-font);
  font-weight: var(--be-weight-serif);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--be-ink-secondary);
}

/* Kinetic variant — B-E Kinetic / HFT mode */
.be-kinetic {
  font-family: var(--be-font);
  font-weight: 900;
  letter-spacing: var(--be-tracking-wide);
  font-style: oblique var(--be-shear);
  /* CSS fallback for shear — browsers apply oblique as approximation */
  transform: skewX(-12deg);
  display: inline-block;
}

/* Chiral — horizontal mirror via CSS transform */
.be-chiral-h {
  display: inline-block;
  transform: scaleX(-1);
}

/* Chiral — vertical mirror */
.be-chiral-v {
  display: inline-block;
  transform: scaleY(-1);
}

/* Chiral — 180° rotation */
.be-chiral-180 {
  display: inline-block;
  transform: rotate(180deg);
}

/* Morph interpolation — CSS custom property driven */
/* Set --be-morph-t (0.0–1.0) to control chiral blend */
.be-morph {
  position: relative;
  display: inline-block;
}
.be-morph::after {
  content: attr(data-chiral);
  position: absolute;
  inset: 0;
  transform: scaleX(-1);
  opacity: var(--be-morph-t, 0);
}
.be-morph > span {
  opacity: calc(1 - var(--be-morph-t, 0));
}

/* Grid overlay — matches specimen background */
.be-grid-bg {
  background-color: var(--be-ground);
  background-image:
    linear-gradient(var(--be-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--be-grid) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* Hairline separator — B-E horizontal rule */
.be-hairline {
  border: none;
  border-top: 1px solid var(--be-hairline);
  margin: 1.5em 0;
}

/* Params display — monospace readout */
.be-params {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: rgba(180,200,240,0.5);
}
`;

// ----------------------------------------------------------------
// @font-face DECLARATION
// Tier 1: WOFF2 from R2 (when available)
// Tier 2: Playfair Display from Google CDN (immediate, no hosting required)
// The Google Fonts import is the universal fallback that works in
// Google Workspace Add-ons, iOS WKWebView, Electron, and all browsers.
// ----------------------------------------------------------------
const BE_FONT_FACE = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;700;900&family=Cormorant+Garamond:wght@300;400;600&display=swap');

@font-face {
  font-family: 'BarcelonaExtropic';
  src:
    url('https://GATEWAY_DOMAIN/fonts/be/v1/barcelona-extropic.woff2') format('woff2'),
    url('https://GATEWAY_DOMAIN/fonts/be/v1/barcelona-extropic.woff')  format('woff');
  font-weight: 100 900;
  font-style: normal oblique 0deg 15deg;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
                 U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122,
                 U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD,
                 U+029E, U+2C70;  /* Include chiral chars */
}
`;

// ----------------------------------------------------------------
// GOOGLE WORKSPACE ADD-ON CSS
// Apps Script / Workspace Add-ons don't support @font-face.
// They support inline style attributes and a limited CSS subset.
// This generates inline style strings for Apps Script injection.
// ----------------------------------------------------------------
const WORKSPACE_INLINE_STYLES = {
  display: [
    "font-family:'Playfair Display',Georgia,serif",
    "font-weight:900",
    "letter-spacing:0.25em",
    "text-transform:uppercase",
    "color:#f0ede8",
    "text-rendering:geometricPrecision",
  ].join(";"),

  subtitle: [
    "font-family:'Cormorant Garamond',Georgia,serif",
    "font-weight:300",
    "letter-spacing:0.35em",
    "text-transform:uppercase",
    "color:rgba(240,237,232,0.65)",
  ].join(";"),

  kinetic: [
    "font-family:'Playfair Display',Georgia,serif",
    "font-weight:900",
    "letter-spacing:0.4em",
    "font-style:italic",
  ].join(";"),

  body: [
    "font-family:'Playfair Display',Georgia,serif",
    "font-weight:700",
    "letter-spacing:0.25em",
  ].join(";"),
};

// ----------------------------------------------------------------
// IOS WEBVIEW — WKWebView CSS injection script
// Injected via WKUserScript at documentStart.
// ----------------------------------------------------------------
const IOS_WKUSERSCRIPT = `
(function() {
  var style = document.createElement('style');
  style.id = 'be-brand-ios';
  style.textContent = \`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;700;900&display=swap');
    REPLACE_WITH_CSS_VARS
    REPLACE_WITH_UTILITIES
  \`;
  document.head.appendChild(style);
})();
`.replace('REPLACE_WITH_CSS_VARS', BE_CSS_VARS)
 .replace('REPLACE_WITH_UTILITIES', BE_UTILITIES);

// ----------------------------------------------------------------
// ROUTE HANDLER — add to coalition-gateway fetch()
// ----------------------------------------------------------------
export async function handleFontRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=31536000, immutable', // 1 year for versioned assets
  };

  // /fonts/be/barcelona-extropic.css — universal @font-face + variables + utilities
  if (path === '/fonts/be/barcelona-extropic.css') {
    const gatewayDomain = url.hostname;
    const css = [
      BE_FONT_FACE.replace(/GATEWAY_DOMAIN/g, gatewayDomain),
      BE_CSS_VARS,
      BE_UTILITIES,
    ].join('\n\n');
    return new Response(css, {
      headers: { ...headers, 'Content-Type': 'text/css; charset=utf-8' }
    });
  }

  // /fonts/be/workspace.json — inline styles for Google Workspace Add-on
  if (path === '/fonts/be/workspace.json') {
    return Response.json(WORKSPACE_INLINE_STYLES, { headers });
  }

  // /fonts/be/ios-inject.js — WKWebView injection script
  if (path === '/fonts/be/ios-inject.js') {
    return new Response(IOS_WKUSERSCRIPT, {
      headers: { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' }
    });
  }

  // /fonts/be/v1/*.woff2 — serve from R2 if bound
  if (path.startsWith('/fonts/be/v1/') && env.FONT_ASSETS) {
    const key = path.replace('/fonts/be/v1/', '');
    const obj = await env.FONT_ASSETS.get(key);
    if (!obj) return new Response('Font not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        ...headers,
        'Content-Type': path.endsWith('.woff2') ? 'font/woff2' : 'font/woff',
      }
    });
  }

  // /fonts/be/ — manifest
  if (path === '/fonts/be/' || path === '/fonts/be') {
    return Response.json({
      font: 'Barcelona-Extropic',
      version: '1.0.0',
      baseline: {
        contrast_ratio: 12.0,
        stem_px: 12,
        tracking_em: 0.25,
        serif_class: 'Didone-Unbracketed',
      },
      endpoints: {
        css:       '/fonts/be/barcelona-extropic.css',
        workspace: '/fonts/be/workspace.json',
        ios:       '/fonts/be/ios-inject.js',
        woff2:     '/fonts/be/v1/barcelona-extropic.woff2',
      },
      integration: {
        web:       '<link rel="stylesheet" href="https://DOMAIN/fonts/be/barcelona-extropic.css">',
        import:    "@import url('https://DOMAIN/fonts/be/barcelona-extropic.css');",
        workspace: "fetch('https://DOMAIN/fonts/be/workspace.json')",
        ios:       "WKUserScript from https://DOMAIN/fonts/be/ios-inject.js",
      },
    }, { headers });
  }

  return new Response('Not Found', { status: 404 });
}
