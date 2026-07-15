import { bench, describe } from 'vitest';
import { clone, cloneDeep, groupBy, mapValues, sumBy, uniq } from './index';
const numbers=Array.from({length:10_000},(_,i)=>i%1000); const records=Object.fromEntries(Array.from({length:1000},(_,i)=>['k'+i,i])); const nested={a:{b:{c:Array.from({length:100},(_,i)=>({i}))}}};
describe('nascente mobile-oriented hot paths',()=>{
 bench('sumBy indexed loop',()=>sumBy(numbers,x=>x)); bench('native map + reduce',()=>numbers.map(x=>x).reduce((a,b)=>a+b,0));
 bench('uniq Set',()=>uniq(numbers)); bench('groupBy one pass',()=>groupBy(numbers,x=>x%10));
 bench('mapValues no Object.entries tuples',()=>mapValues(records,x=>x+1)); bench('Object.entries pipeline',()=>Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v+1])));
 bench('clone',()=>clone(records)); bench('structuredClone deep',()=>structuredClone(nested)); bench('cloneDeep',()=>cloneDeep(nested));
});
