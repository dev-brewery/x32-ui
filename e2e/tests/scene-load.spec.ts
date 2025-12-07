import { test, expect } from '../fixtures/test-fixtures';

test.describe('Scene Load Flow', () => {
  test('should show load confirmation modal when clicking Load Scene', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();

    // Skip if no scenes available
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    // Get first non-active scene
    const sceneNames = await appPage.getSceneNames();
    let targetScene: string | null = null;

    for (const name of sceneNames) {
      const isActive = await appPage.isSceneActive(name);
      if (!isActive) {
        targetScene = name;
        break;
      }
    }

    if (!targetScene) {
      test.skip();
      return;
    }

    // Click load on the scene
    await appPage.clickLoadScene(targetScene);

    // Verify confirmation modal appears
    await confirmModal.waitForOpen();
    await expect(confirmModal.modal).toBeVisible();
    await confirmModal.expectMessage(targetScene);
    await confirmModal.expectConfirmButtonText('Load Scene');
  });

  test('should cancel load when clicking Cancel in confirmation modal', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    let targetScene: string | null = null;

    for (const name of sceneNames) {
      const isActive = await appPage.isSceneActive(name);
      if (!isActive) {
        targetScene = name;
        break;
      }
    }

    if (!targetScene) {
      test.skip();
      return;
    }

    await appPage.clickLoadScene(targetScene);
    await confirmModal.waitForOpen();

    // Cancel the operation
    await confirmModal.cancel();

    // Verify modal is closed and no change occurred
    await expect(confirmModal.modal).not.toBeVisible();
  });

  test('should load scene successfully when confirming', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    let targetScene: string | null = null;

    for (const name of sceneNames) {
      const isActive = await appPage.isSceneActive(name);
      if (!isActive) {
        targetScene = name;
        break;
      }
    }

    if (!targetScene) {
      test.skip();
      return;
    }

    await appPage.clickLoadScene(targetScene);
    await confirmModal.waitForOpen();

    // Confirm the load
    await confirmModal.confirm();

    // Verify success toast appears
    await appPage.expectSuccessToast(/loaded successfully/i);
  });

  test('should disable Load button for active scene', async ({ appPage }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();

    for (const name of sceneNames) {
      const isActive = await appPage.isSceneActive(name);
      if (isActive) {
        const card = await appPage.getSceneCard(name);
        const loadButton = card.getByRole('button').first();
        await expect(loadButton).toBeDisabled();
        await expect(loadButton).toHaveText('Loaded');
        return;
      }
    }
  });
});
