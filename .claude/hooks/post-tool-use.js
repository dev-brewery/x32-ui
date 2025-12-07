#!/usr/bin/env node

/**
 * Post-Tool-Use Hook
 *
 * Tracks all file changes during PM missions.
 * Maintains audit log and updates task tracker.
 */

const fs = require('fs');
const path = require('path');

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    processInput(input);
  } catch (e) {
    passThrough();
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'pm-state');

function processInput(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  const toolOutput = input.tool_output || {};

  // Only track Write and Edit operations
  if (toolName !== 'Write' && toolName !== 'Edit') {
    passThrough();
    return;
  }

  const filePath = toolInput.file_path || toolInput.path || '';

  if (!filePath) {
    passThrough();
    return;
  }

  // Check if PM mission is active
  const projectStatePath = path.join(stateDir, 'project-state.json');

  try {
    if (!fs.existsSync(projectStatePath)) {
      passThrough();
      return;
    }

    const projectState = JSON.parse(fs.readFileSync(projectStatePath, 'utf8'));

    if (!projectState.missionActive) {
      passThrough();
      return;
    }

    // Track the file change
    trackFileChange(filePath, toolName, projectState);

    // Update task tracker if we can identify the task
    updateTaskProgress(filePath, projectState);

    passThrough();

  } catch (e) {
    passThrough();
  }
}

function trackFileChange(filePath, operation, projectState) {
  const auditPath = path.join(stateDir, 'audit-log.json');
  const relativePath = path.relative(projectDir, filePath).replace(/\\/g, '/');

  try {
    let audit = { entries: [], fileChanges: {} };

    if (fs.existsSync(auditPath)) {
      audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      if (!audit.fileChanges) audit.fileChanges = {};
    }

    // Add audit entry
    audit.entries.push({
      timestamp: new Date().toISOString(),
      type: 'FILE_CHANGE',
      operation,
      file: relativePath,
      phase: projectState.currentPhase,
      task: projectState.currentTask
    });

    // Track file modification count
    if (!audit.fileChanges[relativePath]) {
      audit.fileChanges[relativePath] = {
        created: new Date().toISOString(),
        modifications: 0,
        phases: []
      };
    }

    audit.fileChanges[relativePath].modifications++;
    audit.fileChanges[relativePath].lastModified = new Date().toISOString();

    if (!audit.fileChanges[relativePath].phases.includes(projectState.currentPhase)) {
      audit.fileChanges[relativePath].phases.push(projectState.currentPhase);
    }

    // Keep last 1000 entries
    if (audit.entries.length > 1000) {
      audit.entries = audit.entries.slice(-1000);
    }

    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  } catch (e) {
    // Best effort logging
  }
}

function updateTaskProgress(filePath, projectState) {
  const taskTrackerPath = path.join(stateDir, 'task-tracker.json');
  const relativePath = path.relative(projectDir, filePath).replace(/\\/g, '/');

  try {
    if (!fs.existsSync(taskTrackerPath)) {
      return;
    }

    const tracker = JSON.parse(fs.readFileSync(taskTrackerPath, 'utf8'));

    if (!tracker.tasks || tracker.tasks.length === 0) {
      return;
    }

    // Find current in-progress task
    const currentTask = tracker.tasks.find(t => t.status === 'in_progress');

    if (currentTask) {
      // Add file to task's modified files
      if (!currentTask.modifiedFiles) {
        currentTask.modifiedFiles = [];
      }

      if (!currentTask.modifiedFiles.includes(relativePath)) {
        currentTask.modifiedFiles.push(relativePath);
      }

      currentTask.lastActivity = new Date().toISOString();

      fs.writeFileSync(taskTrackerPath, JSON.stringify(tracker, null, 2));
    }
  } catch (e) {
    // Best effort tracking
  }
}

function passThrough() {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ''
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}
