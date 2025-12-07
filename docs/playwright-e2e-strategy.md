# Playwright E2E Testing Strategy - X32 Scene Manager

## 1. Directory Structure

```
x32-ui/
├── e2e/
│   ├── tests/
│   │   ├── critical-flows/
│   │   │   ├── scene-load.spec.ts
│   │   │   ├── scene-save.spec.ts
│   │   │   ├── scene-create.spec.ts
│   │   │   └── scene-delete.spec.ts
│   │   ├── features/
│   │   │   ├── connection-status.spec.ts
│   │   │   ├── search-filter.spec.ts
│   │   │   ├── toast-notifications.spec.ts
│   │   │   └── scene-refresh.spec.ts
│   │   ├── edge-cases/
│   │   │   ├── error-handling.spec.ts
│   │   │   ├── network-failures.spec.ts
│   │   │   └── validation.spec.ts
│   │   └── visual/
│   │       ├── layout-responsive.spec.ts
│   │       └── theme-rendering.spec.ts
│   ├── fixtures/
│   │   ├── app.fixture.ts
│   │   ├── scenes.fixture.ts
│   │   └── test-data.ts
│   ├── page-objects/
│   │   ├── base.page.ts
│   │   ├── app.page.ts
│   │   ├── scene-list.page.ts
│   │   ├── save-scene-modal.page.ts
│   │   ├── create-scene-modal.page.ts
│   │   └── confirm-modal.page.ts
│   ├── helpers/
│   │   ├── mock-server.ts
│   │   ├── test-utils.ts
│   │   └── assertions.ts
│   └── playwright.config.ts
├── .github/
│   └── workflows/
│       └── e2e-tests.yml (new)
└── package.json
```

**Rationale:**
- `e2e/` directory at root level separates E2E tests from unit tests in `src/`
- Organized by test type: critical flows, features, edge cases, visual tests
- Page objects pattern for maintainability and reusability
- Shared fixtures for consistent test setup
- Helper utilities for common operations

---

## 2. Test Categories

### 2.1 Critical User Flows (Priority: P0)
- Scene management: Load, Save, Create, Delete
- Must pass for releases
- Run on every commit

### 2.2 Feature Tests (Priority: P1)
- Individual feature functionality
- Connection status, search, notifications, refresh
- Run on every commit

### 2.3 Edge Cases & Error Handling (Priority: P2)
- Network failures, validation errors, timeouts
- API error responses
- Run on every commit but non-blocking

### 2.4 Visual Regression (Priority: P3)
- Layout and responsive design
- Component rendering
- Run on PR only, non-blocking

---

## 3. Critical User Flows

Prioritized list of 12 essential flows to test:

### 3.1 Scene Load Flow (P0 - Highest Priority)
**User Story:** As a user, I want to load a saved scene to apply mixer settings

**Test Steps:**
1. Navigate to application
2. Wait for scenes to load
3. Click "Load" button on a scene card
4. Confirm in confirmation modal
5. Verify toast notification shows success
6. Verify scene is marked as active

**Success Criteria:**
- Load confirmation modal appears
- Scene loads successfully
- Success toast appears
- Active indicator updates

### 3.2 Scene Save Flow (P0)
**User Story:** As a user, I want to save current mixer state as a new scene

**Test Steps:**
1. Click "Save" button in header
2. Enter scene name in modal
3. Optionally add notes
4. Submit form
5. Verify toast notification
6. Verify new scene appears in list

**Success Criteria:**
- Save modal opens
- Form validation works
- Scene saves successfully
- Toast notification appears
- Scene list updates

### 3.3 Scene Create Flow (P0)
**User Story:** As a user, I want to create a new blank scene or copy existing scene

**Test Steps:**
1. Click "Create" button in header
2. Enter scene name
3. Optionally select "copy from" scene
4. Optionally add notes
5. Submit form
6. Verify toast notification
7. Verify new scene appears in list

**Success Criteria:**
- Create modal opens with dropdown populated
- Can create blank scene
- Can create from existing scene
- Toast notification appears
- Scene list updates

### 3.4 Scene Delete Flow (P0)
**User Story:** As a user, I want to delete unwanted scenes

**Test Steps:**
1. Click delete icon on scene card
2. Confirm in confirmation modal
3. Verify toast notification
4. Verify scene removed from list

**Success Criteria:**
- Delete confirmation modal appears
- Scene deletes successfully
- Info toast appears
- Scene removed from UI

### 3.5 Scene Search/Filter Flow (P1)
**User Story:** As a user, I want to search for scenes by name

**Test Steps:**
1. Navigate to application with multiple scenes
2. Type in search input
3. Verify filtered results
4. Clear search
5. Verify all scenes return

**Success Criteria:**
- Search input filters scenes in real-time
- No matches shows empty state
- Clearing search restores all scenes
- Search is case-insensitive

### 3.6 Connection Status Flow (P1)
**User Story:** As a user, I want to see if the app is connected to the X32

**Test Steps:**
1. Navigate to application
2. Verify connection status indicator
3. Mock connection loss
4. Verify status updates
5. Mock reconnection
6. Verify status updates

**Success Criteria:**
- Connection status displays correctly
- Status updates on connection changes
- Visual indicator is clear

### 3.7 Refresh Scenes Flow (P1)
**User Story:** As a user, I want to manually refresh the scene list

**Test Steps:**
1. Navigate to application
2. Click refresh button
3. Verify loading state
4. Verify scenes update
5. Test that button is disabled during refresh

**Success Criteria:**
- Refresh button triggers reload
- Loading indicator appears
- Scenes list updates
- Button disabled during loading

### 3.8 Form Validation Flow (P1)
**User Story:** As a user, I should receive validation errors for invalid input

**Test Steps:**
1. Open Save/Create modal
2. Try to submit empty form
3. Verify error message
4. Enter name exceeding max length
5. Verify truncation or error
6. Test with special characters

**Success Criteria:**
- Required field validation works
- Max length enforced (32 chars for name, 200 for notes)
- Clear error messages
- Form doesn't submit with errors

### 3.9 Toast Notification Flow (P1)
**User Story:** As a user, I want feedback on my actions

**Test Steps:**
1. Perform various actions (load, save, create, delete)
2. Verify appropriate toast appears
3. Verify toast auto-dismisses
4. Test manual dismissal
5. Test multiple toasts

**Success Criteria:**
- Success toasts for successful operations
- Error toasts for failures
- Info toasts for deletions
- Toasts auto-dismiss after timeout
- Can manually dismiss toasts

### 3.10 Cancel Modal Flow (P2)
**User Story:** As a user, I want to cancel operations and close modals

**Test Steps:**
1. Open each modal type
2. Click cancel button
3. Verify modal closes
4. Verify no action taken
5. Test ESC key
6. Test clicking backdrop

**Success Criteria:**
- Cancel button closes modal
- No data persisted
- Form resets
- ESC key works
- Backdrop click closes modal

### 3.11 Concurrent Load Prevention Flow (P2)
**User Story:** As a user, loading a scene should disable other actions

**Test Steps:**
1. Start loading a scene
2. Verify other load buttons disabled
3. Verify modal actions disabled
4. Wait for completion
5. Verify buttons re-enabled

**Success Criteria:**
- Loading state prevents concurrent actions
- UI clearly shows loading state
- Actions re-enabled after completion

### 3.12 Empty State Flow (P2)
**User Story:** As a user, I should see helpful messages when no scenes exist

**Test Steps:**
1. Navigate to app with no scenes
2. Verify empty state message
3. Test search with no results
4. Verify "no matches" message

**Success Criteria:**
- Empty state displays when no scenes
- Appropriate icon and message
- Search empty state differs from no scenes
- Create button still accessible

---

## 4. Page Object Model Design

### 4.1 Base Page Object

```typescript
// e2e/page-objects/base.page.ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to the application
   */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for page to be ready (no loading spinners)
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.spinner', { state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  /**
   * Take screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
```

### 4.2 App Page Object

```typescript
// e2e/page-objects/app.page.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { SaveSceneModal } from './save-scene-modal.page';
import { CreateSceneModal } from './create-scene-modal.page';
import { SceneList } from './scene-list.page';

export class AppPage extends BasePage {
  // Locators
  readonly header: Locator;
  readonly title: Locator;
  readonly connectionStatus: Locator;
  readonly saveButton: Locator;
  readonly createButton: Locator;
  readonly refreshButton: Locator;
  readonly toastContainer: Locator;

  // Child page objects
  readonly sceneList: SceneList;
  readonly saveModal: SaveSceneModal;
  readonly createModal: CreateSceneModal;

  constructor(page: Page) {
    super(page);

    this.header = page.locator('header');
    this.title = this.header.locator('h1');
    this.connectionStatus = this.header.locator('[data-testid="connection-status"]');
    this.saveButton = this.header.locator('button:has-text("Save")');
    this.createButton = this.header.locator('button:has-text("Create")');
    this.refreshButton = this.header.locator('button[title="Refresh scenes"]');
    this.toastContainer = page.locator('[data-testid="toast-container"]');

    this.sceneList = new SceneList(page);
    this.saveModal = new SaveSceneModal(page);
    this.createModal = new CreateSceneModal(page);
  }

  /**
   * Navigate to app and wait for initial load
   */
  async navigate(): Promise<void> {
    await this.goto();
    await this.waitForReady();
  }

  /**
   * Click Save button to open save modal
   */
  async clickSave(): Promise<void> {
    await this.saveButton.click();
    await this.saveModal.waitForOpen();
  }

  /**
   * Click Create button to open create modal
   */
  async clickCreate(): Promise<void> {
    await this.createButton.click();
    await this.createModal.waitForOpen();
  }

  /**
   * Click Refresh button
   */
  async clickRefresh(): Promise<void> {
    await this.refreshButton.click();
  }

  /**
   * Get connection status text
   */
  async getConnectionStatus(): Promise<string> {
    return await this.connectionStatus.textContent() || '';
  }

  /**
   * Wait for and get toast notification
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[data-testid="toast"]').first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    return await toast.textContent();
  }

  /**
   * Check if toast with specific message exists
   */
  async hasToast(message: string, type?: 'success' | 'error' | 'info'): Promise<boolean> {
    let selector = `[data-testid="toast"]:has-text("${message}")`;
    if (type) {
      selector = `[data-testid="toast"][data-type="${type}"]:has-text("${message}")`;
    }
    const toast = this.page.locator(selector);
    return await toast.isVisible();
  }

  /**
   * Dismiss all toasts
   */
  async dismissAllToasts(): Promise<void> {
    const toasts = this.page.locator('[data-testid="toast-close"]');
    const count = await toasts.count();
    for (let i = 0; i < count; i++) {
      await toasts.first().click();
    }
  }
}
```

### 4.3 Scene List Page Object

```typescript
// e2e/page-objects/scene-list.page.ts
import { Page, Locator } from '@playwright/test';

export class SceneList {
  readonly searchInput: Locator;
  readonly sceneGrid: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  constructor(private page: Page) {
    this.searchInput = page.locator('input[placeholder*="Search scenes"]');
    this.sceneGrid = page.locator('.scene-grid');
    this.emptyState = page.locator('.empty-state');
    this.loadingSpinner = page.locator('.spinner');
  }

  /**
   * Get scene card by name
   */
  getSceneCard(sceneName: string): Locator {
    return this.page.locator(`[data-testid="scene-card"]:has-text("${sceneName}")`);
  }

  /**
   * Get all scene cards
   */
  getAllSceneCards(): Locator {
    return this.page.locator('[data-testid="scene-card"]');
  }

  /**
   * Get count of visible scenes
   */
  async getSceneCount(): Promise<number> {
    return await this.getAllSceneCards().count();
  }

  /**
   * Search for scenes
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for debounce/filtering
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Load a scene by name
   */
  async loadScene(sceneName: string): Promise<void> {
    const card = this.getSceneCard(sceneName);
    await card.locator('[data-testid="load-button"]').click();
  }

  /**
   * Delete a scene by name
   */
  async deleteScene(sceneName: string): Promise<void> {
    const card = this.getSceneCard(sceneName);
    await card.locator('[data-testid="delete-button"]').click();
  }

  /**
   * Check if scene is marked as active
   */
  async isSceneActive(sceneName: string): Promise<boolean> {
    const card = this.getSceneCard(sceneName);
    const activeIndicator = card.locator('[data-testid="active-indicator"]');
    return await activeIndicator.isVisible();
  }

  /**
   * Check if empty state is visible
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /**
   * Get empty state message
   */
  async getEmptyStateMessage(): Promise<string> {
    return await this.emptyState.textContent() || '';
  }
}
```

### 4.4 Save Scene Modal Page Object

```typescript
// e2e/page-objects/save-scene-modal.page.ts
import { Page, Locator } from '@playwright/test';

export class SaveSceneModal {
  readonly modal: Locator;
  readonly title: Locator;
  readonly nameInput: Locator;
  readonly notesTextarea: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.modal = page.locator('[data-testid="save-scene-modal"]');
    this.title = this.modal.locator('h2:has-text("Save Current Scene")');
    this.nameInput = this.modal.locator('#scene-name');
    this.notesTextarea = this.modal.locator('#scene-notes');
    this.saveButton = this.modal.locator('button:has-text("Save Scene")');
    this.cancelButton = this.modal.locator('button:has-text("Cancel")');
    this.errorMessage = this.modal.locator('.alert-error');
  }

  /**
   * Wait for modal to open
   */
  async waitForOpen(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Check if modal is open
   */
  async isOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  /**
   * Fill in the form and save
   */
  async saveScene(name: string, notes?: string): Promise<void> {
    await this.nameInput.fill(name);
    if (notes) {
      await this.notesTextarea.fill(notes);
    }
    await this.saveButton.click();
  }

  /**
   * Cancel the modal
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: 'hidden' });
  }

  /**
   * Get error message if present
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Check if save button is disabled
   */
  async isSaveButtonDisabled(): Promise<boolean> {
    return await this.saveButton.isDisabled();
  }
}
```

### 4.5 Create Scene Modal Page Object

```typescript
// e2e/page-objects/create-scene-modal.page.ts
import { Page, Locator } from '@playwright/test';

export class CreateSceneModal {
  readonly modal: Locator;
  readonly title: Locator;
  readonly nameInput: Locator;
  readonly copyFromSelect: Locator;
  readonly notesTextarea: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.modal = page.locator('[data-testid="create-scene-modal"]');
    this.title = this.modal.locator('h2:has-text("Create New Scene")');
    this.nameInput = this.modal.locator('#new-scene-name');
    this.copyFromSelect = this.modal.locator('#copy-from');
    this.notesTextarea = this.modal.locator('#new-scene-notes');
    this.createButton = this.modal.locator('button:has-text("Create Scene")');
    this.cancelButton = this.modal.locator('button:has-text("Cancel")');
    this.errorMessage = this.modal.locator('.alert-error');
  }

  /**
   * Wait for modal to open
   */
  async waitForOpen(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Check if modal is open
   */
  async isOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  /**
   * Create a new blank scene
   */
  async createBlankScene(name: string, notes?: string): Promise<void> {
    await this.nameInput.fill(name);
    if (notes) {
      await this.notesTextarea.fill(notes);
    }
    await this.createButton.click();
  }

  /**
   * Create scene from existing scene
   */
  async createFromScene(name: string, copyFrom: string, notes?: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.copyFromSelect.selectOption({ label: copyFrom });
    if (notes) {
      await this.notesTextarea.fill(notes);
    }
    await this.createButton.click();
  }

  /**
   * Get available scenes in copy-from dropdown
   */
  async getAvailableScenes(): Promise<string[]> {
    const options = this.copyFromSelect.locator('option');
    const count = await options.count();
    const scenes: string[] = [];

    for (let i = 1; i < count; i++) { // Skip first option "Start from current mixer state"
      const text = await options.nth(i).textContent();
      if (text) scenes.push(text);
    }

    return scenes;
  }

  /**
   * Cancel the modal
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: 'hidden' });
  }

  /**
   * Get error message if present
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
}
```

### 4.6 Confirm Modal Page Object

```typescript
// e2e/page-objects/confirm-modal.page.ts
import { Page, Locator } from '@playwright/test';

export class ConfirmModal {
  readonly modal: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(private page: Page) {
    this.modal = page.locator('[data-testid="confirm-modal"]');
    this.title = this.modal.locator('h2');
    this.message = this.modal.locator('p');
    this.confirmButton = this.modal.locator('button.btn-primary, button.btn-danger');
    this.cancelButton = this.modal.locator('button:has-text("Cancel")');
  }

  /**
   * Wait for modal to open
   */
  async waitForOpen(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Get modal title
   */
  async getTitle(): Promise<string> {
    return await this.title.textContent() || '';
  }

  /**
   * Get modal message
   */
  async getMessage(): Promise<string> {
    return await this.message.textContent() || '';
  }

  /**
   * Confirm the action
   */
  async confirm(): Promise<void> {
    await this.confirmButton.click();
    await this.modal.waitFor({ state: 'hidden' });
  }

  /**
   * Cancel the action
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: 'hidden' });
  }

  /**
   * Check if modal is danger variant
   */
  async isDangerVariant(): Promise<boolean> {
    return await this.confirmButton.evaluate(el => el.classList.contains('btn-danger'));
  }
}
```

---

## 5. Test Utilities

### 5.1 Fixtures

```typescript
// e2e/fixtures/app.fixture.ts
import { test as base, expect } from '@playwright/test';
import { AppPage } from '../page-objects/app.page';
import { mockServerSetup } from '../helpers/mock-server';

type AppFixtures = {
  appPage: AppPage;
  mockServer: Awaited<ReturnType<typeof mockServerSetup>>;
};

export const test = base.extend<AppFixtures>({
  mockServer: async ({ page }, use) => {
    const server = await mockServerSetup(page);
    await use(server);
    await server.cleanup();
  },

  appPage: async ({ page, mockServer }, use) => {
    const appPage = new AppPage(page);
    await appPage.navigate();
    await use(appPage);
  },
});

export { expect };
```

### 5.2 Test Data

```typescript
// e2e/fixtures/test-data.ts
export const testScenes = {
  basic: {
    id: 'scene-001',
    name: 'Main Vocals',
    index: 1,
    notes: 'Vocal-heavy mix for main performance',
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-01T10:00:00Z',
  },
  minimal: {
    id: 'scene-002',
    name: 'Drums Only',
    index: 2,
    createdAt: '2025-01-01T11:00:00Z',
    updatedAt: '2025-01-01T11:00:00Z',
  },
  withLongName: {
    id: 'scene-003',
    name: 'Very Long Scene Name That Tests',
    index: 3,
    notes: 'This scene has a very long name to test the UI rendering and truncation',
    createdAt: '2025-01-01T12:00:00Z',
    updatedAt: '2025-01-01T12:00:00Z',
  },
};

export const createMockScenes = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `scene-${String(i + 1).padStart(3, '0')}`,
    name: `Scene ${i + 1}`,
    index: i + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};
```

### 5.3 Mock Server Helper

```typescript
// e2e/helpers/mock-server.ts
import { Page } from '@playwright/test';

export async function mockServerSetup(page: Page) {
  // Mock API responses
  await page.route('**/api/scenes', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    }
  });

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        x32Connection: 'connected',
        mockMode: true,
        timestamp: new Date().toISOString(),
      }),
    });
  });

  // WebSocket mock
  await page.addInitScript(() => {
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor(url: string) {
        setTimeout(() => {
          if (this.onopen) this.onopen();
        }, 100);
      }

      send(data: string) {
        // Mock send
      }

      close() {
        if (this.onclose) this.onclose();
      }
    }

    (window as any).WebSocket = MockWebSocket;
  });

  return {
    async cleanup() {
      await page.unrouteAll();
    },

    async setScenes(scenes: any[]) {
      await page.route('**/api/scenes', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: scenes,
            }),
          });
        }
      });
    },

    async mockSaveScene(response: any) {
      await page.route('**/api/scenes', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        }
      });
    },

    async mockNetworkError() {
      await page.route('**/api/**', (route) => route.abort('failed'));
    },
  };
}
```

### 5.4 Custom Assertions

```typescript
// e2e/helpers/assertions.ts
import { expect } from '@playwright/test';

export const customAssertions = {
  /**
   * Assert toast appears with message
   */
  async toastAppears(page: any, message: string, type?: 'success' | 'error' | 'info') {
    let selector = `[data-testid="toast"]:has-text("${message}")`;
    if (type) {
      selector = `[data-testid="toast"][data-type="${type}"]:has-text("${message}")`;
    }
    await expect(page.locator(selector)).toBeVisible({ timeout: 5000 });
  },

  /**
   * Assert modal is visible
   */
  async modalIsOpen(modal: any) {
    await expect(modal.modal).toBeVisible();
  },

  /**
   * Assert scene count
   */
  async sceneCount(sceneList: any, count: number) {
    await expect(sceneList.getAllSceneCards()).toHaveCount(count);
  },
};
```

---

## 6. CI/CD Integration

### 6.1 GitHub Actions Workflow

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]

jobs:
  e2e-tests:
    name: E2E Tests - ${{ matrix.browser }}
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox]
        node-version: [20]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Build application
        run: npm run build

      - name: Build server
        run: npm run build:server

      - name: Run E2E tests
        run: npm run test:e2e -- --project=${{ matrix.browser }}
        env:
          CI: true
          MOCK_MODE: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          retention-days: 7

      - name: Upload screenshots on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-screenshots-${{ matrix.browser }}
          path: test-results/screenshots/
          retention-days: 7

  e2e-visual:
    name: Visual Regression Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Build application
        run: npm run build

      - name: Build server
        run: npm run build:server

      - name: Run visual tests
        run: npm run test:e2e:visual
        env:
          CI: true
          MOCK_MODE: true

      - name: Upload visual diff
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diff
          path: test-results/visual-diff/
          retention-days: 7

  e2e-report:
    name: Publish Test Report
    runs-on: ubuntu-latest
    needs: [e2e-tests, e2e-visual]
    if: always()

    steps:
      - name: Download all reports
        uses: actions/download-artifact@v4
        with:
          pattern: playwright-report-*
          merge-multiple: true
          path: all-reports

      - name: Publish HTML Report
        uses: actions/upload-artifact@v4
        with:
          name: combined-playwright-report
          path: all-reports
          retention-days: 30
```

### 6.2 Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:visual": "playwright test e2e/tests/visual",
    "test:e2e:critical": "playwright test e2e/tests/critical-flows",
    "test:e2e:report": "playwright show-report",
    "test:e2e:codegen": "playwright codegen http://localhost:5173"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

---

## 7. Configuration

### 7.1 Playwright Config

Create `e2e/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 5173;
const SERVER_PORT = process.env.SERVER_PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      MOCK_MODE: 'true',
      PORT: String(PORT),
      SERVER_PORT: String(SERVER_PORT),
    },
  },
});
```

### 7.2 Configuration Recommendations

**Browsers:**
- **Chromium**: Primary browser, fastest, most common
- **Firefox**: Secondary browser, good web standards compliance
- **Webkit**: Optional, for Safari compatibility (CI only)
- **Mobile**: Optional, for responsive testing (PR only)

**Timeouts:**
- `actionTimeout: 10000ms` - Actions like click, fill (10s is generous for network delays)
- `navigationTimeout: 30000ms` - Page loads (30s for slower CI)
- `expect.timeout: 5000ms` - Assertions (5s default)

**Retries:**
- `0` in local development (fail fast)
- `2` in CI (handle flaky network/timing)

**Workers:**
- `undefined` locally (use all CPU cores)
- `2` in CI (balance speed vs. resource usage)

**Screenshots & Videos:**
- `screenshot: 'only-on-failure'` - Debug failed tests
- `video: 'retain-on-failure'` - Capture what happened
- `trace: 'on-first-retry'` - Detailed debugging for flaky tests

**Parallel Execution:**
- `fullyParallel: true` - Run tests concurrently
- Tests are isolated and independent

---

## 8. Example Test Implementation

### 8.1 Critical Flow: Load Scene

```typescript
// e2e/tests/critical-flows/scene-load.spec.ts
import { test, expect } from '../../fixtures/app.fixture';
import { testScenes } from '../../fixtures/test-data';
import { ConfirmModal } from '../../page-objects/confirm-modal.page';

test.describe('Load Scene Flow', () => {
  test.beforeEach(async ({ mockServer }) => {
    // Setup test data
    await mockServer.setScenes([testScenes.basic, testScenes.minimal]);
  });

  test('should load scene successfully', async ({ page, appPage }) => {
    const confirmModal = new ConfirmModal(page);

    // Click load on first scene
    await appPage.sceneList.loadScene('Main Vocals');

    // Verify confirmation modal appears
    await confirmModal.waitForOpen();
    expect(await confirmModal.getTitle()).toBe('Load Scene');
    expect(await confirmModal.getMessage()).toContain('Main Vocals');

    // Confirm load
    await confirmModal.confirm();

    // Verify success toast
    await expect(page.locator('[data-testid="toast"]'))
      .toContainText('Scene "Main Vocals" loaded successfully');

    // Verify scene is marked as active
    expect(await appPage.sceneList.isSceneActive('Main Vocals')).toBe(true);
  });

  test('should cancel load operation', async ({ page, appPage }) => {
    const confirmModal = new ConfirmModal(page);

    // Click load
    await appPage.sceneList.loadScene('Main Vocals');
    await confirmModal.waitForOpen();

    // Cancel
    await confirmModal.cancel();

    // Verify no toast appears
    await expect(page.locator('[data-testid="toast"]')).not.toBeVisible();

    // Verify scene is not marked as active
    expect(await appPage.sceneList.isSceneActive('Main Vocals')).toBe(false);
  });

  test('should show error toast on load failure', async ({ page, appPage, mockServer }) => {
    // Mock API error
    await mockServer.mockNetworkError();

    const confirmModal = new ConfirmModal(page);

    // Attempt to load
    await appPage.sceneList.loadScene('Main Vocals');
    await confirmModal.waitForOpen();
    await confirmModal.confirm();

    // Verify error toast
    await expect(page.locator('[data-testid="toast"][data-type="error"]'))
      .toContainText('Failed to load scene');
  });

  test('should disable actions during load', async ({ page, appPage }) => {
    const confirmModal = new ConfirmModal(page);

    // Start loading
    await appPage.sceneList.loadScene('Main Vocals');
    await confirmModal.waitForOpen();

    // Click confirm but don't wait for completion
    confirmModal.confirmButton.click(); // Note: not awaited

    // Verify buttons are disabled
    await expect(appPage.saveButton).toBeDisabled();
    await expect(appPage.createButton).toBeDisabled();
  });
});
```

### 8.2 Feature Test: Search

```typescript
// e2e/tests/features/search-filter.spec.ts
import { test, expect } from '../../fixtures/app.fixture';
import { createMockScenes } from '../../fixtures/test-data';

test.describe('Search & Filter', () => {
  test.beforeEach(async ({ mockServer }) => {
    // Create 10 test scenes
    const scenes = createMockScenes(10);
    await mockServer.setScenes(scenes);
  });

  test('should filter scenes by search term', async ({ appPage }) => {
    // Initial state - 10 scenes
    expect(await appPage.sceneList.getSceneCount()).toBe(10);

    // Search for "Scene 1"
    await appPage.sceneList.search('Scene 1');

    // Should show Scene 1 and Scene 10
    expect(await appPage.sceneList.getSceneCount()).toBe(2);
  });

  test('should show empty state when no matches', async ({ appPage }) => {
    // Search for non-existent scene
    await appPage.sceneList.search('NonExistent');

    // Verify empty state
    expect(await appPage.sceneList.isEmptyStateVisible()).toBe(true);
    expect(await appPage.sceneList.getEmptyStateMessage())
      .toContain('No scenes match your search');
  });

  test('should clear search and restore all scenes', async ({ appPage }) => {
    // Search
    await appPage.sceneList.search('Scene 1');
    expect(await appPage.sceneList.getSceneCount()).toBe(2);

    // Clear
    await appPage.sceneList.clearSearch();

    // All scenes restored
    expect(await appPage.sceneList.getSceneCount()).toBe(10);
  });

  test('should be case-insensitive', async ({ appPage }) => {
    await appPage.sceneList.search('SCENE 1');
    expect(await appPage.sceneList.getSceneCount()).toBe(2);

    await appPage.sceneList.clearSearch();

    await appPage.sceneList.search('scene 1');
    expect(await appPage.sceneList.getSceneCount()).toBe(2);
  });
});
```

---

## 9. Best Practices & Patterns

### 9.1 Test Independence
- Each test should be fully independent
- Use `beforeEach` to set up fresh state
- Don't rely on test execution order
- Clean up after tests if necessary

### 9.2 Selectors Strategy
**Priority order:**
1. `data-testid` attributes (most reliable)
2. ARIA roles and labels
3. Text content (for unique labels)
4. CSS classes (least preferred, can change)

**Add to components:**
```tsx
// Add data-testid attributes
<div data-testid="scene-card">
  <button data-testid="load-button">Load</button>
  <button data-testid="delete-button">Delete</button>
</div>

<div data-testid="toast" data-type="success">
  Scene loaded successfully
</div>
```

### 9.3 Waiting Strategies
- Use Playwright's auto-waiting (best)
- Use `waitFor()` for dynamic content
- Avoid `page.waitForTimeout()` (flaky)
- Use `waitForLoadState('networkidle')` for API calls

### 9.4 Error Handling
- Take screenshots on failure (automatic)
- Capture video on failure (configured)
- Use trace viewer for debugging
- Log meaningful test names

### 9.5 Performance
- Run tests in parallel
- Use fixtures for shared setup
- Mock external dependencies
- Keep tests focused and fast (<5s each)

---

## 10. Maintenance & Scalability

### 10.1 When to Add New Tests
- New features added
- Bugs found in production
- Critical user paths change
- Regression risks identified

### 10.2 When to Update Tests
- UI changes (update selectors)
- API changes (update mocks)
- Business logic changes
- New edge cases discovered

### 10.3 Test Organization
- Group related tests in describe blocks
- Use meaningful test names
- Tag tests with `@critical`, `@smoke`, etc.
- Separate fast smoke tests from slow tests

### 10.4 Flaky Test Management
- Retry failed tests automatically (2x in CI)
- Use trace viewer to debug
- Add explicit waits if needed
- Mock time-dependent behavior

---

## 11. Success Metrics

### 11.1 Coverage Goals
- **Critical flows**: 100% coverage (all 12 flows)
- **Features**: 80% coverage
- **Edge cases**: 60% coverage
- **Overall**: Aim for 80%+ E2E coverage

### 11.2 Performance Targets
- Test suite runs in <5 minutes (CI)
- Individual test runs in <30 seconds
- 95%+ test stability (not flaky)

### 11.3 Quality Gates
- All critical flows must pass
- No blocking bugs in E2E tests
- Test failures investigated within 24h
- Flaky tests fixed or skipped

---

## 12. Next Steps

1. **Phase 1: Setup (Week 1)**
   - Install Playwright
   - Create directory structure
   - Configure Playwright
   - Set up CI/CD workflow

2. **Phase 2: Page Objects (Week 2)**
   - Implement base page objects
   - Add test utilities
   - Create mock server helpers
   - Add data-testid to components

3. **Phase 3: Critical Flows (Week 3-4)**
   - Write 12 critical flow tests
   - Ensure all pass reliably
   - Fix any flaky tests

4. **Phase 4: Feature Tests (Week 5-6)**
   - Write feature tests
   - Add edge case tests
   - Achieve 80% coverage goal

5. **Phase 5: Visual Tests (Week 7)**
   - Add visual regression tests
   - Set up screenshot comparison
   - Test responsive design

6. **Phase 6: Polish (Week 8)**
   - Optimize test performance
   - Improve error messages
   - Documentation
   - Team training

---

## Appendix A: Required Component Updates

Add `data-testid` attributes to enable reliable testing:

```tsx
// SceneCard.tsx
<div data-testid="scene-card">
  {isActive && <div data-testid="active-indicator" />}
  <button data-testid="load-button" onClick={onLoad}>Load</button>
  <button data-testid="delete-button" onClick={onDelete}>Delete</button>
</div>

// Toast.tsx
<div data-testid="toast-container">
  <div data-testid="toast" data-type={type}>
    {message}
    <button data-testid="toast-close" onClick={onClose}>×</button>
  </div>
</div>

// ConnectionStatus.tsx
<div data-testid="connection-status">
  {status}
</div>

// Modals
<div data-testid="save-scene-modal">...</div>
<div data-testid="create-scene-modal">...</div>
<div data-testid="confirm-modal">...</div>
```

## Appendix B: Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [CI/CD Examples](https://playwright.dev/docs/ci)
- [Debugging Guide](https://playwright.dev/docs/debug)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-07
**Owner**: Engineering Team
**Status**: Ready for Implementation
