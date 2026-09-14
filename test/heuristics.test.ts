import { describe, it, expect } from 'vitest';
import {
  extractRoutes,
  extractDirection,
  extractClosedStops,
  extractIntersections,
  extractRiderAlternative,
  extractDetourDetails,
  computeSeverity,
  formatActivePeriod,
  generatePlainTitle,
  generatePlainSummary,
} from '../src/enricher/heuristics.js';

describe('heuristics', () => {
  describe('extractRoutes', () => {
    it('extracts routes from informed entities and text', () => {
      const header = 'Routes 537 and 538 detoured';
      const desc = 'E Line and Route 21 also affected';
      const entities = [
        { routeId: '36', routeLabel: 'Route 36' },
        { routeId: '99' }, // routeId without routeLabel
      ];
      const routes = extractRoutes(header, desc, entities);

      expect(routes).toContain('Route 537');
      expect(routes).toContain('Route 538');
      expect(routes).toContain('METRO E Line');
      expect(routes).toContain('Route 21');
      expect(routes).toContain('Route 36');
      expect(routes).toContain('Route 99');
    });

    it('handles METRO colored lines and single-letter BRT lines', () => {
      const routes = extractRoutes('Blue Line, Gold Line, and METRO A Line maintenance', '');
      expect(routes).toContain('METRO Blue Line');
      expect(routes).toContain('METRO Gold Line');
      expect(routes).toContain('METRO A Line');
    });

    it('handles routes shorthand without route keyword and returns Systemwide if empty', () => {
      expect(extractRoutes('', '')).toEqual(['Systemwide']);
      const routes = extractRoutes('RTE 21 and Rte. 54A and Rt 9', '');
      expect(routes).toContain('Route 21');
      expect(routes).toContain('Route 54A');
      expect(routes).toContain('Route 9');
    });
  });

  describe('extractDirection', () => {
    it('detects directions from informed entities directionId 0 and 1', () => {
      expect(extractDirection('', '', [{ directionId: 0 }, { directionId: 1 }])).toBe('Both Directions');
    });

    it('detects single directions from text', () => {
      expect(extractDirection('Northbound Route 11', '')).toBe('Northbound');
      expect(extractDirection('SB Route 6', '')).toBe('Southbound');
      expect(extractDirection('Eastbound E Line', '')).toBe('Eastbound');
      expect(extractDirection('WB Route 21', '')).toBe('Westbound');
      expect(extractDirection('Inbound train', '')).toBe('Inbound');
      expect(extractDirection('taking IB trip', '')).toBe('Inbound');
      expect(extractDirection('Outbound bus', '')).toBe('Outbound');
      expect(extractDirection('taking OB trip', '')).toBe('Outbound');
    });

    it('detects both directions from text patterns', () => {
      expect(extractDirection('Detour in both directions', '')).toBe('Both Directions');
      expect(extractDirection('buses detoured both ways', '')).toBe('Both Directions');
      expect(extractDirection('Northbound and southbound buses detoured', '')).toBe('Both Directions');
      expect(extractDirection('Eastbound and westbound affected', '')).toBe('Both Directions');
    });

    it('defaults to All when direction is not specified', () => {
      expect(extractDirection('System advisory', 'No direction mentioned')).toBe('All');
    });
  });

  describe('extractClosedStops', () => {
    it('extracts closed stops from formatted list and handles lines without name or with direction', () => {
      const desc = "Affected stops:\nDale St & Grand Ave - Stop #10680 (northbound)\n   \nStop #50603\nOther text.";
      const { stopIds, details } = extractClosedStops('', desc);
      expect(stopIds).toContain('10680');
      expect(stopIds).toContain('50603');
      expect(details[0]).toEqual({
        id: '10680',
        name: 'Dale St & Grand Ave',
        direction: 'northbound',
      });
      expect(details[1]).toEqual({
        id: '50603',
        name: undefined,
        direction: undefined,
      });
    });

    it('extracts stop numbers from shorthand text, generic stops, and entities', () => {
      const text = 'STOPS CLOSED: #1234, #1235. Also Stop 9999.';
      const entities = [{ stopId: '8888' }, { stopId: '1234' }]; // 1234 already present
      const { stopIds } = extractClosedStops(text, '', entities);
      expect(stopIds).toContain('1234');
      expect(stopIds).toContain('1235');
      expect(stopIds).toContain('9999');
      expect(stopIds).toContain('8888');
    });
  });

  describe('extractIntersections', () => {
    it('extracts cross streets, stations, and corridor bounds', () => {
      const text = 'temporary stop on 70th St W & Target driveway stop closed';
      const intersections = extractIntersections(text, '');
      expect(intersections[0]).toContain('70th St W & Target');

      const corridor = 'off Upton Ave/Sheridan Ave from 44th St to 39th St beginning Mon Sep 14';
      const cIntersections = extractIntersections(corridor, '');
      expect(cIntersections.some(i => i.includes('44th St to 39th St'))).toBe(true);
    });

    it('extracts off [Street] at [Street] patterns and strips prefixes', () => {
      const text1 = 'Route 21 detour off Lake St at Chicago Ave due to event.';
      expect(extractIntersections(text1, '')).toContain('Lake St & Chicago Ave');

      const text2 = 'Layover on 4th St & 5th Ave.';
      expect(extractIntersections(text2, '')).toContain('4th St & 5th Ave');
    });
  });

  describe('extractRiderAlternative', () => {
    it('extracts multi-line boarding alternatives and ignores informational filter lines', () => {
      const desc = `
Get on/off Route 537 buses at:
for service see below
will travel regular route
is closed today
are closed for event
beginning monday
until further notice
   
York Ave S & 69th St W - Stop #48182 (southbound)
France Ave S & 70th St W - Stop #50604 (southbound)

Affected stops:
Stop #1234
      `;
      const alt = extractRiderAlternative(desc, '');
      expect(alt).toContain('Board at:');
      expect(alt).toContain('York Ave S & 69th St W - Stop #48182');
      expect(alt).toContain('France Ave S & 70th St W - Stop #50604');
    });

    it('extracts inline Board at instruction (shouting and non-shouting)', () => {
      const header1 = 'DETOUR DUE TO PARADE. BOARD AT LAKE & 10TH.';
      expect(extractRiderAlternative('', header1)).toBe('Board at Lake & 10th');

      const header2 = 'Detour. Catch bus at 4th St.';
      expect(extractRiderAlternative('', header2)).toBe('Board at 4th St');

      const header3 = 'Use temporary stop at Nicollet Mall.';
      expect(extractRiderAlternative('', header3)).toBe('Board at Nicollet Mall');
    });

    it('extracts temporary stop mention or returns null if absent', () => {
      expect(extractRiderAlternative('', 'Temporary stop on 42nd St W.')).toBe('Temporary stop at 42nd St W');
      expect(extractRiderAlternative('No alt here', 'Just standard detour')).toBeNull();
    });
  });

  describe('extractDetourDetails', () => {
    it('extracts detour details or returns null', () => {
      const desc = 'Northbound buses will travel via 28th St to Chicago Ave.';
      expect(extractDetourDetails(desc)).toBe('Northbound buses will travel via 28th St to Chicago Ave.');
      expect(extractDetourDetails('No details provided')).toBeNull();
    });
  });

  describe('computeSeverity', () => {
    it('classifies trip cancellations, suspensions, and no trains as Critical', () => {
      expect(computeSeverity('OTHER_CAUSE', 'NO_SERVICE', 'CANCELLATION', 'Trip canceled')).toBe('Critical');
      expect(computeSeverity('EMERGENCY', 'NO_SERVICE', undefined, 'Service suspended')).toBe('Critical');
      expect(computeSeverity(undefined, undefined, undefined, 'Trip cancelled today')).toBe('Critical');
      expect(computeSeverity(undefined, undefined, undefined, 'No trains running on Blue Line')).toBe('Critical');
      expect(computeSeverity(undefined, 'NO_SERVICE', undefined, 'General')).toBe('Critical');
    });

    it('classifies detours, stop closures, and reroutes as Moderate', () => {
      expect(computeSeverity('CONSTRUCTION', 'DETOUR', 'DETOUR', 'Route detoured')).toBe('Moderate');
      expect(computeSeverity('CONSTRUCTION', 'NO_SERVICE', 'STOP_CLOSURE', 'Stop #50603 closed')).toBe('Moderate');
      expect(computeSeverity(undefined, undefined, undefined, 'Road closure reroute')).toBe('Moderate');
    });

    it('classifies general advisories as Minor', () => {
      expect(computeSeverity('OTHER_CAUSE', 'OTHER_EFFECT', 'OTHER', 'System announcement')).toBe('Minor');
    });
  });

  describe('formatActivePeriod', () => {
    it('formats active period timestamps when provided', () => {
      const res1 = formatActivePeriod([{ start: 1700000000, end: 1700003600 }]);
      expect(res1.start).toBeDefined();
      expect(res1.end).toBeDefined();

      const res2 = formatActivePeriod([{ start: 1700000000 }]);
      expect(res2.start).toBeDefined();
      expect(res2.end).toBeUndefined();

      const res3 = formatActivePeriod([{ end: 1700003600 }]);
      expect(res3.start).toBeUndefined();
      expect(res3.end).toBeDefined();
    });

    it('extracts human-readable date and time range from text description', () => {
      const t1 = formatActivePeriod([], 'Detour beginning Mon Sep 14 at 7:00 AM until Sun Sep 20 at 6:00 PM due to work');
      expect(t1.textDescription).toBe('Beginning Mon Sep 14 at 7:00 AM until Sun Sep 20 at 6:00 PM');

      const t2 = formatActivePeriod([], 'Detour beginning Mon Sep 14 at 7:00 AM due to work');
      expect(t2.textDescription).toBe('Beginning Mon Sep 14 at 7:00 AM');

      const t3 = formatActivePeriod([], 'No time mentioned');
      expect(t3.textDescription).toBeUndefined();
    });
  });

  describe('generatePlainTitle', () => {
    it('generates clean trip cancellation title with and without direction', () => {
      const titleWithDir = generatePlainTitle(
        ['Route 11'],
        'Southbound',
        'Critical',
        'trip departing Columbia Heights Transit Center C at 6:14 PM canceled today',
        []
      );
      expect(titleWithDir).toBe('Route 11: Southbound 6:14 PM Trip Canceled (Columbia Heights Transit Center C)');

      const titleNoDir = generatePlainTitle(
        ['Route 11'],
        'All',
        'Critical',
        'trip departing Downtown at 6:14 PM canceled',
        []
      );
      expect(titleNoDir).toBe('Route 11: 6:14 PM Trip Canceled (Downtown)');
    });

    it('generates title for service canceled and service suspended', () => {
      expect(generatePlainTitle(['Route 5'], 'All', 'Critical', 'Route 5 canceled due to weather', [])).toBe(
        'Route 5: Service Canceled'
      );
      expect(generatePlainTitle(['Route 5'], 'All', 'Critical', 'Route 5 suspended today', [])).toBe(
        'Route 5: Service Suspended'
      );
    });

    it('generates title for detour and stop closure with and without intersection', () => {
      expect(generatePlainTitle(['Route 21'], 'Northbound', 'Moderate', 'Route 21 detour', ['Lake St & Chicago Ave'])).toBe(
        'Route 21: Detour via Lake St & Chicago Ave'
      );
      expect(generatePlainTitle(['Route 21'], 'Northbound', 'Moderate', 'Route 21 detour', [])).toBe(
        'Route 21: Detour via Regular Corridor'
      );
      expect(generatePlainTitle(['Route 21'], 'Northbound', 'Moderate', 'Stop closed', ['Lake St & Chicago Ave'])).toBe(
        'Route 21: Stop Closed at Lake St & Chicago Ave'
      );
      expect(generatePlainTitle(['Route 21'], 'Northbound', 'Moderate', 'Stop closed', [])).toBe(
        'Route 21: Stop Closed at Selected Stop'
      );
    });

    it('falls back to short title-cased header or default service advisory', () => {
      expect(generatePlainTitle(['Route 9'], 'All', 'Minor', 'elevator out of service', [])).toBe(
        'Elevator Out of Service'
      );
      // Extremely long header > 90 chars without keywords
      const longHeader = 'Very long advisory notification without any disruptions that exceeds ninety characters in length completely';
      expect(generatePlainTitle(['Route 9'], 'All', 'Minor', longHeader, [])).toBe(
        'Route 9: Service Advisory'
      );
    });
  });

  describe('generatePlainSummary', () => {
    it('extracts due to clause from header or description', () => {
      expect(generatePlainSummary('Detour due to construction.', '', 'Moderate', null)).toBe('Detour due to construction.');
      expect(generatePlainSummary('', 'Detour due to parade on street.', 'Moderate', null)).toBe('Detour due to parade on street.');
    });

    it('falls back to description or default message when header is empty', () => {
      expect(generatePlainSummary('', 'First line of description.\nSecond line.', 'Minor', null)).toBe('First line of description.');
      expect(generatePlainSummary('', '', 'Minor', null)).toBe('Transit advisory in effect.');
    });

    it('appends rider alternative if not already present in summary', () => {
      const summary = generatePlainSummary('Route 21 detour', '', 'Moderate', 'Board at Lake & 10th');
      expect(summary).toBe('Route 21 detour. Board at Lake & 10th.');

      const summaryDuplicate = generatePlainSummary('Route 21 detour. Board at Lake & 10th.', '', 'Moderate', 'Board at Lake & 10th');
      expect(summaryDuplicate).toBe('Route 21 detour. Board at Lake & 10th.');
    });
  });
});
