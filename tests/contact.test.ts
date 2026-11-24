import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {onRequestPost} from '../functions/api/contact';
import {validateContact} from '../src/lib/contact';
import {suggestionsFallback} from '../src/lib/suggestions-config';
const valid={name:'Illustrator',email:'illustrator@example.org',topic:'removal',profileUrl:'https://pokira.pages.dev/en/hitoshi-ariga/',message:'Please remove my illustrator profile.'};
const response=(code:unknown,status=200)=>new Response(JSON.stringify(code),{status});
function request(values:Record<string,string>,origin='https://pokira.pages.dev',length?:string){
 const body=new FormData();Object.entries(values).forEach(([key,value])=>body.set(key,value));
 return new Request('https://pokira.pages.dev/api/contact',{method:'POST',headers:{Origin:origin,...(length?{'Content-Length':length}:{})},body});
}
test('contact validates topics, reply email, message, and the required removal profile before forwarding',async()=>{
 for(const topic of ['general','correction','removal'])assert.equal((await onRequestPost({request:request({...valid,topic}),env:{}})).status,200);
 assert.equal(validateContact({...valid,topic:'general',profileUrl:''}),null);
 assert.equal(validateContact({...valid,topic:'correction',profileUrl:''}),null);
 for(const values of [{email:''},{email:'bad-email'},{topic:'unknown'},{topic:'toString'},{message:'   '},{message:'x'.repeat(5001)},{profileUrl:''},{profileUrl:'https://x.com/ariga_megamix'},{profileUrl:'https://pokira.pages.dev/en/'},{profileUrl:'https://pokira.pages.dev.evil.example/ariga/'},{profileUrl:'https://user:password@pokira.pages.dev/ariga/'}]){
  assert.equal((await onRequestPost({request:request({...valid,...values}),env:{}})).status,400,JSON.stringify(values).slice(0,120));
 }
 assert.equal((await onRequestPost({request:request(valid,'https://other.example'),env:{}})).status,403);
 assert.equal((await onRequestPost({request:request(valid,undefined,'40000'),env:{}})).status,413);
 const forwarded=await onRequestPost({request:request(valid),env:{}});assert.deepEqual(await forwarded.json(),{code:'forward'});
});
test('contact email contains the category, reply address, profile, and full message for the existing Outlook inbox',async t=>{
 const original=globalThis.fetch;let payload:any;globalThis.fetch=async(_url,init)=>{payload=JSON.parse(String(init?.body));return response({id:'test-only'});};t.after(()=>globalThis.fetch=original);
 const sent=await onRequestPost({request:request(valid),env:{RESEND_API_KEY:'test-key',SUGGESTIONS_FROM_EMAIL:'Pokira <contact@verified.test>'}});
 assert.deepEqual(await sent.json(),{code:'sent'});assert.deepEqual(payload.to,['pokirahelp@outlook.com']);assert.equal(payload.reply_to,valid.email);assert.equal(payload.subject,'Pokira contact: Profile removal request');
 for(const value of [valid.name,valid.email,valid.profileUrl,valid.message])assert.ok(payload.text.includes(value));
});
test('provider failures do not report contact messages as delivered',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async()=>response({error:'unavailable'},500);
 assert.equal((await onRequestPost({request:request(valid),env:{RESEND_API_KEY:'test-key',SUGGESTIONS_FROM_EMAIL:'Pokira <contact@verified.test>'}})).status,502);
 globalThis.fetch=async()=>{throw Error('Network error');};
 assert.equal((await onRequestPost({request:request(valid),env:{RESEND_API_KEY:'test-key',SUGGESTIONS_FROM_EMAIL:'Pokira <contact@verified.test>'}})).status,502);
});
const compile=(path:string)=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
function client(responses:Response[],initial=valid){
 const field=(value:string)=>Object.assign(new EventTarget(),{value,disabled:false,required:false,validationMessage:'',setCustomValidity(message:string){this.validationMessage=message;}});
 const fields={name:field(initial.name),email:field(initial.email),topic:field(initial.topic),profileUrl:field(initial.profileUrl),message:field(initial.message),website:field('')};
 const trigger=new EventTarget();const closeButton=new EventTarget();const menu={focus(){},blur(){}};const profileField={hidden:true},profileOptional={hidden:false},note={hidden:true};
 const status={textContent:''},button={disabled:false};const timers:(()=>void)[]=[];let notices=0,resets=0,submit!:(event:Event)=>Promise<void>;
 const dialog=Object.assign(new EventTarget(),{open:false,dataset:{} as Record<string,string>,querySelector:()=>closeButton,showModal(){this.open=true;},close(this:EventTarget & {open:boolean}){this.open=false;this.dispatchEvent(new Event('close'));},getBoundingClientRect:()=>({left:10,right:100,top:10,bottom:100})});
 const form={action:'https://pokira.pages.dev/api/contact',dataset:{fallback:suggestionsFallback,sending:'Sending',failed:'Failed',unavailable:'Unavailable',invalid:'Invalid',invalidProfile:'Invalid profile'},querySelector:(q:string)=>q.startsWith('[name=')?fields[q.match(/name="([^"]+)"/)![1] as keyof typeof fields]:q==='.contact-profile-field'?profileField:q==='.contact-profile-optional'?profileOptional:q==='.contact-removal-note'?note:q==='#contact-status'?status:button,
 querySelectorAll:()=>Object.values(fields),reportValidity:()=>!Object.values(fields).some(f=>f.validationMessage),reset:()=>{resets++;for(const [key,f] of Object.entries(fields))f.value=key==='profileUrl'?initial.profileUrl:'';},addEventListener:(type:string,listener:any)=>{if(type==='submit')submit=listener;}};
 const document={body:{style:{overflow:'auto'}},querySelector:(q:string)=>q==='#contact-dialog'?dialog:q==='.contact-trigger'?trigger:q==='#contact-form'?form:q==='.menu-toggle'?menu:null,dispatchEvent:(event:Event)=>{if(event.type==='pokira:contact-sent'){assert.equal(dialog.open,false);notices++;}return true;}};
 class BrowserFormData extends FormData{constructor(){super();for(const [key,f] of Object.entries(fields))if(!f.disabled)this.set(key,f.value);}}
 const calls:{url:string;fields:Record<string,FormDataEntryValue>}[]=[];
 runInNewContext(compile('src/lib/contact.ts')+'\n'+compile('src/lib/contact-client.ts'),{document,window:{scrollX:0,scrollY:500,scrollTo(){}},matchMedia:()=>({matches:true}),Event,URL,FormData:BrowserFormData,location:{origin:'https://pokira.pages.dev',pathname:'/en/hitoshi-ariga/'},setTimeout:(callback:()=>void)=>timers.push(callback),fetch:async(url:string,init:{body:FormData})=>{calls.push({url,fields:Object.fromEntries(init.body)});const r=responses.shift();if(!r)throw Error('Unexpected send');return r;}});
 trigger.dispatchEvent(Object.assign(new Event('click'),{detail:1}));
 return {fields,profileField,profileOptional,note,status,button,dialog,calls,submit:()=>submit(new Event('submit',{cancelable:true})),close:()=>closeButton.dispatchEvent(new Event('click')),finishClose:()=>{while(timers.length)timers.shift()!();},get notices(){return notices},get resets(){return resets}};
}
test('removal fields are required only for removal and other contact types remain usable',()=>{
 const c=client([]);assert.equal(c.fields.profileUrl.required,true);assert.equal(c.profileField.hidden,false);assert.equal(c.profileOptional.hidden,true);assert.equal(c.note.hidden,false);
 c.fields.topic.value='general';c.fields.topic.dispatchEvent(new Event('change'));assert.equal(c.profileField.hidden,true);assert.equal(c.fields.profileUrl.disabled,true);assert.equal(c.fields.profileUrl.required,false);
 c.fields.topic.value='correction';c.fields.topic.dispatchEvent(new Event('change'));assert.equal(c.profileField.hidden,false);assert.equal(c.fields.profileUrl.required,false);assert.equal(c.note.hidden,true);
});
test('contact forwarding preserves every field and shows confirmation only after delivery and modal dismissal',async()=>{
 const c=client([response({code:'forward'}),response({success:'true'})]);await c.submit();assert.equal(c.notices,0);c.finishClose();assert.equal(c.notices,1);assert.equal(c.resets,1);assert.equal(c.dialog.open,false);assert.equal(c.button.disabled,false);
 assert.equal(c.calls[1].url,suggestionsFallback);assert.equal(c.calls[1].fields._subject,'Pokira contact: Profile removal request');assert.equal(c.calls[1].fields.topic,'Profile removal request');assert.equal(c.calls[1].fields.email,valid.email);assert.equal(c.calls[1].fields.message,valid.message);assert.equal(c.calls[1].fields.profileUrl,valid.profileUrl);
});
test('contact failures retain the draft, enable retry, and never show success',async()=>{
 for(const responses of [[response({code:'invalid'},400)],[response({code:'forward'}),response({success:'false'})],[response({code:'forward'}),response({success:true,message:'Activate your form'})]]){
  const c=client(responses);await c.submit();c.finishClose();assert.equal(c.notices,0);assert.equal(c.resets,0);assert.equal(c.dialog.open,true);assert.equal(c.fields.message.value,valid.message);assert.equal(c.button.disabled,false);assert.ok(c.status.textContent);
 }
});
test('a contact submitted before dismissal still announces delivery after the user closes it',async()=>{
 const c=client([response({code:'sent'})]);const pending=c.submit();c.close();c.finishClose();await pending;assert.equal(c.notices,1);
});
