# E2E Testing Checklist

## Build Output Sizes

| Component | Chrome | Firefox |
|-----------|--------|---------|
| Extension code (src/) | 52 KB | 52 KB |
| Viewer assets (viewer/) | 24 MB | 24 MB |
| **Total** | **~24 MB** | **~24 MB** |

## CSP Compliance

- [x] No `eval()` calls in extension code
- [x] No remote script loading
- [x] No inline event handlers in extension pages
- [ ] Editor loads PatternFly CSS from local bundle only (check for unpkg CDN reference in viewer/index.html)

## Chrome Testing

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/chrome/`
4. Verify extension icon appears in toolbar

### GitHub File Detection
- [ ] Navigate to a `.json` OpenAPI spec on GitHub (e.g., `openapi.json`)
- [ ] "Show API View" toggle button appears in the file toolbar
- [ ] Clicking toggle loads the Apicurio visual editor
- [ ] Clicking "Show Source" returns to native code view
- [ ] Navigate to a `.yaml` OpenAPI spec — same behavior

### GitLab File Detection
- [ ] Navigate to a `.json` OpenAPI spec on GitLab
- [ ] Toggle and viewer work identically to GitHub

### Settings
- [ ] Click extension icon → popup opens with current settings
- [ ] Toggle "Auto-render" off → navigate to spec file → no auto-render
- [ ] Toggle platform (GitHub/GitLab) off → no detection on that platform
- [ ] Settings persist after closing and reopening browser

### SPA Navigation
- [ ] On GitHub, click between files without full page reload
- [ ] Extension correctly detects when viewing a spec file vs. non-spec file
- [ ] No duplicate toggle buttons after navigation
- [ ] Viewer state resets correctly when navigating away

## Firefox Testing

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `dist/firefox/manifest.json`
4. Run the same checklist as Chrome above

## Console Errors
- [ ] No errors on extension install
- [ ] No errors on page navigation
- [ ] No errors on toggle click
- [ ] No errors on popup open/close
