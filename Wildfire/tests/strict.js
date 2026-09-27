// A canvas mock that enforces the argument validation real browsers do,
// so harness-only tolerance can't hide a browser-only crash.
const base = require('./shim.js');
const Proto = Object.getPrototypeOf(new base.Canvas(4,4).getContext('2d'));

const bad = v => typeof v === 'number' && !isFinite(v);
function chk(name, ...vals){
  for(const v of vals) if(bad(v)) throw new TypeError(name+': non-finite argument ('+vals.join(',')+')');
}
const wrap = (name, fn, validate) => {
  const orig = Proto[name];
  Proto[name] = function(...a){ validate && validate.apply(this,a); return orig.apply(this,a); };
};

wrap('arc', null, function(x,y,r,a0,a1){
  chk('arc',x,y,r,a0,a1);
  if(r < 0) { const e=new Error("IndexSizeError: arc radius "+r+" is negative"); e.name='IndexSizeError'; throw e; }
});
wrap('fillRect', null, function(x,y,w,h){ chk('fillRect',x,y,w,h); });
wrap('strokeRect', null, function(x,y,w,h){ chk('strokeRect',x,y,w,h); });
wrap('translate', null, function(x,y){ chk('translate',x,y); });
wrap('scale', null, function(x,y){ chk('scale',x,y); });
wrap('moveTo', null, function(x,y){ chk('moveTo',x,y); });
wrap('lineTo', null, function(x,y){ chk('lineTo',x,y); });
wrap('fillText', null, function(t,x,y){
  chk('fillText',x,y);
  if(t===undefined||t===null) throw new TypeError('fillText: text is '+t);
});
wrap('drawImage', null, function(img,...rest){
  if(!img) throw new TypeError('drawImage: source is '+img);
  if(!img.width || !img.height){
    const e=new Error('InvalidStateError: drawImage source is '+img.width+'x'+img.height);
    e.name='InvalidStateError'; throw e;
  }
  chk('drawImage',...rest);
});
wrap('createRadialGradient', null, function(x0,y0,r0,x1,y1,r1){
  chk('createRadialGradient',x0,y0,r0,x1,y1,r1);
  if(r0<0||r1<0) throw new Error('IndexSizeError: negative gradient radius');
});

// save/restore balance tracking
const origSave=Proto.save, origRestore=Proto.restore;
Proto.save=function(){ this.__depth=(this.__depth||0)+1; return origSave.call(this); };
Proto.restore=function(){ this.__depth=(this.__depth||0)-1;
  if(this.__depth<0) throw new Error('restore() without save()');
  return origRestore.call(this); };

// Web Audio with the same argument rules the spec enforces
class Param {
  constructor(v){ this.value=v; }
  setValueAtTime(v,t){ if(bad(v)||bad(t)) throw new TypeError('setValueAtTime NaN'); this.value=v; return this; }
  linearRampToValueAtTime(v,t){ return this; }
  exponentialRampToValueAtTime(v,t){
    if(v===0) throw new RangeError('exponentialRampToValueAtTime: target must be non-zero');
    if(this.value===0) throw new RangeError('exponentialRampToValueAtTime: current value is 0');
    if(bad(v)||bad(t)) throw new TypeError('exponentialRampToValueAtTime NaN');
    this.value=v; return this;
  }
}
// AudioParams are READ-ONLY accessors in the real Web Audio API. Assigning to
// them (node.Q = 0.9 instead of node.Q.value = 0.9) throws in strict mode.
// The mock has to enforce that or it hides real crashes.
class Node {
  constructor(){
    const g=new Param(1), f=new Param(440), q=new Param(1), d=new Param(0);
    Object.defineProperty(this,'gain',{get:()=>g, enumerable:true});
    Object.defineProperty(this,'frequency',{get:()=>f, enumerable:true});
    Object.defineProperty(this,'Q',{get:()=>q, enumerable:true});
    Object.defineProperty(this,'detune',{get:()=>d, enumerable:true});
  }
  connect(){return this;} disconnect(){} start(){} stop(){}
}
global.AudioContext = class {
  constructor(){ this.currentTime=0; this.sampleRate=48000; this.state='running'; this.destination=new Node(); }
  createGain(){ return new Node(); }
  createOscillator(){ const n=new Node(); n.type='sine'; return n; }
  createBiquadFilter(){ const n=new Node(); n.type='lowpass'; return n; }
  createBufferSource(){ const n=new Node(); n.buffer=null; return n; }
  createBuffer(ch,len,rate){
    if(!(len>0)) throw new Error('NotSupportedError: buffer length '+len);
    return { getChannelData:()=>new Float32Array(len) };
  }
  resume(){ return Promise.resolve(); }
};
module.exports = base;
