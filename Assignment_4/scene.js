////////////////////////////////////////////////////////////////////////
//  A WebGL program to show shadow mapping
//

var gl;
var canvas;
var mMatrixStack = [];

var FBO, depthTexture;
var depthTextureSize = 1024*16;

var animation;
var isAnimating = false;
var angle = 0.0;

var aPositionLocation;
var aNormalLocation;
var uShadowLocation;
var uDepthTextureLocation;
var uPMatrixLocation;
var uLPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uLVMatrixLocation;
var uNormalMatrixLocation;

var uLightPosLocation;
var uDiffuseColorLocation;
var uSpecularColorLocation;
var uAmbientColorLocation;

var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var cubeTexBuf;

var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;
var objVertexTextureBuffer;

var displace = -1.2;
// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var lvMatrix = mat4.create(); // light view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var uNormalMatrix = mat3.create(); // normal matrix
var lpMatrix = mat4.create(); // light projection matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, displace, 0.0];
var viewUp = [0.0, 1.0, 0.0];

// specify light properties
var lightPos = [2.0, 2.0, -2.0];
var diffuseColor = [1.0, 1.0, 1.0];
var specularColor = [1.0, 1.0, 1.0];
var ambientColor = [1.0, 1.0, 1.0];
var eyePosRad = eyePos[2];

var uDiffuseTermLocation;

// Inpur JSON model file to load
input_JSON = "teapot.json";

/* shadow pass shader code */

const vertexShadowPassShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uLPMatrix;
uniform mat4 uLVMatrix;

uniform vec3 uLightPos; // Light position
uniform mat3 uNormalMatrix; // Normal matrix

// Outputs to the fragment shader
out vec3 vNormalEyeSpace;
out vec3 vPosEyeSpace;
out vec3 lightDir;

void main() {
    // Compute position in eye space
    vec4 positionEye4 = uLVMatrix * uMMatrix * vec4(aPosition, 1.0);
    vPosEyeSpace = positionEye4.xyz;

    // Compute normal in eye space
    vNormalEyeSpace = normalize(uNormalMatrix * aNormal);

    // Transform light position into eye space
    vec3 lightPosEye = (uLVMatrix * vec4(uLightPos, 1.0)).xyz;

    // Compute light direction
    lightDir = normalize(lightPosEye - vPosEyeSpace);

    vec4 worldPos = uMMatrix * vec4(aPosition, 1.0);
    vec4 lightSpacePos = uLPMatrix * uLVMatrix * worldPos;
    gl_Position = lightSpacePos;
}`;

const fragShadowPassShaderCode = `#version 300 es
precision highp float;
out vec4 fragColor;

in vec3 vNormalEyeSpace;
in vec3 vPosEyeSpace;
in vec3 lightDir;

uniform vec3 uDiffuseColor;

void main() {
    // Normalize vectors
    vec3 normal = normalize(vNormalEyeSpace);
    vec3 lightDirection = normalize(lightDir);
    
    // Diffuse
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * uDiffuseColor;

    // Only depth is needed for shadow map
    fragColor = vec4(diffuse, 1.0);
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
uniform mat4 uLVMatrix;  // Light View matrix
uniform mat4 uPMatrix;  // Projection matrix
uniform mat4 uLPMatrix; // Light Projection matrix
uniform vec3 uLightPos; // Light position
uniform mat3 uNormalMatrix; // Normal matrix

// Outputs to the fragment shader
out vec3 vNormalEyeSpace;
out vec3 vPosEyeSpace;
out vec3 lightDir;
out vec3 viewDir;
out vec4 shadowTextureCoord;

void main() {
    // Compute position in eye space
    vec4 positionEye4 = uVMatrix * uMMatrix * vec4(aPosition, 1.0);
    vPosEyeSpace = positionEye4.xyz;

    // Compute normal in eye space
    vNormalEyeSpace = normalize(uNormalMatrix * aNormal);

    // Transform light position into eye space
    vec3 lightPosEye = (uVMatrix * vec4(uLightPos, 1.0)).xyz;

    // Compute light direction
    lightDir = normalize(lightPosEye - vPosEyeSpace);

    // Compute view direction
    viewDir = normalize(-vPosEyeSpace);

    // Compute position in clip space
    gl_Position = uPMatrix * positionEye4;

    // matrix that scales texturelookup values to 0 to 1 from -1 to 1.
    const mat4 textureTransformMat = 
    mat4(0.5, 0.0, 0.0, 0.0,
        0.0, 0.5, 0.0, 0.0,
        0.0, 0.0, 0.5, 0.0,
        0.5, 0.5, 0.5, 1.0);

    // for shadowmap lookup
    mat4 lightprojectionMat = textureTransformMat * uLPMatrix * uLVMatrix * uMMatrix;
    shadowTextureCoord = lightprojectionMat*vec4(aPosition,1.0);
}`;

// Fragment shader code
const perFragFragShaderCode = `#version 300 es
precision highp float;

in vec3 vNormalEyeSpace;
in vec3 vPosEyeSpace;
in vec3 lightDir;
in vec3 viewDir;
in vec4 shadowTextureCoord;

uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform sampler2D depthTexture;

out vec4 fragColor;

float calculateShadow(vec4 shadowCoord) {
    // Perspective divide
    vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
    
    // Get closest depth value from light's perspective
    float closestDepth = texture(depthTexture, projCoords.xy).r;
    
    // Get current depth
    float currentDepth = projCoords.z;
    
    // Check whether current frag pos is in shadow
    float bias = 0.0005; // Adjust this value to reduce shadow acne
    float shadow = currentDepth - bias > closestDepth ? 0.0 : 1.0;
    
    // Keep fragment lit if outside the far plane
    if(projCoords.x > 1.0 || projCoords.x < 0.0 || projCoords.y > 1.0 || projCoords.y < 0.0 || projCoords.z > 1.0 || projCoords.z < 0.0)
        shadow = 1.0;
        
    return shadow;
}

void main() {
    // Normalize vectors
    vec3 normal = normalize(vNormalEyeSpace);
    vec3 lightDirection = normalize(lightDir);
    vec3 viewDirection = normalize(viewDir);
    
    // Ambient
    vec3 ambient = uAmbientColor * 0.2;
    
    // Diffuse
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * uDiffuseColor;
    
    // Specular
    vec3 reflectDir = reflect(-lightDirection, normal);
    float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 32.0);
    vec3 specular = spec * uSpecularColor;
    
    // Calculate shadow
    float shadow = calculateShadow(shadowTextureCoord);
    
    // Combine results
    vec3 finalColor = ambient + shadow * (diffuse + specular);
    
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

function initDepthFBO() {
    // create a 2D texture in which depth values will be stored
    depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
        gl.TEXTURE_2D, // target
        0, // mipmap level
        gl.DEPTH_COMPONENT24, // internal format
        depthTextureSize, // width
        depthTextureSize, // height
        0, // border
        gl.DEPTH_COMPONENT, // format
        gl.UNSIGNED_INT, // type
        null // data, currently empty
    );
 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
 
    // Now create framebuffer and attach the depthTexture to it
    FBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
    gl.drawBuffers([gl.NONE]);
    FBO.width = depthTextureSize;
    FBO.height = depthTextureSize;
    // attach depthTexture to the framebuffer FBO
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 
        0
    );
 
    // check FBO status
    var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FBOstatus != gl.FRAMEBUFFER_COMPLETE)
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO");
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

    var texCoords = [
        // Front face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Back face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Top face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Bottom face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Right face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Left face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    ];
    cubeTexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    cubeTexBuf.itemSize = 2;
    cubeTexBuf.numItems = texCoords.length / 2;
  
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

function drawCube(color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        cubeBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    if (aNormalLocation !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
        gl.vertexAttribPointer(
            aNormalLocation,
            cubeNormalBuf.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );
    }

    // draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    if (uVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    }
    if (uLVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    }
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    if (uLPMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLPMatrixLocation, false, lpMatrix);
    }

    // Compute the model-view matrix
    var mvMatrix = mat4.create();
    mat4.multiply(vMatrix, mMatrix, mvMatrix);

    // Compute the normal matrix
    var normalMatrix = mat4.toInverseMat3(mvMatrix);
    mat3.transpose(normalMatrix);
    //mat3.normalFromMat4(normalMatrix, mvMatrix);

    // Pass the normal matrix to the shader
    gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);

    gl.uniform3fv(uLightPosLocation, lightPos);
    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    //gl.drawArrays(gl.LINE_STRIP, 0, cubeIndexBuf.numItems); // show lines
    //gl.drawArrays(gl.POINTS, 0, cubeIndexBuf.numItems); // show points
}

function initSphere(nslices, nstacks, radius) {
    for (var i = 0; i <= nslices; i++) {
        var angle = (i * Math.PI) / nslices;
        var comp1 = Math.sin(angle);
        var comp2 = Math.cos(angle);
    
        for (var j = 0; j <= nstacks; j++) {
            var phi = (j * 2 * Math.PI) / nstacks;
            var comp3 = Math.sin(phi);
            var comp4 = Math.cos(phi);
    
            var xcood = comp4 * comp1;
            var ycoord = comp2;
            var zcoord = comp3 * comp1;
            var utex = 1 - j / nstacks;
            var vtex = 1 - i / nslices;
    
            spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
            spNormals.push(xcood, ycoord, zcoord);
            spTexCoords.push(utex, vtex);
        }
    }
  
    // now compute the indices here
    for (var i = 0; i < nslices; i++) {
        for (var j = 0; j < nstacks; j++) {
            var id1 = i * (nstacks + 1) + j;
            var id2 = id1 + nstacks + 1;
    
            spIndicies.push(id1, id2, id1 + 1);
            spIndicies.push(id2, id2 + 1, id1 + 1);
        }
    }
}

function initSphereBuffer() {
    var nslices = 50;
    var nstacks = 50;
    var radius = 1.0;
  
    initSphere(nslices, nstacks, radius);
  
    // buffer for vertices
    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
    spBuf.itemSize = 3;
    spBuf.numItems = spVerts.length / 3;
  
    // buffer for indices
    spIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(spIndicies),
        gl.STATIC_DRAW
    );
    spIndexBuf.itemsize = 1;
    spIndexBuf.numItems = spIndicies.length;
  
    // buffer for normals
    spNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    spNormalBuf.itemSize = 3;
    spNormalBuf.numItems = spNormals.length / 3;
  
    // buffer for texture coordinates
    spTexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
    spTexBuf.itemSize = 2;
    spTexBuf.numItems = spTexCoords.length / 2;
}

function drawSphere(color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        spBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    
    if (aNormalLocation !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
        gl.vertexAttribPointer(
            aNormalLocation,
            spNormalBuf.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );
    }
  
    // Draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    if (uVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    }
    if (uLVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    }
    if (uLPMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLPMatrixLocation, false, lpMatrix);
    }

    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    // Compute the model-view matrix
    var mvMatrix = mat4.create();
    mat4.multiply(vMatrix, mMatrix, mvMatrix);

    // Compute the normal matrix
    var normalMatrix = mat4.toInverseMat3(mvMatrix);
    mat3.transpose(normalMatrix);
    //mat3.normalFromMat4(normalMatrix, mvMatrix);

    // Pass the normal matrix to the shader
    gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);
  
    gl.uniform3fv(uLightPosLocation, lightPos);
    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function initObject() {
    // XMLHttpRequest objects are used to interact with servers
    // It can be used to retrieve any type of data, not just XML.
    var request = new XMLHttpRequest();
    request.open("GET", input_JSON);
    // MIME: Multipurpose Internet Mail Extensions
    // It lets users exchange different kinds of data files
    request.overrideMimeType("application/json");
    request.onreadystatechange = function () {
        //request.readyState == 4 means operation is done
        if (request.readyState == 4) {
            processObject(JSON.parse(request.responseText));
        }
    };
    request.send();
}
  
function processObject(objData) {
    // Load position data
    objVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexPositions),
        gl.STATIC_DRAW
    );
    objVertexPositionBuffer.itemSize = 3;
    objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;
  
    // Load normal data
    objVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexNormals),
        gl.STATIC_DRAW
    );
    objVertexNormalBuffer.itemSize = 3;
    objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

    // Load Texture Data
    objVertexTextureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexTextureCoords),
        gl.STATIC_DRAW
    );
    objVertexTextureBuffer.itemSize = 2;
    objVertexTextureBuffer.numItems = objData.vertexTextureCoords.length / 2;
  
    // Load index data
    objVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(objData.indices),
        gl.STATIC_DRAW
    );
    objVertexIndexBuffer.itemSize = 1;
    objVertexIndexBuffer.numItems = objData.indices.length;

    // stop the current loop of animation
    if (animation) {
        window.cancelAnimationFrame(animation);
    }
    animate();
}
  
  
function drawObject(color) {
    // Bind position buffer and set attribute pointer
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.vertexAttribPointer(
        aPositionLocation,
        objVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );
    
    if (aNormalLocation !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
        gl.vertexAttribPointer(
            aNormalLocation,
            objVertexNormalBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );
    }
  
    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
  
    // Set uniform variables
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    if (uVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    }
    if (uLVMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    }
    if (uLPMatrixLocation !== -1) {
        gl.uniformMatrix4fv(uLPMatrixLocation, false, lpMatrix);
    }

    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    // Compute the model-view matrix
    var mvMatrix = mat4.create();
    mat4.multiply(vMatrix, mMatrix, mvMatrix);

    // Compute the normal matrix
    var normalMatrix = mat4.toInverseMat3(mvMatrix);
    mat3.transpose(normalMatrix);
    //mat3.normalFromMat4(normalMatrix, mvMatrix);

    // Pass the normal matrix to the shader
    gl.uniformMatrix3fv(uNormalMatrixLocation, false, normalMatrix);
  
    // Set colors
    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);
  
    // Draw the object
    gl.drawElements(
        gl.TRIANGLES,
        objVertexIndexBuffer.numItems,
        gl.UNSIGNED_INT,
        0
    );
}  

//////////////////////////////////////////////////////////////////////
//Main drawing routine
function drawScene() {
    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //set up the model matrix
    mat4.identity(mMatrix);

    //surface
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, displace - 0.01, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2.4, 0.01, 2.4]);
    color = [0.7, 0.7, 0.7];
    drawCube(color);
    mMatrix = popMatrix(mMatrixStack);

    //teapot
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.3, displace, -0.2]);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.3, 0.0]);
    color = [0.2, 0.8, 0.4];
    mMatrix = mat4.scale(mMatrix, [0.04, 0.04, 0.04]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 1, 0]);
    drawObject(color);
    mMatrix = popMatrix(mMatrixStack);

    //sphere
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.3, displace, 0.7]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
    mMatrix = mat4.translate(mMatrix, [0.0, 1.0, 0.0]);
    color = [0.1, 0.4, 0.8];
    drawSphere(color);
    mMatrix = popMatrix(mMatrixStack);
}

function firstPass() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);

    // Set the viewport to match the FBO size
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    
    // Clear both color and depth
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    shaderProgram = initShaders(vertexShadowPassShaderCode, fragShadowPassShaderCode);
    
    // Get and enable attributes
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    
    if (aPositionLocation !== -1) {
        gl.enableVertexAttribArray(aPositionLocation);
    }
    if (aNormalLocation !== -1) {
        gl.enableVertexAttribArray(aNormalLocation);
    }
    
    // Get uniforms
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uLVMatrixLocation = gl.getUniformLocation(shaderProgram, "uLVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLPMatrixLocation = gl.getUniformLocation(shaderProgram, "uLPMatrix");
    uNormalMatrixLocation = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
    
    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");

    gl.enable(gl.DEPTH_TEST);
    drawScene();
}

function SecondPass() {
    //Draw into screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Set the viewport to match the canvas size
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    // initialize shader program
    shaderProgram = initShaders(perFragVertexShaderCode, perFragFragShaderCode);

    //for texture binding from FBO
    gl.activeTexture(gl.TEXTURE0); // set texture unit 1 to use
    gl.bindTexture(gl.TEXTURE_2D, depthTexture); // bind the texture object to the texture unit
    //gl.uniform1i(uShadowLocation, 0); // pass the texture unit to the shader

    
    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uLVMatrixLocation = gl.getUniformLocation(shaderProgram, "uLVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uLPMatrixLocation = gl.getUniformLocation(shaderProgram, "uLPMatrix");
    uNormalMatrixLocation = gl.getUniformLocation(shaderProgram, "uNormalMatrix");

    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");

    uDepthTextureLocation = gl.getUniformLocation(shaderProgram, "depthTexture");
    gl.uniform1i(uDepthTextureLocation, 0); // pass the texture unit to the shader

    // Enable attribute arrays
    if (aPositionLocation !== -1) {
        gl.enableVertexAttribArray(aPositionLocation);
    }
    if (aNormalLocation !== -1) {
        gl.enableVertexAttribArray(aNormalLocation);
    }

    gl.enable(gl.DEPTH_TEST);
    drawScene();
}

function toggleAnimation(checked) {
    isAnimating = checked;
}


function animate () {
    gl.clearColor(1, 1, 1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (isAnimating) {
        // Update the eye position
        angle -= 0.01;
        eyePos[0] = eyePosRad * Math.sin(angle);
        eyePos[2] = eyePosRad * Math.cos(angle)
    }


    // set up the view matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
    lvMatrix = mat4.lookAt(lightPos, COI, viewUp, lvMatrix);

    // Set up perspective projection matrix for the camera
    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    // Set up perspective projection matrix for the light
    mat4.identity(lpMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, lpMatrix);

    firstPass();
    SecondPass();
    animation = window.requestAnimationFrame(animate);
};

// This is the entry point from the html
function webGLStart() {
    canvas = document.getElementById("scene");
    // initialize WebGL
    initGL(canvas);

    initDepthFBO();
    initCubeBuffer();
    initSphereBuffer();

    
    // Update light position when the light slider changes
    lightSlider.addEventListener('input', function () {
        const lightX = parseFloat(lightSlider.value);
        lightPos[2] = lightX; // Update the z-position of the light
        initObject();
    });
    initObject();
}