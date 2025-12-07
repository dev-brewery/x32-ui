/**
 * Create a USB-compatible full backup of the X32 console state
 *
 * This script uses the X32's /node command to query all parameters as node groups,
 * generating a .scn file that can be loaded via USB on the X32.
 *
 * Usage: node scripts/create-full-backup.mjs [--ip 192.168.1.96] [--output backups/] [--name "BackupName"]
 */

import dgram from 'dgram';
import { promises as fs } from 'fs';
import path from 'path';

const X32_PORT = 10023;
const LOCAL_PORT = 10027;
const TIMEOUT = 1000;

// Parse command line args
const args = process.argv.slice(2);
let x32Ip = '192.168.1.96';
let outputDir = 'backups';
let sceneName = 'Full-Backup';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip' && args[i + 1]) {
    x32Ip = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  } else if (args[i] === '--name' && args[i + 1]) {
    sceneName = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
X32 Full Backup Utility
=======================
Creates a USB-compatible .scn scene file containing ALL mixer parameters.

Usage:
  node scripts/create-full-backup.mjs [options]

Options:
  --ip <address>    X32 IP address (default: 192.168.1.96)
  --output <dir>    Output directory (default: backups/)
  --name <name>     Scene name in file header (default: Full-Backup)
  --help, -h        Show this help message

Output:
  Creates a .scn file that can be:
  - Copied to USB drive and loaded on X32 via Setup > Libraries > Import Scene
  - Used to restore the mixer to this exact state

Example:
  node scripts/create-full-backup.mjs --ip 192.168.1.100 --name "Sunday Service"
`);
    process.exit(0);
  }
}

console.log('='.repeat(70));
console.log('X32 Full Backup (USB-Compatible .scn)');
console.log('='.repeat(70));
console.log(`\nTarget: ${x32Ip}:${X32_PORT}`);
console.log(`Output: ${outputDir}`);
console.log(`Scene Name: ${sceneName}\n`);

/**
 * All node paths to query for a complete scene backup
 * These are queried using the /node command which returns all sub-parameters
 */
const NODE_PATHS = [
  // Config section
  'config/chlink', 'config/auxlink', 'config/fxlink', 'config/buslink', 'config/mtxlink',
  'config/mute', 'config/linkcfg', 'config/mono', 'config/solo', 'config/talk',
  'config/userrout', 'config/userrout/out',

  // 32 Input channels
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

  // 8 Aux inputs
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

  // 8 FX returns
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

  // 16 Mix buses
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

  // 6 Matrix outputs
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

  // Main stereo bus
  'main/st/config', 'main/st/dyn', 'main/st/dyn/filter', 'main/st/insert',
  'main/st/eq', 'main/st/eq/1', 'main/st/eq/2', 'main/st/eq/3',
  'main/st/eq/4', 'main/st/eq/5', 'main/st/eq/6',
  'main/st/mix',
  'main/st/mix/01', 'main/st/mix/02', 'main/st/mix/03',
  'main/st/mix/04', 'main/st/mix/05', 'main/st/mix/06',
  'main/st/grp',

  // Main mono bus
  'main/m/config', 'main/m/dyn', 'main/m/dyn/filter', 'main/m/insert',
  'main/m/eq', 'main/m/eq/1', 'main/m/eq/2', 'main/m/eq/3',
  'main/m/eq/4', 'main/m/eq/5', 'main/m/eq/6',
  'main/m/mix',
  'main/m/mix/01', 'main/m/mix/02', 'main/m/mix/03',
  'main/m/mix/04', 'main/m/mix/05', 'main/m/mix/06',
  'main/m/grp',

  // 8 DCAs
  ...Array.from({ length: 8 }, (_, i) => [
    `dca/${i + 1}`, `dca/${i + 1}/config`,
  ]).flat(),

  // 4 FX slots
  ...Array.from({ length: 4 }, (_, i) => [
    `fx/${i + 1}`,
  ]).flat(),

  // Headamps (0-127) - query individual headamps
  ...Array.from({ length: 128 }, (_, i) => `headamp/${String(i).padStart(3, '0')}`),

  // Outputs
  ...Array.from({ length: 16 }, (_, i) => `outputs/main/${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `outputs/aux/${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 16 }, (_, i) => `outputs/p16/${String(i + 1).padStart(2, '0')}`),
  'outputs/aes/01', 'outputs/aes/02',
  'outputs/rec/01', 'outputs/rec/02',
];

// OSC utilities
function createNodeQuery(nodePath) {
  // /node command with string argument for the path
  const address = '/node';
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');

  // Type tag ,s for string argument
  const typeTag = Buffer.alloc(4);
  typeTag.write(',s', 0, 'ascii');

  // String argument (the node path)
  const argPadded = Buffer.alloc(Math.ceil((nodePath.length + 1) / 4) * 4);
  argPadded.write(nodePath, 0, 'ascii');

  return Buffer.concat([addressPadded, typeTag, argPadded]);
}

function parseNodeResponse(buffer) {
  try {
    let offset = 0;

    // Parse address (should be "node")
    const addressEnd = buffer.indexOf(0, offset);
    if (addressEnd === -1) return null;
    const address = buffer.toString('ascii', offset, addressEnd);
    offset = Math.ceil((addressEnd + 1) / 4) * 4;

    // Skip if not a node response
    if (address !== 'node') return null;

    // Check for type tag
    if (offset >= buffer.length || buffer[offset] !== 0x2c) {
      return null;
    }

    // Parse type tag
    const typeTagEnd = buffer.indexOf(0, offset);
    if (typeTagEnd === -1) return null;
    offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

    // Parse the string argument (node data)
    const strEnd = buffer.indexOf(0, offset);
    if (strEnd === -1) return null;
    const nodeData = buffer.toString('ascii', offset, strEnd);

    return nodeData;
  } catch {
    return null;
  }
}

// Create socket
const socket = dgram.createSocket('udp4');
socket.setMaxListeners(500);

const pendingNodeRequest = { resolve: null, timeout: null };

socket.on('message', (msg) => {
  const nodeData = parseNodeResponse(msg);
  if (nodeData && pendingNodeRequest.resolve) {
    clearTimeout(pendingNodeRequest.timeout);
    const resolve = pendingNodeRequest.resolve;
    pendingNodeRequest.resolve = null;
    pendingNodeRequest.timeout = null;
    resolve(nodeData);
  }
});

await new Promise((resolve, reject) => {
  socket.bind(LOCAL_PORT, '0.0.0.0', () => resolve());
  socket.on('error', reject);
});

async function queryNode(nodePath) {
  return new Promise((resolve) => {
    const message = createNodeQuery(nodePath);

    pendingNodeRequest.timeout = setTimeout(() => {
      pendingNodeRequest.resolve = null;
      pendingNodeRequest.timeout = null;
      resolve(null);
    }, TIMEOUT);

    pendingNodeRequest.resolve = resolve;
    socket.send(message, 0, message.length, X32_PORT, x32Ip);
  });
}

// Simple query for non-node commands
function createSimpleQuery(address) {
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');
  const typeTag = Buffer.alloc(4);
  typeTag.write(',', 0, 'ascii');
  return Buffer.concat([addressPadded, typeTag]);
}

async function querySimple(address) {
  return new Promise((resolve) => {
    const message = createSimpleQuery(address);

    const handler = (msg) => {
      try {
        let offset = 0;
        const addressEnd = msg.indexOf(0, offset);
        if (addressEnd === -1) return;
        const respAddress = msg.toString('ascii', offset, addressEnd);

        if (respAddress === address) {
          socket.off('message', handler);
          clearTimeout(timeout);

          offset = Math.ceil((addressEnd + 1) / 4) * 4;
          if (offset >= msg.length || msg[offset] !== 0x2c) {
            resolve([]);
            return;
          }

          const typeTagEnd = msg.indexOf(0, offset);
          if (typeTagEnd === -1) {
            resolve([]);
            return;
          }
          const typeTag = msg.toString('ascii', offset + 1, typeTagEnd);
          offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

          const args = [];
          for (const type of typeTag) {
            if (offset >= msg.length) break;
            if (type === 's') {
              const strEnd = msg.indexOf(0, offset);
              if (strEnd === -1) break;
              args.push(msg.toString('ascii', offset, strEnd));
              offset = Math.ceil((strEnd + 1) / 4) * 4;
            } else if (type === 'i') {
              args.push(msg.readInt32BE(offset));
              offset += 4;
            } else if (type === 'f') {
              args.push(msg.readFloatBE(offset));
              offset += 4;
            }
          }
          resolve(args);
        }
      } catch { /* ignore */ }
    };

    socket.on('message', handler);

    const timeout = setTimeout(() => {
      socket.off('message', handler);
      resolve(null);
    }, TIMEOUT);

    socket.send(message, 0, message.length, X32_PORT, x32Ip);
  });
}

// Get console info
console.log('Connecting to X32...');
const infoArgs = await querySimple('/xinfo');
if (!infoArgs || infoArgs.length < 4) {
  console.error('ERROR: Could not connect to X32');
  socket.close();
  process.exit(1);
}

const consoleInfo = {
  ip: String(infoArgs[0]),
  name: String(infoArgs[1]),
  model: String(infoArgs[2]),
  firmware: String(infoArgs[3])
};

console.log(`Connected to ${consoleInfo.name} (${consoleInfo.model}) - Firmware ${consoleInfo.firmware}\n`);

// Query all nodes
console.log(`Querying ${NODE_PATHS.length} nodes...`);

const lines = [];
lines.push(`#${consoleInfo.firmware}# "${sceneName}" "" %0000000 0`);

const startTime = Date.now();
let completed = 0;
let successfulQueries = 0;

for (const nodePath of NODE_PATHS) {
  const nodeData = await queryNode(nodePath);

  if (nodeData) {
    // The node response format is: "/path value1 value2 ..." (already has leading slash)
    // Just use the nodeData directly since it already has the path
    lines.push(nodeData);
    successfulQueries++;
  }

  completed++;

  // Progress indicator
  if (completed % 100 === 0 || completed === NODE_PATHS.length) {
    const percent = Math.round((completed / NODE_PATHS.length) * 100);
    process.stdout.write(`\r  Progress: ${percent}% (${completed}/${NODE_PATHS.length}) - ${successfulQueries} params captured`);
  }

  // Small delay to avoid overwhelming the X32
  await new Promise(resolve => setTimeout(resolve, 5));
}

console.log('\n');

// Save file
const timestamp = new Date().toISOString();
const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
const safeConsoleName = consoleInfo.name.replace(/[^a-zA-Z0-9-_]/g, '_');
const filename = `${safeConsoleName}_${dateStr}.scn`;

await fs.mkdir(outputDir, { recursive: true });
const filePath = path.join(outputDir, filename);
await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

const elapsed = Date.now() - startTime;
const stats = await fs.stat(filePath);

console.log('='.repeat(70));
console.log('FULL BACKUP COMPLETED SUCCESSFULLY!');
console.log('='.repeat(70));
console.log(`\nFile saved: ${filePath}`);
console.log(`\nBackup details:`);
console.log(`  Console: ${consoleInfo.name} (${consoleInfo.model})`);
console.log(`  IP: ${consoleInfo.ip}`);
console.log(`  Firmware: ${consoleInfo.firmware}`);
console.log(`  Parameters: ${successfulQueries}`);
console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`  Duration: ${(elapsed / 1000).toFixed(1)}s`);
console.log(`\nThis .scn file can be loaded on the X32 via:`);
console.log(`  1. Copy to USB drive`);
console.log(`  2. Insert USB in X32`);
console.log(`  3. Scenes > View > Utility > Import`);

socket.close();
