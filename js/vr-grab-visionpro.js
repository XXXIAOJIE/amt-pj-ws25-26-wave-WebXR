// vr-grab-visionpro.js
// Vision Pro / hand-tracking specific setup. This module imports the shared
// pick/release helpers from vr-grab-system so all pick logic stays in one place.

import { VRGS_performPickForController, VRGS_releaseGrabForController, VRGS_registerGlow } from './vr-grab-system.js';

export async function VRGS_setupXRGrabForVisionPro(xrHelper, scene) {
  console.log('🕶️ 初始化 Vision Pro 抓取模块');

  if (!xrHelper) {
    console.warn('⚠️ VRGS_setupXRGrabForVisionPro: 缺少 xrHelper');
    return;
  }

  // 尝试启用手部跟踪（如果运行时和浏览器支持）
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

    // select start -> perform pick (pinch start)
    controller.onSelectStartObservable.add(() => {
      try {
        console.log('🔵 Vision Pro select start (pinch)');
        VRGS_performPickForController(controller, scene);
      } catch (e) {
        console.error('❌ VisionPro performPick error', e);
      }
    });

    // select end -> release grab (pinch release)
    controller.onSelectEndObservable.add(() => {
      try {
        console.log('⚪ Vision Pro select end (unpinch)');
        VRGS_releaseGrabForController(controller);
      } catch (e) {
        console.error('❌ VisionPro releaseGrab error', e);
      }
    });
  });

  console.log('✅ Vision Pro 抓取模块初始化完成（使用 select 事件作为 pinch 回调）');
}
