import createRegl from 'regl'
import createCamera from 'regl-camera'
import createPlane from 'primitive-plane'

const regl = createRegl()
const camera = createCamera(regl, {
  theta: Math.PI / 2,
})

const canvasWidth = 500

const widthTile = canvasWidth / 3
const heightTile = widthTile

const createCanvas = (width, height, words) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = 'red'
  ctx.fillRect(0, 0, width, height)

  ctx.stroke = 'black'

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

const words = ['a', 'sa', 'dsa', 'dud']
const { canvas, tilePositions } =
  createCanvas(canvasWidth, canvasWidth, words)
document.body.append(canvas)

const texture = regl.texture({
  flipY: true,
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

    vUv = uv;
  }
`

const frag = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D texture;
  uniform vec2 tilePosition;
  uniform vec2 tileSize;
  void main() {
    vec2 uv = vUv;
    gl_FragColor = texture2D(texture, uv); // vec4(1.0, 0.0, 0.0, 1.0);
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
  translate: [-2 + i * 1.2, Math.random() * 2, 0],
  tilePosition: tilePositions[i].position,
  tileSize: [widthTile, widthTile],
}))

console.log({labels})

regl.frame(() => {
  regl.clear({ color: [0, 0, 0, 1], depth: true })
  camera(() => {
    draw(labels)
  })
})
