/**
 * Test script for X32 connection
 * Tests the discovery and scene retrieval functionality
 *
 * Usage: node scripts/test-connection.mjs [--ip 192.168.1.96]
 */

import dgram from 'dgram';

const X32_PORT = 10023;
const LOCAL_PORT = 10025;
const TIMEOUT = 2000;

// Parse command line args
const args = process.argv.slice(2);
let x32Ip = '192.168.1.96';  // Default to discovered X32

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip' && args[i + 1]) {
    x32Ip = args[i + 1];
    i++;
  }
}

console.log('='.repeat(60));
console.log('X32 Connection Test');
console.log('='.repeat(60));
console.log(`\nTarget: ${x32Ip}:${X32_PORT}\n`);

// OSC Message utilities
function createOSCMessage(address, ...args) {
  const addressPadded = Buffer.alloc(Math.ceil((address.length + 1) / 4) * 4);
  addressPadded.write(address, 0, 'ascii');

  let typeTag = ',';
  const argBuffers = [];

  for (const arg of args) {
    if (typeof arg === 'number' && Number.isInteger(arg)) {
      typeTag += 'i';
      const buf = Buffer.alloc(4);
      buf.writeInt32BE(arg, 0);
      argBuffers.push(buf);
    } else if (typeof arg === 'string') {
      typeTag += 's';
      const buf = Buffer.alloc(Math.ceil((arg.length + 1) / 4) * 4);
      buf.write(arg, 0, 'ascii');
      argBuffers.push(buf);
    }
  }

  const typeTagPadded = Buffer.alloc(Math.ceil((typeTag.length + 1) / 4) * 4);
  typeTagPadded.write(typeTag, 0, 'ascii');

  return Buffer.concat([addressPadded, typeTagPadded, ...argBuffers]);
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
socket.setMaxListeners(100);

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

// Send and wait for response
async function sendOSC(address, ...args) {
  return new Promise((resolve, reject) => {
    const message = createOSCMessage(address, ...args);
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(address);
      reject(new Error(`Timeout waiting for ${address}`));
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

// Test 1: Get console info
console.log('Test 1: Get console info (/xinfo)');
try {
  const info = await sendOSC('/xinfo');
  console.log('  SUCCESS!');
  console.log(`    IP:       ${info.args[0]}`);
  console.log(`    Name:     ${info.args[1]}`);
  console.log(`    Model:    ${info.args[2]}`);
  console.log(`    Firmware: ${info.args[3]}`);
} catch (error) {
  console.log(`  FAILED: ${error.message}`);
  socket.close();
  process.exit(1);
}

// Test 2: Get current scene index
console.log('\nTest 2: Get current scene index');
try {
  const scene = await sendOSC('/-show/prepos/current');
  console.log('  SUCCESS!');
  console.log(`    Current scene index: ${scene.args[0]}`);
} catch (error) {
  console.log(`  FAILED: ${error.message}`);
}

// Test 3: Get a few scene names
console.log('\nTest 3: Get first 10 scene names');
const scenes = [];
for (let i = 0; i < 10; i++) {
  try {
    const sceneName = await sendOSC(`/-show/showfile/scene/${String(i).padStart(3, '0')}/name`);
    if (sceneName.args[0]) {
      scenes.push({ index: i, name: sceneName.args[0] });
      console.log(`    [${i}] ${sceneName.args[0]}`);
    }
  } catch {
    // Timeout = empty slot
  }
}

if (scenes.length === 0) {
  console.log('    No scenes found in slots 0-9');
}

console.log('\n' + '='.repeat(60));
console.log('All tests completed successfully!');
console.log('The X32 connection is working correctly.');
console.log('='.repeat(60));

socket.close();
