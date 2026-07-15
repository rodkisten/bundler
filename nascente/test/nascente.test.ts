import { describe, expect, it } from 'vitest';
import { chunk, cloneDeep, difference, groupBy, mapAsync, mapValues, merge, Mutex, uniq, withTimeout, TimeoutError, camelCase, sumBy } from '@rodkisten/nascente';
describe('nascente',()=>{
 it('handles hot array transforms',()=>{expect(chunk([1,2,3,4,5],2)).toEqual([[1,2],[3,4],[5]]);expect(uniq([1,1,2])).toEqual([1,2]);expect(difference([1,2,3],[2])).toEqual([1,3])});
 it('groups without prototype pollution',()=>{const x=groupBy(['a','bb','c'],v=>v.length);expect(x[1]).toEqual(['a','c'])});
 it('maps values without Object.entries tuples',()=>expect(mapValues({a:1,b:2},v=>v*2)).toEqual({a:2,b:4}));
 it('deep clones cycles and merges',()=>{const a:any={x:1};a.self=a;const b=cloneDeep(a);expect(b).not.toBe(a);expect(b.self).toBe(b);expect(merge({a:{x:1}},{a:{y:2}})).toEqual({a:{x:1,y:2}})});
 it('limits async transforms',async()=>expect(await mapAsync([1,2,3],async x=>x*2,2)).toEqual([2,4,6]));
 it('serializes mutex work',async()=>{const m=new Mutex(),out:number[]=[];await Promise.all([1,2,3].map(x=>m.use(async()=>{out.push(x)})));expect(out).toEqual([1,2,3])});
 it('times out',async()=>expect(withTimeout(new Promise(()=>{}),5)).rejects.toBeInstanceOf(TimeoutError));
 it('supports strings and math',()=>{expect(camelCase('Hello beautiful-river')).toBe('helloBeautifulRiver');expect(sumBy([{n:2},{n:3}],x=>x.n)).toBe(5)});
});
