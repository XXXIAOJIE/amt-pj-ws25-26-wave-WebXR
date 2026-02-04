
import {
  VRGS_registerGlow,
  VRGS_makeGrabbable,
  VRGS_loadStarSound,
  VRGS_loadBombSound,
  VRGS_setupXRGrab,
  VRGS_startGame,
  VRGS_pauseGame,
  VRGS_resetGame,
  VRGS_getGameState,
  VRGS_updateTime
} from "./vr-grab-system.js";

import {
  GUI_initUI,
  GUI_updateFPS,
  GUI_updateScore,
  GUI_updateTime,
  GUI_updateGameStatus,
  GUI_showGameOver,
  GUI_removeGameOver,
  GUI_positionUIFrontOfCamera,
  GUI_setUIVisible
} from "./game-ui.js";

import { 
  initMovementSystem, 
  setMoveSpeed, 
  setRotateSpeed,
  getMovementConfig 
} from "./vr-movement.js";

// ⭐ Import starfield background system
// import { 
//   createCompleteStarfield,
//   setStarfieldVisible,
//   disposeStarfield 
// } from "./starfield-background.js";

const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

async function createScene() {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.2);

  // ------------------------------------------------------------------
  // Initialize 3D VR UI
  // ------------------------------------------------------------------
  const { startButton, uiPlane } = GUI_initUI(scene);
  
  // Hide UI initially (will show in VR mode)
  if (uiPlane) {
    GUI_setUIVisible(false);
  }

  // ------------------------------------------------------------------
  // Camera & Light (for desktop mode)
  // ------------------------------------------------------------------
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 2, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  //（Skybox）
        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 2000 }, scene);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
        skyboxMaterial.backFaceCulling = false;

        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
          "https://playground.babylonjs.com/textures/skybox",
          //"https://threejs.org/examples/textures/cube/starfield/",
          scene
        );
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

  // ------------------------------------------------------------------
  // Skybox
  // ------------------------------------------------------------------
  // BABYLON.SceneLoader.ImportMesh("", "./model/", "sky2.glb", scene, (meshes) => {
  //   const sky = meshes[0];
  //   sky.scaling = new BABYLON.Vector3(500, 500, 500);
  //   meshes.forEach(m => { if (m.material) m.material.backFaceCulling = false; });
  //   scene.registerBeforeRender(() => sky.position.copyFrom(scene.activeCamera.position));
  // });

  // // ------------------------------------------------------------------
  // // Create Starfield Background
  // // ------------------------------------------------------------------
  // console.log("🌌 Setting up starfield background...");
  // let starfieldSystem = null;
  
  // try {
  //   starfieldSystem = createCompleteStarfield(scene, {
  //     starCount: 5000,
  //     twinkleCount: 1000,
  //     enableShootingStars: true,
  //     enableGalaxy: true,
  //     enableTwinkling: true
  //   });
  //   console.log("✅ Starfield background created successfully");
  // } catch (error) {
  //   console.error("❌ Failed to create starfield background:", error);
  //   // Fallback to simple dark background
  //   scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.06, 1.0);
  // }

  // ------------------------------------------------------------------
  // Grass ground
  // ------------------------------------------------------------------
  let ground;
  try {
    const grassGround = new GrassGround(scene, {
      width: 100,
      height: 100,
      positionY: -1.5,
      textureScale: 10,
      enablePhysics: false,
    });
    ground = await grassGround.create();
  } catch (err) {
    console.error("Grass ground load failed:", err);
    ground = BABYLON.MeshBuilder.CreateGround("fallbackGround", { width: 100, height: 100 }, scene);
    ground.position.y = -1.5;
  }

  // ------------------------------------------------------------------
  // Glow layer
  // ------------------------------------------------------------------
  const glow = new BABYLON.GlowLayer("glow", scene);
  glow.intensity = 0.8;
  VRGS_registerGlow(glow);

  // ------------------------------------------------------------------
  // Stars
  // ------------------------------------------------------------------
  const STAR_COUNT = 80;
  BABYLON.SceneLoader.ImportMesh("", "./model/star2/", "scene.gltf", scene, (meshes) => {
    const template = meshes[0];
    template.setEnabled(false);

    for (let i = 0; i < STAR_COUNT; i++) {
      const s = template.clone("star" + i);
      s.setEnabled(true);
      s.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 + 2,
        (Math.random() - 0.5) * 20
      );
      const scale = 0.3 + Math.random() * 0.5;
      s.scaling = new BABYLON.Vector3(scale, scale, scale);
      VRGS_makeGrabbable(s, "star");
    }

    // Floating animation
    scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.0002;
      scene.meshes
        .filter(m => m.name.startsWith("star"))
        .forEach((s, i) => {
          s.position.x += Math.sin(t + i * 0.37) * 0.0006;
          s.position.y += Math.cos(t * 1.13 + i * 0.19) * 0.0005;
          s.position.z += Math.sin(t * 0.77 + i * 0.11) * 0.0006;
        });
    });
  });

  VRGS_loadStarSound(scene);

  // ------------------------------------------------------------------
  // Bombs
  // ------------------------------------------------------------------
  const BOMB_COUNT = 20;
  BABYLON.SceneLoader.ImportMesh("", "./model/", "bomb.glb", scene, (meshes) => {
    const template = meshes[0];
    template.setEnabled(false);

    for (let i = 0; i < BOMB_COUNT; i++) {
      const b = template.clone("bomb" + i);
      b.setEnabled(true);
      b.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 + 2,
        (Math.random() - 0.5) * 20
      );
      b.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3);
      VRGS_makeGrabbable(b, "bomb");
    }

    // Floating + rotation animation
    scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.00025;
      scene.meshes
        .filter(m => m.name.startsWith("bomb"))
        .forEach((b, i) => {
          b.position.x += Math.sin(t + i * 0.25) * 0.0008;
          b.position.y += Math.cos(t * 1.1 + i * 0.18) * 0.0007;
          b.position.z += Math.sin(t * 0.7 + i * 0.15) * 0.0008;
          b.rotation.y += 0.005;
        });
    });
  });

  VRGS_loadBombSound(scene);

  // ------------------------------------------------------------------
  // Start button event
  // ------------------------------------------------------------------
  let restartButton = null;
  
  if (startButton && startButton.onPointerUpObservable && startButton.onPointerUpObservable.add) {
    startButton.onPointerUpObservable.add(() => {
      const gameState = VRGS_getGameState();
      
      if (!gameState.isGameStarted) {
        // Start game
        VRGS_startGame();
        GUI_removeGameOver();
      } else {
        // Pause game
        VRGS_pauseGame();
      }
    });
  } else {
    console.warn("⚠️ Start button event listener not available");
  }

  // ------------------------------------------------------------------
  // WebXR Initialization
  // ------------------------------------------------------------------
  let xrHelper = null;
  let isVRMode = false;
  
  try {
    xrHelper = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [ground],
      disableTeleportation: true,
      optionalFeatures: true
    });

    if (xrHelper.baseExperience) {
      xrHelper.baseExperience.camera.position.y = 1.6;
      
      // Initialize grab system
      VRGS_setupXRGrab(xrHelper, scene);
      
      // Initialize movement system
      initMovementSystem(xrHelper, scene, [ground]);
      
      console.log("✅ WebXR Ready: Grab and movement systems enabled");
      console.log("📊 Movement config:", getMovementConfig());
      
      // Handle VR entry/exit
      xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        console.log(`XR State changed: ${state}`);
        
        if (state === BABYLON.WebXRState.IN_XR) {
          // Entered VR mode
          isVRMode = true;
          console.log("🕶️ Entered VR mode");
          
          // Show 3D UI in VR
          GUI_setUIVisible(true);
          
          // Position UI in front of user
          const vrCamera = xrHelper.baseExperience.camera;
          GUI_positionUIFrontOfCamera(vrCamera, 1.5, 1.6);
          
        } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
          // Exited VR mode
          isVRMode = false;
          console.log("🖥️ Exited VR mode, back to desktop");
          
          // Hide 3D UI in desktop mode
          GUI_setUIVisible(false);
        }
      });
    }
  } catch (err) {
    console.error("❌ XR init failed:", err);
  }

  // ------------------------------------------------------------------
  // Game Loop
  // ------------------------------------------------------------------
  let lastTime = performance.now();
  
  scene.onBeforeRenderObservable.add(() => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Update FPS
    GUI_updateFPS(engine.getFps());
    
    // Get game state
    const gameState = VRGS_getGameState();
    
    // Update UI
    GUI_updateScore(gameState.score);
    GUI_updateTime(gameState.timeRemaining);
    GUI_updateGameStatus(gameState.isGameStarted && !gameState.isGameOver);
    
    // Update time
    VRGS_updateTime(deltaTime);
    
    // Position UI in front of VR camera
    if (isVRMode && xrHelper && xrHelper.baseExperience && xrHelper.baseExperience.camera) {
      GUI_positionUIFrontOfCamera(xrHelper.baseExperience.camera, 1.5, 1.6);
    }
    
    // Check game over
    if (gameState.isGameOver && !restartButton) {
      restartButton = GUI_showGameOver(gameState.score);
      
      // Restart button event
      if (restartButton && restartButton.onPointerUpObservable && restartButton.onPointerUpObservable.add) {
        restartButton.onPointerUpObservable.add(() => {
          VRGS_resetGame();
          GUI_removeGameOver();
          restartButton = null;
        });
      } else {
        console.warn("⚠️ Restart button event listener not available");
      }
    }
  });

  return scene;
}

// ----------------------------------------------------------------------
// Run engine
// ----------------------------------------------------------------------
createScene().then((scene) => {
  engine.runRenderLoop(() => {
    if (scene.activeCamera) scene.render();
  });
}).catch((error) => {
  console.error("❌ Scene creation failed:", error);
});

window.addEventListener("resize", () => engine.resize());

// ----------------------------------------------------------------------
//keyboard shortcuts for testing
// ----------------------------------------------------------------------
document.addEventListener('keydown', (event) => {
  // Spacebar to start/pause game
  if (event.code === 'Space') {
    event.preventDefault();
    const gameState = VRGS_getGameState();
    
    if (!gameState.isGameStarted) {
      VRGS_startGame();
      GUI_removeGameOver();
    } else {
      VRGS_pauseGame();
    }
  }
  
  // R key to reset game
  if (event.code === 'KeyR') {
    event.preventDefault();
    VRGS_resetGame();
    GUI_removeGameOver();
  }
  
  // ESC key to exit VR (if in VR mode)
  if (event.code === 'Escape') {
    console.log("ESC pressed");
  }
});
