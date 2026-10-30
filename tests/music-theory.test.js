import test from "node:test";
import assert from "node:assert/strict";
import {maskOf,notesOf,intervalSequence,intervalVector,rotateMask,distinctModes,canonicalRotation,symmetryOrder,allRootedCollections,allScaleFamilies,scaleProfile,compareScales,identifyScales} from "../src/music-theory.js";
test("rooted universe contains 2048 unique collections",()=>{const all=allRootedCollections();assert.equal(all.length,2048);assert.equal(new Set(all).size,2048);assert.ok(all.every(x=>x&1));});
test("major scale interval sequence and vector",()=>{const m=maskOf([0,2,4,5,7,9,11]);assert.deepEqual(intervalSequence(notesOf(m)),[2,2,1,2,2,2,1]);assert.equal(intervalVector([0,4,7])[4],1);});
test("rotation preserves family canonical form",()=>{const m=maskOf([0,2,4,5,7,9,11]);assert.equal(canonicalRotation(m),canonicalRotation(rotateMask(m,5)));});
test("whole tone has one mode, two transpositions and sixfold symmetry",()=>{const m=maskOf([0,2,4,6,8,10]);assert.equal(distinctModes(m).length,1);assert.equal(scaleProfile(m).transpositions,2);assert.equal(symmetryOrder(m),6);});
test("scale comparison reports shared and changed notes",()=>{const c=compareScales([0,2,4,5,7,9,11],[0,2,3,5,7,9,10]);assert.deepEqual(c.common,[0,2,5,7,9]);assert.deepEqual(c.added,[3,10]);assert.deepEqual(c.removed,[4,11]);});
test("scale profile exposes canonical metrics",()=>{const p=scaleProfile(maskOf([0,2,4,5,7,9,11]));assert.equal(p.cardinality,7);assert.equal(p.intervals.reduce((a,b)=>a+b,0),12);assert.equal(p.intervalVector.length,6);});
test("recognition ranks a matching collection first",()=>{const found=identifyScales([0,2,4,5,7,9,11],5);assert.equal(found[0].mask,maskOf([0,2,4,5,7,9,11]));});

test("major scale has seven distinct modes",()=>{assert.equal(distinctModes(maskOf([0,2,4,5,7,9,11])).length,7);});
test("periodic-table scale families exclude one- and two-note collections",()=>{assert.equal(allScaleFamilies().length,344);});

test("Gray-code traversal changes one pitch-class bit per step",()=>{const masks=Array.from({length:2048},(_,i)=>(((i^(i>>1))<<1)|1));for(let i=1;i<masks.length;i++)assert.equal((masks[i]^masks[i-1]).toString(2).replace(/0/g,"").length,1);});
