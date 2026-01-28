import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { EFFECT_HTTP_CLIENT, provideEffectHttpClient } from './effect-http-client';

describe('Effect HTTP client provider', () => {
  it('registers the Effect HttpClient adapter via Angular DI', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideEffectHttpClient()],
    });

    const client = TestBed.inject(EFFECT_HTTP_CLIENT);

    expect(client).toBeTruthy();
    expect(typeof client.execute).toBe('function');
  });
});
