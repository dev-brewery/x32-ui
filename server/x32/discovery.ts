/**
 * X32 Network Discovery Service
 * Discovers X32 mixers on the local network using OSC /xinfo queries
 */

import dgram from 'dgram';
import { execSync } from 'child_process';
import type { X32Info } from './types.js';

const X32_PORT = 10023;
const DISCOVERY_TIMEOUT = 500; // 500ms per target
const BATCH_SIZE = 20; // Parallel batch size

export interface DiscoveryResult extends X32Info {
  /** The IP address that responded (may differ from reported IP) */
  sourceIp: string;
}

export interface DiscoveryOptions {
  /** Specific subnet to scan (e.g., "192.168.1") */
  subnet?: string;
  /** Single IP to probe */
  ip?: string;
  /** Local port to bind for listening (default: 10024) */
  localPort?: number;
  /** Timeout per target in ms (default: 500) */
  timeout?: number;
  /** Progress callback */
  onProgress?: (current: number, total: number, found: number) => void;
}

/**
 * Create an OSC /xinfo message buffer
 */
function createXInfoMessage(): Buffer {
  // OSC address: /xinfo followed by null padding to 4-byte boundary
  const address = '/xinfo';
  const addressBuffer = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressBuffer.write(address, 0, 'ascii');

  // Type tag: just comma (no arguments) padded to 4 bytes
  const typeTag = ',';
  const typeTagBuffer = Buffer.alloc(4);
  typeTagBuffer.write(typeTag, 0, 'ascii');

  return Buffer.concat([addressBuffer, typeTagBuffer]);
}

/**
 * Parse an OSC message response
 */
function parseOSCMessage(buffer: Buffer): { address: string; args: (string | number)[] } {
  let offset = 0;

  // Read address (null-terminated, 4-byte aligned)
  const addressEnd = buffer.indexOf(0, offset);
  const address = buffer.toString('ascii', offset, addressEnd);
  offset = Math.ceil((addressEnd + 1) / 4) * 4;

  // Read type tag
  if (buffer[offset] !== 0x2c) { // comma
    return { address, args: [] };
  }
  const typeTagEnd = buffer.indexOf(0, offset);
  const typeTag = buffer.toString('ascii', offset + 1, typeTagEnd);
  offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

  // Parse arguments based on type tag
  const args: (string | number)[] = [];
  for (const type of typeTag) {
    if (type === 's') {
      const strEnd = buffer.indexOf(0, offset);
      args.push(buffer.toString('ascii', offset, strEnd));
      offset = Math.ceil((strEnd + 1) / 4) * 4;
    } else if (type === 'i') {
      args.push(buffer.readInt32BE(offset));
      offset += 4;
    } else if (type === 'f') {
      args.push(buffer.readFloatBE(offset));
      offset += 4;
    }
  }

  return { address, args };
}

/**
 * Get candidate IPs from ARP cache (faster than subnet scan)
 */
export function getCandidateIPsFromArp(): string[] {
  try {
    const output = execSync('arp -a', { encoding: 'utf8' });
    const ips: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const ip = match[1];
        // Filter out broadcast, multicast, and local addresses
        if (!ip.endsWith('.255') &&
            !ip.endsWith('.1') &&
            ip !== '127.0.0.1' &&
            !ip.startsWith('224.') &&
            !ip.startsWith('239.')) {
          ips.push(ip);
        }
      }
    }

    return [...new Set(ips)];
  } catch {
    return [];
  }
}

/**
 * Generate all IPs in a /24 subnet
 */
export function generateSubnetIPs(subnet: string): string[] {
  const ips: string[] = [];
  for (let i = 2; i < 255; i++) {
    ips.push(`${subnet}.${i}`);
  }
  return ips;
}

/**
 * Discover X32 mixers on the network
 */
export async function discoverX32(options: DiscoveryOptions = {}): Promise<DiscoveryResult[]> {
  const localPort = options.localPort ?? 10024;
  const timeout = options.timeout ?? DISCOVERY_TIMEOUT;

  // Determine candidate IPs
  let candidateIPs: string[];
  if (options.ip) {
    candidateIPs = [options.ip];
  } else if (options.subnet) {
    candidateIPs = generateSubnetIPs(options.subnet);
  } else {
    candidateIPs = getCandidateIPsFromArp();
  }

  if (candidateIPs.length === 0) {
    return [];
  }

  const socket = dgram.createSocket('udp4');
  socket.setMaxListeners(500);

  const pendingRequests = new Map<string, {
    resolve: (result: DiscoveryResult | null) => void;
    timeout: NodeJS.Timeout;
  }>();
  const found: DiscoveryResult[] = [];

  // Set up global message handler
  socket.on('message', (msg, rinfo) => {
    const pending = pendingRequests.get(rinfo.address);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingRequests.delete(rinfo.address);
      try {
        const parsed = parseOSCMessage(msg);
        if (parsed.address === '/xinfo' && parsed.args.length >= 4) {
          pending.resolve({
            ip: String(parsed.args[0]),
            name: String(parsed.args[1]),
            model: String(parsed.args[2]),
            firmware: String(parsed.args[3]),
            sourceIp: rinfo.address
          });
          return;
        }
      } catch {
        // Parse error
      }
      pending.resolve(null);
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.bind(localPort, '0.0.0.0', () => resolve());
    socket.on('error', reject);
  });

  const message = createXInfoMessage();

  // Probe function
  const probe = (ip: string): Promise<DiscoveryResult | null> => {
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(ip);
        resolve(null);
      }, timeout);

      pendingRequests.set(ip, { resolve, timeout: timeoutHandle });

      socket.send(message, 0, message.length, X32_PORT, ip, (err) => {
        if (err) {
          clearTimeout(timeoutHandle);
          pendingRequests.delete(ip);
          resolve(null);
        }
      });
    });
  };

  // Parallel batched scanning
  const useFastMode = candidateIPs.length > 10;
  let processed = 0;

  if (useFastMode) {
    for (let i = 0; i < candidateIPs.length; i += BATCH_SIZE) {
      const batch = candidateIPs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(ip => probe(ip)));

      for (const result of results) {
        if (result) {
          found.push(result);
        }
      }

      processed += batch.length;
      options.onProgress?.(processed, candidateIPs.length, found.length);
    }
  } else {
    // Sequential for small lists
    for (const ip of candidateIPs) {
      const result = await probe(ip);
      if (result) {
        found.push(result);
      }
      processed++;
      options.onProgress?.(processed, candidateIPs.length, found.length);
    }
  }

  socket.close();
  return found;
}

/**
 * Quick check if a specific X32 is reachable
 */
export async function pingX32(ip: string, port: number = X32_PORT): Promise<X32Info | null> {
  const results = await discoverX32({ ip, timeout: 2000 });
  return results.length > 0 ? results[0] : null;
}
