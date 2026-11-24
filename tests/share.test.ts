import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('src/lib/share-client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export\s*\{\s*\};?/g,'');
function setup(copy:()=>Promise<void> = async()=>{}) {
 const events=new Map<object,Record<string,Function>>();
 const listen=(object:object)=>({addEventListener:(name:string,handler:Function)=>{const handlers=events.get(object)||{};handlers[name]=handler;events.set(object,handlers);}});
 const trigger:any={focused:false};Object.assign(trigger,listen(trigger),{focus(){trigger.focused=true},blur(){trigger.focused=false}});
 const input:any={value:'https://pokira.pages.dev/en/hitoshi-ariga/',selected:false,focus(){},select(){this.selected=true}};Object.assign(input,listen(input));
 const button:any={};Object.assign(button,listen(button));const closeButton:any={};Object.assign(closeButton,listen(closeButton));
 const status={textContent:''};
 const dialog:any={open:false,dataset:{copied:'Copied',copyFailed:'Copy manually'},showModal(){this.open=true},close(){this.open=false;events.get(this)?.close()},getBoundingClientRect:()=>({left:100,right:400,top:100,bottom:400}),querySelector:(q:string)=>({'.share-link-input':input,'.share-copy':button,'.share-status':status,'.suggestion-close':closeButton}[q])};Object.assign(dialog,listen(dialog));
 const document={body:{style:{overflow:'auto'}},querySelector:(q:string)=>q==='#share-illustrator-dialog'?dialog:trigger};let copied='';let scroll:any;
 runInNewContext(source,{document,window:{scrollX:0,scrollY:620,scrollTo:(value:any)=>{scroll=value}},navigator:{clipboard:{writeText:async(text:string)=>{await copy();copied=text}}},matchMedia:()=>({matches:true}),setTimeout:(callback:Function)=>callback()});
 return {trigger,input,button,closeButton,status,dialog,document,get copied(){return copied},get scroll(){return scroll},fire:(target:object,event:string,values:object={})=>events.get(target)?.[event]?.(values)};
}
test('sharing copies the production profile link and announces success only after clipboard delivery',async()=>{
 const view=setup();view.fire(view.trigger,'click',{detail:1});assert.equal(view.dialog.open,true);assert.equal(view.document.body.style.overflow,'hidden');
 await view.fire(view.button,'click');assert.equal(view.copied,view.input.value);assert.equal(view.status.textContent,'Copied');
 view.fire(view.closeButton,'click');assert.equal(view.dialog.open,false);assert.equal(view.document.body.style.overflow,'auto');assert.equal(view.scroll.top,620);assert.equal(view.trigger.focused,false);
});
test('clipboard failures leave a selectable link and never announce success',async()=>{
 const view=setup(async()=>{throw Error('Clipboard denied')});view.fire(view.trigger,'click',{detail:0});await view.fire(view.button,'click');assert.equal(view.input.selected,true);assert.equal(view.status.textContent,'Copy manually');
 let prevented=false;view.fire(view.dialog,'cancel',{preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(view.dialog.open,false);assert.equal(view.trigger.focused,true);
});
test('only clicks outside the share dialog dismiss it',()=>{
 const view=setup();view.fire(view.trigger,'click',{detail:1});view.fire(view.dialog,'click',{target:view.dialog,clientX:120,clientY:130});assert.equal(view.dialog.open,true);
 view.fire(view.dialog,'click',{target:view.dialog,clientX:20,clientY:30});assert.equal(view.dialog.open,false);
});
test('a completed clipboard request cannot write feedback into a subsequently reopened share dialog',async()=>{
 let finish!:()=>void;const pending=new Promise<void>(resolve=>finish=resolve);const view=setup(()=>pending);view.fire(view.trigger,'click',{detail:1});const result=view.fire(view.button,'click');view.fire(view.closeButton,'click');view.fire(view.trigger,'click',{detail:1});finish();await result;assert.equal(view.status.textContent,'');
});
