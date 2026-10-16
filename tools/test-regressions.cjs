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

// Applying a preset must clear appearance overrides on the whole generated
// diagram, including manually edited/baked paints, without touching geometry.
function paintProperty(value) {return {value,expression:'manual override',setValue(v){this.value=v;}};}
function group(children={},properties={}) {return {children,property(name){return properties[name]??children[name]??null;}};}
function nodeMock(name,kind='rectangle') {
  const fill=paintProperty([1,0,0]),stroke=paintProperty([0,1,0]),gradient=paintProperty(90),shadow=paintProperty(50),text=paintProperty('Node');
  const contents=group({'Node Fill':group({}, {'ADBE Vector Fill Color':fill}),'Node Border':group({}, {'ADBE Vector Stroke Color':stroke}),'Node Gradient':group({}, {'ADBE Vector Fill Opacity':gradient})});
  const effects=group({'Node Shadow':group({}, {'ADBE Drop Shadow-0002':shadow})});
  const geometry=group({}, {'ADBE Vectors Group':contents});
  const node=group({}, {'ADBE Root Vectors Group':group({'Node Geometry':geometry}),'ADBE Effect Parade':effects});
  Object.assign(node,{name,comment:'Flow Diagram Node|'+kind,textLayer:group({}, {'ADBE Text Properties':group({}, {'ADBE Text Document':text})}),appearance:{fill,stroke,gradient,shadow,text},geometry:{position:[10,20],size:[100,50]}});
  return node;
}
function connectorMock(name) {
  const color=paintProperty([1,0,0]),stroke=paintProperty([1,0,0]),fill=paintProperty([1,0,0]);
  const contents=group({'Connector Stroke':group({}, {'ADBE Vector Stroke Color':stroke}),'Arrowhead':group({}, {'ADBE Vectors Group':group({'Arrowhead Fill':group({}, {'ADBE Vector Fill Color':fill})})})});
  const connector=group({}, {'ADBE Root Vectors Group':group({'Connector Geometry':group({}, {'ADBE Vectors Group':contents})})});
  Object.assign(connector,{name,comment:'Flow Diagram Connector',color,appearance:{stroke,fill},geometry:{path:[[0,0],[100,0]],keys:[0,1]}});
  return connector;
}
const node=nodeMock('Manually colored node'),dotNode=nodeMock('Junction','dot'),wire=connectorMock('Panel override / baked wire');
const unrelated={name:'Ordinary shape',comment:'User artwork'};
const malformed={name:'Damaged generated node',comment:'Flow Diagram Node|rectangle',property(){throw Error('missing structure');}};
const layers=[unrelated,node,malformed,dotNode,wire];
const comp={selectedLayers:[node],numLayers:layers.length,layer:i=>layers[i-1]};
const themeValues={};for(const key of ['Node Fill','Node Border','Connector Color','Text Color','Shadow Opacity','Gradient Amount'])themeValues[key]=paintProperty(0);
let undoBegins=0,undoEnds=0;const alerts=[];
const applying={
  NODE_TAG:'Flow Diagram Node',CONNECTOR_TAG:'Flow Diagram Connector',SCRIPT_NAME:'Flow Diagram',THEME_LAYER_NAME:'FD Theme',
  activeComp:()=>comp,ensureThemeLayer:()=>({theme:true}),
  effectValue:(layer,key)=>layer.theme?themeValues[key]:layer.color,
  findDirectChild:(parent,name)=>parent.children[name]??null,
  nodeTextLayer:layer=>layer.textLayer,
  ensureNodeGradient:contents=>contents.children['Node Gradient'],
  themeColorExpression:key=>'theme:'+key,themeSliderExpression:key=>'theme:'+key,themeTextExpression:()=> 'theme:text',
  app:{beginUndoGroup:()=>undoBegins++,endUndoGroup:()=>undoEnds++},alert:m=>alerts.push(m),
  saveColorSetting:()=>{},saveSetting:()=>{},ui:null
};
vm.createContext(applying);
for(const name of ['isNodeLayer','nodeKindFromComment','isDotNode','linkNodeToTheme','linkConnectorToTheme','linkCompToTheme','applyThemePreset'])vm.runInContext(functionSource(name),applying);
const nodeGeometry=JSON.stringify(node.geometry),wireGeometry=JSON.stringify(wire.geometry);
applying.applyThemePreset({nodeFill:[1,1,1],nodeStroke:[0,0,0],connectorColor:[0,0,0],textColor:[0,0,0],shadowOpacity:0,gradientAmount:0});
assert.equal(node.appearance.fill.expression,'theme:Node Fill');
assert.equal(node.appearance.stroke.expression,'theme:Node Border');
assert.equal(node.appearance.gradient.expression,'theme:Gradient Amount');
assert.equal(node.appearance.shadow.expression,'theme:Shadow Opacity');
assert.equal(node.appearance.text.expression,'theme:text');
assert.equal(dotNode.appearance.fill.expression,'theme:Connector Color');
assert.equal(wire.color.expression,'theme:Connector Color');
assert.ok(wire.appearance.stroke.expression.includes('Connector Color'));
assert.ok(wire.appearance.fill.expression.includes('Connector Color'));
assert.equal(JSON.stringify(node.geometry),nodeGeometry);assert.equal(JSON.stringify(wire.geometry),wireGeometry);
assert.deepEqual(Object.keys(unrelated),['name','comment']);
assert.equal(themeValues['Gradient Amount'].value,0);
assert.equal(undoBegins,1);assert.equal(undoEnds,1);
assert.equal(alerts.length,1);assert.ok(alerts[0].includes('Damaged generated node'));
console.log('PASS: preset Apply clears diagram-wide manual/panel/baked appearance overrides, preserves geometry and unrelated artwork, and reports damaged layers without stopping others.');

// AE indexed-group handles become invalid after remove/add. Reproduce that
// invalidation while testing gradient insertion on older generated nodes.
let epoch=0;
const oldFill=paintProperty([0.2,0.3,0.4]);oldFill.expression='fill-link';
const oldStroke=paintProperty([0.5,0.6,0.7]);oldStroke.expression='stroke-link';
const paints=[{name:'Node Fill',kind:'ADBE Vector Graphic - Fill',props:{'ADBE Vector Fill Color':oldFill}}, {name:'Node Border',kind:'ADBE Vector Graphic - Stroke',props:{'ADBE Vector Stroke Color':oldStroke,'ADBE Vector Stroke Width':paintProperty(6),'ADBE Vector Stroke Line Join':paintProperty(2)}}];
function handle(item) {
 const version=epoch;
 function check(){if(version!==epoch)throw Error('Stale indexed-group handle');}
 return {get name(){check();return item.name;},set name(n){check();item.name=n;},property(key){check();return item.props[key];},remove(){check();paints.splice(paints.indexOf(item),1);epoch++;}};
}
const oldContents={addProperty(kind){epoch++;const item={name:'',kind,props:kind==='ADBE Vector Graphic - Fill'?{'ADBE Vector Fill Color':paintProperty([])}:{'ADBE Vector Stroke Color':paintProperty([]),'ADBE Vector Stroke Width':paintProperty(0),'ADBE Vector Stroke Line Join':paintProperty(0)}};paints.push(item);return handle(item);}};
const upgrading={findDirectChild:(_,name)=>{const item=paints.find(p=>p.name===name);return item?handle(item):null;},addNodeGradient:()=>{epoch++;const item={name:'Node Gradient',props:{'ADBE Vector Fill Opacity':paintProperty(0)}};paints.push(item);return handle(item);}};
vm.createContext(upgrading);vm.runInContext(functionSource('ensureNodeGradient'),upgrading);
const gradient=upgrading.ensureNodeGradient(oldContents);
assert.equal(gradient.property('ADBE Vector Fill Opacity').value,0);
assert.deepEqual(paints.map(p=>p.name),['Node Gradient','Node Fill','Node Border']);
assert.equal(paints[1].props['ADBE Vector Fill Color'].expression,'fill-link');
assert.equal(paints[2].props['ADBE Vector Stroke Color'].expression,'stroke-link');
assert.equal(paints[2].props['ADBE Vector Stroke Width'].value,6);
console.log('PASS: inserting gradient shading reacquires invalidated AE property handles and preserves fill/stroke settings.');


// Route tiles must be exclusive, support mixed values, and use the same
// settings path as the old dropdown when a selection loads or is edited.
const routeUi={ROUTE_ITEMS:['Straight','Orthogonal'],fixControlSize:()=>{},ROUTE_ICON_B64:{},panelIconImage:()=>null};
vm.createContext(routeUi);
for(const name of ['addRouteTiles','addRouteTile','setRouteTileValue','setDropdownValue'])vm.runInContext(functionSource(name),routeUi);
function uiGroup(){return {children:[],add(type,bounds,text){const c=type==='group'?uiGroup():{type,text,value:false,visible:true};this.children.push(c);return c;}};}
const routeParent=uiGroup();const tiles=routeUi.addRouteTiles(routeParent,'Orthogonal');
assert.equal(tiles.selection.text,'Orthogonal');assert.deepEqual(Array.from(tiles.routeButtons,b=>b.value),[false,true]);
let changed=0;tiles.onChange=()=>changed++;tiles.routeButtons[0].onClick();
assert.equal(tiles.selection.text,'Straight');assert.equal(changed,1);
tiles.routeButtons[0].value=false;tiles.routeButtons[0].onClick();assert.equal(tiles.routeButtons[0].value,true);
routeUi.setDropdownValue(tiles,null);assert.equal(tiles.selection,null);assert.deepEqual(Array.from(tiles.routeButtons,b=>b.value),[false,false]);
routeUi.setDropdownValue(tiles,'Orthogonal');assert.equal(tiles.selection.text,'Orthogonal');assert.equal(changed,2,'Loading values must not edit selected connectors');
console.log('PASS: exclusive route selection, re-clicking active route, mixed state, dropdown compatibility, and native fallback.');

const polling={lastPanelSelection:'',nodeIds:layers=>layers.map(l=>l.id),syncControlsFromSelection:()=>changed++};vm.createContext(polling);vm.runInContext(functionSource('syncPanelSelection'),polling);
changed=0;polling.syncPanelSelection({id:1,selectedLayers:[{id:10}]});polling.syncPanelSelection({id:1,selectedLayers:[{id:10}]});assert.equal(changed,1);
polling.syncPanelSelection({id:1,selectedLayers:[{id:11}]});assert.equal(changed,2);
polling.syncPanelSelection({id:2,selectedLayers:[{id:11}]});assert.equal(changed,3);
polling.syncPanelSelection({get id(){throw Error('Modal active');}});assert.equal(changed,3);
console.log('PASS: automatic selection refresh detects changes and comp switches, avoids repeated refresh, and tolerates modal access errors.');

// Build the complete panel against a minimal ScriptUI surface. This catches
// removed-control references and checks routes are wired to the existing editor.
const created=[];
class MockControl {
 constructor(type,text){this.type=type;this.text=typeof text==='string'?text:'';this.children=[];this.preferredSize={};this.minimumSize={};this.maximumSize={};this.items=Array.isArray(text)?text.map((v,i)=>({text:v,index:i})):[];this.layout={layout(){},resize(){}};this._selection=null;created.push(this);}
 add(type,bounds,text){const child=new MockControl(type,text);this.children.push(child);return child;}
 set selection(value){this._selection=typeof value==='number'?this.items[value]:value;}
 get selection(){return this._selection;}
 addEventListener(){}
 center(){}
 show(){}
}
class MockPanel extends MockControl {constructor(){super('panel','');}}
class MockWindow extends MockPanel {}
const full={Panel:MockPanel,Window:MockWindow,ScriptUI:{newImage:()=>({})},$:{global:{}},app:{scheduleTask:()=>1,cancelTask(){},settings:{haveSetting:()=>false}}};
vm.createContext(full);
vm.runInContext(source.replace(/^#.*$/gm,'').replace('    var panel = buildUI(thisObj);','    var panel = buildUI(thisObj);\n    $.global.testPanel = { ui: ui, panel: panel };'),full);
const liveUi=full.$.global.testPanel.ui;
assert.equal(liveUi.type.routeButtons.length,2);assert.equal(liveUi.type.selection.text,'Orthogonal');
assert.ok(created.some(c=>c.text==='Apply to all'));
assert.ok(!created.some(c=>c.text==='Reset to Theme'||c.text==='Head'||c.text==='Path route'||c.text==='\u21BB'));
assert.deepEqual(Array.from(liveUi.colorButton.minimumSize),[32,24]);
assert.deepEqual(Array.from(liveUi.colorButton.maximumSize),[32,24]);
assert.equal(typeof full.$.global.__flowDiagramTrackSelection,'function');
console.log('PASS: complete panel construction, route wiring, flat fixed-size swatches, updated labels, and automatic selection tracker.');

console.log('All regression checks passed; AE visual validation remains separate.');
