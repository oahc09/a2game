import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {publishVersion,selectVersion,preparePlayerVersion} from '../packages/content-delivery/index.mjs';

test('player preparation revalidates selected versions and refuses tampering without changing selection',async()=>{
 const root=resolve('output',`delivery-player-test-${randomUUID()}`);mkdirSync(root,{recursive:true});
 await assert.rejects(preparePlayerVersion({root}),/no selected version/);
 for(const version of ['v1','v2'])await publishVersion({root,source:resolve('examples/content-update',version),description:version});
 const latest=()=>readFileSync(join(root,'latest.json'),'utf8');
 const pointer=latest(),v2=await preparePlayerVersion({root});
 assert.equal(v2.version,'v2');assert.equal(v2.receiver.status,'PASS_REFERENCE');
 const bytes=readFileSync(v2.packagePath);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),v2.packageSha256);
 assert.equal(JSON.parse(bytes).files.content.definition.revision,2);
 const v1=await preparePlayerVersion({root,version:'v1'});assert.equal(v1.version,'v1');assert.equal(latest(),pointer);
 selectVersion({root,version:'v1'});assert.equal((await preparePlayerVersion({root})).version,'v1');
 const before=latest();writeFileSync(join(root,'versions/v1/package.json'),Buffer.concat([readFileSync(join(root,'versions/v1/package.json')),Buffer.from(' ')]));
 await assert.rejects(preparePlayerVersion({root}),/integrity mismatch/);assert.equal(latest(),before);
 // The admitted receiver snapshot remains unchanged when the author store is corrupted.
 assert.equal(createHash('sha256').update(readFileSync(v1.packagePath)).digest('hex'),v1.packageSha256);
});
