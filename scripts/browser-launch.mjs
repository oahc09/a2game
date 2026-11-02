/** Explicit local browser selection; never changes launch security or rendering flags. */
import {statSync} from 'node:fs';
import {isAbsolute} from 'node:path';
export function browserLaunchOptions(env=process.env){
 const executablePath=env.A2GAME_BROWSER_EXECUTABLE;
 if(executablePath!==undefined&&(!executablePath||!isAbsolute(executablePath)||!statSync(executablePath).isFile()))throw Error('A2GAME_BROWSER_EXECUTABLE must name an existing absolute local executable file');
 return {headless:true,...(executablePath?{executablePath}:{})};
}
export function browserIdentity(browser,options){
 return {version:browser.version(),executablePath:options.executablePath??null,selection:options.executablePath?'EXPLICIT_LOCAL_EXECUTABLE':'PLAYWRIGHT_MANAGED_DEFAULT'};
}
