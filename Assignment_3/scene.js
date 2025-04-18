////////////////////////////////////////////////////////////////////////

var gl;
var canvas;
var mMatrixStack = [];
var refract = false;
var animation;

var aPositionLocation;
var aTexCoordLocation;
var aNormalLocation;

var uCubeMapReflectionFactorLocation;
var uSpecularFactorLocation;

var cubeMapReflectionValue = 1.0;
var specularReflectionValue = 1.0;

var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uWNMatrixLocation;

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

var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;
var objVertexTextureBuffer;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var zAngle = 0.0;
var yAngle = 0.0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var uNormalMatrix = mat3.create(); // normal matrix
var wNMatrix = mat4.create(); // world normal matrix

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.6, 1.8];
var radius = 1.8;
var angle = 2*Math.PI;

// specify light properties
var lightPos = [0, 5, 3];
var lightRad = 3.0;
var lightAngle = 0;
var diffuseColor = [1.0, 1.0, 1.0];
var specularColor = [1.0, 1.0, 1.0];
var ambientColor = [1.0, 1.0, 1.0];

var uTextureLocation;
var uTexture2DLocation;
var earthTexture;
var woodTexture;
var cageTexture;
var textureFile;
var textureFileEarth = "texture_and_other_files/earthmap.jpg";
var textureFileWood = "texture_and_other_files/wood_texture.jpg";
var textureFileCage = "texture_and_other_files/fence_alpha.png";

var cubeTexture;
var posx_plane, negx_plane, posy_plane, negy_plane, posz_plane, negz_plane;
var path = "texture_and_other_files/Field/";
var textureFilePosx = path + "posx.jpg";
var textureFileNegx = path + "negx.jpg";
var textureFilePosy = path + "posy.jpg";
var textureFileNegy = path + "negy.jpg";
var textureFilePosz = path + "posz.jpg";
var textureFileNegz = path + "negz.jpg";

// Inpur JSON model file to load
input_JSON = "texture_and_other_files/teapot.json";

////////////////////////////////////////////////////////////////////////

// Vertex shader code
const vertexShaderCode = `#version 300 es
// Vertex attributes
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

// Uniform matrices
uniform mat4 uMMatrix;  // Model matrix
uniform mat4 uVMatrix;  // View matrix
uniform mat4 uPMatrix;  // Projection matrix
uniform mat4 uWNMatrix; // World normal matrix

// Outputs to the fragment shader
out vec3 vNormalEyeSpace;
out vec3 vPosEyeSpace;
out vec3 lightDir;
out vec3 viewDir;

out vec3 worldPos;
out vec3 worldNormal;

out vec2 fragTexCoord;

uniform vec3 uLightPos;

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

    worldPos = mat3(uMMatrix) * aPosition;
    worldNormal = mat3(uWNMatrix) * aNormal;
    gl_PointSize = 1.0;

    // Compute position in clip space
    gl_Position = uPMatrix * positionEye4;

    // pass texture coordinate to frag shader
    fragTexCoord = aTexCoords;
}`;

// Fragment shader code
const fragShaderCode = `#version 300 es
precision highp float;

// Inputs from the vertex shader
in vec3 worldPos;
in vec3 worldNormal;
in vec3 vNormalEyeSpace;
in vec3 vPosEyeSpace;
in vec3 lightDir;
in vec3 viewDir;
in vec2 fragTexCoord;

// Uniforms
uniform samplerCube cubeMap;
uniform vec3 eyePos;
uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform sampler2D imageTexture;
uniform float uReflectionFactor;         // Controls mix between texture and reflection
uniform float uCubeMapReflectionFactor;  // Controls environment reflection
uniform float uSpecularFactor;           // Controls specular reflection from light
uniform bool uRefract;                   // Whether to refract light

// Output fragment color
out vec4 fragColor;

void main() {
    // Look up texture color
    vec4 textureColor = texture(imageTexture, fragTexCoord);

    // Normalize interpolated normal
    vec3 normal = normalize(vNormalEyeSpace);

    // Compute reflection vector for specular component
    vec3 reflectionDir = normalize(-reflect(lightDir, normal));

    // Ambient component
    vec3 ambient = uAmbientColor * 0.15;

    // Diffuse component
    float diffuseFactor = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = uDiffuseColor * diffuseFactor;

    // Specular component (adjusted)
    float specularFactor = pow(max(dot(reflectionDir, viewDir), 0.0), 30.0);
    vec3 specular = uSpecularColor * specularFactor;
    vec3 adjustedSpecular = uSpecularFactor * specular;

    // Phong color with adjusted specular
    vec3 phongColor = ambient + diffuse + adjustedSpecular;

    // Cube map reflection/refraction computations
    vec3 normalizedWorldNormal = normalize(worldNormal);
    vec3 COI = normalize(worldPos - eyePos);

    vec3 reflectDirEnv = reflect(COI, normalizedWorldNormal);
    vec3 refractVector = refract(COI, normalizedWorldNormal, 0.80);

    vec4 cubeMapColor = vec4(0.0);
    if (uRefract) {
        cubeMapColor = texture(cubeMap, refractVector);
    } else {
        cubeMapColor = texture(cubeMap, reflectDirEnv);
    }

    // Adjust cube map reflection
    vec4 cubeMapContribution = uCubeMapReflectionFactor * cubeMapColor;

    // Combine all components
    vec4 finalColor = cubeMapContribution + vec4(phongColor, 1.0);

    // Set the fragment color
    if (textureColor.a <= 0.15)
        discard;
    else
        fragColor = mix(textureColor, finalColor, uReflectionFactor);
}`;

////////////////////////////////////////////////////////////////////////

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

function initShaders() {
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

function drawCube(color, flag, ref, textureUnit = gl.TEXTURE1, number = 1, textureFile) {
    // flag = 0 :-> both texture mapping and reflection mapping
    // flag = 1 :-> no texture mapping
    // flag = -1 :-> only texture mapping
    
    gl.uniform1f(uCubeMapReflectionFactorLocation, cubeMapReflectionValue);
    gl.uniform1f(uSpecularFactorLocation, specularReflectionValue);

    // bind the vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(aPositionLocation, cubeBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, cubeNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the texture buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
    gl.vertexAttribPointer(aTexCoordLocation, cubeTexBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
    gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

    gl.uniform3fv(uEyePosLocation, eyePos);
    gl.uniform3fv(uLightPosLocation, lightPos);

    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    // for texture binding
    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
    gl.uniform1i(uTextureLocation, 0);

    // 3D Texture Mapping
    gl.activeTexture(textureUnit); 
    gl.uniform1i(uTexture2DLocation, number); 

    if (flag > 0) {
        gl.bindTexture(gl.TEXTURE_2D, textureFile); 
        gl.uniform1f(uReflectionFactorLocation, 0.0);  
    }
    else if (flag == 0) {
        gl.bindTexture(gl.TEXTURE_2D, textureFile); 
        gl.uniform1f(uReflectionFactorLocation, 0.5);  
    }
    else {
        gl.bindTexture(gl.TEXTURE_2D, null); 
        gl.uniform1f(uReflectionFactorLocation, 1.0);
    }

    // See whether to refract light
    if (ref > 0) {
        refract = true;
        gl.uniform1i(uRefractLocation, refract ? 1 : 0);
    }
    else {
        refract = false;
        gl.uniform1i(uRefractLocation, refract ? 1 : 0);
    }

    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

// New sphere initialization function
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
  
function drawSphere(color, flag, ref, textureUnit = gl.TEXTURE1, number = 1, textureFile) {

    // flag = 0 :-> both texture mapping and reflection mapping
    // flag = 1 :-> no texture mapping
    // flag = -1 :-> only texture mapping
    
    gl.uniform1f(uCubeMapReflectionFactorLocation, cubeMapReflectionValue);
    gl.uniform1f(uSpecularFactorLocation, specularReflectionValue);

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
  
    gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
    gl.vertexAttribPointer(
        aTexCoordLocation,
        spTexBuf.itemSize,
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
    wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
    gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

    gl.uniform3fv(uEyePosLocation, eyePos);
    gl.uniform3fv(uLightPosLocation, lightPos);

    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture); 
    gl.uniform1i(uTextureLocation, 0); 

    // 3D Texture Mapping
    gl.activeTexture(textureUnit); 
    gl.uniform1i(uTexture2DLocation, number); 

    if (flag > 0) {
        gl.bindTexture(gl.TEXTURE_2D, textureFile); 
        gl.uniform1f(uReflectionFactorLocation, 0.0);  
    }
    else if (flag == 0) {
        gl.bindTexture(gl.TEXTURE_2D, textureFile);
        gl.uniform1f(uReflectionFactorLocation, 0.5);  
    }
    else {
        gl.bindTexture(gl.TEXTURE_2D, null); 
        gl.uniform1f(uReflectionFactorLocation, 1.0);  
    }

    if (ref > 0) {
        refract = true;
        gl.uniform1i(uRefractLocation, refract ? 1 : 0);
    }
    else {
        refract = false;
        gl.uniform1i(uRefractLocation, refract ? 1 : 0); 
    }
    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);

}

function initTextures() {
    // Initialize textures
    earthTexture = loadTexture(textureFileEarth);
    woodTexture = loadTexture(textureFileWood);
    cageTexture = loadTexture(textureFileCage);

    // Initialize cube map textures
    initCubeMapTexture();
    posx_plane = loadTexture(textureFilePosx);
    negx_plane = loadTexture(textureFileNegx);
    posy_plane = loadTexture(textureFilePosy);
    negy_plane = loadTexture(textureFileNegy);
    posz_plane = loadTexture(textureFilePosz);
    negz_plane = loadTexture(textureFileNegz);
}

// Helper function to load a 2D texture
function loadTexture(textureFile) {
    var tex = gl.createTexture();
    var image = new Image();
    image.onload = function () {
        handleTextureLoaded(tex, image);
    };
    image.src = textureFile;
    return tex;
}

// Function to initialize the cube map texture
function initCubeMapTexture() {
    const faceImages = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            url: textureFilePosx,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: textureFileNegx,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            url: textureFilePosy,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: textureFileNegy,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: textureFilePosz,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            url: textureFileNegz,
        },
    ]

    cubeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);

    faceImages.forEach((faceImage) => {
        const { target, url } = faceImage;
        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);  // Make sure this is false for cube maps
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        };
        image.src = url;
    });

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
};

function handleTextureLoaded(texture, image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Flip the image's Y axis to match the WebGL texture coordinate space
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Specify the texture image
    gl.texImage2D(
        gl.TEXTURE_2D, 
        0, 
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
    );
    // Generate mipmaps
    gl.generateMipmap(gl.TEXTURE_2D);
    // Set texture filtering parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Unbind the texture
    gl.bindTexture(gl.TEXTURE_2D, null);
    drawScene();
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
    // Vertex Positions
    objVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexPositions),
        gl.STATIC_DRAW
    );
    objVertexPositionBuffer.itemSize = 3;
    objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

    // Vertex Normals
    objVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexNormals),
        gl.STATIC_DRAW
    );
    objVertexNormalBuffer.itemSize = 3;
    objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

    // Texture Coordinates
    objVertexTextureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexTextureCoords),
        gl.STATIC_DRAW
    );
    objVertexTextureBuffer.itemSize = 2;
    objVertexTextureBuffer.numItems = objData.vertexTextureCoords.length / 2;

    // Vertex Indices
    objVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(objData.indices),
        gl.STATIC_DRAW
    );
    objVertexIndexBuffer.itemSize = 1;
    objVertexIndexBuffer.numItems = objData.indices.length;

    drawScene();
}

function drawObject() {

    // Set the cube map reflection factor (0.0 to disable, 1.0 for full reflection)
    gl.uniform1f(uCubeMapReflectionFactorLocation, cubeMapReflectionValue);

    // Set the specular reflection factor (0.0 to disable, 1.0 for full specular reflection)
    gl.uniform1f(uSpecularFactorLocation, specularReflectionValue);

    
    // Bind vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.vertexAttribPointer(
        aPositionLocation,
        objVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // Bind vertex normals
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.vertexAttribPointer(
        aNormalLocation,
        objVertexNormalBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // Bind texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
    gl.vertexAttribPointer(
        aTexCoordLocation,
        objVertexTextureBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // Bind indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

    // Set matrices and uniforms
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    // Calculate and set the normal matrix
    wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
    gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

    // Set lighting uniforms
    gl.uniform3fv(uLightPosLocation, lightPos);
    gl.uniform3fv(uAmbientColorLocation, color.slice(0, 3));
    gl.uniform3fv(uDiffuseColorLocation, color.slice(0, 3));
    gl.uniform3fv(uSpecularColorLocation, specularColor);
    gl.uniform3fv(uEyePosLocation, eyePos);

    // Bind cube map texture for reflection
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
    gl.uniform1i(uTextureLocation, 0);

    // Bind 2D texture if needed
    gl.activeTexture(gl.TEXTURE1);
    //gl.bindTexture(gl.TEXTURE_2D, textureFile);
    gl.uniform1i(uTexture2DLocation, 1);

    // Set reflection factor
    gl.uniform1f(uReflectionFactorLocation, 1.0);
    gl.uniform1i(uRefractLocation, false);

    // Draw the object
    gl.drawElements(
        gl.TRIANGLES,
        objVertexIndexBuffer.numItems,
        gl.UNSIGNED_INT,
        0
    );
}

//////////////////////////////////////////////////////////////////////
//The main drawing routine

function drawSkybox() {
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0, -200]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 1, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, negz_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 0, 200]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, posz_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [200, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, posx_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [200, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, posx_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-200, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 1, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, negx_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, 200, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [1, 0, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, posy_plane);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0, -200, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, negy_plane);
    mMatrix = popMatrix(mMatrixStack);
}

function drawTable() {
    //draw tabletop
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.5, 0.01, 1]);
    drawSphere([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);
    //draw legs
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1, 0, -0.5]);
    mMatrix = mat4.translate(mMatrix, [0, -1, 0]);
    mMatrix = mat4.scale(mMatrix, [.1, 2, .1]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1, 0, -0.5]);
    mMatrix = mat4.translate(mMatrix, [0, -1, 0]);
    mMatrix = mat4.scale(mMatrix, [.1, 2, .1]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1, 0, 0.5]);
    mMatrix = mat4.translate(mMatrix, [0, -1, 0]);
    mMatrix = mat4.scale(mMatrix, [.1, 2, .1]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);

    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1, 0, 0.5]);
    mMatrix = mat4.translate(mMatrix, [0, -1, 0]);
    mMatrix = mat4.scale(mMatrix, [.1, 2, .1]);
    drawCube([0, 0, 0, 1.0], 1, 0, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);
}

function drawTeapot() {
    pushMatrix(mMatrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0, 0.4, -.2]);
    mMatrix = mat4.scale(mMatrix, [0.05, 0.05, 0.05]);
    drawObject(color);
    mMatrix = popMatrix(mMatrixStack);
}

function drawSlab () {
    pushMatrix(mMatrixStack, mMatrix);
    color = [0, 0, 0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-.5, 0.25, 0.5]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.5, 0.05]);
    drawCube(color, -1, 1, gl.TEXTURE1, 1, woodTexture);
    mMatrix = popMatrix(mMatrixStack);
}

function drawEarth() {
    cubeMapReflectionValue = 0.0;
    specularReflectionValue = 1.0;

    pushMatrix(mMatrixStack, mMatrix);
    color = [0.3, 0.3, 0.3, 1.0];
    mMatrix = mat4.translate(mMatrix, [0, 0, 0.77]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);
    mMatrix = mat4.translate(mMatrix, [0, 1, 0]);
    drawSphere(color, 0, 0, gl.TEXTURE1, 1, earthTexture);
    mMatrix = popMatrix(mMatrixStack);

    cubeMapReflectionValue = 1.0;
    specularReflectionValue = 1.0;
}

function drawCagedSphere() {
    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.6, 0, 0.4]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
    mMatrix = mat4.translate(mMatrix, [0, 1.32, 0]);
    color = [0, 0, 0.8, 1.0];
    drawSphere(color, -1, 0, gl.TEXTURE1, 1, earthTexture);
    mMatrix = popMatrix(mMatrixStack);

    cubeMapReflectionValue = 0.4;


    pushMatrix(mMatrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.6, 0, 0.4]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 0.12]);
    mMatrix = mat4.translate(mMatrix, [0, 1.35, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-10), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [2.5, 2.5, 2.5]);
    color = [0, 0, 0, 1.0];
    drawCube(color, 0, 0, gl.TEXTURE1, 1, cageTexture);
    mMatrix = popMatrix(mMatrixStack);

    cubeMapReflectionValue = 1.0;

}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    var animate = function () {
        gl.clearColor(0.9, 0.9, 0.9, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        angle -= 0.003; // Adjust speed as desired

        if (angle <= 0.006) {
            angle = 2*Math.PI;
        }

        // Update eyePos to move in a circle
        eyePos[0] = radius * Math.sin(angle);
        eyePos[2] = radius * Math.cos(angle);

        lightAngle += 0.003;

        if (lightAngle >= 2*Math.PI - 0.006) {
            lightAngle = 0;
        }

        //added for correcting lightPos so that it stays fixed
        lightPos[0] = lightRad * Math.sin(lightAngle);
        lightPos[2] = lightRad * Math.cos(lightAngle);

        //set up the model matrix
        mat4.identity(mMatrix);
    
        // set up the view matrix, multiply into the modelview matrix
        mat4.identity(vMatrix);
        vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);
    
        //set up projection matrix
        mat4.identity(pMatrix);
        mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
    
        mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
        mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);
        
        drawSkybox();
        drawTable();
        drawTeapot();
        drawSlab();
        drawEarth();
        drawCagedSphere();
        animation = window.requestAnimationFrame(animate);
    }
    animate();
}

// This is the entry point from the html
function webGLStart() {
    canvas = document.getElementById("scene");

    initGL(canvas);
    shaderProgram = initShaders();

    gl.enable(gl.DEPTH_TEST);

    // Get attribute locations from the shader program
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoords");

    // Enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enableVertexAttribArray(aTexCoordLocation);

    // Get uniform locations from the shader program
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uWNMatrixLocation = gl.getUniformLocation(shaderProgram, "uWNMatrix");
    uLightPosLocation = gl.getUniformLocation(shaderProgram, "uLightPos");
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, "uAmbientColor");
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, "uSpecularColor");
    uEyePosLocation = gl.getUniformLocation(shaderProgram, "eyePos");
    uReflectionFactorLocation = gl.getUniformLocation(shaderProgram, "uReflectionFactor");
    uRefractLocation = gl.getUniformLocation(shaderProgram, "uRefract");
    uTextureLocation = gl.getUniformLocation(shaderProgram, "cubeMap");
    uTexture2DLocation = gl.getUniformLocation(shaderProgram, "imageTexture");
    uCubeMapReflectionFactorLocation = gl.getUniformLocation(shaderProgram, "uCubeMapReflectionFactor");
    uSpecularFactorLocation = gl.getUniformLocation(shaderProgram, "uSpecularFactor");


    // Initialize buffers and textures
    initSphereBuffer();
    initCubeBuffer();
    initTextures();
    initObject();
}