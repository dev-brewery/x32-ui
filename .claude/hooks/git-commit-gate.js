#!/usr/bin/env node

/**
 * Git Commit Gate Hook
 *
 * CRITICAL: This hook intercepts ALL git commit attempts and invokes the
 * code-critic subagent to review staged changes. The commit is BLOCKED
 * until code-critic approves.
 *
 * Flow:
 * 1. Detect if Bash command is a git commit
 * 2. Check if approval flag exists with matching hash
 * 3. If no approval: BLOCK and invoke code-critic
 * 4. If approved: Allow commit, delete flag
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Read input from stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    processInput(input);
  } catch (e) {
    // Not JSON or parse error - allow through
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
});

// Config
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const scriptsDir = path.join(projectDir, '.claude', 'scripts');
const stateDir = path.join(projectDir, '.claude', 'pm-state');
const approvalFlagPath = path.join(scriptsDir, 'code-approved.flag');
const paranoiaStatePath = path.join(scriptsDir, 'paranoia-state.json');

function processInput(input) {
  const toolName = input.tool_name;
  const toolInput = input.tool_input || {};
  const command = toolInput.command || '';

  // Only intercept Bash commands
  if (toolName !== 'Bash') {
    allowThrough();
    return;
  }

  // Check if this is a git commit command
  const isGitCommit = /\bgit\s+commit\b/.test(command);
  const isGitPush = /\bgit\s+push\b/.test(command);

  if (!isGitCommit && !isGitPush) {
    allowThrough();
    return;
  }

  // Handle git push - only allow if approved
  if (isGitPush) {
    handleGitPush();
    return;
  }

  // Handle git commit
  handleGitCommit();
}

function handleGitCommit() {
  try {
    // Ensure directories exist
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Get current staged changes hash
    const stagedDiff = getStagedDiff();

    if (!stagedDiff || stagedDiff.trim() === '') {
      // No staged changes - let git handle the error
      allowThrough();
      return;
    }

    const currentHash = hashString(stagedDiff);

    // Check if approval flag exists
    if (fs.existsSync(approvalFlagPath)) {
      const flagContent = JSON.parse(fs.readFileSync(approvalFlagPath, 'utf8'));

      if (flagContent.hash === currentHash) {
        // Approval is valid - allow commit
        // Delete flag after allowing
        fs.unlinkSync(approvalFlagPath);

        logAudit('git-commit-allowed', {
          hash: currentHash,
          approvedAt: flagContent.approvedAt
        });

        allowThrough({
          additionalContext: '✅ Code previously approved by code-critic. Commit authorized.'
        });
        return;
      } else {
        // Hash mismatch - staged changes modified since approval
        fs.unlinkSync(approvalFlagPath);

        blockCommit(
          'Staged changes have been modified since last approval.\n' +
          'The code-critic must review the new changes.\n\n' +
          'INVOKING CODE-CRITIC FOR REVIEW...\n\n' +
          buildCriticInvocation(stagedDiff)
        );
        return;
      }
    }

    // No approval flag - invoke code-critic
    blockCommit(
      '🛑 COMMIT BLOCKED - CODE REVIEW REQUIRED\n\n' +
      'The code-critic agent must review all staged changes before commit.\n\n' +
      buildCriticInvocation(stagedDiff)
    );

  } catch (error) {
    // On error, block and report
    blockCommit(`Error in git-commit-gate: ${error.message}`);
  }
}

function handleGitPush() {
  try {
    // Check if last commit was approved
    // We track this by checking if an approval happened recently
    const auditPath = path.join(stateDir, 'audit-log.json');

    if (fs.existsSync(auditPath)) {
      const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      const recentApproval = audit.find(
        entry => entry.event === 'git-commit-allowed' &&
        new Date(entry.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Within 5 minutes
      );

      if (recentApproval) {
        allowThrough({
          additionalContext: '✅ Recent commit was approved. Push authorized.'
        });
        return;
      }
    }

    // No recent approval found - check if we have any commits
    // Allow push but warn
    allowThrough({
      additionalContext: '⚠️ Push proceeding. Ensure commits were reviewed by code-critic.'
    });

  } catch (error) {
    // On error, allow but warn
    allowThrough({
      additionalContext: `⚠️ Could not verify approval status: ${error.message}`
    });
  }
}

function getStagedDiff() {
  try {
    return execSync('git diff --cached', {
      cwd: projectDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
  } catch (e) {
    return '';
  }
}

function getStagedFiles() {
  try {
    return execSync('git diff --cached --name-only', {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function getParanoiaState(diffHash) {
  try {
    if (fs.existsSync(paranoiaStatePath)) {
      const state = JSON.parse(fs.readFileSync(paranoiaStatePath, 'utf8'));
      if (state.hash === diffHash) {
        return state;
      }
    }
  } catch (e) {}
  return { hash: diffHash, phase: 1, attempts: 0 };
}

function saveParanoiaState(state) {
  try {
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    fs.writeFileSync(paranoiaStatePath, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function clearParanoiaState() {
  try {
    if (fs.existsSync(paranoiaStatePath)) {
      fs.unlinkSync(paranoiaStatePath);
    }
  } catch (e) {}
}

function buildCriticInvocation(stagedDiff) {
  const stagedFiles = getStagedFiles();
  const fileCount = stagedFiles.length;
  const paranoiaRequired = fileCount >= 10;
  const diffHash = hashString(stagedDiff);

  // Get or initialize paranoia state for 10+ file reviews
  let paranoiaState = paranoiaRequired ? getParanoiaState(diffHash) : null;
  if (paranoiaState) {
    paranoiaState.attempts++;
    saveParanoiaState(paranoiaState);
  }

  // Detect file types for targeted searches
  const fileTypes = new Set();
  for (const file of stagedFiles) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') fileTypes.add('TypeScript');
    if (ext === '.js' || ext === '.jsx') fileTypes.add('JavaScript');
    if (ext === '.py') fileTypes.add('Python');
    if (ext === '.go') fileTypes.add('Go');
    if (ext === '.rs') fileTypes.add('Rust');
    if (ext === '.css' || ext === '.scss') fileTypes.add('CSS');
    if (ext === '.sql') fileTypes.add('SQL');
  }

  // Detect frameworks from imports
  let framework = 'general';
  if (stagedDiff.includes('from \'react\'') || stagedDiff.includes('from "react"')) framework = 'React';
  if (stagedDiff.includes('from \'vue\'') || stagedDiff.includes('from "vue"')) framework = 'Vue';
  if (stagedDiff.includes('from \'@angular')) framework = 'Angular';
  if (stagedDiff.includes('from \'express\'')) framework = 'Express';
  if (stagedDiff.includes('from \'@nestjs')) framework = 'NestJS';
  if (stagedDiff.includes('from \'next')) framework = 'Next.js';

  let paranoiaSection = '';
  if (paranoiaRequired) {
    const currentPhase = paranoiaState ? paranoiaState.phase : 1;
    const attemptNum = paranoiaState ? paranoiaState.attempts : 1;

    paranoiaSection = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    ⚠️  PARANOIA PROTOCOL TRIGGERED  ⚠️                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  ${fileCount} FILES STAGED - Enhanced scrutiny REQUIRED.                             ║
║  Current Phase: ${currentPhase}/3 | Review Attempt: ${attemptNum}                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

    if (currentPhase === 1) {
      paranoiaSection += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ ► PHASE 1: Standard Review (CURRENT)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Run npm run lint                                                          │
│ • Run npm test                                                              │
│ • Check all quality standards                                               │
│ • Security scan                                                             │
│                                                                             │
│ If ANY issues found → REJECT immediately                                    │
│ If PASS → Advance to Phase 2 on next attempt                                │
└─────────────────────────────────────────────────────────────────────────────┘

To advance to Phase 2 after code-critic finds no issues in Phase 1:
echo '${JSON.stringify({ hash: diffHash, phase: 2, attempts: attemptNum })}' > "${paranoiaStatePath.replace(/\\/g, '/')}"
`;
    } else if (currentPhase === 2) {
      paranoiaSection += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✓ PHASE 1: Standard Review - PASSED                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ► PHASE 2: Deep Inspection (CURRENT)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ The code passed Phase 1. Now look HARDER.                                   │
│                                                                             │
│ For EACH of the ${fileCount} files, check:                                          │
│ • Trailing whitespace                                                       │
│ • Mixed tabs/spaces                                                         │
│ • Import ordering (external → internal → relative)                          │
│ • Unused imports                                                            │
│ • Console statements (even commented)                                       │
│ • TODO/FIXME without ticket numbers                                         │
│ • Hardcoded strings that should be constants                                │
│ • Function parameter counts (>4 is suspicious)                              │
│ • Nesting depth (>2 levels is concerning)                                   │
│ • Missing JSDoc on exports                                                  │
│ • Inconsistent naming conventions                                           │
│ • File length (>200 lines needs justification)                              │
│ • Missing blank lines between functions                                     │
│ • Non-descriptive loop variables                                            │
│ • Magic numbers                                                             │
│                                                                             │
│ If ANY micro-issue found → REJECT and reset to Phase 1                      │
│ If PASS → Advance to Phase 3 on next attempt                                │
└─────────────────────────────────────────────────────────────────────────────┘

To advance to Phase 3 after code-critic finds no micro-issues:
echo '${JSON.stringify({ hash: diffHash, phase: 3, attempts: attemptNum })}' > "${paranoiaStatePath.replace(/\\/g, '/')}"
`;
    } else if (currentPhase === 3) {
      paranoiaSection += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✓ PHASE 1: Standard Review - PASSED                                        │
│ ✓ PHASE 2: Deep Inspection - PASSED                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ► PHASE 3: Industry Standards Research (CURRENT - FINAL)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ The developer passed Phase 2? They think they're clever.                    │
│                                                                             │
│ ** SPAWN THE standards-researcher AGENT FIRST **                            │
│                                                                             │
│ The standards-researcher will:                                              │
│ • Search web for "${framework} coding standards 2025"                       │
│ • Search for "${[...fileTypes].join(' ')} best practices"                   │
│ • Search for "${framework} anti-patterns to avoid"                          │
│ • Search for "common ${framework} security vulnerabilities 2025"            │
│ • Return a report with potential issues for code-critic to check            │
│                                                                             │
│ PROCESS:                                                                    │
│ 1. Spawn standards-researcher agent with file list & framework              │
│ 2. Wait for research report                                                 │
│ 3. Code-critic reviews staged code against research findings                │
│ 4. If ANY issues found → REJECT & reset to Phase 1                          │
│ 5. If code passes research-backed review → RELUCTANT APPROVAL               │
└─────────────────────────────────────────────────────────────────────────────┘

Invoke standards-researcher with:
  - Files: ${stagedFiles.slice(0, 5).join(', ')}${stagedFiles.length > 5 ? '...' : ''}
  - Framework: ${framework}
  - Languages: ${[...fileTypes].join(', ')}
`;
    }

    paranoiaSection += `
This is attempt ${attemptNum} at Phase ${currentPhase}. The hook is tracking progress.
`;
  }

  return `
═══════════════════════════════════════════════════════════════════════════════
                         CODE-CRITIC REVIEW REQUIRED
═══════════════════════════════════════════════════════════════════════════════

You must invoke the code-critic subagent to review the staged changes.

STAGED FILES (${fileCount}):
${stagedFiles.map(f => `  - ${f}`).join('\n')}

DETECTED TECHNOLOGIES:
  - Languages: ${[...fileTypes].join(', ') || 'Unknown'}
  - Framework: ${framework}
${paranoiaSection}

INSTRUCTIONS FOR CLAUDE:
1. Use the Task tool to invoke the code-critic agent
2. Provide the following context to code-critic:
   - The staged diff (shown below)
   - Number of files: ${fileCount}
   - ${paranoiaRequired ? 'PARANOIA PROTOCOL IS MANDATORY (10+ files)' : 'Standard review protocol'}
   - Instructions to run: npm run lint, npm test
   - Request thorough security and quality review
   ${paranoiaRequired ? '- REQUIRE web search for industry standards verification' : ''}

3. If code-critic APPROVES:
   ${paranoiaRequired ? '- Verify all three phases were completed' : '- Verify standard review was thorough'}
   - Create the approval flag (command below)
   - Retry the git commit command

4. If code-critic REJECTS:
   - Fix ALL issues identified
   - Stage the fixes
   - Retry git commit (will trigger new review)

═══════════════════════════════════════════════════════════════════════════════
                              STAGED DIFF
═══════════════════════════════════════════════════════════════════════════════

${stagedDiff.substring(0, 5000)}${stagedDiff.length > 5000 ? '\n\n... (diff truncated, ' + stagedDiff.length + ' total characters)' : ''}

═══════════════════════════════════════════════════════════════════════════════

IMPORTANT: The commit will remain blocked until code-critic approves.
After approval, retry: git commit -m "your message"

To create the approval flag after code-critic approves, Claude should run:

echo '${JSON.stringify({ hash: hashString(stagedDiff), approvedAt: new Date().toISOString(), fileCount, paranoiaProtocol: paranoiaRequired })}' > "${approvalFlagPath.replace(/\\/g, '/')}"

═══════════════════════════════════════════════════════════════════════════════
`;
}

function allowThrough(options = {}) {
  const output = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: options.additionalContext || ''
    }
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

function blockCommit(reason) {
  const output = {
    continue: false,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
  console.log(JSON.stringify(output));
  process.exit(2); // Exit code 2 = blocking error
}

function logAudit(event, details) {
  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    const auditPath = path.join(stateDir, 'audit-log.json');
    let audit = [];

    if (fs.existsSync(auditPath)) {
      audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }

    audit.push({
      timestamp: new Date().toISOString(),
      event,
      ...details
    });

    // Keep last 500 entries
    if (audit.length > 500) {
      audit = audit.slice(-500);
    }

    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  } catch (e) {
    // Audit is best-effort
  }
}
