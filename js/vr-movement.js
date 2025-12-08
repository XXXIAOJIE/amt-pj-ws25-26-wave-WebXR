// ======================================================================
//  vr-movement.js — VR Movement Control System (Babylon.js 7 Version)
// ======================================================================

// Movement configuration
export const MOVEMENT_CONFIG = {
  // Movement speed (meters/second)
  moveSpeed: 1.5,
  
  // Rotation speed (degrees/second)
  rotateSpeed: 90,
  
  // Enable smooth movement
  smoothMovement: true,
  
  // Enable jumping
  enableJump: false,
  
  // Gravity acceleration
  gravity: -9.8,
  
  // Jump force
  jumpForce: 5,
  
  // Player height
  playerHeight: 1.6
};

// Player state
let playerState = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  isGrounded: true,
  isMoving: false,
  moveDirection: { x: 0, z: 0 }
};

// Controller references
let leftController = null;
let rightController = null;
let xrHelper = null;
let scene = null;
let groundMeshes = [];

// Movement input state
let movementInput = {
  forward: 0,
  backward: 0,
  left: 0,
  right: 0,
  turnLeft: 0,
  turnRight: 0
};

// ======================================================================
// Helper Functions: Get Camera Direction Vectors
// ======================================================================

// Get camera forward vector (ignore Y-axis)
function getCameraForward(camera) {
  // Get forward vector from camera rotation matrix
  const forward = new BABYLON.Vector3(0, 0, 1);
  forward.applyRotationQuaternion(camera.rotationQuaternion || BABYLON.Quaternion.Identity());
  
  // Ignore Y-axis, only move on ground plane
  forward.y = 0;
  return forward.normalize();
}

// Get camera right vector (ignore Y-axis)
function getCameraRight(camera) {
  // Get right vector from camera rotation matrix
  const right = new BABYLON.Vector3(1, 0, 0);
  right.applyRotationQuaternion(camera.rotationQuaternion || BABYLON.Quaternion.Identity());
  
  // Ignore Y-axis, only move on ground plane
  right.y = 0;
  return right.normalize();
}

// ======================================================================
// Initialize Movement System
// ======================================================================

export function initMovementSystem(xrHelperInstance, sceneInstance, groundMeshesArray = []) {
  if (!xrHelperInstance || !sceneInstance) {
    console.error('❌ Failed to initialize movement system: Invalid parameters');
    return;
  }
  
  xrHelper = xrHelperInstance;
  scene = sceneInstance;
  groundMeshes = groundMeshesArray;
  
  console.log('🚶 Initializing VR movement system');
  
  // Set initial player position
  if (xrHelper.baseExperience && xrHelper.baseExperience.camera) {
    const camera = xrHelper.baseExperience.camera;
    playerState.position.x = camera.position.x;
    playerState.position.y = MOVEMENT_CONFIG.playerHeight;
    playerState.position.z = camera.position.z;
    
    // Ensure camera has rotation quaternion
    if (!camera.rotationQuaternion) {
      camera.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
        camera.rotation.x, 
        camera.rotation.y, 
        camera.rotation.z
      );
    }
  }
  
  // Listen for controller addition
  setupControllerListeners();
  
  // Set up game loop
  setupGameLoop();
  
  console.log('✅ VR movement system initialized');
}

// ======================================================================
// Set Up Controller Listeners
// ======================================================================

function setupControllerListeners() {
  xrHelper.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motionController) => {
      // Assign functions based on controller handedness (left/right)
      const handedness = controller.inputSource ? controller.inputSource.handedness : 'none';
      
      if (handedness === 'left') {
        setupLeftController(controller, motionController);
      } else if (handedness === 'right') {
        setupRightController(controller, motionController);
      } else {
        // If no handedness info, try to guess
        if (!leftController) {
          setupLeftController(controller, motionController);
        } else if (!rightController) {
          setupRightController(controller, motionController);
        }
      }
    });
  });
}

// ======================================================================
// Set Up Left Controller (Movement Control)
// ======================================================================

function setupLeftController(controller, motionController) {
  leftController = { controller, motionController };
  console.log('👈 Left controller connected');
  
  // Get thumbstick component - try multiple possible names
  const thumbstick = motionController.getComponent('thumbstick') || 
                     motionController.getComponent('xr-standard-thumbstick') ||
                     motionController.getComponent('xr-thumbstick') ||
                     motionController.getComponent('thumbstick-pad');
  
  if (!thumbstick) {
    console.warn('⚠️ Left controller: No thumbstick found. Available components:', 
      Object.keys(motionController.components || {}));
    return;
  }
  
  console.log('✅ Found left thumbstick component:', thumbstick.id);
  
  // Listen for thumbstick input
  if (thumbstick.onAxisValueChangedObservable && thumbstick.onAxisValueChangedObservable.add) {
    thumbstick.onAxisValueChangedObservable.add((axisValues) => {
      // axisValues: { x: -1 to 1, y: -1 to 1 }
      updateMovementInput(axisValues.x, axisValues.y);
    });
  }
  
  // Listen for thumbstick press (optional: for jumping or sprinting)
  if (thumbstick.onButtonStateChangedObservable && thumbstick.onButtonStateChangedObservable.add) {
    thumbstick.onButtonStateChangedObservable.add((buttonState) => {
      if (buttonState.pressed && MOVEMENT_CONFIG.enableJump && playerState.isGrounded) {
        playerState.velocity.y = MOVEMENT_CONFIG.jumpForce;
        playerState.isGrounded = false;
      }
    });
  }
}

// ======================================================================
// Set Up Right Controller (Rotation Control)
// ======================================================================

function setupRightController(controller, motionController) {
  rightController = { controller, motionController };
  console.log('👉 Right controller connected');
  
  // Get thumbstick component (for rotation)
  const thumbstick = motionController.getComponent('thumbstick') || 
                     motionController.getComponent('xr-standard-thumbstick') ||
                     motionController.getComponent('xr-thumbstick') ||
                     motionController.getComponent('thumbstick-pad');
  
  if (!thumbstick) {
    console.warn('⚠️ Right controller: No thumbstick found. Available components:', 
      Object.keys(motionController.components || {}));
    return;
  }
  
  console.log('✅ Found right thumbstick component:', thumbstick.id);
  
  // Listen for thumbstick input (for rotation)
  if (thumbstick.onAxisValueChangedObservable && thumbstick.onAxisValueChangedObservable.add) {
    thumbstick.onAxisValueChangedObservable.add((axisValues) => {
      updateRotationInput(axisValues.x);
    });
  }
}

// ======================================================================
// Update Movement Input
// ======================================================================

function updateMovementInput(x, y) {
  // Thumbstick forward: move forward
  if (y > 0.1) {
    movementInput.forward = y;
    movementInput.backward = 0;
  }
  // Thumbstick backward: move backward
  else if (y < -0.1) {
    movementInput.backward = -y;
    movementInput.forward = 0;
  }
  // Thumbstick centered: stop forward/backward movement
  else {
    movementInput.forward = 0;
    movementInput.backward = 0;
  }
  
  // Thumbstick left: move left
  if (x < -0.1) {
    movementInput.left = -x;
    movementInput.right = 0;
  }
  // Thumbstick right: move right
  else if (x > 0.1) {
    movementInput.right = x;
    movementInput.left = 0;
  }
  // Thumbstick centered: stop left/right movement
  else {
    movementInput.left = 0;
    movementInput.right = 0;
  }
  
  // Update movement state
  playerState.isMoving = (movementInput.forward > 0 || movementInput.backward > 0 || 
                         movementInput.left > 0 || movementInput.right > 0);
}

// ======================================================================
// Update Rotation Input
// ======================================================================

function updateRotationInput(x) {
  // Thumbstick left: turn left
  if (x < -0.3) {
    movementInput.turnLeft = -x;
    movementInput.turnRight = 0;
  }
  // Thumbstick right: turn right
  else if (x > 0.3) {
    movementInput.turnRight = x;
    movementInput.turnLeft = 0;
  }
  // Thumbstick centered: stop rotation
  else {
    movementInput.turnLeft = 0;
    movementInput.turnRight = 0;
  }
}

// ======================================================================
// Set Up Game Loop
// ======================================================================

function setupGameLoop() {
  scene.onBeforeRenderObservable.add(() => {
    const deltaTime = scene.getEngine().getDeltaTime() / 1000; // Convert to seconds
    
    // Update movement
    updateMovement(deltaTime);
    
    // Update rotation
    updateRotation(deltaTime);
    
    // Update gravity
    updateGravity(deltaTime);
    
    // Update camera position
    updateCameraPosition();
    
    // Check collisions
    checkCollisions();
  });
}

// ======================================================================
// Update Movement
// ======================================================================

function updateMovement(deltaTime) {
  if (!playerState.isMoving) {
    // If no input, gradually stop
    playerState.velocity.x *= 0.9;
    playerState.velocity.z *= 0.9;
    return;
  }
  
  // Get camera reference
  const camera = xrHelper.baseExperience.camera;
  
  // Ensure camera has rotation quaternion
  if (!camera.rotationQuaternion) {
    camera.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
      camera.rotation.x, 
      camera.rotation.y, 
      camera.rotation.z
    );
  }
  
  // Get camera direction vectors
  const forwardDir = getCameraForward(camera);
  const rightDir = getCameraRight(camera);
  
  // Calculate movement direction
  const moveDirection = new BABYLON.Vector3(0, 0, 0);
  
  // Forward/backward movement
  if (movementInput.forward > 0) {
    moveDirection.addInPlace(forwardDir.scale(movementInput.forward));
  }
  if (movementInput.backward > 0) {
    moveDirection.addInPlace(forwardDir.scale(-movementInput.backward));
  }
  
  // Left/right movement
  if (movementInput.left > 0) {
    moveDirection.addInPlace(rightDir.scale(-movementInput.left));
  }
  if (movementInput.right > 0) {
    moveDirection.addInPlace(rightDir.scale(movementInput.right));
  }
  
  // Normalize movement direction
  if (moveDirection.length() > 0) {
    moveDirection.normalize();
  }
  
  // Save movement direction
  playerState.moveDirection.x = moveDirection.x;
  playerState.moveDirection.z = moveDirection.z;
  
  // Apply speed
  const speed = MOVEMENT_CONFIG.moveSpeed;
  playerState.velocity.x = moveDirection.x * speed;
  playerState.velocity.z = moveDirection.z * speed;
  
  // Update position
  playerState.position.x += playerState.velocity.x * deltaTime;
  playerState.position.z += playerState.velocity.z * deltaTime;
}

// ======================================================================
// Update Rotation
// ======================================================================

function updateRotation(deltaTime) {
  // Turn left
  if (movementInput.turnLeft > 0) {
    const rotationAmount = -MOVEMENT_CONFIG.rotateSpeed * deltaTime * movementInput.turnLeft;
    xrHelper.baseExperience.camera.rotation.y += BABYLON.Tools.ToRadians(rotationAmount);
  }
  
  // Turn right
  if (movementInput.turnRight > 0) {
    const rotationAmount = MOVEMENT_CONFIG.rotateSpeed * deltaTime * movementInput.turnRight;
    xrHelper.baseExperience.camera.rotation.y += BABYLON.Tools.ToRadians(rotationAmount);
  }
}

// ======================================================================
// Update Gravity
// ======================================================================

function updateGravity(deltaTime) {
  if (!MOVEMENT_CONFIG.enableJump) {
    // If jumping is disabled, stay on ground
    playerState.position.y = MOVEMENT_CONFIG.playerHeight;
    playerState.velocity.y = 0;
    playerState.isGrounded = true;
    return;
  }
  
  // Apply gravity
  playerState.velocity.y += MOVEMENT_CONFIG.gravity * deltaTime;
  playerState.position.y += playerState.velocity.y * deltaTime;
  
  // Check if landed
  if (playerState.position.y <= MOVEMENT_CONFIG.playerHeight) {
    playerState.position.y = MOVEMENT_CONFIG.playerHeight;
    playerState.velocity.y = 0;
    playerState.isGrounded = true;
  }
}

// ======================================================================
// Update Camera Position
// ======================================================================

function updateCameraPosition() {
  if (!xrHelper.baseExperience || !xrHelper.baseExperience.camera) return;
  
  const camera = xrHelper.baseExperience.camera;
  
  // Ensure camera has rotation quaternion
  if (!camera.rotationQuaternion) {
    camera.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(
      camera.rotation.x, 
      camera.rotation.y, 
      camera.rotation.z
    );
  }
  
  // Update camera position (follow player position)
  camera.position.x = playerState.position.x;
  camera.position.z = playerState.position.z;
  
  // If jumping enabled, update Y-axis
  if (MOVEMENT_CONFIG.enableJump) {
    camera.position.y = playerState.position.y;
  }
}

// ======================================================================
// Check Collisions
// ======================================================================

function checkCollisions() {
  // Simple collision detection
  const playerRadius = 0.3;
  const playerPos = new BABYLON.Vector3(playerState.position.x, MOVEMENT_CONFIG.playerHeight, playerState.position.z);
  
  // Check collision with ground
  for (const ground of groundMeshes) {
    if (ground.intersectsPoint(playerPos)) {
      // If below ground, push back to ground
      if (playerState.position.y < MOVEMENT_CONFIG.playerHeight) {
        playerState.position.y = MOVEMENT_CONFIG.playerHeight;
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
      }
      break;
    }
  }
}

// ======================================================================
// Configuration Functions
// ======================================================================

// Set movement speed
export function setMoveSpeed(speed) {
  if (speed > 0 && speed <= 10) {
    MOVEMENT_CONFIG.moveSpeed = speed;
    console.log(`🏃‍♂️ Movement speed set to: ${speed} m/s`);
    return true;
  }
  console.warn(`⚠️ Invalid movement speed: ${speed}`);
  return false;
}

// Set rotation speed
export function setRotateSpeed(speed) {
  if (speed > 0 && speed <= 360) {
    MOVEMENT_CONFIG.rotateSpeed = speed;
    console.log(`🔄 Rotation speed set to: ${speed} deg/s`);
    return true;
  }
  console.warn(`⚠️ Invalid rotation speed: ${speed}`);
  return false;
}

// Enable/disable jumping
export function setJumpEnabled(enabled) {
  MOVEMENT_CONFIG.enableJump = enabled;
  console.log(`🦘 Jumping ${enabled ? 'enabled' : 'disabled'}`);
}

// Get player state
export function getPlayerState() {
  return { ...playerState };
}

// Get movement configuration
export function getMovementConfig() {
  return { ...MOVEMENT_CONFIG };
}

// Reset player position
export function resetPlayerPosition(position = null) {
  if (position) {
    playerState.position = { ...position };
  } else {
    playerState.position = { x: 0, y: MOVEMENT_CONFIG.playerHeight, z: 0 };
  }
  playerState.velocity = { x: 0, y: 0, z: 0 };
  playerState.isGrounded = true;
  
  console.log(`📍 Player position reset to (${playerState.position.x}, ${playerState.position.y}, ${playerState.position.z})`);
}

// Stop all movement
export function stopAllMovement() {
  movementInput = {
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    turnLeft: 0,
    turnRight: 0
  };
  playerState.isMoving = false;
  playerState.velocity = { x: 0, y: 0, z: 0 };
}

// Clean up movement system
export function cleanupMovementSystem() {
  stopAllMovement();
  leftController = null;
  rightController = null;
  console.log('🧹 Movement system cleaned up');
}