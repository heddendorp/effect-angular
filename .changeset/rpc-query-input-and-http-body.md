---
effect-angular-query: patch
effect-platform-angular: patch
---

Query helpers capture supported input values for later fetches and refetches. Use `snapshotInput` for mutable custom classes. Cache keys now distinguish inputs containing an own `__proto__` field.

Raw binary views retain their bytes, and raw web byte streams respect the upload buffering limit. The HTTP adapter releases interceptor subscriptions after the first response.
