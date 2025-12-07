#!/usr/bin/env node

/**
 * Git Push Gate Hook
 *
 * Runs local versions of GitHub CI workflows before allowing push.
 * This is the second quality gate after code-critic approves the commit.
 *
 * Flow:
 *   1. Developer writes code
 *   2. git commit → code-critic blocks until code quality passes
 *   3. git push → THIS HOOK runs local CI checks
 *   4. If checks FAIL → spawn ci-fixer agent to fix issues
 *   5. ci-fixer commits fixes → code-critic re-engages (loop back to step 2)
 *   6. Only if all checks pass → push proceeds
 *   7. GitHub Actions run (should pass since we pre-validated)
 *
 * The ci-fixer agent is spawned via instructions to Claude, which will
 * then use the Task tool to invoke the appropriate fixer agent.
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
    allowPush();
  }
});

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function processInput(input) {
  const toolInput = input.tool_input || {};
  const command = toolInput.command || '';

  // Only intercept git push commands
  if (!command.match(/git\s+push/i)) {
    allowPush();
    return;
  }

  // Check if we're pushing to a branch that matters
  const branchMatch = command.match(/git\s+push\s+\S+\s+(\S+)/);
  const currentBranch = getCurrentBranch();

  console.error('\n');
  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('                         GIT PUSH GATE - LOCAL CI');
  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error(`Branch: ${currentBranch}`);
  console.error('Running local CI checks before push...');
  console.error('');

  const results = {
    branchNaming: { status: 'pending', message: '' },
    commitLint: { status: 'pending', message: '' },
    lint: { status: 'pending', message: '' },
    typecheck: { status: 'pending', message: '' },
    tests: { status: 'pending', message: '' },
    security: { status: 'pending', message: '' }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Check 1: Branch Naming Convention
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [1/6] Checking branch naming convention...');

  const validBranchPattern = /^(feature|bugfix|hotfix|release|chore|docs|refactor|test)\/[a-z0-9._-]+$/;
  const protectedBranches = ['main', 'master', 'develop'];

  if (protectedBranches.includes(currentBranch)) {
    results.branchNaming = { status: 'skip', message: 'Protected branch (direct push)' };
  } else if (validBranchPattern.test(currentBranch)) {
    results.branchNaming = { status: 'pass', message: 'Branch name follows convention' };
  } else {
    results.branchNaming = {
      status: 'fail',
      message: `Invalid branch name: ${currentBranch}\n` +
        'Expected: <type>/<description>\n' +
        'Types: feature, bugfix, hotfix, release, chore, docs, refactor, test'
    };
  }
  logResult('Branch Naming', results.branchNaming);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 2: Commit Message Lint
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [2/6] Checking commit messages...');

  const commitLintResult = checkCommitMessages();
  results.commitLint = commitLintResult;
  logResult('Commit Lint', results.commitLint);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 3: Linting (ESLint/Prettier)
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [3/6] Running linter...');

  const lintResult = runLint();
  results.lint = lintResult;
  logResult('Lint', results.lint);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 4: TypeScript Type Check
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [4/6] Running TypeScript check...');

  const typecheckResult = runTypeCheck();
  results.typecheck = typecheckResult;
  logResult('TypeScript', results.typecheck);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 5: Tests
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [5/6] Running tests...');

  const testResult = runTests();
  results.tests = testResult;
  logResult('Tests', results.tests);

  // ─────────────────────────────────────────────────────────────────────────
  // Check 6: Security Scan
  // ─────────────────────────────────────────────────────────────────────────
  console.error('📋 [6/6] Running security scan...');

  const securityResult = runSecurityScan();
  results.security = securityResult;
  logResult('Security', results.security);

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('                              LOCAL CI RESULTS');
  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('');

  const failed = [];
  const passed = [];
  const skipped = [];

  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'fail') {
      failed.push({ name, ...result });
    } else if (result.status === 'pass') {
      passed.push({ name, ...result });
    } else {
      skipped.push({ name, ...result });
    }
  }

  // Print summary
  for (const item of passed) {
    console.error(`  ✅ ${formatName(item.name)}: PASSED`);
  }
  for (const item of skipped) {
    console.error(`  ⏭️  ${formatName(item.name)}: SKIPPED (${item.message})`);
  }
  for (const item of failed) {
    console.error(`  ❌ ${formatName(item.name)}: FAILED`);
  }

  console.error('');

  if (failed.length > 0) {
    console.error('═══════════════════════════════════════════════════════════════════════════════');
    console.error('                              PUSH BLOCKED');
    console.error('═══════════════════════════════════════════════════════════════════════════════');
    console.error('');
    console.error(`${failed.length} check(s) failed. Spawning ci-fixer agent...`);
    console.error('');

    for (const item of failed) {
      console.error(`─── ${formatName(item.name)} ───`);
      console.error(item.message);
      console.error('');
    }

    console.error('═══════════════════════════════════════════════════════════════════════════════');

    // Build detailed fix instructions for the ci-fixer agent
    const fixInstructions = buildFixInstructions(failed, results);

    // Save CI failure state for the fixer agent
    saveCIFailureState(failed, results);

    blockPush(
      `🔧 LOCAL CI FAILED - SPAWNING CI-FIXER AGENT\n\n` +
      `Failed checks: ${failed.map(f => formatName(f.name)).join(', ')}\n\n` +
      `═══════════════════════════════════════════════════════════════════════════════\n` +
      `                         CI-FIXER AGENT INSTRUCTIONS\n` +
      `═══════════════════════════════════════════════════════════════════════════════\n\n` +
      `You MUST now spawn the ci-fixer agent to fix these issues.\n\n` +
      `Use the Task tool with:\n` +
      `  subagent_type: "ci-fixer"\n` +
      `  prompt: See below\n\n` +
      `─────────────────────────────────────────────────────────────────────────────────\n` +
      `CI-FIXER PROMPT:\n` +
      `─────────────────────────────────────────────────────────────────────────────────\n\n` +
      fixInstructions + `\n\n` +
      `─────────────────────────────────────────────────────────────────────────────────\n\n` +
      `After the ci-fixer agent completes:\n` +
      `1. The fixes will be committed (code-critic will review)\n` +
      `2. Once code-critic approves, retry: git push\n` +
      `3. Local CI will run again to verify fixes\n\n` +
      `This loop continues until all checks pass.\n\n` +
      `═══════════════════════════════════════════════════════════════════════════════`
    );
    return;
  }

  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('                              PUSH AUTHORIZED');
  console.error('═══════════════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error('All local CI checks passed. Push will proceed.');
  console.error('GitHub Actions should pass based on these pre-checks.');
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════════════════════');

  allowPush();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim();
  } catch (e) {
    return 'unknown';
  }
}

function checkCommitMessages() {
  try {
    // Get commits not on main/master
    const mainBranch = getMainBranch();
    const commits = execSync(`git log ${mainBranch}..HEAD --format=%s 2>/dev/null || git log -10 --format=%s`, {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);

    if (commits.length === 0) {
      return { status: 'skip', message: 'No new commits to check' };
    }

    const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .+$/;
    const invalid = [];

    for (const commit of commits) {
      if (!conventionalPattern.test(commit)) {
        invalid.push(commit);
      }
    }

    if (invalid.length > 0) {
      return {
        status: 'fail',
        message: `Invalid commit messages:\n${invalid.map(c => `  - "${c}"`).join('\n')}\n\n` +
          'Expected format: type(scope): description\n' +
          'Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert'
      };
    }

    return { status: 'pass', message: `${commits.length} commit(s) follow conventional format` };
  } catch (e) {
    return { status: 'skip', message: 'Could not check commits' };
  }
}

function runLint() {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { status: 'skip', message: 'No package.json found' };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};

    // Try different lint commands
    if (scripts.lint) {
      const result = spawnSync('npm', ['run', 'lint'], {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 60000,
        shell: true
      });

      if (result.status === 0) {
        return { status: 'pass', message: 'Lint passed' };
      } else {
        return {
          status: 'fail',
          message: `Lint errors:\n${result.stdout || result.stderr || 'Unknown error'}`
        };
      }
    }

    // Check if eslint is available
    if (packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint) {
      const result = spawnSync('npx', ['eslint', '.', '--ext', '.js,.jsx,.ts,.tsx', '--max-warnings', '0'], {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 60000,
        shell: true
      });

      if (result.status === 0) {
        return { status: 'pass', message: 'ESLint passed' };
      } else {
        return {
          status: 'fail',
          message: `ESLint errors:\n${result.stdout || result.stderr || 'Unknown error'}`
        };
      }
    }

    return { status: 'skip', message: 'No lint script or ESLint configured' };
  } catch (e) {
    return { status: 'skip', message: `Lint check error: ${e.message}` };
  }
}

function runTypeCheck() {
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');

  if (!fs.existsSync(tsconfigPath)) {
    return { status: 'skip', message: 'No tsconfig.json found' };
  }

  try {
    const packageJsonPath = path.join(projectDir, 'package.json');
    let hasTypeScript = false;

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};

      // Try typecheck script first
      if (scripts.typecheck) {
        const result = spawnSync('npm', ['run', 'typecheck'], {
          cwd: projectDir,
          encoding: 'utf8',
          timeout: 120000,
          shell: true
        });

        if (result.status === 0) {
          return { status: 'pass', message: 'TypeScript check passed' };
        } else {
          return {
            status: 'fail',
            message: `TypeScript errors:\n${result.stdout || result.stderr || 'Unknown error'}`
          };
        }
      }

      hasTypeScript = packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript;
    }

    if (hasTypeScript) {
      const result = spawnSync('npx', ['tsc', '--noEmit'], {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 120000,
        shell: true
      });

      if (result.status === 0) {
        return { status: 'pass', message: 'TypeScript check passed' };
      } else {
        return {
          status: 'fail',
          message: `TypeScript errors:\n${result.stdout || result.stderr || 'Unknown error'}`
        };
      }
    }

    return { status: 'skip', message: 'TypeScript not installed' };
  } catch (e) {
    return { status: 'skip', message: `TypeScript check error: ${e.message}` };
  }
}

function runTests() {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { status: 'skip', message: 'No package.json found' };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};

    if (!scripts.test || scripts.test.includes('no test specified')) {
      return { status: 'skip', message: 'No test script configured' };
    }

    const result = spawnSync('npm', ['test'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 300000, // 5 minutes for tests
      shell: true,
      env: { ...process.env, CI: 'true' }
    });

    if (result.status === 0) {
      return { status: 'pass', message: 'All tests passed' };
    } else {
      return {
        status: 'fail',
        message: `Test failures:\n${result.stdout || result.stderr || 'Unknown error'}`
      };
    }
  } catch (e) {
    return { status: 'skip', message: `Test error: ${e.message}` };
  }
}

function runSecurityScan() {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { status: 'skip', message: 'No package.json found' };
  }

  try {
    // Run npm audit
    const result = spawnSync('npm', ['audit', '--audit-level=high'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 60000,
      shell: true
    });

    if (result.status === 0) {
      return { status: 'pass', message: 'No high/critical vulnerabilities' };
    } else {
      // Check if it's just warnings vs actual high/critical issues
      const output = result.stdout || result.stderr || '';
      if (output.includes('high') || output.includes('critical')) {
        return {
          status: 'fail',
          message: `Security vulnerabilities found:\n${output.slice(0, 500)}`
        };
      }
      return { status: 'pass', message: 'No high/critical vulnerabilities' };
    }
  } catch (e) {
    return { status: 'skip', message: `Security scan error: ${e.message}` };
  }
}

function getMainBranch() {
  try {
    // Check if main exists
    execSync('git rev-parse --verify main', { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
    return 'main';
  } catch (e) {
    try {
      // Check if master exists
      execSync('git rev-parse --verify master', { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
      return 'master';
    } catch (e2) {
      return 'HEAD~10'; // Fallback to last 10 commits
    }
  }
}

function formatName(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function buildFixInstructions(failed, allResults) {
  const lines = [];

  lines.push('Fix the following CI failures so the push can proceed:');
  lines.push('');

  for (const failure of failed) {
    lines.push(`## ${formatName(failure.name).toUpperCase()} FAILURE`);
    lines.push('');

    switch (failure.name) {
      case 'branchNaming':
        lines.push('The branch name does not follow conventions.');
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Create a new branch with proper naming:');
        lines.push('   git checkout -b <type>/<description>');
        lines.push('   Types: feature, bugfix, hotfix, release, chore, docs, refactor, test');
        lines.push('2. Cherry-pick or merge commits to the new branch');
        lines.push('3. Delete the old branch');
        break;

      case 'commitLint':
        lines.push('Commit messages do not follow Conventional Commits format.');
        lines.push('');
        lines.push('INVALID COMMITS:');
        lines.push(failure.message);
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Use git rebase -i to edit commit messages');
        lines.push('2. Format: type(scope): description');
        lines.push('   Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert');
        lines.push('   Example: feat(auth): add login endpoint');
        break;

      case 'lint':
        lines.push('ESLint/Prettier found code style issues.');
        lines.push('');
        lines.push('ERRORS:');
        lines.push(failure.message.slice(0, 2000));
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Run: npm run lint -- --fix (if available)');
        lines.push('2. Or: npx eslint . --fix');
        lines.push('3. Manually fix any remaining issues');
        lines.push('4. Stage and commit the fixes');
        break;

      case 'typecheck':
        lines.push('TypeScript compilation found type errors.');
        lines.push('');
        lines.push('ERRORS:');
        lines.push(failure.message.slice(0, 2000));
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Fix all TypeScript errors listed above');
        lines.push('2. Run: npx tsc --noEmit to verify');
        lines.push('3. Stage and commit the fixes');
        break;

      case 'tests':
        lines.push('Test suite has failures.');
        lines.push('');
        lines.push('FAILURES:');
        lines.push(failure.message.slice(0, 2000));
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Fix the failing tests or the code they test');
        lines.push('2. Run: npm test to verify all pass');
        lines.push('3. Stage and commit the fixes');
        break;

      case 'security':
        lines.push('Security vulnerabilities found in dependencies.');
        lines.push('');
        lines.push('VULNERABILITIES:');
        lines.push(failure.message.slice(0, 2000));
        lines.push('');
        lines.push('ACTION REQUIRED:');
        lines.push('1. Run: npm audit fix');
        lines.push('2. If that fails, manually update vulnerable packages');
        lines.push('3. Run: npm audit to verify');
        lines.push('4. Stage and commit package.json/package-lock.json changes');
        break;

      default:
        lines.push('Error details:');
        lines.push(failure.message);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('IMPORTANT:');
  lines.push('- After fixing, commit your changes with a proper message');
  lines.push('- The code-critic will review the commit');
  lines.push('- Once approved, the push will be retried');
  lines.push('- Local CI will run again to verify all issues are resolved');

  return lines.join('\n');
}

function saveCIFailureState(failed, allResults) {
  const stateDir = path.join(projectDir, '.claude', 'pm-state');
  const ciStatePath = path.join(stateDir, 'ci-failure.json');

  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    const state = {
      timestamp: new Date().toISOString(),
      branch: getCurrentBranch(),
      failed: failed.map(f => ({
        name: f.name,
        status: f.status,
        message: f.message.slice(0, 5000) // Limit message size
      })),
      allResults: Object.fromEntries(
        Object.entries(allResults).map(([k, v]) => [k, {
          status: v.status,
          message: v.message.slice(0, 1000)
        }])
      ),
      fixAttempts: incrementFixAttempts(ciStatePath)
    };

    fs.writeFileSync(ciStatePath, JSON.stringify(state, null, 2));
  } catch (e) {
    // Best effort state saving
  }
}

function incrementFixAttempts(ciStatePath) {
  try {
    if (fs.existsSync(ciStatePath)) {
      const existing = JSON.parse(fs.readFileSync(ciStatePath, 'utf8'));
      return (existing.fixAttempts || 0) + 1;
    }
  } catch (e) {
    // Ignore
  }
  return 1;
}

function logResult(name, result) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
  console.error(`   ${icon} ${result.status.toUpperCase()}`);
}

function allowPush(message = '') {
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

function blockPush(reason) {
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
