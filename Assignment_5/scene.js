////////////////////////////////////////////////////////////////////////
//  A WebGL program to do ray tracing.
//

var gl;
var canvas;

var aPositionLocation;

// specify camera/eye coordinate system parameters
var cameraPos = [0.0, 0.0, 2.0];
var lightPos = [-2.0, 1.5, 2.0];

var reflectFlag = true;
var shadowFlag = true;

// Vertex shader code
const vertexShaderCode = `#version 300 es
in vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1.0);
}`;

// Fragment shader code
const fragShaderCode = `#version 300 es
precision highp float;

uniform vec3 cameraPos;
uniform float canvasWidth;
uniform float canvasHeight;
uniform vec3 lightPos;
uniform bool reflectFlag;
uniform bool shadowFlag;

out vec4 fragColor;

// Sphere structure
struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
    float reflectivity;
    float specular;
};

// Ray structure
struct Ray {
    vec3 origin;
    vec3 direction;
};

// Function to calculate intersection between a ray and a sphere
float intersectSphere(Ray ray, Sphere sphere) {
    vec3 oc = ray.origin - sphere.center;
    float a = dot(ray.direction, ray.direction);
    float b = 2.0 * dot(oc, ray.direction);
    float c = dot(oc, oc) - sphere.radius * sphere.radius;
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return 0.0;
    } else {
        float p1 = (-b - sqrt(discriminant)) / (2.0 * a);
        float p2 = (-b + sqrt(discriminant)) / (2.0 * a);
        return min(p1, p2);
    }
}

// Function to check if a point is in shadow
bool isInShadow(vec3 point, Sphere sphere) {
    Ray shadowRay;
    shadowRay.direction = normalize(lightPos - point);
    shadowRay.origin = point + 0.001 * shadowRay.direction; // Add bias to avoid self-shadowing
    if (intersectSphere(shadowRay, sphere) > 0.0) {
        return true;
    }
    return false;
}

void main() {
    // Create a sphere
    const int num = 7;
    Sphere sphere[num];
    
    // Sphere 1
    sphere[0].center = vec3(-0.4, -1.0, 0.0);
    sphere[0].radius = 0.5;
    sphere[0].color = vec3(0.2, 0.8, 0.2);
    sphere[0].reflectivity = 0.3; // 50% reflective
    sphere[0].specular = 5.0;

    // Sphere 2
    sphere[1].center = vec3(0.5, -0.9, -0.15);
    sphere[1].radius = 0.5;
    sphere[1].color = vec3(0.4, 0.8, 0.4);
    sphere[1].reflectivity = 0.3; // 50% reflective
    sphere[1].specular = 7.0;

    // Sphere 3
    sphere[2].center = vec3(0.9, 0.0, -0.25);
    sphere[2].radius = 0.5;
    sphere[2].color = vec3(0.0, 0.8, 0.8);
    sphere[2].reflectivity = 0.3; // 50% reflective
    sphere[2].specular = 9.0;

    // Sphere 4
    sphere[3].center = vec3(0.6, 0.8, -0.43);
    sphere[3].radius = 0.5;
    sphere[3].color = vec3(0.0, 0.5, 0.8);
    sphere[3].reflectivity = 0.3; // 50% reflective
    sphere[3].specular = 11.0;

    // Sphere 5
    sphere[4].center = vec3(-0.3, 1.2, -0.45);
    sphere[4].radius = 0.5;
    sphere[4].color = vec3(0.0, 0.2, 0.8);
    sphere[4].reflectivity = 0.3; // 50% reflective
    sphere[4].specular = 13.0;

    // Sphere 6
    sphere[5].center = vec3(-1.0, 0.6, -0.6);
    sphere[5].radius = 0.5;
    sphere[5].color = vec3(0.5, 0.1, 0.8);
    sphere[5].reflectivity = 0.3; // 50% reflective
    sphere[5].specular = 15.0;

    // Sphere 7
    sphere[6].center = vec3(-0.7, 0.0, -1.15);
    sphere[6].radius = 0.6;
    sphere[6].color = vec3(0.8, 0.2, 0.8);
    sphere[6].reflectivity = 0.3; // 50% reflective
    sphere[6].specular = 17.0;

    // Set up the primary ray from the camera
    Ray ray;
    ray.origin = cameraPos;
    vec2 screenPos = gl_FragCoord.xy / vec2(canvasWidth, canvasHeight);
    float aspect = canvasWidth / canvasHeight;
    ray.direction = normalize(vec3((screenPos.x * 2.0 - 1.0)*aspect, screenPos.y * 2.0 - 1.0, -1.0));
    
    float t = -1.0;
    int index = -1;
    for (int i = 0; i < num; i++) {
        // Check for intersection with the sphere
        float temp = intersectSphere(ray, sphere[i]);
        if (temp > 0.0) {
            if (t < 0.0) {
                t = temp;
                index = i;
            }
            else {
                if (temp < t) {
                    t = temp;
                    index = i;
                }
            }
        }
    }
    
    if (t > 0.0 && index >= 0) {
        // Compute intersection point and normal
        vec3 hitPoint = ray.origin + t * ray.direction;
        vec3 normal = normalize(hitPoint - sphere[index].center);

        // Compute reflection
        Ray reflectionRay;
        reflectionRay.origin = hitPoint + 0.001 * normal; // Add bias to avoid self-intersection
        reflectionRay.direction = reflect(ray.direction, normal);

        // Compute base color (shaded or in shadow)
        vec3 baseColor;

        t = -1.0;
        int reflectionIndex = -1;
        for (int i = 0; i < num; i++) {
            // Check for intersection with the sphere
            float temp = intersectSphere(reflectionRay, sphere[i]);
            if (temp > 0.0) {
                if (t < 0.0) {
                    t = temp;
                    reflectionIndex = i;
                }
                else {
                    if (temp < t) {
                        t = temp;
                        reflectionIndex = i;
                    }
                }
            }
        }
        
        Ray secondaryReflectionRay;

        if (reflectFlag && t > 0.0 && reflectionIndex >= 0) {
            vec3 secondHitPoint = reflectionRay.origin + t * reflectionRay.direction;
            vec3 secondNormal = normalize(secondHitPoint - sphere[reflectionIndex].center);
            secondaryReflectionRay.origin = secondHitPoint + 0.001 * secondNormal;
            secondaryReflectionRay.direction = reflect(reflectionRay.direction, secondNormal);

            baseColor = sphere[reflectionIndex].color;
            vec3 ambient = baseColor * 0.2;
            vec3 lightDirection = normalize(lightPos - secondHitPoint);
            float diff = max(dot(secondNormal, lightDirection), 0.0);
            vec3 diffuse = diff * baseColor;
            float spec = pow(max(dot(lightDirection, secondaryReflectionRay.direction), 0.0), sphere[reflectionIndex].specular);
            vec3 specular = spec * vec3(1.0);
            baseColor = ambient + diffuse + specular;
            
            // Combine base color with reflection
            baseColor = mix(sphere[index].color, baseColor, sphere[index].reflectivity);
        }
        else {
            baseColor = sphere[index].color;
        }

        // Check for shadows
        bool shadow = false;
        for (int i = 0; i < num; i++) {
            if (i != index) {
                shadow = isInShadow(hitPoint, sphere[i]);
                if (shadow) {
                    break;
                }
            }
        }

        // Ambient
        vec3 ambient = baseColor * 0.3;
    
        // Diffuse
        vec3 lightDirection = normalize(lightPos - hitPoint);
        float diff = max(dot(normal, lightDirection), 0.0);
        vec3 diffuse = diff * baseColor;
    
        // Specular
        float spec = pow(max(dot(lightDirection, reflectionRay.direction), 0.0), sphere[index].specular);
        vec3 specular = spec * vec3(1.0);

        vec3 finalColor;
        if (shadowFlag && shadow) {
            finalColor = ambient;
        }
        else finalColor = ambient + diffuse + specular;
        
        fragColor = vec4(finalColor, 1.0);
    }
    else {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0); // Background color (black)
    }
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

//////////////////////////////////////////////////////////////////////
//Main drawing routine
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.9, 0.9, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniform values
    gl.uniform3fv(gl.getUniformLocation(shaderProgram, "cameraPos"), cameraPos);
    gl.uniform3fv(gl.getUniformLocation(shaderProgram, "lightPos"), lightPos);
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "canvasWidth"), canvas.width);
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "canvasHeight"), canvas.height);
    gl.uniform1i(gl.getUniformLocation(shaderProgram, "reflectFlag"), reflectFlag);
    gl.uniform1i(gl.getUniformLocation(shaderProgram, "shadowFlag"), shadowFlag);
    
    const bufData = new Float32Array([
        -1, 1, 0, 1, 1, 0, -1, -1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0,
    ]);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, bufData, gl.STATIC_DRAW);

    var aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPositionLocation);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// This is the entry point from the html
function webGLStart() {
    canvas = document.getElementById("scene");
    
    // Update light position when the light slider changes
    lightSlider.addEventListener('input', function () {
        const lightX = parseFloat(lightSlider.value);
        lightPos[0] = lightX; // Update the z-position of the light
        drawScene();
    });

    // initialize WebGL
    initGL(canvas);

    // initialize shader program
    shaderProgram = initShaders();

    drawScene();
}