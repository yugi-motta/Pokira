import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {onRequestPost} from '../functions/api/suggestions';
import {suggestionsFallback} from '../src/lib/suggestions-config';

const post='https://x.com/amelicart/status/1851206902438052235';
function request(fields:Record<string,string>,origin='https://pokira.pages.dev'){
 const body=new FormData();for(const [key,value] of Object.entries(fields))body.set(key,value);
 return new Request('https://pokira.pages.dev/api/suggestions',{method:'POST',headers:{Origin:origin},body});
}
test('the email endpoint validates required fields before allowing browser forwarding',async()=>{
 const valid={illustratorName:'Amelicart',postUrl:post};
 const response=await onRequestPost({request:request(valid),env:{}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{code:'forward'});
 for(const fields of [{...valid,illustratorName:''},{...valid,postUrl:'https://x.com/amelicart'},{...valid,email:'invalid'},{...valid,postUrl:'https://example.com/p/work'}]){
  const rejected=await onRequestPost({request:request(fields),env:{}});assert.equal(rejected.status,400);
 }
 assert.equal((await onRequestPost({request:request(valid,'https://evil.example'),env:{}})).status,403);
 assert.equal((await onRequestPost({request:request({...valid,postUrl:'https://www.instagram.com/p/ABCdef123/'}),env:{}})).status,200);
});
test('configured email delivery sends all visitor details to the Outlook inbox',async t=>{
 const original=globalThis.fetch;let body:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,options)=>{body=JSON.parse(String(options?.body));return new Response('{"id":"test-delivery"}',{status:200});};
 t.after(()=>{globalThis.fetch=original;});
 const response=await onRequestPost({request:request({name:'Visitor',email:'visitor@example.org',illustratorName:'Amelicart',postUrl:post}),env:{RESEND_API_KEY:'test-key',SUGGESTIONS_FROM_EMAIL:'Pokira <suggestions@verified.test>'}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{code:'sent'});
 assert.deepEqual(body?.to,['pokirahelp@outlook.com']);assert.match(String(body?.text),/Visitor/);assert.match(String(body?.text),/visitor@example.org/);assert.match(String(body?.text),/Amelicart/);assert.match(String(body?.text),/https:\/\/x.com\/amelicart\/status\//);
});

const script=(path:string)=>ts.transpileModule(readFileSync(path,'utf8').match(/<script>([\s\S]*?)<\/script>/)![1],{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function client(responses:Response[]){
 const documentEvents=new EventTarget();const trigger=Object.assign(new EventTarget(),{focus(){},blur(){},closest(){return null;}});
 const closeButton=new EventTarget();const timers:(()=>void)[]=[];let reset=0;let notices=0;
 const dialog=Object.assign(new EventTarget(),{dataset:{} as Record<string,string>,open:false,querySelector:()=>closeButton,
  showModal(){this.open=true;},close(this:EventTarget&{open:boolean}){this.open=false;this.dispatchEvent(new Event('close'));}});
 const artistInput=Object.assign(new EventTarget(),{value:'Amelicart',setCustomValidity(){}});
 const postInput=Object.assign(new EventTarget(),{value:post,setCustomValidity(){}});
 const button={disabled:false};const status={textContent:''};let submit:(event:Event)=>Promise<void>;
 const form={action:'https://pokira.pages.dev/api/suggestions',dataset:{fallback:suggestionsFallback,invalidLink:'invalid',sending:'sending',sent:'sent',unavailable:'unavailable',failed:'failed'},
  querySelector:(selector:string)=>selector==='[name="illustratorName"]'?artistInput:selector==='[name="postUrl"]'?postInput:button,
  reportValidity:()=>true,reset:()=>{reset++;},addEventListener:(_type:string,handler:typeof submit)=>{submit=handler;}};
 const calls:{url:string;fields:Record<string,FormDataEntryValue>}[]=[];
 const document={body:{style:{overflow:''}},querySelectorAll:()=>[trigger],querySelector:(selector:string)=>selector==='#suggestion-dialog'?dialog:selector==='#suggestion-form'?form:selector==='#suggestion-status'?status:null,
  dispatchEvent:(event:Event)=>documentEvents.dispatchEvent(event)};
 documentEvents.addEventListener('pokira:suggestion-sent',()=>{assert.equal(dialog.open,false);notices++;});
 class BrowserFormData extends FormData{constructor(){super();this.set('illustratorName','Amelicart');this.set('postUrl',post);this.set('website','');}}
 runInNewContext(script('src/components/SuggestionForm.astro'),{document,window:{scrollX:0,scrollY:500,scrollTo(){}},location:{origin:'https://pokira.pages.dev',pathname:'/en/'},Event,FormData:BrowserFormData,
  setTimeout:(callback:()=>void)=>{timers.push(callback);return timers.length;},fetch:async(url:string,options:{body:FormData})=>{calls.push({url,fields:Object.fromEntries(options.body)});const response=responses.shift();if(!response)throw Error('Unexpected send');return response;}});
 trigger.dispatchEvent(Object.assign(new Event('click'),{detail:1}));
 return {dialog,button,status,calls,submit:()=>submit(new Event('submit',{cancelable:true})),finishClose:()=>{while(timers.length)timers.shift()!();},get reset(){return reset;},get notices(){return notices;}};
}
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
test('successful forwarding closes the modal and announces review once',async()=>{
 const c=client([response({code:'forward'}),response({success:'true',message:'Form submitted successfully'})]);
 await c.submit();assert.equal(c.notices,0);c.finishClose();assert.equal(c.dialog.open,false);assert.equal(c.notices,1);assert.equal(c.reset,1);assert.equal(c.button.disabled,false);
 assert.equal(c.calls[1].url,suggestionsFallback);assert.equal(c.calls[1].fields._subject,'Pokira illustrator suggestion: Amelicart');assert.equal(c.calls[1].fields.postUrl,post);assert.equal(c.calls[1].fields._url,'https://pokira.pages.dev/en/');assert.equal(c.calls[1].fields._honey,'');
});
test('validation, activation and delivery failures never show the success toast',async()=>{
 for(const responses of [[response({code:'invalid'},400)],[response({code:'failed'},502)],[response({code:'forward'}),response({success:false,message:'Please activate your form'})],[response({code:'forward'}),response({success:'false',message:'Unable to submit form'})]]){
  const c=client(responses);await c.submit();c.finishClose();assert.equal(c.dialog.open,true);assert.equal(c.notices,0);assert.equal(c.reset,0);assert.ok(c.status.textContent);assert.equal(c.button.disabled,false);
 }
});
test('delivery completion still announces success when the visitor already closed the form',async()=>{
 const c=client([response({code:'sent'})]);const pending=c.submit();c.dialog.close();await pending;c.finishClose();assert.equal(c.notices,1);assert.equal(c.reset,1);
});
test('the top toast dismisses after six seconds and repeated successes reset its timer',()=>{
 const events=new EventTarget();const label={textContent:'Suggestion received'};const toast={hidden:true,dataset:{contactMessage:'Message received'} as Record<string,string>,querySelector:()=>label};let id=0;
 const timers=new Map<number,{callback:()=>void;delay:number}>();
 runInNewContext(script('src/components/SuggestionToast.astro'),{document:{querySelector:()=>toast,addEventListener:(type:string,listener:EventListener)=>events.addEventListener(type,listener)},
  setTimeout:(callback:()=>void,delay:number)=>{timers.set(++id,{callback,delay});return id;},clearTimeout:(key:number)=>timers.delete(key)});
 const advance=(delay:number)=>{for(const [key,timer] of [...timers])if(timer.delay===delay){timers.delete(key);timer.callback();}};
 events.dispatchEvent(new Event('pokira:suggestion-sent'));assert.equal(toast.hidden,false);assert.equal([...timers.values()][0].delay,6000);
 advance(6000);assert.equal(toast.dataset.closing,'true');
 events.dispatchEvent(new Event('pokira:suggestion-sent'));advance(180);assert.equal(toast.hidden,false);assert.equal(toast.dataset.closing,undefined);
 advance(6000);advance(180);assert.equal(toast.hidden,true);
 events.dispatchEvent(new Event('pokira:contact-sent'));assert.equal(label.textContent,'Message received');
 events.dispatchEvent(new Event('pokira:suggestion-sent'));assert.equal(label.textContent,'Suggestion received');
});
