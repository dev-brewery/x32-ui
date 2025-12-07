import { test, expect, uniqueSceneName } from '../fixtures/test-fixtures';

test.describe('Scene Search Flow', () => {
  test('should filter scenes by name', async ({ appPage, createSceneModal }) => {
    // Create a uniquely named scene for testing
    const uniqueName = uniqueSceneName('SearchTest');

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();
    await createSceneModal.fillName(uniqueName);
    await createSceneModal.submit();
    await createSceneModal.waitForClose();

    // Wait for scene to be created
    await appPage.page.waitForTimeout(500);

    // Search for the unique scene
    await appPage.searchScenes('SearchTest');

    // Wait for filter to apply
    await appPage.page.waitForTimeout(200);

    // Should find the scene
    const sceneNames = await appPage.getSceneNames();
    expect(sceneNames).toContain(uniqueName);
  });

  test('should show empty state when no matches', async ({ appPage }) => {
    // Search for something that definitely won't exist
    await appPage.searchScenes('XYZNONEXISTENT123456789');

    // Wait for filter to apply
    await appPage.page.waitForTimeout(200);

    // Should show no results message
    await expect(appPage.page.locator('text=No scenes match your search')).toBeVisible();
  });

  test('should be case insensitive', async ({ appPage }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    const firstScene = sceneNames[0];

    // Search with different case
    await appPage.searchScenes(firstScene.toUpperCase());

    // Wait for filter
    await appPage.page.waitForTimeout(200);

    // Should still find the scene
    const filteredNames = await appPage.getSceneNames();
    expect(filteredNames).toContain(firstScene);
  });

  test('should clear search and show all scenes', async ({ appPage }) => {
    const initialCount = await appPage.getSceneCount();

    // Search for something
    await appPage.searchScenes('test');
    await appPage.page.waitForTimeout(200);

    // Clear the search
    await appPage.clearSearch();
    await appPage.page.waitForTimeout(200);

    // Should show all scenes again
    const finalCount = await appPage.getSceneCount();
    expect(finalCount).toBe(initialCount);
  });

  test('should update results as user types', async ({ appPage }) => {
    const initialCount = await appPage.getSceneCount();
    if (initialCount === 0) {
      test.skip();
      return;
    }

    // Type character by character
    await appPage.searchInput.type('xyz', { delay: 100 });

    // Count should decrease or show empty
    await appPage.page.waitForTimeout(200);
    const filteredCount = await appPage.getSceneCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should preserve search across refresh', async ({ appPage }) => {
    await appPage.searchScenes('test');

    // Click refresh
    await appPage.clickRefresh();

    // Wait for refresh to complete
    await appPage.page.waitForTimeout(1000);

    // Search should still be applied
    await expect(appPage.searchInput).toHaveValue('test');
  });
});
