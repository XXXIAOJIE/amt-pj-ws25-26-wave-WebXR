// ======================================================================
//  vr-grab-system.js
// ======================================================================

let VRGS_glow = null;
let VRGS_starSound = null;
let VRGS_bombSound = null;

const VRGS_grabbedByController = new Map();
const VRGS_processedControllers = new Set();


let VRGS_gameState = {
  score: 0,
  isGameStarted: false,
  timeRemaining: 60,
  isGameOver: false
};

// 开始游戏
export function VRGS_startGame() {
  if (VRGS_gameState.isGameOver) {
    VRGS_resetGame();
  }
  
  VRGS_gameState.isGameStarted = true;
  VRGS_gameState.timeRemaining = 60;
  console.log("🎮 Game start！");
  
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

export function VRGS_pauseGame() {
  VRGS_gameState.isGameStarted = false;
  console.log("⏸️ Game Stop");
}

export function VRGS_endGame() {
  VRGS_gameState.isGameStarted = false;
  VRGS_gameState.isGameOver = true;
  console.log("🎮 Game Over！Final Score:", VRGS_gameState.score);
}

export function VRGS_resetGame() {
  VRGS_gameState = {
    score: 0,
    isGameStarted: false,
    timeRemaining: 60,
    isGameOver: false
  };
  console.log("🔄 Game Reset");
}

export function VRGS_addScore() {
  if (!VRGS_gameState.isGameStarted) return VRGS_gameState.score;
  
  VRGS_gameState.score += 1;
  console.log(`⭐ Star caught! Current score: ${VRGS_gameState.score}`);
  return VRGS_gameState.score;
}

export function VRGS_subtractScore() {
  if (!VRGS_gameState.isGameStarted) return VRGS_gameState.score;
  
  VRGS_gameState.score = Math.max(0, VRGS_gameState.score - 1);
  console.log(`💣 Bomb caught! Current score: ${VRGS_gameState.score}`);
  return VRGS_gameState.score;
}

export function VRGS_getGameState() {
  return {
    ...VRGS_gameState,
    timeRemaining: Math.max(0, VRGS_gameState.timeRemaining)
  };
}

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
    isActive: true
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
// 智能抓取检测
// ======================================================================

function findGrabbableMesh(mesh) {
  if (!mesh) return null;
  
  // 1. 检查当前mesh是否可抓取
  if (mesh.metadata && mesh.metadata.vr_grabbable) {
    return mesh;
  }
  
  // 2. 检查是否有父对象可抓取
  let current = mesh.parent;
  while (current) {
    if (current.metadata && current.metadata.vr_grabbable) {
      return current;
    }
    current = current.parent;
  }
  
  // 3. 检查子对象是否可抓取
  if (mesh.getChildren) {
    for (const child of mesh.getChildren()) {
      if (child.metadata && child.metadata.vr_grabbable) {
        return child;
      }
      
      const found = findGrabbableMesh(child);
      if (found) return found;
    }
  }
  
  return null;
}

function performManualRayPick(controller, scene) {
  let rayOrigin, rayDirection;
  
  if (controller.pointer) {
    rayOrigin = controller.pointer.position.clone();
    rayDirection = controller.pointer.forward.clone();
  } else if (controller.grip) {
    rayOrigin = controller.grip.position.clone();
    rayDirection = new BABYLON.Vector3(0, 0, 1);
    if (controller.grip.rotationQuaternion) {
      rayDirection.applyRotationQuaternion(controller.grip.rotationQuaternion);
    }
  } else {
    return { hit: false };
  }
  
  const ray = new BABYLON.Ray(rayOrigin, rayDirection, 10);
  return scene.pickWithRay(ray);
}

// ======================================================================
// 统一抓取处理（修复向量操作）
// ======================================================================

const lastGrabTime = new Map();

function handleGrabInteraction(mesh, scene, controller) {
  const controllerId = controller.uniqueId;
  const now = Date.now();
  
  // 防抖检查：500ms内只能抓取一次
  if (lastGrabTime.has(controllerId)) {
    const lastTime = lastGrabTime.get(controllerId);
    if (now - lastTime < 500) {
      console.log("⏰ 防抖：触发太快，跳过");
      return;
    }
  }
  
  lastGrabTime.set(controllerId, now);
  
  // 查找真正可抓取的mesh
  const grabbableMesh = findGrabbableMesh(mesh);
  
  if (!grabbableMesh) {
    console.log("❌ 未找到可抓取网格");
    return;
  }
  
  if (!grabbableMesh.metadata || !grabbableMesh.metadata.vr_grabbable || !grabbableMesh.metadata.isActive) {
    console.log("❌ 网格不可抓取或未激活");
    return;
  }
  
  const gameState = VRGS_getGameState();
  if (!gameState.isGameStarted) {
    console.log("⏸️ 游戏未开始，无法抓取");
    return;
  }
  
  console.log(`🎮 抓取: ${grabbableMesh.name} (类型: ${grabbableMesh.metadata.type})`);
  
 // 获取位置 - 使用绝对位置，确保是世界坐标
  let effectPosition;
  if (grabbableMesh.getAbsolutePosition) {
    // 使用绝对位置（世界坐标）
    effectPosition = grabbableMesh.getAbsolutePosition();
    console.log(`📍 星星绝对位置: x=${effectPosition.x.toFixed(2)}, y=${effectPosition.y.toFixed(2)}, z=${effectPosition.z.toFixed(2)}`);
  } else if (grabbableMesh.position && grabbableMesh.position.clone) {
    // 回退方案：使用相对位置
    effectPosition = grabbableMesh.position.clone();
    console.log(`📍 星星相对位置: x=${effectPosition.x.toFixed(2)}, y=${effectPosition.y.toFixed(2)}, z=${effectPosition.z.toFixed(2)}`);
  } else {
    console.warn("⚠️ 无法获取网格位置，使用默认位置");
    effectPosition = new BABYLON.Vector3(0, 1.5, 2);
  
  }
  
  // 根据类型处理
  if (grabbableMesh.metadata.type === "star") {
    // 播放音效
    if (VRGS_starSound) {
      try { VRGS_starSound.play(); } catch (e) { }
    }
    
    // 加分
    VRGS_addScore();
    
    // 创建特效 - 移除了toArray调用
    createPickupEffect(effectPosition, scene, "star");
    
    // 延迟禁用星星
    setTimeout(() => {
      grabbableMesh.metadata.isActive = false;
      grabbableMesh.setEnabled(false);
    }, 100);
    
  } else if (grabbableMesh.metadata.type === "bomb") {
    // 播放音效
    if (VRGS_bombSound) {
      try { VRGS_bombSound.play(); } catch (e) { }
    }
    
    // 减分
    VRGS_subtractScore();
    
    // 创建特效 - 移除了toArray调用
    createPickupEffect(effectPosition, scene, "bomb");
    
    // 延迟禁用炸弹
    setTimeout(() => {
      grabbableMesh.metadata.isActive = false;
      grabbableMesh.setEnabled(false);
    }, 100);
  }
}
// ======================================================================
// XR抓取设置（带错误处理）
// ======================================================================

export function VRGS_setupXRGrab(xrHelper, scene) {
  console.log("🎮 初始化WebXR抓取系统 (Meta Quest / 控制器路径)");

  // NOTE: Vision Pro / hand-tracking handling has been moved to js/vr-grab-visionpro.js
  // To initialize Vision Pro support, import and call VRGS_setupXRGrabForVisionPro from
  // your entry point (e.g. js/main.js) when running on a Vision Pro device.

  xrHelper.input.onControllerAddedObservable.add((controller) => {
    const controllerId = controller.uniqueId;
    
    if (VRGS_processedControllers.has(controllerId)) {
      return;
    }
    
    VRGS_processedControllers.add(controllerId);
    const handedness = controller.inputSource?.handedness || "unknown";
    console.log(`🎮 ${handedness}控制器已连接`);
    
    // 只使用Gamepad轮询（最可靠）
    if (controller.inputSource && controller.inputSource.gamepad) {
      console.log(`✅ ${handedness}: 设置Gamepad抓取按钮轮询`);
      
      const gamepad = controller.inputSource.gamepad;
      let lastGrabButtonState = false;
      
      scene.onBeforeRenderObservable.add(() => {
        try {
          if (!gamepad.buttons || gamepad.buttons.length < 2) return;
          
          // 检查按钮[1]（通常是抓取按钮/squeeze）
          const grabButton = gamepad.buttons[1];
          if (!grabButton) return;
          
          const isPressed = grabButton.pressed || grabButton.value > 0.3;
          
          // 只在从松开到按下的状态变化时触发
          if (isPressed && !lastGrabButtonState) {
            console.log(`🎯 ${handedness}: 抓取按钮按下`);
            
            const pickInfo = performManualRayPick(controller, scene);
            
            if (pickInfo.hit && pickInfo.pickedMesh) {
              handleGrabInteraction(pickInfo.pickedMesh, scene, controller);
            }
          }
          
          lastGrabButtonState = isPressed;
        } catch (error) {
          console.error("❌ Gamepad轮询错误:", error);
        }
      });
    } else {
      console.log(`❌ ${handedness}: 没有gamepad，无法设置抓取`);
    }
    
    console.log(`✅ ${handedness}控制器设置完成`);
  });
  
  console.log("🎉 WebXR抓取系统初始化完成");
}

// ---------- exported helper: perform pick for a controller ----------
export function VRGS_performPickForController(controller, scene) {
  try {
    const pickInfo = performManualRayPick(controller, scene);
    if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
      handleGrabInteraction(pickInfo.pickedMesh, scene, controller);
      return true;
    }
  } catch (e) {
    console.error('❌ VRGS_performPickForController error:', e);
  }
  return false;
}

// ---------- exported helper: release grab (simple cleanup) ----------
export function VRGS_releaseGrabForController(controller) {
  try {
    if (!controller) return;
    const id = controller.uniqueId;
    if (VRGS_grabbedByController.has(id)) {
      VRGS_grabbedByController.delete(id);
      console.log(`🕊️ Released grabbed object for controller ${id}`);
    }
  } catch (e) {
    console.error('❌ VRGS_releaseGrabForController error:', e);
  }
}

// ======================================================================
// 增强版特效系统（确保可见）
// ======================================================================
function createPickupEffect(position, scene, type) {
  console.log(`🎆 创建${type}几何体特效...`);
  
  try {
    if (!scene || !position) {
      console.log("❌ 场景或位置无效");
      return null;
    }
    
    console.log(`📍 特效位置: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
    const effects = []; // 存储所有特效对象
    
    if (type === "star") {
      // 星星特效：金色光芒向外扩散
      console.log("🌟 创建星星特效...");
      
      // 1. 中心光球（快速膨胀消失）
      const centerGlow = BABYLON.MeshBuilder.CreateSphere("star_center_glow", {
        diameter: 0.5,
        segments: 16
      }, scene);
      centerGlow.position.copyFrom(position);
      
      const centerMat = new BABYLON.StandardMaterial("star_center_mat", scene);
      centerMat.diffuseColor = new BABYLON.Color3(1, 1, 0.7); // 淡金色
      centerMat.emissiveColor = new BABYLON.Color3(1, 1, 0.3); // 金色
      centerMat.alpha = 0.9;
      centerGlow.material = centerMat;
      
      effects.push(centerGlow);
      
      // 2. 光环（向外扩散）
      const ring = BABYLON.MeshBuilder.CreateTorus("star_ring", {
        diameter: 0.8,
        thickness: 0.05,
        tessellation: 32
      }, scene);
      ring.position.copyFrom(position);
      
      const ringMat = new BABYLON.StandardMaterial("star_ring_mat", scene);
      ringMat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.2); // 金色
      ringMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0); // 亮金色
      ringMat.alpha = 0.8;
      ring.material = ringMat;
      
      effects.push(ring);
      
      // 3. 多个小光球向外飞散（类似星星碎片）
      const fragmentCount = 12;
      const fragments = [];
      
      for (let i = 0; i < fragmentCount; i++) {
        const fragment = BABYLON.MeshBuilder.CreateSphere(`star_fragment_${i}`, {
          diameter: 0.15,
          segments: 8
        }, scene);
        fragment.position.copyFrom(position);
        
        const fragmentMat = new BABYLON.StandardMaterial(`star_fragment_mat_${i}`, scene);
        fragmentMat.diffuseColor = new BABYLON.Color3(1, 0.8 + Math.random() * 0.2, 0.2); // 金色系
        fragmentMat.emissiveColor = fragmentMat.diffuseColor.clone();
        fragmentMat.alpha = 0.9;
        fragment.material = fragmentMat;
        
        fragments.push(fragment);
        effects.push(fragment);
      }
      
      // 动画时间控制
      const startTime = Date.now();
      const duration = 1500; // 1.5秒
      
      const animateStarEffect = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress >= 1) {
          // 动画结束，清理所有几何体
          effects.forEach(effect => {
            if (effect && !effect.isDisposed) {
              try {
                effect.dispose();
              } catch(e) {}
            }
          });
          console.log("✅ 星星特效动画完成并清理");
          return;
        }
        
        // 1. 中心光球：快速膨胀并淡出
        const centerScale = 1 + progress * 3;
        const centerAlpha = 1 - progress * 1.5;
        centerGlow.scaling.setAll(centerScale);
        centerGlow.material.alpha = Math.max(0, centerAlpha);
        
        // 2. 光环：扩大并淡出
        const ringScale = 1 + progress * 2;
        const ringAlpha = 0.8 - progress * 1.2;
        ring.scaling.setAll(ringScale);
        ring.material.alpha = Math.max(0, ringAlpha);
        
        // 3. 碎片：向外飞散
        fragments.forEach((fragment, i) => {
          const angle = (i / fragmentCount) * Math.PI * 2;
          const distance = progress * 4; // 向外飞行距离
          const height = Math.sin(progress * Math.PI * 2 + i) * 0.5;
          
          fragment.position.x = position.x + Math.cos(angle) * distance;
          fragment.position.y = position.y + height;
          fragment.position.z = position.z + Math.sin(angle) * distance;
          
          // 碎片旋转
          fragment.rotation.x += 0.1;
          fragment.rotation.y += 0.15;
          
          // 碎片淡出
          fragment.material.alpha = 0.9 - progress * 1.2;
        });
        
        requestAnimationFrame(animateStarEffect);
      };
      
      animateStarEffect();
      
    } else if (type === "bomb") {
      // 炸弹特效：红色爆炸效果
      console.log("💣 创建炸弹特效...");
      
      // 1. 核心爆炸球体（快速膨胀）
      const coreExplosion = BABYLON.MeshBuilder.CreateSphere("bomb_core", {
        diameter: 0.6,
        segments: 16
      }, scene);
      coreExplosion.position.copyFrom(position);
      
      const coreMat = new BABYLON.StandardMaterial("bomb_core_mat", scene);
      coreMat.diffuseColor = new BABYLON.Color3(1, 0.3, 0.1); // 橙红色
      coreMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.2); // 亮橙红
      coreMat.alpha = 0.9;
      coreExplosion.material = coreMat;
      
      effects.push(coreExplosion);
      
      // 2. 爆炸冲击波（多个同心环）
      const waveCount = 3;
      const waves = [];
      
      for (let i = 0; i < waveCount; i++) {
        const wave = BABYLON.MeshBuilder.CreateTorus(`bomb_wave_${i}`, {
          diameter: 0.5 + i * 0.3,
          thickness: 0.03,
          tessellation: 24
        }, scene);
        wave.position.copyFrom(position);
        
        const waveMat = new BABYLON.StandardMaterial(`bomb_wave_mat_${i}`, scene);
        waveMat.diffuseColor = new BABYLON.Color3(1, 0.2 + i * 0.1, 0); // 红到橙
        waveMat.emissiveColor = waveMat.diffuseColor.clone();
        waveMat.alpha = 0.7 - i * 0.2;
        wave.material = waveMat;
        
        waves.push(wave);
        effects.push(wave);
      }
      
      // 3. 爆炸碎片（随机方向飞散）
      const debrisCount = 16;
      const debrisList = [];
      
      for (let i = 0; i < debrisCount; i++) {
        // 随机选择形状：立方体或四面体
        let debris;
        if (Math.random() > 0.5) {
          debris = BABYLON.MeshBuilder.CreateBox(`bomb_debris_${i}`, {
            size: 0.1 + Math.random() * 0.15
          }, scene);
        } else {
          debris = BABYLON.MeshBuilder.CreatePolyhedron(`bomb_debris_${i}`, {
            type: 1, // 四面体
            size: 0.08 + Math.random() * 0.1
          }, scene);
        }
        
        debris.position.copyFrom(position);
        
        const debrisMat = new BABYLON.StandardMaterial(`bomb_debris_mat_${i}`, scene);
        debrisMat.diffuseColor = new BABYLON.Color3(
          0.8 + Math.random() * 0.2, // 红
          Math.random() * 0.3,       // 少量绿
          Math.random() * 0.1        // 微量蓝
        );
        debrisMat.emissiveColor = debrisMat.diffuseColor.clone();
        debrisMat.alpha = 0.9;
        debris.material = debrisMat;
        
        // 随机旋转速度
        debris.userData = {
          rotSpeedX: (Math.random() - 0.5) * 0.3,
          rotSpeedY: (Math.random() - 0.5) * 0.3,
          rotSpeedZ: (Math.random() - 0.5) * 0.3,
          direction: new BABYLON.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5,
            (Math.random() - 0.5) * 2
          ).normalize()
        };
        
        debrisList.push(debris);
        effects.push(debris);
      }
      
      // 动画时间控制
      const startTime = Date.now();
      const duration = 1200; // 1.2秒，比星星短
      
      const animateBombEffect = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress >= 1) {
          // 动画结束，清理
          effects.forEach(effect => {
            if (effect && !effect.isDisposed) {
              try {
                effect.dispose();
              } catch(e) {}
            }
          });
          console.log("✅ 炸弹特效动画完成并清理");
          return;
        }
        
        // 1. 核心：快速膨胀然后收缩
        const corePulse = Math.sin(progress * Math.PI * 3); // 脉动效果
        const coreScale = 1 + progress * 2 + corePulse * 0.3;
        const coreAlpha = 0.9 - progress * 1.5;
        coreExplosion.scaling.setAll(coreScale);
        coreExplosion.material.alpha = Math.max(0, coreAlpha);
        
        // 2. 冲击波：向外扩散
        waves.forEach((wave, i) => {
          const waveDelay = i * 0.2; // 延迟启动
          const waveProgress = Math.max(0, (progress - waveDelay) / (1 - waveDelay));
          
          if (waveProgress > 0) {
            const waveScale = 1 + waveProgress * 4;
            const waveAlpha = (0.7 - i * 0.2) * (1 - waveProgress);
            
            wave.scaling.setAll(waveScale);
            wave.material.alpha = Math.max(0, waveAlpha);
            wave.isVisible = true;
          } else {
            wave.isVisible = false;
          }
        });
        
        // 3. 碎片：向外飞散
        debrisList.forEach((debris) => {
          const speed = 3 + Math.random() * 2;
          debris.position.x += debris.userData.direction.x * speed * progress * 0.05;
          debris.position.y += debris.userData.direction.y * speed * progress * 0.05;
          debris.position.z += debris.userData.direction.z * speed * progress * 0.05;
          
          // 旋转
          debris.rotation.x += debris.userData.rotSpeedX;
          debris.rotation.y += debris.userData.rotSpeedY;
          debris.rotation.z += debris.userData.rotSpeedZ;
          
          // 淡出
          debris.material.alpha = 0.9 - progress * 1.2;
        });
        
        requestAnimationFrame(animateBombEffect);
      };
      
      animateBombEffect();
    }
    
    console.log(`✅ ${type}几何体特效已创建`);
    return effects;
    
  } catch (error) {
    console.error(`❌ 创建${type}几何体特效失败:`, error);
    return null;
  }
}