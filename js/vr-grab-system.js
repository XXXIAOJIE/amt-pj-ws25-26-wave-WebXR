// ======================================================================
//  vr-grab-system.js — VR抓取和计分系统
// ======================================================================

let VRGS_glow = null;
let VRGS_starSound = null;
let VRGS_bombSound = null;

const VRGS_grabbedByController = new Map();
let VRGS_highlightLayer = null;
let VRGS_currentGazed = null;
const VRGS_gazeMaxDistance = 40;
const VRGS_gazeHighlightScale = 1.18;

// ======================================================================
// 游戏状态管理
// ======================================================================

let VRGS_gameState = {
  score: 0,
  isGameStarted: false,
  timeRemaining: 60, // 60秒
  isGameOver: false
};

// 开始游戏
export function VRGS_startGame() {
  if (VRGS_gameState.isGameOver) {
    VRGS_resetGame();
  }
  
  VRGS_gameState.isGameStarted = true;
  VRGS_gameState.timeRemaining = 60;
  console.log("🎮 游戏开始！");
  
  // 激活所有星星和炸弹
  if (typeof BABYLON !== 'undefined') {
    const scene = BABYLON.Engine.LastCreatedScene;
    if (scene) {
      scene.meshes.forEach(mesh => {
        if (mesh.metadata && mesh.metadata.vr_grabbable) {
          mesh.metadata.isActive = true;
          mesh.setEnabled(true);
        }
      });
    }
  }
}

// 暂停游戏
export function VRGS_setupXRGrab(xrHelper, scene) {
  const fm = xrHelper.baseExperience.featuresManager;

  // Decide platform-specific setup: Vision Pro vs controllers (Quest)
  if (isAppleVisionPro()) {
    console.log("ℹ️ Detected Apple Vision Pro (userAgent). Enabling Vision Pro grab handlers.");
    // set up shared features (gaze highlight + helpers)
    VRGS_setupSharedFeatures(xrHelper, scene);
    return VRGS_setupXRGrabForVisionPro(xrHelper, scene);
  } else {
    console.log("ℹ️ Using controller-based grab handlers (Quest/other controllers).");
    // set up shared features (gaze highlight + helpers)
    VRGS_setupSharedFeatures(xrHelper, scene);
    return VRGS_setupXRGrabForControllers(xrHelper, scene);
  }
}

// Simple platform detection. Assumption: Apple Vision Pro/visionOS includes 'Vision' or 'visionOS' in the userAgent.
// This is heuristic — if you have a better runtime flag, replace this check.
function isAppleVisionPro() {
  try {
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('vision') || ua.includes('visionos') || ua.includes('vision pro') || ua.includes('visionpro');
  } catch (e) {
    return false;
  }
}

// Shared features: gaze highlighting and shared pick handlers
export function VRGS_setupSharedFeatures(xrHelper, scene) {
  // Create a highlight layer for gaze highlighting
  try {
    VRGS_highlightLayer = new BABYLON.HighlightLayer("vrgsHighlight", scene);
  } catch (e) {
    console.warn("HighlightLayer not available:", e);
    VRGS_highlightLayer = null;
  }

  // Gaze-based highlighting: cast a ray from the XR camera forward each frame
  scene.onBeforeRenderObservable.add(() => {
    try {
      const xrCam = xrHelper && xrHelper.baseExperience && xrHelper.baseExperience.camera;
      if (!xrCam) return;

      const forward = new BABYLON.Vector3(0, 0, 1);
      forward.applyRotationQuaternion(xrCam.rotationQuaternion || BABYLON.Quaternion.Identity());
      forward.normalize();

      const origin = xrCam.position.clone();
      const ray = new BABYLON.Ray(origin, forward, VRGS_gazeMaxDistance);

      const pick = scene.pickWithRay(ray, (m) => m && m.metadata && m.metadata.vr_grabbable && m.metadata.isActive);

      if (pick && pick.hit && pick.pickedMesh) {
        const mesh = pick.pickedMesh;
        if (mesh !== VRGS_currentGazed) {
          // remove previous
          if (VRGS_currentGazed) {
            try { if (VRGS_highlightLayer) VRGS_highlightLayer.removeMesh(VRGS_currentGazed); } catch (e) {}
            if (VRGS_currentGazed.metadata && VRGS_currentGazed.metadata.baseScale) {
              const b = VRGS_currentGazed.metadata.baseScale;
              VRGS_currentGazed.scaling.set(b, b, b);
            }
          }

          // highlight new mesh
          VRGS_currentGazed = mesh;
          try { if (VRGS_highlightLayer) VRGS_highlightLayer.addMesh(mesh, new BABYLON.Color3(0.7, 0.9, 1)); } catch (e) {}
          if (mesh.metadata && mesh.metadata.baseScale) {
            const b = mesh.metadata.baseScale;
            mesh.scaling.set(b * VRGS_gazeHighlightScale, b * VRGS_gazeHighlightScale, b * VRGS_gazeHighlightScale);
          }
        }
      } else {
        if (VRGS_currentGazed) {
          try { if (VRGS_highlightLayer) VRGS_highlightLayer.removeMesh(VRGS_currentGazed); } catch (e) {}
          if (VRGS_currentGazed.metadata && VRGS_currentGazed.metadata.baseScale) {
            const b = VRGS_currentGazed.metadata.baseScale;
            VRGS_currentGazed.scaling.set(b, b, b);
          }
          VRGS_currentGazed = null;
        }
      }
    } catch (e) {
      // keep the render loop stable
    }
  });
}

// helper: perform pick using controller.pickResult and forward to handler
function _VRGS_performPickForController(controller, scene) {
  try {
    const pickResult = controller.pickResult;
    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      _VRGS_handlePickedMesh(controller, pickResult.pickedMesh, scene);
    }
  } catch (e) {
    // ignore
  }
}

// helper: shared logic for when a mesh is picked (controller or hand)
function _VRGS_handlePickedMesh(controller, mesh, scene) {
  try {
    if (!mesh || !mesh.metadata) return;
    if (!mesh.metadata.vr_grabbable) return;
    if (!mesh.metadata.isActive) return;

    // 检查游戏是否开始
    if (!VRGS_gameState.isGameStarted) {
      console.log("⏸️ 游戏未开始，无法抓取");
      return;
    }

    const id = controller.uniqueId || (controller.inputSource && controller.inputSource.handedness) || Math.random();
    const alreadyGrabbed = VRGS_grabbedByController.get(id);

    if (alreadyGrabbed === mesh) {
      // 放下物体
      mesh.metadata.grabbing = false;
      mesh.setParent(null);
      VRGS_grabbedByController.delete(id);
      return;
    }

    // 抓起物体
    mesh.metadata.grabbing = true;
    VRGS_grabbedByController.set(id, mesh);

    // 根据类型处理 (same behavior as controller trigger)
    if (mesh.metadata.type === "star") {
      if (VRGS_starSound) VRGS_starSound.play();
      VRGS_addScore();
      createPickupEffect(mesh.position, scene, "star");
      setTimeout(() => {
        if (mesh && !mesh.isDisposed()) {
          mesh.metadata.isActive = false;
          mesh.setEnabled(false);
        }
        VRGS_grabbedByController.delete(id);
      }, 100);

    } else if (mesh.metadata.type === "bomb") {
      if (VRGS_bombSound) VRGS_bombSound.play();
      VRGS_subtractScore();
      createPickupEffect(mesh.position, scene, "bomb");
      setTimeout(() => {
        if (mesh && !mesh.isDisposed()) {
          mesh.metadata.isActive = false;
          mesh.setEnabled(false);
        }
        VRGS_grabbedByController.delete(id);
      }, 100);
    }
  } catch (e) {
    console.error("_VRGS_handlePickedMesh error:", e);
  }
}

// ---------------------------------------------------------------------
// Controller / Quest style setup (trigger-based)
// ---------------------------------------------------------------------
export function VRGS_setupXRGrabForControllers(xrHelper, scene) {
  const fm = xrHelper.baseExperience.featuresManager;

  // Enable pointer selection (controllers)
  const pointerSelection = fm.enableFeature(
    BABYLON.WebXRFeatureName.POINTER_SELECTION,
    "latest",
    {
      xrInput: xrHelper.input,
      enablePointerSelectionOnAllControllers: true
    }
  );

  if (!pointerSelection) {
    console.error("❌ pointerSelection feature failed to enable");
    return;
  }

  console.log("✅ pointerSelection (controllers) enabled");

  // Wire controllers similar to previous implementation
  xrHelper.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motionController) => {
      const triggerComponent = motionController.getComponent("trigger");
      if (triggerComponent && triggerComponent.onButtonStateChangedObservable) {
        triggerComponent.onButtonStateChangedObservable.add((component) => {
          if (component.pressed) {
            _VRGS_performPickForController(controller, scene);
          }
        });
      }
    });

    // also handle select events as fallback
    if (controller.onSelectStartObservable && controller.onSelectStartObservable.add) {
      controller.onSelectStartObservable.add(() => {
        _VRGS_performPickForController(controller, scene);
      });
    }
  });
}

// ---------------------------------------------------------------------
// Apple Vision Pro setup (hand tracking + pinch/select)
// Only enable the features and handlers needed for hand-tracking and pinch.
// ---------------------------------------------------------------------
export function VRGS_setupXRGrabForVisionPro(xrHelper, scene) {
  const fm = xrHelper.baseExperience.featuresManager;

  // Try to enable HAND_TRACKING feature; if not available, fall back to select events
  let handTracking = null;
  try {
    handTracking = fm.enableFeature(
      BABYLON.WebXRFeatureName.HAND_TRACKING,
      "latest",
      {
        xrInput: xrHelper.input
      }
    );
  } catch (e) {
    console.warn("HAND_TRACKING feature not available:", e);
    handTracking = null;
  }

  if (handTracking) {
    console.log("✅ HAND_TRACKING feature enabled for Vision Pro");
  } else {
    console.log("ℹ️ HAND_TRACKING not enabled; will rely on select events (pinch may be mapped to select)");
  }

  // Listen for controllers/hands and prefer select events (pinch is often mapped to select on visionOS)
  xrHelper.input.onControllerAddedObservable.add((controller) => {
    // If the controller reports hand input, tag it
    const isHand = !!(controller.inputSource && controller.inputSource.hand);

    if (isHand) {
      console.log("🖐️ Hand-tracked input detected (Vision Pro)");
    }

    // Use select start (pinch) as the primary pickup action
    if (controller.onSelectStartObservable && controller.onSelectStartObservable.add) {
      controller.onSelectStartObservable.add(() => {
        _VRGS_performPickForController(controller, scene);
      });
    }

    // Also handle select end for release behavior (if we later implement hold-to-move)
    if (controller.onSelectEndObservable && controller.onSelectEndObservable.add) {
      controller.onSelectEndObservable.add(() => {
        // If we have a grabbed object for this controller, drop it
        try {
          const id = controller.uniqueId || (controller.inputSource && controller.inputSource.handedness);
          const grabbed = VRGS_grabbedByController.get(id);
          if (grabbed) {
            grabbed.metadata.grabbing = false;
            grabbed.setParent(null);
            VRGS_grabbedByController.delete(id);
          }
        } catch (e) {}
      });
    }
  });
}

// ======================================================================
// 拾取特效
// ======================================================================
function createPickupEffect(position, scene, type) {
  try {
    const particleSystem = new BABYLON.ParticleSystem(`${type}PickupParticles`, 200, scene);
    
    // 根据类型设置颜色
    if (type === "star") {
      particleSystem.color1 = new BABYLON.Color4(1, 1, 0.5, 1.0); // 金色
      particleSystem.color2 = new BABYLON.Color4(1, 0.8, 0, 1.0); // 橙色
    } else if (type === "bomb") {
      particleSystem.color1 = new BABYLON.Color4(1, 0.2, 0.2, 1.0); // 红色
      particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0); // 橙红色
    }
    
    particleSystem.emitter = position.clone();
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.7;
    particleSystem.emitRate = 100;
    particleSystem.minEmitPower = 2;
    particleSystem.maxEmitPower = 5;
    particleSystem.updateSpeed = 0.01;
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
    particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
    
    particleSystem.start();
    
    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => {
        particleSystem.dispose();
      }, 1000);
    }, 300);
  } catch (error) {
    console.log("粒子效果创建失败:", error);
  }
}