# Requirements Specification

## Project Overview

The X32 Scene Manager is a React-based web application designed to provide a simplified interface for managing scenes on a Behringer X32 digital mixer. This application is specifically targeted at volunteer training environments where users need to quickly load, save, and manage mixer scenes without access to the full complexity of mixing controls.

**Version**: 1.0.0 (MVP - Mock Mode Only)
**Target Environment**: Docker container on Unraid server
**Primary User**: Volunteers and non-technical operators

---

## 1. Functional Requirements

### FR-1: Scene List Display

**Priority**: MUST HAVE
**User Story**: As a user, I want to view all available scenes in a clear list so that I can see what presets are available.

**Acceptance Criteria**:
- Display all scenes stored in the system
- Show scene number (1-100 as supported by X32)
- Show scene name/description
- Display last modified timestamp
- Provide visual indication of currently loaded scene
- Support responsive layout for touch devices
- Handle empty state gracefully (no scenes available)

**Dependencies**: Scene storage system, Scene retrieval API

---

### FR-2: Load Scene

**Priority**: MUST HAVE
**User Story**: As a user, I want to load a scene with a single tap/click so that I can quickly switch between mixer configurations.

**Acceptance Criteria**:
- Provide clear "Load" button/action for each scene
- Show confirmation before loading (to prevent accidental loads)
- Display loading indicator during scene application
- Update UI to reflect currently loaded scene
- Show success/error notification after load attempt
- In mock mode: simulate scene loading with 500-1000ms delay
- Disable load action for already-loaded scene

**Dependencies**: Mock X32 simulator, WebSocket connection

---

### FR-3: Save Scene

**Priority**: MUST HAVE
**User Story**: As a user, I want to save the current mixer state to a scene slot so that I can preserve configurations.

**Acceptance Criteria**:
- Allow saving to existing scene slots (overwrite)
- Allow saving to new scene slot
- Prompt for scene name/description
- Show confirmation before overwrite
- Validate scene name (max 64 characters, no special characters that could break storage)
- Display save progress indicator
- Update scene list immediately after save
- In mock mode: persist to local JSON file storage

**Dependencies**: Scene storage system, Save API endpoint

---

### FR-4: Create New Scene

**Priority**: MUST HAVE
**User Story**: As a user, I want to create a new blank scene or capture the current state so that I can build custom configurations.

**Acceptance Criteria**:
- Provide "Create New Scene" action
- Prompt for scene number (1-100) and name
- Validate scene number is not already in use
- Initialize with default X32 parameters or current state
- Add to scene list immediately
- Show success notification

**Dependencies**: Scene creation logic, Scene numbering validation

---

### FR-5: Delete Scene

**Priority**: MUST HAVE
**User Story**: As a user, I want to delete scenes I no longer need so that the list remains organized.

**Acceptance Criteria**:
- Provide delete action for each scene
- Show confirmation dialog with scene details
- Prevent deletion of currently loaded scene (optional safeguard)
- Remove from scene list immediately
- Show success notification
- Support undo action within 5 seconds (optional)

**Dependencies**: Scene deletion API, Storage management

---

### FR-6: Search and Filter Scenes

**Priority**: SHOULD HAVE
**User Story**: As a user managing many scenes, I want to search and filter the scene list so that I can quickly find specific configurations.

**Acceptance Criteria**:
- Provide search input field
- Filter scenes by name/number in real-time
- Highlight matching text in results
- Show count of filtered results
- Clear search button
- Maintain search state during session

**Dependencies**: Client-side filtering logic

---

### FR-7: Mock X32 Simulator

**Priority**: MUST HAVE
**User Story**: As a developer/trainer, I want a mock X32 simulator so that the application can be used without hardware.

**Acceptance Criteria**:
- Simulate X32 OSC protocol responses
- Maintain internal state of mixer parameters relevant to scenes
- Respond to scene load/save commands
- Simulate realistic timing delays (100-500ms for OSC responses)
- Provide debug mode to view OSC messages
- Support all scene-related OSC commands defined in X32 documentation

**Dependencies**: OSC library, X32 protocol specification

---

### FR-8: Real-time Scene Status

**Priority**: SHOULD HAVE
**User Story**: As a user, I want to see real-time updates when scenes are loaded so that I know the system is responding.

**Acceptance Criteria**:
- Use WebSocket for real-time updates
- Broadcast scene changes to all connected clients
- Update UI without page refresh
- Show connection status indicator
- Attempt automatic reconnection on disconnect
- Handle multiple simultaneous users gracefully

**Dependencies**: WebSocket server, Event broadcasting system

---

### FR-9: Scene Metadata Management

**Priority**: COULD HAVE
**User Story**: As a user, I want to add notes and tags to scenes so that I can better organize and understand their purpose.

**Acceptance Criteria**:
- Support scene notes/description (up to 500 characters)
- Support tagging (e.g., "worship", "conference", "rehearsal")
- Display metadata in scene list
- Filter by tags
- Edit metadata without reloading scene

**Dependencies**: Extended storage schema

---

### FR-10: Export/Import Scenes

**Priority**: COULD HAVE
**User Story**: As an administrator, I want to export and import scenes so that I can backup configurations or share between systems.

**Acceptance Criteria**:
- Export single scene as JSON file
- Export all scenes as ZIP archive
- Import scene from JSON file
- Validate imported scene format
- Handle version compatibility
- Show preview before import

**Dependencies**: File handling APIs, JSON validation

---

## 2. Non-Functional Requirements

### NFR-1: Performance

**Category**: Usability
**Requirement**: The application must feel responsive and quick to use, even on modest hardware.

**Metrics**:
- Initial page load: < 2 seconds on 10 Mbps connection
- Scene list display: < 500ms to render 100 scenes
- Scene load operation: < 1 second perceived time (including mock delay)
- UI interactions: < 100ms response time for button clicks
- WebSocket message latency: < 200ms from server to client

**Validation**: Performance testing with 100 scenes, network throttling simulation

---

### NFR-2: Usability - Touch-Friendly Interface

**Category**: Accessibility
**Requirement**: The UI must be optimized for touch devices (tablets, touch monitors) commonly used in AV environments.

**Specifications**:
- Minimum touch target size: 44x44 pixels (per Apple HIG/Material Design)
- Sufficient spacing between interactive elements (8px minimum)
- Support both portrait and landscape orientations
- No hover-dependent interactions
- Large, clear typography (minimum 16px body text)
- High contrast for visibility in varying lighting conditions
- Swipe gestures for common actions (optional enhancement)

**Validation**: Manual testing on iPad, Android tablet, and touch monitor

---

### NFR-3: Browser Compatibility

**Category**: Compatibility
**Requirement**: Support modern browsers commonly found in AV/church environments.

**Supported Browsers**:
- Chrome/Edge: Last 2 versions
- Safari: Last 2 versions
- Firefox: Last 2 versions
- Mobile Safari (iOS): Last 2 versions
- Chrome Mobile (Android): Last 2 versions

**Validation**: Cross-browser testing, Browserlist configuration

---

### NFR-4: Security

**Category**: Security
**Requirement**: While this is an internal tool, basic security practices must be followed.

**Requirements**:
- No authentication required (single-user/trusted network assumption)
- Input validation on all user-supplied data
- Sanitize scene names to prevent XSS
- Rate limiting on API endpoints (10 requests/second per client)
- CORS configuration for known origins only
- No sensitive data logging
- Docker container runs as non-root user

**Note**: Multi-user authentication is out of scope for MVP (Phase 2)

**Validation**: Security checklist review, input fuzzing tests

---

### NFR-5: Reliability

**Category**: Availability
**Requirement**: The application should be stable and handle errors gracefully.

**Specifications**:
- Graceful degradation when WebSocket disconnected (fallback to polling)
- Error messages are user-friendly and actionable
- Failed operations can be retried
- Application state recovers after browser refresh
- No data loss during normal operations
- Automatic storage backup every 24 hours (in Docker volume)

**Uptime Target**: 99% availability (acceptable downtime for maintenance)

**Validation**: Error injection testing, long-running stability tests

---

### NFR-6: Maintainability

**Category**: Development
**Requirement**: Code should be maintainable by developers with React/TypeScript experience.

**Specifications**:
- TypeScript strict mode enabled
- Component documentation with JSDoc
- Consistent code formatting (Prettier/ESLint if added)
- Separation of concerns (components, hooks, services)
- Unit test coverage > 70% (if testing added in future)
- API versioning for future compatibility

**Validation**: Code review checklist

---

### NFR-7: Scalability

**Category**: Performance
**Requirement**: Support reasonable scale for typical use cases.

**Limits**:
- Support up to 100 scenes (X32 hardware limit)
- Support up to 10 concurrent WebSocket connections
- Scene storage < 10MB total
- Handle 100 API requests per minute per client

**Note**: This is an internal tool for single-venue use, not multi-tenant SaaS

**Validation**: Load testing with 10 concurrent users

---

### NFR-8: Deployment

**Category**: Operations
**Requirement**: Easy deployment and operation in Docker/Unraid environment.

**Specifications**:
- Single Docker container (frontend + backend)
- Container size < 200MB
- Persistent volume for scene storage
- Environment variable configuration
- Health check endpoint for monitoring
- Graceful shutdown handling
- Container restart resilience

**Validation**: Docker deployment on Unraid, restart testing

---

### NFR-9: Documentation

**Category**: Usability
**Requirement**: Adequate documentation for users and developers.

**Deliverables**:
- User guide with screenshots (how to use UI)
- Admin guide (Docker deployment, configuration)
- API documentation (OpenAPI spec)
- Developer setup guide (local development)
- Troubleshooting guide

**Validation**: Documentation review by non-developer user

---

## 3. Constraints

### Technical Constraints

**CONSTRAINT-1: Mock Mode Only (MVP)**
- Application will NOT communicate with real X32 hardware in Phase 1
- All X32 interactions are simulated via mock server
- OSC protocol implementation is for simulation purposes only
- Real X32 integration is deferred to Phase 2

**CONSTRAINT-2: Scene-Only Focus**
- NO mixing controls (faders, EQ, effects, routing)
- NO real-time parameter changes
- NO channel/bus configuration UI
- Focus exclusively on scene management operations

**CONSTRAINT-3: Single-User Design**
- No authentication or user management
- No role-based access control
- Assumption of trusted network environment
- Multi-user collaboration features deferred to Phase 2

**CONSTRAINT-4: Technology Stack**
- Must use React for frontend (as per existing setup)
- Must use Node.js/Express for backend (as per existing setup)
- Must use TypeScript (as per existing setup)
- Must deploy as Docker container on Unraid

---

### Business Constraints

**CONSTRAINT-5: Development Resources**
- Single developer
- Development timeline: 2-4 weeks for MVP
- No dedicated QA team (developer testing only)

**CONSTRAINT-6: Budget**
- Open source project
- No commercial dependencies requiring licensing
- Use free tier services only

---

### Regulatory Constraints

**CONSTRAINT-7: Licensing**
- Project must be MIT licensed
- All dependencies must be OSI-approved licenses
- No GPL or copyleft dependencies that conflict with MIT

---

## 4. Assumptions

1. **Network Environment**: Application runs on local network with low latency (<10ms)
2. **User Expertise**: Users have basic computer/tablet literacy
3. **Hardware**: Users have access to modern touch-enabled devices (tablets, touch monitors)
4. **Browser**: Users will use modern, updated browsers
5. **Volume**: Maximum 100 scenes will be created (X32 hardware limit)
6. **Concurrent Users**: Maximum 5-10 simultaneous users
7. **Data Integrity**: Storage backend (filesystem) is reliable
8. **X32 Protocol**: Mock implementation follows X32 OSC specification accurately enough for training

---

## 5. Dependencies

### External Dependencies

1. **Behringer X32 OSC Protocol Documentation**: Required for accurate mock simulation
2. **Docker Runtime**: Required for deployment on Unraid
3. **Unraid Server**: Target deployment platform
4. **Modern Web Browsers**: Chrome, Safari, Firefox, Edge

### Internal Dependencies

1. **Mock X32 Server**: Backend service simulating X32 OSC protocol
2. **Scene Storage System**: File-based JSON storage for scene persistence
3. **WebSocket Server**: Real-time communication between clients and server
4. **API Endpoints**: RESTful API for scene CRUD operations

---

## 6. Success Criteria

The MVP will be considered successful when:

1. A volunteer user can load, save, and create scenes without assistance
2. The UI is intuitive enough to use without reading documentation
3. Scene operations feel responsive (perceived latency < 1 second)
4. Application runs stably for 8+ hours without restart
5. Scene data persists across container restarts
6. No critical bugs in core scene management workflows
7. Positive feedback from 3+ volunteer testers

---

## 7. Future Enhancements (Out of Scope for MVP)

The following features are explicitly **out of scope** for Phase 1 but documented for future consideration:

### Phase 2: Live X32 Integration
- Real OSC communication with X32 hardware
- X32 auto-discovery on network
- Parameter synchronization from hardware
- Offline mode with cache

### Phase 3: Advanced Features
- User authentication and access control
- Scene version history and diff viewer
- Scene templates library
- Advanced search with regex
- Scene scheduling/automation
- Mobile native app (React Native)

### Phase 4: Multi-Venue
- Multi-venue management
- Cloud sync between locations
- Centralized scene library
- Analytics and usage tracking

---

## Revision History

| Version | Date       | Author    | Changes                          |
|---------|------------|-----------|----------------------------------|
| 1.0     | 2025-12-07 | Architect | Initial requirements document    |
