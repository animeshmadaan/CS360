////////////////////////////////////////////////////////////////////////
// A simple WebGL program to draw simple 2D shapes with animation.
//

var gl;
var color;
var animation;
var matrixStack = [];
var drawMode;
const NUM_CIRCLE_POINTS = 50;

// mMatrix is called the model matrix, transforms objects
// from local object space to world space.
var mMatrix = mat4.create();
var uMMatrixLocation;
var aPositionLocation;
var uColorLoc;

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
    gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
    gl_PointSize = 2.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
    fragColor = color;
}`;

function pushMatrix(stack, m) {
    //necessary because javascript only does shallow push
    var copy = mat4.create(m);
    stack.push(copy);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

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

function initSquareBuffer() {
    // buffer for point locations
    const sqVertices = new Float32Array([
        0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    ]);
    sqVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
    sqVertexPositionBuffer.itemSize = 2;
    sqVertexPositionBuffer.numItems = 4;

    // buffer for point indices
    const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    sqVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
    sqVertexIndexBuffer.itemsize = 1;
    sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
    gl.vertexAttribPointer(
        aPositionLocation,
        sqVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

    gl.uniform4fv(uColorLoc, color);

    // now draw the square
    gl.drawElements(
        drawMode,
        sqVertexIndexBuffer.numItems,
        gl.UNSIGNED_SHORT,
        0
    );
}

function initTriangleBuffer() {
    // buffer for point locations
    const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
    triangleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
    triangleBuf.itemSize = 2;
    triangleBuf.numItems = 3;

    // buffer for point indices
    const triangleIndices = new Uint16Array([0, 1, 2]);
    triangleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
    triangleIndexBuf.itemsize = 1;
    triangleIndexBuf.numItems = 3;
}

function drawTriangle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        triangleBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);

    gl.uniform4fv(uColorLoc, color);

    // now draw the square
    gl.drawElements(
        drawMode,
        triangleIndexBuf.numItems,
        gl.UNSIGNED_SHORT,
        0
    );
}

function initCircleBuffer() {
    // buffer for point locations
    const circleVertices = [];
    circleVertices.push(0, 0); //centre of circle

    for (let i = 0; i < NUM_CIRCLE_POINTS; i++) {
        const angle = (i / NUM_CIRCLE_POINTS) * Math.PI * 2;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        circleVertices.push(x, y);
    }

    circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
    circleBuf.itemSize = 2;
    circleBuf.numItems = NUM_CIRCLE_POINTS + 1;

    // buffer for point indices
    const circleIndices = [];
    for (let i = 0; i < NUM_CIRCLE_POINTS; i++) {
        circleIndices.push(0, i, i + 1);
    }
    circleIndices.push(0, NUM_CIRCLE_POINTS, 1);

    circleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(circleIndices), gl.STATIC_DRAW);
    circleIndexBuf.itemSize = 1;
    circleIndexBuf.numItems = circleIndices.length;
}

function drawCircle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.vertexAttribPointer(
        aPositionLocation,
        circleBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);

    gl.uniform4fv(uColorLoc, color);

    // now draw the circle
    gl.drawElements(
        drawMode,
        circleIndexBuf.numItems,
        gl.UNSIGNED_SHORT,
        0
    );
}

////////////////////////////////////////////////////////////////////////

// Draw functions for the different objects in the scene
function drawSky() {
    color = [0.0, 0.0, 0.0, 1.0];
    mat4.identity(mMatrix);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2.0, 1.0, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawClouds() {
    mat4.identity(mMatrix);

    //cloud 1
    pushMatrix(matrixStack, mMatrix);
    color = [0.8, 0.8, 0.8, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.84, 0.52, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.1, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //cloud 2
    pushMatrix(matrixStack, mMatrix);
    color = [1, 1, 1, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.6, 0.49, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.18, 0.09, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //cloud 3
    pushMatrix(matrixStack, mMatrix);
    color = [0.8, 0.8, 0.8, 1.0];
    mMatrix = mat4.translate(mMatrix, [-0.39, 0.49, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.07, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawMoon(mMatrix, moonAngle) {
    color = [1, 1, 1, 1.0];
    mat4.identity(mMatrix);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.7, 0.8, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 1.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(moonAngle), [0.0, 0.0, 1.0]);

    //draw rays
    var angle = 0;
    for (let i = 0; i < 4; i++) {
        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.rotate(mMatrix, degToRad(angle), [0.0, 0.0, 1.0]);
        mMatrix = mat4.scale(mMatrix, [0.05, 2.5, 1.0]);
        drawSquare(color, mMatrix);
        mMatrix = popMatrix(matrixStack);
        angle += 45;
    }
    //draw main circle
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawStars(scale = 1.0) {
    color = [1, 1, 1, 1.0];
    mat4.identity(mMatrix);

    //here each params contains [x, y, scale] for each star
    params = [
        [-0.15, 0.5, 0.006*scale],
        [-0.1, 0.6, 0.01*scale],
        [-0.25, 0.7, 0.01*scale],
        [0.3, 0.75, 0.015*scale],
        [0.55, 0.9, 0.006*scale],
    ];

    //drawing each star in a loop
    for (let i = 0; i < 5; i++) {
        pushMatrix(matrixStack, mMatrix);
        
        //sclaing and translating the star according to the params
        mMatrix = mat4.translate(mMatrix, [params[i][0], params[i][1], 0.0]);
        mMatrix = mat4.scale(mMatrix, [params[i][2], params[i][2], 1.0]);
        
        //drawing the main star
        drawSquare(color, mMatrix);
        //drawing rays of the star
        for(let j = 0; j < 360; j += 90) {
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.rotate(mMatrix, degToRad(j), [0.0, 0.0, 1.0]);
            mMatrix = mat4.translate(mMatrix, [0, 0.5, 0]);
            mMatrix = mat4.scale(mMatrix, [1.0, 3.0, 1.0]);
            mMatrix = mat4.translate(mMatrix, [0, 0.5, 0]);
            drawTriangle(color, mMatrix);
            mMatrix = popMatrix(matrixStack);
        }

        mMatrix = popMatrix(matrixStack);
    }
}

function drawMountains() {
    color_dark_brown = [0.55, 0.43, 0.33, 1.0];
    color_light_brown = [0.65, 0.55, 0.41, 1.0];
    mat4.identity(mMatrix);
    
    //mountain 1
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.8, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 1.0]);
    mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    drawTriangle(color_dark_brown, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.8, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.25, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(10), [0.0, 0.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.25, 0.0]);
    mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    drawTriangle(color_light_brown, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //mountain 2
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.05, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [1.0, 1.0, 1.0]);
    mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    drawTriangle(color_dark_brown, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.05, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [1.0, 1.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.25, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(10), [0.0, 0.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.25, 0.0]);
    mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    drawTriangle(color_light_brown, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //mountain 3
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.8, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
    mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    drawTriangle(color_light_brown, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawGround() {
    color_ground = [0.33, 0.93, 0.62, 1.0];
    color_patch = [0.27, 0.69, 0.13, 1.0];
    mat4.identity(mMatrix);

    //draw ground
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [2.0, 1.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(color_ground, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw patch
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, -0.1, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2.0, 2.0, 1.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(55), [0.0, 0.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 1.0, 1.0]);
    drawTriangle(color_patch, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw bushes
    color1 = [0.12, 0.6, 0.05, 1.0];
    color2 = [0.25, 0.55, 0.10, 1.0];
    color3 = [0.21, 0.45, 0.13, 1.0];
    params = [
        [-0.9, -0.6, 0.2],
        [-0.32, -0.59, 0.25],
        [-0.05, -1.03, 0.4],
        [1.0, -0.42, 0.3],
    ];
    for (let i = 0; i < 4; i++) {
        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.translate(mMatrix, [params[i][0], params[i][1], 0.0]);
        mMatrix = mat4.scale(mMatrix, [params[i][2], params[i][2], 1.0]);
        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.translate(mMatrix, [-.5, -.05, 0.0]);
        mMatrix = mat4.scale(mMatrix, [.7, .7, 1.0]);
        mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
        drawCircle(color1, mMatrix);
        mMatrix = popMatrix(matrixStack);

        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.translate(mMatrix, [.5, -.05, 0.0]);
        mMatrix = mat4.scale(mMatrix, [.7, .7, 1.0]);
        mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
        drawCircle(color3, mMatrix);
        mMatrix = popMatrix(matrixStack);

        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
        drawCircle(color2, mMatrix);
        mMatrix = popMatrix(matrixStack);

        mMatrix = popMatrix(matrixStack);
    }
}

function drawTrees() {
    color_green_light = [0.58, 0.80, 0.38, 1.0];
    color_green_medium = [0.40, 0.75, 0.37, 1.0];
    color_green_dark = [0.30, 0.50, 0.25, 1.0];
    color_brown = [0.47, 0.24, 0.26, 1.0];
    mat4.identity(mMatrix);

    // params contains [x, y, scale] for each tree
    params = [
        [0.8, 0.0, 0.3],
        [0.52, 0.0, 0.333],
        [0.25, 0.0, 0.25],
    ];
    
    for (let i = 0; i < 3; i++) {
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.translate(mMatrix, [params[i][0], params[i][1], 0.0]);
            mMatrix = mat4.scale(mMatrix, [params[i][2], params[i][2], 1.0]);
            mMatrix = mat4.translate(mMatrix, [0.0, 1.1, 0.0]);
            //draw tree trunk
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.translate(mMatrix, [0.0, -0.65, 0.0]);
            mMatrix = mat4.scale(mMatrix, [0.2, 1.0, 1.0]);
            drawSquare(color_brown, mMatrix);
            mMatrix = popMatrix(matrixStack);
    
            //draw tree bottom
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.translate(mMatrix, [0.0, 0.3, 0.0]);
            mMatrix = mat4.scale(mMatrix, [1.1, 1.0, 1.0]);
            drawTriangle(color_green_dark, mMatrix);
            mMatrix = popMatrix(matrixStack);
    
            //draw tree mid
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.translate(mMatrix, [0.0, 0.4, 0.0]);
            mMatrix = mat4.scale(mMatrix, [1.2, 1.0, 1.0]);
            drawTriangle(color_green_medium, mMatrix);
            mMatrix = popMatrix(matrixStack);
    
            //draw tree top
            pushMatrix(matrixStack, mMatrix);
            mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0.0]);
            mMatrix = mat4.scale(mMatrix, [1.3, 1.0, 1.0]);
            drawTriangle(color_green_light, mMatrix);
            mMatrix = popMatrix(matrixStack);

            mMatrix = popMatrix(matrixStack);
    }
}

function drawRiver() {
    color = [0.14, 0.43, 0.95, 1.0];
    color2 = [0.8, 0.8, 0.8, 1.0];
    mat4.identity(mMatrix);

    //draw river
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.17, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2.0, 0.25, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw river lines
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.13, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.003, 1.0]);
    drawSquare(color2, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.7, -0.17, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.003, 1.0]);
    drawSquare(color2, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.7, -0.24, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.003, 1.0]);
    drawSquare(color2, mMatrix);
    mMatrix = popMatrix(matrixStack);
}

function drawBoats(pos1 = 0.0, pos2 = 0.4){
    color = [0.8, 0.8, 0.8, 1.0];
    black = [0, 0, 0, 1.0];
    red = [1.0, 0, 0, 1.0];
    purple = [0.4, 0, 0.5, 1.0];
    mat4.identity(mMatrix);

    //draw boat 1(purple)
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [pos1, -0.09, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);

    //sail
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.35, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.45, 0.55, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.0, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0.0, 0.0, 1.0]);
    drawTriangle(purple, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //mast
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.3, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.02, 0.8, 1.0]);
    drawSquare(black, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.6, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-35), [0.0, 0.0, 1.0]);
    mMatrix = mat4.scale(mMatrix, [0.007, 0.8, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(black, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //hull
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.0, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0.0, 0.0, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0.0, 0.0, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);

    //draw boat 2(red)
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [pos2, -0.15, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 1.0]);

    //sail
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.35, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.45, 0.55, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.0, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0.0, 0.0, 1.0]);
    drawTriangle(red, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //mast
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.3, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.02, 0.8, 1.0]);
    drawSquare(black, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.6, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-35), [0.0, 0.0, 1.0]);
    mMatrix = mat4.scale(mMatrix, [0.007, 0.8, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(black, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //hull
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.0, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0.0, 0.0, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0.0, 0.0, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
}

function drawHouse() {
    red = [0.96, 0.35, 0.13, 1.0];
    white = [0.9, 0.9, 0.9, 1.0];
    yellow = [0.93, 0.69, 0.13, 1.0];
    mat4.identity(mMatrix);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-.65, -.45, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.28, 0.22, 1.0]);

    //draw roof
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.0, 0.9, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0.0]);
    drawSquare(red, mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 1.0, 1.0]);
    drawTriangle(red, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 1.0, 1.0]);
    drawTriangle(red, mMatrix);
    mMatrix = popMatrix(matrixStack);
    mMatrix = popMatrix(matrixStack);

    //draw walls
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.5, 1.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(white, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw door
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.4, 0.0]);
    mMatrix = mat4.scale(mMatrix, [.25, 0.6, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(yellow, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw windows
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-.5, -0.2, 0.0]);
    mMatrix = mat4.scale(mMatrix, [.25, .25, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(yellow, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [.5, -0.2, 0.0]);
    mMatrix = mat4.scale(mMatrix, [.25, .25, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(yellow, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
}

function drawCar() {
    light_blue = [0.27, 0.58, 0.85, 1.0];
    dark_blue = [0.14, 0.33, 0.75, 1.0];
    light_grey = [0.9, 0.9, 0.9, 1.0];
    grey = [0.50, 0.50, 0.50, 1.0];
    black = [0, 0, 0, 1.0];
    mat4.identity(mMatrix);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.55, -0.75, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 1.0]);

    //draw wheels
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.6, -0.55, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 1.0]);
    drawCircle(black, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    drawCircle(grey, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.6, -0.55, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 1.0]);
    drawCircle(black, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    drawCircle(grey, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw roof and window
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.7, 0.5, 1.0]);
    drawCircle(dark_blue, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.7, 0.5, 1.0]);
    drawSquare(light_grey, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //draw body
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [1.8, 0.5, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(light_blue, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.9, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.5, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawTriangle(light_blue, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.9, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.5, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawTriangle(light_blue, mMatrix);
    mMatrix = popMatrix(matrixStack);

    mMatrix = popMatrix(matrixStack);
}

function drawWindmills(rotation = 0) {
    yellow = [0.82, 0.78, 0.2, 1.0];
    grey = [0.20, 0.20, 0.20, 1.0];
    black = [0, 0, 0, 1.0];
    mat4.identity(mMatrix);

    //draw windmill 1
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.47, 0.04, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.35, 0.35, 1.0]);

    //pole
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.07, 1.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(grey, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //blades
    for (let i = 0; i < 360; i += 90) {
        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.rotate(mMatrix, degToRad(i + rotation), [0.0, 0.0, 1.0]);
        mMatrix = mat4.scale(mMatrix, [0.18, 0.5, 1.0]);
        mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
        drawTriangle(yellow, mMatrix);
        mMatrix = popMatrix(matrixStack);
    }

    //center
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
    drawCircle(black, mMatrix);
    mMatrix = popMatrix(matrixStack);
    mMatrix = popMatrix(matrixStack);

    //draw windmill 2
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.7, 0.05, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 1.0]);

    //pole
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.07, 1.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawSquare(grey, mMatrix);
    mMatrix = popMatrix(matrixStack);

    //blades
    for (let i = 0; i < 360; i += 90) {
        pushMatrix(matrixStack, mMatrix);
        mMatrix = mat4.rotate(mMatrix, degToRad(i + rotation), [0.0, 0.0, 1.0]);
        mMatrix = mat4.scale(mMatrix, [0.18, 0.5, 1.0]);
        mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
        drawTriangle(yellow, mMatrix);
        mMatrix = popMatrix(matrixStack);
    }

    //center
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.07, 0.07, 1.0]);
    drawCircle(black, mMatrix);
    mMatrix = popMatrix(matrixStack);
    mMatrix = popMatrix(matrixStack);
}

////////////////////////////////////////////////////////////////////////
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    // stop the current loop of animation
    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    //parameters for rotating the moon
    var moonAngle = 0;
    var moonRotationSpeed = 0.3;

    //parameters for twinkling stars
    var starScale = 1.0;
    var starScaleSpeed = 0.02;
    var starScaleMax = 1.3;
    var starScaleMin = 0.7;

    //parameters for boat movement
    var boat1 = 0.0;
    var boat2 = 0.4;
    var boatSpeed1 = 0.003, boatSpeed2 = 0.003;

    //windmill rotation
    var windmillRotation = 0;
    var windmillRotationSpeed = -1;

    var animate = function () {
    gl.clearColor(1, 1, 1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //update the moon angle
    moonAngle += moonRotationSpeed;

    //update the star scale
    if(starScale >= starScaleMax || starScale <= starScaleMin) {
        starScaleSpeed *= -1;
    }
    starScale += starScaleSpeed;

    //update the boat positions
    if (boat1 >= 0.8 || boat1 <= -0.8) {
        boatSpeed1 *= -1;
    }
    if (boat2 >= 0.7 || boat2 <= -0.7) {
        boatSpeed2 *= -1;
    }
    boat1 += boatSpeed1;
    boat2 += boatSpeed2;

    //update the windmill rotation
    windmillRotation += windmillRotationSpeed;

    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);

    // call the drawing functions
    drawSky();
    drawClouds();
    drawMoon(mMatrix, moonAngle);
    drawStars(starScale);
    drawMountains();
    drawGround();
    drawTrees();
    drawRiver();
    drawBoats(boat1, boat2);
    drawHouse();
    drawCar();
    drawWindmills(windmillRotation);

    animation = window.requestAnimationFrame(animate);
    };

    animate();
}

// function to handle clicks
function setDrawMode(mode) {
    drawMode = mode;
    // Redraw the scene
    drawScene();
}

// Initialize the buttons
function initButtons() {
    document.getElementById('trianglesMode').addEventListener('click', () => setDrawMode(gl.TRIANGLES));
    document.getElementById('lineLoopMode').addEventListener('click', () => setDrawMode(gl.LINE_LOOP));
    document.getElementById('pointsMode').addEventListener('click', () => setDrawMode(gl.POINTS));
}

// This is the entry point from the html
function webGLStart() {
    var canvas = document.getElementById("scene");
    initGL(canvas);
    shaderProgram = initShaders();

    //get locations of attributes declared in the vertex shader
    const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);

    uColorLoc = gl.getUniformLocation(shaderProgram, "color");
    
    drawMode = gl.TRIANGLES;
    initButtons();
    initSquareBuffer();
    initTriangleBuffer();
    initCircleBuffer();

    drawScene();
}
