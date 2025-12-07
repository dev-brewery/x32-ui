/**
 * OSC Message Utilities
 * Helper functions for encoding/decoding OSC messages for X32 communication
 */

import type { OSCMessage, OSCArgument } from './types.js';

/**
 * Parse an OSC type tag string into argument type characters
 */
export function parseTypeTag(typeTag: string): string[] {
  // Type tag starts with comma, e.g., ",sif" for string, int, float
  if (!typeTag.startsWith(',')) {
    return [];
  }
  return typeTag.slice(1).split('');
}

/**
 * Create an OSC message object
 */
export function createOSCMessage(address: string, ...args: (string | number | boolean)[]): OSCMessage {
  const oscArgs: OSCArgument[] = args.map(arg => {
    if (typeof arg === 'string') {
      return { type: 's', value: arg };
    } else if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        return { type: 'i', value: arg };
      } else {
        return { type: 'f', value: arg };
      }
    } else if (typeof arg === 'boolean') {
      return { type: 'i', value: arg ? 1 : 0 };
    }
    throw new Error(`Unsupported argument type: ${typeof arg}`);
  });

  return { address, args: oscArgs };
}

/**
 * Format an OSC message for logging
 */
export function formatOSCMessage(message: OSCMessage): string {
  const args = message.args.map(arg => {
    switch (arg.type) {
      case 's': return `"${arg.value}"`;
      case 'i': return arg.value.toString();
      case 'f': return arg.value.toFixed(3);
      case 'b': return `<blob:${arg.value.length}bytes>`;
      default: return '?';
    }
  });
  return `${message.address} ${args.join(' ')}`;
}

/**
 * Extract a string value from OSC args
 */
export function getStringArg(args: OSCArgument[], index: number): string | undefined {
  const arg = args[index];
  if (arg?.type === 's') {
    return arg.value;
  }
  return undefined;
}

/**
 * Extract an integer value from OSC args
 */
export function getIntArg(args: OSCArgument[], index: number): number | undefined {
  const arg = args[index];
  if (arg?.type === 'i') {
    return arg.value;
  }
  return undefined;
}

/**
 * Extract a float value from OSC args
 */
export function getFloatArg(args: OSCArgument[], index: number): number | undefined {
  const arg = args[index];
  if (arg?.type === 'f') {
    return arg.value;
  }
  return undefined;
}

/**
 * Parse X32 scene index from a string like "001" to number
 */
export function parseSceneIndex(indexStr: string): number {
  return parseInt(indexStr, 10);
}

/**
 * Format scene index to X32 format (3 digits with leading zeros)
 */
export function formatSceneIndex(index: number): string {
  return String(index).padStart(3, '0');
}
