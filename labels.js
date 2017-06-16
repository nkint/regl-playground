import createRegl from 'regl'
import createCamera from 'regl-camera'
import createPlane from 'primitive-plane'

const regl = createRegl()
const camera = createCamera(regl, {
  theta: Math.PI / 2,
})
const plane = createPlane(1, 1, 1, 1)
console.log(plane)

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
canvas.width = 100
canvas.height = 100
ctx.fillStyle = 'blue'
ctx.fillRect(0, 0, 50, 100)
ctx.fillStyle = 'green'
ctx.fillRect(50, 0, 50, 100)
ctx.fillStyle = 'red'
ctx.fillRect(1, 1, 10, 10)

document.body.append(canvas)

const texture = regl.texture({
  flipY: true,
  data: canvas,
})

console.log(texture)

const vert = `
  precision mediump float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  uniform mat4 projection, view;
  void main() {
    vec3 model = position;
    gl_Position = projection * view * vec4(position, 1);

    vUv = uv;
  }
`

const frag = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D texture;
  void main() {
    gl_FragColor = texture2D(texture, vUv); // vec4(1.0, 0.0, 0.0, 1.0);
  }
`

const draw = regl({
  attributes: {
    position: plane.positions,
    uv: plane.uvs,
  },
  elements: plane.cells,
  uniforms: {
    texture,
  },
  vert,
  frag,
})

regl.frame(() => {
  regl.clear({ color: [0, 0, 0, 1], depth: true })
  camera(() => {
    draw()
  })
})
