/**
 * X32 Scene Loader
 * Loads .scn backup files by sending OSC commands to restore mixer state
 *
 * This module parses USB-compatible .scn scene files and sends each parameter
 * as an OSC command to the X32, effectively restoring a saved state.
 */

import dgram from 'dgram';

/**
 * Progress callback type
 */
export type LoadProgressCallback = (current: number, total: number, section: string) => void;

/**
 * Scene load options
 */
export interface LoadOptions {
  /** X32 IP address */
  ip: string;
  /** X32 OSC port (default: 10023) */
  port?: number;
  /** Progress callback */
  onProgress?: LoadProgressCallback;
  /** Delay between commands in ms (default: 5) */
  commandDelay?: number;
}

/**
 * Scene load result
 */
export interface LoadResult {
  /** Total parameters sent */
  parameterCount: number;
  /** Time taken in ms */
  duration: number;
  /** Number of errors */
  errors: number;
}

/**
 * Parsed parameter from .scn file
 */
interface ParsedParameter {
  address: string;
  args: string;
}

/**
 * Parse a value string into OSC argument type and value
 */
function parseValue(val: string): { type: 'i' | 'f' | 's'; value: number | string } {
  // Handle special values
  if (val === '-oo' || val === '-inf') {
    return { type: 'f', value: -Infinity };
  }
  if (val === '+oo' || val === '+inf') {
    return { type: 'f', value: Infinity };
  }
  if (val === 'ON') {
    return { type: 'i', value: 1 };
  }
  if (val === 'OFF') {
    return { type: 'i', value: 0 };
  }

  // Handle hex/binary values (e.g., %00000000)
  if (val.startsWith('%')) {
    const binary = val.slice(1);
    const intVal = parseInt(binary, 2);
    return { type: 'i', value: isNaN(intVal) ? 0 : intVal };
  }

  // Handle quoted strings
  if (val.startsWith('"') && val.endsWith('"')) {
    return { type: 's', value: val.slice(1, -1) };
  }

  // Handle numbers with k suffix (e.g., 1k39 = 1390)
  const kMatch = val.match(/^(\d+)k(\d+)$/);
  if (kMatch) {
    const num = parseFloat(`${kMatch[1]}.${kMatch[2]}`) * 1000;
    return { type: 'f', value: num };
  }

  // Handle floats with sign (e.g., +0.0, -36.5)
  if (/^[+-]?\d+\.?\d*$/.test(val)) {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      // If it has a decimal point or is clearly a float value
      if (val.includes('.')) {
        return { type: 'f', value: num };
      }
      return { type: 'i', value: Math.floor(num) };
    }
  }

  // Default to string for anything else (like color names: WHi, BL, etc.)
  return { type: 's', value: val };
}

/**
 * Create an OSC message buffer from address and arguments
 */
function createOSCMessage(address: string, args: Array<{ type: 'i' | 'f' | 's'; value: number | string }>): Buffer {
  // OSC address (null-terminated, padded to 4-byte boundary)
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');

  // Type tag string (comma followed by type characters)
  const typeTag = ',' + args.map(a => a.type).join('');
  const typeTagPadded = Buffer.alloc(Math.ceil((typeTag.length + 1) / 4) * 4);
  typeTagPadded.write(typeTag, 0, 'ascii');

  // Arguments
  const argBuffers: Buffer[] = [];
  for (const arg of args) {
    if (arg.type === 'i') {
      const buf = Buffer.alloc(4);
      buf.writeInt32BE(arg.value as number, 0);
      argBuffers.push(buf);
    } else if (arg.type === 'f') {
      const buf = Buffer.alloc(4);
      const val = arg.value as number;
      if (val === -Infinity) {
        // X32 uses 0xFF800000 for -infinity
        buf.writeUInt32BE(0xFF800000, 0);
      } else if (val === Infinity) {
        buf.writeUInt32BE(0x7F800000, 0);
      } else {
        buf.writeFloatBE(val, 0);
      }
      argBuffers.push(buf);
    } else if (arg.type === 's') {
      const str = arg.value as string;
      const strPadded = Buffer.alloc(Math.ceil((str.length + 1) / 4) * 4);
      strPadded.write(str, 0, 'ascii');
      argBuffers.push(strPadded);
    }
  }

  return Buffer.concat([addressPadded, typeTagPadded, ...argBuffers]);
}

/**
 * Parse a line from .scn file into address and arguments
 */
function parseLine(line: string): ParsedParameter | null {
  // Skip empty lines, comments, and headers
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith('/')) {
    return null;
  }

  // Split address from arguments
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    // Address with no arguments
    return { address: trimmed, args: '' };
  }

  const address = trimmed.substring(0, spaceIdx);
  const args = trimmed.substring(spaceIdx + 1);

  return { address, args };
}

/**
 * Parse arguments string into individual values
 * Handles quoted strings, special values, and numeric arrays
 */
function parseArgs(argsStr: string): Array<{ type: 'i' | 'f' | 's'; value: number | string }> {
  const args: Array<{ type: 'i' | 'f' | 's'; value: number | string }> = [];

  if (!argsStr.trim()) {
    return args;
  }

  // Parse token by token, respecting quotes
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (char === '"') {
      if (inQuotes) {
        // End of quoted string
        args.push({ type: 's', value: current });
        current = '';
        inQuotes = false;
      } else {
        // Start of quoted string
        inQuotes = true;
      }
    } else if (char === ' ' && !inQuotes) {
      // End of token
      if (current) {
        args.push(parseValue(current));
        current = '';
      }
    } else {
      current += char;
    }
  }

  // Handle final token
  if (current) {
    if (inQuotes) {
      args.push({ type: 's', value: current });
    } else {
      args.push(parseValue(current));
    }
  }

  return args;
}

/**
 * X32 Scene Loader class
 * Sends OSC commands to restore a saved scene state
 */
export class X32SceneLoader {
  private socket: dgram.Socket | null = null;
  private ip: string;
  private port: number;
  private commandDelay: number;

  constructor(ip: string, port: number = 10023, commandDelay: number = 5) {
    this.ip = ip;
    this.port = port;
    this.commandDelay = commandDelay;
  }

  /**
   * Initialize the UDP socket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', reject);

      // Bind to any available port
      this.socket.bind(0, '0.0.0.0', () => resolve());
    });
  }

  /**
   * Close the UDP socket
   */
  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Send a single OSC command
   */
  private async sendCommand(
    address: string,
    args: Array<{ type: 'i' | 'f' | 's'; value: number | string }>
  ): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const message = createOSCMessage(address, args);

    return new Promise((resolve, reject) => {
      this.socket!.send(message, 0, message.length, this.port, this.ip, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load a scene from .scn file content
   */
  async loadScene(content: string, onProgress?: LoadProgressCallback): Promise<LoadResult> {
    const startTime = Date.now();
    const lines = content.split('\n');

    // Parse all valid lines
    const parameters: Array<{ address: string; args: Array<{ type: 'i' | 'f' | 's'; value: number | string }> }> = [];

    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed) {
        const args = parseArgs(parsed.args);
        parameters.push({ address: parsed.address, args });
      }
    }

    const total = parameters.length;
    let sent = 0;
    let errors = 0;

    // Connect if not already connected
    if (!this.socket) {
      await this.connect();
    }

    // Send each parameter
    for (const param of parameters) {
      try {
        await this.sendCommand(param.address, param.args);
        sent++;
      } catch (error) {
        errors++;
        console.warn(`[SceneLoader] Error sending ${param.address}:`, error);
      }

      // Report progress
      if (onProgress && (sent % 100 === 0 || sent === total)) {
        const section =
          param.address.startsWith('/ch/') ? 'Channels' :
          param.address.startsWith('/bus/') ? 'Buses' :
          param.address.startsWith('/mtx/') ? 'Matrix' :
          param.address.startsWith('/dca/') ? 'DCAs' :
          param.address.startsWith('/fx') ? 'Effects' :
          param.address.startsWith('/main/') ? 'Main' :
          param.address.startsWith('/config/') ? 'Config' :
          param.address.startsWith('/headamp/') ? 'Headamps' :
          param.address.startsWith('/outputs/') ? 'Outputs' :
          'Other';
        onProgress(sent, total, section);
      }

      // Small delay to avoid overwhelming the X32
      await new Promise(resolve => setTimeout(resolve, this.commandDelay));
    }

    const duration = Date.now() - startTime;

    return {
      parameterCount: sent,
      duration,
      errors,
    };
  }
}

/**
 * Load a scene from .scn content to the X32
 * Convenience function that handles connection lifecycle
 */
export async function loadSceneFromScn(
  content: string,
  options: LoadOptions
): Promise<LoadResult> {
  const loader = new X32SceneLoader(
    options.ip,
    options.port || 10023,
    options.commandDelay || 5
  );

  try {
    await loader.connect();
    return await loader.loadScene(content, options.onProgress);
  } finally {
    loader.close();
  }
}
