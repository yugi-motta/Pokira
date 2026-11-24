import test from 'node:test';
import assert from 'node:assert/strict';
import {artistSchema} from '../src/lib/schema';

const profile = {id:'example',name:'Example',handle:'example',creditSource:'https://www.pokemon-card.com/card-search/details.php/card/50634/regu/all',workSources:['https://x.com/example/status/2117089320305902006']};

test('official card credits support profiles without misclassifying other Pokémon work as card announcements',()=>{
 const artist=artistSchema.parse(profile);
 assert.deepEqual(artist.announcements,[]);
 assert.deepEqual(artist.workSources,profile.workSources);
});

test('a profile without announcements or permitted gallery images needs an official card credit',()=>{
 for(const creditSource of ['https://example.com/card','https://www.pokemon-card.com.evil.example/card-search/details.php/card/50634/regu/all']){
  assert.equal(artistSchema.safeParse({...profile,creditSource}).success,false);
 }
});

test('biographies need both languages and verifiable sources; personal websites need identity evidence',()=>{
 assert.equal(artistSchema.safeParse({...profile,website:'https://example.com'}).success,false);
 assert.equal(artistSchema.safeParse({...profile,bio:{en:'A verified biography.',ja:'確認済みの紹介文。',sources:[]}}).success,false);
 assert.equal(artistSchema.safeParse({...profile,bio:{en:'A verified biography.',sources:['https://example.com/about']}}).success,false);
 for (const website of ['javascript:alert(1)', 'not a url', 'https://user:password@example.com']) assert.equal(artistSchema.safeParse({...profile,website,websiteSource:'https://example.com'}).success,false);
 assert.equal(artistSchema.safeParse({...profile,website:'https://example.com',websiteSource:'https://example.com/about',bio:{en:'A verified biography.',ja:'確認済みの紹介文。',sources:['https://example.com/about']}}).success,true);
});
