// Host-independent checks for routing, selection recovery, and Bake sampling.
// Run with node tools/test-regressions.cjs [path/to/FlowDiagram.jsx].
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourcePath = process.argv[2] || path.join(__dirname, '..', 'FlowDiagram.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
new vm.Script(source.replace(/^#.*$/gm, ''));
function functionSource(name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, 'Missing function: ' + name);
  return source.slice(start, source.indexOf('\n    function ', start + 1));
}
const expression = vm.runInNewContext(functionSource('connectorPathExpression') + '\nconnectorPathExpression()');
function route({destination=[120,0], startSide=1, endSide=5, startOffset=0, endOffset=0, scale=[1,1], endKind=1, straight=false}={}) {
  function node(pos, kind) {
    return {
      toComp: p => [pos[0]+p[0]*scale[0], pos[1]+p[1]*scale[1]],
      sourceRectAtTime: () => ({left:-50,top:-25,width:100,height:50}),
      effect: () => () => ({value:kind})
    };
  }
  const a=node([0,0],1), b=node(destination,endKind);
  const values={'Route':straight?1:2,'Start Side':startSide,'End Side':endSide,'Start Port Offset':startOffset,'End Port Offset':endOffset};
  return JSON.parse(JSON.stringify(vm.runInNewContext(expression, {
    time:0, effect:n=>()=>n==='Start Node'?a:n==='End Node'?b:{value:values[n]},
    fromComp:p=>p, createPath:p=>p
  })));
}
function assertOrthogonal(points) {
  for(let i=1;i<points.length;i++){
    assert.ok(points[i].every(Number.isFinite));
    assert.ok(points[i][0]===points[i-1][0]||points[i][1]===points[i-1][1]);
    assert.notDeepEqual(points[i],points[i-1]);
  }
}
for(const scale of [[1,1],[2,0.5]]) for(const axis of [0,1]) for(const sign of [-1,1]) for(const gap of [1,10,20,47,48,100]) {
  const destination=[0,0];destination[axis]=sign*((axis===0?100*scale[0]:50*scale[1])+gap);
  const endSide=axis===0?(sign>0?5:3):(sign>0?2:4);
  const points=route({destination,endSide,scale});assertOrthogonal(points);
  for(let i=1;i<points.length;i++)assert.ok(sign*(points[i][axis]-points[i-1][axis])>=0,'Facing route doubled back');
}
const ports=route({destination:[120,0],startOffset:30,endOffset:-20});
assert.deepEqual(ports[0],[50,15]);assert.deepEqual(ports.at(-1),[70,-10]);assertOrthogonal(ports);
const dot=route({destination:[300,0],endKind:7});assert.deepEqual(dot.at(-1),[300,0]);
assert.equal(route({straight:true}).length,2);
const away=route({destination:[-300,0],endSide:5});assertOrthogonal(away);
assert.ok(away.some(p=>p[1]!==0),'Destination-facing-away detour disappeared');
console.log('PASS: narrow facing gaps, four directions, scaling, port offsets, junction dots, straight routes, and destination detours.');

const defaults={strokeWidth:8,headSize:18,duration:1.5};
const recovery={
  ui:{type:{selection:null},startSide:{selection:null},endSide:{selection:null},stroke:{text:'--'},head:{text:'--'},duration:{text:'--'},colorButton:{}},
  DEFAULT_STROKE_WIDTH:6,DEFAULT_HEAD_SIZE:24,DEFAULT_DURATION:1,
  ROUTE_ITEMS:['Straight','Orthogonal'],SIDE_ITEMS:['Auto','Top','Right','Bottom','Left','Center'],
  isSyncingControls:false,selectedColorIsMixed:true,selectedColor:[0,0,0],
  readNumberSetting:(key,fallback)=>defaults[key]??fallback,
  setDropdownValue:(control,text)=>{control.selection={text};},setSwatchColor:()=>{}
};
vm.createContext(recovery);vm.runInContext(functionSource('restoreBlankControlsToDefaults'),recovery);
recovery.restoreBlankControlsToDefaults();
assert.deepEqual([recovery.ui.stroke.text,recovery.ui.head.text,recovery.ui.duration.text],['8','18','1.5']);
assert.equal(recovery.isSyncingControls,false);assert.equal(recovery.selectedColorIsMixed,false);
assert.equal(recovery.ui.endSide.selection.text,'Left');
recovery.ui.stroke.text='12';recovery.ui.head.text='24';recovery.ui.duration.text='2';recovery.restoreBlankControlsToDefaults();
assert.deepEqual([recovery.ui.stroke.text,recovery.ui.head.text,recovery.ui.duration.text],['12','24','2']);
recovery.ui.stroke.text='Infinity';defaults.strokeWidth=Infinity;recovery.restoreBlankControlsToDefaults();assert.equal(recovery.ui.stroke.text,'6');
console.log('PASS: mixed-number recovery uses saved defaults, preserves valid inputs, and rejects nonfinite recovery values.');

const baking={};vm.createContext(baking);vm.runInContext(functionSource('bakeExpressionToKeyframes'),baking);
for(const [start,end,step] of [[0,1.01,1/30],[0,1,1/30],[2.17,2.18,1/24],[-0.1,0.99,1/60],[1,1,1/30]]) {
  let result;
  const prop={expression:'live',valueAtTime:t=>{assert.equal(prop.expression,'live','Expression removed before samples collected');return t*10;},setValuesAtTimes:(times,values)=>result={times,values}};
  baking.bakeExpressionToKeyframes(prop,start,end,step);
  assert.equal(result.times.at(-1),end);assert.equal(result.values.at(-1),end*10);
  assert.equal(result.times.filter(t=>t===end).length,1);
  assert.ok(result.times.every(t=>t>=start&&t<=end));
  for(let i=1;i<result.times.length;i++)assert.ok(result.times[i]>result.times[i-1]);
  assert.equal(prop.expression,'');
}
const invalidStep={expression:'live'};assert.throws(()=>baking.bakeExpressionToKeyframes(invalidStep,0,1,0));assert.equal(invalidStep.expression,'live');
console.log('PASS: Bake includes the exact end once, samples no frames beyond it, and collects live values before clearing expressions.');
console.log('All regression checks passed; AE visual validation remains separate.');
