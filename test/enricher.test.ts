import { describe, it, expect } from 'vitest';
import { enrichAlert, enrichAlerts } from '../src/enricher/index.js';
import type { RawAlert } from '../types/index.js';

describe('enricher end-to-end', () => {
  it('enriches a raw alert with all fields populated', () => {
    const raw: RawAlert = {
      id: '501',
      agency: 'Metro Transit',
      lastModifiedTimestamp: 1789275600,
      cause: 'CONSTRUCTION',
      effect: 'DETOUR',
      effectDetail: 'DETOUR',
      headerText: 'E Line detoured off Upton Ave/Sheridan Ave from 44th St to 39th St beginning Mon Sep 14 at 6:30 AM until further notice due to tree trimming',
      descriptionText: `For northbound E Line get on/off buses at:
44th St & Abbott Station - Stop #6195 (eastbound)
Temporary stop on 42nd St W at Upton Ave (eastbound)

Affected stops:
Sheridan & 43rd St Station - Stop #6202 (northbound)
Sheridan & 39th St Station - Stop #6206 (northbound)`,
      informedEntities: [
        { routeId: '925', routeLabel: 'METRO E Line', stopId: '6202' },
      ],
    };

    const enriched = enrichAlert(raw);
    expect(enriched.id).toBe('501');
    expect(enriched.severity).toBe('Moderate');
    expect(enriched.affectedRoutes).toContain('METRO E Line');
    expect(enriched.direction).toBe('Northbound');
    expect(enriched.riderAlternative).toContain('Board at:');
    expect(enriched.closedStopIds).toContain('6202');
    expect(enriched.closedStopIds).toContain('6206');
    expect(enriched.intersections.length).toBeGreaterThan(0);
  });

  it('sorts enriched alerts with Critical first, then Moderate, then Minor', () => {
    const rawAlerts: RawAlert[] = [
      {
        id: '1',
        agency: 'Agency',
        cause: 'CONSTRUCTION',
        effect: 'DETOUR',
        headerText: 'Route 21 detour',
        descriptionText: '',
        informedEntities: [{ routeId: '21' }],
      },
      {
        id: '2',
        agency: 'Agency',
        cause: 'OTHER',
        effect: 'NO_SERVICE',
        effectDetail: 'CANCELLATION',
        headerText: 'Route 5 trip canceled',
        descriptionText: '',
        informedEntities: [{ routeId: '5' }],
      },
      {
        id: '3',
        agency: 'Agency',
        cause: 'OTHER',
        effect: 'ADVISORY',
        headerText: 'Route 10 advisory notice',
        descriptionText: '',
        informedEntities: [{ routeId: '10' }],
      },
    ];

    const dataset = enrichAlerts(rawAlerts);
    expect(dataset.metadata.totalAlerts).toBe(3);
    expect(dataset.metadata.criticalCount).toBe(1);
    expect(dataset.metadata.moderateCount).toBe(1);
    expect(dataset.metadata.minorCount).toBe(1);

    expect(dataset.alerts[0].severity).toBe('Critical');
    expect(dataset.alerts[1].severity).toBe('Moderate');
    expect(dataset.alerts[2].severity).toBe('Minor');
  });
});
