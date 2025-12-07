# X32 Scene Manager - Unraid Deployment Guide

## Overview

This guide covers deploying X32 Scene Manager on Unraid using the Docker Compose Manager plugin.

**Application Summary:**
- **Purpose**: Web UI for managing Behringer X32 mixer scenes
- **Port**: 3000 (configurable)
- **Network**: Host mode required for X32 auto-discovery (UDP broadcast)
- **Storage**: Persistent volume for scene/backup files

---

## Prerequisites

1. **Unraid 6.11+** with Docker enabled
2. **Docker Compose Manager** plugin installed (via Community Applications)
3. **X32 mixer** on the same network subnet as Unraid

### Installing Docker Compose Manager

1. Go to **Apps** in Unraid
2. Search for "Docker Compose Manager"
3. Click **Install**
4. The plugin will appear under **Docker** → **Compose**

---

## Quick Start Deployment

### Option 1: Using Pre-built Image (Recommended)

Create a new stack in Docker Compose Manager with this configuration:

```yaml
# X32 Scene Manager - Unraid Stack
# Save as: /boot/config/plugins/compose.manager/projects/x32-scene-manager/compose.yaml

services:
  x32-scene-manager:
    image: ghcr.io/YOUR_USERNAME/x32-scene-manager:latest
    container_name: x32-scene-manager
    restart: unless-stopped

    # Host network required for X32 UDP broadcast discovery
    network_mode: host

    environment:
      - PORT=3000
      - X32_IP=                    # Leave empty for auto-discovery, or set your X32's IP
      - X32_PORT=10023
      - MOCK_MODE=false
      - SCENE_DIR=/app/scenes
      - BACKUP_DIR=/app/backups

    volumes:
      # Map to Unraid share for persistent storage
      - /mnt/user/appdata/x32-scene-manager/scenes:/app/scenes
      - /mnt/user/appdata/x32-scene-manager/backups:/app/backups

    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Option 2: Building from Source

```yaml
# X32 Scene Manager - Build from Source
# Clone repo to: /mnt/user/appdata/x32-scene-manager/source/

services:
  x32-scene-manager:
    build:
      context: /mnt/user/appdata/x32-scene-manager/source
      dockerfile: Dockerfile
    container_name: x32-scene-manager
    restart: unless-stopped
    network_mode: host

    environment:
      - PORT=3000
      - X32_IP=
      - X32_PORT=10023
      - MOCK_MODE=false
      - SCENE_DIR=/app/scenes
      - BACKUP_DIR=/app/backups

    volumes:
      - /mnt/user/appdata/x32-scene-manager/scenes:/app/scenes
      - /mnt/user/appdata/x32-scene-manager/backups:/app/backups

    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Step-by-Step Deployment

### 1. Create Project Directory

```bash
mkdir -p /mnt/user/appdata/x32-scene-manager/scenes
mkdir -p /mnt/user/appdata/x32-scene-manager/backups
```

### 2. Create Docker Compose Stack

1. Navigate to **Docker** → **Compose** in Unraid
2. Click **Add New Stack**
3. Name: `x32-scene-manager`
4. Paste the compose.yaml content from above
5. Click **Save**

### 3. Configure Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web UI port |
| `X32_IP` | (empty) | X32 IP address. Leave empty for auto-discovery |
| `X32_PORT` | `10023` | X32 OSC port (rarely needs changing) |
| `MOCK_MODE` | `false` | Set to `true` to run without real X32 |
| `SCENE_DIR` | `/app/scenes` | Internal scene storage path |
| `BACKUP_DIR` | `/app/backups` | Internal backup storage path |

### 4. Start the Stack

1. Click **Compose Up** on your x32-scene-manager stack
2. Wait for the container to start (check logs for "Server running on port 3000")
3. Access the UI at: `http://YOUR_UNRAID_IP:3000`

---

## Network Configuration

### Host Network Mode (Default - Recommended)

The container uses `network_mode: host` which:
- Allows UDP broadcast for X32 auto-discovery
- Uses the host's network stack directly
- Port 3000 is exposed on all Unraid interfaces

### Bridge Network Mode (Alternative)

If you have a fixed X32 IP and don't need auto-discovery:

```yaml
services:
  x32-scene-manager:
    # Remove: network_mode: host
    ports:
      - "3000:3000"
    environment:
      - X32_IP=192.168.1.96  # REQUIRED: Set your X32's IP
```

**Note**: Bridge mode requires manually setting `X32_IP` as UDP broadcast discovery won't work.

---

## Volume Mounts

### Recommended Paths

| Container Path | Unraid Path | Purpose |
|---------------|-------------|---------|
| `/app/scenes` | `/mnt/user/appdata/x32-scene-manager/scenes` | Scene file storage |
| `/app/backups` | `/mnt/user/appdata/x32-scene-manager/backups` | Full X32 backup files |

### Backup to USB

To save backups directly to a USB drive mounted in Unraid:

```yaml
volumes:
  - /mnt/disks/USB_DRIVE_NAME/X32_Backups:/app/backups
```

---

## Finding Your X32

### Auto-Discovery

With `network_mode: host`, the app automatically discovers X32 mixers on your network.

1. Open the web UI at `http://YOUR_UNRAID_IP:3000`
2. Click "Discover X32" button
3. Select your mixer from the list

### Manual Configuration

If auto-discovery doesn't work:

1. Find your X32's IP on the mixer: **Setup** → **Network**
2. Set `X32_IP` environment variable to this IP
3. Restart the container

### From Unraid Terminal

```bash
# Scan for X32 on typical home network
docker exec x32-scene-manager node scripts/discover-x32.mjs --subnet 192.168.1
```

---

## Troubleshooting

### Container Won't Start

1. Check logs: **Docker** → **x32-scene-manager** → **Logs**
2. Verify port 3000 isn't in use: `netstat -tlnp | grep 3000`
3. Ensure appdata directories exist with proper permissions

### Can't Discover X32

1. Verify X32 is on same subnet as Unraid
2. Check X32 network settings: **Setup** → **Network** → IP Config
3. Try setting `X32_IP` manually

### Connection Timeout

1. Verify X32 is powered on and connected to network
2. Check firewall isn't blocking UDP port 10023
3. Try pinging X32 from Unraid: `ping 192.168.1.96`

### Scenes Not Saving

1. Check volume mount permissions
2. Verify appdata directory exists: `ls -la /mnt/user/appdata/x32-scene-manager/`
3. Check container logs for write errors

---

## Updating

### Pre-built Image

```bash
# In Unraid terminal
docker pull ghcr.io/YOUR_USERNAME/x32-scene-manager:latest
docker compose -f /boot/config/plugins/compose.manager/projects/x32-scene-manager/compose.yaml up -d
```

Or use Docker Compose Manager UI: **Compose Down** → **Compose Pull** → **Compose Up**

### Building from Source

```bash
cd /mnt/user/appdata/x32-scene-manager/source
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Security Notes

- The container runs as non-root user (UID 1001)
- Health check endpoint is read-only
- No authentication built-in - use Unraid's reverse proxy (SWAG/Nginx Proxy Manager) for external access
- Scene operations are read-only by default in the UI

---

## Support

- **GitHub Issues**: [Report bugs or request features]
- **X32 Manual**: Refer to Behringer X32 documentation for mixer-specific questions
