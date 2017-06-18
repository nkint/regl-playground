/*
This example demonstrates how to write a texture atlas
inside a canvas.
The squared canvas is divided in N * N tile grid
(so you can write at maximum N * N words).
Thanks to grovesNL ( https://github.com/grovesNL )

TO READ:
https://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/

official regl example:
https://github.com/regl-project/regl/blob/gh-pages/example/tile.js
https://github.com/regl-project/regl/blob/gh-pages/example/assets/map.json
*/

import createRegl from 'regl'
import createCamera from 'regl-camera'
import createPlane from 'primitive-plane'

const regl = createRegl()
const camera = createCamera(regl, {
  theta: Math.PI / 2,
})

const canvasWidth = 500

const N = 3
const widthTile = canvasWidth / N
const heightTile = widthTile

const createCanvas = (width, height, words) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = '#FF3300'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'black'
  ctx.lineWidth = '2'

  const fontSize = 64
  ctx.font = `${fontSize}px monospace`
  const tilePositions = words.reduce((acc, word) => {
    let [x, y] = acc[acc.length - 1]
    // const wordWidth = ctx.measureText(word).width
    ctx.strokeText(word, x, y + fontSize / 2 + 12)
    ctx.strokeRect(x, y, widthTile, heightTile)
    x = x + widthTile
    if (x >= width) {
      y += heightTile
      x = 0
    }
    acc.push([ x, y ])
    return acc
  }, [[0, 0]])

  return { canvas, tilePositions }
}

const words = Array(7).fill(0).map((n, i) => '#' + i)
const { canvas, tilePositions } =
  createCanvas(canvasWidth, canvasWidth, words)
document.body.append(canvas)

const texture = regl.texture({
  // flipY: true,
  data: canvas,
})

const vert = `
  precision mediump float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  uniform mat4 projection, view;
  uniform vec3 translate;
  void main() {
    vec3 model = position;
    gl_Position = projection * view * vec4((position + translate), 1);

    vUv = vec2(uv.x, 1.0 - uv.y);
  }
`

const frag = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D texture;
  uniform vec2 tilePosition;
  uniform vec2 tileSize;
  void main() {
    vec2 uv = vUv * tileSize + tilePosition;
    gl_FragColor = texture2D(texture, uv);
  }
`

const plane = createPlane(1, 1, 1, 1)
console.log({plane})
const draw = regl({
  attributes: {
    position: plane.positions,
    uv: plane.uvs,
  },
  elements: plane.cells,
  uniforms: {
    texture,
    translate: regl.prop('translate'),
    tilePosition: regl.prop('tilePosition'),
    tileSize: regl.prop('tileSize'),
  },
  vert,
  frag,
})

const labels = words.map((word, i) => ({
  translate: [-2 + i * 1.2, 0, 0],
  tilePosition: tilePositions[i].map(n => n / canvasWidth),
  tileSize: [widthTile / canvasWidth, widthTile / canvasWidth],
}))

console.log({labels})

regl.frame(() => {
  regl.clear({ color: [0, 0, 0, 1], depth: true })
  camera(() => {
    draw(labels)
  })
})
