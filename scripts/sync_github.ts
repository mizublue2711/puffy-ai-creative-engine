import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import {
  inspectImageBuffer,
  loadManifest,
  type AssetManifest,
} from './scrape_pomelli';

export const COMMIT_MESSAGE =
  'chore(assets): automated bulk ingestion from Pomelli catalog [skip ci]';

const DEFAULT_REPO_OWNER = 'mizublue2711';
const DEFAULT_REPO_NAME = 'puffy-ai-creative-engine';

export interface IntegrityReport {
  totalEntries: number;
  verifiedFiles: number;
  errors: string[];
}

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Validates that every entry in `assets/manifest.json` resolves to an existing,
 * non-empty, non-corrupted image whose SHA-256 matches the recorded checksum.
 */
export function verifyCatalogIntegrity(
  manifest: AssetManifest,
  cwd = process.cwd(),
): IntegrityReport {
  const errors: string[] = [];
  const seenChecksums = new Set<string>();
  let verifiedFiles = 0;

  for (const entry of manifest.assets) {
    if (!entry.sku || !entry.name || !entry.category || !entry.local_path) {
      errors.push(
        `Manifest entry missing required metadata fields: ${JSON.stringify(entry)}`,
      );
      continue;
    }

    if (seenChecksums.has(entry.checksum)) {
      errors.push(`Duplicate checksum detected in manifest: ${entry.checksum}`);
      continue;
    }
    seenChecksums.add(entry.checksum);

    const absPath = path.resolve(cwd, entry.local_path);
    if (!fs.existsSync(absPath)) {
      errors.push(`Missing catalog asset file: ${entry.local_path}`);
      continue;
    }

    const buffer = fs.readFileSync(absPath);
    if (buffer.length === 0) {
      errors.push(`Empty asset buffer (0 bytes): ${entry.local_path}`);
      continue;
    }

    const parsed = inspectImageBuffer(buffer);
    if (!parsed) {
      errors.push(
        `Corrupted or unsupported image header in asset: ${entry.local_path}`,
      );
      continue;
    }

    const actualSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actualSha256 !== entry.checksum) {
      errors.push(
        `Checksum mismatch for ${entry.local_path}: expected ${entry.checksum}, got ${actualSha256}`,
      );
      continue;
    }

    verifiedFiles += 1;
  }

  return {
    totalEntries: manifest.assets.length,
    verifiedFiles,
    errors,
  };
}

function getPendingAssetChanges(cwd: string): string[] {
  const statusOutput = runGit(
    ['status', '--porcelain', '--', 'assets/catalog', 'assets/manifest.json'],
    cwd,
  );
  if (!statusOutput) {
    return [];
  }
  return statusOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRepoSlug(): { owner: string; repo: string } {
  const slug = process.env.GITHUB_REPOSITORY;
  if (slug && slug.includes('/')) {
    const [owner, repo] = slug.split('/', 2);
    return { owner, repo };
  }
  return { owner: DEFAULT_REPO_OWNER, repo: DEFAULT_REPO_NAME };
}

function formatTimestampSlug(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function collectFilesRecursively(dir: string, baseDir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...collectFilesRecursively(abs, baseDir));
    } else if (item.isFile()) {
      results.push(path.relative(baseDir, abs).split(path.sep).join('/'));
    }
  }
  return results;
}

/**
 * Commits changed catalog files and manifest.json directly via GitHub REST API (Octokit),
 * comparing git blob SHA-1 hashes against the base tree for idempotency.
 */
async function syncViaOctokit(params: {
  cwd: string;
  targetBranch: string;
  createFeatureBranch: boolean;
}): Promise<{ committed: boolean; branch: string; sha?: string }> {
  const token = process.env.GH_PAT_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('USE_OCTOKIT=true requires GH_PAT_TOKEN or GITHUB_TOKEN.');
  }

  const { owner, repo } = parseRepoSlug();
  const octokit = new Octokit({ auth: token });
  const baseBranch = 'main';

  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseCommitSha = baseRef.object.sha;

  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseCommitSha,
  });

  const { data: baseTree } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: baseCommit.tree.sha,
    recursive: 'true',
  });

  const existingTreeShaByPath = new Map<string, string>();
  for (const item of baseTree.tree) {
    if (item.path && item.sha && item.type === 'blob') {
      existingTreeShaByPath.set(item.path, item.sha);
    }
  }

  const candidatePaths = [
    ...collectFilesRecursively(
      path.resolve(params.cwd, 'assets/catalog'),
      params.cwd,
    ),
    'assets/manifest.json',
  ].filter((rel) => fs.existsSync(path.resolve(params.cwd, rel)));

  const treeEntries: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string;
  }> = [];

  for (const relPath of candidatePaths) {
    const contentBuffer = fs.readFileSync(path.resolve(params.cwd, relPath));
    // Compute Git's native blob SHA-1 to skip uploading identical files.
    const gitHeader = Buffer.from(`blob ${contentBuffer.length}\0`, 'utf8');
    const localBlobSha = crypto
      .createHash('sha1')
      .update(Buffer.concat([gitHeader, contentBuffer]))
      .digest('hex');

    if (existingTreeShaByPath.get(relPath) === localBlobSha) {
      continue;
    }

    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: contentBuffer.toString('base64'),
      encoding: 'base64',
    });

    treeEntries.push({
      path: relPath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  if (treeEntries.length === 0) {
    console.log(
      '[sync_github] Octokit tree matches local assets; zero commits needed.',
    );
    return { committed: false, branch: baseBranch };
  }

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeEntries,
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: COMMIT_MESSAGE,
    tree: newTree.sha,
    parents: [baseCommitSha],
  });

  if (params.createFeatureBranch) {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${params.targetBranch}`,
      sha: newCommit.sha,
    });
  } else {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${params.targetBranch}`,
      sha: newCommit.sha,
    });
  }

  console.log(
    `[sync_github] Committed ${treeEntries.length} file(s) via Octokit to ${params.targetBranch} (${newCommit.sha}).`,
  );
  return {
    committed: true,
    branch: params.targetBranch,
    sha: newCommit.sha,
  };
}

function ensureGitAuthor(cwd: string): void {
  try {
    runGit(['config', 'user.name'], cwd);
    runGit(['config', 'user.email'], cwd);
  } catch {
    runGit(['config', 'user.name', 'github-actions[bot]'], cwd);
    runGit(
      ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
      cwd,
    );
  }
}

export async function runSync(options?: {
  cwd?: string;
  validateOnly?: boolean;
  push?: boolean;
  createFeatureBranch?: boolean;
  useOctokit?: boolean;
}): Promise<{ committed: boolean; branch: string; sha?: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const manifest = loadManifest(cwd);
  const report = verifyCatalogIntegrity(manifest, cwd);

  if (report.errors.length > 0) {
    throw new Error(
      `Catalog integrity validation failed (${report.errors.length} error(s)):\n - ${report.errors.join('\n - ')}`,
    );
  }

  console.log(
    `[sync_github] Catalog integrity verified: ${report.verifiedFiles}/${report.totalEntries} asset(s) valid.`,
  );

  if (options?.validateOnly) {
    return { committed: false, branch: 'main' };
  }

  const createFeatureBranch =
    Boolean(options?.createFeatureBranch) ||
    process.env.SYNC_BRANCH_MODE === 'pr';
  const targetBranch = createFeatureBranch
    ? `chore/sync-pomelli-assets-${formatTimestampSlug()}`
    : 'main';

  const useOctokit =
    Boolean(options?.useOctokit) || process.env.USE_OCTOKIT === 'true';

  if (useOctokit) {
    return syncViaOctokit({
      cwd,
      targetBranch,
      createFeatureBranch,
    });
  }

  const pendingChanges = getPendingAssetChanges(cwd);
  if (pendingChanges.length === 0) {
    console.log(
      '[sync_github] Zero changes detected in assets/catalog or assets/manifest.json; skipping commit.',
    );
    return { committed: false, branch: targetBranch };
  }

  ensureGitAuthor(cwd);

  if (createFeatureBranch) {
    runGit(['checkout', '-b', targetBranch], cwd);
  }

  runGit(['add', '--', 'assets/catalog', 'assets/manifest.json'], cwd);

  // Double-check staged diff so empty commits are never created.
  const stagedDiff = runGit(['diff', '--cached', '--name-only'], cwd);
  if (!stagedDiff) {
    console.log('[sync_github] Nothing staged after git add; skipping commit.');
    return { committed: false, branch: targetBranch };
  }

  runGit(['commit', '-m', COMMIT_MESSAGE], cwd);
  const commitSha = runGit(['rev-parse', 'HEAD'], cwd);
  console.log(`[sync_github] Created commit ${commitSha} on branch ${targetBranch}.`);

  if (options?.push) {
    const pushBranch = createFeatureBranch ? targetBranch : 'HEAD';
    runGit(['push', 'origin', pushBranch], cwd);
    console.log(`[sync_github] Pushed ${pushBranch} to origin.`);
  }

  return {
    committed: true,
    branch: targetBranch,
    sha: commitSha,
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  await runSync({
    validateOnly: args.has('--validate-only'),
    push: args.has('--push'),
    createFeatureBranch: args.has('--branch'),
    useOctokit: args.has('--octokit'),
  });
}

const isDirectEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith(path.normalize('scripts/sync_github.ts'));

if (isDirectEntry) {
  main().catch((err) => {
    console.error('[sync_github] Fatal error:', err);
    process.exit(1);
  });
}
