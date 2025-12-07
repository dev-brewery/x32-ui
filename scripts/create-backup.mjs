/**
 * Create a full backup of the X32 show
 * This script directly queries the X32 and saves all scenes to a JSON file
 *
 * Usage: node scripts/create-backup.mjs [--ip 192.168.1.96] [--output backups/]
 */

import dgram from 'dgram';
import { promises as fs } from 'fs';
import path from 'path';

const X32_PORT = 10023;
const LOCAL_PORT = 10026;
const TIMEOUT = 1000;
const MAX_SCENES = 100;

// Parse command line args
const args = process.argv.slice(2);
let x32Ip = '192.168.1.96';
let outputDir = 'backups';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip' && args[i + 1]) {
    x32Ip = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputDir = args[i + 1];
    i++;
  }
}

console.log('='.repeat(60));
console.log('X32 Full Show Backup');
console.log('='.repeat(60));
console.log(`\nTarget: ${x32Ip}:${X32_PORT}`);
console.log(`Output: ${outputDir}\n`);

// OSC Message utilities
function createOSCMessage(address) {
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');
  const typeTag = ',';
  const typeTagPadded = Buffer.alloc(4);
  typeTagPadded.write(typeTag, 0, 'ascii');
  return Buffer.concat([addressPadded, typeTagPadded]);
}

function parseOSCMessage(buffer) {
  let offset = 0;
  const addressEnd = buffer.indexOf(0, offset);
  const address = buffer.toString('ascii', offset, addressEnd);
  offset = Math.ceil((addressEnd + 1) / 4) * 4;

  if (buffer[offset] !== 0x2c) {
    return { address, args: [] };
  }

  const typeTagEnd = buffer.indexOf(0, offset);
  const typeTag = buffer.toString('ascii', offset + 1, typeTagEnd);
  offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

  const args = [];
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

// Create socket
const socket = dgram.createSocket('udp4');
socket.setMaxListeners(200);

const pendingRequests = new Map();

socket.on('message', (msg, rinfo) => {
  const parsed = parseOSCMessage(msg);
  const pending = pendingRequests.get(parsed.address);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(parsed.address);
    pending.resolve(parsed);
  }
});

await new Promise((resolve, reject) => {
  socket.bind(LOCAL_PORT, '0.0.0.0', () => resolve());
  socket.on('error', reject);
});

async function sendOSC(address) {
  return new Promise((resolve, reject) => {
    const message = createOSCMessage(address);
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(address);
      resolve(null); // Return null on timeout
    }, TIMEOUT);

    pendingRequests.set(address, { resolve, timeout: timeoutHandle });

    socket.send(message, 0, message.length, X32_PORT, x32Ip, (err) => {
      if (err) {
        clearTimeout(timeoutHandle);
        pendingRequests.delete(address);
        reject(err);
      }
    });
  });
}

// Step 1: Get console info
console.log('Connecting to X32...');
const info = await sendOSC('/xinfo');
if (!info) {
  console.error('ERROR: Could not connect to X32');
  socket.close();
  process.exit(1);
}

console.log(`Connected to ${info.args[1]} (${info.args[2]}) - Firmware ${info.args[3]}\n`);

// Step 2: Get current scene
const currentScene = await sendOSC('/-show/prepos/current');
const currentSceneIndex = currentScene?.args[0] ?? -1;

// Step 3: Get all scenes
console.log('Fetching all scenes (0-99)...');
const scenes = [];

for (let i = 0; i < MAX_SCENES; i++) {
  if (i % 10 === 0) {
    process.stdout.write(`  Scanning ${i}-${Math.min(i + 9, 99)}...`);
  }

  const sceneName = await sendOSC(`/-show/showfile/scene/${String(i).padStart(3, '0')}/name`);

  if (sceneName?.args[0]) {
    const sceneNotes = await sendOSC(`/-show/showfile/scene/${String(i).padStart(3, '0')}/notes`);
    scenes.push({
      index: i,
      name: sceneName.args[0],
      notes: sceneNotes?.args[0] || '',
    });
  }

  if ((i + 1) % 10 === 0) {
    console.log(` found ${scenes.length} scenes so far`);
  }
}

console.log(`\nTotal scenes found: ${scenes.length}`);

// Step 4: Create backup object
const timestamp = new Date().toISOString();
const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
const safeConsoleName = info.args[1].replace(/[^a-zA-Z0-9-_]/g, '_');
const filename = `${safeConsoleName}_${dateStr}.json`;

const backup = {
  timestamp,
  filename,
  consoleName: info.args[1],
  consoleModel: info.args[2],
  consoleIp: info.args[0],
  firmware: info.args[3],
  scenesBackedUp: scenes.length,
  currentSceneIndex,
  scenes,
};

// Step 5: Save backup file
await fs.mkdir(outputDir, { recursive: true });
const filePath = path.join(outputDir, filename);
await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8');

console.log('\n' + '='.repeat(60));
console.log('BACKUP COMPLETED SUCCESSFULLY!');
console.log('='.repeat(60));
console.log(`\nFile saved: ${filePath}`);
console.log(`\nBackup contains:`);
console.log(`  Console: ${backup.consoleName} (${backup.consoleModel})`);
console.log(`  IP: ${backup.consoleIp}`);
console.log(`  Firmware: ${backup.firmware}`);
console.log(`  Scenes: ${backup.scenesBackedUp}`);
console.log(`  Current scene index: ${backup.currentSceneIndex}`);
console.log('\nScenes in backup:');
for (const scene of scenes) {
  console.log(`  [${scene.index}] ${scene.name}${scene.notes ? ` - ${scene.notes}` : ''}`);
}

socket.close();
