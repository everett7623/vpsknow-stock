import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPoorVpsDiscoveryCache,
  decodePoorVpsCatalog,
  fetchDiscoveredPoorVpsCatalog,
} from './poorvps.js';

const ENCRYPTED_FIXTURE =
  'U2FsdGVkX18xMjM0NTY3OMntQCOYWOBFtway80/I5lSXjoqL6fWYurZ5MlNWaXZBruaDxkehxNMhld3MP4MN1A==';

describe('PoorVPS catalog decoder', () => {
  afterEach(() => {
    clearPoorVpsDiscoveryCache();
    vi.unstubAllGlobals();
  });

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

  it('discovers the rotating catalog URL and password from public assets', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url === 'https://lightlayer.cn/') {
        return new Response(`
          <html>
            <head>
              <script src="https://track.example/main.js"></script>
              <link rel="modulepreload" href="https://cdn.poorvps.com/assets/gone.js">
              <link rel="modulepreload" href="https://cdn.poorvps.com/assets/config.js">
            </head>
          </html>
        `);
      }
      if (url === 'https://cdn.poorvps.com/assets/config.js') {
        return new Response(
          'const files={"lightlayer.json":`cache-current.txt`};const key=`test-password`;',
        );
      }
      if (url === 'https://cdn.poorvps.com/data/cache-current.txt') {
        return new Response(ENCRYPTED_FIXTURE);
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDiscoveredPoorVpsCatalog('LightLayer', 'https://lightlayer.cn/', 'lightlayer.json'),
    ).resolves.toEqual({ '102': { title: 'LA-VP03' } });
    await expect(
      fetchDiscoveredPoorVpsCatalog('LightLayer', 'https://lightlayer.cn/', 'lightlayer.json'),
    ).resolves.toEqual({ '102': { title: 'LA-VP03' } });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('fails closed when the public bundle cannot decrypt its catalog', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url === 'https://lightlayer.cn/') {
        return new Response('<script src="https://cdn.poorvps.com/assets/config.js"></script>');
      }
      if (url === 'https://cdn.poorvps.com/assets/config.js') {
        return new Response(
          'const files={"lightlayer.json":`cache-current.txt`};const key=`wrong-password`;',
        );
      }
      if (url === 'https://cdn.poorvps.com/data/cache-current.txt') {
        return new Response(ENCRYPTED_FIXTURE);
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDiscoveredPoorVpsCatalog('LightLayer', 'https://lightlayer.cn/', 'lightlayer.json'),
    ).rejects.toThrow('LightLayer PoorVPS discovery could not decrypt lightlayer.json');
  });

  it('rediscovers the catalog after a cached data URL fails', async () => {
    let discoveryCount = 0;
    let currentDataRequests = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url === 'https://lightlayer.cn/?rotation-test=1') {
        discoveryCount += 1;
        return new Response('<script src="https://cdn.poorvps.com/assets/config.js"></script>');
      }
      if (url === 'https://cdn.poorvps.com/assets/config.js') {
        const file = discoveryCount === 1 ? 'cache-current.txt' : 'cache-next.txt';
        return new Response(
          `const files={"lightlayer.json":\`${file}\`};const key=\`test-password\`;`,
        );
      }
      if (url === 'https://cdn.poorvps.com/data/cache-current.txt') {
        currentDataRequests += 1;
        return currentDataRequests === 1
          ? new Response(ENCRYPTED_FIXTURE)
          : new Response('gone', { status: 404 });
      }
      if (url === 'https://cdn.poorvps.com/data/cache-next.txt') {
        return new Response(ENCRYPTED_FIXTURE);
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDiscoveredPoorVpsCatalog(
        'LightLayer',
        'https://lightlayer.cn/?rotation-test=1',
        'lightlayer.json',
      ),
    ).resolves.toEqual({ '102': { title: 'LA-VP03' } });
    await expect(
      fetchDiscoveredPoorVpsCatalog(
        'LightLayer',
        'https://lightlayer.cn/?rotation-test=1',
        'lightlayer.json',
      ),
    ).resolves.toEqual({ '102': { title: 'LA-VP03' } });
    expect(discoveryCount).toBe(2);
  });
});
