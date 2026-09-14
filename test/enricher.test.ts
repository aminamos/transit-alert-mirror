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

  it('handles alert with undefined lastModifiedTimestamp, cause, and effect', () => {
    const raw: RawAlert = {
      id: 'minimal-1',
      agency: 'Metro Transit',
      headerText: 'Advisory without timestamps',
      descriptionText: '',
      informedEntities: [],
    };

    const enriched = enrichAlert(raw);
    expect(enriched.cause).toBe('GENERAL');
    expect(enriched.effect).toBe('ADVISORY');
    expect(enriched.updatedAt).toBeDefined();
  });

  it('sorts enriched alerts with Critical first, then Moderate, then Minor, and by route when severity ties', () => {
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
        headerText: 'Route 10 trip canceled',
        descriptionText: '',
        informedEntities: [{ routeId: '10' }],
      },
      {
        id: '3',
        agency: 'Agency',
        cause: 'OTHER',
        effect: 'NO_SERVICE',
        effectDetail: 'CANCELLATION',
        headerText: 'Route 2 trip canceled',
        descriptionText: '',
        informedEntities: [{ routeId: '2' }],
      },
      {
        id: '4',
        agency: 'Agency',
        cause: 'OTHER',
        effect: 'NO_SERVICE',
        effectDetail: 'CANCELLATION',
        headerText: 'Trip canceled without route',
        descriptionText: '',
        informedEntities: [],
      },
      {
        id: '5',
        agency: 'Agency',
        cause: 'OTHER',
        effect: 'ADVISORY',
        headerText: 'Route 10 advisory notice',
        descriptionText: '',
        informedEntities: [{ routeId: '10' }],
      },
    ];

    const dataset = enrichAlerts(rawAlerts);
    expect(dataset.metadata.totalAlerts).toBe(5);
    expect(dataset.metadata.criticalCount).toBe(3);
    expect(dataset.metadata.moderateCount).toBe(1);
    expect(dataset.metadata.minorCount).toBe(1);

    // Critical alerts sorted by route: Route 2 before Route 10, then Systemwide
    const criticalAlerts = dataset.alerts.filter(a => a.severity === 'Critical');
    expect(criticalAlerts[0].affectedRoutes[0]).toBe('Route 2');
    expect(criticalAlerts[1].affectedRoutes[0]).toBe('Route 10');
    expect(criticalAlerts[2].affectedRoutes[0]).toBe('Systemwide');
  });

  it('handles alerts with unknown severity gracefully during sort', () => {
    const rawAlerts: RawAlert[] = [
      {
        id: '1',
        agency: 'Agency A',
        headerText: 'Advisory 1',
        descriptionText: '',
        informedEntities: [],
      },
      {
        id: '2',
        agency: 'Agency B',
        headerText: 'Advisory 2',
        descriptionText: '',
        informedEntities: [],
      },
    ];

    const dataset = enrichAlerts(rawAlerts);
    expect(dataset.metadata.agencies).toContain('Agency A');
    expect(dataset.metadata.agencies).toContain('Agency B');
  });
});
