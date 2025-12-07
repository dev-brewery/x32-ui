#!/usr/bin/env node

/**
 * Pre-Tool-Use Hook
 *
 * Gates dangerous file operations during PM missions.
 * Protects critical files and enforces project boundaries.
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
    allowOperation();
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'pm-state');

// Protected paths that should never be modified during automated runs
const PROTECTED_PATTERNS = [
  /^\.git\//,
  /^\.claude\/settings\.json$/,
  /^\.claude\/hooks\//,
  /^\.env$/,
  /^\.env\..+$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /node_modules\//,
  /\.pem$/,
  /\.key$/,
  /credentials/i,
  /secrets/i
];

// Paths that require extra confirmation
const SENSITIVE_PATTERNS = [
  /^src\/index\.(ts|js|tsx|jsx)$/,
  /^app\/layout\.(ts|js|tsx|jsx)$/,
  /^pages\/_app\.(ts|js|tsx|jsx)$/,
  /config\.(ts|js|json)$/,
  /\.config\.(ts|js|mjs|cjs)$/
];

function processInput(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // Only gate Write and Edit operations
  if (toolName !== 'Write' && toolName !== 'Edit') {
    allowOperation();
    return;
  }

  const filePath = toolInput.file_path || toolInput.path || '';

  if (!filePath) {
    allowOperation();
    return;
  }

  // Normalize path for comparison
  const relativePath = path.relative(projectDir, filePath).replace(/\\/g, '/');

  // Check protected patterns
  for (const pattern of PROTECTED_PATTERNS) {
    if (pattern.test(relativePath)) {
      blockOperation(
        `🛑 PROTECTED FILE\n\n` +
        `Cannot modify: ${relativePath}\n\n` +
        `This file is protected during PM missions:\n` +
        `- .git/ - Version control internals\n` +
        `- .claude/hooks/ - Hook scripts\n` +
        `- .env files - Environment secrets\n` +
        `- Lock files - Dependency locks\n` +
        `- Credentials/keys - Security files\n\n` +
        `If you need to modify this file, do so manually outside the PM session.`
      );
      return;
    }
  }

  // Check if PM mission is active
  const projectStatePath = path.join(stateDir, 'project-state.json');
  let projectState = null;

  try {
    if (fs.existsSync(projectStatePath)) {
      projectState = JSON.parse(fs.readFileSync(projectStatePath, 'utf8'));
    }
  } catch (e) {
    // No state file, allow operation
  }

  // If mission is active, check sensitive patterns
  if (projectState && projectState.missionActive) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(relativePath)) {
        // Log the sensitive file access
        logSensitiveAccess(relativePath, toolName, projectState);

        // Allow but warn
        allowOperation(
          `⚠️ SENSITIVE FILE ACCESS\n\n` +
          `Modifying: ${relativePath}\n\n` +
          `This is a critical file. Changes will be tracked in audit log.`
        );
        return;
      }
    }
  }

  // All checks passed
  allowOperation();
}

function logSensitiveAccess(filePath, operation, projectState) {
  const auditPath = path.join(stateDir, 'audit-log.json');

  try {
    let audit = { entries: [] };

    if (fs.existsSync(auditPath)) {
      audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }

    audit.entries.push({
      timestamp: new Date().toISOString(),
      type: 'SENSITIVE_FILE_ACCESS',
      operation,
      file: filePath,
      phase: projectState.currentPhase,
      task: projectState.currentTask
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

function allowOperation(message = '') {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: message
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

function blockOperation(reason) {
  const output = {
    continue: false,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: reason
    }
  };
  console.log(JSON.stringify(output));
  process.exit(2);
}
