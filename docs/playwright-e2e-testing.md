# Playwright E2E Testing Guide

## Overview

X32 Scene Manager uses Playwright for end-to-end (E2E) testing to ensure the application works correctly from a user's perspective. This document covers the testing setup, structure, and best practices.

## Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Debug a specific test
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## Directory Structure

```
e2e/
├── fixtures/           # Test fixtures and utilities
│   └── test-fixtures.ts
├── pages/              # Page Object Models
│   ├── index.ts
│   ├── base.page.ts
│   ├── app.page.ts
│   └── modals.page.ts
└── tests/              # Test specifications
    ├── app-navigation.spec.ts
    ├── scene-load.spec.ts
    ├── scene-save.spec.ts
    ├── scene-create.spec.ts
    ├── scene-delete.spec.ts
    ├── scene-search.spec.ts
    └── refresh-scenes.spec.ts
```

## Test Categories

### 1. App Navigation Tests (`app-navigation.spec.ts`)
- Verify header elements display correctly
- Confirm action buttons are visible
- Check search input is accessible

### 2. Scene Load Tests (`scene-load.spec.ts`)
- Load scene with confirmation modal
- Cancel load operation
- Verify active scene indicator

### 3. Scene Save Tests (`scene-save.spec.ts`)
- Open save modal
- Validate form inputs
- Save scene with/without notes

### 4. Scene Create Tests (`scene-create.spec.ts`)
- Open create modal
- Create new scene
- Copy from existing scene

### 5. Scene Delete Tests (`scene-delete.spec.ts`)
- Delete confirmation modal
- Cancel delete operation
- Successful deletion

### 6. Scene Search Tests (`scene-search.spec.ts`)
- Filter scenes by name
- Case-insensitive search
- Clear search and show all

### 7. Refresh Tests (`refresh-scenes.spec.ts`)
- Refresh scene list
- Maintain state after refresh

## Page Object Model

We use the Page Object Model (POM) pattern for maintainable tests:

### BasePage
Common functionality for all pages:
- Navigation
- Wait utilities
- Screenshot capture

### AppPage
Main application interactions:
- Header actions (Save, Create, Refresh)
- Scene list operations
- Toast notifications
- Connection status

### Modals
Modal dialogs:
- `SaveSceneModal` - Save current scene
- `CreateSceneModal` - Create new scene
- `ConfirmModal` - Confirmation dialogs

## Writing Tests

### Using Fixtures

```typescript
import { test, expect } from '../fixtures/test-fixtures';

test('should display title', async ({ appPage }) => {
  await expect(appPage.title).toHaveText('X32 Scene Manager');
});
```

### Available Fixtures

| Fixture | Description |
|---------|-------------|
| `appPage` | Main app page (pre-navigated) |
| `saveSceneModal` | Save scene modal |
| `createSceneModal` | Create scene modal |
| `confirmModal` | Confirmation dialogs |

### Test Utilities

```typescript
import { uniqueSceneName, testUtils } from '../fixtures/test-fixtures';

// Generate unique scene name
const name = uniqueSceneName('Test');

// Random string for identifiers
const id = testUtils.randomString();
```

## Configuration

### playwright.config.ts

Key settings:
- **Browsers**: Chromium, Firefox, Mobile Chrome
- **Base URL**: http://localhost:5173
- **Timeouts**: 10s action, 30s navigation
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure only
- **Video**: On first retry

### Web Server

Tests automatically start:
1. Backend server on port 3000
2. Frontend dev server on port 5173

## CI/CD Integration

### GitHub Actions

E2E tests run in the CI pipeline:
- On push to main/master/develop
- On pull requests
- Multi-browser testing on main branch

### Artifacts

- **playwright-report/**: HTML test report
- **e2e-results/**: Test artifacts (screenshots, videos)

## Best Practices

### 1. Use Page Objects
Always interact through page objects, not raw selectors.

```typescript
// Good
await appPage.clickSave();

// Avoid
await page.click('[data-testid="save-button"]');
```

### 2. Generate Unique Data
Use unique identifiers to prevent test conflicts.

```typescript
const sceneName = uniqueSceneName('MyTest');
```

### 3. Wait for State
Use explicit waits instead of arbitrary delays.

```typescript
await confirmModal.waitForOpen();
await appPage.waitForLoad();
```

### 4. Assert Outcomes
Verify the expected state after actions.

```typescript
await appPage.clickSave();
await saveSceneModal.waitForOpen();
await expect(saveSceneModal.modal).toBeVisible();
```

### 5. Handle Dynamic Content
Check for existence before interacting.

```typescript
const sceneCount = await appPage.getSceneCount();
if (sceneCount === 0) {
  test.skip();
  return;
}
```

## Debugging

### UI Mode
Interactive test runner with time-travel debugging:
```bash
npm run test:e2e:ui
```

### Debug Mode
Step through tests with browser DevTools:
```bash
npm run test:e2e:debug
```

### View Report
HTML report with screenshots and traces:
```bash
npm run test:e2e:report
```

### Trace Viewer
Detailed execution trace (on failure):
```bash
npx playwright show-trace e2e-results/trace.zip
```

## Troubleshooting

### Tests fail locally but pass in CI
- Check for timing issues
- Verify mock server state
- Ensure clean browser state

### Flaky tests
- Add explicit waits
- Use unique test data
- Check for race conditions

### Screenshots show wrong state
- Increase action timeout
- Wait for network idle
- Add strategic assertions

## Contributing

1. Create tests in `e2e/tests/`
2. Use existing page objects or extend them
3. Follow naming convention: `<feature>.spec.ts`
4. Run full suite before committing
5. Add documentation for new patterns
