import {
  HttpClient as AngularHttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import {
  HttpBody,
  HttpClient as EffectHttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

export const DEFAULT_MAX_BUFFERED_REQUEST_BODY_BYTES = 16 * 1024 * 1024;

export type EffectHttpClientOptions = {
  /**
   * Absolute URL used to resolve relative requests when no browser location is available, such as
   * during server-side rendering. A factory is resolved when the adapter is created.
   */
  readonly baseUrl?: string | URL | (() => string | URL);
  /** Maximum number of bytes buffered for an Effect stream request body. */
  readonly maxBufferedRequestBodyBytes?: number;
};

export class BufferedRequestBodyTooLargeError extends Error {
  override readonly name = 'BufferedRequestBodyTooLargeError';

  constructor(
    readonly maxBytes: number,
    readonly receivedBytes: number,
  ) {
    super(
      `Buffered request body exceeded the ${maxBytes}-byte limit after receiving ${receivedBytes} bytes`,
    );
  }
}

class BufferedRequestBodyBufferingError extends Error {
  override readonly name = 'BufferedRequestBodyBufferingError';

  constructor(override readonly cause: unknown) {
    super('Failed to buffer the stream request body', { cause });
  }
}

type BufferedStreamBody = {
  readonly bytes: Uint8Array;
  readonly byteLength: number;
};

const transportError = (
  request: HttpClientRequest.HttpClientRequest,
  description: string,
  cause?: unknown,
): HttpClientError.HttpClientError =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({
      request,
      description,
      cause,
    }),
  });

const encodeError = (
  request: HttpClientRequest.HttpClientRequest,
  cause: unknown,
  description?: string,
): HttpClientError.HttpClientError =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.EncodeError({
      request,
      cause,
      description,
    }),
  });

const bufferStreamBody = (body: BufferedStreamBody): ArrayBuffer => {
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(body.bytes.subarray(0, body.byteLength));
  return bytes.buffer;
};

const appendStreamChunk = (
  buffered: BufferedStreamBody,
  chunk: Uint8Array,
  maxBufferedRequestBodyBytes: number,
): Effect.Effect<
  BufferedStreamBody,
  BufferedRequestBodyTooLargeError | BufferedRequestBodyBufferingError
> => {
  if (chunk.byteLength === 0) {
    return Effect.succeed(buffered);
  }

  const byteLength = buffered.byteLength + chunk.byteLength;
  if (!Number.isSafeInteger(byteLength) || byteLength > maxBufferedRequestBodyBytes) {
    return Effect.fail(
      new BufferedRequestBodyTooLargeError(maxBufferedRequestBodyBytes, byteLength),
    );
  }

  return Effect.try({
    try: () => {
      let bytes = buffered.bytes;
      if (byteLength > bytes.byteLength) {
        const doubledCapacity =
          bytes.byteLength === 0
            ? 1
            : bytes.byteLength > Math.floor(maxBufferedRequestBodyBytes / 2)
              ? maxBufferedRequestBodyBytes
              : bytes.byteLength * 2;
        const grown = new Uint8Array(Math.max(byteLength, doubledCapacity));
        grown.set(bytes.subarray(0, buffered.byteLength));
        bytes = grown;
      }

      bytes.set(chunk, buffered.byteLength);
      return { bytes, byteLength };
    },
    catch: (cause) => new BufferedRequestBodyBufferingError(cause),
  });
};

// Angular HttpClient does not progressively upload stream bodies, so collect them once with a
// finite limit and pass a binary payload to Angular.
const collectStreamBody = (
  request: HttpClientRequest.HttpClientRequest,
  body: HttpBody.Stream,
  maxBufferedRequestBodyBytes: number,
): Effect.Effect<ArrayBuffer, HttpClientError.HttpClientError> => {
  if (body.contentLength !== undefined && body.contentLength > maxBufferedRequestBodyBytes) {
    const cause = new BufferedRequestBodyTooLargeError(
      maxBufferedRequestBodyBytes,
      body.contentLength,
    );
    return Effect.fail(encodeError(request, cause, cause.message));
  }

  return Effect.matchEffect(
    Effect.scoped(
      Stream.runFoldEffect(
        body.stream,
        (): BufferedStreamBody => ({ bytes: new Uint8Array(0), byteLength: 0 }),
        (buffered, chunk) => appendStreamChunk(buffered, chunk, maxBufferedRequestBodyBytes),
      ),
    ),
    {
      onFailure: (cause) =>
        Effect.fail(
          encodeError(
            request,
            cause,
            cause instanceof BufferedRequestBodyTooLargeError ? cause.message : undefined,
          ),
        ),
      onSuccess: (buffered) => Effect.succeed(bufferStreamBody(buffered)),
    },
  );
};

const textDecoder = new TextDecoder();

const isJsonContentType = (contentType: string | undefined): boolean =>
  typeof contentType === 'string' &&
  contentType.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => new Uint8Array(bytes).buffer;

// Normalize Effect request bodies into something HttpClient can send.
const resolveBody = (
  request: HttpClientRequest.HttpClientRequest,
  maxBufferedRequestBodyBytes: number,
): Effect.Effect<unknown, HttpClientError.HttpClientError> => {
  const body = request.body;
  switch (body._tag) {
    case 'Empty':
      return Effect.void;
    case 'Raw':
      return Effect.succeed(body.body);
    case 'Uint8Array':
      return Effect.succeed(
        isJsonContentType(body.contentType)
          ? textDecoder.decode(body.body)
          : toArrayBuffer(body.body),
      );
    case 'FormData':
      return Effect.succeed(body.formData);
    case 'Stream':
      return collectStreamBody(request, body, maxBufferedRequestBodyBytes);
  }
};

// Preserve repeated response headers for the Fetch Response conversion.
const toHeaderEntries = (headers: HttpHeaders): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  for (const name of headers.keys()) {
    const values = headers.getAll(name);
    if (!values) {
      continue;
    }
    for (const value of values) {
      entries.push([name, value]);
    }
  }
  return entries;
};

// Reuse the Effect response helpers by adapting HttpClient responses to Fetch Response.
const toEffectResponse = (
  request: HttpClientRequest.HttpClientRequest,
  response: HttpResponse<ArrayBuffer>,
): HttpClientResponse.HttpClientResponse => {
  const headers = toHeaderEntries(response.headers);
  const body =
    response.status === 204 || response.status === 205 || response.status === 304
      ? null
      : (response.body ?? null);
  const webResponse = new Response(body, {
    status: response.status,
    statusText: response.statusText ?? '',
    headers,
  });
  return HttpClientResponse.fromWeb(request, webResponse);
};

const normalizeMaxBufferedRequestBodyBytes = (value: number | undefined): number => {
  const maxBytes = value ?? DEFAULT_MAX_BUFFERED_REQUEST_BODY_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBufferedRequestBodyBytes must be a non-negative safe integer');
  }
  return maxBytes;
};

const normalizeBaseUrl = (value: EffectHttpClientOptions['baseUrl']): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const resolved = typeof value === 'function' ? value() : value;
  return new URL(resolved.toString()).toString();
};

const resolveRequestBaseUrl = (
  request: HttpClientRequest.HttpClientRequest,
  baseUrl: string,
): Effect.Effect<HttpClientRequest.HttpClientRequest, HttpClientError.HttpClientError> =>
  Effect.try({
    try: () => HttpClientRequest.setUrl(request, new URL(request.url, baseUrl).toString()),
    catch: (cause) =>
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.InvalidUrlError({
          request,
          cause,
        }),
      }),
  });

export const createAngularHttpClient = (
  httpClient: AngularHttpClient,
  options: EffectHttpClientOptions = {},
): EffectHttpClient.HttpClient => {
  const maxBufferedRequestBodyBytes = normalizeMaxBufferedRequestBodyBytes(
    options.maxBufferedRequestBodyBytes,
  );
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const client = EffectHttpClient.make((request, url, signal) =>
    Effect.flatMap(resolveBody(request, maxBufferedRequestBodyBytes), (body) =>
      Effect.callback<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>(
        (resume) => {
          let receivedResponse = false;
          const resumeResponse = (response: HttpResponse<ArrayBuffer>) => {
            receivedResponse = true;
            resume(
              Effect.try({
                try: () => toEffectResponse(request, response),
                catch: (cause) =>
                  transportError(request, 'Failed to adapt the Angular HttpClient response', cause),
              }),
            );
          };
          const subscription = httpClient
            .request('' + request.method, url.toString(), {
              body,
              headers: new HttpHeaders(request.headers),
              observe: 'response',
              responseType: 'arraybuffer',
            })
            .subscribe({
              next: resumeResponse,
              error: (cause) => {
                // HttpClient reports non-2xx statuses as HttpErrorResponse; map them into a response.
                if (cause instanceof HttpErrorResponse && cause.status !== 0) {
                  const response = new HttpResponse<ArrayBuffer>({
                    body: (cause.error as ArrayBuffer | null) ?? null,
                    headers: cause.headers,
                    status: cause.status,
                    statusText: cause.statusText,
                    url: cause.url ?? undefined,
                  });
                  resumeResponse(response);
                  return;
                }

                resume(
                  Effect.fail(transportError(request, 'Angular HttpClient request failed', cause)),
                );
              },
              complete: () => {
                if (!receivedResponse) {
                  resume(
                    Effect.fail(
                      transportError(
                        request,
                        'Angular HttpClient completed without emitting a response',
                      ),
                    ),
                  );
                }
              },
            });

          // Abort signals should cancel the in-flight HttpClient request.
          const abort = () => {
            subscription.unsubscribe();
          };

          if (signal.aborted) {
            abort();
          } else {
            signal.addEventListener('abort', abort, { once: true });
          }

          return Effect.sync(() => {
            signal.removeEventListener('abort', abort);
            subscription.unsubscribe();
          });
        },
      ),
    ),
  );

  if (baseUrl === undefined) {
    return client;
  }

  // Resolve relative URLs after all request preprocessors (including the RPC URL prefix) have run,
  // but before Effect validates the URL in the underlying client.
  return EffectHttpClient.makeWith(
    (request) =>
      client.postprocess(
        Effect.flatMap(request, (request) => resolveRequestBaseUrl(request, baseUrl)),
      ),
    client.preprocess,
  );
};
