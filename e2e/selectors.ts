/**
 * Centralized DOM selectors for GitHub and the Apicurio extension.
 * Mirrors the selectors used in src/adapters/github.ts and src/content/toggle-ui.ts.
 */

// GitHub native elements
export const GH = {
  /** The SegmentedControl <ul> containing Code/Blame tabs */
  TAB_LIST: 'ul[aria-label="File view"]',
  /** A tab item inside the tab list */
  TAB_ITEM: "li",
  /** Button inside a tab item */
  TAB_BUTTON: "button",
  /** Attribute indicating a tab is selected */
  TAB_SELECTED: "data-selected",
  /** ARIA attribute for current tab */
  TAB_ARIA_CURRENT: "aria-current",

  /** Primary code container (React-based) */
  CODE_CONTAINER: ".react-code-lines",
  /** Code cells with test-id */
  CODE_CELL: '[data-testid="code-cell"]',
  /** File view detection marker */
  FILE_VIEW: '[data-testid="code-cell"], .react-code-lines',
  /** Filename breadcrumb */
  FILENAME: '[data-testid="breadcrumbs-filename"]',

  /** Blame segment wrappers */
  BLAME_SEGMENT: "[class*='react-blame-segment-wrapper']",
  /** Blame-specific wrapper class substring */
  BLAME_CODE_PAIRS: "[class*='react-line-code-pairs']",

  /** Ancestor wrapper containing both code and blame panels */
  BLOB_INNER: "[class*='codeBlobInner']",
} as const;

// Apicurio extension elements
export const EXT = {
  /** Class added to <ul> when Apicurio is active */
  ACTIVE_CLASS: "apicurio-active",
  /** <style> override injected when active */
  STYLE_OVERRIDE_ID: "apicurio-tab-override",
  /** Viewer container */
  VIEWER_CONTAINER: "div[data-apicurio-viewer]",
  /** Save toolbar */
  SAVE_TOOLBAR: "#apicurio-save-toolbar",
  /** Save toolbar style element ID */
  SAVE_TOOLBAR_STYLE_ID: "apicurio-save-toolbar-style",
} as const;

// Test URLs
export const URLS = {
  /** OpenAPI spec file for positive tests */
  SPEC_FILE:
    "https://github.com/paoloantinori/apicurio-browser-extension/blob/master/petstore.yaml",
  /** Non-spec file for negative tests */
  NON_SPEC_FILE:
    "https://github.com/paoloantinori/apicurio-browser-extension/blob/master/package.json",
  /** Spec file on the test branch (for write-back tests) */
  WRITABLE_SPEC:
    "https://github.com/paoloantinori/apicurio-browser-extension/blob/e2e-test-writes/petstore.yaml",
} as const;
