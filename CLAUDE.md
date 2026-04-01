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

## useEffect

**Do not use `useEffect` to synchronize one piece of state with another.** Writing `setFoo(derivedFrom(bar))` inside an effect is the anti-pattern.

- Pure derivation → `useMemo`
- Reset state when a value changes → call `setState` during render, guarded by a ref tracking the previous value (React's "storing information from previous renders" pattern):

```ts
const lastKeyRef = useRef(key)
if (lastKeyRef.current !== key) {
  lastKeyRef.current = key
  setFoo(initialValue) // triggers one extra render, no infinite loop
}
```

- Initial state from computation → `useState(() => compute())`

Legitimate effects: external subscriptions (event listeners, WebSockets), DOM mutations, network I/O.

An `// eslint-disable-line react-hooks/exhaustive-deps` is almost always a sign of a broken model — fix the model instead of suppressing the lint rule.
