---
effect-platform-angular: patch
---

Fix HttpClient adapter request body encoding for Effect `HttpBody.Uint8Array`: JSON content is now sent as text for `application/json`, while non-JSON bytes are sent as `ArrayBuffer` to preserve binary semantics.
