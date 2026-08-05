import { describe, expect, it } from 'vitest';
import { decodePoorVpsCatalog } from './poorvps.js';

const ENCRYPTED_FIXTURE =
  'U2FsdGVkX18xMjM0NTY3OMntQCOYWOBFtway80/I5lSXjoqL6fWYurZ5MlNWaXZBruaDxkehxNMhld3MP4MN1A==';

describe('PoorVPS catalog decoder', () => {
  it('decodes the OpenSSL AES and zlib payload used by PoorVPS', () => {
    expect(decodePoorVpsCatalog(ENCRYPTED_FIXTURE, 'test-password')).toEqual({
      '102': { title: 'LA-VP03' },
    });
  });

  it('rejects a response that is not an encrypted catalog', () => {
    expect(() => decodePoorVpsCatalog('not-a-catalog', 'test-password')).toThrow(
      'PoorVPS payload is not an OpenSSL salted message',
    );
  });
});
