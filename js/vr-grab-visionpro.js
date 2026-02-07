// vr-grab-visionpro.js
// Vision Pro / hand-tracking specific setup. This module imports the shared
// pick/release helpers from vr-grab-system so all pick logic stays in one place.

import { VRGS_performPickForController, VRGS_releaseGrabForController, VRGS_registerGlow, VRGS_highlightMesh, VRGS_clearHighlight } from './vr-grab-system.js';

export async function VRGS_setupXRGrabForVisionPro(xrHelper, scene) {
  console.log('🕶️ 初始化 Vision Pro 抓取模块');

  if (!xrHelper) {
    console.warn('⚠️ VRGS_setupXRGrabForVisionPro: 缺少 xrHelper');
    return;
  }

  // Create a small on-screen debug text block (one-time per scene) to show joint distance & pinch state
  try {
    if (!scene.__vpDebugUIInitialized && BABYLON && BABYLON.GUI) {
      const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('vpDebugUI', true, scene);
      const tb = new BABYLON.GUI.TextBlock();
      tb.text = '';
      tb.color = 'white';
      tb.fontSize = 14;
      tb.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      tb.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      tb.left = '10px';
      tb.top = '10px';
      tb.width = '300px';
      tb.height = '80px';
      tb.textWrapping = true;
      adt.addControl(tb);
      scene.__vpDebugUI = { adt, tb };
      scene.__vpDebugUIInitialized = true;
    }
  } catch (e) {
    // non-fatal
  }

  // Try enabling hand tracking (if supported by the runtime and browser).
  try {
    if (xrHelper.featuresManager && BABYLON.WebXRFeatureName && xrHelper.featuresManager.enableFeature) {
      try {
        await xrHelper.featuresManager.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, 'latest');
        console.log('🤚 尝试启用 HAND_TRACKING 特性');
      } catch (e) {
        console.warn('⚠️ 启用 HAND_TRACKING 失败，继续使用 select 事件作为回退', e);
      }
    }
  } catch (e) {
    console.warn('⚠️ 手部跟踪初始化异常，继续', e);
  }

  // 监听控制器/手的添加，绑定 select 事件（多数 runtimes 会把 pinch 映射到 select）
  xrHelper.input.onControllerAddedObservable.add((controller) => {
    const handedness = controller.inputSource?.handedness || 'unknown';
    console.log(`🤚 Vision Pro 输入已添加（${handedness}）`);

    // Prefer select events if runtime maps pinch -> select
    controller.onSelectStartObservable.add(() => {
      try {
        console.log('🔵 Vision Pro select start (pinch)');
        VRGS_performPickForController(controller, scene);
      } catch (e) {
        console.error('❌ VisionPro performPick error', e);
      }
    });

    controller.onSelectEndObservable.add(() => {
      try {
        console.log('⚪ Vision Pro select end (unpinch)');
        VRGS_releaseGrabForController(controller);
      } catch (e) {
        console.error('❌ VisionPro releaseGrab error', e);
      }
    });

    // If hand-tracking joint API is available, add a joint-distance fallback for pinch detection
    try {
      const inputSource = controller.inputSource;
      if (inputSource && inputSource.hand && xrHelper.baseExperience && xrHelper.baseExperience.session) {
        // try to acquire a reference space for joint poses
        xrHelper.baseExperience.session.requestReferenceSpace('local').then((refSpace) => {
          console.log('📐 VisionPro: got reference space for joint poses');

          let lastPinchState = false;

          const pinchThreshold = 0.035; // meters (3.5 cm)

          const onXRFrame = (time, xrFrame) => {
            try {
              // joints are XRJointSpaces exposed on inputSource.hand (a map-like object)
              const hand = inputSource.hand;
              const indexTip = hand.get && hand.get('index-finger-tip');
              const thumbTip = hand.get && hand.get('thumb-tip');

              if (indexTip && thumbTip && xrFrame) {
                const indexPose = xrFrame.getJointPose(indexTip, refSpace);
                const thumbPose = xrFrame.getJointPose(thumbTip, refSpace);

                if (indexPose && thumbPose && indexPose.transform && thumbPose.transform) {
                  const ix = indexPose.transform.position.x;
                  const iy = indexPose.transform.position.y;
                  const iz = indexPose.transform.position.z;
                  const tx = thumbPose.transform.position.x;
                  const ty = thumbPose.transform.position.y;
                  const tz = thumbPose.transform.position.z;

                  const dx = ix - tx;
                  const dy = iy - ty;
                  const dz = iz - tz;
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                  const isPinching = dist <= pinchThreshold;

                  // update debug UI if present
                  try {
                    if (scene.__vpDebugUI && scene.__vpDebugUI.tb) {
                      scene.__vpDebugUI.tb.text = `hand: ${handedness}\nthumb-index: ${dist.toFixed(3)} m\npinch: ${isPinching ? 'YES' : 'no'}\nthreshold: ${pinchThreshold} m`;
                    }
                  } catch (e) {}

                  if (isPinching && !lastPinchState) {
                    // pinch start
                    console.log(`🤏 VisionPro pinch detected (dist=${dist.toFixed(3)}m)`);
                    try { VRGS_performPickForController(controller, scene); } catch (e) { console.error(e); }
                  } else if (!isPinching && lastPinchState) {
                    // pinch end
                    console.log(`✋ VisionPro pinch released (dist=${dist.toFixed(3)}m)`);
                    try { VRGS_releaseGrabForController(controller); } catch (e) { console.error(e); }
                  }

                  lastPinchState = isPinching;
                }
              }
            } catch (e) {
              // silent fail: fall back to select events
            }

            // queue next frame
            try {
              xrHelper.baseExperience.session.requestAnimationFrame(onXRFrame);
            } catch (e) {
              // session may have ended
            }
          };

          // start frame loop
          try {
            xrHelper.baseExperience.session.requestAnimationFrame(onXRFrame);
            console.log('🔁 VisionPro joint-based pinch monitor started');
          } catch (e) {
            console.warn('⚠️ Unable to start XR frame loop for joint monitoring', e);
          }
        }).catch((err) => {
          console.warn('⚠️ Unable to get reference space for joint poses:', err);
        });
      }
    } catch (e) {
      console.warn('⚠️ VisionPro joint-distance fallback setup failed, relying on select events', e);
    }
  });

  console.log('✅ Vision Pro 抓取模块初始化完成（使用 select 事件作为 pinch 回调）');

  // Gaze highlighting: raycast from XR camera forward each frame and highlight stars
  try {
    scene.onBeforeRenderObservable.add(() => {
      try {
        const xrCamera = xrHelper.baseExperience && xrHelper.baseExperience.camera;
        if (!xrCamera) return;
        // get forward ray from camera
        let ray = null;
        if (typeof xrCamera.getForwardRay === 'function') {
          ray = xrCamera.getForwardRay(10);
        } else {
          // fallback: construct ray from position + forward
          const origin = xrCamera.position.clone();
          const forward = xrCamera.getForward ? xrCamera.getForward(1) : new BABYLON.Vector3(0,0,1);
          ray = new BABYLON.Ray(origin, forward, 10);
        }

        const pickInfo = scene.pickWithRay(ray, (m) => {
          return m && m.metadata && m.metadata.vr_grabbable && m.metadata.isActive;
        });

        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
          try { VRGS_highlightMesh(pickInfo.pickedMesh); } catch(e) {}
        } else {
          try { VRGS_clearHighlight(); } catch(e) {}
        }
      } catch (e) {
        // ignore per-frame errors
      }
    });
  } catch (e) {
    console.warn('⚠️ Unable to install gaze highlight observer', e);
  }
}
