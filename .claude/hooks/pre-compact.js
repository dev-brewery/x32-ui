#!/usr/bin/env node

/**
 * Pre-Compact Hook
 *
 * Saves a complete checkpoint of PM state before context compaction.
 * Ensures mission can be resumed with full context after compact.
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
    passThrough('');
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'pm-state');
const checkpointsDir = path.join(stateDir, 'checkpoints');

function processInput(input) {
  const trigger = input.trigger || 'unknown'; // 'manual' or 'auto'
  const customInstructions = input.custom_instructions || null;

  try {
    // Ensure directories exist
    if (!fs.existsSync(stateDir)) {
      passThrough('No PM state to checkpoint.');
      return;
    }

    if (!fs.existsSync(checkpointsDir)) {
      fs.mkdirSync(checkpointsDir, { recursive: true });
    }

    // Create checkpoint filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointPath = path.join(checkpointsDir, `checkpoint-${timestamp}.json`);

    // Gather all state files
    const checkpoint = {
      timestamp: new Date().toISOString(),
      trigger,
      customInstructions,
      state: {}
    };

    // Load and include all state files
    const stateFiles = [
      'project-state.json',
      'task-tracker.json',
      'decisions.json',
      'audit-log.json',
      'technical-debt.json',
      'current-pr.json'
    ];

    for (const file of stateFiles) {
      const filePath = path.join(stateDir, file);
      if (fs.existsSync(filePath)) {
        try {
          checkpoint.state[file] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Check if we have any meaningful state
    if (Object.keys(checkpoint.state).length === 0) {
      passThrough('No PM state files to checkpoint.');
      return;
    }

    // Get project state for summary
    const projectState = checkpoint.state['project-state.json'];

    // Update project state with checkpoint reference
    if (projectState) {
      const projectStatePath = path.join(stateDir, 'project-state.json');
      projectState.lastCheckpoint = checkpointPath;
      projectState.lastCompact = new Date().toISOString();
      projectState.compactCount = (projectState.compactCount || 0) + 1;
      fs.writeFileSync(projectStatePath, JSON.stringify(projectState, null, 2));
    }

    // Save checkpoint
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // Build mission summary for compact preservation
    const summary = buildMissionSummary(projectState, checkpoint);

    // Cleanup old checkpoints (keep last 10)
    cleanupOldCheckpoints();

    passThrough(summary);

  } catch (error) {
    passThrough(`Checkpoint warning: ${error.message}. Proceeding with compact.`);
  }
}

function buildMissionSummary(projectState, checkpoint) {
  if (!projectState) {
    return 'No active PM mission. Checkpoint saved.';
  }

  const lines = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    PM MISSION CHECKPOINT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Project: ${projectState.projectName || 'Unknown'}`);
  lines.push(`Mission Active: ${projectState.missionActive ? 'YES' : 'NO'}`);
  lines.push(`Current Phase: ${projectState.currentPhase || 'Unknown'}`);
  lines.push(`Phase Status: ${projectState.phaseStatus || 'Unknown'}`);
  lines.push(`Compact Count: ${projectState.compactCount || 1}`);
  lines.push('');

  // Completed phases
  if (projectState.completedPhases && projectState.completedPhases.length > 0) {
    lines.push(`Completed: ${projectState.completedPhases.join(' → ')}`);
  }

  // Current task
  if (projectState.currentTask) {
    lines.push(`Current Task: ${projectState.currentTask}`);
  }

  // Tech stack
  if (projectState.techStack && Object.keys(projectState.techStack).length > 0) {
    lines.push('');
    lines.push('Tech Stack:');
    for (const [key, value] of Object.entries(projectState.techStack)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  // Recent decisions (last 3)
  const decisions = checkpoint.state['decisions.json'];
  if (decisions && decisions.decisions && decisions.decisions.length > 0) {
    lines.push('');
    lines.push('Recent Decisions:');
    const recent = decisions.decisions.slice(-3);
    for (const d of recent) {
      lines.push(`  - [${d.phase}] ${d.title}: ${d.decision}`);
    }
  }

  // Blocked features
  const debt = checkpoint.state['technical-debt.json'];
  if (debt && debt.blockedFeatures && debt.blockedFeatures.length > 0) {
    lines.push('');
    lines.push(`Blocked Features: ${debt.blockedFeatures.length}`);
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    RESUME INSTRUCTIONS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Use: /pm ${projectState.projectName} --resume`);
  lines.push('');
  lines.push('Full state will be reloaded from checkpoint on next session.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function cleanupOldCheckpoints() {
  try {
    const files = fs.readdirSync(checkpointsDir)
      .filter(f => f.startsWith('checkpoint-'))
      .sort()
      .reverse();

    // Keep only last 10
    if (files.length > 10) {
      for (const file of files.slice(10)) {
        fs.unlinkSync(path.join(checkpointsDir, file));
      }
    }
  } catch (e) {
    // Best effort cleanup
  }
}

function passThrough(context) {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext: context
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}
