---
effect-platform-angular: major
---

### Changed

- Preserve binary stream request bodies, cap buffered uploads at a configurable 16 MiB by default, report upload-limit failures as non-retryable encoding errors, support an explicit SSR base URL with typed invalid-URL failures, and fail bodyless or prematurely completed Angular responses without hanging.
- Reject framed RPC serializers with `UnsupportedRpcSerializationError` because Angular `HttpClient` cannot progressively deliver those responses.

### Migration

- Set `maxBufferedRequestBodyBytes` when calling `provideEffectHttpClient(...)` if an application intentionally sends larger buffered uploads, or use a streaming-capable transport.
- Configure `baseUrl` for relative URLs during SSR.
- Use unframed JSON RPC serialization with the Angular HTTP adapter; move framed or streaming RPC procedures to a streaming-capable protocol.
