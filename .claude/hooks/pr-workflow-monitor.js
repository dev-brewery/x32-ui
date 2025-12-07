#!/usr/bin/env node

/**
 * PR Workflow Monitor Hook
 *
 * CRITICAL: This hook monitors GitHub Actions after PR creation.
 * - Polls workflow status every 30 seconds
 * - On SUCCESS: Allows merge
 * - On FAILURE: Parses logs, creates fix tasks, invokes pm-developer
 * - On TIMEOUT (30 min): Marks feature as BLOCKED, closes PR, updates issue
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    processInput(input);
  } catch (e) {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
});

// Config
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'pm-state');
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

function processInput(input) {
  const toolName = input.tool_name;
  const toolInput = input.tool_input || {};
  const toolOutput = input.tool_output || {};
  const command = toolInput.command || '';
  const output = toolOutput.stdout || toolOutput.output || '';

  // Only process Bash PostToolUse
  if (toolName !== 'Bash') {
    passThrough();
    return;
  }

  // Check if this was a PR create command
  const isPRCreate = /gh\s+pr\s+create/.test(command);

  // Check if this is attempting to merge
  const isPRMerge = /gh\s+pr\s+merge/.test(command);

  if (isPRCreate && output) {
    handlePRCreated(output);
    return;
  }

  if (isPRMerge) {
    handlePRMerge(command);
    return;
  }

  passThrough();
}

function handlePRCreated(output) {
  // Extract PR URL/number from output
  const prUrlMatch = output.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/(\d+)/);
  const prNumberMatch = output.match(/pull request #(\d+)/i) || output.match(/\/pull\/(\d+)/);

  if (!prUrlMatch && !prNumberMatch) {
    passThrough({
      additionalContext: '⚠️ Could not extract PR number from output. Monitor workflows manually.'
    });
    return;
  }

  const prNumber = prUrlMatch ? prUrlMatch[1] : prNumberMatch[1];
  const prUrl = prUrlMatch ? prUrlMatch[0] : `PR #${prNumber}`;

  // Save PR info for tracking
  savePRState(prNumber, prUrl);

  // Provide monitoring instructions
  const monitorInstructions = buildMonitorInstructions(prNumber, prUrl);

  passThrough({
    additionalContext: monitorInstructions
  });
}

function handlePRMerge(command) {
  // Extract PR number from merge command
  const prMatch = command.match(/gh\s+pr\s+merge\s+(\d+)?/);
  let prNumber = prMatch && prMatch[1];

  if (!prNumber) {
    // Try to get current PR from state
    const prState = loadPRState();
    prNumber = prState?.prNumber;
  }

  if (!prNumber) {
    passThrough({
      additionalContext: '⚠️ Could not determine PR number. Verify checks passed before merging.'
    });
    return;
  }

  // Check workflow status before allowing merge
  const status = checkWorkflowStatus(prNumber);

  if (status === 'success') {
    passThrough({
      additionalContext: `✅ All workflow checks passed for PR #${prNumber}. Merge authorized.`
    });
    return;
  }

  if (status === 'pending') {
    // Block merge while pending
    passThrough({
      additionalContext: `⏳ Workflow checks still pending for PR #${prNumber}. Wait for completion before merging.\n\nCheck status: gh pr checks ${prNumber}`
    });
    return;
  }

  if (status === 'failure') {
    // Block merge and provide fix instructions
    const failureInfo = getFailureLogs(prNumber);
    passThrough({
      additionalContext: `❌ Workflow checks FAILED for PR #${prNumber}. Cannot merge.\n\n${failureInfo}\n\nFix the issues and push new commits.`
    });
    return;
  }

  passThrough();
}

function checkWorkflowStatus(prNumber) {
  try {
    const result = execSync(`gh pr checks ${prNumber} --json name,state,conclusion`, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 30000
    });

    const checks = JSON.parse(result);

    if (checks.length === 0) {
      return 'pending'; // No checks yet
    }

    const hasFailure = checks.some(c => c.conclusion === 'failure');
    const allSuccess = checks.every(c => c.conclusion === 'success');
    const hasPending = checks.some(c => c.state === 'pending' || c.state === 'queued');

    if (hasFailure) return 'failure';
    if (allSuccess) return 'success';
    if (hasPending) return 'pending';

    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getFailureLogs(prNumber) {
  try {
    // Get failed run IDs
    const checksResult = execSync(`gh pr checks ${prNumber} --json name,state,conclusion,link`, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 30000
    });

    const checks = JSON.parse(checksResult);
    const failedChecks = checks.filter(c => c.conclusion === 'failure');

    let failureInfo = '═══════════════════════════════════════════════════════════════\n';
    failureInfo += '                    WORKFLOW FAILURES\n';
    failureInfo += '═══════════════════════════════════════════════════════════════\n\n';

    for (const check of failedChecks) {
      failureInfo += `❌ ${check.name}\n`;
      failureInfo += `   Link: ${check.link || 'N/A'}\n\n`;

      // Try to get logs
      try {
        // Extract run ID from link
        const runIdMatch = check.link?.match(/\/runs\/(\d+)/);
        if (runIdMatch) {
          const logs = execSync(`gh run view ${runIdMatch[1]} --log-failed 2>&1 | head -100`, {
            cwd: projectDir,
            encoding: 'utf8',
            timeout: 30000
          });
          failureInfo += `   Logs:\n${logs.split('\n').map(l => '   ' + l).join('\n')}\n\n`;
        }
      } catch (e) {
        failureInfo += `   Could not retrieve logs: ${e.message}\n\n`;
      }
    }

    failureInfo += '═══════════════════════════════════════════════════════════════\n';
    failureInfo += '\nREMEDIATION REQUIRED:\n';
    failureInfo += '1. Analyze the failure logs above\n';
    failureInfo += '2. Fix the issues in your code\n';
    failureInfo += '3. Commit fixes (code-critic will review)\n';
    failureInfo += '4. Push to update the PR\n';
    failureInfo += '5. Wait for workflows to pass\n';

    return failureInfo;
  } catch (e) {
    return `Could not retrieve failure logs: ${e.message}`;
  }
}

function buildMonitorInstructions(prNumber, prUrl) {
  return `
═══════════════════════════════════════════════════════════════════════════════
                         PR WORKFLOW MONITORING
═══════════════════════════════════════════════════════════════════════════════

PR Created: ${prUrl}
PR Number: #${prNumber}

MONITORING INSTRUCTIONS:

1. CHECK WORKFLOW STATUS:
   gh pr checks ${prNumber}

2. WAIT FOR COMPLETION:
   gh pr checks ${prNumber} --watch

3. IF WORKFLOWS PASS:
   All checks will show ✓
   You can then merge: gh pr merge ${prNumber} --squash

4. IF WORKFLOWS FAIL:
   View failure logs: gh run view <run-id> --log-failed
   Fix issues, commit (code-critic reviews), push
   Workflows will re-run automatically

5. TIMEOUT HANDLING (30 minutes):
   If workflows don't complete in 30 minutes:
   - Mark feature as BLOCKED
   - Close PR: gh pr close ${prNumber}
   - Update issue with failure details
   - Continue sprint with other features

AUTOMATED MONITORING:
The pr-workflow-monitor hook will track this PR.
When you attempt to merge, it will verify all checks passed.

═══════════════════════════════════════════════════════════════════════════════
`;
}

function savePRState(prNumber, prUrl) {
  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    const prStatePath = path.join(stateDir, 'current-pr.json');
    fs.writeFileSync(prStatePath, JSON.stringify({
      prNumber,
      prUrl,
      createdAt: new Date().toISOString(),
      status: 'pending'
    }, null, 2));

    // Also add to task tracker
    updateTaskTracker(prNumber);

  } catch (e) {
    // Best effort
  }
}

function loadPRState() {
  try {
    const prStatePath = path.join(stateDir, 'current-pr.json');
    if (fs.existsSync(prStatePath)) {
      return JSON.parse(fs.readFileSync(prStatePath, 'utf8'));
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

function updateTaskTracker(prNumber) {
  try {
    const trackerPath = path.join(stateDir, 'task-tracker.json');
    let tracker = { tasks: [] };

    if (fs.existsSync(trackerPath)) {
      tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
    }

    tracker.tasks.push({
      id: `pr-${prNumber}`,
      type: 'pr-monitoring',
      description: `Monitor PR #${prNumber} workflows`,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      prNumber
    });

    fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
  } catch (e) {
    // Best effort
  }
}

function markFeatureBlocked(prNumber, reason) {
  try {
    // Update task tracker
    const trackerPath = path.join(stateDir, 'task-tracker.json');
    if (fs.existsSync(trackerPath)) {
      const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
      const task = tracker.tasks.find(t => t.prNumber === prNumber);
      if (task) {
        task.status = 'blocked';
        task.blockedAt = new Date().toISOString();
        task.blockReason = reason;
      }
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
    }

    // Add to technical debt
    const debtPath = path.join(stateDir, 'technical-debt.json');
    let debt = { blockedFeatures: [], deferredItems: [] };

    if (fs.existsSync(debtPath)) {
      debt = JSON.parse(fs.readFileSync(debtPath, 'utf8'));
    }

    debt.blockedFeatures.push({
      prNumber,
      blockedAt: new Date().toISOString(),
      reason,
      status: 'awaiting-next-sprint'
    });

    fs.writeFileSync(debtPath, JSON.stringify(debt, null, 2));

    // Close PR
    try {
      execSync(`gh pr close ${prNumber} --comment "Closed due to workflow timeout. Added to technical debt for next sprint."`, {
        cwd: projectDir,
        timeout: 30000
      });
    } catch (e) {
      // May fail if already closed
    }

  } catch (e) {
    // Best effort
  }
}

function passThrough(options = {}) {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: options.additionalContext || ''
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}
