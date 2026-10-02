import { bridge } from './nest-auth.mjs';
let cached, expires = 0;
export async function signalsClasses(request = bridge) {
  if (request === bridge && cached && Date.now() < expires) return cached;
  const result = await request({ action: 'signals-classes' });
  const classes = result?.classes;
  if (result?.status !== 200 || !classes || Array.isArray(classes) || !Object.keys(classes).length ||
      Object.entries(classes).some(([key,value]) => !/^(?:[0-7]|CTSO)$/.test(key) || typeof value !== 'boolean')) {
    throw new Error('Class counts unavailable');
  }
  if (request === bridge) { cached = classes; expires = Date.now() + 300000; }
  return classes;
}
