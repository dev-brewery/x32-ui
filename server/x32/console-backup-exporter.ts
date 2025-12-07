/**
 * X32 Console Backup Exporter
 * Creates USB-compatible console.bak files matching X32's Setup > Backup > Export
 *
 * The console.bak file contains:
 * - Current console state (all channels, buses, routing, etc.)
 * - All 100 scene slots
 * - All 100 snippet slots
 * - All library presets
 * - Preferences and status
 *
 * This is the FULL console backup that can be restored via Setup > Global > Restore
 */

import dgram from 'dgram';

/**
 * All node paths for a COMPLETE console backup
 * This includes everything from the scene exporter PLUS scenes, snippets, and libraries
 */
const CONSOLE_BACKUP_PATHS: string[] = [
  // ==========================================
  // PREFERENCES AND STATUS
  // ==========================================
  '-prefs/ip',
  '-prefs/bright', '-prefs/screen', '-prefs/remote', '-prefs/style',
  '-stat/selidx', '-stat/chfaderbank', '-stat/grpfaderbank',
  '-stat/sendsonfader', '-stat/bussendbank', '-stat/eqband',
  '-stat/solo', '-stat/keysolo', '-stat/userbank', '-stat/autosave',

  // ==========================================
  // CONFIG SECTION
  // ==========================================
  'config/chlink', 'config/auxlink', 'config/fxlink', 'config/buslink', 'config/mtxlink',
  'config/mute', 'config/linkcfg', 'config/mono', 'config/solo', 'config/talk', 'config/osc',
  'config/userrout', 'config/userrout/out',
  'config/routing/IN', 'config/routing/AES50A', 'config/routing/AES50B',
  'config/routing/CARD', 'config/routing/OUT',
  'config/userctrl/A', 'config/userctrl/B', 'config/userctrl/C',

  // ==========================================
  // 32 INPUT CHANNELS
  // ==========================================
  ...Array.from({ length: 32 }, (_, i) => {
    const ch = String(i + 1).padStart(2, '0');
    return [
      `ch/${ch}/config`, `ch/${ch}/delay`, `ch/${ch}/preamp`,
      `ch/${ch}/gate`, `ch/${ch}/gate/filter`,
      `ch/${ch}/dyn`, `ch/${ch}/dyn/filter`,
      `ch/${ch}/insert`, `ch/${ch}/eq`,
      `ch/${ch}/eq/1`, `ch/${ch}/eq/2`, `ch/${ch}/eq/3`, `ch/${ch}/eq/4`,
      `ch/${ch}/mix`,
      ...Array.from({ length: 16 }, (_, j) => `ch/${ch}/mix/${String(j + 1).padStart(2, '0')}`),
      `ch/${ch}/grp`, `ch/${ch}/automix`,
    ];
  }).flat(),

  // ==========================================
  // 8 AUX INPUTS
  // ==========================================
  ...Array.from({ length: 8 }, (_, i) => {
    const aux = String(i + 1).padStart(2, '0');
    return [
      `auxin/${aux}/config`, `auxin/${aux}/preamp`,
      `auxin/${aux}/eq`, `auxin/${aux}/eq/1`, `auxin/${aux}/eq/2`, `auxin/${aux}/eq/3`, `auxin/${aux}/eq/4`,
      `auxin/${aux}/mix`,
      ...Array.from({ length: 16 }, (_, j) => `auxin/${aux}/mix/${String(j + 1).padStart(2, '0')}`),
      `auxin/${aux}/grp`,
    ];
  }).flat(),

  // ==========================================
  // 8 FX RETURNS
  // ==========================================
  ...Array.from({ length: 8 }, (_, i) => {
    const fx = String(i + 1).padStart(2, '0');
    return [
      `fxrtn/${fx}/config`,
      `fxrtn/${fx}/eq`, `fxrtn/${fx}/eq/1`, `fxrtn/${fx}/eq/2`, `fxrtn/${fx}/eq/3`, `fxrtn/${fx}/eq/4`,
      `fxrtn/${fx}/mix`,
      ...Array.from({ length: 16 }, (_, j) => `fxrtn/${fx}/mix/${String(j + 1).padStart(2, '0')}`),
      `fxrtn/${fx}/grp`,
    ];
  }).flat(),

  // ==========================================
  // 16 MIX BUSES
  // ==========================================
  ...Array.from({ length: 16 }, (_, i) => {
    const bus = String(i + 1).padStart(2, '0');
    return [
      `bus/${bus}/config`, `bus/${bus}/dyn`, `bus/${bus}/dyn/filter`,
      `bus/${bus}/insert`, `bus/${bus}/eq`,
      `bus/${bus}/eq/1`, `bus/${bus}/eq/2`, `bus/${bus}/eq/3`,
      `bus/${bus}/eq/4`, `bus/${bus}/eq/5`, `bus/${bus}/eq/6`,
      `bus/${bus}/mix`,
      ...Array.from({ length: 6 }, (_, j) => `bus/${bus}/mix/${String(j + 1).padStart(2, '0')}`),
      `bus/${bus}/grp`,
    ];
  }).flat(),

  // ==========================================
  // 6 MATRIX OUTPUTS
  // ==========================================
  ...Array.from({ length: 6 }, (_, i) => {
    const mtx = String(i + 1).padStart(2, '0');
    return [
      `mtx/${mtx}/config`, `mtx/${mtx}/dyn`, `mtx/${mtx}/dyn/filter`,
      `mtx/${mtx}/insert`, `mtx/${mtx}/eq`,
      `mtx/${mtx}/eq/1`, `mtx/${mtx}/eq/2`, `mtx/${mtx}/eq/3`,
      `mtx/${mtx}/eq/4`, `mtx/${mtx}/eq/5`, `mtx/${mtx}/eq/6`,
      `mtx/${mtx}/mix`, `mtx/${mtx}/grp`,
    ];
  }).flat(),

  // ==========================================
  // MAIN STEREO AND MONO
  // ==========================================
  'main/st/config', 'main/st/dyn', 'main/st/dyn/filter', 'main/st/insert',
  'main/st/eq', 'main/st/eq/1', 'main/st/eq/2', 'main/st/eq/3',
  'main/st/eq/4', 'main/st/eq/5', 'main/st/eq/6',
  'main/st/mix',
  'main/st/mix/01', 'main/st/mix/02', 'main/st/mix/03',
  'main/st/mix/04', 'main/st/mix/05', 'main/st/mix/06',
  'main/st/grp',

  'main/m/config', 'main/m/dyn', 'main/m/dyn/filter', 'main/m/insert',
  'main/m/eq', 'main/m/eq/1', 'main/m/eq/2', 'main/m/eq/3',
  'main/m/eq/4', 'main/m/eq/5', 'main/m/eq/6',
  'main/m/mix',
  'main/m/mix/01', 'main/m/mix/02', 'main/m/mix/03',
  'main/m/mix/04', 'main/m/mix/05', 'main/m/mix/06',
  'main/m/grp',

  // ==========================================
  // 8 DCAs
  // ==========================================
  ...Array.from({ length: 8 }, (_, i) => [
    `dca/${i + 1}`, `dca/${i + 1}/config`,
  ]).flat(),

  // ==========================================
  // 8 FX SLOTS (full parameters)
  // ==========================================
  ...Array.from({ length: 8 }, (_, i) => [
    `fx/${i + 1}`,
  ]).flat(),

  // ==========================================
  // 128 HEADAMPS
  // ==========================================
  ...Array.from({ length: 128 }, (_, i) => `headamp/${String(i).padStart(3, '0')}`),

  // ==========================================
  // OUTPUTS
  // ==========================================
  ...Array.from({ length: 16 }, (_, i) => `outputs/main/${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `outputs/aux/${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 16 }, (_, i) => `outputs/p16/${String(i + 1).padStart(2, '0')}`),
  'outputs/aes/01', 'outputs/aes/02',
  'outputs/rec/01', 'outputs/rec/02',

  // ==========================================
  // SHOW DATA - ALL 100 SCENES
  // ==========================================
  '-show/showfile/show',
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return [
      `-show/showfile/scene/${idx}`,
    ];
  }).flat(),

  // ==========================================
  // SHOW DATA - ALL 100 SNIPPETS
  // ==========================================
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return [
      `-show/showfile/snippet/${idx}`,
    ];
  }).flat(),

  // ==========================================
  // SHOW DATA - CUES
  // ==========================================
  '-show/showfile/cue/000',
  ...Array.from({ length: 500 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return `-show/showfile/cue/${idx}`;
  }),

  // ==========================================
  // LIBRARIES - CHANNEL PRESETS (100 slots)
  // ==========================================
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return `-libs/ch/${idx}`;
  }),

  // ==========================================
  // LIBRARIES - FX PRESETS (100 slots)
  // ==========================================
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return `-libs/fx/${idx}`;
  }),

  // ==========================================
  // LIBRARIES - ROUTING PRESETS (100 slots)
  // ==========================================
  ...Array.from({ length: 100 }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    return `-libs/r/${idx}`;
  }),
];

/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number, section: string) => void;

/**
 * Console backup options
 */
export interface ConsoleBackupOptions {
  ip: string;
  port?: number;
  timeout?: number;
  onProgress?: ProgressCallback;
}

/**
 * Console backup result
 */
export interface ConsoleBackupResult {
  content: string;
  parameterCount: number;
  sceneCount: number;
  snippetCount: number;
  duration: number;
  consoleInfo: {
    name: string;
    model: string;
    firmware: string;
    ip: string;
  };
}

/**
 * Create a /node query OSC message
 */
function createNodeQuery(nodePath: string): Buffer {
  const address = '/node';
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');

  const typeTag = Buffer.alloc(4);
  typeTag.write(',s', 0, 'ascii');

  const argPadded = Buffer.alloc(Math.ceil((nodePath.length + 1) / 4) * 4);
  argPadded.write(nodePath, 0, 'ascii');

  return Buffer.concat([addressPadded, typeTag, argPadded]);
}

/**
 * Create a simple OSC query
 */
function createSimpleQuery(address: string): Buffer {
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');
  const typeTag = Buffer.alloc(4);
  typeTag.write(',', 0, 'ascii');
  return Buffer.concat([addressPadded, typeTag]);
}

/**
 * Parse a node response
 */
function parseNodeResponse(buffer: Buffer): string | null {
  try {
    let offset = 0;

    const addressEnd = buffer.indexOf(0, offset);
    if (addressEnd === -1) return null;
    const address = buffer.toString('ascii', offset, addressEnd);
    offset = Math.ceil((addressEnd + 1) / 4) * 4;

    if (address !== 'node') return null;

    if (offset >= buffer.length || buffer[offset] !== 0x2c) {
      return null;
    }

    const typeTagEnd = buffer.indexOf(0, offset);
    if (typeTagEnd === -1) return null;
    offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

    const strEnd = buffer.indexOf(0, offset);
    if (strEnd === -1) return null;
    return buffer.toString('ascii', offset, strEnd);
  } catch {
    return null;
  }
}

type OSCValue = string | number;

/**
 * Parse a simple OSC response
 */
function parseSimpleResponse(buffer: Buffer, expectedAddress: string): OSCValue[] | null {
  try {
    let offset = 0;
    const addressEnd = buffer.indexOf(0, offset);
    if (addressEnd === -1) return null;
    const address = buffer.toString('ascii', offset, addressEnd);

    if (address !== expectedAddress) return null;

    offset = Math.ceil((addressEnd + 1) / 4) * 4;
    if (offset >= buffer.length || buffer[offset] !== 0x2c) {
      return [];
    }

    const typeTagEnd = buffer.indexOf(0, offset);
    if (typeTagEnd === -1) return [];
    const typeTag = buffer.toString('ascii', offset + 1, typeTagEnd);
    offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

    const args: OSCValue[] = [];
    for (const type of typeTag) {
      if (offset >= buffer.length) break;
      if (type === 's') {
        const strEnd = buffer.indexOf(0, offset);
        if (strEnd === -1) break;
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
    return args;
  } catch {
    return null;
  }
}

/**
 * X32 Console Backup Exporter class
 */
export class X32ConsoleBackupExporter {
  private socket: dgram.Socket | null = null;
  private ip: string;
  private port: number;
  private timeout: number;
  private pendingNodeRequest: {
    resolve: ((data: string | null) => void) | null;
    timeout: ReturnType<typeof setTimeout> | null;
  } = { resolve: null, timeout: null };

  constructor(ip: string, port: number = 10023, timeout: number = 1000) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');
      this.socket.setMaxListeners(1000);

      this.socket.on('message', (msg) => {
        const nodeData = parseNodeResponse(msg);
        if (nodeData && this.pendingNodeRequest.resolve) {
          if (this.pendingNodeRequest.timeout) {
            clearTimeout(this.pendingNodeRequest.timeout);
          }
          const resolveFunc = this.pendingNodeRequest.resolve;
          this.pendingNodeRequest.resolve = null;
          this.pendingNodeRequest.timeout = null;
          resolveFunc(nodeData);
        }
      });

      this.socket.on('error', reject);
      this.socket.bind(0, '0.0.0.0', () => resolve());
    });
  }

  close(): void {
    if (this.pendingNodeRequest.timeout) {
      clearTimeout(this.pendingNodeRequest.timeout);
    }
    if (this.pendingNodeRequest.resolve) {
      this.pendingNodeRequest.resolve(null);
    }
    this.pendingNodeRequest = { resolve: null, timeout: null };

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private async queryNode(nodePath: string): Promise<string | null> {
    if (!this.socket) throw new Error('Not connected');

    return new Promise((resolve) => {
      const message = createNodeQuery(nodePath);

      this.pendingNodeRequest.timeout = setTimeout(() => {
        this.pendingNodeRequest.resolve = null;
        this.pendingNodeRequest.timeout = null;
        resolve(null);
      }, this.timeout);

      this.pendingNodeRequest.resolve = resolve;
      this.socket!.send(message, 0, message.length, this.port, this.ip);
    });
  }

  async getConsoleInfo(): Promise<{ name: string; model: string; firmware: string; ip: string } | null> {
    if (!this.socket) throw new Error('Not connected');

    return new Promise((resolve) => {
      const message = createSimpleQuery('/xinfo');

      const handler = (msg: Buffer) => {
        const args = parseSimpleResponse(msg, '/xinfo');
        if (args && args.length >= 4) {
          this.socket?.off('message', handler);
          clearTimeout(timeout);
          resolve({
            ip: String(args[0]),
            name: String(args[1]),
            model: String(args[2]),
            firmware: String(args[3]),
          });
        }
      };

      this.socket!.on('message', handler);

      const timeout = setTimeout(() => {
        this.socket?.off('message', handler);
        resolve(null);
      }, this.timeout);

      this.socket!.send(message, 0, message.length, this.port, this.ip);
    });
  }

  /**
   * Export full console backup to console.bak format
   */
  async exportConsoleBackup(options: ConsoleBackupOptions): Promise<ConsoleBackupResult> {
    const startTime = Date.now();

    if (!this.socket) {
      await this.connect();
    }

    const consoleInfo = await this.getConsoleInfo();
    if (!consoleInfo) {
      throw new Error('Could not connect to X32 or get console info');
    }

    const totalNodes = CONSOLE_BACKUP_PATHS.length;
    const lines: string[] = [];

    // Add header matching X32 console.bak format
    const timestamp = new Date().toISOString();
    lines.push(`#${consoleInfo.firmware}# "${consoleInfo.name}" "${timestamp}"`);

    let completed = 0;
    let successfulQueries = 0;
    let sceneCount = 0;
    let snippetCount = 0;

    for (const nodePath of CONSOLE_BACKUP_PATHS) {
      const nodeData = await this.queryNode(nodePath);

      if (nodeData) {
        lines.push(nodeData);
        successfulQueries++;

        // Count scenes and snippets
        if (nodePath.includes('/scene/') && nodeData.trim().length > 0) {
          sceneCount++;
        }
        if (nodePath.includes('/snippet/') && nodeData.trim().length > 0) {
          snippetCount++;
        }
      }

      completed++;

      // Report progress with section info
      if (options.onProgress && (completed % 50 === 0 || completed === totalNodes)) {
        let section = 'Initializing';
        if (completed < 50) section = 'Preferences';
        else if (completed < 200) section = 'Config';
        else if (completed < 1000) section = 'Channels';
        else if (completed < 1500) section = 'Aux/FX';
        else if (completed < 2000) section = 'Buses/Outputs';
        else if (completed < 2200) section = 'Scenes';
        else if (completed < 2400) section = 'Snippets';
        else section = 'Libraries';

        options.onProgress(completed, totalNodes, section);
      }

      // Small delay to avoid overwhelming the X32
      await new Promise(resolve => setTimeout(resolve, 3));
    }

    const duration = Date.now() - startTime;

    return {
      content: lines.join('\n'),
      parameterCount: successfulQueries,
      sceneCount,
      snippetCount,
      duration,
      consoleInfo,
    };
  }
}

/**
 * Export a complete console backup
 * Convenience function that handles connection lifecycle
 */
export async function exportConsoleBackup(options: ConsoleBackupOptions): Promise<ConsoleBackupResult> {
  const exporter = new X32ConsoleBackupExporter(
    options.ip,
    options.port || 10023,
    options.timeout || 1000
  );

  try {
    await exporter.connect();
    return await exporter.exportConsoleBackup(options);
  } finally {
    exporter.close();
  }
}
