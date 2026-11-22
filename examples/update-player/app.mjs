import{createUpdateClient}from'./update-client.mjs';const $=id=>document.getElementById(id);let busy=false;
const client=createUpdateClient({container:$('player'),onStatus:event=>{$('status').textContent=event.state==='downloading'?`正在下载并核对第${event.revision}版，原版本保持可用。`:event.state==='active'?`已加载第${event.revision}版。点击游戏内的开始按钮运行。`:event.state==='failed'?`更新未完成（${event.code}），保留原版本。`:'交付清单已更新。';$('rollback').disabled=busy||!client.status().previous;}});window.updateClient=client;
async function refresh(){const channel=await client.check(),old=$('versions').value;$('versions').replaceChildren(...channel.versions.map(v=>new Option(`${v.title} · 第${v.revision}版`,v.id)));if(channel.versions.some(v=>v.id===old))$('versions').value=old;const config=await(await fetch('./api/config')).json();$('logout').hidden=!config.adminLogin;$('publishing').hidden=!config.allowPublish;if(config.allowPublish){const studio=await(await fetch('/studio/api/status')).json();$('jobs').replaceChildren(...studio.jobs.filter(j=>j.status==='completed').map(j=>new Option('已完成作品 '+j.id.slice(0,8),j.id)));}
 $('retention').hidden=!config.allowPublish||!config.persistent;
 $('recovery').hidden=config.recovery.length===0;
 $('recovery-list').replaceChildren(...config.recovery.map(({id,code})=>{
  const row=document.createElement('li');
  const reason=recoveryReason(code);
  row.textContent=`${id} · ${reason}（${code}）`;
  return row;
 }));
 const selected=new Set(Object.values(channel.selected));
 $('archive-version').replaceChildren(...channel.versions.filter(v=>!selected.has(v.id)&&v.id!==client.status().current?.id).map(v=>new Option(`${v.title} · 第${v.revision}版`,v.id)),...config.recovery.map(v=>new Option('恢复被拒绝 · '+v.id.slice(0,12),v.id)));
}
function recoveryReason(code){
 if(['A2G_DELIVERY_SOURCE_STALE','A2G_E_RELEASE_STALE','A2G_DELIVERY_EXECUTABLE'].includes(code))return 'SDK 与当前宿主不兼容。请从原任务重新构建并发布。';
 if(['ENOENT','ENOTDIR','A2G_DELIVERY_INCOMPLETE'].includes(code))return 'SDK 文件缺失。请检查存储路径或从原任务重建。';
 if(['A2G_DELIVERY_INTEGRITY','A2G_DELIVERY_INVENTORY','A2G_DELIVERY_TRUST_ANCHOR','A2G_DELIVERY_STATE','A2G_E_RELEASE_INTEGRITY','A2G_E_RESOURCE_INTEGRITY'].includes(code))return 'SDK 文件或清单校验失败。请核对备份或从原任务重建。';
 return 'SDK 未通过恢复校验。请根据错误码检查存储和宿主配置。';
}
async function publish(){
 const id=$('publish-job-id').value.trim()||$('jobs').value;
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))throw Error('请选择已完成作品或填写完整任务 ID');
 $('status').textContent='正在复验原作品并重建 SDK…';
 const response=await fetch('./api/jobs/'+id+'/publish',{method:'POST',headers:{'Content-Type':'application/json','X-A2Game-Delivery':'1'},body:'{"prepareOnly":true}'});
 const result=await response.json();
 if(!response.ok){
  const hints={A2G_DELIVERY_JOB_NOT_COMPLETE:'请核对任务 ID 和完成状态',A2G_DELIVERY_CAPACITY:'请先归档未选中的版本或恢复失败的记录',A2G_DELIVERY_BUILD:'请检查宿主构建环境和已审核资源'};
  throw Error(hints[result.code]?`${result.code} · ${hints[result.code]}`:result.code);
 }
 await refresh();$('versions').value=result.id;
 $('status').textContent='新 SDK 已发布到可用列表。点击「加载所选版本」切换当前播放器。';
}
async function retain(action,id){
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('请选择版本或填写完整归档 ID');
 if(action==='archive'&&client.status().current?.id===id)throw Error('请先切换当前播放器');
 const response=await fetch(`./api/versions/${id}/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-A2Game-Delivery':'1'},body:'{}'});
 const result=await response.json();if(!response.ok)throw Error(result.code);
 await refresh();$('restore-id').value=id;$('status').textContent=action==='archive'?'版本已归档。可用此 ID 恢复。':'版本已恢复，可选择加载。';
}
$('archive').onclick=()=>run(()=>retain('archive',$('archive-version').value));
$('restore').onclick=()=>run(()=>retain('restore',$('restore-id').value.trim()));
async function run(fn){if(busy)return;busy=true;for(const id of['load','rollback','check','publish','logout'])$(id).disabled=true;try{await fn();$('empty').hidden=!!client.status().current;}catch(e){$('status').textContent=`操作未完成（${e.code??e.message}），当前版本保持不变。`;}finally{busy=false;for(const id of['load','check','publish','logout'])$(id).disabled=false;$('rollback').disabled=!client.status().previous;}}
$('logout').onclick=()=>run(async()=>{const r=await fetch('/auth/logout',{method:'POST',headers:{'X-A2Game-Auth':'1'}});if(!r.ok)throw Error('退出未完成');await client.close();location.assign('/auth/login');});
$('check').onclick=()=>run(refresh);
$('load').onclick=()=>run(()=>client.activate($('versions').value));
$('rollback').onclick=()=>run(async()=>{await refresh();const restored=await client.rollback();$('versions').value=restored.id;});
$('publish').onclick=()=>run(publish);
window.addEventListener('pagehide',()=>{void client.close().catch(()=>{});},{once:true});await run(refresh);
