// ======================================================================
//  vr-grab-system.js — VR抓取和计分系统
// ======================================================================

let VRGS_glow = null;
let VRGS_starSound = null;
let VRGS_bombSound = null;

const VRGS_grabbedByController = new Map();

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
export function VRGS_pauseGame() {
  VRGS_gameState.isGameStarted = false;
  console.log("⏸️ 游戏暂停");
}

// 结束游戏
export function VRGS_endGame() {
  VRGS_gameState.isGameStarted = false;
  VRGS_gameState.isGameOver = true;
  console.log("🎮 游戏结束！最终分数:", VRGS_gameState.score);
}

// 重置游戏
export function VRGS_resetGame() {
  VRGS_gameState = {
    score: 0,
    isGameStarted: false,
    timeRemaining: 60,
    isGameOver: false
  };
  console.log("🔄 游戏已重置");
}

// 增加分数（星星）
export function VRGS_addScore() {
  if (!VRGS_gameState.isGameStarted) return VRGS_gameState.score;
  
  VRGS_gameState.score += 1;
  console.log(`⭐ 抓到星星！当前分数: ${VRGS_gameState.score}`);
  return VRGS_gameState.score;
}

// 减少分数（炸弹）
export function VRGS_subtractScore() {
  if (!VRGS_gameState.isGameStarted) return VRGS_gameState.score;
  
  VRGS_gameState.score = Math.max(0, VRGS_gameState.score - 1);
  console.log(`💣 抓到炸弹！当前分数: ${VRGS_gameState.score}`);
  return VRGS_gameState.score;
}

// 获取游戏状态
export function VRGS_getGameState() {
  return {
    ...VRGS_gameState,
    timeRemaining: Math.max(0, VRGS_gameState.timeRemaining)
  };
}

// 更新时间
export function VRGS_updateTime(deltaTime) {
  if (VRGS_gameState.isGameStarted && !VRGS_gameState.isGameOver) {
    VRGS_gameState.timeRemaining -= deltaTime;
    
    if (VRGS_gameState.timeRemaining <= 0) {
      VRGS_gameState.timeRemaining = 0;
      VRGS_endGame();
    }
  }
}

// ======================================================================
// 抓取系统函数
// ======================================================================

export function VRGS_registerGlow(glowLayer) {
  VRGS_glow = glowLayer;
}

export function VRGS_makeGrabbable(mesh, type = "star") {
  mesh.isPickable = true;
  mesh.metadata = {
    vr_grabbable: true,
    type,
    grabbing: false,
    baseScale: mesh.scaling.x,
    isActive: true // 是否可被抓取
  };

  mesh.registerBeforeRender(() => {
    if (!mesh.metadata.grabbing) return;
    const t = performance.now() * 0.004;
    const pulse = 1 + Math.sin(t) * 0.05;
    mesh.scaling.set(
      mesh.metadata.baseScale * pulse,
      mesh.metadata.baseScale * pulse,
      mesh.metadata.baseScale * pulse
    );
  });
}

export function VRGS_loadStarSound(scene) {
  VRGS_starSound = new BABYLON.Sound("starSound", "sounds/star_pick.wav", scene, null, { volume: 0.6 });
}

export function VRGS_loadBombSound(scene) {
  VRGS_bombSound = new BABYLON.Sound("bombSound", "sounds/bomb_explosion.wav", scene, null, { volume: 0.9 });
}

// ======================================================================
// XR抓取设置
// ======================================================================
export function VRGS_setupXRGrab(xrHelper, scene) {
  const fm = xrHelper.baseExperience.featuresManager;

  // 启用 pointer selection
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

  console.log("✅ pointerSelection feature enabled");

  // 监听控制器选择事件
  xrHelper.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motionController) => {
      const triggerComponent = motionController.getComponent("trigger");
      if (!triggerComponent) return;

      triggerComponent.onButtonStateChangedObservable.add((component) => {
        if (component.pressed) {
          const pickResult = controller.pickResult;
          if (pickResult && pickResult.hit && pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            
            if (!mesh.metadata?.vr_grabbable) return;
            if (!mesh.metadata?.isActive) return;
            
            // 检查游戏是否开始
            if (!VRGS_gameState.isGameStarted) {
              console.log("⏸️ 游戏未开始，无法抓取");
              return;
            }
            
            const id = controller.uniqueId;
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

            // 根据类型处理
            if (mesh.metadata.type === "star") {
              // 星星：播放音效、加分、消失
              if (VRGS_starSound) VRGS_starSound.play();
              
              // 加分
              VRGS_addScore();
              
              // 创建粒子效果
              createPickupEffect(mesh.position, scene, "star");
              
              // 让星星消失
              setTimeout(() => {
                if (mesh && !mesh.isDisposed()) {
                  mesh.metadata.isActive = false;
                  mesh.setEnabled(false);
                }
                VRGS_grabbedByController.delete(id);
              }, 100);
              
            } else if (mesh.metadata.type === "bomb") {
              // 炸弹：播放音效、减分、爆炸、消失
              if (VRGS_bombSound) VRGS_bombSound.play();
              
              // 减分
              VRGS_subtractScore();
              
              // 创建爆炸效果
              createPickupEffect(mesh.position, scene, "bomb");
              
              // 让炸弹消失
              setTimeout(() => {
                if (mesh && !mesh.isDisposed()) {
                  mesh.metadata.isActive = false;
                  mesh.setEnabled(false);
                }
                VRGS_grabbedByController.delete(id);
              }, 100);
            }
          }
        }
      });
    });
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