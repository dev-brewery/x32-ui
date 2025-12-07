#!/usr/bin/env node

/**
 * Stop Check Hook
 *
 * CRITICAL: Prevents Claude from stopping before PM mission is complete.
 * Evaluates mission state and blocks premature termination.
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
    allowStop();
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'pm-state');

// SDLC phases in order
const PHASES = ['PLAN', 'DESIGN', 'IMPLEMENT', 'TEST', 'REVIEW', 'DEPLOY'];

function processInput(input) {
  const projectStatePath = path.join(stateDir, 'project-state.json');

  try {
    // If no PM state exists, this isn't a PM session - allow stop
    if (!fs.existsSync(projectStatePath)) {
      allowStop();
      return;
    }

    const projectState = JSON.parse(fs.readFileSync(projectStatePath, 'utf8'));

    // If mission is not active, allow stop
    if (!projectState.missionActive) {
      allowStop('Mission completed or not active. Stop authorized.');
      return;
    }

    // Get current phase position
    const currentPhaseIndex = PHASES.indexOf(projectState.currentPhase);
    const isLastPhase = currentPhaseIndex === PHASES.length - 1;

    // Check if current phase is complete
    if (projectState.phaseStatus !== 'completed') {
      blockStop(
        `🛑 MISSION INCOMPLETE - CANNOT STOP\n\n` +
        `Current Phase: ${projectState.currentPhase}\n` +
        `Status: ${projectState.phaseStatus}\n` +
        `Current Task: ${projectState.currentTask || 'None specified'}\n\n` +
        `You must complete the ${projectState.currentPhase} phase before stopping.\n` +
        `Complete all phase tasks and update project-state.json with phaseStatus: "completed".\n\n` +
        `Remaining phases: ${PHASES.slice(currentPhaseIndex).join(' → ')}`
      );
      return;
    }

    // Current phase is complete - check if there are more phases
    if (!isLastPhase) {
      const nextPhase = PHASES[currentPhaseIndex + 1];

      // Auto-advance to next phase
      projectState.currentPhase = nextPhase;
      projectState.phaseStatus = 'pending';
      projectState.currentTask = null;
      projectState.lastUpdated = new Date().toISOString();

      // Add completed phase to list
      if (!projectState.completedPhases) {
        projectState.completedPhases = [];
      }
      if (!projectState.completedPhases.includes(PHASES[currentPhaseIndex])) {
        projectState.completedPhases.push(PHASES[currentPhaseIndex]);
      }

      fs.writeFileSync(projectStatePath, JSON.stringify(projectState, null, 2));

      blockStop(
        `🔄 PHASE TRANSITION\n\n` +
        `✅ Completed: ${PHASES[currentPhaseIndex]}\n` +
        `➡️ Next Phase: ${nextPhase}\n\n` +
        `Proceeding to ${nextPhase} phase.\n` +
        `Invoke the appropriate agent:\n` +
        getAgentForPhase(nextPhase) +
        `\n\nRemaining phases: ${PHASES.slice(currentPhaseIndex + 1).join(' → ')}`
      );
      return;
    }

    // All phases complete - finalize mission
    projectState.missionActive = false;
    projectState.completedAt = new Date().toISOString();
    projectState.lastUpdated = new Date().toISOString();

    // Ensure all phases are in completed list
    projectState.completedPhases = PHASES;

    fs.writeFileSync(projectStatePath, JSON.stringify(projectState, null, 2));

    allowStop(
      `🎉 MISSION COMPLETE!\n\n` +
      `All ${PHASES.length} phases completed successfully.\n` +
      `Project: ${projectState.projectName}\n` +
      `Completed: ${projectState.completedAt}\n\n` +
      `Generate final report before closing.`
    );

  } catch (error) {
    // On error, allow stop but log
    allowStop(`Stop check error: ${error.message}. Allowing stop.`);
  }
}

function getAgentForPhase(phase) {
  const mapping = {
    'PLAN': '  Use Task tool with architect agent for requirements and scope.',
    'DESIGN': '  Use Task tool with architect agent for architecture and specs.',
    'IMPLEMENT': '  Use Task tool with developer agent for implementation.',
    'TEST': '  Use Task tool with tester agent for testing.',
    'REVIEW': '  Use Task tool with reviewer agent for code review.',
    'DEPLOY': '  Use Task tool with devops agent for deployment.'
  };
  return mapping[phase] || '  Invoke the appropriate agent.';
}

function allowStop(reason = '') {
  const output = {
    decision: undefined, // undefined = allow stop
    reason: reason
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

function blockStop(reason) {
  const output = {
    decision: 'block',
    reason: reason
  };
  console.log(JSON.stringify(output));
  process.exit(2); // Exit code 2 = blocking
}
