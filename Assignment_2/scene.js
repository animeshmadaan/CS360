////////////////////////////////////////////////////////////////////////
//  A simple WebGL program to show different shading techniques
//

var gl;
var canvas;
var mMatrixStack = [];

var aPositionLocation;
var aNormalLocation;
var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;

var uLightPosLocation;
var uDiffuseColorLocation;
var uSpecularColorLocation;
var uAmbientColorLocation;

var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var spBuf;
var spIndexBuf;
var spNormalBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var degree0 = 0.0;
var degree1 = 0.0;
var degree2 = 0.0;
var degree3 = 0.0;
var degree4 = 0.0;
var degree5 = 0.0;

var prevMouseX = 0.0;
var prevMouseY = 0.0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var uNormalMatrix = mat3.create(); // normal matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

// specify light properties
var lightPos = [5, 5, 3];
var diffuseColor = [1.0, 1.0, 1.0];
var specularColor = [1.0, 1.0, 1.0];
var ambientColor = [1, 1, 1];

var currentViewport = null;


/* Flat shading */

// Vertex shader code
const flatVertexShaderCode = `#version 300 es
in vec3 aPosition;
//in vec3 aNormal;

uniform mat4 uMMatrix; // Model matrix
uniform mat4 uVMatrix; // View matrix
uniform mat4 uPMatrix; // Projection matrix

out vec3 vPosEyeSpace; // Position in eye space

void main() {
    // Compute the Model-View matrix
    mat4 modelViewMatrix = uVMatrix * uMMatrix;

    // Transform the vertex position to clip space
    gl_Position = uPMatrix * modelViewMatrix * vec4(aPosition, 1.0);

    // Pass the position in eye space to the fragment shader
    vPosEyeSpace = (modelViewMatrix * vec4(aPosition, 1.0)).xyz;
}`;

// Fragment shader code
const flatFragShaderCode = `#version 300 es
precision mediump float;

in vec3 vPosEyeSpace; // Position in eye space from vertex shader

uniform vec3 uLightPos;  // Light position in eye space
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;

out vec4 fragColor;

void main() {
    // Compute the face normal using the derivatives of the position
    vec3 normal = normalize(cross(dFdx(vPosEyeSpace), dFdy(vPosEyeSpace)));

    // Compute the light direction
    vec3 lightDir = normalize(uLightPos - vPosEyeSpace);

    // Compute the view direction (from fragment to camera)
    vec3 reflectDir = normalize(-reflect(lightDir, normal));

    // Calculate ambient component
    float ambientStrength = 0.10;
    vec3 ambient = uAmbientColor * ambientStrength;

    // Calculate diffuse component
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = uDiffuseColor * diff;

    // Calculate specular component
    float specularStrength = 1.0;
    float shininess = 35.0;
    float spec = pow(max(dot(normalize(-vPosEyeSpace), reflectDir), 0.0), shininess);
    vec3 specular = uSpecularColor * specularStrength * spec;

    // Combine all lighting components
    vec3 color = ambient + diffuse + specular;

    fragColor = vec4(color, 1.0);
}`;

/* Gouraud shading or per vertex shading */

// Vertex shader code
const perVertShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix; // Model matrix
uniform mat4 uVMatrix; // View matrix
uniform mat4 uPMatrix; // Projection matrix

out vec3 fColor;

uniform vec3 uLightPos;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform vec3 uAmbientColor;

void main() {
    // Compute the Model-View matrix
    mat4 modelViewMatrix = uVMatrix * uMMatrix;

    // Transform the vertex position to eye space
    vec3 posEyeSpace = (modelViewMatrix * vec4(aPosition, 1.0)).xyz;

    // Compute the normal matrix (inverse transpose of the model-view matrix)
    mat3 normalMatrix = transpose(inverse(mat3(modelViewMatrix)));

    // Transform the normal to eye space and normalize
    vec3 normalEyeSpace = normalize(normalMatrix * aNormal);

    // Compute the light direction and normalize
    vec3 lightDir = normalize(uLightPos - posEyeSpace);

   // Compute the view direction (from fragment to camera)
    vec3 viewDir = normalize(-posEyeSpace);

    // Compute the reflection direction
    vec3 reflectDir = reflect(-lightDir, normalEyeSpace);

    // Calculate ambient component
    float ambientStrength = 0.15;
    vec3 ambient = uAmbientColor * ambientStrength;

    // Calculate diffuse component
    float diff = max(dot(normalEyeSpace, lightDir), 0.0);
    vec3 diffuse = uDiffuseColor * diff;

    // Calculate specular component
    float specularStrength = 1.0;
    float shininess = 30.0;
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = uSpecularColor * specularStrength * spec;

    // Combine all lighting components
    fColor = ambient + diffuse + specular;

    // Calculate final vertex position in clip space
    gl_Position = uPMatrix * modelViewMatrix * vec4(aPosition, 1.0);
}`;

// Fragment shader code
const perVertFragShaderCode = `#version 300 es
precision mediump float;

in vec3 fColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(fColor, 1.0);
}`;


/* Phong shading or per fragment shading */

// Vertex shader code
const perFragVertexShaderCode = `#version 300 es
// Vertex attributes
in vec3 aPosition;
in vec3 aNormal;

// Uniform matrices
uniform mat4 uMMatrix;  // Model matrix
uniform mat4 uVMatrix;  // View matrix
uniform mat4 uPMatrix;  // Projection matrix
uniform vec3 uLightPos; // Light position

// Outputs to the fragment shader
out vec3 vNormalEyeSpace;
out vec3 vPosEyeSpace;
out vec3 lightDir;
out vec3 viewDir;

void main() {
    // Compute position in eye space
    vec4 positionEye4 = uVMatrix * uMMatrix * vec4(aPosition, 1.0);
    vPosEyeSpace = positionEye4.xyz;

    // Compute normal in eye space
    mat3 normalMatrix = mat3(uVMatrix * uMMatrix);
    vNormalEyeSpace = normalize(normalMatrix * aNormal);

    // Compute light and view directions
    lightDir = normalize(uLightPos - vPosEyeSpace);
    viewDir = normalize(-vPosEyeSpace);

    // Compute position in clip space
    gl_Position = uPMatrix * positionEye4;
}`;

// Fragment shader code
const perFragFragShaderCode = `#version 300 es
precision mediump float;

// Inputs from the vertex shader
in vec3 vNormalEyeSpace;
in vec3 vPosEyeSpace;
in vec3 lightDir;
in vec3 viewDir;

// Uniforms
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;

// Output fragment color
out vec4 fragColor;

void main() {
    // Normalize interpolated normal
    vec3 normal = normalize(vNormalEyeSpace);

    // Compute reflection vector
    vec3 reflectionDir = normalize(-reflect(lightDir, normal));

    // Ambient component
    vec3 ambient = uAmbientColor * 0.15;

    // Diffuse component
    float diffuseFactor = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = uDiffuseColor * diffuseFactor;

    // Specular component
    float specularFactor = pow(max(dot(reflectionDir, viewDir), 0.0), 30.0);
    vec3 specular = uSpecularColor * specularFactor;

    // Combine all components
    vec3 finalColor = ambient + diffuse + specular;

    // Set the fragment color
    fragColor = vec4(finalColor, 1.0);
}`;

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(vertexShaderCode, fragShaderCode) {
    shaderProgram = gl.createProgram();

    var vertexShader = vertexShaderSetup(vertexShaderCode);
    var fragmentShader = fragmentShaderSetup(fragShaderCode);

    // attach the shaders
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    //link the shader program
    gl.linkProgram(shaderProgram);

    // check for compilation and linking status
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
        console.log(gl.getShaderInfoLog(fragmentShader));
    }

    //finally use the program.
    gl.useProgram(shaderProgram);

    return shaderProgram;
}

function initGL(canvas) {
  try {
        gl = canvas.getContext("webgl2"); // the graphics webgl2 context
        gl.viewportWidth = canvas.width; // the width of the canvas
        gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function pushMatrix(stack, m) {
    //necessary because javascript only does shallow push
    var copy = mat4.create(m);
    stack.push(copy);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack has no matrix to pop!");
}

// Cube generation function with normals
function initCubeBuffer() {
    var vertices = [
        // Front face
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Back face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        // Top face
        -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Bottom face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
        // Right face
        0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
        // Left face
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
    ];
    cubeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeBuf.itemSize = 3;
    cubeBuf.numItems = vertices.length / 3;
  
    var normals = [
        // Front face
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
        // Back face
        0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
        // Top face
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
        // Bottom face
        0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
        // Right face
        1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
        // Left face
        -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    ];
    cubeNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    cubeNormalBuf.itemSize = 3;
    cubeNormalBuf.numItems = normals.length / 3;
  
  
    var indices = [
        0,
        1,
        2,
        0,
        2,
        3, // Front face
        4,
        5,
        6,
        4,
        6,
        7, // Back face
        8,
        9,
        10,
        8,
        10,
        11, // Top face
        12,
        13,
        14,
        12,
        14,
        15, // Bottom face
        16,
        17,
        18,
        16,
        18,
        19, // Right face
        20,
        21,
        22,
        20,
        22,
        23, // Left face
    ];
    cubeIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );
    cubeIndexBuf.itemSize = 1;
    cubeIndexBuf.numItems = indices.length;
}

function drawCube() {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        cubeBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // draw normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(
        aNormalLocation,
        cubeNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    gl.uniform3fv(uLightPosLocation, lightPos);
    gl.uniform3fv(uAmbientColorLocation, ambientColor);
    gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    //gl.drawArrays(gl.LINE_STRIP, 0, cubeIndexBuf.numItems); // show lines
    //gl.drawArrays(gl.POINTS, 0, cubeIndexBuf.numItems); // show points
}

function initSphere(nslices, nstacks, radius) {
    var theta1, theta2;
  
    for (i = 0; i < nslices; i++) {
        spVerts.push(0);
        spVerts.push(-radius);
        spVerts.push(0);
    
        spNormals.push(0);
        spNormals.push(-1.0);
        spNormals.push(0);
    }
  
    for (j = 1; j < nstacks - 1; j++) {
        theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
        for (i = 0; i < nslices; i++) {
            theta2 = (i * 2 * Math.PI) / nslices;
            spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
            spVerts.push(radius * Math.sin(theta1));
            spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));
    
            spNormals.push(Math.cos(theta1) * Math.cos(theta2));
            spNormals.push(Math.sin(theta1));
            spNormals.push(Math.cos(theta1) * Math.sin(theta2));
        }
    }

    for (i = 0; i < nslices; i++) {
        spVerts.push(0);
        spVerts.push(radius);
        spVerts.push(0);
    
        spNormals.push(0);
        spNormals.push(1.0);
        spNormals.push(0);
    }

    // setup the connectivity and indices
    for (j = 0; j < nstacks - 1; j++) {
        for (i = 0; i <= nslices; i++) {
            var mi = i % nslices;
            var mi2 = (i + 1) % nslices;
            var idx = (j + 1) * nslices + mi;
            var idx2 = j * nslices + mi;
            var idx3 = j * nslices + mi2;
            var idx4 = (j + 1) * nslices + mi;
            var idx5 = j * nslices + mi2;
            var idx6 = (j + 1) * nslices + mi2;

            spIndicies.push(idx);
            spIndicies.push(idx2);
            spIndicies.push(idx3);
            spIndicies.push(idx4);
            spIndicies.push(idx5);
            spIndicies.push(idx6);
        }
    }
}

function initSphereBuffer() {
    var nslices = 30; // use even number
    var nstacks = nslices / 2 + 1;
    var radius = 1.0;
    initSphere(nslices, nstacks, radius);

    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
    spBuf.itemSize = 3;
    spBuf.numItems = nslices * nstacks;

    spNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    spNormalBuf.itemSize = 3;
    spNormalBuf.numItems = nslices * nstacks;

    spIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
    gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
    );
    spIndexBuf.itemsize = 1;
    spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

function drawSphere() {
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        spBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
  
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.vertexAttribPointer(
        aNormalLocation,
        spNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
  
    // Draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
    gl.uniform3fv(uLightPosLocation, lightPos);
    gl.uniform3fv(uAmbientColorLocation, ambientColor);
    gl.uniform3fv(uDiffuseColorLocation, diffuseColor);
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

//////////////////////////////////////////////////////////////////////
//Main drawing routine

function drawFlatShading() {

    // initialize shader program
    shaderProgram = initShaders(flatVertexShaderCode, flatFragShaderCode);
    
    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");

    // Enable attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enable(gl.DEPTH_TEST);

    // Initialize buffers for the cube and sphere
    initCubeBuffer();
    initSphereBuffer();

    // enable scissor test for multiple viewports
    gl.enable(gl.SCISSOR_TEST);

    // ***** First Viewport *****
    // Set the viewport to the first third of the canvas
    gl.viewport(0 * gl.viewportWidth, 0, gl.viewportWidth / 3, gl.viewportHeight);
    gl.scissor(0 * gl.viewportWidth, 0, gl.viewportWidth / 3, gl.viewportHeight);
    
    gl.clearColor(0.8, 0.8, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    //set up perspective projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    //set up the model matrix
    mat4.identity(mMatrix);

    pushMatrix(mMatrixStack, mMatrix);
    // transformations applied here on model matrix
    mMatrix = mat4.rotate(mMatrix, degToRad(degree0), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree1), [1, 0, 0]);
    

    //reset position
    mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(25), [0, 1, 0]);
    mMatrix = mat4.translate(mMatrix, [0, -.3, 0]);

    //draw the cube
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.8, 0.5]);
    diffuseColor = [0.9, 0.85, 0.6];
    drawCube();
    mMatrix = popMatrix(mMatrixStack);

    //draw the sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.7, 0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 0.3]);
    diffuseColor = [0, 0.6, 0.8];
    drawSphere();
}

function drawPerVertShading() {
    // initialize shader program
    shaderProgram = initShaders(perVertShaderCode, perVertFragShaderCode);
    
    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");

    // Enable attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enable(gl.DEPTH_TEST);

    // Initialize buffers for the cube and sphere
    initCubeBuffer();
    initSphereBuffer();

    // enable scissor test for multiple viewports
    gl.enable(gl.SCISSOR_TEST);

    // ***** Second Viewport *****
    // Set the viewport to the second third of the canvas
    gl.viewport(1 * (gl.viewportWidth / 3), 0, gl.viewportWidth / 3, gl.viewportHeight);
    gl.scissor(1 * (gl.viewportWidth / 3), 0, gl.viewportWidth / 3, gl.viewportHeight);

    gl.clearColor(1.0, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    //set up perspective projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    //set up the model matrix
    mat4.identity(mMatrix);

    pushMatrix(mMatrixStack, mMatrix);
    // transformations applied here on model matrix
    mMatrix = mat4.rotate(mMatrix, degToRad(degree2), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree3), [1, 0, 0]);
    

    //reset position
    mMatrix = mat4.translate(mMatrix, [0, -.3, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(20), [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-25), [0, 0, 1]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-15), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0.8]);

    //largest sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    diffuseColor = [0.9, 0.9, 0.9];
    drawSphere();

    //set of medium cube and sphere
    mMatrix = mat4.translate(mMatrix, [-1.5, 1.2, 0]);
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -1.0, 0]);
    diffuseColor = [0, 0.8, 0];
    drawCube();
    mMatrix = mat4.translate(mMatrix, [0, 1.0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    diffuseColor = [0.9, 0.9, 0.9];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);
    
    //set of smallest cube and sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(45), [0, 0, 1]);
    mMatrix = mat4.translate(mMatrix, [0.75, 0.5, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    mMatrix = mat4.translate(mMatrix, [0, -1.0, 0]);
    diffuseColor = [0, 0.8, 0];
    drawCube();
    mMatrix = mat4.translate(mMatrix, [0, 1.0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    diffuseColor = [0.9, 0.9, 0.9];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);
}

function drawPerFragShading() {
    // initialize shader program
    shaderProgram = initShaders(perFragVertexShaderCode, perFragFragShaderCode);
    
    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");

    // Enable attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enable(gl.DEPTH_TEST);

    // Initialize buffers for the cube and sphere
    initCubeBuffer();
    initSphereBuffer();

    // enable scissor test for multiple viewports
    gl.enable(gl.SCISSOR_TEST);

    // ***** Third Viewport *****
    // Set the viewport to the last third of the canvas
    gl.viewport(2 * (gl.viewportWidth / 3), 0, gl.viewportWidth / 3, gl.viewportHeight);
    gl.scissor(2 * (gl.viewportWidth / 3), 0, gl.viewportWidth / 3, gl.viewportHeight);

    gl.clearColor(0.9, 1.0, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

    //set up perspective projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    //set up the model matrix
    mat4.identity(mMatrix);

    pushMatrix(mMatrixStack, mMatrix);
    // transformations applied here on model matrix
    mMatrix = mat4.rotate(mMatrix, degToRad(degree4), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree5), [1, 0, 0]);
    

    // //reset position
    // mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
    mMatrix = mat4.translate(mMatrix, [0, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(5), [1, 0, 0]);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    
    //middle-right plank
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1, 0, 0]);
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [.8, .08, 1.7]);
    diffuseColor = [0.0, 0.9, 0.8];
    drawCube();
    mMatrix = popMatrix(mMatrixStack);

    //middle-right-top sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.44, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    diffuseColor = [0.8, 0.6, 0.2];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);

    //middle-right-bottom sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.44, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    diffuseColor = [0.0, 0.7, 0.7];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);
    mMatrix = popMatrix(mMatrixStack);

    //middle-left plank
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1, 0, 0]);
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [.8, .08, 1.7]);
    diffuseColor = [0.9, 0.9, 0.0];
    drawCube();
    mMatrix = popMatrix(mMatrixStack);

    //middle-left-top sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.44, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    diffuseColor = [1.0, 0.0, 1.0];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);

    //middle-left-bottom sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.44, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    diffuseColor = [0.4, 0.2, 0.6];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);
    mMatrix = popMatrix(mMatrixStack);

    mMatrix = popMatrix(mMatrixStack);

    //top plank
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.352, 0]);
    mMatrix = mat4.scale(mMatrix, [1.2, 0.032, 0.3]);
    diffuseColor = [0.8, 0.3, 0.0];
    drawCube();
    mMatrix = popMatrix(mMatrixStack);

    //top sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0.568, 0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
    diffuseColor = [0.7, 0.7, 0.9];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);

    // bottom plank
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.352, 0]);
    mMatrix = mat4.scale(mMatrix, [1.2, 0.032, 0.3]);
    diffuseColor = [0.8, 0.3, 0.0];
    drawCube();
    mMatrix = popMatrix(mMatrixStack);

    // bottom sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -0.568, 0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
    diffuseColor = [0.0, 1.0, 0.0];
    drawSphere();
    mMatrix = popMatrix(mMatrixStack);
}

function onMouseDown(event) {
    document.addEventListener("mousemove", onMouseMove, false);
    document.addEventListener("mouseup", onMouseUp, false);
    document.addEventListener("mouseout", onMouseOut, false);

    var x = event.layerX;
    var y = event.layerY;

    // Determine which viewport the mouse is in
    if (x >= 0 && x <= canvas.width / 3 && y >= 0 && y <= canvas.height) {
        currentViewport = 0; // First viewport
    } else if (x > canvas.width / 3 && x <= (2 * canvas.width) / 3 && y >= 0 && y <= canvas.height) {
        currentViewport = 1; // Second viewport
    } else if (x > (2 * canvas.width) / 3 && x <= canvas.width && y >= 0 && y <= canvas.height) {
        currentViewport = 2; // Third viewport
    } else {
        currentViewport = null; // Outside of viewports
    }

    if (currentViewport !== null) {
        prevMouseX = event.clientX;
        prevMouseY = canvas.height - event.clientY;
    }
}

function onMouseMove(event) {
    // make mouse interaction only within canvas

    // If no viewport is active, do nothing
    if (currentViewport === null) {
        return;
    }

    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;

    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;

    // Update rotations based on the active viewport
    if (currentViewport === 0) {
        degree0 = degree0 + diffX1 / 5;
        degree1 = degree1 - diffY2 / 5;
    } else if (currentViewport === 1) {
        degree2 = degree2 + diffX1 / 5;
        degree3 = degree3 - diffY2 / 5;
    } else if (currentViewport === 2) {
        degree4 = degree4 + diffX1 / 5;
        degree5 = degree5 - diffY2 / 5;
    }

    // Redraw all viewports
    drawFlatShading();
    drawPerVertShading();
    drawPerFragShading();
}

function onMouseUp(event) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
    document.removeEventListener("mousemove", onMouseMove, false);
    document.removeEventListener("mouseup", onMouseUp, false);
    document.removeEventListener("mouseout", onMouseOut, false);
}

// This is the entry point from the html
function webGLStart() {
    canvas = document.getElementById("scene");
    canvas.addEventListener("mousedown", onMouseDown, false);

    // initialize WebGL
    initGL(canvas);

    // Add event listeners for the sliders
    const zoomSlider = document.getElementById('zoomSlider');
    const lightSlider = document.getElementById('lightSlider');

    // Update camera position when the zoom slider changes
    zoomSlider.addEventListener('input', function () {
        const zoomValue = parseFloat(zoomSlider.value);
        eyePos[2] = zoomValue; // Update the z-position of the camera
        drawFlatShading();
        drawPerVertShading();
        drawPerFragShading();
    });

    // Update light position when the light slider changes
    lightSlider.addEventListener('input', function () {
        const lightX = parseFloat(lightSlider.value);
        lightPos[0] = lightX; // Update the x-position of the light
        drawFlatShading();
        drawPerVertShading();
        drawPerFragShading();
    });

    drawFlatShading();
    drawPerVertShading();
    drawPerFragShading();
}