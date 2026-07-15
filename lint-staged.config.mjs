import path from 'node:path';

const workspaceDirs = [
  'apps/api',
  'apps/web',
  'apps/worker',
  'packages/ai',
  'packages/config',
  'packages/database',
  'packages/delivery',
  'packages/inbox',
  'packages/types',
  'packages/ui',
];

const cwd = process.cwd();

function quote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function workspaceFor(file) {
  const relativeFile = toPosix(path.relative(cwd, file));
  return workspaceDirs.find(
    (workspaceDir) => relativeFile === workspaceDir || relativeFile.startsWith(`${workspaceDir}/`),
  );
}

function eslintByWorkspace(files) {
  const grouped = new Map();

  for (const file of files) {
    const workspaceDir = workspaceFor(file);
    if (!workspaceDir) continue;

    const workspaceRoot = path.join(cwd, workspaceDir);
    const relativeFile = toPosix(path.relative(workspaceRoot, file));
    const workspaceFiles = grouped.get(workspaceDir) ?? [];
    workspaceFiles.push(relativeFile);
    grouped.set(workspaceDir, workspaceFiles);
  }

  return [...grouped.entries()].map(
    ([workspaceDir, filesInWorkspace]) =>
      `pnpm --dir ${quote(workspaceDir)} exec eslint --fix ${filesInWorkspace
        .map(quote)
        .join(' ')}`,
  );
}

export default {
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,css}': 'prettier --write',
  '*.{ts,tsx,js,jsx,mjs,cjs}': eslintByWorkspace,
};
