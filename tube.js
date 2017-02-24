const createRegl = require('regl')
const mat4 = require('gl-mat4')
const createCamera = require('canvas-orbit-camera')
const fit = require('canvas-fit')

const canvas = document.createElement('canvas')
const regl = createRegl(canvas)
const camera = createCamera(canvas)

const heightSubdivision = 10

const position1 = []
const angles1 = []

const NUM = 100

for (let i = 0; i < NUM; i++) {
  position1.push(i / (NUM - 1) - 0.5)
}

for (let i = 0; i < NUM; i++) {
  angles1.push((i / (NUM - 1)) * Math.PI * 2 - Math.PI)
}

const vert = `
precision mediump float;

// position: a one dimensional float along the X axis in the range -0.5 to 0.5, telling us the distance of the vertex along the curve
attribute float position;

// a float in radians in the range -π to π, telling us how far around the tube this vertex is
attribute float angle;

uniform mat4 projection;
uniform mat4 view;

float PI = 3.1415926535897932384626433832795;
const float MAX_NUMBER = 116385.;
const float EPSILON = 1.19209290e-7;

const float lengthSegments = 100.0;
const float thickness = 0.1;
const float radius = 5.0;

// parametric equation to make the tube
vec3 sample (float t) {
  float beta = t * PI;

  // a simple sphere
  float angleSample = t * 2.0 * PI;
  vec2 rot = vec2(cos(angleSample) * radius, sin(angleSample) * radius);
  return vec3(rot, 0.0);
}

vec3 getTangent (vec3 a, vec3 b) {
  return normalize(b - a);
}

void rotateByAxisAngle (inout vec3 normal, vec3 axis, float angle) {
  // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
  // assumes axis is normalized
  float halfAngle = angle / 2.0;
  float s = sin(halfAngle);
  vec4 quat = vec4(axis * s, cos(halfAngle));
  normal = normal + 2.0 * cross(quat.xyz, cross(quat.xyz, normal) + quat.w * normal);
}

// the easy way
void createTube (float t, vec2 volume, out vec3 pos, out vec3 normal) {
  // find next sample along curve
  float nextT = t + (1.0 / lengthSegments);

  // sample the curve in two places
  vec3 cur = sample(t);
  vec3 next = sample(nextT);

  // compute the Frenet-Serret frame
  vec3 T = normalize(next - cur);
  vec3 B = normalize(cross(T, next + cur));
  vec3 N = -normalize(cross(B, T));

  // extrude outward to create a tube
  float tubeAngle = angle;
  float circX = cos(tubeAngle);
  float circY = sin(tubeAngle);

  // compute position and normal
  normal.xyz = normalize(B * circX + N * circY);
  pos.xyz = cur + B * volume.x * circX + N * volume.y * circY;
}

// the robust way
void createTube2 (float t, vec2 volume, out vec3 outPosition, out vec3 outNormal) {
  // Reference:
  // https://github.com/mrdoob/three.js/blob/b07565918713771e77b8701105f2645b1e5009a7/src/extras/core/Curve.js#L268
  float nextT = t + (1.0 / lengthSegments);

  // find first tangent
  vec3 point0 = sample(0.0);
  vec3 point1 = sample(1.0 / lengthSegments);

  vec3 lastTangent = getTangent(point0, point1);
  vec3 absTangent = abs(lastTangent);

  float min = MAX_NUMBER;
  vec3 tmpNormal = vec3(0.0);
  if (absTangent.x <= min) {
    min = absTangent.x;
    tmpNormal.x = 1.0;
  }
  if (absTangent.y <= min) {
    min = absTangent.y;
    tmpNormal.y = 1.0;
  }
  if (absTangent.z <= min) {
    tmpNormal.z = 1.0;
  }

  vec3 tmpVec = normalize(cross(lastTangent, tmpNormal));
  vec3 lastNormal = cross(lastTangent, tmpVec);
  vec3 lastBinormal = cross(lastTangent, lastNormal);
  vec3 lastPoint = point0;

  vec3 normal;
  vec3 tangent;
  vec3 binormal;
  vec3 point;
  float maxLen = (lengthSegments - 1.0);
  float epSq = EPSILON * EPSILON;
  for (float i = 1.0; i < lengthSegments; i += 1.0) {
    float u = i / maxLen;
    // could avoid additional sample here at expense of ternary
    // point = i == 1.0 ? point1 : sample(u);
    point = sample(u);
    tangent = getTangent(lastPoint, point);
    normal = lastNormal;
    binormal = lastBinormal;

    tmpVec = cross(lastTangent, tangent);
    if ((tmpVec.x * tmpVec.x + tmpVec.y * tmpVec.y + tmpVec.z * tmpVec.z) > epSq) {
      tmpVec = normalize(tmpVec);
      float tangentDot = dot(lastTangent, tangent);
      float theta = acos(clamp(tangentDot, -1.0, 1.0)); // clamp for floating pt errors
      rotateByAxisAngle(normal, tmpVec, theta);
    }

    binormal = cross(tangent, normal);
    if (u >= t) break;

    lastPoint = point;
    lastTangent = tangent;
    lastNormal = normal;
    lastBinormal = binormal;
  }

  // extrude outward to create a tube
  float tubeAngle = angle;
  float circX = cos(tubeAngle);
  float circY = sin(tubeAngle);

  // compute the TBN matrix
  vec3 T = tangent;
  vec3 B = binormal;
  vec3 N = -normal;

  // extrude the path & create a new normal
  outNormal.xyz = normalize(B * circX + N * circY);
  outPosition.xyz = point + B * volume.x * circX + N * volume.y * circY;
}

void main() {
  // current position to sample at
  // [-0.5 .. 0.5] to [0.0 .. 1.0]
  float t = (position * 2.0) * 0.5 + 0.5;

  // build our tube geometry
  vec2 volume = vec2(thickness);

  // animate the per-vertex curve thickness
  float volumeAngle = t * lengthSegments * 0.5;
  float volumeMod = sin(volumeAngle) * 0.5 + 0.5;
  volume += 0.01 * volumeMod;

  // build our geometry
  vec3 transformed;
  vec3 objectNormal;
  createTube(t, volume, transformed, objectNormal);

  // project our vertex position
  vec4 mvPosition = view * vec4(transformed, 1.0);
  gl_Position = projection * mvPosition;
}
`

const frag = `
  precision mediump float;

  uniform vec4 color;
  uniform mat4 view;

  varying vec4 vPosition;

  void main() {
    gl_FragColor = vec4(color.rgb, 1.0);
  }
`


const draw = regl({
  count: NUM,
  attributes: {
    position: position1,
    angle: angles1,
  },
  primitive: 'line strip',

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

    color: (context, props) => [1, 0.2, 0.2, 1],
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
