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
    it('handles empty string', () => {
      expect(cleanWhitespace('')).toBe('');
    });

    it('normalizes extra spaces, carriage returns, and newlines', () => {
      const input = 'Route   21  detour\r\n\r\n\r\nDue to event   \r';
      expect(cleanWhitespace(input)).toBe('Route 21 detour\n\nDue to event');
    });
  });

  describe('isShouting', () => {
    it('returns false for empty or short strings (< 4 letters)', () => {
      expect(isShouting('')).toBe(false);
      expect(isShouting('OK')).toBe(false);
      expect(isShouting('ABC')).toBe(false);
    });

    it('identifies uppercase text', () => {
      expect(isShouting('NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE')).toBe(true);
      expect(isShouting('Route 21 detour off Lake St at Chicago Ave')).toBe(false);
    });
  });

  describe('expandAcronyms', () => {
    it('returns empty string for empty input', () => {
      expect(expandAcronyms('')).toBe('');
    });

    it('expands cardinal directions (uppercase and lowercase)', () => {
      expect(expandAcronyms('NB bus and SB train')).toBe('Northbound bus and Southbound train');
      expect(expandAcronyms('nb bus and sb train')).toBe('northbound bus and southbound train');
      expect(expandAcronyms('EB line and WB corridor')).toBe('Eastbound line and Westbound corridor');
      expect(expandAcronyms('eb line and wb corridor')).toBe('eastbound line and westbound corridor');
      expect(expandAcronyms('OB and IB trips')).toBe('Outbound and Inbound trips');
      expect(expandAcronyms('ob and ib trips')).toBe('outbound and inbound trips');
    });

    it('expands transit abbreviations and operational phrases', () => {
      expect(expandAcronyms('RTE 21 STN at MALL TC')).toBe('Route 21 Station at MALL Transit Center');
      expect(expandAcronyms('Rte. 54 and RT. 9 and RT A Line and RTE')).toBe('Route 54 and Route 9 and Route A Line and Route');
      expect(expandAcronyms('BETW 4th and BTW 5th')).toBe('between 4th and between 5th');
      expect(expandAcronyms('TRANSIT CTR and P&R and PNR')).toBe('Transit Center and Park & Ride and Park & Ride');
      expect(expandAcronyms('DTR in place near TWP XING or X-ING')).toBe('detour in place near Township crossing or crossing');
      expect(expandAcronyms('TEMP stop, CONSTR, MAINT, EMERG, SERV, DISRUPT')).toBe(
        'temporary stop, construction, maintenance, emergency, service, disruption'
      );
      expect(expandAcronyms('RESUME REGULAR ROUTE and REGULAR ROUTE')).toBe('resume regular route and regular route');
      expect(expandAcronyms('RESUME REG RTE and REG RTE')).toBe('resume regular route and regular route');
    });
  });

  describe('unshout', () => {
    it('handles empty string and non-shouting text', () => {
      expect(unshout('')).toBe('');
      expect(unshout('Already regular Case')).toBe('Already regular Case');
    });

    it('handles punctuation segments and sentence transitions', () => {
      const input = 'HELLO WORLD... HOW ARE YOU?';
      const output = unshout(input);
      expect(output).toContain('Hello world');
      expect(output).toContain('how are you');
    });

    it('preserves preserved acronyms, alphanumeric route letters, and Roman numerals', () => {
      const input = 'METRO BRT LRT COVID TC PR ADA DOT MNDOT ID US MN 11A 21B IV VI';
      const output = unshout(input);
      expect(output).toContain('METRO');
      expect(output).toContain('BRT');
      expect(output).toContain('LRT');
      expect(output).toContain('11A');
      expect(output).toContain('21B');
      expect(output).toContain('IV');
      expect(output).toContain('VI');
    });

    it('preserves directional letters, days, months, and street suffixes', () => {
      const input = '44TH ST W ON MON SEP 14 AT NICOLLET MALL S BLVD';
      const output = unshout(input);
      expect(output).toContain('St');
      expect(output).toContain('W');
      expect(output).toContain('Mon');
      expect(output).toContain('Sep');
      expect(output).toContain('S');
      expect(output).toContain('Blvd');
    });

    it('capitalizes proper transit words and preceding words before streets/and', () => {
      const input = 'ROUTE 21 AT STATION LAKE ST & CHICAGO AVE';
      const output = unshout(input);
      expect(output).toContain('Route');
      expect(output).toContain('Station');
      expect(output).toContain('Lake');
      expect(output).toContain('St');
      expect(output).toContain('Chicago');
      expect(output).toContain('Ave');
    });

    it('handles preposition context with lowercase vs capitalized words', () => {
      const input = 'DETOUR VIA LAKE ST AND ON THE BRIDGE';
      const output = unshout(input);
      expect(output).toContain('Lake');
      expect(output).toContain('the');
    });
  });

  describe('cleanDispatcherText', () => {
    it('handles empty string', () => {
      expect(cleanDispatcherText('')).toBe('');
    });

    it('cleans end-to-end dispatcher shouting and normalizes route casing', () => {
      const raw = 'NB RTE 21 DETOUR OFF LAKE ST AT CHICAGO AVE DUE TO CONSTR. BOARD AT LAKE & 10TH.';
      const cleaned = cleanDispatcherText(raw);
      expect(cleaned).toContain('Northbound Route 21');
      expect(cleaned).toContain('Lake St');
      expect(cleaned).toContain('Chicago Ave');
      expect(cleaned).toContain('construction');
    });

    it('normalizes metro line and route casing in cleanDispatcherText', () => {
      const raw = 'METRO ORANGE LINE ROUTE 54C DETOUR';
      const cleaned = cleanDispatcherText(raw);
      expect(cleaned).toContain('METRO orange Line');
      expect(cleaned).toContain('Route 54C');
    });
  });

  describe('toTitleCase', () => {
    it('handles empty string', () => {
      expect(toTitleCase('')).toBe('');
    });

    it('handles hyphenated words and preserved acronyms', () => {
      expect(toTitleCase('park-and-ride facility')).toBe('Park-And-Ride Facility');
      expect(toTitleCase('metro brt service')).toBe('METRO BRT Service');
    });

    it('handles alphanumeric route codes and single letters', () => {
      expect(toTitleCase('route 21a and e line')).toBe('Route 21A and E Line');
    });

    it('keeps minor words lowercase in middle and capitalizes on boundaries', () => {
      expect(toTitleCase('route 21 detour of the lake st at chicago ave')).toBe(
        'Route 21 Detour of the Lake St at Chicago Ave'
      );
      expect(toTitleCase('the detour on')).toBe('The Detour On');
    });
  });
});
