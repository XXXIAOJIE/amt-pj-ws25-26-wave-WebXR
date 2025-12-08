// // ======================================================================
// // starfield-background.js — Starfield Skybox System
// // ======================================================================

// let starfieldSkybox = null;
// let starParticles = null;
// let nebulaTexture = null;

// // ======================================================================
// // Create Starfield Skybox
// // ======================================================================

// export function createStarfieldSkybox(scene) {
//   console.log("🌌 Creating starfield skybox");
  
//   // Create skybox mesh
//   starfieldSkybox = BABYLON.MeshBuilder.CreateBox("starfieldSkybox", { 
//     size: 1000,
//     sideOrientation: BABYLON.Mesh.BACKSIDE
//   }, scene);
  
//   // Create starfield material
//   const skyboxMaterial = createStarfieldMaterial(scene);
//   starfieldSkybox.material = skyboxMaterial;
//   starfieldSkybox.infiniteDistance = true;
//   starfieldSkybox.alwaysSelectAsActiveMesh = true;
  
//   // Make skybox follow camera
//   scene.onBeforeRenderObservable.add(() => {
//     if (starfieldSkybox && scene.activeCamera) {
//       starfieldSkybox.position.copyFrom(scene.activeCamera.position);
//     }
//   });
  
//   console.log("✅ Starfield skybox created");
//   return starfieldSkybox;
// }

// // ======================================================================
// // Create Starfield Material
// // ======================================================================

// function createStarfieldMaterial(scene) {
//   const material = new BABYLON.StandardMaterial("starfieldMaterial", scene);
//   material.backFaceCulling = false;
//   material.sideOrientation = BABYLON.Mesh.BACKSIDE;
  
//   // Dark space background
//   material.diffuseColor = new BABYLON.Color3(0.02, 0.03, 0.06);
//   material.specularColor = new BABYLON.Color3(0, 0, 0);
//   material.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.1);
  
//   // Disable lighting for the skybox
//   material.disableLighting = true;
  
//   // Try to load nebula texture (optional)
//   try {
//     nebulaTexture = new BABYLON.Texture("model/sky1/textures/nebula.jpeg", scene);
//     nebulaTexture.level = 0.15; // Very subtle
//     nebulaTexture.uScale = 4.0;
//     nebulaTexture.vScale = 4.0;
//     material.emissiveTexture = nebulaTexture;
//   } catch (e) {
//     console.log("ℹ️ No nebula texture, using pure starfield");
//   }
  
//   return material;
// }

// // ======================================================================
// // Create Star Particles
// // ======================================================================

// export function createStarParticles(scene, starCount = 3000) {
//   console.log(`✨ Creating ${starCount} star particles`);
  
//   // Create particle system for stars
//   starParticles = new BABYLON.ParticleSystem("stars", starCount, scene);
  
//   // Particle emitter at skybox center
//   starParticles.emitter = new BABYLON.Vector3(0, 0, 0);
//   starParticles.minEmitBox = new BABYLON.Vector3(-480, -480, -480);
//   starParticles.maxEmitBox = new BABYLON.Vector3(480, 480, 480);
  
//   // Star colors (white, blue, yellow stars)
//   starParticles.color1 = new BABYLON.Color4(1, 1, 1, 1);     // White stars
//   starParticles.color2 = new BABYLON.Color4(0.8, 0.9, 1, 1); // Blue stars
//   starParticles.color3 = new BABYLON.Color4(1, 1, 0.8, 1);   // Yellow stars
//   starParticles.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  
//   // Star sizes (different sizes for realism)
//   starParticles.minSize = 0.05;
//   starParticles.maxSize = 0.8;
  
//   // Permanent stars
//   starParticles.minLifeTime = Number.MAX_SAFE_INTEGER;
//   starParticles.maxLifeTime = Number.MAX_SAFE_INTEGER;
  
//   // Emit all stars at once
//   starParticles.emitRate = starCount;
//   starParticles.targetStopDuration = 0.05;
  
//   // Particle behavior (static stars)
//   starParticles.minEmitPower = 0;
//   starParticles.maxEmitPower = 0;
//   starParticles.updateSpeed = 0.001;
  
//   // Particle direction (random)
//   starParticles.direction1 = new BABYLON.Vector3(0, 0, 0);
//   starParticles.direction2 = new BABYLON.Vector3(0, 0, 0);
  
//   // Blend mode for better star appearance
//   starParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  
//   // Start the particle system
//   starParticles.start();
  
//   console.log(`✅ ${starCount} star particles created`);
//   return starParticles;
// }

// // ======================================================================
// // Create Twinkling Stars
// // ======================================================================

// export function createTwinklingStars(scene, twinkleCount = 500) {
//   console.log(`✨ Creating ${twinkleCount} twinkling stars`);
  
//   const twinkleParticles = new BABYLON.ParticleSystem("twinklingStars", twinkleCount, scene);
  
//   // Emitter in skybox
//   twinkleParticles.emitter = new BABYLON.Vector3(0, 0, 0);
//   twinkleParticles.minEmitBox = new BABYLON.Vector3(-490, -490, -490);
//   twinkleParticles.maxEmitBox = new BABYLON.Vector3(490, 490, 490);
  
//   // Twinkling colors (brighter variations)
//   twinkleParticles.color1 = new BABYLON.Color4(1, 1, 1, 0.8);
//   twinkleParticles.color2 = new BABYLON.Color4(0.9, 0.95, 1, 0.8);
//   twinkleParticles.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  
//   // Twinkling size variation
//   twinkleParticles.minSize = 0.1;
//   twinkleParticles.maxSize = 1.2;
  
//   // Twinkling effect (stars that fade in and out)
//   twinkleParticles.minLifeTime = 2;
//   twinkleParticles.maxLifeTime = 4;
  
//   // Slow emission rate for twinkling effect
//   twinkleParticles.emitRate = twinkleCount / 10;
  
//   // No movement
//   twinkleParticles.minEmitPower = 0;
//   twinkleParticles.maxEmitPower = 0;
//   twinkleParticles.updateSpeed = 0.02;
  
//   // Blend mode
//   twinkleParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  
//   // Random direction
//   twinkleParticles.direction1 = new BABYLON.Vector3(0, 0, 0);
//   twinkleParticles.direction2 = new BABYLON.Vector3(0, 0, 0);
  
//   twinkleParticles.start();
  
//   console.log(`✅ ${twinkleCount} twinkling stars created`);
//   return twinkleParticles;
// }

// // ======================================================================
// // Create Shooting Stars
// // ======================================================================

// export function createShootingStars(scene) {
//   console.log("☄️ Creating shooting stars effect");
  
//   const shootingStars = new BABYLON.ParticleSystem("shootingStars", 100, scene);
  
//   // Emitter at the "top" of the skybox
//   shootingStars.emitter = new BABYLON.Vector3(0, 400, 0);
//   shootingStars.minEmitBox = new BABYLON.Vector3(-300, 0, -300);
//   shootingStars.maxEmitBox = new BABYLON.Vector3(300, 10, 300);
  
//   // Shooting star color (bright with trail)
//   shootingStars.color1 = new BABYLON.Color4(1, 1, 1, 1);
//   shootingStars.color2 = new BABYLON.Color4(0.8, 0.9, 1, 0.5);
//   shootingStars.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  
//   // Shooting star size and life
//   shootingStars.minSize = 0.5;
//   shootingStars.maxSize = 2.0;
//   shootingStars.minLifeTime = 1;
//   shootingStars.maxLifeTime = 3;
  
//   // Very low emission rate (occasional shooting stars)
//   shootingStars.emitRate = 0.2; // One every 5 seconds on average
  
//   // Shooting stars move downward
//   shootingStars.minEmitPower = 50;
//   shootingStars.maxEmitPower = 100;
//   shootingStars.updateSpeed = 0.05;
  
//   // Direction (downward with some randomness)
//   shootingStars.direction1 = new BABYLON.Vector3(0, -1, 0);
//   shootingStars.direction2 = new BABYLON.Vector3(0.2, -1, 0.2);
  
//   // Gravity effect
//   shootingStars.gravity = new BABYLON.Vector3(0, -10, 0);
  
//   // Blend mode
//   shootingStars.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  
//   shootingStars.start();
  
//   console.log("✅ Shooting stars effect created");
//   return shootingStars;
// }

// // ======================================================================
// // Create Galaxy Effect
// // ======================================================================

// export function createGalaxyEffect(scene) {
//   console.log("🌠 Creating galaxy effect");
  
//   const galaxy = new BABYLON.ParticleSystem("galaxy", 2000, scene);
  
//   // Emitter in a disk shape (galaxy shape)
//   galaxy.emitter = new BABYLON.Vector3(0, 0, 0);
//   galaxy.createCylinderEmitter(300, 10, 0); // Disk shaped emitter
  
//   // Galaxy colors (purple, blue nebula colors)
//   galaxy.color1 = new BABYLON.Color4(0.4, 0.2, 0.6, 0.1); // Purple
//   galaxy.color2 = new BABYLON.Color4(0.2, 0.3, 0.6, 0.05); // Blue
//   galaxy.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  
//   // Galaxy particle properties
//   galaxy.minSize = 1.0;
//   galaxy.maxSize = 3.0;
//   galaxy.minLifeTime = Number.MAX_SAFE_INTEGER;
//   galaxy.maxLifeTime = Number.MAX_SAFE_INTEGER;
  
//   // Emission
//   galaxy.emitRate = 2000;
//   galaxy.targetStopDuration = 0.1;
  
//   // Very slow movement for galaxy particles
//   galaxy.minEmitPower = 0;
//   galaxy.maxEmitPower = 0.1;
//   galaxy.updateSpeed = 0.005;
  
//   // Direction (mostly in disk plane)
//   galaxy.direction1 = new BABYLON.Vector3(0, 0.01, 0);
//   galaxy.direction2 = new BABYLON.Vector3(0.01, 0.02, 0.01);
  
//   // Blend mode
//   galaxy.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
  
//   galaxy.start();
  
//   console.log("✅ Galaxy effect created");
//   return galaxy;
// }

// // ======================================================================
// // Create Complete Starfield System
// // ======================================================================

// export function createCompleteStarfield(scene, options = {}) {
//   const config = {
//     starCount: options.starCount || 4000,
//     twinkleCount: options.twinkleCount || 800,
//     enableShootingStars: options.enableShootingStars !== false,
//     enableGalaxy: options.enableGalaxy !== false,
//     enableTwinkling: options.enableTwinkling !== false
//   };
  
//   console.log("🌌 Creating complete starfield system:", config);
  
//   // Create main starfield skybox
//   const skybox = createStarfieldSkybox(scene);
  
//   // Create static stars
//   const stars = createStarParticles(scene, config.starCount);
  
//   // Additional effects
//   const effects = {};
  
//   if (config.enableTwinkling) {
//     effects.twinkling = createTwinklingStars(scene, config.twinkleCount);
//   }
  
//   if (config.enableShootingStars) {
//     effects.shootingStars = createShootingStars(scene);
//   }
  
//   if (config.enableGalaxy) {
//     effects.galaxy = createGalaxyEffect(scene);
//   }
  
//   return {
//     skybox,
//     stars,
//     effects,
//     config
//   };
// }

// // ======================================================================
// // Update Functions
// // ======================================================================

// // Rotate starfield (for animated sky)
// export function rotateStarfield(rotationSpeed = 0.00001) {
//   if (starfieldSkybox) {
//     starfieldSkybox.rotation.y += rotationSpeed;
//   }
// }

// // Set starfield brightness
// export function setStarfieldBrightness(brightness = 1.0) {
//   if (starfieldSkybox && starfieldSkybox.material) {
//     starfieldSkybox.material.emissiveColor.scaleToRef(brightness, starfieldSkybox.material.emissiveColor);
//   }
// }

// // Show/hide starfield
// export function setStarfieldVisible(visible) {
//   if (starfieldSkybox) {
//     starfieldSkybox.setEnabled(visible);
//     starfieldSkybox.isVisible = visible;
//   }
  
//   if (starParticles) {
//     if (visible) {
//       starParticles.start();
//     } else {
//       starParticles.stop();
//     }
//   }
// }

// // Clean up resources
// export function disposeStarfield() {
//   if (starfieldSkybox) {
//     starfieldSkybox.dispose();
//     starfieldSkybox = null;
//   }
  
//   if (starParticles) {
//     starParticles.dispose();
//     starParticles = null;
//   }
  
//   if (nebulaTexture) {
//     nebulaTexture.dispose();
//     nebulaTexture = null;
//   }
  
//   console.log("🧹 Starfield resources cleaned up");
// }