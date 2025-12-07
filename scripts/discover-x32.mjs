/**
 * X32 Network Discovery Script
 * Scans the local network for Behringer X32 mixers by sending /xinfo OSC messages
 *
 * Usage: node scripts/discover-x32.mjs [--subnet 192.168.1] [--fast]
 */

import dgram from 'dgram';
import { execSync } from 'child_process';

const X32_PORT = 10023;
const DISCOVERY_TIMEOUT = 500; // 500ms per target (X32 responds fast)
const LOCAL_PORT = 10024;
const BATCH_SIZE = 20; // Parallel batch size for faster scanning

// OSC Message encoder for /xinfo
function createXInfoMessage() {
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

// Parse OSC message response
function parseOSCMessage(buffer) {
  let offset = 0;

  // Read address (null-terminated, 4-byte aligned)
  let addressEnd = buffer.indexOf(0, offset);
  const address = buffer.toString('ascii', offset, addressEnd);
  offset = Math.ceil((addressEnd + 1) / 4) * 4;

  // Read type tag
  if (buffer[offset] !== 0x2c) { // comma
    return { address, args: [] };
  }
  let typeTagEnd = buffer.indexOf(0, offset);
  const typeTag = buffer.toString('ascii', offset + 1, typeTagEnd);
  offset = Math.ceil((typeTagEnd + 1) / 4) * 4;

  // Parse arguments based on type tag
  const args = [];
  for (const type of typeTag) {
    if (type === 's') {
      // String argument
      let strEnd = buffer.indexOf(0, offset);
      args.push(buffer.toString('ascii', offset, strEnd));
      offset = Math.ceil((strEnd + 1) / 4) * 4;
    } else if (type === 'i') {
      // 32-bit integer (big-endian)
      args.push(buffer.readInt32BE(offset));
      offset += 4;
    } else if (type === 'f') {
      // 32-bit float (big-endian)
      args.push(buffer.readFloatBE(offset));
      offset += 4;
    }
  }

  return { address, args };
}

// Get list of candidate IPs from ARP cache
function getCandidateIPs() {
  try {
    const output = execSync('arp -a', { encoding: 'utf8' });
    const ips = [];
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

    return [...new Set(ips)]; // Remove duplicates
  } catch (error) {
    console.error('Failed to get ARP cache:', error.message);
    return [];
  }
}

// Probe a single IP for X32 (with shared socket)
function probeX32(ip, socket, pendingRequests) {
  return new Promise((resolve) => {
    const message = createXInfoMessage();
    const timeout = setTimeout(() => {
      pendingRequests.delete(ip);
      resolve(null);
    }, DISCOVERY_TIMEOUT);

    pendingRequests.set(ip, { resolve, timeout });

    socket.send(message, 0, message.length, X32_PORT, ip, (err) => {
      if (err) {
        clearTimeout(timeout);
        pendingRequests.delete(ip);
        resolve(null);
      }
    });
  });
}

// Main discovery function with parallel batching
async function discoverX32(candidateIPs, fastMode = false) {
  console.log('Starting X32 discovery...');
  console.log(`Scanning ${candidateIPs.length} IP addresses on port ${X32_PORT}`);
  if (fastMode) {
    console.log(`Fast mode enabled: scanning in parallel batches of ${BATCH_SIZE}`);
  }
  console.log('');

  const socket = dgram.createSocket('udp4');
  socket.setMaxListeners(500);

  const pendingRequests = new Map();
  const found = [];

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
            ip: parsed.args[0],
            name: parsed.args[1],
            model: parsed.args[2],
            firmware: parsed.args[3],
            sourceIp: rinfo.address
          });
          return;
        }
      } catch (e) {
        // Parse error, resolve null
      }
      pending.resolve(null);
    }
  });

  await new Promise((resolve) => {
    socket.bind(LOCAL_PORT, '0.0.0.0', () => {
      resolve();
    });
  });

  if (fastMode) {
    // Parallel batched scanning
    for (let i = 0; i < candidateIPs.length; i += BATCH_SIZE) {
      const batch = candidateIPs.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  Scanning ${i + 1}-${Math.min(i + BATCH_SIZE, candidateIPs.length)} of ${candidateIPs.length}...`);

      const results = await Promise.all(
        batch.map(ip => probeX32(ip, socket, pendingRequests))
      );

      const batchFound = results.filter(r => r !== null);
      found.push(...batchFound);

      if (batchFound.length > 0) {
        console.log(` FOUND ${batchFound.length} X32!`);
      } else {
        console.log(' done');
      }
    }
  } else {
    // Sequential scanning with verbose output
    for (const ip of candidateIPs) {
      process.stdout.write(`  Probing ${ip}...`);
      const result = await probeX32(ip, socket, pendingRequests);
      if (result) {
        console.log(` FOUND X32!`);
        found.push(result);
      } else {
        console.log(` no response`);
      }
    }
  }

  socket.close();

  return found;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    subnet: null,
    fast: false,
    ip: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subnet' && args[i + 1]) {
      options.subnet = args[i + 1];
      i++;
    } else if (args[i] === '--fast') {
      options.fast = true;
    } else if (args[i] === '--ip' && args[i + 1]) {
      options.ip = args[i + 1];
      i++;
    }
  }

  return options;
}

// Generate subnet IPs for full scan
function generateSubnetIPs(subnet) {
  const ips = [];
  for (let i = 2; i < 255; i++) {
    ips.push(`${subnet}.${i}`);
  }
  return ips;
}

// Main
async function main() {
  const options = parseArgs();

  let candidateIPs;

  if (options.ip) {
    console.log(`Probing specific IP: ${options.ip}`);
    candidateIPs = [options.ip];
  } else if (options.subnet) {
    console.log(`Performing full subnet scan on ${options.subnet}.0/24`);
    candidateIPs = generateSubnetIPs(options.subnet);
  } else {
    console.log('Using ARP cache for discovery (faster)');
    console.log('Use --subnet 192.168.1 for full subnet scan');
    console.log('Use --fast for parallel scanning\n');
    candidateIPs = getCandidateIPs();
  }

  if (candidateIPs.length === 0) {
    console.error('No candidate IPs found. Try running with --subnet YOUR_SUBNET');
    process.exit(1);
  }

  const found = await discoverX32(candidateIPs, options.fast || candidateIPs.length > 20);

  console.log('\n' + '='.repeat(60));

  if (found.length === 0) {
    console.log('No X32 mixers found on the network.');
    console.log('\nTroubleshooting tips:');
    console.log('  1. Ensure X32 is powered on and connected to the network');
    console.log('  2. Check that X32 and this computer are on the same subnet');
    console.log('  3. Try a full subnet scan: node scripts/discover-x32.mjs --subnet 192.168.1');
    console.log('  4. Check firewall settings (UDP port 10023)');
    console.log('  5. Try directly: node scripts/discover-x32.mjs --ip 192.168.1.XXX');
  } else {
    console.log(`\nFound ${found.length} X32 mixer(s):\n`);
    for (const x32 of found) {
      console.log(`  Name:     ${x32.name}`);
      console.log(`  Model:    ${x32.model}`);
      console.log(`  IP:       ${x32.ip}`);
      console.log(`  Firmware: ${x32.firmware}`);
      console.log('');
    }

    console.log('To use this X32, set the following environment variables:');
    console.log(`  X32_IP=${found[0].ip}`);
    console.log(`  MOCK_MODE=false`);
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
