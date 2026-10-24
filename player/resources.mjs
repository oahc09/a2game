/** A session owns fetched bytes, decoded bitmaps and object URLs. No gameplay state is written here. */
export class ResourceScope {
  constructor(records=[]){this.records=records;this.items=new Map();this.abort=new AbortController();this.disposed=false;}
  async load(){
    try{
      for(const record of this.records){
        const response=await fetch(record.href,{signal:this.abort.signal});
        if(!response.ok)throw Error(`A2G_E_RESOURCE_LOAD: 资源请求失败 ${response.status}`);
        if(Number(response.headers.get('Content-Length'))!==record.bytes)throw Error('A2G_E_RESOURCE_INTEGRITY: 资源长度不符');
        const bytes=await response.arrayBuffer();
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(bytes.byteLength!==record.bytes||hash!==record.sha256)throw Error('A2G_E_RESOURCE_INTEGRITY: 资源字节 SHA256 不符');
        if(this.disposed)throw Error('A2G_E_DISPOSED: 资源作用域已关闭');
        const item={record,bytes};
        if(record.type==='image')item.bitmap=await createImageBitmap(new Blob([bytes],{type:response.headers.get('Content-Type')}));
        if(this.disposed){item.bitmap?.close();throw Error('A2G_E_DISPOSED: 资源作用域已关闭');}
        item.url=URL.createObjectURL(new Blob([bytes],{type:response.headers.get('Content-Type')}));this.items.set(record.id,item);
      }
      return this;
    }catch(error){this.dispose();throw error;}
  }
  get(id){if(this.disposed)throw Error('A2G_E_DISPOSED: 资源作用域已关闭');const item=this.items.get(id);if(!item)throw Error(`A2G_E_RESOURCE_REF: 资源不存在 ${id}`);return item;}
  diagnostics(){return {disposed:this.disposed,ownedResources:this.items.size,decodedImages:[...this.items.values()].filter(item=>item.bitmap).length,bytes:[...this.items.values()].reduce((sum,item)=>sum+item.bytes.byteLength,0)};}
  dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();for(const item of this.items.values()){item.bitmap?.close();URL.revokeObjectURL(item.url);}this.items.clear();}
}
