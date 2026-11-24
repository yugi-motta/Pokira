import { matchesIllustrator } from './illustrator-search';
const dialog=document.querySelector<HTMLDialogElement>('#home-search-dialog');
const trigger=document.querySelector<HTMLInputElement>('[data-search-overlay="true"]');
const input=dialog?.querySelector<HTMLInputElement>('#home-search-input');
const clear=dialog?.querySelector<HTMLButtonElement>('.home-search-clear');
const outsideClear=trigger?.closest('form')?.querySelector<HTMLButtonElement>('.search-clear');
const sheet=dialog?.querySelector<HTMLElement>('.search-sheet');
const suggestionRow=sheet?.querySelector<HTMLElement>('.search-suggestion-row');
const rows=[...(sheet?.querySelectorAll<HTMLElement>('li[data-search]')||[])];
let previousOverflow='';
let previousScroll={left:0,top:0};
let restoringFocus=false;
let handoff=false;
let closeTimer:ReturnType<typeof setTimeout>;
function update(){
  if(!input||!sheet)return;
  const query=input.value.trim();let count=0;
  for(const row of rows){row.hidden=!query||!matchesIllustrator(row.dataset.search||'',query);if(!row.hidden)count++;}
  sheet.hidden=!query;
  if(suggestionRow)suggestionRow.hidden=!query;
  if(dialog)dialog.dataset.hasQuery=String(Boolean(query));
  const empty=sheet.querySelector<HTMLElement>('.search-sheet-empty');if(empty)empty.hidden=!query||count!==0;
  const announcement=dialog?.querySelector<HTMLElement>('.home-search-count');
  if(announcement)announcement.textContent=query?`${count} ${document.documentElement.lang==='ja'?'件':count===1?'result':'results'}`:'';
  if(clear)clear.hidden=!input.value;
  if(trigger)trigger.value=input.value;
  if(outsideClear)outsideClear.hidden=!input.value;
}
function open(){
  if(!dialog||!input||!trigger||dialog.open||restoringFocus||document.querySelector('dialog[open]'))return;
  clearTimeout(closeTimer);delete dialog.dataset.closing;
  handoff=false;previousOverflow=document.body.style.overflow;
  previousScroll={left:window.scrollX,top:window.scrollY};
  input.value=trigger.value;update();
  document.body.style.overflow='hidden';trigger.setAttribute('aria-expanded','true');
  dialog.showModal();input.focus({preventScroll:true});
}
function close(immediate=false){
  if(!dialog?.open||dialog.dataset.closing)return;
  dialog.dataset.closing='true';
  const finish=()=>{restoringFocus=true;dialog.close();};
  if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches)finish();
  else closeTimer=setTimeout(finish,180);
}
trigger?.addEventListener('focus',()=>{if(!handoff)open();});
document.querySelector('#suggestion-dialog')?.addEventListener('close',()=>{queueMicrotask(()=>{handoff=false;});});
trigger?.addEventListener('click',open);
trigger?.closest('form')?.addEventListener('submit',event=>{event.preventDefault();open();});
input?.addEventListener('input',update);
clear?.addEventListener('click',()=>{if(input){input.value='';update();input.focus({preventScroll:true});}});
outsideClear?.addEventListener('click',event=>{event.preventDefault();if(input){input.value='';update();}});
dialog?.addEventListener('cancel',event=>{event.preventDefault();close();});
dialog?.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
});
dialog?.addEventListener('close',()=>{
  document.body.style.overflow=previousOverflow;
  trigger?.setAttribute('aria-expanded','false');
  if(!handoff)trigger?.focus({preventScroll:true});
  window.scrollTo({...previousScroll,behavior:'instant'});
  delete dialog.dataset.closing;
  if(handoff)document.querySelector<HTMLButtonElement>('.suggestion-trigger')?.click();
  queueMicrotask(()=>{restoringFocus=false;});
});
const links=()=>[...(sheet?.querySelectorAll<HTMLAnchorElement>('li:not([hidden]) a')||[])];
dialog?.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();links()[0]?.click();});
input?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  if(event.key==='ArrowDown'){event.preventDefault();items()[0]?.focus();}
});
const items=()=>[...links(),...(!suggestionRow?.hidden ? sheet?.querySelectorAll<HTMLButtonElement>('[data-home-search-suggest]')||[] : [])];
sheet?.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp'].includes(event.key))return;
  const options=items();
  const index=options.indexOf(document.activeElement as HTMLAnchorElement);if(index<0)return;
  event.preventDefault();const next=index+(event.key==='ArrowDown'?1:-1);
  if(next<0)input?.focus();else options[Math.min(next,options.length-1)]?.focus();
});
dialog?.querySelector('[data-home-search-suggest]')?.addEventListener('click',()=>{
  handoff=true;close(true);
});
document.addEventListener('keydown',event=>{
  if(!dialog||document.querySelector('dialog[open]'))return;
  const editing=(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]');
  if((event.key==='/'&&!editing)||((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k')){event.preventDefault();open();}
});
const query=new URLSearchParams(location.search).get('q');
if(trigger&&query){trigger.value=query;open();}
