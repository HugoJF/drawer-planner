# Code Style

## if statements

Always use braces and put the body on its own line. Never write single-line ifs.

```ts
// bad
if (!x) return

// good
if (!x) {
  return
}
```

**Exception:** a run of short, visually aligned push/append statements is fine inline:

```ts
if (def.ctrl)  keys.push('Ctrl')
if (def.shift) keys.push('Shift')
if (def.alt)   keys.push('Alt')
```
