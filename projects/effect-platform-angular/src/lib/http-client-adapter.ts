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
  type HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

// Convert Effect stream bodies into a single Uint8Array payload for HttpClient.
const collectStreamBody = (
  request: HttpClientRequest.HttpClientRequest,
  body: HttpBody.Stream,
): Effect.Effect<Uint8Array, HttpClientError.RequestError> =>
  Effect.matchEffect(Effect.scoped(Stream.runFold(body.stream, new Uint8Array(0), appendChunk)), {
    onFailure: (cause) =>
      Effect.fail(
        new HttpClientError.RequestError({
          request,
          reason: 'Encode',
          cause,
        }),
      ),
    onSuccess: (payload) => Effect.succeed(payload),
  });

const appendChunk = (acc: Uint8Array, chunk: Uint8Array): Uint8Array => {
  const next = new Uint8Array(acc.length + chunk.length);
  next.set(acc, 0);
  next.set(chunk, acc.length);
  return next;
};

// Normalize Effect request bodies into something HttpClient can send.
const resolveBody = (
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<unknown, HttpClientError.RequestError> => {
  const body = request.body;
  switch (body._tag) {
    case 'Empty':
      return Effect.succeed(undefined);
    case 'Raw':
      return Effect.succeed(body.body);
    case 'Uint8Array':
      return Effect.succeed(body.body);
    case 'FormData':
      return Effect.succeed(body.formData);
    case 'Stream':
      return collectStreamBody(request, body);
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
  const body = response.body ?? null;
  const webResponse = new Response(body, {
    status: response.status,
    statusText: response.statusText ?? '',
    headers,
  });
  return HttpClientResponse.fromWeb(request, webResponse);
};

export const createAngularHttpClient = (httpClient: AngularHttpClient): EffectHttpClient.HttpClient =>
  EffectHttpClient.make((request, url, signal) =>
    Effect.flatMap(resolveBody(request), (body) =>
      Effect.async((resume) => {
        const subscription = httpClient
          .request('' + request.method, url.toString(), {
            body,
            headers: new HttpHeaders(request.headers),
            observe: 'response',
            responseType: 'arraybuffer',
          })
          .subscribe({
            next: (response) => resume(Effect.succeed(toEffectResponse(request, response))),
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
                resume(Effect.succeed(toEffectResponse(request, response)));
                return;
              }

              resume(
                Effect.fail(
                  new HttpClientError.RequestError({
                    request,
                    reason: 'Transport',
                    cause,
                  }),
                ),
              );
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
      }),
    ),
  );
