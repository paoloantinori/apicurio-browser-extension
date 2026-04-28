# Apicurio Editor - Fork Notes

**Source**: https://github.com/Apicurio/apicurio-registry/tree/main/ui/ui-editors
**Commit**: `696f21260f2096ce954b2a307a8d053e2fbae9c1`
**Forked**: 2026-04-28

## postMessage Communication Protocol

### Incoming (parent → editor)
```
window.postMessage({
  type: "apicurio-editingInfo",
  data: EditingInfo
}, "*")
```

Where `EditingInfo` has the shape:
```ts
interface EditingInfo {
  content: {
    type: "OPENAPI" | "ASYNCAPI";
    value: string; // raw YAML/JSON spec content
  };
  features: {
    allowImports: boolean;
    allowCustomValidations: boolean;
  };
}
```

### Outgoing (editor → parent)
```
// On content change:
window.postMessage({
  type: "apicurio_onChange",
  data: { content: <spec object> }
}, "*")
```

### Demo Mode
Append `?demo` query parameter to load with built-in OpenAPI sample content.

## Key Dependencies
- Angular 18.2.x
- @apicurio/data-models 1.1.33
- PatternFly 1.0.250 (styling)
- Bootstrap 5.3.8
- brace 0.11.1 (Ace editor)
