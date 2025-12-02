// js/ground.js - 优化的草地地面模块
class GrassGround {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = Object.assign({
            width: 100,
            height: 100,
            subdivisions: 100,
            positionY: -1.5,
            textureScale: 15,
            enablePhysics: true,
            enableDetails: false  // 暂时禁用粒子细节
        }, options);
        
        this.ground = null;
        this.initialized = false;
    }
    
    // 快速创建草地地面（简化版）
    async create() {
        try {
            // 1. 创建地面网格
            this.ground = BABYLON.MeshBuilder.CreateGround(
                "grassGround",
                {
                    width: this.options.width,
                    height: this.options.height,
                    subdivisions: this.options.subdivisions
                },
                this.scene
            );
            
            // 2. 设置位置
            this.ground.position.y = this.options.positionY;
            
            // 3. 创建并应用材质
            this.createGrassMaterial();
            
            // 4. 添加物理碰撞
            if (this.options.enablePhysics) {
                this.addPhysics();
            }
            
            this.initialized = true;
            console.log("✅ 草地地面创建完成");
            
            return this.ground;
            
        } catch (error) {
            console.error("❌ 地面创建失败:", error);
            // 使用备用方案
            return this.createFallbackGround();
        }
    }
    
    // 创建草地材质
    createGrassMaterial() {
        // 方法1：使用在线纹理
        const grassMat = new BABYLON.StandardMaterial("grassMat", this.scene);
        
        // 使用在线草地纹理（免费资源）
        const textures = {
        diffuse: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg",
        normal: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big-nm.jpg",
        specular: ""  // 留空使用默认
    };
        const diffuseTexture = new BABYLON.Texture(textures.diffuse, this.scene);
        diffuseTexture.uScale = this.options.textureScale;
        diffuseTexture.vScale = this.options.textureScale;
        grassMat.diffuseTexture = diffuseTexture;
        
        // 添加一些绿色色调
        grassMat.diffuseColor = new BABYLON.Color3(0.6, 0.8, 0.6);
        
        // 设置材质属性
        grassMat.specularPower = 32;
        grassMat.backFaceCulling = false;
        
        this.ground.material = grassMat;
    }
    
    // 添加物理碰撞体
    addPhysics() {
        // 确保物理引擎已启用
        if (!this.scene.isPhysicsEnabled()) {
            const gravity = new BABYLON.Vector3(0, -9.81, 0);
            this.scene.enablePhysics(gravity);
        }
        
        // 为地面添加物理碰撞体
        this.ground.physicsImpostor = new BABYLON.PhysicsImpostor(
            this.ground,
            BABYLON.PhysicsImpostor.BoxImpostor,
            {
                mass: 0,            // 质量为0表示静态物体
                restitution: 0.3,   // 弹性
                friction: 0.8       // 摩擦力
            },
            this.scene
        );
        
        console.log("✅ 物理碰撞体已添加");
    }
    
    // 备用方案：创建简单地面
    createFallbackGround() {
        console.log("使用备用地面方案");
        
        // 创建简单地面
        const ground = BABYLON.MeshBuilder.CreateGround(
            "fallbackGround",
            {
                width: this.options.width,
                height: this.options.height,
                subdivisions: 2
            },
            this.scene
        );
        
        ground.position.y = this.options.positionY;
        
        // 简单绿色材质
        const mat = new BABYLON.StandardMaterial("fallbackMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.3);
        ground.material = mat;
        
        // 添加物理
        ground.physicsImpostor = new BABYLON.PhysicsImpostor(
            ground,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0 }
        );
        
        this.ground = ground;
        return ground;
    }
    
    // 获取地面实例
    getMesh() {
        return this.ground;
    }
    
    // 动态调整地面大小
    resize(width, height) {
        if (!this.ground) return;
        
        this.ground.scaling.x = width / this.options.width;
        this.ground.scaling.z = height / this.options.height;
        
        this.options.width = width;
        this.options.height = height;
    }
}

// 全局导出
window.GrassGround = GrassGround;