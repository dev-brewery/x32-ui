-- ==============================================================================
-- X32 Scene Manager - Data Schema Documentation
-- ==============================================================================
--
-- This application does NOT use a traditional SQL database. Instead, it uses:
--   1. File system storage for scene data (.scn files)
--   2. X32 mixer internal memory (100 scene slots)
--   3. In-memory state managed by the backend
--
-- This file documents the data structures as if they were SQL tables to provide
-- a clear understanding of the data model and relationships.
--
-- ==============================================================================

-- ==============================================================================
-- SCENE DATA STRUCTURE
-- ==============================================================================

-- Virtual table representing scenes from all sources (X32 + Local)
-- In reality, this data is aggregated from:
--   - X32 internal memory via OSC queries
--   - .scn files in the SCENE_DIR directory

CREATE TABLE IF NOT EXISTS scenes (
    -- Unique identifier for the scene
    -- Format: "x32-{index}" for X32 scenes or "local-{name}" for local scenes
    id VARCHAR(255) PRIMARY KEY,

    -- Display name of the scene
    -- Max 64 characters (X32 limitation)
    name VARCHAR(64) NOT NULL,

    -- X32 scene slot index (0-99)
    -- For local-only scenes, this is auto-assigned
    index INTEGER NOT NULL CHECK (index >= 0 AND index <= 99),

    -- Source of the scene
    -- 'x32': Only exists in X32 internal memory
    -- 'local': Only exists as .scn file on disk
    -- 'both': Exists in both X32 and local storage
    source VARCHAR(10) NOT NULL CHECK (source IN ('x32', 'local', 'both')),

    -- Last modification timestamp
    -- For X32 scenes: Current timestamp (no modification tracking)
    -- For local scenes: File modification time from filesystem
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Whether a local .scn backup file exists
    has_local_backup BOOLEAN NOT NULL DEFAULT FALSE,

    -- Optional notes about the scene
    -- Max 512 characters
    notes TEXT,

    -- Ensure unique names within X32 scenes
    CONSTRAINT unique_x32_name UNIQUE (name) WHERE source IN ('x32', 'both'),

    -- Index uniqueness constraint for X32 scenes
    CONSTRAINT unique_x32_index UNIQUE (index) WHERE source IN ('x32', 'both')
);

-- Indexes for common queries
CREATE INDEX idx_scenes_source ON scenes(source);
CREATE INDEX idx_scenes_last_modified ON scenes(last_modified DESC);
CREATE INDEX idx_scenes_name ON scenes(name);

-- Comments
COMMENT ON TABLE scenes IS 'Aggregated view of all scenes from X32 and local storage';
COMMENT ON COLUMN scenes.id IS 'Unique identifier: x32-{index} or local-{name}';
COMMENT ON COLUMN scenes.source IS 'Storage location: x32, local, or both';
COMMENT ON COLUMN scenes.has_local_backup IS 'True if .scn file exists on disk';

-- ==============================================================================
-- X32 INTERNAL SCENE STRUCTURE
-- ==============================================================================

-- Virtual table representing X32's internal scene memory
-- This data is stored IN THE X32 MIXER, queried via OSC protocol
-- The X32 maintains 100 scene slots (0-99)

CREATE TABLE IF NOT EXISTS x32_scenes (
    -- Scene slot index on the X32 (0-99)
    index INTEGER PRIMARY KEY CHECK (index >= 0 AND index <= 99),

    -- Scene name stored in X32 memory
    -- Retrieved via OSC: /-show/showfile/scene/{index}/name
    name VARCHAR(64),

    -- Scene notes stored in X32 memory
    -- Retrieved via OSC: /-show/showfile/scene/{index}/notes
    notes TEXT,

    -- X32 console information (for reference)
    -- Not actually stored per-scene, but per-console
    console_ip VARCHAR(15),
    console_name VARCHAR(64),
    console_model VARCHAR(32),
    console_firmware VARCHAR(10)
);

COMMENT ON TABLE x32_scenes IS 'X32 internal scene memory (100 slots, stored in mixer)';
COMMENT ON COLUMN x32_scenes.index IS 'Scene slot on X32 (0-99)';

-- ==============================================================================
-- LOCAL SCENE FILE FORMAT (.scn)
-- ==============================================================================

-- Scene files are stored as plain text .scn files in the SCENE_DIR directory
-- File naming: {scene_name}.scn (sanitized for filesystem safety)
-- File format: ASCII text with OSC address/value pairs

/*
Example .scn file structure:

    #4.06# "Sunday Worship"
    # X32 Scene File
    # Generated: 2025-12-07T10:30:00Z
    # Notes: Standard Sunday morning configuration

    # Channel 1 - Pastor Mic
    /ch/01/config/name "Pastor"
    /ch/01/config/color 1
    /ch/01/mix/fader 0.75
    /ch/01/eq/1/f 120.0
    /ch/01/eq/1/g 2.5

    # Main mix settings
    /main/st/mix/fader 0.85

    # Effects settings
    /fx/1/type "HALL"
    /fx/1/par/1 2.5

    # ... (typically 2000-3000 lines total)

    # End of scene file
*/

-- Virtual representation of .scn file metadata
CREATE TABLE IF NOT EXISTS scene_files (
    -- File name without extension
    name VARCHAR(255) PRIMARY KEY,

    -- Full file path on disk
    -- Example: /app/scenes/Sunday_Worship.scn
    file_path VARCHAR(512) NOT NULL,

    -- File size in bytes
    file_size INTEGER NOT NULL,

    -- Last modification time from filesystem
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Parsed scene name from file header
    parsed_name VARCHAR(64),

    -- Parsed notes from file content
    parsed_notes TEXT,

    -- Number of lines in the file
    line_count INTEGER,

    -- File checksum (for integrity verification)
    -- Not currently implemented
    checksum VARCHAR(64)
);

CREATE INDEX idx_scene_files_last_modified ON scene_files(last_modified DESC);

COMMENT ON TABLE scene_files IS 'Metadata for .scn files stored on disk';
COMMENT ON COLUMN scene_files.file_path IS 'Absolute path: {SCENE_DIR}/{name}.scn';

-- ==============================================================================
-- X32 CONNECTION STATE
-- ==============================================================================

-- Virtual table representing the X32 connection state
-- This is maintained in-memory by the backend (not persisted)

CREATE TABLE IF NOT EXISTS x32_connection (
    -- Singleton row (only one connection at a time)
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

    -- Connection state
    -- 'connected': Successfully connected to X32
    -- 'disconnected': Not connected
    -- 'connecting': Connection in progress
    -- 'mock': Running in mock mode (no real X32)
    state VARCHAR(20) NOT NULL CHECK (state IN ('connected', 'disconnected', 'connecting', 'mock')),

    -- X32 IP address
    ip VARCHAR(15),

    -- X32 OSC port (default: 10023)
    port INTEGER DEFAULT 10023,

    -- Local UDP port for receiving responses
    local_port INTEGER DEFAULT 10024,

    -- Whether running in mock mode
    mock_mode BOOLEAN NOT NULL DEFAULT FALSE,

    -- Last keep-alive sent timestamp
    -- X32 requires /xremote every 10 seconds
    last_keepalive TIMESTAMP WITH TIME ZONE,

    -- Connection established timestamp
    connected_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE x32_connection IS 'X32 OSC connection state (in-memory only)';
COMMENT ON COLUMN x32_connection.state IS 'Current connection status';

-- ==============================================================================
-- WEBSOCKET CLIENTS
-- ==============================================================================

-- Virtual table representing connected WebSocket clients
-- This is maintained in-memory by the WebSocket handler

CREATE TABLE IF NOT EXISTS websocket_clients (
    -- Unique client ID (auto-generated)
    client_id VARCHAR(64) PRIMARY KEY,

    -- WebSocket connection object (not serializable)
    -- This is a reference to the ws.WebSocket instance
    connection_ref TEXT NOT NULL,

    -- Client IP address
    ip_address VARCHAR(45),

    -- Client user agent
    user_agent TEXT,

    -- Connection established timestamp
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Last activity timestamp
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE websocket_clients IS 'Active WebSocket connections (in-memory only)';

-- ==============================================================================
-- WEBSOCKET MESSAGE TYPES
-- ==============================================================================

-- Not stored, but documented for reference
-- WebSocket messages follow this structure:

/*
{
    "type": "connection_status" | "scene_loaded" | "scene_list_updated" | "error" | "ping" | "pong",
    "payload": {
        // Type-specific payload
    },
    "timestamp": "2025-12-07T10:30:00Z"
}

Message types:

1. connection_status (server → client)
   Payload: { status: "connected" | "disconnected" | "connecting" | "mock", isMockMode: boolean }

2. scene_loaded (server → client)
   Payload: { sceneIndex: number }

3. scene_list_updated (server → client)
   Payload: null

4. error (server → client)
   Payload: { message: string }

5. ping (client → server)
   Payload: null

6. pong (server → client)
   Payload: null

7. get_status (client → server)
   Payload: null
*/

-- ==============================================================================
-- FILE SYSTEM DIRECTORY STRUCTURE
-- ==============================================================================

/*
Scene Directory Structure:

/app/scenes/                          -- SCENE_DIR environment variable
├── Sunday_Worship.scn                -- Scene file
├── Youth_Night.scn                   -- Scene file
├── Wednesday_Bible_Study.scn         -- Scene file
├── Band_Practice.scn                 -- Scene file
└── Christmas_Eve_Service.scn         -- Scene file

File Naming Rules:
- Invalid characters replaced with underscore: < > : " / \ | ? *
- Trailing dots removed
- Max filename length: 255 characters (OS limitation)
- Extension: .scn (Behringer X32 scene file format)

Backup Strategy:
- No automatic versioning (yet)
- Manual backup: Copy /app/scenes to backup location
- Docker volume: x32-scenes:/app/scenes (persistent)
*/

-- ==============================================================================
-- MOCK X32 SIMULATOR DATA
-- ==============================================================================

-- Mock X32 maintains in-memory scene data for development
-- This data only exists when MOCK_MODE=true

CREATE TABLE IF NOT EXISTS mock_x32_scenes (
    index INTEGER PRIMARY KEY CHECK (index >= 0 AND index <= 99),
    name VARCHAR(64) NOT NULL,
    notes TEXT
);

-- Default mock data (hardcoded in server/x32/mock-x32.ts)
INSERT INTO mock_x32_scenes (index, name, notes) VALUES
    (0, 'Sunday Worship', 'Standard Sunday morning configuration'),
    (1, 'Youth Night', 'Louder mix, more bass for youth events'),
    (2, 'Wednesday Bible Study', 'Simple setup - pastor mic + ambient'),
    (3, 'Band Practice', ''),
    (4, 'Christmas Eve Service', 'Special holiday configuration with orchestra'),
    (5, 'Guest Speaker', 'Minimal setup for visiting speakers');

COMMENT ON TABLE mock_x32_scenes IS 'Mock X32 simulator data (development only)';

-- ==============================================================================
-- DATA FLOW DOCUMENTATION
-- ==============================================================================

/*
Scene List Retrieval Flow:

1. API Request: GET /api/scenes
2. Backend calls: SceneStorageManager.getAllScenes()
3. Parallel queries:
   a. X32 OSC queries:
      - For each slot 0-99:
        - GET /-show/showfile/scene/{index}/name
        - GET /-show/showfile/scene/{index}/notes
      - Filter out empty slots
   b. File system scan:
      - List .scn files in SCENE_DIR
      - Read file metadata (size, mtime)
4. Merge results:
   - Match X32 scenes with local files by name
   - Set source to 'both' if match found
   - Add X32-only scenes with source='x32'
   - Add local-only scenes with source='local'
5. Return unified scene list

Scene Save Flow:

1. API Request: POST /api/scenes { name, notes }
2. Backend calls: SceneStorageManager.saveScene(name, notes)
3. Generate .scn file content:
   - Create file header with name and notes
   - Add template content (placeholder for full X32 state)
4. Write file: {SCENE_DIR}/{name}.scn
5. Return scene metadata

Scene Load Flow:

1. API Request: POST /api/scenes/{id}/load
2. Parse scene ID:
   - x32-{index} → Load from X32 slot
   - local-{name} → Future: Upload to X32 (not implemented)
3. Send OSC message:
   - Address: /-show/prepos/current
   - Args: [{ type: 'i', value: index }]
4. X32 loads the scene
5. WebSocket broadcast: { type: 'scene_loaded', payload: { sceneIndex } }
*/

-- ==============================================================================
-- CONSTRAINTS AND VALIDATIONS
-- ==============================================================================

-- Scene Name Validation Rules:
--   - Required (NOT NULL)
--   - Min length: 1 character
--   - Max length: 64 characters (X32 limitation)
--   - Allowed characters: A-Z, a-z, 0-9, space, hyphen, underscore
--   - Sanitized for filesystem safety when saving .scn files

-- Scene Index Validation Rules:
--   - Integer from 0 to 99 (X32 has 100 scene slots)
--   - X32 scenes must have unique index
--   - Local scenes get auto-assigned index for display purposes

-- Scene Notes Validation Rules:
--   - Optional (NULL allowed)
--   - Max length: 512 characters
--   - Stored in both .scn file and X32 memory

-- File Path Validation Rules:
--   - Must be within SCENE_DIR (prevent directory traversal)
--   - Sanitized filename (invalid characters removed)
--   - .scn extension enforced

-- ==============================================================================
-- PERFORMANCE CONSIDERATIONS
-- ==============================================================================

/*
Expected Data Volumes:

- Scenes: 50-200 total
  - X32 slots: 0-100 (typically 10-30 used)
  - Local files: 20-150 .scn files
- WebSocket clients: 1-5 concurrent
- Scene file size: 50-200 KB per file
- Total storage: 5-20 MB

Query Performance:

Operation                    Latency     Bottleneck
-------------------------------------------------
List all scenes              100-200ms   X32 OSC queries (serial)
Load scene from X32          300-500ms   Network + X32 processing
Save scene to disk           50-100ms    File I/O
Read scene file              10-50ms     File I/O
WebSocket broadcast          5-15ms      In-memory operation

Optimization Strategies:

1. Caching: Not implemented yet
   - Future: Cache X32 scene list for 30 seconds
   - Invalidate on scene_loaded event

2. Parallel OSC Queries: Not implemented yet
   - Current: Serial queries (100 slots × 2 queries = 200 requests)
   - Future: Batch queries or query only known slots

3. File System Caching:
   - OS-level caching handles read performance
   - No application-level caching needed at current scale

4. Database Not Needed:
   - File system is sufficient for <1000 scenes
   - Simple list operations don't require SQL
   - .scn format is X32's native format
*/

-- ==============================================================================
-- MIGRATION NOTES
-- ==============================================================================

/*
If migrating to a traditional SQL database in the future:

Reasons to Migrate:
- Scene count exceeds 1000
- Need complex search/filtering
- Want full-text search on notes
- Multi-user concurrent editing
- Audit logging requirements
- Version history tracking

Recommended Database: PostgreSQL with JSONB

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    index INTEGER,
    source VARCHAR(10) NOT NULL,
    content JSONB,  -- Store .scn content as structured data
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(64),
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_scenes_content ON scenes USING GIN (content);
CREATE INDEX idx_scenes_notes ON scenes USING GIN (to_tsvector('english', notes));

Benefits:
- JSONB for efficient scene content storage and querying
- Full-text search on notes
- ACID transactions
- Built-in version tracking
- User attribution

Trade-offs:
- Added complexity (need to run PostgreSQL)
- Less portable (database dump needed for backup)
- .scn files would need to be imported/exported
*/

-- ==============================================================================
-- BACKUP AND RECOVERY
-- ==============================================================================

/*
Current Backup Strategy:

1. Docker Volume Backup:
   docker run --rm -v x32-scenes:/data -v $(pwd):/backup alpine \
     tar czf /backup/scenes-backup.tar.gz /data

2. Manual File Copy:
   cp -r /app/scenes /backup/scenes-$(date +%Y%m%d)

3. Restore:
   docker run --rm -v x32-scenes:/data -v $(pwd):/backup alpine \
     tar xzf /backup/scenes-backup.tar.gz -C /

Recovery Scenarios:

1. X32 Factory Reset:
   - All 100 scene slots are erased
   - Local .scn backups are preserved
   - Future: Bulk upload local scenes to X32

2. Container Deletion:
   - Scenes volume persists
   - Data is preserved

3. Volume Deletion:
   - All local scenes lost
   - Must restore from backup

4. File Corruption:
   - Individual .scn files may be corrupted
   - Delete corrupted file and re-save from X32
*/

-- ==============================================================================
-- FUTURE ENHANCEMENTS
-- ==============================================================================

/*
Planned Features:

1. Scene Versioning:
   - Git-like version history
   - Store diffs instead of full scenes
   - Rollback to previous versions

2. Scene Tags/Categories:
   - Organize scenes by type (worship, concert, practice)
   - Multi-tag support

3. Scene Comparison:
   - Diff two scenes to see parameter changes
   - Visual diff viewer in UI

4. Scheduled Scene Loading:
   - Cron-like schedule for auto-loading scenes
   - Useful for automated events

5. Cloud Backup:
   - S3-compatible storage integration
   - Automatic daily backups
   - Cross-site disaster recovery

Data Model Changes Required:

CREATE TABLE scene_versions (
    id UUID PRIMARY KEY,
    scene_id UUID REFERENCES scenes(id),
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(64),
    UNIQUE (scene_id, version_number)
);

CREATE TABLE scene_tags (
    id UUID PRIMARY KEY,
    name VARCHAR(32) NOT NULL UNIQUE
);

CREATE TABLE scene_tag_mapping (
    scene_id UUID REFERENCES scenes(id),
    tag_id UUID REFERENCES scene_tags(id),
    PRIMARY KEY (scene_id, tag_id)
);
*/

-- ==============================================================================
-- END OF SCHEMA DOCUMENTATION
-- ==============================================================================
