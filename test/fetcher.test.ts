import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MetroTransitFetcher,
  extractTranslatedText,
  FetcherRegistry,
  defaultRegistry,
} from '../src/fetcher/index.js';

describe('fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractTranslatedText', () => {
    it('returns empty string for undefined and null', () => {
      expect(extractTranslatedText(undefined)).toBe('');
      expect(extractTranslatedText(null)).toBe('');
    });

    it('returns trimmed string for direct string', () => {
      expect(extractTranslatedText('  Direct String  ')).toBe('Direct String');
    });

    it('extracts English translation when available', () => {
      const obj = {
        translation: [
          { text: 'Español', language: 'es' },
          { text: 'English Notice', language: 'en' },
        ],
      };
      expect(extractTranslatedText(obj)).toBe('English Notice');
    });

    it('falls back to first translation if English not found', () => {
      const obj = {
        translation: [{ text: 'Sólo Español', language: 'es' }],
      };
      expect(extractTranslatedText(obj)).toBe('Sólo Español');
    });

    it('returns empty string when translation has no text or translation array is empty', () => {
      expect(extractTranslatedText({ translation: [] })).toBe('');
      expect(extractTranslatedText({ translation: [{ language: 'fr' }] })).toBe('');
      expect(extractTranslatedText({} as any)).toBe('');
    });
  });

  describe('MetroTransitFetcher', () => {
    it('parses GTFS-RT feed format into RawAlert structures', () => {
      const fetcher = new MetroTransitFetcher();
      const mockFeed = [
        {
          id: '12345',
          last_modified_timestamp: 1789275602,
          alert_lifecycle: 'NEW',
          active_period: [{ start: 100, end: 200 }],
          cause: 'CONSTRUCTION',
          effect: 'DETOUR',
          effect_detail: 'DETOUR',
          url: { translation: [{ text: 'https://metrotransit.org/alert/1', language: 'en' }] },
          header_text: {
            translation: [{ text: 'Route 21 detoured', language: 'en' }],
          },
          description_text: {
            translation: [{ text: 'Board at Lake & 10th', language: 'en' }],
          },
          informed_entity: [
            {
              agency_id: 1,
              route_id: 21,
              route_label: 'Route 21',
              stop_id: 1234,
              trip: {
                trip_id: 'trip-9',
                direction_id: 1,
              },
            },
          ],
        },
      ];

      const parsed = fetcher.parseFeed(mockFeed);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('12345');
      expect(parsed[0].agency).toBe('Metro Transit');
      expect(parsed[0].headerText).toBe('Route 21 detoured');
      expect(parsed[0].descriptionText).toBe('Board at Lake & 10th');
      expect(parsed[0].url).toBe('https://metrotransit.org/alert/1');
      expect(parsed[0].informedEntities[0].routeId).toBe('21');
      expect(parsed[0].informedEntities[0].agencyId).toBe('1');
      expect(parsed[0].informedEntities[0].stopId).toBe('1234');
      expect(parsed[0].informedEntities[0].directionId).toBe(1);
      expect(parsed[0].informedEntities[0].tripId).toBe('trip-9');

      // Test with informed entities having undefined fields
      const emptyEntitiesFeed = [
        {
          id: 'item-2',
          header_text: 'Test',
          description_text: 'Test',
          informed_entity: [{}],
        },
        {
          id: 'item-3',
          header_text: '',
          description_text: '',
        },
      ];
      const parsedEmpty = fetcher.parseFeed(emptyEntitiesFeed);
      expect(parsedEmpty[0].informedEntities[0].agencyId).toBeUndefined();
      expect(parsedEmpty[0].informedEntities[0].routeId).toBeUndefined();
      expect(parsedEmpty[0].informedEntities[0].stopId).toBeUndefined();
      expect(parsedEmpty[0].informedEntities[0].tripId).toBeUndefined();
      expect(parsedEmpty[1].informedEntities).toEqual([]);
    });

    it('parses entity container structure with alert property and without id', () => {
      const fetcher = new MetroTransitFetcher();
      const mockContainer = {
        entity: [
          {
            alert: {
              header_text: 'Test alert in entity.alert',
              description_text: 'Test desc',
            },
          },
          {
            id: 'alert-99',
            header_text: 'Test header direct',
            description_text: 'Test desc',
          },
        ],
      };

      const parsed = fetcher.parseFeed(mockContainer);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('alert-1');
      expect(parsed[1].id).toBe('alert-99');
    });

    it('parses alerts property structure', () => {
      const fetcher = new MetroTransitFetcher();
      const mockObj = {
        alerts: [
          {
            id: 'alert-from-alerts',
            header_text: 'Header',
            description_text: 'Desc',
          },
        ],
      };

      const parsed = fetcher.parseFeed(mockObj);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('alert-from-alerts');
    });

    it('returns empty array when feed data is invalid or empty object', () => {
      const fetcher = new MetroTransitFetcher();
      expect(fetcher.parseFeed(null)).toEqual([]);
      expect(fetcher.parseFeed({})).toEqual([]);
      expect(fetcher.parseFeed('invalid' as any)).toEqual([]);
    });

    it('successfully fetches alerts with default and custom options', async () => {
      const fetcher = new MetroTransitFetcher();
      const mockData = [{ id: 'live-1', header_text: 'Live alert', description_text: '' }];

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockData,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      const alerts = await fetcher.fetchAlerts();
      expect(fetchSpy).toHaveBeenCalled();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('live-1');
    });

    it('passes custom signal, headers, and timeoutMs to fetchAlerts', async () => {
      const fetcher = new MetroTransitFetcher('https://custom.api/alerts');
      const customController = new AbortController();

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      await fetcher.fetchAlerts({
        headers: { Authorization: 'Bearer token' },
        signal: customController.signal,
        timeoutMs: 5000,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://custom.api/alerts',
        expect.objectContaining({
          signal: customController.signal,
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        })
      );
    });

    it('throws when API responds with error status', async () => {
      const fetcher = new MetroTransitFetcher();
      const mockResponse = {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

      await expect(fetcher.fetchAlerts()).rejects.toThrow('Metro Transit API responded with HTTP 503: Service Unavailable');
    });
  });

  describe('FetcherRegistry', () => {
    it('registers and retrieves fetchers by agency name', () => {
      const registry = new FetcherRegistry();
      const mt = registry.get('Metro Transit');
      expect(mt).toBeDefined();
      expect(mt?.agencyName).toBe('Metro Transit');
      expect(registry.getAll().length).toBeGreaterThanOrEqual(1);
    });

    it('fetches all alerts from a specific registered agency', async () => {
      const registry = new FetcherRegistry();
      const fetcher = registry.get('Metro Transit')!;
      vi.spyOn(fetcher, 'fetchAlerts').mockResolvedValueOnce([
        {
          id: 'mt-1',
          agency: 'Metro Transit',
          headerText: 'Header',
          descriptionText: '',
          informedEntities: [],
        },
      ]);

      const alerts = await registry.fetchAll('metro transit');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('mt-1');
    });

    it('throws when requesting unregistered agency', async () => {
      const registry = new FetcherRegistry();
      await expect(registry.fetchAll('NonExistentAgency')).rejects.toThrow(
        'No fetcher registered for agency "NonExistentAgency"'
      );
    });

    it('fetches from all agencies and handles failures gracefully with console.warn', async () => {
      const registry = new FetcherRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Add a mock failing fetcher
      const failingFetcher = {
        agencyName: 'Failing Agency',
        defaultUrl: 'http://fail',
        fetchAlerts: vi.fn().mockRejectedValue(new Error('Connection timed out')),
      };
      registry.register(failingFetcher);

      const mt = registry.get('Metro Transit')!;
      vi.spyOn(mt, 'fetchAlerts').mockResolvedValueOnce([
        {
          id: 'mt-success',
          agency: 'Metro Transit',
          headerText: 'OK',
          descriptionText: '',
          informedEntities: [],
        },
      ]);

      const alerts = await registry.fetchAll();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('mt-success');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch alerts from Failing Agency:'),
        expect.any(Error)
      );
    });

    it('defaultRegistry is exported and ready to use', () => {
      expect(defaultRegistry).toBeInstanceOf(FetcherRegistry);
      expect(defaultRegistry.get('Metro Transit')).toBeDefined();
    });
  });
});
