import { test, expect, uniqueSceneName } from '../fixtures/test-fixtures';

test.describe('Scene Delete Flow', () => {
  test('should show delete confirmation modal when clicking delete', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    const targetScene = sceneNames[0];

    await appPage.clickDeleteScene(targetScene);

    await confirmModal.waitForOpen();
    await expect(confirmModal.modal).toBeVisible();
    await confirmModal.expectMessage(targetScene);
    await confirmModal.expectConfirmButtonText('Delete');
  });

  test('should cancel delete when clicking Cancel', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    const targetScene = sceneNames[0];

    await appPage.clickDeleteScene(targetScene);
    await confirmModal.waitForOpen();

    await confirmModal.cancel();

    await expect(confirmModal.modal).not.toBeVisible();

    // Scene should still exist
    const namesAfter = await appPage.getSceneNames();
    expect(namesAfter).toContain(targetScene);
  });

  test('should delete scene when confirming', async ({
    appPage,
    confirmModal,
    createSceneModal,
  }) => {
    // First create a scene to delete
    const sceneName = uniqueSceneName('Delete Test');

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();
    await createSceneModal.fillName(sceneName);
    await createSceneModal.submit();
    await createSceneModal.waitForClose();

    // Wait for the scene to appear
    await appPage.page.waitForTimeout(500);

    // Verify scene exists
    let sceneNames = await appPage.getSceneNames();
    expect(sceneNames).toContain(sceneName);

    // Delete the scene
    await appPage.clickDeleteScene(sceneName);
    await confirmModal.waitForOpen();
    await confirmModal.confirm();

    // Toast should show
    await appPage.expectToast(/deleted/i);

    // Scene should be removed
    await appPage.page.waitForTimeout(500);
    sceneNames = await appPage.getSceneNames();
    expect(sceneNames).not.toContain(sceneName);
  });

  test('should show danger styling on delete confirmation', async ({
    appPage,
    confirmModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneNames = await appPage.getSceneNames();
    await appPage.clickDeleteScene(sceneNames[0]);
    await confirmModal.waitForOpen();

    // Check that the confirm button has danger styling
    const confirmButton = confirmModal.confirmButton;
    await expect(confirmButton).toHaveClass(/danger|btn-danger/);
  });
});
