import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLaunchOptions,browserIdentity} from '../scripts/browser-launch.mjs';
test('browser selection is explicit, local and does not inject security bypass flags',()=>{
 assert.deepEqual(browserLaunchOptions({}),{headless:true});
 assert.deepEqual(browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:process.execPath}),{headless:true,executablePath:process.execPath});
 for(const path of ['', 'relative-browser', 'https://example.invalid/chrome'])assert.throws(()=>browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:path}));
 assert.throws(()=>browserLaunchOptions({A2GAME_BROWSER_EXECUTABLE:'/a2game-no-such-browser'}));
 assert.deepEqual(browserIdentity({version:()=> 'actual-version'},{executablePath:process.execPath}),{version:'actual-version',executablePath:process.execPath,selection:'EXPLICIT_LOCAL_EXECUTABLE'});
 assert.equal(browserIdentity({version:()=> 'actual-version'},{}).executablePath,null);
});
