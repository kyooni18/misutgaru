var e=globalThis.GPUBufferUsage??{MAP_READ:1,COPY_SRC:4,COPY_DST:8,STORAGE:128,UNIFORM:64},t=globalThis.GPUMapMode??{READ:1},n=`
struct Spring {
  state: vec4<f32>,
  dynamics: vec4<f32>,
};

struct Params {
  dt: f32,
  count: u32,
  _padding: vec2<u32>,
};

@group(0) @binding(0) var<storage, read_write> springs: array<Spring>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= params.count) { return; }

  var spring = springs[id.x];
  let x = spring.state.x;
  let v = spring.state.y;
  let target = spring.state.z;
  let omega = spring.state.w;
  let damping = spring.dynamics.x;
  let acceleration = omega * omega * (target - x) - 2.0 * damping * omega * v;
  let nextVelocity = v + acceleration * params.dt;
  spring.state.x = x + nextVelocity * params.dt;
  spring.state.y = nextVelocity;
  springs[id.x] = spring;
}
`;function r(e){let t=Math.floor(Number(e));if(!Number.isFinite(t)||t<1)throw RangeError(`WebGPU spring capacity must be a positive integer.`);return t}function i(e){let t=1;for(;e/t>.004166666666666667&&t<32;)t+=1;return t}var a=class a{static isSupported(e){return!!(e?.createBuffer&&e?.createShaderModule&&e?.createComputePipeline&&e?.createBindGroup&&e?.createCommandEncoder&&e?.queue?.submit&&e?.queue?.writeBuffer)}static async create(e=65536,t){e&&typeof e==`object`&&(t=e,e=65536);let n=t;if(!n){let e=globalThis.navigator?.gpu??globalThis.gpu;if(!e?.requestAdapter)throw Error(`WebGPU is unavailable in this environment.`);let t=await e.requestAdapter();if(!t?.requestDevice)throw Error(`No WebGPU adapter is available.`);n=await t.requestDevice()}if(!a.isSupported(n))throw Error(`The WebGPU device does not support compute buffers.`);return new a(n,e)}constructor(t,i=65536){if(!a.isSupported(t))throw TypeError(`WebGPUSpringBatch requires a GPUDevice-like object.`);this.kind=`webgpu`,this.variant=`compute`,this.device=t,this.capacity=r(i),this.positions=new Float32Array(this.capacity),this.velocities=new Float32Array(this.capacity),this.targets=new Float32Array(this.capacity),this.omegas=new Float32Array(this.capacity),this.dampingRatios=new Float32Array(this.capacity),this.packed=new Float32Array(this.capacity*8),this.params=new Uint32Array(4),this.paramsFloat=new Float32Array(this.params.buffer),this.stepChain=Promise.resolve(),this.disposed=!1;let o=this.packed.byteLength;this.storageBuffer=t.createBuffer({size:o,usage:e.STORAGE|e.COPY_SRC|e.COPY_DST}),this.readbackBuffer=t.createBuffer({size:o,usage:e.MAP_READ|e.COPY_DST}),this.paramsBuffer=t.createBuffer({size:this.params.byteLength,usage:e.UNIFORM|e.COPY_DST});let s=t.createShaderModule({code:n});this.pipeline=t.createComputePipeline({layout:`auto`,compute:{module:s,entryPoint:`step`}}),this.bindGroup=t.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.storageBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}}]})}ensureCapacity(e){if(e>this.capacity)throw RangeError(`WebGPU spring capacity exceeded (${e} > ${this.capacity}).`)}copyInto(e,t){e.positions.set(this.positions.subarray(0,t)),e.velocities.set(this.velocities.subarray(0,t)),e.targets.set(this.targets.subarray(0,t)),e.omegas.set(this.omegas.subarray(0,t)),e.dampingRatios.set(this.dampingRatios.subarray(0,t))}step(){throw Error(`WebGPUSpringBatch.step() is asynchronous; use stepAsync().`)}#e(e){for(let t=0;t<e;t+=1){let e=t*8;this.packed[e]=this.positions[t],this.packed[e+1]=this.velocities[t],this.packed[e+2]=this.targets[t],this.packed[e+3]=this.omegas[t],this.packed[e+4]=this.dampingRatios[t],this.packed[e+5]=0,this.packed[e+6]=0,this.packed[e+7]=0}}#t(e,t){this.packed.set(new Float32Array(t).subarray(0,e*8));for(let t=0;t<e;t+=1){let e=t*8;this.positions[t]=this.packed[e],this.velocities[t]=this.packed[e+1]}}async#n(e,n){if(this.disposed||e<=0||n<=0)return;this.ensureCapacity(e),this.#e(e),this.paramsFloat[0]=n/i(n),this.params[1]=e,this.device.queue.writeBuffer(this.storageBuffer,0,this.packed,0,e*8*Float32Array.BYTES_PER_ELEMENT),this.device.queue.writeBuffer(this.paramsBuffer,0,this.params);let r=this.device.createCommandEncoder(),a=r.beginComputePass();a.setPipeline(this.pipeline),a.setBindGroup(0,this.bindGroup);let o=i(n);for(let t=0;t<o;t+=1)a.dispatchWorkgroups(Math.ceil(e/64));a.end();let s=e*8*Float32Array.BYTES_PER_ELEMENT;r.copyBufferToBuffer(this.storageBuffer,0,this.readbackBuffer,0,s),this.device.queue.submit([r.finish()]),await this.device.queue.onSubmittedWorkDone?.(),await this.readbackBuffer.mapAsync(t.READ);let c=this.readbackBuffer.getMappedRange();this.#t(e,c),this.readbackBuffer.unmap()}stepAsync(e,t){let n=()=>this.#n(e,t),r=this.stepChain.then(n,n);return this.stepChain=r.catch(()=>{}),r}dispose(){this.disposed||(this.disposed=!0,this.storageBuffer.destroy?.(),this.readbackBuffer.destroy?.(),this.paramsBuffer.destroy?.())}};export{a as WebGPUSpringBatch};