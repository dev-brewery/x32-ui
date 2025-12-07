#!/usr/bin/env node

/**
 * Session Start Hook
 *
 * Loads PM mission state on session startup/resume.
 * Injects mission context into Claude's conversation.
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
    outputContext('');
    process.exit(0);
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const envFile = process.env.CLAUDE_ENV_FILE;
const stateDir = path.join(projectDir, '.claude', 'pm-state');

function processInput(input) {
  const context = [];

  try {
    // Check if PM state exists
    const projectStatePath = path.join(stateDir, 'project-state.json');

    if (!fs.existsSync(projectStatePath)) {
      context.push('═══════════════════════════════════════════════════════════════');
      context.push('                    PM SYSTEM READY');
      context.push('═══════════════════════════════════════════════════════════════');
      context.push('');
      context.push('No active PM project found.');
      context.push('Use /pm <project-name> to start a new project.');
      context.push('');
      context.push('Available agents: architect, developer, tester, reviewer, devops, code-critic');
      context.push('');
      outputContext(context.join('\n'));
      return;
    }

    // Load project state
    const projectState = JSON.parse(fs.readFileSync(projectStatePath, 'utf8'));

    // Load task tracker if exists
    let taskTracker = { tasks: [] };
    const taskTrackerPath = path.join(stateDir, 'task-tracker.json');
    if (fs.existsSync(taskTrackerPath)) {
      taskTracker = JSON.parse(fs.readFileSync(taskTrackerPath, 'utf8'));
    }

    // Load technical debt if exists
    let technicalDebt = { blockedFeatures: [] };
    const debtPath = path.join(stateDir, 'technical-debt.json');
    if (fs.existsSync(debtPath)) {
      technicalDebt = JSON.parse(fs.readFileSync(debtPath, 'utf8'));
    }

    // Build context
    context.push('═══════════════════════════════════════════════════════════════');
    context.push('                    PM MISSION STATE LOADED');
    context.push('═══════════════════════════════════════════════════════════════');
    context.push('');
    context.push(`Project: ${projectState.projectName || 'Unknown'}`);
    context.push(`Path: ${projectState.projectPath || 'Unknown'}`);
    context.push(`Mission Active: ${projectState.missionActive ? '✅ YES' : '❌ NO'}`);
    context.push('');
    context.push('───────────────────────────────────────────────────────────────');
    context.push('                         CURRENT STATUS');
    context.push('───────────────────────────────────────────────────────────────');
    context.push(`Phase: ${projectState.currentPhase || 'Not started'}`);
    context.push(`Status: ${projectState.phaseStatus || 'Unknown'}`);
    context.push(`Last Updated: ${projectState.lastUpdated || 'Unknown'}`);

    if (projectState.currentTask) {
      context.push(`Current Task: ${projectState.currentTask}`);
    }

    // Completed phases
    if (projectState.completedPhases && projectState.completedPhases.length > 0) {
      context.push('');
      context.push('Completed Phases: ' + projectState.completedPhases.join(' → '));
    }

    // Tech stack
    if (projectState.techStack && Object.keys(projectState.techStack).length > 0) {
      context.push('');
      context.push('Tech Stack:');
      for (const [key, value] of Object.entries(projectState.techStack)) {
        context.push(`  - ${key}: ${value}`);
      }
    }

    // Task progress
    if (taskTracker.tasks && taskTracker.tasks.length > 0) {
      const pending = taskTracker.tasks.filter(t => t.status === 'pending').length;
      const inProgress = taskTracker.tasks.filter(t => t.status === 'in_progress').length;
      const completed = taskTracker.tasks.filter(t => t.status === 'completed').length;
      const blocked = taskTracker.tasks.filter(t => t.status === 'blocked').length;

      context.push('');
      context.push('───────────────────────────────────────────────────────────────');
      context.push('                         TASK PROGRESS');
      context.push('───────────────────────────────────────────────────────────────');
      context.push(`Total: ${taskTracker.tasks.length} | ✅ ${completed} | 🔄 ${inProgress} | ⏳ ${pending} | 🚫 ${blocked}`);
    }

    // Blocked features
    if (technicalDebt.blockedFeatures && technicalDebt.blockedFeatures.length > 0) {
      context.push('');
      context.push('───────────────────────────────────────────────────────────────');
      context.push('                       BLOCKED FEATURES');
      context.push('───────────────────────────────────────────────────────────────');
      for (const blocked of technicalDebt.blockedFeatures.slice(0, 3)) {
        context.push(`⚠️ PR #${blocked.prNumber}: ${blocked.reason || 'Workflow timeout'}`);
      }
    }

    // Mission summary
    if (projectState.missionSummary) {
      context.push('');
      context.push('───────────────────────────────────────────────────────────────');
      context.push('                       MISSION SUMMARY');
      context.push('───────────────────────────────────────────────────────────────');
      context.push(projectState.missionSummary);
    }

    context.push('');
    context.push('═══════════════════════════════════════════════════════════════');
    context.push('');

    if (projectState.missionActive) {
      context.push('RESUME INSTRUCTIONS:');
      context.push(`Use /pm ${projectState.projectName} --resume to continue.`);
    } else {
      context.push('Mission completed. Use /pm <new-project> to start a new mission.');
    }

    context.push('');

    // Set environment variables for the session
    if (envFile && projectState) {
      try {
        const envVars = [
          `export PM_PROJECT_NAME="${projectState.projectName || ''}"`,
          `export PM_CURRENT_PHASE="${projectState.currentPhase || ''}"`,
          `export PM_MISSION_ACTIVE="${projectState.missionActive ? 'true' : 'false'}"`,
          `export PM_STATE_DIR="${stateDir.replace(/\\/g, '/')}"`
        ];
        fs.appendFileSync(envFile, envVars.join('\n') + '\n');
      } catch (e) {
        // Best effort
      }
    }

    outputContext(context.join('\n'));

  } catch (error) {
    context.push(`[PM SESSION] Error loading state: ${error.message}`);
    outputContext(context.join('\n'));
  }
}

function outputContext(context) {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}
