import intersect from 'ray-plane-intersection'
import pick from 'camera-picking-ray'
import mat4 from 'gl-mat4'
import vec3 from 'gl-vec3'
import fit from 'canvas-fit'
import normals from 'angle-normals'
import mp from 'mouse-position'
import createPlane from 'primitive-plane'
import createIcosphere from 'icosphere'

const canvas = document.body.appendChild(document.createElement('canvas'))
const regl = require('regl')(canvas)
const camera = require('canvas-orbit-camera')(canvas)
camera.zoom(100)
window.addEventListener('resize', fit(canvas), false)

const plane = createPlane(10, 10, 1, 1)
plane.normals = normals(plane.cells, plane.positions)
plane.model = mat4.identity([])

const sphere = createIcosphere(5)
sphere.normals = normals(sphere.cells, sphere.positions)
sphere.model = mat4.translate([], mat4.identity([]), [0, 0, 0])

const frag = `
  precision mediump float;
  varying vec3 vnormal;
  void main () {
    gl_FragColor = vec4(abs(vnormal), 1.0);
  }`
const vert = `
  precision mediump float;
  uniform mat4 projection;
  uniform mat4 model;
  uniform mat4 view;
  attribute vec3 position;
  attribute vec3 normal;
  varying vec3 vnormal;
  void main () {
    vnormal = normal;
    gl_Position = projection * view * model * vec4(position, 1.0);
  }`

const drawPlane = regl({
  vert,
  frag,
  attributes: {
    position: regl.prop('positions'),
    normal: regl.prop('normals'),
  },
  elements: regl.prop('elements'),
  uniforms: {
    model: regl.prop('model'),
    projection: regl.context('projection'),
    view: regl.context('view'),
  },
})

const cameraContex = regl({
  context: {
    projection: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
        Math.PI / 4,
        viewportWidth / viewportHeight,
        0.0001,
        1000),
    view: () => {
      camera.tick()
      return camera.view()
    },
  },
})

var outHit = vec3.create()
function doIntersect(projection, view, viewportWidth, viewportHeight, mouse) {
  var projView = mat4.multiply([], projection, view)
  var invProjView = mat4.invert([], projView)
  var viewport = [ 0, 0, viewportWidth, viewportHeight ]
  var ray = {
    origin: [0, 0, 0],
    dir: [0, 0, 0],
  }
  pick(ray.origin, ray.dir, mouse, viewport, invProjView)

  var normal = [0, 0, 1]
  var distance = 0

  return intersect(outHit, ray.origin, ray.dir, normal, distance)
}

const sphereFixed = createIcosphere(5)
sphereFixed.normals = normals(sphereFixed.cells, sphereFixed.positions)
sphereFixed.model = mat4.translate([], mat4.identity([]), [0, 0, 0])
// ---------------- a fixed sphere in one corner of the screen
camera.tick()
const view = camera.view()
const viewportWidth = canvas.getBoundingClientRect().width
const viewportHeight = canvas.getBoundingClientRect().height
const mouse = [0, 0]
const projection = mat4.perspective([],
  Math.PI / 4,
  viewportWidth / viewportHeight,
  0.01,
  1000)
const hit = doIntersect(projection, view, viewportWidth, viewportHeight, mouse)
mat4.translate(sphereFixed.model, sphereFixed.model, hit)
// ---------------- a fixed sphere in one corner of the screen

var outSphereModel = mat4.identity([])
var mpos = mp(canvas)
const loop = regl.frame(({viewportWidth, viewportHeight}) => {
  try {
    regl.clear({
      color: [0, 0, 0, 1],
    })

    cameraContex((context) => {
      var projection = context.projection
      var view = context.view
      var mouse = [ mpos[0], mpos[1] ]
      const hit = doIntersect(projection, view, viewportWidth, viewportHeight, mouse)

      if (hit) {
        mat4.translate(outSphereModel, sphere.model, hit)
      }

      drawPlane([
        {
          elements: plane.cells,
          positions: plane.positions,
          normals: plane.normals,
          model: plane.model,
        },
        {
          elements: sphere.cells,
          positions: sphere.positions,
          normals: sphere.normals,
          model: outSphereModel,
        }, {
          elements: sphereFixed.cells,
          positions: sphereFixed.positions,
          normals: sphereFixed.normals,
          model: sphereFixed.model,
        },
      ])
    })
  } catch (e) {
    console.error(e)
    loop.cancel()
  }
})
