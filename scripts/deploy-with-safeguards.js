#!/usr/bin/env node

/**
 * Safe Deployment Script with Confirmations
 *
 * Prevents accidental production deployments by requiring explicit confirmation
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get target environment from command line
const target = process.argv[2]; // 'dev' or 'prod'

if (!target || !['dev', 'prod', 'production'].includes(target)) {
  console.error('❌ Error: Must specify target environment');
  console.error('Usage: node scripts/deploy-with-safeguards.js <dev|prod>');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/deploy-with-safeguards.js dev   # Deploy to development');
  console.error('  node scripts/deploy-with-safeguards.js prod  # Deploy to production (requires confirmation)');
  process.exit(1);
}

const isProduction = ['prod', 'production'].includes(target);
const environment = isProduction ? 'production' : 'dev';
const projectId = isProduction ? 'meal-planner-v1-9be19' : 'meal-planner-dev-141e2';
const url = isProduction ? 'https://meal-planner-v1-9be19.web.app' : 'https://meal-planner-dev-141e2.web.app';

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Check for uncommitted changes
 */
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain').toString();
    return status.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Ask user for confirmation
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

/**
 * Production deployment with safeguards
 */
async function deployToProduction() {
  console.log('');
  console.log('⚠️  WARNING: PRODUCTION DEPLOYMENT ⚠️');
  console.log('='.repeat(50));
  console.log(`Target: ${projectId}`);
  console.log(`URL: ${url}`);
  console.log(`Branch: ${getCurrentBranch()}`);
  console.log('='.repeat(50));
  console.log('');

  // Check 1: Branch should be main
  const currentBranch = getCurrentBranch();
  if (currentBranch !== 'main') {
    console.log('❌ ERROR: Production deployments must be from main branch');
    console.log(`   Current branch: ${currentBranch}`);
    console.log('');
    console.log('To deploy to production:');
    console.log('1. git checkout main');
    console.log('2. git pull origin main');
    console.log('3. npm run deploy:prod');
    console.log('');
    process.exit(1);
  }

  // Check 2: No uncommitted changes
  if (hasUncommittedChanges()) {
    console.log('❌ ERROR: You have uncommitted changes');
    console.log('   Commit or stash your changes before deploying');
    console.log('');
    process.exit(1);
  }

  // Check 3: Explicit confirmation required
  console.log('This will deploy to PRODUCTION (live users will see this)');
  console.log('');
  const answer1 = await askQuestion('Are you sure you want to deploy to PRODUCTION? (yes/no): ');

  if (answer1 !== 'yes') {
    console.log('❌ Deployment cancelled');
    rl.close();
    process.exit(0);
  }

  console.log('');
  const answer2 = await askQuestion('Type "DEPLOY TO PRODUCTION" to confirm: ');

  if (answer2 !== 'deploy to production') {
    console.log('❌ Confirmation failed. Deployment cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('');
  console.log('✅ Confirmation received. Starting production deployment...');
  console.log('');

  rl.close();
  return true;
}

/**
 * Development deployment (no confirmation needed)
 */
async function deployToDevelopment() {
  console.log('');
  console.log('🚀 Development Deployment');
  console.log('='.repeat(50));
  console.log(`Target: ${projectId}`);
  console.log(`URL: ${url}`);
  console.log(`Branch: ${getCurrentBranch()}`);
  console.log('='.repeat(50));
  console.log('');

  const currentBranch = getCurrentBranch();
  if (currentBranch === 'main') {
    console.log('⚠️  WARNING: You are on main branch');
    console.log('   Development deployments are usually from dev branch');
    console.log('');
    const answer = await askQuestion('Continue anyway? (yes/no): ');
    if (answer !== 'yes') {
      console.log('❌ Deployment cancelled');
      rl.close();
      process.exit(0);
    }
  }

  rl.close();
  return true;
}

/**
 * Execute deployment
 */
async function deploy() {
  try {
    // Run appropriate confirmation flow
    if (isProduction) {
      const confirmed = await deployToProduction();
      if (!confirmed) return;
    } else {
      const confirmed = await deployToDevelopment();
      if (!confirmed) return;
    }

    // Build for the target environment
    console.log('📦 Building application...');
    const buildCommand = isProduction ? 'npm run build:prod' : 'npm run build:dev';
    execSync(buildCommand, { stdio: 'inherit' });

    // Switch to target Firebase project
    console.log(`🔄 Switching to ${environment} environment...`);
    execSync(`firebase use ${environment}`, { stdio: 'inherit' });

    // Deploy
    console.log(`🚀 Deploying to ${environment}...`);
    execSync('firebase deploy', { stdio: 'inherit' });

    // Success
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ Deployment Complete!');
    console.log('='.repeat(50));
    console.log(`Environment: ${environment}`);
    console.log(`URL: ${url}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deploy();
