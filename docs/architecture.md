# Architecture Documentation

## X32 Scene Manager - System Architecture

**Version:** 1.0.0
**Last Updated:** 2025-12-07
**Status:** Production Ready

---

## Overview

X32 Scene Manager is a full-stack web application for managing Behringer X32 mixer scenes. The system enables real-time scene management, local backups, and WebSocket-based live updates, with development support through a mock X32 simulator.

**Key Capabilities:**
- Load/save mixer scenes to X32 internal memory (100 slots)
- Create local .scn file backups for scene preservation
- Real-time connection status via WebSocket
- Mock mode for development without hardware
- Docker deployment for Unraid/homelab environments

---

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Browser"
        UI[React UI<br/>Vite + TailwindCSS]
        WSClient[WebSocket Client]
    end

    subgraph "Express Server :3000"
        API[REST API<br/>Scene Management]
        WSServer[WebSocket Server<br/>Live Updates]
        Storage[File Manager<br/>Scene Storage]
        X32Conn[X32 Connection<br/>OSC Protocol]
    end

    subgraph "External"
        X32[X32 Mixer<br/>UDP :10023]
        MockX32[Mock X32 Simulator<br/>Development Mode]
        Files[Scene Files<br/>.scn format]
    end

    UI -->|HTTP GET/POST| API
    UI <-->|WebSocket| WSServer
    API --> Storage
    API --> X32Conn
    WSServer --> X32Conn
    Storage --> Files
    X32Conn -->|OSC Messages<br/>UDP| X32
    X32Conn -.->|Mock Mode| MockX32

    style UI fill:#4F46E5,color:#fff
    style API fill:#10B981,color:#fff
    style X32Conn fill:#F59E0B,color:#fff
    style X32 fill:#EF4444,color:#fff
```

---

## Component Architecture

### Frontend Components (React 19)

```mermaid
graph TB
    App[App.tsx<br/>Main Container]

    subgraph "Custom Hooks"
        useScenes[useScenes<br/>Scene State & API]
        useToast[useToast<br/>Notifications]
    end

    subgraph "UI Components"
        SceneList[SceneList<br/>Grid Display]
        SceneCard[SceneCard<br/>Individual Scene]
        ConnectionStatus[ConnectionStatus<br/>X32 Status Badge]
        SaveModal[SaveSceneModal]
        CreateModal[CreateSceneModal]
        ConfirmModal[ConfirmModal]
        Toast[Toast<br/>Notifications]
    end

    App --> useScenes
    App --> useToast
    App --> SceneList
    App --> ConnectionStatus
    App --> SaveModal
    App --> CreateModal
    App --> ConfirmModal
    App --> Toast

    SceneList --> SceneCard

    useScenes -->|API Calls| Backend[Backend API]

    style App fill:#4F46E5,color:#fff
    style useScenes fill:#8B5CF6,color:#fff
```

**Component Hierarchy:**
```
App (Root)
├── ConnectionStatus (Header)
├── SceneList
│   └── SceneCard[] (Multiple)
├── SaveSceneModal
├── CreateSceneModal
├── ConfirmModal (Load/Delete)
└── ToastContainer
    └── Toast[] (Multiple)
```

---

### Backend Services (Express 5 + Node.js 20)

```mermaid
graph TB
    subgraph "HTTP Layer"
        Express[Express Server]
        CORS[CORS Middleware]
        Static[Static File Server<br/>Serves React Build]
    end

    subgraph "API Routes"
        ScenesAPI[Scenes API<br/>/api/scenes]
        HealthAPI[Health Check<br/>/api/health]
        X32API[X32 Info<br/>/api/x32/info]
    end

    subgraph "WebSocket Layer"
        WSHandler[WebSocket Handler<br/>/ws endpoint]
    end

    subgraph "Business Logic"
        StorageMgr[Scene Storage Manager<br/>Merges X32 + Local]
        FileMgr[Scene File Manager<br/>File I/O Operations]
    end

    subgraph "X32 Communication"
        X32Connection[X32 Connection<br/>OSC Client]
        MockX32[Mock X32<br/>Simulator]
        OSCUtils[OSC Utilities<br/>Message Parsing]
    end

    Express --> CORS
    Express --> Static
    Express --> ScenesAPI
    Express --> HealthAPI
    Express --> X32API
    Express --> WSHandler

    ScenesAPI --> StorageMgr
    HealthAPI --> X32Connection
    X32API --> X32Connection
    WSHandler --> X32Connection

    StorageMgr --> FileMgr
    StorageMgr --> X32Connection

    X32Connection --> OSCUtils
    X32Connection -.->|Mock Mode| MockX32
    X32Connection -->|UDP OSC| HardwareX32[X32 Hardware]

    style Express fill:#10B981,color:#fff
    style X32Connection fill:#F59E0B,color:#fff
    style MockX32 fill:#6366F1,color:#fff
```

---

## Data Flow

### Scene Loading Flow

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Express API
    participant Storage as Storage Manager
    participant X32 as X32 Connection
    participant WS as WebSocket
    participant Mixer as X32 Mixer

    UI->>UI: User clicks "Load Scene"
    UI->>UI: Show confirmation modal
    UI->>API: POST /api/scenes/:id/load

    API->>Storage: loadScene(sceneId)
    Storage->>Storage: Parse scene ID<br/>(x32-N or local-N)

    alt X32 Scene
        Storage->>X32: loadScene(index)
        X32->>Mixer: OSC: /-show/prepos/current
        Mixer-->>X32: ACK
        X32-->>Storage: Success
    else Local Scene
        Storage->>Storage: Future: Upload to X32<br/>(Not yet implemented)
    end

    Storage-->>API: Success/Failure
    API-->>UI: HTTP 200 OK

    X32->>WS: emit('sceneLoaded', index)
    WS->>UI: WebSocket: scene_loaded event
    UI->>UI: Update current scene indicator
```

### Scene Backup Flow

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Express API
    participant Storage as Storage Manager
    participant FileManager as File Manager
    participant FS as File System

    UI->>UI: User clicks "Save Scene"
    UI->>UI: Enter name & notes
    UI->>API: POST /api/scenes<br/>{name, notes}

    API->>Storage: saveScene(name, notes)
    Storage->>FileManager: generateTemplate(name, notes)
    FileManager->>FileManager: Create .scn content

    FileManager->>FS: writeFile(name.scn, content)
    FS-->>FileManager: Success

    FileManager-->>Storage: Success
    Storage-->>API: Return new scene metadata
    API-->>UI: HTTP 201 Created

    UI->>UI: Show success toast
    UI->>API: GET /api/scenes (refresh)
```

### WebSocket Connection Flow

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant WS as WebSocket Server
    participant X32 as X32 Connection

    Browser->>WS: Connect to ws://server:3000/ws
    WS->>Browser: Send current connection status

    loop Every 9 seconds
        X32->>X32: Send /xremote keep-alive
    end

    X32->>X32: Connection state change
    X32->>WS: emit('stateChange', status)
    WS->>Browser: Broadcast connection_status
    Browser->>Browser: Update UI badge

    X32->>X32: Scene loaded
    X32->>WS: emit('sceneLoaded', index)
    WS->>Browser: Broadcast scene_loaded
    Browser->>Browser: Update active scene
```

---

## File Structure

```
x32-ui/
├── src/                          # Frontend source (React + TypeScript)
│   ├── main.tsx                  # Application entry point
│   ├── App.tsx                   # Root component
│   ├── components/               # React components
│   │   ├── ConnectionStatus.tsx  # X32 connection badge
│   │   ├── SceneList.tsx         # Scene grid container
│   │   ├── SceneCard.tsx         # Individual scene card
│   │   ├── SaveSceneModal.tsx    # Save scene dialog
│   │   ├── CreateSceneModal.tsx  # Create scene dialog
│   │   ├── ConfirmModal.tsx      # Generic confirmation
│   │   ├── Modal.tsx             # Base modal component
│   │   └── Toast.tsx             # Notification system
│   ├── hooks/                    # Custom React hooks
│   │   └── useScenes.ts          # Scene management logic
│   ├── types/                    # TypeScript type definitions
│   │   └── scene.ts              # Scene & API types
│   └── styles/                   # Styling
│       └── globals.css           # Tailwind base styles
│
├── server/                       # Backend source (Express + TypeScript)
│   ├── index.ts                  # Server entry point
│   ├── api/                      # REST API routes
│   │   └── scenes.ts             # Scene CRUD endpoints
│   ├── websocket/                # WebSocket layer
│   │   └── handler.ts            # WS connection manager
│   ├── x32/                      # X32 communication
│   │   ├── connection.ts         # OSC client connection
│   │   ├── mock-x32.ts           # Development simulator
│   │   ├── osc-utils.ts          # OSC message helpers
│   │   ├── scene-parser.ts       # .scn file parser
│   │   └── types.ts              # X32 type definitions
│   ├── storage/                  # File storage
│   │   └── file-manager.ts       # Scene storage manager
│   └── types/                    # Type definitions
│       └── osc.d.ts              # OSC library types
│
├── dist/                         # Frontend build output (Vite)
├── dist-server/                  # Backend build output (tsc)
├── scenes/                       # Scene file storage (.scn files)
├── docs/                         # Documentation
│   ├── architecture.md           # This file
│   ├── tech-stack.md             # Technology decisions
│   ├── api-spec.yaml             # OpenAPI specification
│   └── db-schema.sql             # Data schema documentation
│
├── docker-compose.yml            # Docker orchestration
├── Dockerfile                    # Multi-stage build
├── package.json                  # Dependencies & scripts
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript (frontend)
└── server/tsconfig.json          # TypeScript (backend)
```

---

## State Management Strategy

### Frontend State Architecture

**React 19 with Built-in Hooks (No Redux)**

The application uses a lightweight state management approach:

1. **Local Component State** (`useState`)
   - Modal visibility
   - Form inputs
   - UI interactions (loading, errors)

2. **Custom Hooks** (`useScenes`, `useToast`)
   - Encapsulate business logic
   - Manage API communication
   - Handle WebSocket subscriptions
   - Provide clean interface to components

3. **No Global State Library Needed**
   - Small application scope
   - Most state is server-driven
   - React 19's concurrent features handle updates efficiently

**State Flow:**
```
Server (Source of Truth)
    ↓
useScenes Hook (API Layer)
    ↓
App Component (State Distribution)
    ↓
Child Components (Consumption)
```

### Backend State Management

**Singleton Pattern for Shared Resources:**

1. **X32 Connection** (`x32Connection`)
   - Single OSC UDP connection
   - Event emitter for state changes
   - Shared across all requests

2. **WebSocket Handler** (`wsHandler`)
   - Single WebSocket server instance
   - Client connection pool
   - Broadcast capabilities

3. **Scene Storage Manager**
   - Per-request instances
   - Factory function pattern
   - Stateless operations

**Why Singletons?**
- OSC protocol requires single UDP port
- WebSocket server is inherently singular
- Prevents connection pool exhaustion
- Simplified event subscription model

---

## Key Design Decisions

### 1. Monolithic Architecture

**Decision:** Single Express server serves both frontend and API.

**Rationale:**
- Simpler deployment (single Docker container)
- No CORS complexity in production
- Reduced infrastructure overhead
- Sufficient for expected scale (single X32 mixer)

**Trade-off:**
- Frontend and backend scale together (acceptable for use case)

### 2. Mock Mode for Development

**Decision:** Built-in X32 simulator for development without hardware.

**Rationale:**
- Enables rapid development without mixer access
- Facilitates testing and CI/CD
- Reduces hardware dependency for contributors
- Same codebase for mock and real modes

**Implementation:**
- Toggle via `MOCK_MODE` environment variable
- Mock responds to all OSC commands
- Simulates realistic latency and responses

### 3. Hybrid Scene Storage (X32 + Local)

**Decision:** Merge X32 internal scenes with local .scn file backups.

**Rationale:**
- X32 internal memory is volatile (lost on factory reset)
- Local backups provide disaster recovery
- Allows scene management when mixer is offline
- Users can archive unlimited scenes locally

**Data Model:**
- `source: 'x32'` - Only in mixer memory
- `source: 'local'` - Only on disk
- `source: 'both'` - Synchronized copy

### 4. WebSocket for Live Updates

**Decision:** WebSocket alongside REST API.

**Rationale:**
- Real-time connection status updates
- Notify all clients when scenes change
- Better UX than polling
- Minimal overhead (single connection per client)

**Why Not SSE?**
- WebSocket provides bidirectional communication
- Better browser support in modern environments
- More flexible for future features (remote control)

### 5. File-Based Scene Storage (Not Database)

**Decision:** Store scenes as .scn files instead of SQL/NoSQL database.

**Rationale:**
- .scn is X32's native format
- Direct compatibility with X32 Edit software
- Easy manual backup/transfer (just copy files)
- No database deployment complexity
- Sufficient performance for expected scale (<1000 scenes)

**Trade-off:**
- No advanced querying (acceptable - simple list operations)
- File locking considerations (mitigated by low concurrency)

---

## Security Considerations

### Network Security

1. **No Authentication** (Current Design)
   - Assumes trusted local network
   - X32 protocol has no auth
   - Typical deployment: homelab/church LAN

2. **Future Enhancement: Basic Auth**
   - Planned for internet-exposed deployments
   - Environment variable for password
   - JWT tokens for API access

### Input Validation

1. **Scene Names**
   - Sanitized to prevent directory traversal
   - Max length enforcement
   - Invalid character filtering

2. **API Request Validation**
   - Type checking via TypeScript
   - Required field validation
   - Error handling for malformed requests

### Docker Security

1. **Non-Root User**
   - Runs as `nodejs` user (UID 1001)
   - Minimal privileges

2. **Multi-Stage Build**
   - Production image excludes dev dependencies
   - Smaller attack surface

---

## Scalability & Performance

### Expected Scale
- **Concurrent Users:** 1-5 (typical church/venue)
- **Scene Count:** 50-200
- **Request Rate:** <10 req/min (manual operations)

### Performance Characteristics

| Operation | Expected Latency | Notes |
|-----------|-----------------|-------|
| Load Scene List | <200ms | File I/O + OSC queries |
| Load Scene to X32 | <500ms | OSC round-trip |
| Save Scene to Disk | <100ms | File write operation |
| WebSocket Message | <50ms | In-memory broadcast |

### Bottlenecks

1. **X32 OSC Communication**
   - Serial OSC messages (not parallel)
   - 5-second timeout per request
   - Mitigated by mock mode for bulk testing

2. **File System I/O**
   - Not a concern at expected scale
   - Linux file cache handles reads
   - Async I/O prevents blocking

---

## Error Handling Strategy

### Frontend Error Handling

1. **User-Facing Errors**
   - Toast notifications for all operations
   - Clear, actionable error messages
   - Automatic dismissal after 5 seconds

2. **Network Errors**
   - Retry logic for transient failures
   - Connection status indicator
   - Graceful degradation (show cached scenes)

### Backend Error Handling

1. **API Error Responses**
   ```typescript
   {
     success: false,
     error: "Human-readable message"
   }
   ```

2. **Logging Strategy**
   - Console logging for development
   - Structured logs for production (JSON)
   - Error stack traces in development mode

3. **Graceful Degradation**
   - X32 connection failure → Continue with local scenes
   - File system errors → Return empty list
   - WebSocket disconnect → Auto-reconnect

---

## Deployment Architecture

### Docker Deployment

```mermaid
graph TB
    subgraph "Docker Container"
        Node[Node.js 20 Alpine]
        Express[Express Server :3000]
        React[React Static Files]
        Scenes[Scene Volume<br/>/app/scenes]
    end

    subgraph "Host Network"
        Port3000[Port 3000]
        UDP[UDP :10023]
    end

    subgraph "External"
        Browser[Browser]
        X32[X32 Mixer]
    end

    Express --> React
    Express --> Scenes
    Browser -->|HTTP/WS| Port3000
    Port3000 --> Express
    Express -->|OSC| UDP
    UDP --> X32

    style Node fill:#10B981,color:#fff
    style Scenes fill:#F59E0B,color:#fff
```

**Network Mode:** `host` (required for UDP broadcast discovery)
**Persistent Volume:** `x32-scenes:/app/scenes`
**Health Check:** `wget http://localhost:3000/api/health`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `X32_IP` | `192.168.0.64` | X32 IP address |
| `X32_PORT` | `10023` | X32 OSC port |
| `MOCK_MODE` | `false` | Enable mock X32 |
| `SCENE_DIR` | `/app/scenes` | Scene file directory |

---

## Future Architecture Considerations

### Planned Enhancements

1. **Full Scene Capture**
   - Currently: Template placeholder
   - Future: Capture complete X32 state via OSC queries
   - Requires 2000+ OSC commands per scene

2. **Scene Upload (Local → X32)**
   - Currently: One-way sync (X32 → Local)
   - Future: Upload .scn files to X32 memory
   - Requires parsing and sending all OSC parameters

3. **Multi-User Collaboration**
   - WebSocket scene lock mechanism
   - User presence indicators
   - Conflict resolution for simultaneous edits

4. **Scene Versioning**
   - Git-like version history for scenes
   - Diff viewer for changes
   - Rollback capabilities

5. **Cloud Backup Integration**
   - S3-compatible storage sync
   - Automatic backups on schedule
   - Disaster recovery workflow

---

## Technology Constraints

### X32 OSC Protocol Limitations

1. **No Transaction Support**
   - Cannot atomically load multiple parameters
   - Scene loads are "all or nothing" at X32 level

2. **No Scene Upload API**
   - X32 doesn't expose a "load scene from OSC" command
   - Must send individual parameter updates
   - Time-consuming for full scene restore

3. **Keep-Alive Requirement**
   - Must send `/xremote` every 10 seconds
   - Connection dies if missed
   - Handled automatically by connection manager

### Browser Compatibility

- **Target:** Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- **React 19 Features:** Used (Concurrent Mode, Automatic Batching)
- **WebSocket:** Universally supported in target browsers

---

## Maintenance & Monitoring

### Health Monitoring

**Endpoint:** `GET /api/health`

Response:
```json
{
  "status": "ok",
  "x32Connection": "connected",
  "mockMode": false,
  "timestamp": "2025-12-07T10:30:00Z"
}
```

### Logging Points

1. **Server Startup**
   - Configuration summary
   - X32 connection status
   - Listening address

2. **X32 Operations**
   - All OSC messages (debug level)
   - Connection state changes
   - Scene load/save operations

3. **API Requests**
   - Endpoint access (info level)
   - Error responses (error level)

---

## Conclusion

The X32 Scene Manager architecture prioritizes simplicity and reliability for small-scale deployments. The monolithic design reduces operational complexity while maintaining clear separation of concerns through modular code organization.

Key strengths:
- Production-ready Docker deployment
- Mock mode enables efficient development
- WebSocket provides responsive UX
- File-based storage ensures compatibility

The architecture supports the current use case effectively while providing clear paths for future enhancements as requirements evolve.
