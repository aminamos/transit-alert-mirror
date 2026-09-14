import { describe, it, expect } from 'vitest';
import {
  MetroTransitFetcher,
  extractTranslatedText,
  FetcherRegistry,
} from '../src/fetcher/index.js';

describe('fetcher', () => {
  describe('extractTranslatedText', () => {
    it('extracts English translation when available', () => {
      const obj = {
        translation: [
          { text: 'Español', language: 'es' },
          { text: 'English Notice', language: 'en' },
        ],
      };
      expect(extractTranslatedText(obj)).toBe('English Notice');
    });

    it('handles direct string', () => {
      expect(extractTranslatedText('Direct String')).toBe('Direct String');
      expect(extractTranslatedText(undefined)).toBe('');
    });
  });

  describe('MetroTransitFetcher', () => {
    it('parses GTFS-RT feed format into RawAlert structures', () => {
      const fetcher = new MetroTransitFetcher();
      const mockFeed = [
        {
          id: '12345',
          last_modified_timestamp: 1789275602,
          cause: 'CONSTRUCTION',
          effect: 'DETOUR',
          effect_detail: 'DETOUR',
          header_text: {
            translation: [{ text: 'Route 21 detoured', language: 'en' }],
          },
          description_text: {
            translation: [{ text: 'Board at Lake & 10th', language: 'en' }],
          },
          informed_entity: [
            {
              route_id: '21',
              route_label: 'Route 21',
              stop_id: '1234',
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
      expect(parsed[0].informedEntities[0].routeId).toBe('21');
    });

    it('parses entity container structure', () => {
      const fetcher = new MetroTransitFetcher();
      const mockContainer = {
        entity: [
          {
            id: 'alert-99',
            header_text: 'Test header',
            description_text: 'Test desc',
          },
        ],
      };

      const parsed = fetcher.parseFeed(mockContainer);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('alert-99');
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
  });
});
