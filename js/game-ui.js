// game-ui.js - 3D VR UI (top-left HUD version)

let GUI_guiTexture = null;
let GUI_elements = {};
let GUI_lastFpsUpdate = 0;
let GUI_uiPlane = null;
let GUI_domHUD = null; // DOM overlay for desktop HUD

function createHoverButton(name, text, normalColor, hoverColor, width, height) {
  const button = BABYLON.GUI.Button.CreateSimpleButton(name, text);
  button.width = width;
  button.height = height;
  button.color = "white";
  button.fontSize = 24;
  button.fontWeight = "bold";
  button.background = normalColor;
  button.cornerRadius = 10;
  button.paddingTop = "10px";
  button.paddingBottom = "10px";

  if (button.onPointerEnterObservable && button.onPointerEnterObservable.add) {
    button.onPointerEnterObservable.add(() => {
      button.background = hoverColor;
    });
  }

  if (button.onPointerLeaveObservable && button.onPointerLeaveObservable.add) {
    button.onPointerLeaveObservable.add(() => {
      button.background = normalColor;
    });
  }

  return button;
}

// ======================================================================
// Create 3D VR UI
// ======================================================================

export function GUI_initUI(scene) {
  console.log("✅ Creating 3D VR UI (top-left HUD)");

  // 平面尺寸
  const PLANE_WIDTH = 1.0;   // meter
  const PLANE_HEIGHT = 0.6;  // meter

GUI_uiPlane = BABYLON.MeshBuilder.CreatePlane("VRUIPlane", {
    width: PLANE_WIDTH,
    height: PLANE_HEIGHT
}, scene);

// SMALLER GUI TEXTURE → MUCH BIGGER TEXT
GUI_guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
    GUI_uiPlane,
    800, 450
);

// Panel matches new texture size
const backgroundPanel = new BABYLON.GUI.StackPanel();
backgroundPanel.width = "700px";
backgroundPanel.height = "400px";
  backgroundPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  backgroundPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  backgroundPanel.background = "rgba(0, 0, 0, 0.7)";
  backgroundPanel.cornerRadius = 10;
  backgroundPanel.paddingTop = "20px";
  backgroundPanel.paddingLeft = "20px";

  // Game title
  const title = new BABYLON.GUI.TextBlock();
  title.text = "Grab Stars";
  title.color = "gold";
  title.fontSize = 40;
  title.fontWeight = "bold";
  title.fontFamily = "Arial";
  title.height = "60px";
  title.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // FPS display
  const fpsText = new BABYLON.GUI.TextBlock();
  fpsText.text = "FPS: 60";
  fpsText.color = "lightgreen";
  fpsText.fontSize = 26;
  fpsText.height = "40px";
  fpsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // Score display
  const scoreText = new BABYLON.GUI.TextBlock();
  scoreText.text = "Score: 0";
  scoreText.color = "white";
  scoreText.fontSize = 30;
  scoreText.fontWeight = "bold";
  scoreText.height = "50px";
  scoreText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // Time display
  const timeText = new BABYLON.GUI.TextBlock();
  timeText.text = "Time left: 60s";
  timeText.color = "cyan";
  timeText.fontSize = 28;
  timeText.height = "45px";
  timeText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // Start button (larger for VR)
  const startButton = createHoverButton(
    "startButton",
    "▶ Start",
    "green",
    "darkgreen",
    "260px",
    "70px"
  );
  startButton.fontSize = 26;
  startButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  startButton.top = "10px";

  // Status display
  const statusText = new BABYLON.GUI.TextBlock();
  statusText.text = "Status: Waiting";
  statusText.color = "orange";
  statusText.fontSize = 24;
  statusText.height = "40px";
  statusText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

  // Add all elements to panel
  backgroundPanel.addControl(title);
  backgroundPanel.addControl(fpsText);
  backgroundPanel.addControl(scoreText);
  backgroundPanel.addControl(timeText);
  backgroundPanel.addControl(startButton);
  backgroundPanel.addControl(statusText);

  GUI_guiTexture.addControl(backgroundPanel);

  // Save element references
  GUI_elements = {
    title,
    fpsText,
    scoreText,
    timeText,
    startButton,
    statusText,
    backgroundPanel
  };

  // --- Create a simple DOM HUD for desktop mode ---
  try {
    if (!document.getElementById("desktop-hud")) {
      GUI_domHUD = document.createElement("div");
      GUI_domHUD.id = "desktop-hud";
      GUI_domHUD.style.position = "fixed";
      GUI_domHUD.style.left = "12px";
      GUI_domHUD.style.top = "12px";
      GUI_domHUD.style.zIndex = "9999";
      GUI_domHUD.style.padding = "10px 14px";
      GUI_domHUD.style.background = "rgba(0,0,0,0.6)";
      GUI_domHUD.style.color = "white";
      GUI_domHUD.style.fontFamily = "Arial, sans-serif";
      GUI_domHUD.style.borderRadius = "8px";
      GUI_domHUD.style.minWidth = "140px";
      GUI_domHUD.style.pointerEvents = "none"; // let clicks pass through by default

      const titleEl = document.createElement("div");
      titleEl.textContent = "Grab Stars";
      titleEl.style.fontWeight = "bold";
      titleEl.style.marginBottom = "6px";
      GUI_domHUD.appendChild(titleEl);

      const scoreEl = document.createElement("div");
      scoreEl.id = "desktop-hud-score";
      scoreEl.textContent = "Score: 0";
      scoreEl.style.fontSize = "18px";
      scoreEl.style.marginBottom = "4px";
      GUI_domHUD.appendChild(scoreEl);

      const timeEl = document.createElement("div");
      timeEl.id = "desktop-hud-time";
      timeEl.textContent = "Time: 60s";
      timeEl.style.fontSize = "14px";
      GUI_domHUD.appendChild(timeEl);

      document.body.appendChild(GUI_domHUD);
    }
  } catch (e) {
    console.warn("Could not create desktop HUD:", e);
  }

  console.log("✅ 3D VR UI created (HUD top-left)");

  return {
    startButton,
    GUI_elements,
    uiPlane: GUI_uiPlane
  };
}

// ======================================================================
// VR UI Position — anchor to TOP-LEFT of view
// ======================================================================
export function GUI_positionUIFrontOfCamera(
  camera,
  distance = 2,
  height = 1.7
) {
  if (!GUI_uiPlane || !camera) return;

  // 前方方向 & 右方向
  const forward = camera.getForwardRay().direction;
  const right = camera.getDirection(new BABYLON.Vector3(1, 0, 0));
  const up = new BABYLON.Vector3(0, 1, 0);

  // 左 / 上 偏移量（负 right = 左）
  const sideOffset = -0.9;    // 往左一点
  const verticalOffset = 0.4; // 略高于视线

  const pos = camera.position
    .add(forward.scale(distance))
    .add(right.scale(sideOffset))
    .add(up.scale(verticalOffset));

  GUI_uiPlane.position.copyFrom(pos);
  // 方向由 billboardMode 负责，不再手动 lookAt，避免翻转
}

// Show/hide UI
export function GUI_setUIVisible(visible) {
  if (GUI_uiPlane) {
    GUI_uiPlane.setEnabled(visible);
    GUI_uiPlane.isVisible = visible;
  }

  // Toggle DOM HUD: show when 3D UI is hidden (desktop), hide when in VR
  if (GUI_domHUD) {
    GUI_domHUD.style.display = visible ? "none" : "block";
  }
}

// ======================================================================
// UI Update Functions
// ======================================================================

export function GUI_updateFPS(fps) {
  if (!GUI_elements.fpsText) return;

  const now = Date.now();
  if (now - GUI_lastFpsUpdate > 500) {
    GUI_elements.fpsText.text = `FPS: ${Math.round(fps)}`;
    GUI_lastFpsUpdate = now;
    // update DOM HUD too
    try {
      const el = document.getElementById("desktop-hud");
      if (el) {
        // add fps if not present
        let fpsEl = document.getElementById("desktop-hud-fps");
        if (!fpsEl) {
          fpsEl = document.createElement("div");
          fpsEl.id = "desktop-hud-fps";
          fpsEl.style.fontSize = "12px";
          fpsEl.style.marginTop = "6px";
          el.appendChild(fpsEl);
        }
        fpsEl.textContent = `FPS: ${Math.round(fps)}`;
      }
    } catch (e) {}
  }
}

export function GUI_updateScore(score) {
  if (GUI_elements.scoreText) {
    GUI_elements.scoreText.text = `Score: ${score}`;

    const originalFontSize = GUI_elements.scoreText.fontSize;
    GUI_elements.scoreText.fontSize = originalFontSize + 8;
    GUI_elements.scoreText.color = "#FFD700";

    setTimeout(() => {
      if (GUI_elements.scoreText) {
        GUI_elements.scoreText.fontSize = originalFontSize;
        GUI_elements.scoreText.color = "white";
      }
    }, 300);
  }

  // Update DOM HUD score
  try {
    const s = document.getElementById("desktop-hud-score");
    if (s) s.textContent = `Score: ${score}`;
  } catch (e) {}
}

export function GUI_updateTime(seconds) {
  if (GUI_elements.timeText) {
    const secs = Math.max(0, Math.floor(seconds));
    GUI_elements.timeText.text = `Time left: ${secs}s`;

    if (secs <= 10) {
      GUI_elements.timeText.color = "red";
      GUI_elements.timeText.fontWeight = "bold";
    } else {
      GUI_elements.timeText.color = "cyan";
      GUI_elements.timeText.fontWeight = "normal";
    }
  }

  // Update DOM HUD time
  try {
    const t = document.getElementById("desktop-hud-time");
    if (t) t.textContent = `Time: ${Math.max(0, Math.floor(seconds))}s`;
  } catch (e) {}
}

export function GUI_updateGameStatus(isStarted) {
  if (GUI_elements.statusText) {
    if (isStarted) {
      GUI_elements.statusText.text = "Status: Playing";
      GUI_elements.statusText.color = "lightgreen";

      if (GUI_elements.startButton) {
        GUI_elements.startButton.textBlock.text = "⏸️ Pause";
        GUI_elements.startButton.background = "orange";
      }
    } else {
      GUI_elements.statusText.text = "Status: Waiting";
      GUI_elements.statusText.color = "orange";

      if (GUI_elements.startButton) {
        GUI_elements.startButton.textBlock.text = "▶ Start";
        GUI_elements.startButton.background = "green";
      }
    }
  }

  // Update DOM HUD status color / small hint
  try {
    const el = document.getElementById("desktop-hud");
    if (el) {
      el.style.border = isStarted ? "2px solid rgba(0,255,0,0.25)" : "none";
    }
  } catch (e) {}
}

export function GUI_showGameOver(finalScore) {
  const gameOverPanel = new BABYLON.GUI.Rectangle();
  gameOverPanel.width = "600px";
  gameOverPanel.height = "400px";
  gameOverPanel.background = "rgba(0, 0, 0, 0.8)";
  gameOverPanel.cornerRadius = 20;
  gameOverPanel.thickness = 3;
  gameOverPanel.color = "gold";
  gameOverPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  gameOverPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  gameOverPanel.zIndex = 100;

  const stackPanel = new BABYLON.GUI.StackPanel();
  stackPanel.paddingTop = "40px";

  const gameOverText = new BABYLON.GUI.TextBlock();
  gameOverText.text = "🎮 Game Over!";
  gameOverText.color = "gold";
  gameOverText.fontSize = 48;
  gameOverText.fontWeight = "bold";
  gameOverText.height = "80px";

  const finalScoreText = new BABYLON.GUI.TextBlock();
  finalScoreText.text = `Final Score: ${finalScore}`;
  finalScoreText.color = "white";
  finalScoreText.fontSize = 40;
  finalScoreText.fontWeight = "bold";
  finalScoreText.height = "60px";

  const restartButton = createHoverButton(
    "restartButton",
    "🔄 Restart",
    "blue",
    "darkblue",
    "250px",
    "60px"
  );
  restartButton.marginTop = "40px";

  stackPanel.addControl(gameOverText);
  stackPanel.addControl(finalScoreText);
  stackPanel.addControl(restartButton);
  gameOverPanel.addControl(stackPanel);

  GUI_guiTexture.addControl(gameOverPanel);

  GUI_elements.gameOverPanel = gameOverPanel;

  return restartButton;
}

export function GUI_removeGameOver() {
  if (GUI_elements.gameOverPanel) {
    GUI_guiTexture.removeControl(GUI_elements.gameOverPanel);
    delete GUI_elements.gameOverPanel;
  }
}
