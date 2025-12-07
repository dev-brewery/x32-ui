#!/usr/bin/env node

/**
 * Subagent Stop Hook
 *
 * Validates that subagents complete their assigned tasks before stopping.
 * Ensures agents don't bail early on complex work.
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

// Agent types and their completion requirements
const AGENT_REQUIREMENTS = {
  'architect': {
    requiredOutputs: ['requirements', 'architecture', 'technical decisions'],
    minResponseLength: 500
  },
  'developer': {
    requiredOutputs: ['implementation', 'files created', 'files modified'],
    minResponseLength: 200
  },
  'tester': {
    requiredOutputs: ['test results', 'coverage', 'pass/fail'],
    minResponseLength: 300
  },
  'reviewer': {
    requiredOutputs: ['review', 'issues', 'approved/rejected'],
    minResponseLength: 200
  },
  'devops': {
    requiredOutputs: ['deployment', 'status', 'url'],
    minResponseLength: 150
  },
  'code-critic': {
    requiredOutputs: ['APPROVED', 'REJECTED'],
    minResponseLength: 100
  },
  'standards-researcher': {
    requiredOutputs: ['STANDARDS RESEARCH REPORT', 'POTENTIAL ISSUES'],
    minResponseLength: 200
  }
};

function processInput(input) {
  const agentName = input.agent_name || '';
  const agentOutput = input.agent_output || '';
  const stopReason = input.stop_reason || '';

  // If no agent name or not a PM agent, allow stop
  if (!agentName || !AGENT_REQUIREMENTS[agentName]) {
    allowStop();
    return;
  }

  const requirements = AGENT_REQUIREMENTS[agentName];

  // Check minimum response length
  if (agentOutput.length < requirements.minResponseLength) {
    blockStop(
      `🛑 INCOMPLETE AGENT OUTPUT\n\n` +
      `Agent: ${agentName}\n` +
      `Output length: ${agentOutput.length} characters\n` +
      `Minimum required: ${requirements.minResponseLength} characters\n\n` +
      `The agent's response appears incomplete. ` +
      `Please provide a more thorough analysis/output.`
    );
    return;
  }

  // Check for required output patterns
  const outputLower = agentOutput.toLowerCase();
  const missingOutputs = [];

  for (const required of requirements.requiredOutputs) {
    // Check if any of the required terms appear (case-insensitive)
    const terms = required.toLowerCase().split('/');
    const found = terms.some(term => outputLower.includes(term.trim()));

    if (!found) {
      missingOutputs.push(required);
    }
  }

  // For code-critic, at least one verdict must be present
  if (agentName === 'code-critic') {
    const hasApproved = outputLower.includes('approved') || outputLower.includes('✅');
    const hasRejected = outputLower.includes('rejected') || outputLower.includes('❌');

    if (!hasApproved && !hasRejected) {
      blockStop(
        `🛑 CODE-CRITIC INCOMPLETE\n\n` +
        `The code-critic must provide a clear verdict:\n` +
        `- ✅ CODE APPROVED (if all checks pass)\n` +
        `- ❌ CODE REJECTED (if any issues found)\n\n` +
        `Please complete the review with a definitive verdict.`
      );
      return;
    }
  }

  // For standards-researcher, ensure report format
  if (agentName === 'standards-researcher') {
    if (!outputLower.includes('standards research report')) {
      blockStop(
        `🛑 STANDARDS RESEARCHER INCOMPLETE\n\n` +
        `The standards-researcher must provide a formatted report:\n` +
        `- STANDARDS RESEARCH REPORT header\n` +
        `- POTENTIAL ISSUES TO CHECK section\n` +
        `- RECOMMENDATIONS FOR CODE-CRITIC section\n\n` +
        `Please complete the research report.`
      );
      return;
    }
  }

  // Log successful agent completion
  logAgentCompletion(agentName, agentOutput, stopReason);

  // Allow stop
  allowStop(`Agent ${agentName} completed successfully.`);
}

function logAgentCompletion(agentName, output, reason) {
  const auditPath = path.join(stateDir, 'audit-log.json');

  try {
    if (!fs.existsSync(stateDir)) {
      return;
    }

    let audit = { entries: [] };

    if (fs.existsSync(auditPath)) {
      audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }

    audit.entries.push({
      timestamp: new Date().toISOString(),
      type: 'AGENT_COMPLETION',
      agent: agentName,
      outputLength: output.length,
      stopReason: reason,
      summary: output.substring(0, 200) + (output.length > 200 ? '...' : '')
    });

    // Keep last 1000 entries
    if (audit.entries.length > 1000) {
      audit.entries = audit.entries.slice(-1000);
    }

    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  } catch (e) {
    // Best effort logging
  }
}

function allowStop(message = '') {
  const output = {
    decision: undefined, // undefined = allow
    reason: message
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
  process.exit(2);
}
