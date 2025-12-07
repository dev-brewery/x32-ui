import { test, expect } from '../fixtures/test-fixtures';

test.describe('App Navigation', () => {
  test('should display the application header with title', async ({ appPage }) => {
    await expect(appPage.title).toHaveText('X32 Scene Manager');
  });

  test('should show connection status indicator', async ({ appPage }) => {
    await expect(appPage.connectionStatus).toBeVisible();
  });

  test('should display header action buttons', async ({ appPage }) => {
    await expect(appPage.refreshButton).toBeVisible();
    await expect(appPage.saveButton).toBeVisible();
    await expect(appPage.createButton).toBeVisible();
  });

  test('should display the search input', async ({ appPage }) => {
    await expect(appPage.searchInput).toBeVisible();
    await expect(appPage.searchInput).toHaveAttribute('placeholder', 'Search scenes...');
  });
});
