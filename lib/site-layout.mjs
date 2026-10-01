import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function sitePage(body) {
  const [header,footer]=await Promise.all([
    readFile(join(process.cwd(),'lib/site-layout/header.html'),'utf8'),
    readFile(join(process.cwd(),'lib/site-layout/footer.html'),'utf8')
  ]);
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEST Signals access</title><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/internal-workspaces.css"><link rel="stylesheet" href="/css/nest-auth.css"></head><body>${header}<main class="internal-page">${body}</main>${footer}<script src="/js/nest-auth.js"></script><script src="/js/main.js"></script></body></html>`;
}
