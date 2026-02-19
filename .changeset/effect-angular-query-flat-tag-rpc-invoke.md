---
effect-angular-query: patch
---

Switch RPC procedure execution to flat-tag invocation (`RpcClient.make(..., { flatten: true })`) and remove path-walk based client member resolution to ensure requests use explicit RPC tags.
