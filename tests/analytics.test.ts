import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync('src/lib/analytics-client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\n/gm,'');
function visit({pathname='/',hostname='pokira.pages.dev',storage=new Map<string,string>(),blocked=false}={}){
 const appended:{src:string;type:string;dataset:Record<string,string>}[]=[];
 const status={textContent:'',dataset:{} as Record<string,string>};
 runInNewContext(source,{analyticsToken:'public-site-token',location:{pathname,hostname},localStorage:{getItem:(key:string)=>{if(blocked)throw Error('Storage blocked');return storage.get(key)||null;},setItem:(key:string,value:string)=>{if(blocked)throw Error('Storage blocked');storage.set(key,value);}},document:{querySelector:()=>status,createElement:()=>({dataset:{}}),body:{appendChild:(script:typeof appended[number])=>appended.push(script)}}});
 return {appended,status,storage};
}
test('ordinary production visits load one Cloudflare beacon with the public site token',()=>{
 const {appended}=visit();assert.equal(appended.length,1);assert.equal(appended[0].src,'https://static.cloudflareinsights.com/beacon.min.js');assert.equal(appended[0].type,'module');assert.equal(JSON.parse(appended[0].dataset.cfBeacon).token,'public-site-token');
});
test('the exclusion link saves the preference before any beacon is loaded',()=>{
 const c=visit({pathname:'/analytics/exclude/'});assert.equal(c.appended.length,0);assert.equal(c.storage.get('pokira-analytics-excluded'),'true');assert.equal(c.status.dataset.state,'saved');
 for(const pathname of ['/','/en/','/en/osare/'])assert.equal(visit({pathname,storage:c.storage}).appended.length,0);
});
test('browser exclusions are independent, so phone and desktop can each opt out',()=>{
 const phone=visit({pathname:'/analytics/exclude/'}),desktop=visit({pathname:'/analytics/exclude/'});
 assert.equal(visit({storage:phone.storage}).appended.length,0);assert.equal(visit({storage:desktop.storage}).appended.length,0);assert.equal(visit().appended.length,1);
});
test('blocked storage never falsely claims the exclusion was saved or counts the exclusion visit',()=>{
 const c=visit({pathname:'/analytics/exclude/',blocked:true});assert.equal(c.appended.length,0);assert.equal(c.status.dataset.state,'failed');assert.match(c.status.textContent,/could not save/);
});
test('local and preview environments never send production analytics',()=>{
 for(const hostname of ['localhost','127.0.0.1','branch.pokira.pages.dev'])assert.equal(visit({hostname}).appended.length,0);
});
