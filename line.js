/*
  tags: advanced

  <p>This example demonstrates rendering screen space projected lines
  from a technique described <a href="https://mattdesl.svbtle.com/drawing-lines-is-hard">here</a>.</p>

  <p>This technique requires each vertex to reference the previous and next vertex in the line;
  this example utilizes attribute byte offsets to share a single position buffer for all three
  of these attributes.</p>
*/
const createRegl = require('regl')
const mat4 = require('gl-mat4')
const createCamera = require('canvas-orbit-camera')
const fit = require('canvas-fit')

const canvas = document.createElement('canvas')
const regl = createRegl(canvas)
const camera = createCamera(canvas)

const POINTS = 300

const positions = []
let alpha = 0
for(let i=0; i<POINTS + 3; i++) {
  alpha += 0.1
  const x = Math.cos(alpha) * 5
  const y = Math.sin(alpha) * 5
  const z = i / 20
  positions.push([x, y, z])
}

const cells = []
for(let i=0; i<POINTS - 4; i+=2) {
  cells.push([i, i+1, i+2])
  cells.push([i+2, i+1, i+3])
}

offset = []
for(let i=0; i<POINTS * 2; i++) {
  offset.push([0.5, -0.5])
}

// Vertex shader from https://mattdesl.svbtle.com/drawing-lines-is-hard
// The MIT License (MIT) Copyright (c) 2015 Matt DesLauriers
const vert = `
uniform mat4 projection;
uniform mat4 model;
uniform mat4 view;
uniform float aspect;

uniform float thickness;
uniform int miter;

attribute vec3 prevPosition;
attribute vec3 currPosition;
attribute vec3 nextPosition;
attribute float offsetScale;

void main() {
  vec2 aspectVec = vec2(aspect, 1.0);
  mat4 projViewModel = projection * view * model;
  vec4 prevProjected = projViewModel * vec4(prevPosition, 1.0);
  vec4 currProjected = projViewModel * vec4(currPosition, 1.0);
  vec4 nextProjected = projViewModel * vec4(nextPosition, 1.0);

  // get 2D screen space with W divide and aspect correction
  vec2 prevScreen = prevProjected.xy / prevProjected.w * aspectVec;
  vec2 currScreen = currProjected.xy / currProjected.w * aspectVec;
  vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;

  float len = thickness;

  // starting point uses (next - current)
  vec2 dir = vec2(0.0);
  if (currScreen == prevScreen) {
    dir = normalize(nextScreen - currScreen);
  }
  // ending point uses (current - previous)
  else if (currScreen == nextScreen) {
    dir = normalize(currScreen - prevScreen);
  }
  // somewhere in middle, needs a join
  else {
    // get directions from (C - B) and (B - A)
    vec2 dirA = normalize((currScreen - prevScreen));
    if (miter == 1) {
      vec2 dirB = normalize((nextScreen - currScreen));
      // now compute the miter join normal and length
      vec2 tangent = normalize(dirA + dirB);
      vec2 perp = vec2(-dirA.y, dirA.x);
      vec2 miter = vec2(-tangent.y, tangent.x);
      dir = tangent;
      len = thickness / dot(miter, perp);
    } else {
      dir = dirA;
    }
  }

  vec2 normal = vec2(-dir.y, dir.x) * thickness;
  normal.x /= aspect;
  vec4 offset = vec4(normal * offsetScale, 0.0, 1.0);
  gl_Position = currProjected + 0.5 * offset;
}`

const frag = `
precision mediump float;
uniform vec4 color;
void main() {
  gl_FragColor = color;
}`

const draw = regl({
  attributes: {
    prevPosition: positions.slice(0, positions.length - 2),
    currPosition: positions.slice(1, positions.length - 1),
    nextPosition: positions.slice(2),
    offsetScale: offset,
  },
  elements: cells,

  uniforms: {
    projection: ({viewportWidth, viewportHeight}) => (
      mat4.perspective([],
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        1000)
    ),
    model: mat4.identity([]),
    view: () => camera.view(),
    aspect: ({viewportWidth, viewportHeight}) => (
      viewportWidth / viewportHeight
    ),

    color: [0.8, 0.5, 0, 1],
    thickness: 1,
    miter: 0
  },
  vert,
  frag
})

regl.frame(({tick}) => {
  regl.clear({
    color: [0.1, 0.1, 0.1, 1],
    depth: 1
  })
  camera.tick()
  draw()
})

window.addEventListener('resize', fit(canvas), false)
document.body.appendChild(canvas)
