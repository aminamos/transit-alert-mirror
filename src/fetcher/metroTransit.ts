import type { AlertFetcher, FetchOptions } from './base.js';
import type { RawAlert, InformedEntity } from '../types/index.js';

interface GtfsRtTranslation {
  text?: string;
  language?: string;
}

interface GtfsRtTranslatedString {
  translation?: GtfsRtTranslation[];
}

interface MetroTransitRawEntity {
  id?: string | number;
  last_modified_timestamp?: number;
  alert_lifecycle?: string;
  active_period?: Array<{ start?: number; end?: number }>;
  informed_entity?: Array<{
    agency_id?: string | number;
    route_id?: string | number;
    route_type?: number;
    stop_id?: string | number;
    route_label?: string;
    trip?: {
      trip_id?: string | number;
      route_id?: string | number;
      direction_id?: number;
      direction_text?: string;
    };
  }>;
  cause?: string;
  effect?: string;
  effect_detail?: string;
  url?: GtfsRtTranslatedString | string;
  header_text?: GtfsRtTranslatedString | string;
  description_text?: GtfsRtTranslatedString | string;
}

export function extractTranslatedText(field: GtfsRtTranslatedString | string | undefined | null): string {
  if (!field) return '';
  if (typeof field === 'string') return field.trim();
  if (Array.isArray(field.translation) && field.translation.length > 0) {
    const en = field.translation.find(t => t.language?.toLowerCase().startsWith('en'));
    return (en?.text || field.translation[0]?.text || '').trim();
  }
  return '';
}

export class MetroTransitFetcher implements AlertFetcher {
  readonly agencyName = 'Metro Transit';
  readonly defaultUrl = 'https://svc.metrotransit.org/alerts/all';

  constructor(private readonly url: string = 'https://svc.metrotransit.org/alerts/all') {}

  async fetchAlerts(options: FetchOptions = {}): Promise<RawAlert[]> {
    const timeout = options.timeoutMs ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'transit-alert-mirror/1.0 (+https://github.com/aminamos/transit-alert-mirror)',
          ...options.headers,
        },
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Metro Transit API responded with HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return this.parseFeed(json);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  parseFeed(data: unknown): RawAlert[] {
    let rawItems: MetroTransitRawEntity[] = [];

    if (Array.isArray(data)) {
      rawItems = data as MetroTransitRawEntity[];
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.entity)) {
        rawItems = obj.entity.map((e: unknown) => {
          const entityObj = e as Record<string, unknown>;
          return (entityObj.alert ?? entityObj) as MetroTransitRawEntity;
        });
      } else if (Array.isArray(obj.alerts)) {
        rawItems = obj.alerts as MetroTransitRawEntity[];
      }
    }

    return rawItems.map((item, index) => {
      const id = String(item.id ?? `alert-${index + 1}`);
      const headerText = extractTranslatedText(item.header_text);
      const descriptionText = extractTranslatedText(item.description_text);
      const urlText = extractTranslatedText(item.url);

      const informedEntities: InformedEntity[] = (item.informed_entity || []).map(ie => ({
        agencyId: ie.agency_id !== undefined ? String(ie.agency_id) : undefined,
        routeId: ie.route_id !== undefined ? String(ie.route_id) : undefined,
        routeLabel: ie.route_label,
        stopId: ie.stop_id !== undefined ? String(ie.stop_id) : undefined,
        directionId: ie.trip?.direction_id,
        tripId: ie.trip?.trip_id !== undefined ? String(ie.trip.trip_id) : undefined,
      }));

      return {
        id,
        agency: this.agencyName,
        lastModifiedTimestamp: item.last_modified_timestamp,
        alertLifecycle: item.alert_lifecycle,
        activePeriod: item.active_period,
        informedEntities,
        cause: item.cause,
        effect: item.effect,
        effectDetail: item.effect_detail,
        url: urlText || undefined,
        headerText,
        descriptionText,
        raw: item,
      };
    });
  }
}
