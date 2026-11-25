import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {matchesIllustrator} from '../src/lib/illustrator-search';

function setup(){
 const documentEvents=new EventTarget();let active:unknown,scrollY=720,notices=0,otherDialog=false;
 const body={style:{overflow:'auto'}};
 const element=()=>Object.assign(new EventTarget(),{hidden:false,value:'',dataset:{} as Record<string,string>,textContent:'',focus(this:EventTarget){active=this;this.dispatchEvent(new Event('focus'));},click(this:EventTarget){this.dispatchEvent(new Event('click'));}});
 const trigger=Object.assign(element(),{setAttribute(this:{dataset:Record<string,string>},key:string,value:string){this.dataset[key]=value;},closest(){return heroForm;}});
 const input=element(),clear=element(),outsideClear=element(),closeButton=element(),suggest=element(),count=element(),empty=element(),suggestionRow=element();
 const heroForm=Object.assign(element(),{querySelector:()=>outsideClear});
 const a=Object.assign(element(),{dataset:{search:'hitoshi ariga ありがひとし ariga_megamix arigamegamix'}});
 const b=Object.assign(element(),{dataset:{search:'nagimiso 凪水そう'}});
 const linkA=element(),linkB=element();let visits=0;linkA.addEventListener('click',()=>visits++);linkB.addEventListener('click',()=>visits++);
 const rows=[a,b];
 const sheet=Object.assign(element(),{querySelector:(q:string)=>q==='.search-sheet-empty'?empty:q==='.search-suggestion-row'?suggestionRow:null,querySelectorAll:(q:string)=>q==='li[data-search]'?rows:q==='li:not([hidden]) a'?rows.flatMap((r,i)=>r.hidden?[]:[i===0?linkA:linkB]):q==='[data-home-search-suggest]'?[suggest]:[]});
 const form=element();
 const dialog=Object.assign(element(),{open:false,showModal(){this.open=true;input.focus();},close(this:EventTarget & {open:boolean}){this.open=false;trigger.focus();queueMicrotask(()=>this.dispatchEvent(new Event('close')));},getBoundingClientRect:()=>({left:100,right:700,top:200,bottom:650}),
  querySelector:(q:string)=>q==='#home-search-input'?input:q==='.home-search-clear'?clear:q==='.search-sheet'?sheet:q==='.home-search-count'?count:q==='.home-search-close'?closeButton:q==='[data-home-search-suggest]'?suggest:q==='form'?form:null});
 const suggestionDialog=element();
 const menuSuggestion=element();menuSuggestion.addEventListener('click',()=>{assert.equal(body.style.overflow,'auto');assert.equal(dialog.open,false);notices++;otherDialog=true;body.style.overflow='hidden';});
 const document={body,documentElement:{lang:'en'},get activeElement(){return active;},querySelector:(q:string)=>q==='#suggestion-dialog'?suggestionDialog:q==='#home-search-dialog'?dialog:q==='[data-search-overlay="true"]'?trigger:q==='dialog[open]'?(otherDialog?suggestionDialog:dialog.open?dialog:null):q==='.suggestion-trigger'?menuSuggestion:null,addEventListener:(...args:Parameters<EventTarget['addEventListener']>)=>documentEvents.addEventListener(...args)};
 const timers=new Map<number,()=>void>();let nextTimer=0;
 const code=ts.transpileModule(readFileSync('src/lib/home-search.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\n/gm,'');
 runInNewContext(code,{document,window:{scrollX:0,get scrollY(){return scrollY;},scrollTo(value:{top:number}){scrollY=value.top;}},location:{search:''},matchesIllustrator,URLSearchParams,queueMicrotask,matchMedia:()=>({matches:false}),setTimeout:(callback:()=>void)=>{timers.set(++nextTimer,callback);return nextTimer;},clearTimeout:(id:number)=>timers.delete(id)});
 const key=(target:EventTarget,key:string)=>target.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key}));
 return {trigger,input,dialog,suggestionDialog,closeSuggestion:()=>{otherDialog=false;body.style.overflow='auto';trigger.focus();suggestionDialog.dispatchEvent(new Event('close'));},rows,suggestionRow,sheet,clear,outsideClear,closeButton,suggest,count,empty,form,body,linkA,linkB,key,documentEvents,get visits(){return visits},get notices(){return notices},get active(){return active},get scrollY(){return scrollY},finishClose:async()=>{for(const [id,callback] of timers){timers.delete(id);callback();}await Promise.resolve();await Promise.resolve();}};
}
test('focusing home search opens the dialog, locks scrolling, and focuses its input',()=>{
 const c=setup();c.trigger.focus();assert.equal(c.dialog.open,true);assert.equal(c.body.style.overflow,'hidden');assert.equal(c.active,c.input);assert.equal(c.trigger.dataset['aria-expanded'],'true');assert.ok(c.rows.every(r=>r.hidden));assert.equal(c.sheet.hidden,true);assert.equal(c.suggestionRow.hidden,true);
});
test('search matches names and handles, shows suggestions after typing, and clears to a blank state',()=>{
 const c=setup();c.trigger.focus();c.input.value='ariga_megamix';c.input.dispatchEvent(new Event('input'));assert.equal(c.rows[0].hidden,false);assert.equal(c.rows[1].hidden,true);assert.equal(c.count.textContent,'1 result');assert.equal(c.suggestionRow.hidden,false);
 c.input.value='no match';c.input.dispatchEvent(new Event('input'));assert.ok(c.rows.every(r=>r.hidden));assert.equal(c.empty.hidden,false);
 c.clear.click();assert.equal(c.input.value,'');assert.ok(c.rows.every(r=>r.hidden));assert.equal(c.sheet.hidden,true);assert.equal(c.suggestionRow.hidden,true);assert.equal(c.empty.hidden,true);assert.equal(c.clear.hidden,true);
});
test('closing restores scroll and focus without immediately reopening on restored focus',async()=>{
 const c=setup();c.trigger.focus();c.key(c.input,'Escape');await c.finishClose();assert.equal(c.dialog.open,false);assert.equal(c.body.style.overflow,'auto');assert.equal(c.scrollY,720);assert.equal(c.trigger.dataset['aria-expanded'],'false');assert.equal(c.active,c.trigger);
 c.trigger.click();assert.equal(c.dialog.open,true);
});
test('keyboard navigation reaches matching results and submitting opens the first match',()=>{
 const c=setup();c.trigger.focus();c.input.value='a';c.input.dispatchEvent(new Event('input'));c.key(c.input,'ArrowDown');assert.equal(c.active,c.linkA);c.key(c.dialog.querySelector('.search-sheet') as EventTarget,'ArrowDown');assert.equal(c.active,c.linkB);c.key(c.dialog.querySelector('.search-sheet') as EventTarget,'ArrowUp');assert.equal(c.active,c.linkA);c.key(c.dialog.querySelector('.search-sheet') as EventTarget,'ArrowUp');assert.equal(c.active,c.input);c.form.dispatchEvent(new Event('submit',{cancelable:true}));assert.equal(c.visits,1);
});
test('suggestion handoff waits for search to close before opening the next modal',async()=>{
 const c=setup();c.trigger.focus();c.input.value='unlisted';c.input.dispatchEvent(new Event('input'));c.suggest.click();assert.equal(c.dialog.open,false);assert.equal(c.notices,0);await c.finishClose();assert.equal(c.notices,1);assert.equal(c.body.style.overflow,'hidden');
});
test('blank searches have no keyboard options and a nonmatching query can focus the suggestion row',()=>{
 const c=setup();c.trigger.focus();c.key(c.input,'ArrowDown');assert.equal(c.active,c.input);
 c.input.value='no matching illustrator';c.input.dispatchEvent(new Event('input'));c.key(c.input,'ArrowDown');assert.equal(c.active,c.suggest);assert.equal(c.suggestionRow.hidden,false);
});

test('returning focus from the suggestion form does not reopen search',async()=>{
 const c=setup();c.trigger.focus();c.suggest.click();await c.finishClose();c.closeSuggestion();assert.equal(c.dialog.open,false);await Promise.resolve();c.trigger.click();assert.equal(c.dialog.open,true);
});

test('the inactive search stays empty while typing, after closing, and when reopening',async()=>{
 const c=setup();c.trigger.focus();c.input.value='ariga';c.input.dispatchEvent(new Event('input'));
 assert.equal(c.trigger.value,'');assert.equal(c.input.value,'ariga');assert.equal(c.rows[0].hidden,false);
 c.key(c.input,'Escape');await c.finishClose();assert.equal(c.trigger.value,'');assert.equal(c.dialog.open,false);
 c.trigger.click();assert.equal(c.trigger.value,'');assert.equal(c.input.value,'ariga');assert.equal(c.rows[0].hidden,false);
});

test('Command+F and Control+F replace browser find and refocus an already-open search',()=>{
 for(const modifier of ['metaKey','ctrlKey']){
  const c=setup();const shortcut=()=>Object.assign(new Event('keydown',{cancelable:true}),{key:'f',[modifier]:true});
  const first=shortcut();c.documentEvents.dispatchEvent(first);assert.equal(first.defaultPrevented,true);assert.equal(c.dialog.open,true);assert.equal(c.active,c.input);
  c.linkA.focus();const repeat=shortcut();c.documentEvents.dispatchEvent(repeat);assert.equal(repeat.defaultPrevented,true);assert.equal(c.active,c.input);
 }
});
test('find shortcuts leave an open suggestion form intact',async()=>{
 const c=setup();c.trigger.focus();c.suggest.click();await c.finishClose();
 const event=Object.assign(new Event('keydown',{cancelable:true}),{key:'f',ctrlKey:true});c.documentEvents.dispatchEvent(event);
 assert.equal(c.dialog.open,false);assert.equal(c.body.style.overflow,'hidden');
});
