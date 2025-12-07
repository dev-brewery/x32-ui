import { describe, it, expect } from 'vitest';
import {
  createOSCMessage,
  formatOSCMessage,
  getStringArg,
  getIntArg,
  getFloatArg,
  parseSceneIndex,
  formatSceneIndex,
  parseTypeTag,
} from './osc-utils.js';
import type { OSCArgument } from './types.js';

describe('osc-utils', () => {
  describe('parseTypeTag', () => {
    it('parses valid type tag with comma prefix', () => {
      const result = parseTypeTag(',sif');
      expect(result).toEqual(['s', 'i', 'f']);
    });

    it('returns empty array for type tag without comma', () => {
      const result = parseTypeTag('sif');
      expect(result).toEqual([]);
    });

    it('handles single type', () => {
      const result = parseTypeTag(',s');
      expect(result).toEqual(['s']);
    });

    it('handles empty type tag', () => {
      const result = parseTypeTag(',');
      expect(result).toEqual([]);
    });
  });

  describe('createOSCMessage', () => {
    it('creates message with string argument', () => {
      const message = createOSCMessage('/test', 'hello');

      expect(message.address).toBe('/test');
      expect(message.args).toHaveLength(1);
      expect(message.args[0]).toEqual({ type: 's', value: 'hello' });
    });

    it('creates message with integer argument', () => {
      const message = createOSCMessage('/test', 42);

      expect(message.args[0]).toEqual({ type: 'i', value: 42 });
    });

    it('creates message with float argument', () => {
      const message = createOSCMessage('/test', 3.14);

      expect(message.args[0]).toEqual({ type: 'f', value: 3.14 });
    });

    it('creates message with boolean true argument', () => {
      const message = createOSCMessage('/test', true);

      expect(message.args[0]).toEqual({ type: 'i', value: 1 });
    });

    it('creates message with boolean false argument', () => {
      const message = createOSCMessage('/test', false);

      expect(message.args[0]).toEqual({ type: 'i', value: 0 });
    });

    it('creates message with multiple arguments', () => {
      const message = createOSCMessage('/test', 'hello', 42, 3.14, true);

      expect(message.args).toHaveLength(4);
      expect(message.args[0]).toEqual({ type: 's', value: 'hello' });
      expect(message.args[1]).toEqual({ type: 'i', value: 42 });
      expect(message.args[2]).toEqual({ type: 'f', value: 3.14 });
      expect(message.args[3]).toEqual({ type: 'i', value: 1 });
    });

    it('creates message with no arguments', () => {
      const message = createOSCMessage('/test');

      expect(message.address).toBe('/test');
      expect(message.args).toHaveLength(0);
    });

    it('distinguishes between integers and floats', () => {
      const message = createOSCMessage('/test', 5, 5.0, 5.5);

      expect(message.args[0].type).toBe('i');
      expect(message.args[1].type).toBe('i'); // 5.0 is still an integer
      expect(message.args[2].type).toBe('f');
    });

    it('handles zero values', () => {
      const message = createOSCMessage('/test', 0, 0.0);

      expect(message.args[0]).toEqual({ type: 'i', value: 0 });
      expect(message.args[1]).toEqual({ type: 'i', value: 0 });
    });

    it('handles negative numbers', () => {
      const message = createOSCMessage('/test', -42, -3.14);

      expect(message.args[0]).toEqual({ type: 'i', value: -42 });
      expect(message.args[1]).toEqual({ type: 'f', value: -3.14 });
    });

    it('handles empty string', () => {
      const message = createOSCMessage('/test', '');

      expect(message.args[0]).toEqual({ type: 's', value: '' });
    });
  });

  describe('formatOSCMessage', () => {
    it('formats message with string argument', () => {
      const message = createOSCMessage('/test', 'hello');
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test "hello"');
    });

    it('formats message with integer argument', () => {
      const message = createOSCMessage('/test', 42);
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test 42');
    });

    it('formats message with float argument', () => {
      const message = createOSCMessage('/test', 3.14159);
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test 3.142');
    });

    it('formats message with multiple arguments', () => {
      const message = createOSCMessage('/test', 'hello', 42, 3.14);
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test "hello" 42 3.140');
    });

    it('formats message with no arguments', () => {
      const message = createOSCMessage('/test');
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test ');
    });

    it('formats message with blob argument', () => {
      const message = {
        address: '/test',
        args: [{ type: 'b' as const, value: new Uint8Array([1, 2, 3, 4, 5]) }],
      };
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test <blob:5bytes>');
    });

    it('handles unknown argument type', () => {
      const message = {
        address: '/test',
        args: [{ type: 'x' as any, value: 'unknown' }],
      };
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test ?');
    });

    it('quotes strings with spaces', () => {
      const message = createOSCMessage('/test', 'hello world');
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/test "hello world"');
    });
  });

  describe('getStringArg', () => {
    it('extracts string value from args', () => {
      const args: OSCArgument[] = [
        { type: 's', value: 'test' },
        { type: 'i', value: 42 },
      ];

      expect(getStringArg(args, 0)).toBe('test');
    });

    it('returns undefined for non-string type', () => {
      const args: OSCArgument[] = [{ type: 'i', value: 42 }];

      expect(getStringArg(args, 0)).toBeUndefined();
    });

    it('returns undefined for out of bounds index', () => {
      const args: OSCArgument[] = [{ type: 's', value: 'test' }];

      expect(getStringArg(args, 5)).toBeUndefined();
    });

    it('extracts empty string', () => {
      const args: OSCArgument[] = [{ type: 's', value: '' }];

      expect(getStringArg(args, 0)).toBe('');
    });

    it('extracts string from specific index', () => {
      const args: OSCArgument[] = [
        { type: 'i', value: 1 },
        { type: 's', value: 'second' },
        { type: 's', value: 'third' },
      ];

      expect(getStringArg(args, 1)).toBe('second');
      expect(getStringArg(args, 2)).toBe('third');
    });
  });

  describe('getIntArg', () => {
    it('extracts integer value from args', () => {
      const args: OSCArgument[] = [
        { type: 'i', value: 42 },
        { type: 's', value: 'test' },
      ];

      expect(getIntArg(args, 0)).toBe(42);
    });

    it('returns undefined for non-integer type', () => {
      const args: OSCArgument[] = [{ type: 's', value: 'test' }];

      expect(getIntArg(args, 0)).toBeUndefined();
    });

    it('returns undefined for float type', () => {
      const args: OSCArgument[] = [{ type: 'f', value: 3.14 }];

      expect(getIntArg(args, 0)).toBeUndefined();
    });

    it('returns undefined for out of bounds index', () => {
      const args: OSCArgument[] = [{ type: 'i', value: 42 }];

      expect(getIntArg(args, 5)).toBeUndefined();
    });

    it('extracts zero value', () => {
      const args: OSCArgument[] = [{ type: 'i', value: 0 }];

      expect(getIntArg(args, 0)).toBe(0);
    });

    it('extracts negative integer', () => {
      const args: OSCArgument[] = [{ type: 'i', value: -42 }];

      expect(getIntArg(args, 0)).toBe(-42);
    });
  });

  describe('getFloatArg', () => {
    it('extracts float value from args', () => {
      const args: OSCArgument[] = [
        { type: 'f', value: 3.14 },
        { type: 'i', value: 42 },
      ];

      expect(getFloatArg(args, 0)).toBe(3.14);
    });

    it('returns undefined for non-float type', () => {
      const args: OSCArgument[] = [{ type: 'i', value: 42 }];

      expect(getFloatArg(args, 0)).toBeUndefined();
    });

    it('returns undefined for string type', () => {
      const args: OSCArgument[] = [{ type: 's', value: 'test' }];

      expect(getFloatArg(args, 0)).toBeUndefined();
    });

    it('returns undefined for out of bounds index', () => {
      const args: OSCArgument[] = [{ type: 'f', value: 3.14 }];

      expect(getFloatArg(args, 5)).toBeUndefined();
    });

    it('extracts zero value', () => {
      const args: OSCArgument[] = [{ type: 'f', value: 0.0 }];

      expect(getFloatArg(args, 0)).toBe(0.0);
    });

    it('extracts negative float', () => {
      const args: OSCArgument[] = [{ type: 'f', value: -3.14 }];

      expect(getFloatArg(args, 0)).toBe(-3.14);
    });
  });

  describe('parseSceneIndex', () => {
    it('parses zero-padded index string', () => {
      expect(parseSceneIndex('001')).toBe(1);
      expect(parseSceneIndex('042')).toBe(42);
      expect(parseSceneIndex('099')).toBe(99);
    });

    it('parses index without leading zeros', () => {
      expect(parseSceneIndex('1')).toBe(1);
      expect(parseSceneIndex('42')).toBe(42);
    });

    it('parses zero index', () => {
      expect(parseSceneIndex('000')).toBe(0);
      expect(parseSceneIndex('0')).toBe(0);
    });

    it('handles three-digit numbers', () => {
      expect(parseSceneIndex('100')).toBe(100);
    });
  });

  describe('formatSceneIndex', () => {
    it('formats single digit with leading zeros', () => {
      expect(formatSceneIndex(0)).toBe('000');
      expect(formatSceneIndex(1)).toBe('001');
      expect(formatSceneIndex(9)).toBe('009');
    });

    it('formats double digit with one leading zero', () => {
      expect(formatSceneIndex(10)).toBe('010');
      expect(formatSceneIndex(42)).toBe('042');
      expect(formatSceneIndex(99)).toBe('099');
    });

    it('formats triple digit without leading zeros', () => {
      expect(formatSceneIndex(100)).toBe('100');
      expect(formatSceneIndex(999)).toBe('999');
    });

    it('roundtrip conversion works', () => {
      const original = 42;
      const formatted = formatSceneIndex(original);
      const parsed = parseSceneIndex(formatted);

      expect(parsed).toBe(original);
    });

    it('formats large numbers without truncation', () => {
      expect(formatSceneIndex(1234)).toBe('1234');
    });
  });

  describe('Integration Tests', () => {
    it('creates and formats complete OSC message', () => {
      const message = createOSCMessage('/xinfo', '192.168.0.64', 'X32-MOCK', 'X32', '4.06');
      const formatted = formatOSCMessage(message);

      expect(formatted).toBe('/xinfo "192.168.0.64" "X32-MOCK" "X32" "4.06"');
    });

    it('creates scene load message and extracts index', () => {
      const sceneIndex = 5;
      const message = createOSCMessage('/-show/prepos/current', sceneIndex);

      expect(message.address).toBe('/-show/prepos/current');

      const extractedIndex = getIntArg(message.args, 0);
      expect(extractedIndex).toBe(sceneIndex);
    });

    it('handles mixed argument types', () => {
      const message = createOSCMessage('/mixer', 'ch', 1, 0.75, true);

      expect(getStringArg(message.args, 0)).toBe('ch');
      expect(getIntArg(message.args, 1)).toBe(1);
      expect(getFloatArg(message.args, 2)).toBe(0.75);
      expect(getIntArg(message.args, 3)).toBe(1); // boolean converted to int
    });
  });
});
