/**
 * X32 Scene Manager - Server Entry Point
 *
 * Express server with:
 * - Static file serving for React frontend
 * - REST API for scene management
 * - WebSocket for real-time updates
 * - OSC communication with X32 mixer
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initScenesApi } from './api/scenes.js';
import { initBackupApi } from './api/backup.js';
import { wsHandler } from './websocket/handler.js';
import { x32Connection } from './x32/connection.js';
import { discoverX32 } from './x32/discovery.js';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  x32Ip: process.env.X32_IP || '192.168.1.96',  // Updated to discovered X32 IP
  x32Port: parseInt(process.env.X32_PORT || '10023', 10),
  sceneDir: process.env.SCENE_DIR || path.join(__dirname, '..', 'scenes'),
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'),
  mockMode: process.env.MOCK_MODE !== 'false', // Default to mock mode
};

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/scenes', initScenesApi(config.sceneDir));
app.use('/api/backup', initBackupApi(config.backupDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    x32Connection: x32Connection.getState(),
    mockMode: x32Connection.isMockMode(),
    timestamp: new Date().toISOString(),
  });
});

// X32 connection info endpoint
app.get('/api/x32/info', async (req, res) => {
  try {
    const info = await x32Connection.getInfo();
    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get X32 info',
    });
  }
});

// X32 discovery endpoint
app.get('/api/x32/discover', async (req, res) => {
  try {
    const subnet = req.query.subnet as string | undefined;
    console.log('[API] Starting X32 discovery...');

    const found = await discoverX32({
      subnet,
      onProgress: (current, total) => {
        console.log(`[API] Discovery progress: ${current}/${total}`);
      },
    });

    res.json({
      success: true,
      data: found,
    });
  } catch (error) {
    console.error('[API] Discovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discover X32 devices',
    });
  }
});

// X32 connect endpoint - allows dynamic connection to discovered X32
app.post('/api/x32/connect', async (req, res) => {
  try {
    const { ip, port = 10023 } = req.body;

    if (!ip) {
      res.status(400).json({
        success: false,
        error: 'IP address is required',
      });
      return;
    }

    // Disconnect existing connection
    x32Connection.disconnect();

    // Update config and reconnect
    x32Connection.updateConfig({
      ip,
      port,
      mockMode: false, // Connecting to real X32
    });

    await x32Connection.connect();
    const info = await x32Connection.getInfo();

    res.json({
      success: true,
      data: {
        connected: true,
        info,
      },
    });
  } catch (error) {
    console.error('[API] Connect error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to X32',
    });
  }
});

// Serve static files from dist folder in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for any unmatched routes
app.get('/{*path}', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize WebSocket handler
wsHandler.initialize(server);

// Initialize X32 connection
async function initializeX32(): Promise<void> {
  // Update X32 connection config
  x32Connection.updateConfig({
    ip: config.x32Ip,
    port: config.x32Port,
    mockMode: config.mockMode,
  });

  try {
    await x32Connection.connect();
    const info = await x32Connection.getInfo();

    if (info) {
      console.log(`[X32] Connected to ${info.name} (${info.model}) at ${info.ip}`);
      console.log(`[X32] Firmware: ${info.firmware}`);
    }
  } catch (error) {
    console.error('[X32] Failed to connect:', error);
    console.log('[X32] Will retry connection when needed');
  }
}

// Start server
async function start(): Promise<void> {
  console.log('\n========================================');
  console.log('  X32 Scene Manager - Server Starting');
  console.log('========================================\n');
  console.log(`Configuration:`);
  console.log(`  Port:       ${config.port}`);
  console.log(`  X32 IP:     ${config.x32Ip}`);
  console.log(`  X32 Port:   ${config.x32Port}`);
  console.log(`  Scene Dir:  ${config.sceneDir}`);
  console.log(`  Backup Dir: ${config.backupDir}`);
  console.log(`  Mock Mode:  ${config.mockMode}`);
  console.log('');

  // Initialize X32 connection
  await initializeX32();

  // Start HTTP server
  server.listen(config.port, () => {
    console.log(`\n[Server] Listening on http://localhost:${config.port}`);
    console.log(`[Server] WebSocket available at ws://localhost:${config.port}/ws`);

    if (config.mockMode) {
      console.log('\n[NOTE] Running in MOCK MODE - no real X32 communication');
      console.log('       Set MOCK_MODE=false and X32_IP to connect to real X32');
    }

    console.log('\n========================================\n');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  x32Connection.disconnect();
  wsHandler.close();
  server.close(() => {
    console.log('[Server] Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  x32Connection.disconnect();
  wsHandler.close();
  server.close(() => {
    process.exit(0);
  });
});

// Start the server
start().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
