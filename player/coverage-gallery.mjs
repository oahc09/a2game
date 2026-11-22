const get=id=>document.getElementById(id);
const make=(tag,text,cls)=>{
    const element=document.createElement(tag);
    if(text)element.textContent=text;
    if(cls)element.className=cls;
    return element;
};
const names={three:'Three.js',air:'CocosAirJS'};
const results={won:'通关',lost:'失败分支',playing:'进行中',stopped:'已结束'};
const dialog=get('evidence');
let games=[];
const admitted=new Map();
function admit(game){
    if(!admitted.has(game.id)){
        admitted.set(game.id,(async()=>{
            const raw=await fetch('/gallery-assets/'+game.id+'/game');
            if(!raw.ok)throw Error('游戏定义读取失败');
            const response=await fetch('/api/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:await raw.text()});
            const result=await response.json();
            if(!response.ok)throw Error(result.error?.message??'准入失败');
            return result.receipt.sha256Jcs;
        })().catch(error=>{admitted.delete(game.id);throw error;}));
    }
    return admitted.get(game.id);
}
function play(game,backend,button,status){
    const tab=window.open('about:blank','_blank');
    if(!tab){status.textContent='浏览器拦截了新标签页，请允许弹出窗口后重试。';return;}
    tab.opener=null;
    button.disabled=true;
    status.textContent='正在校验游戏…';
    admit(game).then(digest=>{
        tab.location.replace('/player/index.html?backend='+backend+'&ready=1&release='+encodeURIComponent(digest));
        status.textContent='';
    }).catch(error=>{tab.close();status.textContent=error.message;})
      .finally(()=>{button.disabled=false;});
}
function card(game,item){
    const button=make('button','','scene');
    const image=make('img');
    image.src=item.image;image.alt='';image.loading='lazy';image.decoding='async';
    button.append(image,make('span',names[item.backend]+' · '+(results[item.status]??item.status)),make('strong',item.id));
    button.onclick=()=>{
        dialog.querySelector('h2').textContent=game.title+' · '+item.id;
        const preview=dialog.querySelector('img');
        preview.src=item.image;preview.alt=game.title+' '+names[item.backend]+' 场景截图';
        dialog.querySelector('a').href=item.trace;
        dialog.querySelector('.hash').textContent='Exact Hash  '+item.hash;
        dialog.showModal();
    };
    return button;
}
function render(){
    const query=get('search').value.trim().toLowerCase(), batch=get('batch').value, backend=get('engine').value;
    let count=0, titles=0;
    const list=document.createDocumentFragment();
    for(const game of games){
        if(batch&&game.batch!==batch)continue;
        const match=[game.title,game.id,game.description].some(value=>value.toLowerCase().includes(query));
        const scenarios=game.scenarios.filter(item=>(!backend||backend===item.backend)&&(match||item.id.toLowerCase().includes(query)));
        if(!scenarios.length)continue;
        count+=scenarios.length;titles++;
        const article=make('article'), header=make('div','','game-header'), intro=make('div');
        intro.append(make('div','第 '+game.batch+' 批 · '+game.id,'meta'),make('h2',game.title),make('p',game.description,'description'));
        const actions=make('div','','play'), status=make('p','','description');
        status.setAttribute('role','status');
        for(const key of backend?[backend]:Object.keys(names)){
            const button=make('button','试玩 '+names[key]+' ↗');
            button.onclick=()=>play(game,key,button,status);actions.append(button);
        }
        header.append(intro,actions);
        const scenes=make('div','','scenes');
        scenes.append(...scenarios.map(item=>card(game,item)));
        article.append(header,status,scenes);list.append(article);
    }
    get('count').textContent=count?titles+' 款作品 · '+count+' 个场景':'没有匹配场景';
    get('games').replaceChildren(list);
}
try{
    const response=await fetch('/gallery-data.json');
    if(!response.ok)throw Error();
    games=await response.json();
    get('gallery-total').textContent=games.length+' 款作品 · '+games.reduce((total,game)=>total+game.scenarios.length,0)+' 个浏览器场景';
    for(const batch of new Set(games.map(game=>game.batch)))get('batch').add(new Option('第 '+batch+' 批',batch));
    for(const id of ['search','batch','engine'])get(id).addEventListener('input',render);
    render();
}catch{
    get('count').textContent='回执列表加载失败，请确认本机试玩服务已启动后刷新。';
}
