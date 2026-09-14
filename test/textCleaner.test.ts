import { describe, it, expect } from 'vitest';
import {
  cleanDispatcherText,
  unshout,
  expandAcronyms,
  cleanWhitespace,
  toTitleCase,
  isShouting,
} from '../src/enricher/textCleaner.js';

describe('textCleaner', () => {
  describe('cleanWhitespace', () => {
    it('normalizes extra spaces and newlines', () => {
      const input = 'Route   21  detour\r\n\r\n\r\nDue to event   ';
      expect(cleanWhitespace(input)).toBe('Route 21 detour\n\nDue to event');
    });
  });

  describe('isShouting', () => {
    it('identifies uppercase text', () => {
      expect(isShouting('NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE')).toBe(true);
      expect(isShouting('Route 21 detour off Lake St at Chicago Ave')).toBe(false);
    });

    it('returns false for short strings', () => {
      expect(isShouting('OK')).toBe(false);
    });
  });

  describe('expandAcronyms', () => {
    it('expands cardinal directions', () => {
      expect(expandAcronyms('NB bus and SB train')).toBe('Northbound bus and Southbound train');
      expect(expandAcronyms('EB line and WB corridor')).toBe('Eastbound line and Westbound corridor');
      expect(expandAcronyms('OB and IB trips')).toBe('Outbound and Inbound trips');
    });

    it('expands transit abbreviations', () => {
      expect(expandAcronyms('RTE 21 STN at MALL TC')).toBe('Route 21 Station at MALL Transit Center');
      expect(expandAcronyms('CONSTR near TWP X-ING')).toBe('construction near Township crossing');
      expect(expandAcronyms('TEMP stop at PNR')).toBe('temporary stop at Park & Ride');
      expect(expandAcronyms('RESUME REG RTE')).toBe('resume regular route');
    });
  });

  describe('unshout', () => {
    it('converts all-caps text to sentence case while keeping proper nouns and streets', () => {
      const input = 'NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO POLICE ACTIVITY.';
      const output = unshout(input);
      expect(output).toContain('Lake St');
      expect(output).toContain('Chicago Ave');
      expect(output).toContain('police activity');
    });

    it('preserves preserved acronyms like METRO, BRT, PM, AM', () => {
      const input = 'METRO BLUE LINE CLOSURE AT 8 PM TONIGHT.';
      const output = unshout(input);
      expect(output).toContain('METRO');
      expect(output).toContain('PM');
    });
  });

  describe('cleanDispatcherText', () => {
    it('cleans end-to-end dispatcher shouting', () => {
      const raw = 'NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO CONSTR. BOARD AT LAKE & 10TH.';
      const cleaned = cleanDispatcherText(raw);
      expect(cleaned).toContain('Northbound Route 21');
      expect(cleaned).toContain('Lake St');
      expect(cleaned).toContain('Chicago Ave');
      expect(cleaned).toContain('construction');
    });
  });

  describe('toTitleCase', () => {
    it('capitalizes titles correctly with lowercased minor words', () => {
      expect(toTitleCase('route 21 detour off lake st at chicago ave')).toBe(
        'Route 21 Detour off Lake St at Chicago Ave'
      );
    });
  });
});
