#!/usr/bin/env node

/**
 * Development Story Generator
 *
 * Automatically generates narrative documentation from git commits,
 * capturing challenges, solutions, and the development journey.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const STORY_DIR = path.join(__dirname, '../docs/stories');
const BRANCH = process.env.GITHUB_REF_NAME || getCurrentBranch();
const COMMIT_SHA = process.env.GITHUB_SHA || getCurrentCommit();

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
 * Get current commit SHA
 */
function getCurrentCommit() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get commits since last story update
 */
function getRecentCommits(limit = 10) {
  try {
    // Get last story file to determine start point
    const files = fs.readdirSync(STORY_DIR).filter(f => f.endsWith('.md')).sort().reverse();
    let sinceCommit = '';

    if (files.length > 0) {
      const lastStory = fs.readFileSync(path.join(STORY_DIR, files[0]), 'utf8');
      const match = lastStory.match(/Commit: `([a-f0-9]+)`/);
      if (match) {
        sinceCommit = match[1];
      }
    }

    const cmd = sinceCommit
      ? `git log ${sinceCommit}..HEAD --pretty=format:"%H|%an|%ae|%ai|%s|%b" --no-merges`
      : `git log -${limit} --pretty=format:"%H|%an|%ae|%ai|%s|%b" --no-merges`;

    const output = execSync(cmd).toString();

    if (!output.trim()) {
      return [];
    }

    return output.trim().split('\n\n').map(commitBlock => {
      const [metadata, ...bodyLines] = commitBlock.split('\n');
      const [hash, author, email, date, subject] = metadata.split('|');
      const body = bodyLines.join('\n').trim();

      return {
        hash: hash?.slice(0, 7),
        fullHash: hash,
        author,
        email,
        date: new Date(date),
        subject,
        body,
        type: extractCommitType(subject),
        scope: extractCommitScope(subject),
        challenges: extractChallenges(body),
        solutions: extractSolutions(body),
        breakingChanges: body.includes('BREAKING CHANGE')
      };
    });
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return [];
  }
}

/**
 * Extract commit type from conventional commit format
 */
function extractCommitType(subject) {
  const match = subject.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\(.*?\))?:/);
  return match ? match[1] : 'other';
}

/**
 * Extract commit scope
 */
function extractCommitScope(subject) {
  const match = subject.match(/^[a-z]+\((.+?)\):/);
  return match ? match[1] : null;
}

/**
 * Extract challenges from commit body
 */
function extractChallenges(body) {
  const challenges = [];

  // Look for explicit challenge markers
  const challengePatterns = [
    /Challenge[s]?:(.+?)(?:\n\n|Solution|$)/gis,
    /Problem[s]?:(.+?)(?:\n\n|Solution|$)/gis,
    /Issue[s]?:(.+?)(?:\n\n|Solution|$)/gis,
    /Blocker[s]?:(.+?)(?:\n\n|Solution|$)/gis
  ];

  for (const pattern of challengePatterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      challenges.push(match[1].trim());
    }
  }

  return challenges;
}

/**
 * Extract solutions from commit body
 */
function extractSolutions(body) {
  const solutions = [];

  // Look for explicit solution markers
  const solutionPatterns = [
    /Solution[s]?:(.+?)(?:\n\n|$)/gis,
    /Fix:(.+?)(?:\n\n|$)/gis,
    /Resolution:(.+?)(?:\n\n|$)/gis,
    /Approach:(.+?)(?:\n\n|$)/gis
  ];

  for (const pattern of solutionPatterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      solutions.push(match[1].trim());
    }
  }

  return solutions;
}

/**
 * Get files changed in commits
 */
function getChangedFiles(commits) {
  const files = new Set();

  commits.forEach(commit => {
    try {
      const output = execSync(`git diff-tree --no-commit-id --name-only -r ${commit.fullHash}`).toString();
      output.trim().split('\n').forEach(file => files.add(file));
    } catch (error) {
      // Skip on error
    }
  });

  return Array.from(files);
}

/**
 * Generate story content
 */
function generateStoryContent(commits) {
  const date = new Date().toISOString().split('T')[0];
  const changedFiles = getChangedFiles(commits);

  // Group commits by type
  const commitsByType = {
    feat: [],
    fix: [],
    docs: [],
    refactor: [],
    other: []
  };

  commits.forEach(commit => {
    const type = commit.type;
    if (commitsByType[type]) {
      commitsByType[type].push(commit);
    } else {
      commitsByType.other.push(commit);
    }
  });

  // Extract all challenges and solutions
  const allChallenges = commits.flatMap(c => c.challenges).filter(Boolean);
  const allSolutions = commits.flatMap(c => c.solutions).filter(Boolean);

  // Generate story
  let story = `# Development Story: ${date}\n\n`;
  story += `**Branch**: \`${BRANCH}\`  \n`;
  story += `**Commit**: \`${COMMIT_SHA.slice(0, 7)}\`  \n`;
  story += `**Date**: ${new Date().toLocaleString()}  \n`;
  story += `**Commits in this update**: ${commits.length}\n\n`;

  story += `---\n\n`;

  // Summary
  story += `## Summary\n\n`;
  story += generateSummary(commits, commitsByType);
  story += `\n\n`;

  // Features
  if (commitsByType.feat.length > 0) {
    story += `## New Features\n\n`;
    commitsByType.feat.forEach(commit => {
      story += `### ${commit.subject.replace(/^feat(\(.*?\))?:\s*/i, '')}\n\n`;
      story += `**Commit**: [\`${commit.hash}\`](../../commit/${commit.fullHash})  \n`;
      story += `**Author**: ${commit.author}  \n\n`;

      if (commit.body) {
        story += `${commit.body}\n\n`;
      }

      if (commit.challenges.length > 0) {
        story += `**Challenges**:\n`;
        commit.challenges.forEach(challenge => {
          story += `- ${challenge}\n`;
        });
        story += `\n`;
      }

      if (commit.solutions.length > 0) {
        story += `**Solutions**:\n`;
        commit.solutions.forEach(solution => {
          story += `- ${solution}\n`;
        });
        story += `\n`;
      }
    });
  }

  // Bug Fixes
  if (commitsByType.fix.length > 0) {
    story += `## Bug Fixes\n\n`;
    commitsByType.fix.forEach(commit => {
      story += `### ${commit.subject.replace(/^fix(\(.*?\))?:\s*/i, '')}\n\n`;
      story += `**Commit**: [\`${commit.hash}\`](../../commit/${commit.fullHash})  \n`;
      story += `**Author**: ${commit.author}  \n\n`;

      if (commit.body) {
        story += `${commit.body}\n\n`;
      }
    });
  }

  // Challenges & Solutions
  if (allChallenges.length > 0 || allSolutions.length > 0) {
    story += `## Challenges & Solutions\n\n`;

    if (allChallenges.length > 0) {
      story += `### Challenges We Overcame\n\n`;
      allChallenges.forEach((challenge, i) => {
        story += `${i + 1}. ${challenge}\n`;
      });
      story += `\n`;
    }

    if (allSolutions.length > 0) {
      story += `### How We Solved Them\n\n`;
      allSolutions.forEach((solution, i) => {
        story += `${i + 1}. ${solution}\n`;
      });
      story += `\n`;
    }
  }

  // Technical Changes
  story += `## Technical Changes\n\n`;
  story += `**Files Changed**: ${changedFiles.length}\n\n`;

  if (changedFiles.length > 0) {
    const filesByCategory = categorizeFiles(changedFiles);
    Object.entries(filesByCategory).forEach(([category, files]) => {
      if (files.length > 0) {
        story += `**${category}**:\n`;
        files.slice(0, 10).forEach(file => {
          story += `- \`${file}\`\n`;
        });
        if (files.length > 10) {
          story += `- ...and ${files.length - 10} more\n`;
        }
        story += `\n`;
      }
    });
  }

  // All Commits
  story += `## All Commits\n\n`;
  commits.forEach(commit => {
    story += `- [\`${commit.hash}\`](../../commit/${commit.fullHash}) ${commit.subject} - ${commit.author}\n`;
  });
  story += `\n`;

  // Video Script Suggestions
  story += `---\n\n`;
  story += `## Video Script Suggestions\n\n`;
  story += generateVideoSuggestions(commits, allChallenges, allSolutions);

  return story;
}

/**
 * Generate summary from commits
 */
function generateSummary(commits, commitsByType) {
  let summary = `This update includes ${commits.length} commit${commits.length > 1 ? 's' : ''} `;

  const parts = [];
  if (commitsByType.feat.length > 0) {
    parts.push(`${commitsByType.feat.length} new feature${commitsByType.feat.length > 1 ? 's' : ''}`);
  }
  if (commitsByType.fix.length > 0) {
    parts.push(`${commitsByType.fix.length} bug fix${commitsByType.fix.length > 1 ? 'es' : ''}`);
  }
  if (commitsByType.docs.length > 0) {
    parts.push(`${commitsByType.docs.length} documentation update${commitsByType.docs.length > 1 ? 's' : ''}`);
  }
  if (commitsByType.refactor.length > 0) {
    parts.push(`${commitsByType.refactor.length} refactor${commitsByType.refactor.length > 1 ? 's' : ''}`);
  }

  if (parts.length > 0) {
    summary += `featuring ${parts.join(', ')}.`;
  }

  return summary;
}

/**
 * Categorize files by type
 */
function categorizeFiles(files) {
  const categories = {
    'Components': [],
    'Services': [],
    'Utils': [],
    'Styles': [],
    'Config': [],
    'Tests': [],
    'Documentation': [],
    'Other': []
  };

  files.forEach(file => {
    if (file.includes('/components/')) categories['Components'].push(file);
    else if (file.includes('/services/')) categories['Services'].push(file);
    else if (file.includes('/utils/')) categories['Utils'].push(file);
    else if (file.endsWith('.css') || file.endsWith('.scss')) categories['Styles'].push(file);
    else if (file.includes('test') || file.includes('spec')) categories['Tests'].push(file);
    else if (file.endsWith('.md') || file.includes('docs/')) categories['Documentation'].push(file);
    else if (file.includes('config') || file.endsWith('.json')) categories['Config'].push(file);
    else categories['Other'].push(file);
  });

  return categories;
}

/**
 * Generate video script suggestions
 */
function generateVideoSuggestions(commits, challenges, solutions) {
  let suggestions = `### Opening Hook\n\n`;
  suggestions += `"In this development session, we tackled ${commits.length} significant update${commits.length > 1 ? 's' : ''} `;

  if (challenges.length > 0) {
    suggestions += `and overcame ${challenges.length} key challenge${challenges.length > 1 ? 's' : ''} `;
  }

  suggestions += `to bring the Meal Planner app closer to production. Let me walk you through the journey..."\n\n`;

  suggestions += `### Key Points to Cover\n\n`;

  commits.slice(0, 3).forEach((commit, i) => {
    suggestions += `${i + 1}. **${commit.subject}**\n`;
    if (commit.challenges.length > 0) {
      suggestions += `   - Challenge: ${commit.challenges[0]}\n`;
    }
    if (commit.solutions.length > 0) {
      suggestions += `   - Solution: ${commit.solutions[0]}\n`;
    }
    suggestions += `\n`;
  });

  suggestions += `### Closing\n\n`;
  suggestions += `"With these changes, we've made significant progress on [mention main feature]. `;
  suggestions += `The app is now [describe improvement]. Stay tuned for the next update where we'll tackle [hint at next feature]!"\n`;

  return suggestions;
}

/**
 * Save story to file
 */
function saveStory(content) {
  if (!fs.existsSync(STORY_DIR)) {
    fs.mkdirSync(STORY_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().getTime();
  const filename = `${date}-${BRANCH}-${timestamp}.md`;
  const filepath = path.join(STORY_DIR, filename);

  fs.writeFileSync(filepath, content);
  console.log(`✅ Story saved to: ${filepath}`);

  // Update index
  updateIndex();
}

/**
 * Update stories index file
 */
function updateIndex() {
  const files = fs.readdirSync(STORY_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse();

  let index = `# Development Stories\n\n`;
  index += `This directory contains automatically generated development stories that capture the journey, challenges, and solutions during the development of the Meal Planner app.\n\n`;
  index += `## Recent Stories\n\n`;

  files.slice(0, 20).forEach(file => {
    const date = file.split('-').slice(0, 3).join('-');
    const branch = file.split('-')[3];
    index += `- [${date} (${branch})](${file})\n`;
  });

  if (files.length > 20) {
    index += `\n...and ${files.length - 20} more stories\n`;
  }

  fs.writeFileSync(path.join(STORY_DIR, 'README.md'), index);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating development story...');
  console.log(`Branch: ${BRANCH}`);
  console.log(`Commit: ${COMMIT_SHA.slice(0, 7)}`);

  const commits = getRecentCommits();

  if (commits.length === 0) {
    console.log('ℹ️  No new commits to document');
    return;
  }

  console.log(`📝 Processing ${commits.length} commits...`);

  const storyContent = generateStoryContent(commits);
  saveStory(storyContent);

  console.log('✨ Story generation complete!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateStoryContent, getRecentCommits };
