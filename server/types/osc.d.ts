/**
 * Type definitions for the osc.js library
 * @see https://github.com/colinbdclark/osc.js
 */

declare module 'osc' {
  import { EventEmitter } from 'events';

  export interface OSCMessage {
    address: string;
    args: unknown[];
  }

  export interface OSCBundle {
    timeTag: { raw: number[]; native: Date };
    packets: (OSCMessage | OSCBundle)[];
  }

  export interface UDPPortOptions {
    localAddress?: string;
    localPort?: number;
    remoteAddress?: string;
    remotePort?: number;
    broadcast?: boolean;
    multicastTTL?: number;
    multicastMembership?: string[];
    socket?: unknown;
    metadata?: boolean;
  }

  export interface WebSocketPortOptions {
    url?: string;
    socket?: unknown;
    metadata?: boolean;
  }

  export class UDPPort extends EventEmitter {
    constructor(options?: UDPPortOptions);
    open(): void;
    close(): void;
    send(packet: OSCMessage | OSCBundle, address?: string, port?: number): void;
    on(event: 'ready', listener: () => void): this;
    on(event: 'message', listener: (message: OSCMessage, timeTag: unknown, info: unknown) => void): this;
    on(event: 'bundle', listener: (bundle: OSCBundle, timeTag: unknown, info: unknown) => void): this;
    on(event: 'osc', listener: (packet: OSCMessage | OSCBundle, info: unknown) => void): this;
    on(event: 'raw', listener: (data: Uint8Array, info: unknown) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    off(event: string, listener: (...args: unknown[]) => void): this;
  }

  export class WebSocketPort extends EventEmitter {
    constructor(options?: WebSocketPortOptions);
    open(): void;
    close(): void;
    send(packet: OSCMessage | OSCBundle): void;
    on(event: 'ready', listener: () => void): this;
    on(event: 'message', listener: (message: OSCMessage) => void): this;
    on(event: 'bundle', listener: (bundle: OSCBundle) => void): this;
    on(event: 'osc', listener: (packet: OSCMessage | OSCBundle) => void): this;
    on(event: 'raw', listener: (data: Uint8Array) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    off(event: string, listener: (...args: unknown[]) => void): this;
  }

  // Low-level functions
  export function readMessage(data: Uint8Array, options?: { metadata?: boolean }): OSCMessage;
  export function readBundle(data: Uint8Array, options?: { metadata?: boolean }): OSCBundle;
  export function readPacket(data: Uint8Array, options?: { metadata?: boolean }): OSCMessage | OSCBundle;
  export function writeMessage(message: OSCMessage, options?: { metadata?: boolean }): Uint8Array;
  export function writeBundle(bundle: OSCBundle, options?: { metadata?: boolean }): Uint8Array;
  export function writePacket(packet: OSCMessage | OSCBundle, options?: { metadata?: boolean }): Uint8Array;
}
