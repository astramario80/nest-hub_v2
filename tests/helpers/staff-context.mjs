import fs from 'node:fs';import vm from 'node:vm';
// These tool unit fixtures use the same shared permission helpers as the school monolith.
const code=fs.readFileSync(new URL('../../google-spinner/Code.js',import.meta.url),'utf8');
const helpers=code.slice(code.indexOf('// Staff registration proves identity;'),code.indexOf('function globalAccess_'));
export function staffContext(values){const context=vm.createContext({OWNER_EMAILS:[],...values});vm.runInContext(helpers,context);return context;}
export function schoolSource(names){let source='';for(const name of names){const text=fs.readFileSync(new URL('../../google-spinner/'+name,import.meta.url),'utf8');if(!source.includes(text))source+='\n'+text;}return source;}
