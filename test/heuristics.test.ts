import { describe, it, expect } from 'vitest';
import {
  extractRoutes,
  extractDirection,
  extractClosedStops,
  extractIntersections,
  extractRiderAlternative,
  computeSeverity,
  generatePlainTitle,
  generatePlainSummary,
} from '../src/enricher/heuristics.js';

describe('heuristics', () => {
  describe('extractRoutes', () => {
    it('extracts routes from informed entities and text', () => {
      const header = 'Routes 537 and 538 detoured';
      const desc = 'E Line and Route 21 also affected';
      const entities = [{ routeId: '36', routeLabel: 'Route 36' }];
      const routes = extractRoutes(header, desc, entities);

      expect(routes).toContain('Route 537');
      expect(routes).toContain('Route 538');
      expect(routes).toContain('METRO E Line');
      expect(routes).toContain('Route 21');
      expect(routes).toContain('Route 36');
    });

    it('handles METRO colored lines correctly', () => {
      const routes = extractRoutes('Blue Line and Green Line maintenance', '');
      expect(routes).toContain('METRO Blue Line');
      expect(routes).toContain('METRO Green Line');
    });
  });

  describe('extractDirection', () => {
    it('detects single directions', () => {
      expect(extractDirection('Northbound Route 11', '')).toBe('Northbound');
      expect(extractDirection('SB Route 6', '')).toBe('Southbound');
      expect(extractDirection('Eastbound E Line', '')).toBe('Eastbound');
      expect(extractDirection('WB Route 21', '')).toBe('Westbound');
    });

    it('detects both directions', () => {
      expect(extractDirection('Detour in both directions', '')).toBe('Both Directions');
      expect(extractDirection('Northbound and southbound buses detoured', '')).toBe('Both Directions');
    });
  });

  describe('extractClosedStops', () => {
    it('extracts closed stops from formatted list', () => {
      const desc = `
Affected stops:
Dale St & Grand Ave - Stop #10680 (northbound)
Dale St & Summit Ave - Stop #10681 (northbound)
      `;
      const { stopIds, details } = extractClosedStops('', desc);
      expect(stopIds).toEqual(['10680', '10681']);
      expect(details[0]).toEqual({
        id: '10680',
        name: 'Dale St & Grand Ave',
        direction: 'northbound',
      });
    });

    it('extracts stop numbers from shorthand text', () => {
      const text = 'STOPS CLOSED: #1234, #1235.';
      const { stopIds } = extractClosedStops(text, '');
      expect(stopIds).toContain('1234');
      expect(stopIds).toContain('1235');
    });
  });

  describe('extractIntersections', () => {
    it('extracts cross streets and corridor bounds', () => {
      const text = '70th St W & Target driveway stop closed';
      const intersections = extractIntersections(text, '');
      expect(intersections[0]).toContain('70th St W & Target');

      const corridor = 'off Upton Ave/Sheridan Ave from 44th St to 39th St';
      const cIntersections = extractIntersections(corridor, '');
      expect(cIntersections.some(i => i.includes('44th St to 39th St'))).toBe(true);
    });

    it('extracts off [Street] at [Street] patterns', () => {
      const text = 'Route 21 detour off Lake St at Chicago Ave due to event';
      const intersections = extractIntersections(text, '');
      expect(intersections).toContain('Lake St & Chicago Ave');
    });
  });

  describe('extractRiderAlternative', () => {
    it('extracts multi-line boarding alternatives', () => {
      const desc = `
Get on/off Route 537 buses at:
York Ave S & 69th St W - Stop #48182 (southbound)
France Ave S & 70th St W - Stop #50604 (southbound)

Northbound buses will travel regular route.
      `;
      const alt = extractRiderAlternative(desc, '');
      expect(alt).toContain('Board at:');
      expect(alt).toContain('York Ave S & 69th St W - Stop #48182');
      expect(alt).toContain('France Ave S & 70th St W - Stop #50604');
    });

    it('extracts inline Board at instruction', () => {
      const header = 'DETOUR DUE TO PARADE. BOARD AT LAKE & 10TH.';
      const alt = extractRiderAlternative('', header);
      expect(alt).toBe('Board at Lake & 10th');
    });
  });

  describe('computeSeverity', () => {
    it('classifies trip cancellations and suspensions as Critical', () => {
      expect(computeSeverity('OTHER_CAUSE', 'NO_SERVICE', 'CANCELLATION', 'Trip canceled')).toBe('Critical');
      expect(computeSeverity('EMERGENCY', 'NO_SERVICE', undefined, 'Service suspended')).toBe('Critical');
    });

    it('classifies detours and stop closures as Moderate', () => {
      expect(computeSeverity('CONSTRUCTION', 'DETOUR', 'DETOUR', 'Route detoured')).toBe('Moderate');
      expect(computeSeverity('CONSTRUCTION', 'NO_SERVICE', 'STOP_CLOSURE', 'Stop #50603 closed')).toBe('Moderate');
    });

    it('classifies general advisories as Minor', () => {
      expect(computeSeverity('OTHER_CAUSE', 'OTHER_EFFECT', 'OTHER', 'System announcement')).toBe('Minor');
    });
  });

  describe('generatePlainTitle', () => {
    it('generates clean trip cancellation title', () => {
      const title = generatePlainTitle(
        ['Route 11'],
        'Southbound',
        'Critical',
        'Southbound Route 11 trip departing Columbia Heights Transit Center C at 6:14 PM canceled today',
        []
      );
      expect(title).toBe('Route 11: Southbound 6:14 PM Trip Canceled (Columbia Heights Transit Center C)');
    });

    it('generates clean detour title with corridor', () => {
      const title = generatePlainTitle(
        ['Route 21'],
        'Northbound',
        'Moderate',
        'Route 21 detour off Lake St at Chicago Ave',
        ['Lake St & Chicago Ave']
      );
      expect(title).toBe('Route 21: Detour via Lake St & Chicago Ave');
    });
  });
});
