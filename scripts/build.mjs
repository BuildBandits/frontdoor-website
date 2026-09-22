import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const source = fileURLToPath(new URL('../public/', import.meta.url));
const output = fileURLToPath(new URL('../dist/', import.meta.url));

// Only public website files are published. Cloudflare's _headers is replaced by
// vercel.json, while Worker code, tests and repository metadata stay private.
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '_headers') continue;
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) {
      throw new Error(`Unexpected publishable entry: ${join(directory, entry.name)}`);
    }
    if (entry.isDirectory()) {
      for (const child of await filesIn(join(directory, entry.name))) files.push(join(entry.name, child));
    } else if (entry.isFile()) files.push(entry.name);
    else throw new Error(`Unsupported entry: ${entry.name}`);
  }
  return files;
}

const files = await filesIn(source);
if (!files.includes('index.html')) throw new Error('Missing homepage');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let bytes = 0;
for (const file of files) {
  const target = join(output, file);
  await mkdir(join(target, '..'), { recursive: true });
  await cp(join(source, file), target);
  bytes += (await stat(target)).size;
}
console.log(`Static build ready: ${files.length} files, ${bytes} bytes in dist/`);
