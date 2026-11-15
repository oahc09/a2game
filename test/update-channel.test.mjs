import test from'node:test';import assert from'node:assert/strict';import{generateKeyPairSync,sign}from'node:crypto';
import{verifyChannel}from'../player/update-client.mjs';
test('channel pins signature, rejects remote unsigned and unsafe files',async()=>{
 const{privateKey,publicKey}=generateKeyPairSync('ed25519'),config={mode:'signed',publicKey:publicKey.export({type:'spki',format:'der'}).toString('base64')};
 const id='a'.repeat(64),channel={format:'a2game-delivery-channel',version:1,selected:{game:id},versions:[{id,gameId:'game',revision:1,title:'作品',base:'/delivery/releases/'+id+'/',files:[{file:'player/index.html',bytes:1,sha256:'b'.repeat(64)}]}]},payload=JSON.stringify(channel),envelope={payload,signature:sign(null,Buffer.from(payload),privateKey).toString('base64')};
 assert.equal((await verifyChannel(envelope,config,'https://trusted.example')).versions.length,1);
 await assert.rejects(verifyChannel({...envelope,payload:payload.replace('作品','改动')},config,'https://trusted.example'),{code:'A2G_UPDATE_SIGNATURE'});
 await assert.rejects(verifyChannel(envelope,{mode:'loopback-reviewed'},'https://remote.example'),{code:'A2G_UPDATE_SIGNATURE_REQUIRED'});
 channel.versions[0].files[0].file='../secret';await assert.rejects(verifyChannel({payload:JSON.stringify(channel)},{mode:'loopback-reviewed'},'http://localhost:1'),{code:'A2G_UPDATE_FILE'});
});
