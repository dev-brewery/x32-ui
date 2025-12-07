import { test, expect, uniqueSceneName } from '../fixtures/test-fixtures';

test.describe('Scene Create Flow', () => {
  test('should open create modal when clicking Create button', async ({
    appPage,
    createSceneModal,
  }) => {
    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await expect(createSceneModal.modal).toBeVisible();
    await expect(createSceneModal.nameInput).toBeVisible();
    await expect(createSceneModal.copyFromSelect).toBeVisible();
    await expect(createSceneModal.notesInput).toBeVisible();
    await expect(createSceneModal.submitButton).toBeVisible();
  });

  test('should close create modal when clicking Cancel', async ({
    appPage,
    createSceneModal,
  }) => {
    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await createSceneModal.cancel();

    await expect(createSceneModal.modal).not.toBeVisible();
  });

  test('should show validation error when submitting without name', async ({
    appPage,
    createSceneModal,
  }) => {
    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await createSceneModal.submit();

    await createSceneModal.expectError(/name is required/i);
  });

  test('should create scene successfully with name only', async ({
    appPage,
    createSceneModal,
  }) => {
    const sceneName = uniqueSceneName('Create Test');

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await createSceneModal.fillName(sceneName);
    await createSceneModal.submit();

    // Modal should close
    await createSceneModal.waitForClose();

    // Success toast should appear
    await appPage.expectSuccessToast(/created successfully/i);

    // New scene should appear in the list
    const sceneNames = await appPage.getSceneNames();
    expect(sceneNames).toContain(sceneName);
  });

  test('should create scene with notes', async ({
    appPage,
    createSceneModal,
  }) => {
    const sceneName = uniqueSceneName('Create Notes');
    const notes = 'This is a test scene with notes';

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await createSceneModal.createScene(sceneName, { notes });

    await createSceneModal.waitForClose();
    await appPage.expectSuccessToast(/created successfully/i);
  });

  test('should show existing scenes in copy-from dropdown', async ({
    appPage,
    createSceneModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    const options = await createSceneModal.getCopyFromOptions();

    // First option should be default (current mixer state)
    expect(options[0]).toContain('current mixer state');

    // If there are scenes, they should be in the dropdown
    if (sceneCount > 0) {
      expect(options.length).toBeGreaterThan(1);
    }
  });

  test('should create scene as copy from existing', async ({
    appPage,
    createSceneModal,
  }) => {
    const sceneCount = await appPage.getSceneCount();
    if (sceneCount === 0) {
      test.skip();
      return;
    }

    const sceneName = uniqueSceneName('Copy Test');
    const sceneNames = await appPage.getSceneNames();
    const sourceName = sceneNames[0];

    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    await createSceneModal.createScene(sceneName, { copyFrom: sourceName });

    await createSceneModal.waitForClose();
    await appPage.expectSuccessToast(/created successfully/i);
  });

  test('should clear form when reopening create modal', async ({
    appPage,
    createSceneModal,
  }) => {
    // Open and fill some data
    await appPage.clickCreate();
    await createSceneModal.waitForOpen();
    await createSceneModal.fillName('Temporary Name');
    await createSceneModal.fillNotes('Temporary Notes');

    // Cancel
    await createSceneModal.cancel();

    // Reopen
    await appPage.clickCreate();
    await createSceneModal.waitForOpen();

    // Fields should be empty
    await expect(createSceneModal.nameInput).toHaveValue('');
    await expect(createSceneModal.notesInput).toHaveValue('');
  });
});
