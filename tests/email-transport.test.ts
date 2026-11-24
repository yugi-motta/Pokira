import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEmailFields} from '../src/lib/email-transport';

test('Web3Forms transport preserves form fields, reply address, and a clean subject without FormSubmit options',()=>{
  const fields=new FormData();
  fields.set('email','visitor@example.org');fields.set('message','A correction\nwith details');fields.set('website','');
  const prepared=prepareEmailFields(fields,'public-form-id','Pokira contact:\r\nError correction','https://pokira.pages.dev/en/');
  assert.equal(prepared.get('email'),'visitor@example.org');assert.equal(prepared.get('message'),'A correction\nwith details');
  assert.equal(prepared.get('access_key'),'public-form-id');assert.equal(prepared.get('from_name'),'Pokira');
  assert.equal(prepared.get('subject'),'Pokira contact:  Error correction');
  assert.equal(prepared.get('page_url'),'https://pokira.pages.dev/en/');
  for(const key of ['website','botcheck','_subject','_captcha','_honey'])assert.equal(prepared.has(key),false);
  assert.equal(fields.get('website'),'');assert.equal(fields.has('access_key'),false);
});
test('unconfigured email transport refuses to forward, and honeypots remain marked for spam handling',()=>{
  const fields=new FormData();assert.throws(()=>prepareEmailFields(fields,'','Subject','https://pokira.pages.dev/'),/not configured/);
  fields.set('website','spam');assert.equal(prepareEmailFields(fields,'public-id','Subject','https://pokira.pages.dev/').get('botcheck'),'true');
});
