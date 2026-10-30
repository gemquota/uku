import {notesOf,scaleProfile,hammingDistance,maskOf} from "./music-theory.js";
export class MusicalKnowledgeGraph {
  constructor(){this.nodes=new Map();this.edges=[];}
  addNode(type,id,data={}){const key=`${type}:${id}`;this.nodes.set(key,{id:key,type,data});return key;}
  relate(from,to,relation,weight=1,metadata={}){if(!this.nodes.has(from)||!this.nodes.has(to))throw new Error("Both graph endpoints must exist");const edge={from,to,relation,weight,metadata};this.edges.push(edge);return edge;}
  neighbours(id,relation=null){return this.edges.filter(e=>(e.from===id||e.to===id)&&(!relation||e.relation===relation)).map(e=>({...e,node:this.nodes.get(e.from===id?e.to:e.from)}));}
  buildScaleGraph(masks){
    this.nodes.clear();this.edges=[];const ids=masks.map(mask=>this.addNode("scale",mask.toString(16),scaleProfile(mask)));
    for(let i=0;i<masks.length;i++)for(let j=i+1;j<masks.length;j++){const distance=hammingDistance(masks[i],masks[j]);if(distance<=2)this.relate(ids[i],ids[j],"mutation-neighbour",1/(1+distance),{hamming:distance});}
    return {nodes:this.nodes.size,edges:this.edges.length};
  }
  search(query){const q=String(query).toLowerCase();return [...this.nodes.values()].filter(n=>n.id.toLowerCase().includes(q)||JSON.stringify(n.data).toLowerCase().includes(q));}
  path(from,to,maxDepth=4){const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift();if(path.length>maxDepth+1)continue;const last=path.at(-1);if(last===to)return path;for(const n of this.neighbours(last)){if(!seen.has(n.node.id)){seen.add(n.node.id);queue.push([...path,n.node.id]);}}}return null;}
}
