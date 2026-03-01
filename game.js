    // Single Scene combining Vehicle Physics and Battery Merge Game
    class GameScene extends Phaser.Scene {
        constructor() {
            super('GameScene');
        }

        init() {
            // Vehicle properties
            this.vehicle = null;
            this.boxes = []; // Array to hold multiple boxes
            this.isForward = false;
            this.isReverse = false;
            
            // Engine sound properties
            this.engineSound = null;
            this.isEngineRunning = false;
            this.currentPlaybackRate = CONFIG.AUDIO.ENGINE_IDLE_RATE;
            this.targetPlaybackRate = CONFIG.AUDIO.ENGINE_IDLE_RATE;
            this.currentVolume = CONFIG.AUDIO.ENGINE_IDLE_VOLUME;
            this.targetVolume = CONFIG.AUDIO.ENGINE_IDLE_VOLUME;
            
            // Charging system properties
            this.chargingSlots = [null, null, null]; // 3 slots for batteries
            this.chargingSlotsUI = [];
            this.carCharge = 0;
            this.maxCharge = 100;
            this.chargingInterval = null;
            this.firstBatteryTime = null;
            this.chargeCycleActive = false;
            this.lastChargeCycle = 0;
            
            // Merge Scene properties
            this.coins = 1000;
            this.grid = Array(3).fill(null).map(() => Array(3).fill(null)); // 3x3 grid
            this.gridCells = [];
            this.batteries = [];
            this.draggingBattery = null;
            this.hasStartedPlaying = false;
            this.spawnButtonLevel = CONFIG.BATTERY_START_LEVEL;
            this.spawnCost = 10;
            this.highestBatteryLevel = CONFIG.BATTERY_START_LEVEL;
            this.levelUpTimer = null;
            this.levelUpButtonVisible = false;
            this.levelUpButtonShowTime = null;
            this.firstLevelUpTimer = true;
            this.mergeTutorialShown = false;
            this.mergePointer = null;  // Hand animation for merge tutorial
            
            // Grid layout constants (can be overridden by CONFIG.CELL)
            this.CELL_SIZE = CONFIG.CELL.SIZE;
            this.CELL_GAP = CONFIG.CELL.GAP;
            this.CELL_RADIUS = CONFIG.CELL.RADIUS;
            this.GRID_COLS = 3;
            this.GRID_ROWS = 3;
        }

        preload() {
            // Load vehicle assets
            this.load.image('chassis', 'graphics/chassis.png');
            this.load.image('tire', 'graphics/tire.png');
            this.load.image('ground', 'graphics/ground.png');
            
            // Load battery images with extension fallback (from pre-initialized cache)
            loadBatteryImagesFromCache(this, 20);
            
            this.load.image('coin', 'graphics/coin.svg');
            this.load.image('point', 'graphics/point.png');
            this.load.image('button', 'graphics/Button.png');
            
            // Load charging effect
            this.load.image('bolt', 'graphics/bolt_64.png');
            
            // Load engine sound
            this.load.audio('car_idle', 'sounds/car_idle.wav');
        }

        create() {
            // Get scene dimensions
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Add vehicle section background (top half) - same color as merge section
            this.add.rectangle(sceneWidth / 2, sceneHeight * 0.25, sceneWidth, sceneHeight * 0.5, 0xEEF5F8);
            
            // Add merge section background (bottom half)
            this.add.rectangle(sceneWidth / 2, sceneHeight * 0.75, sceneWidth, sceneHeight * 0.5, 0xEEF5F8);
            
            // Create world bounds
            this.matter.world.setBounds(0, 0, sceneWidth, sceneHeight);
            this.matter.world.setGravity(0, CONFIG.PHYSICS.GRAVITY_Y);
            
            // Create thin ground using ground tiles
            this.createThinGround();
            
            // Create 3 charging slots below ground
            this.createChargingSlots();
            
            // Create vehicle with spring suspension
            this.createVehicle();
            
            // Create pushable box
            this.createBox();
            
            // Create charge bar UI
            this.createChargeBar();
            
            // Setup keyboard controls
            this.cursors = this.input.keyboard.createCursorKeys();
            
            // Setup camera
            this.cameras.main.setBounds(0, 0, sceneWidth, sceneHeight);
            this.cameras.main.scrollX = 0;
            this.cameras.main.scrollY = 0;
            
            // Setup engine sound
            this.setupEngineSound();
            
            // Setup drag and drop for batteries
            this.setupBatteryDropZones();
            
            // Start engine automatically
            this.startEngine();
            
            // Create 3x3 grid (must be before coin display to calculate grid position)
            this.createGrid();
            
            // Create coin display (positioned relative to grid)
            this.createCoinDisplay();
            
            // Spawn initial battery in grid
            this.spawnBatteryInGrid(0, 0, CONFIG.BATTERY_START_LEVEL);
            
            // Create spawn button and level-up button
            this.createButtons();
            
            // Show initial overlay
            this.createStartOverlay();
            
            // Setup input handlers for drag and drop
            this.input.on('dragstart', this.onDragStart, this);
            this.input.on('drag', this.onDrag, this);
            this.input.on('dragend', this.onDragEnd, this);
        }

        createThinGround() {
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Thin ground positioned in upper section
            const groundY = sceneHeight * 0.35; // Position ground at 35% height
            const groundHeight = 20;
            const tileWidth = 64; // Width of ground tile
            
            // Create ground tiles horizontally
            const numTiles = Math.ceil(sceneWidth / tileWidth) + 1;
            for (let i = 0; i < numTiles; i++) {
                const tile = this.add.image(i * tileWidth, groundY, 'ground');
                tile.setOrigin(0, 0.5);
                tile.setDisplaySize(tileWidth, groundHeight);
                tile.setDepth(20);
            }
            
            // Create thin physics body for ground
            this.groundBody = this.matter.add.rectangle(
                sceneWidth / 2,
                groundY,
                sceneWidth,
                groundHeight,
                {
                    isStatic: true,
                    friction: 0.8,
                    restitution: 0,
                    render: {
                        visible: CONFIG.PHYSICS.DEBUG_GROUND_COLLIDER,
                        lineColor: 0x00FF00,
                        lineWidth: 2
                    }
                }
            );
            
            this.groundY = groundY;
        }
        
        createChargingSlots() {
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Position slots below where ground will be
            const slotY = sceneHeight * 0.35 + 120; // Below ground
            const slotSize = 100; // Same as grid cells
            const slotGap = 15; // Same as grid cell gap
            const totalWidth = 3 * slotSize + 2 * slotGap;
            const startX = (sceneWidth - totalWidth) / 2;
            
            for (let i = 0; i < 3; i++) {
                const slotX = startX + i * (slotSize + slotGap) + slotSize / 2;
                
                // Slot background (rounded rectangle)
                const slotBg = this.add.graphics();
                slotBg.lineStyle(4, 0x6B9BD1, 1);
                slotBg.strokeRoundedRect(
                    slotX - slotSize / 2,
                    slotY - slotSize / 2,
                    slotSize,
                    slotSize,
                    15
                );
                
                // Slot filled background (hidden initially)
                const slotFilledBg = this.add.graphics();
                slotFilledBg.fillStyle(0x8BC6EC, 1);
                slotFilledBg.fillRoundedRect(
                    slotX - slotSize / 2,
                    slotY - slotSize / 2,
                    slotSize,
                    slotSize,
                    15
                );
                slotFilledBg.setVisible(false);
                
                // Charge rate text (above slot, hidden initially)
                const chargeText = this.add.text(slotX, slotY - slotSize / 2 - 20, '', {
                    fontSize: '18px',
                    fontFamily: CONFIG.FONT_FAMILY,
                    color: '#2C5F8D',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setVisible(false);
                
                // Drop zone for batteries
                const dropZone = this.add.zone(slotX, slotY, slotSize, slotSize);
                dropZone.setRectangleDropZone(slotSize, slotSize);
                dropZone.setData('slotIndex', i);
                
                this.chargingSlotsUI.push({
                    x: slotX,
                    y: slotY,
                    slotBg: slotBg,
                    slotFilledBg: slotFilledBg,
                    chargeText: chargeText,
                    dropZone: dropZone,
                    batterySprite: null,
                    batteryLevelText: null
                });
            }
        }
        
        createChargeBar() {
            const sceneWidth = this.cameras.main.width;
            
            // Charge bar at top-center
            const barWidth = 250;
            const barHeight = 28;
            const barX = sceneWidth / 2;
            const barY = 35;
            
            // Background
            this.chargeBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x333333);
            this.chargeBarBg.setStrokeStyle(3, 0x000000);
            
            // Charge fill
            this.chargeBarFill = this.add.rectangle(
                barX - barWidth / 2,
                barY,
                0,
                barHeight - 6,
                0x4CAF50
            );
            this.chargeBarFill.setOrigin(0, 0.5);
            
            // Text
            this.chargeText = this.add.text(barX, barY, '⚡ 0/100', {
                fontSize: '18px',
                fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            this.chargeBarBg.setDepth(500);
            this.chargeBarFill.setDepth(501);
            this.chargeText.setDepth(502);
        }
        
        setupBatteryDropZones() {
            // This will be used to handle drag/drop from MergeScene
            // For now, we'll use a simple click mechanism to add batteries for testing
            this.input.on('drop', (pointer, gameObject, dropZone) => {
                if (dropZone.getData('slotIndex') !== undefined) {
                    this.handleBatteryDrop(gameObject, dropZone.getData('slotIndex'));
                }
            });
        }
        
        // Method to add battery to charging slot (can be called from MergeScene)
        addBatteryToSlot(slotIndex, level) {
            if (slotIndex < 0 || slotIndex >= 3) return;
            if (this.chargingSlots[slotIndex] !== null) {
                // Slot already occupied
                return;
            }
            
            const slot = this.chargingSlotsUI[slotIndex];
            const chargePerMinute = level * 5;
            
            // Determine which battery icon to use (dynamically uses highest available)
            const batteryIconLevel = getBatteryIconLevel(level);
            const batteryIcon = `battery${batteryIconLevel}`;
            
            // Create battery sprite in slot (using same offset as grid cells)
            const batterySprite = this.add.image(slot.x, slot.y + CONFIG.CELL.BATTERY_Y_OFFSET, batteryIcon).setScale(CONFIG.CELL.BATTERY_SCALE);
            
            // Make battery draggable
            const hitArea = new Phaser.Geom.Rectangle(
                -50,
                -50,
                100,
                100
            );
            batterySprite.setInteractive({
                hitArea: hitArea,
                hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                draggable: true,
                useHandCursor: true
            });
            
            // Level text at top (using same offset as grid cells)
            const levelText = this.add.text(slot.x, slot.y + CONFIG.CELL.BATTERY_Y_OFFSET + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET, `LVL ${level}`, {
                fontSize: CONFIG.CELL.LEVEL_TEXT_SIZE,
                fontFamily: CONFIG.FONT_FAMILY,
                color: CONFIG.CELL.LEVEL_TEXT_COLOR,
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            // Show charge rate
            slot.chargeText.setText(`${chargePerMinute}`);
            slot.chargeText.setVisible(true);
            slot.slotFilledBg.setVisible(true);
            
            // Store battery data
            slot.batterySprite = batterySprite;
            slot.batteryLevelText = levelText;
            
            // Create battery data object
            const batteryData = {
                sprite: batterySprite,
                levelText: levelText,
                level: level,
                slotIndex: slotIndex,
                originalX: slot.x,
                originalY: slot.y + CONFIG.CELL.BATTERY_Y_OFFSET,
                inGrid: false,
                inChargingSlot: true
            };
            
            batterySprite.setData('batteryData', batteryData);
            
            this.chargingSlots[slotIndex] = {
                level: level,
                chargePerMinute: chargePerMinute,
                batteryData: batteryData
            };
            
            // Start charging if this is the first battery
            this.updateChargingSystem();
        }
        
        removeBatteryFromSlot(slotIndex) {
            if (slotIndex < 0 || slotIndex >= 3) return;
            if (this.chargingSlots[slotIndex] === null) return;
            
            const slot = this.chargingSlotsUI[slotIndex];
            
            // Remove UI elements
            if (slot.batterySprite) slot.batterySprite.destroy();
            if (slot.batteryLevelText) slot.batteryLevelText.destroy();
            
            slot.batterySprite = null;
            slot.batteryLevelText = null;
            slot.chargeText.setVisible(false);
            slot.slotFilledBg.setVisible(false);
            
            this.chargingSlots[slotIndex] = null;
            
            // Update charging system
            this.updateChargingSystem();
        }
        
        updateChargingSystem() {
            // Check if all slots are empty
            const allEmpty = this.chargingSlots.every(slot => slot === null);
            
            if (allEmpty) {
                // Stop charging
                if (this.chargingInterval) {
                    this.chargingInterval.remove();
                    this.chargingInterval = null;
                }
                this.firstBatteryTime = null;
                this.chargeCycleActive = false;
                return;
            }
            
            // Start charging if not already started
            if (!this.chargingInterval) {
                // Set first battery time
                this.firstBatteryTime = this.time.now;
                this.chargeCycleActive = false;
                
                // Start charging loop (check every 100ms)
                this.chargingInterval = this.time.addEvent({
                    delay: 100,
                    callback: this.performCharging,
                    callbackScope: this,
                    loop: true
                });
            }
        }
        
        performCharging() {
            if (!this.firstBatteryTime) return;
            
            // Calculate elapsed seconds since first battery
            const elapsed = (this.time.now - this.firstBatteryTime) / 1000;
            
            // Charge cycle is 1 second
            const currentCycle = Math.floor(elapsed);
            
            if (!this.chargeCycleActive) {
                // Wait for next full second
                if (elapsed >= 1) {
                    this.chargeCycleActive = true;
                    this.lastChargeCycle = currentCycle;
                    this.executeChargeEffect();
                }
            } else {
                // Check if next cycle started
                if (currentCycle > this.lastChargeCycle) {
                    this.lastChargeCycle = currentCycle;
                    this.executeChargeEffect();
                }
            }
        }
        
        executeChargeEffect() {
            // Calculate total charge per minute from all batteries
            let totalChargePerMin = 0;
            this.chargingSlots.forEach(slot => {
                if (slot !== null) {
                    totalChargePerMin += slot.chargePerMinute;
                }
            });
            
            // Convert to charge per second
            const chargePerSecond = totalChargePerMin / 60;
            
            // Add charge
            this.carCharge = Math.min(this.carCharge + chargePerSecond, this.maxCharge);
            
            // Update UI
            this.updateChargeBar();
            
            // Lightning bolt animation at car center
            if (this.vehicle && this.chassisSprite) {
                const bolt = this.add.image(this.chassisSprite.x, this.chassisSprite.y, 'bolt');
                bolt.setScale(CONFIG.LIGHTNING_BOLT.SCALE_START);
                bolt.setAlpha(CONFIG.LIGHTNING_BOLT.ALPHA_START);
                bolt.setDepth(50); // Above car
                
                this.tweens.add({
                    targets: bolt,
                    scaleX: CONFIG.LIGHTNING_BOLT.SCALE_END,
                    scaleY: CONFIG.LIGHTNING_BOLT.SCALE_END,
                    alpha: CONFIG.LIGHTNING_BOLT.ALPHA_END,
                    duration: CONFIG.LIGHTNING_BOLT.DURATION,
                    ease: 'Sine.easeOut',
                    onComplete: () => bolt.destroy()
                });
            }
        }
        
        updateChargeBar() {
            const barWidth = 250;
            const fillWidth = (this.carCharge / this.maxCharge) * (barWidth - 6);
            
            this.chargeBarFill.width = fillWidth;
            this.chargeText.setText(`⚡ ${Math.floor(this.carCharge)}/${this.maxCharge}`);
        }
        
        handleBatteryDrop(gameObject, slotIndex) {
            // Handle battery drop from MergeScene (to be implemented)
            console.log('Battery dropped on slot', slotIndex);
        }
        
        // Test buttons removed - batteries added via drag and drop from grid

        createVehicle() {
            const vc = CONFIG.VEHICLE;
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Spawn vehicle at the left end of the screen (fully visible)
            const x = 120; // Left side position
            const y = this.groundY - 50; // Above ground
            
            // Create collision group for vehicle (like car.ts example)
            const vehicleGroup = this.matter.world.nextGroup(true);
            
            // Create chassis (NO COLLISION with ground or wheels)
            this.vehicle = {
                chassis: this.matter.add.rectangle(x, y, vc.CHASSIS_WIDTH, vc.CHASSIS_HEIGHT, {
                    density: vc.CHASSIS_DENSITY,  // Use density like car.ts example
                    friction: vc.FRICTION,
                    chamfer: { radius: vc.CHASSIS_HEIGHT * 0.5 },  // Rounded corners like car.ts
                    collisionFilter: {
                        group: vehicleGroup  // Use collision group
                    },
                    render: {
                        visible: CONFIG.PHYSICS.DEBUG_CHASSIS_COLLIDER
                    }
                }),
                
                // Create rear wheel (COLLIDES with ground only)
                rearWheel: this.matter.add.circle(
                    x + vc.REAR_WHEEL_OFFSET_X,
                    y + vc.REAR_WHEEL_OFFSET_Y,
                    vc.WHEEL_RADIUS,
                    {
                        density: vc.WHEEL_DENSITY,  // Use density like car.ts example
                        friction: vc.WHEEL_FRICTION,
                        restitution: 0,  // No bounce
                        collisionFilter: {
                            group: vehicleGroup  // Use collision group
                        },
                        render: {
                            visible: CONFIG.PHYSICS.DEBUG_WHEEL_COLLIDER
                        }
                    }
                ),
                
                // Create front wheel (COLLIDES with ground only)
                frontWheel: this.matter.add.circle(
                    x + vc.FRONT_WHEEL_OFFSET_X,
                    y + vc.FRONT_WHEEL_OFFSET_Y,
                    vc.WHEEL_RADIUS,
                    {
                        density: vc.WHEEL_DENSITY,  // Use density like car.ts example
                        friction: vc.WHEEL_FRICTION,
                        restitution: 0,  // No bounce
                        collisionFilter: {
                            group: vehicleGroup  // Use collision group
                        },
                        render: {
                            visible: CONFIG.PHYSICS.DEBUG_WHEEL_COLLIDER
                        }
                    }
                )
            };
            
            // Create rigid axle constraints (like car.ts example)
            // Rigid constraint (length=0, stiffness=0.2) connects wheel to chassis offset point
            // This prevents bouncing while allowing slight compliance
            
            // REAR WHEEL axle (rigid constraint)
            this.vehicle.rearSpring = this.matter.add.constraint(
                this.vehicle.chassis,
                this.vehicle.rearWheel,
                vc.SPRING_LENGTH,  // 0 = rigid constraint
                vc.SPRING_STIFFNESS,  // 0.2 = slight compliance
                {
                    pointA: { x: vc.REAR_WHEEL_OFFSET_X, y: vc.REAR_WHEEL_OFFSET_Y },  // Exact offset point on chassis
                    pointB: { x: 0, y: 0 },  // Center of wheel
                    render: { visible: true }  // Make visible for debugging
                }
            );
            
            // FRONT WHEEL axle (rigid constraint)
            this.vehicle.frontSpring = this.matter.add.constraint(
                this.vehicle.chassis,
                this.vehicle.frontWheel,
                vc.SPRING_LENGTH,  // 0 = rigid constraint
                vc.SPRING_STIFFNESS,  // 0.2 = slight compliance
                {
                    pointA: { x: vc.FRONT_WHEEL_OFFSET_X, y: vc.FRONT_WHEEL_OFFSET_Y },  // Exact offset point on chassis
                    pointB: { x: 0, y: 0 },  // Center of wheel
                    render: { visible: true }  // Make visible for debugging
                }
            );
            
            // Create sprites with proper depth layering:
            // Ground (created in terrain) = depth 20
            // Chassis = depth 10
            // Wheels = depth 5
            this.rearWheelSprite = this.add.image(0, 0, 'tire').setDepth(5);
            this.frontWheelSprite = this.add.image(0, 0, 'tire').setDepth(5);
            this.chassisSprite = this.add.image(0, 0, 'chassis').setDepth(10);
            
            // Scale sprites to match physics bodies
            this.chassisSprite.setDisplaySize(vc.CHASSIS_WIDTH, vc.CHASSIS_HEIGHT);
            this.rearWheelSprite.setDisplaySize(vc.WHEEL_RADIUS * 2, vc.WHEEL_RADIUS * 2);
            this.frontWheelSprite.setDisplaySize(vc.WHEEL_RADIUS * 2, vc.WHEEL_RADIUS * 2);
            
            // Create debug circles for wheel offset visualization
            this.debugCircles = this.add.graphics();
            this.debugCircles.setDepth(100);  // Draw on top of everything
        }

        createBox() {
            const bc = CONFIG.BOX;
            const sceneWidth = this.cameras.main.width;
            const boxY = this.groundY - bc.HEIGHT / 2; // Resting on ground
            
            // Create 4 boxes with gaps between them
            const numBoxes = 4;
            const gapBetweenBoxes = 80; // Gap between each box
            const startX = 350; // Starting position for first box
            
            for (let i = 0; i < numBoxes; i++) {
                const boxX = startX + i * (bc.WIDTH + gapBetweenBoxes);
                
                // Create box physics body
                const box = {
                    body: this.matter.add.rectangle(boxX, boxY, bc.WIDTH, bc.HEIGHT, {
                        density: bc.WEIGHT,
                        friction: bc.BOX_FRICTION,
                        frictionStatic: bc.FRICTION,  // Static friction with ground
                        restitution: 0,  // No bounce
                        render: {
                            visible: CONFIG.PHYSICS.DEBUG_GROUND_COLLIDER,
                            fillStyle: bc.COLOR
                        }
                    })
                };
                
                // Create box sprite using graphics
                box.sprite = this.add.graphics();
                box.sprite.setDepth(15);  // Between chassis (10) and ground (20)
                
                // Draw the box
                box.sprite.fillStyle(bc.COLOR, 1);
                box.sprite.fillRect(-bc.WIDTH / 2, -bc.HEIGHT / 2, bc.WIDTH, bc.HEIGHT);
                box.sprite.lineStyle(bc.BORDER_WIDTH, bc.BORDER_COLOR, 1);
                box.sprite.strokeRect(-bc.WIDTH / 2, -bc.HEIGHT / 2, bc.WIDTH, bc.HEIGHT);
                
                // Store box in array
                this.boxes.push(box);
            }
        }

        // Brake and gas buttons removed - car automatically accelerates

        setupEngineSound() {
            // Create looping engine sound
            this.engineSound = this.sound.add('car_idle', {
                loop: true,
                volume: CONFIG.AUDIO.ENGINE_IDLE_VOLUME,
                rate: CONFIG.AUDIO.ENGINE_IDLE_RATE
            });
        }

        startEngine() {
            if (!this.isEngineRunning && this.engineSound) {
                this.engineSound.play();
                this.isEngineRunning = true;
                this.currentPlaybackRate = CONFIG.AUDIO.ENGINE_IDLE_RATE;
                this.currentVolume = CONFIG.AUDIO.ENGINE_IDLE_VOLUME;
            }
        }

        stopEngine() {
            if (this.isEngineRunning && this.engineSound) {
                this.engineSound.stop();
                this.isEngineRunning = false;
            }
        }

        updateEngineSound() {
            if (!this.isEngineRunning || !this.engineSound) return;

            const vc = CONFIG.VEHICLE;
            const ac = CONFIG.AUDIO;
            
            // Get current wheel speed (absolute value for pitch calculation)
            const wheelSpeed = Math.abs(this.vehicle.rearWheel.angularSpeed);
            // Use reference speed for engine sound (speed naturally emerges from torque)
            const referenceSpeed = 5;  // Reference max angular velocity for sound scaling
            
            // Calculate speed ratio (0 to 1)
            const speedRatio = Math.min(wheelSpeed / referenceSpeed, 1.0);

            // Always accelerating - increase pitch and volume based on speed
            this.targetPlaybackRate = Phaser.Math.Linear(
                ac.ENGINE_IDLE_RATE,
                ac.ENGINE_MAX_RATE,
                speedRatio
            );
            this.targetVolume = ac.ENGINE_ACTIVE_VOLUME;

            // Smooth interpolation (lerp) for natural sound transitions
            this.currentPlaybackRate = Phaser.Math.Linear(
                this.currentPlaybackRate,
                this.targetPlaybackRate,
                ac.RATE_LERP_SPEED
            );
            
            this.currentVolume = Phaser.Math.Linear(
                this.currentVolume,
                this.targetVolume,
                ac.VOLUME_LERP_SPEED
            );

            // Apply the smoothed values to the sound
            if (this.engineSound.isPlaying) {
                this.engineSound.setRate(this.currentPlaybackRate);
                this.engineSound.setVolume(this.currentVolume);
            }
        }

        update() {
            if (!this.vehicle) return;
            
            // Apply motor power (always accelerating)
            this.applyMotorPower();
            
            // Update engine sound
            this.updateEngineSound();
            
            // Update sprite positions
            this.updateVehicleGraphics();
        }

        applyMotorPower() {
            const vc = CONFIG.VEHICLE;
            
            // Get rear wheel
            const rearWheel = this.vehicle.rearWheel;
            
            // Apply CONSTANT torque to rear wheel
            // Speed is determined by physics: torque vs friction, mass, obstacles, etc.
            // Torque = Force × Distance, here we apply rotational force
            const torque = vc.MOTOR_TORQUE;
            
            // Convert torque to angular acceleration: α = τ / I
            // Where: α = angular acceleration, τ = torque, I = moment of inertia
            const angularAcceleration = torque / rearWheel.inertia;
            
            // Apply angular acceleration to current angular velocity
            const newAngularVelocity = rearWheel.angularSpeed + angularAcceleration;
            this.matter.body.setAngularVelocity(rearWheel, newAngularVelocity);
            
            // Note: Front wheel rotates naturally through the chassis constraint
            // No need to set its velocity - physics handles it
        }

        updateVehicleGraphics() {
            // Update chassis sprite
            this.chassisSprite.setPosition(
                this.vehicle.chassis.position.x,
                this.vehicle.chassis.position.y
            );
            this.chassisSprite.setRotation(this.vehicle.chassis.angle);
            
            // Update rear wheel sprite
            this.rearWheelSprite.setPosition(
                this.vehicle.rearWheel.position.x,
                this.vehicle.rearWheel.position.y
            );
            this.rearWheelSprite.setRotation(this.vehicle.rearWheel.angle);
            
            // Update front wheel sprite
            this.frontWheelSprite.setPosition(
                this.vehicle.frontWheel.position.x,
                this.vehicle.frontWheel.position.y
            );
            this.frontWheelSprite.setRotation(this.vehicle.frontWheel.angle);
            
            // Update all box sprites
            for (let i = 0; i < this.boxes.length; i++) {
                const box = this.boxes[i];
                if (box && box.sprite) {
                    box.sprite.setPosition(
                        box.body.position.x,
                        box.body.position.y
                    );
                    box.sprite.setRotation(box.body.angle);
                }
            }
            
            // Draw debug circles for wheel offset positions
            this.drawDebugOffsets();
        }
        
        drawDebugOffsets() {
            const vc = CONFIG.VEHICLE;
            
            // Clear previous debug graphics
            this.debugCircles.clear();
            
            const chassis = this.vehicle.chassis;
            const cos = Math.cos(chassis.angle);
            const sin = Math.sin(chassis.angle);
            
            // Draw wheel offset circles (yellow)
            if (vc.DEBUG_WHEEL_OFFSET) {
                // Calculate world position of rear wheel offset point
                const rearOffsetWorldX = chassis.position.x + 
                    (vc.REAR_WHEEL_OFFSET_X * cos - vc.REAR_WHEEL_OFFSET_Y * sin);
                const rearOffsetWorldY = chassis.position.y + 
                    (vc.REAR_WHEEL_OFFSET_X * sin + vc.REAR_WHEEL_OFFSET_Y * cos);
                
                // Calculate world position of front wheel offset point
                const frontOffsetWorldX = chassis.position.x + 
                    (vc.FRONT_WHEEL_OFFSET_X * cos - vc.FRONT_WHEEL_OFFSET_Y * sin);
                const frontOffsetWorldY = chassis.position.y + 
                    (vc.FRONT_WHEEL_OFFSET_X * sin + vc.FRONT_WHEEL_OFFSET_Y * cos);
                
                this.debugCircles.fillStyle(0xFFFF00, 1);
                this.debugCircles.fillCircle(rearOffsetWorldX, rearOffsetWorldY, 4);
                this.debugCircles.fillCircle(frontOffsetWorldX, frontOffsetWorldY, 4);
            }
            
            // Draw custom debug point (yellow circle)
            if (vc.DEBUG_POINT_SHOW) {
                // Calculate world position of custom debug point
                const debugPointWorldX = chassis.position.x + 
                    (vc.DEBUG_POINT_OFFSET_X * cos - vc.DEBUG_POINT_OFFSET_Y * sin);
                const debugPointWorldY = chassis.position.y + 
                    (vc.DEBUG_POINT_OFFSET_X * sin + vc.DEBUG_POINT_OFFSET_Y * cos);
                
                this.debugCircles.fillStyle(0xFFFF00, 1);
                this.debugCircles.fillCircle(debugPointWorldX, debugPointWorldY, 4);
            }
        }

        // Debug text removed
        
        // ====================
        // MERGE SCENE METHODS
        // ====================
        
        createCoinDisplay() {
            const sceneWidth = this.cameras.main.width;
            
            // Calculate position: top-right above grid
            const gridWidth = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
            const gridRightX = this.gridStartX + gridWidth - this.CELL_SIZE / 2;
            
            // Position above the top edge of the grid (gridStartY is center of top row cells)
            const gridTopEdge = this.gridStartY - this.CELL_SIZE / 2;
            const coinY = gridTopEdge - CONFIG.COIN_COUNTER.PADDING_FROM_GRID_TOP;
            
            // Coin text (displayed first)
            this.coinText = this.add.text(gridRightX - CONFIG.COIN_COUNTER.OFFSET_FROM_RIGHT, coinY, `${this.coins}`, {
                fontSize: CONFIG.COIN_COUNTER.TEXT_SIZE,
                fontFamily: CONFIG.FONT_FAMILY,
                color: CONFIG.COIN_COUNTER.TEXT_COLOR,
                fontStyle: 'bold'
            }).setOrigin(1, 0.5);  // Right-aligned
            
            // Coin icon (to the right of text)
            const coinIconX = this.coinText.x + CONFIG.COIN_COUNTER.TEXT_ICON_SPACING + CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2;
            this.coinIcon = this.add.image(coinIconX, coinY, 'coin');
            this.coinIcon.setDisplaySize(CONFIG.COIN_COUNTER.COIN_ICON_WIDTH, CONFIG.COIN_COUNTER.COIN_ICON_HEIGHT);
        }

        createGrid() {
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Calculate grid dimensions
            const gridWidth = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
            const gridHeight = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
            
            // Calculate grid position: above spawn button with padding
            const buttonY = sceneHeight - CONFIG.BUTTON.BOTTOM_PADDING;
            const gridBottomY = buttonY - CONFIG.BUTTON.SPAWN_HEIGHT / 2 - CONFIG.GRID.PADDING_FROM_BUTTON_TOP;
            const gridStartY = gridBottomY - gridHeight + this.CELL_SIZE / 2;
            
            // Store grid boundaries for coin display
            this.gridStartY = gridStartY;
            this.gridStartX = (sceneWidth - gridWidth) / 2 + this.CELL_SIZE / 2;
            
            for (let row = 0; row < this.GRID_ROWS; row++) {
                this.gridCells[row] = [];
                for (let col = 0; col < this.GRID_COLS; col++) {
                    const x = this.gridStartX + col * (this.CELL_SIZE + this.CELL_GAP);
                    const y = this.gridStartY + row * (this.CELL_SIZE + this.CELL_GAP);
                    
                    // Empty cell background (rounded rectangle)
                    const cell = this.add.graphics();
                    cell.lineStyle(CONFIG.CELL.BORDER_WIDTH, CONFIG.CELL.BORDER_COLOR, 1);
                    cell.strokeRoundedRect(
                        x - this.CELL_SIZE / 2,
                        y - this.CELL_SIZE / 2,
                        this.CELL_SIZE,
                        this.CELL_SIZE,
                        this.CELL_RADIUS
                    );
                    
                    // Filled cell background (hidden initially)
                    const filledBg = this.add.graphics();
                    filledBg.fillStyle(CONFIG.CELL.FILLED_BG_COLOR, 1);
                    filledBg.fillRoundedRect(
                        x - this.CELL_SIZE / 2,
                        y - this.CELL_SIZE / 2,
                        this.CELL_SIZE,
                        this.CELL_SIZE,
                        this.CELL_RADIUS
                    );
                    filledBg.setVisible(false);
                    
                    this.gridCells[row][col] = {
                        x: x,
                        y: y,
                        row: row,
                        col: col,
                        isEmpty: true,
                        cell: cell,
                        filledBg: filledBg
                    };
                }
            }
        }

        createButtons() {
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            const buttonY = sceneHeight - CONFIG.BUTTON.BOTTOM_PADDING;
            
            // Spawn button
            const spawnButton = this.add.container(sceneWidth / 2, buttonY);
            
            const spawnBg = this.add.image(0, 0, 'button');
            spawnBg.setDisplaySize(CONFIG.BUTTON.SPAWN_WIDTH+30, CONFIG.BUTTON.SPAWN_HEIGHT+30);
            spawnBg.setInteractive({ useHandCursor: true });
            
            // Battery icon on button - use correct level based on BATTERY_START_LEVEL
            const batteryIconLevel = getBatteryIconLevel(this.spawnButtonLevel);
            const spawnIcon = this.add.image(CONFIG.BUTTON.BATTERY_ICON_X, CONFIG.BUTTON.BATTERY_ICON_Y, `battery${batteryIconLevel}`);
            spawnIcon.setDisplaySize(CONFIG.BUTTON.BATTERY_ICON_WIDTH, CONFIG.BUTTON.BATTERY_ICON_HEIGHT);
            
            this.spawnButtonText = this.add.text(CONFIG.BUTTON.COIN_TEXT_X, CONFIG.BUTTON.COIN_TEXT_Y, `10`, {
                fontSize: CONFIG.BUTTON.COIN_TEXT_SIZE,
                fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            // Coin icon on button
            const spawnCoinIcon = this.add.image(CONFIG.BUTTON.COIN_ICON_X, CONFIG.BUTTON.COIN_ICON_Y, 'coin');
            spawnCoinIcon.setDisplaySize(CONFIG.BUTTON.COIN_ICON_WIDTH, CONFIG.BUTTON.COIN_ICON_HEIGHT);
            
            spawnButton.add([spawnBg, spawnIcon, this.spawnButtonText, spawnCoinIcon]);
            
            spawnBg.on('pointerdown', () => {
                this.spawnBattery();
            });
            
            this.spawnButton = spawnButton;
            this.spawnButtonBg = spawnBg;
            this.spawnButtonIcon = spawnIcon;  // Store icon reference for updating
            
            // Level-up button (left of spawn button)
            const levelUpButton = this.add.container(sceneWidth / 2 - CONFIG.BUTTON.BUTTON_SPACING, buttonY);
            
            const levelUpBg = this.add.rectangle(0, 0, CONFIG.BUTTON.LEVELUP_WIDTH, CONFIG.BUTTON.LEVELUP_HEIGHT, CONFIG.BUTTON.LEVELUP_COLOR);
            levelUpBg.setStrokeStyle(CONFIG.BUTTON.LEVELUP_BORDER_WIDTH, CONFIG.BUTTON.LEVELUP_BORDER_COLOR);
            levelUpBg.setInteractive({ useHandCursor: true });
            
            const levelUpText = this.add.text(0, 0, '📺 Level Up\nAll', {
                fontSize: '18px',
                fontFamily: CONFIG.FONT_FAMILY,
                align: 'center',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            levelUpButton.add([levelUpBg, levelUpText]);
            
            levelUpBg.on('pointerdown', () => {
                if (this.levelUpButtonVisible) {
                    this.levelUpAll();
                }
            });
            
            this.levelUpButton = levelUpButton;
            this.levelUpButtonBg = levelUpBg;
            
            // Hide level-up button initially
            this.levelUpButton.setVisible(false);
            this.levelUpButtonVisible = false;
            this.levelUpButtonShowTime = null;
            
            // Start level-up timer (first appearance after 20 seconds)
            this.time.addEvent({
                delay: 1000,
                callback: this.checkLevelUpTimer,
                callbackScope: this,
                loop: true
            });
        }

        createStartOverlay() {
            const sceneWidth = this.cameras.main.width;
            const sceneHeight = this.cameras.main.height;
            
            // Create overlay covering entire scene
            this.startOverlay = this.add.rectangle(
                sceneWidth / 2,
                sceneHeight / 2,
                sceneWidth,
                sceneHeight,
                0x000000,
                0.6
            );
            
            // Animated pointer (point.png) positioned below button center
            const pointerY = this.spawnButton.y + CONFIG.POINTER.OFFSET_Y;
            const pointer = this.add.image(
                this.spawnButton.x,
                pointerY,
                'point'
            );
            pointer.setScale(CONFIG.POINTER.SCALE);
            pointer.setTint(CONFIG.POINTER.TINT);
            pointer.setOrigin(0.5, 0);  // Origin at top center, so top appears at pointerY
            
            // Click animation: move up and scale down, then back
            this.tweens.add({
                targets: pointer,
                y: pointerY - CONFIG.POINTER.ANIMATION_MOVE_UP,
                scaleX: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                scaleY: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                duration: CONFIG.POINTER.ANIMATION_DURATION,
                yoyo: CONFIG.POINTER.ANIMATION_YOYO,
                repeat: CONFIG.POINTER.ANIMATION_REPEAT
            });
            
            // Set depths: overlay behind button, pointer on top of everything
            this.startOverlay.setDepth(100);
            this.spawnButton.setDepth(101);  // Button visible above overlay
            pointer.setDepth(102);            // Pointer on top
            
            this.startPointer = pointer;
        }

        removeStartOverlay() {
            if (this.startOverlay) {
                this.startOverlay.destroy();
                this.startPointer.destroy();
                this.startOverlay = null;
                this.hasStartedPlaying = true;
                
                // Start level-up timer (20 seconds for first appearance)
                this.levelUpTimer = this.time.now;
                this.firstLevelUpTimer = true;
            }
        }
        
        checkAndShowMergeTutorial() {
            // Show merge tutorial when second battery is spawned
            if (!this.mergeTutorialShown && this.batteries.length === 2 && !this.mergePointer) {
                this.createMergeTutorial();
            }
        }
        
        createMergeTutorial() {
            // NO OVERLAY - just the hand animation
            
            // Get positions of first two cells (0,0) and (0,1)
            const cell1X = this.gridStartX;
            const cell1Y = this.gridStartY;
            const cell2X = this.gridStartX + (this.CELL_SIZE + this.CELL_GAP);
            const cell2Y = this.gridStartY;
            
            // Create pointer with tip at horizontal center of cells
            const mergePointer = this.add.image(
                cell1X,
                cell1Y,  // Center of cell, not below
                'point'
            );
            mergePointer.setScale(CONFIG.POINTER.SCALE);
            mergePointer.setTint(CONFIG.POINTER.TINT);
            mergePointer.setOrigin(0.5, 0);  // Origin at top center, so tip is at cell center
            mergePointer.setDepth(102); // Above everything else
            
            // Animate pointer from cell 1 to cell 2 horizontally
            // Left to right, then reset and repeat (no yoyo)
            this.tweens.add({
                targets: mergePointer,
                x: cell2X,
                duration: CONFIG.MERGE_TUTORIAL.ANIMATION_DURATION,
                ease: CONFIG.MERGE_TUTORIAL.ANIMATION_EASE,
                yoyo: false,  // Don't go back
                repeat: -1,   // Repeat infinitely
                repeatDelay: 200  // Small pause before repeating (appears, animates, disappears, reappears)
            });
            
            this.mergePointer = mergePointer;
        }
        
        removeMergeTutorial() {
            if (this.mergePointer) {
                this.mergePointer.destroy();
                this.mergePointer = null;
                this.mergeTutorialShown = true; // Mark as shown so it never appears again
            }
        }

        spawnBattery() {
            // Check if player can afford
            if (this.coins < this.spawnCost) {
                return;
            }
            
            // Find first empty cell (top-left to bottom-right)
            let emptyCell = null;
            for (let row = 0; row < this.GRID_ROWS; row++) {
                for (let col = 0; col < this.GRID_COLS; col++) {
                    if (this.grid[row][col] === null) {
                        emptyCell = { row, col };
                        break;
                    }
                }
                if (emptyCell) break;
            }
            
            // Simply don't spawn if grid is full (no message)
            if (!emptyCell) {
                return;
            }
            
            // Deduct coins
            this.coins -= this.spawnCost;
            this.updateCoinDisplay();
            
            // Spawn battery
            this.spawnBatteryInGrid(emptyCell.row, emptyCell.col, this.spawnButtonLevel);
            
            // Remove overlay if first spawn
            if (this.startOverlay) {
                this.removeStartOverlay();
            }
            
            // Check if we should show merge tutorial
            this.checkAndShowMergeTutorial();
            
            // Update spawn button state
            this.updateSpawnButton();
        }

        spawnBatteryInGrid(row, col, level) {
            const cellData = this.gridCells[row][col];
            
            // Determine which battery icon to use (dynamically uses highest available)
            const batteryIconLevel = getBatteryIconLevel(level);
            const batteryIcon = `battery${batteryIconLevel}`;
            
            // Create transparent draggable background covering entire cell
            // This makes dragging work anywhere in the cell, not just on non-transparent sprite pixels
            const draggableBg = this.add.rectangle(
                cellData.x, 
                cellData.y, 
                this.CELL_SIZE, 
                this.CELL_SIZE, 
                CONFIG.CELL.DRAGGABLE_BG_COLOR, 
                CONFIG.CELL.DRAGGABLE_BG_ALPHA
            );
            draggableBg.setInteractive({
                draggable: true,
                useHandCursor: true
            });
            
            // Create battery sprite (not directly draggable, dragged via draggableBg)
            const battery = this.add.image(cellData.x, cellData.y + CONFIG.CELL.BATTERY_Y_OFFSET, batteryIcon);
            battery.setScale(CONFIG.CELL.BATTERY_SCALE);
            
            // Add level text at top of battery
            const levelText = this.add.text(
                cellData.x, 
                cellData.y + CONFIG.CELL.BATTERY_Y_OFFSET + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET, 
                `LVL ${level}`, 
                {
                    fontSize: CONFIG.CELL.LEVEL_TEXT_SIZE,
                    fontFamily: CONFIG.FONT_FAMILY,
                    color: CONFIG.CELL.LEVEL_TEXT_COLOR,
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            
            const batteryData = {
                draggableBg: draggableBg,
                sprite: battery,
                levelText: levelText,
                level: level,
                row: row,
                col: col,
                originalX: cellData.x,
                originalY: cellData.y + CONFIG.CELL.BATTERY_Y_OFFSET,
                inGrid: true,
                inChargingSlot: false
            };
            
            draggableBg.setData('batteryData', batteryData);
            
            this.batteries.push(batteryData);
            this.grid[row][col] = batteryData;
            
            // Show filled background
            cellData.filledBg.setVisible(true);
            cellData.isEmpty = false;
            
            // Squash & Stretch animation with overshoot and settle
            this.playSpawnAnimation(batteryData);
            
            return batteryData;
        }

        playSpawnAnimation(batteryData) {
            const { sprite, levelText } = batteryData;
            const baseScale = CONFIG.CELL.BATTERY_SCALE;
            const anim = CONFIG.SPAWN_ANIMATION;
            
            // Start from squashed state (wide and short)
            sprite.setScale(baseScale * anim.INITIAL_SCALE_X, baseScale * anim.INITIAL_SCALE_Y);
            levelText.setScale(anim.INITIAL_SCALE_X, anim.INITIAL_SCALE_Y);
            
            // Animate sprite with squash & stretch using chained tweens
            // Phase 1: Overshoot stretch (tall and narrow)
            this.tweens.add({
                targets: sprite,
                scaleX: baseScale * anim.STRETCH_SCALE_X,
                scaleY: baseScale * anim.STRETCH_SCALE_Y,
                duration: anim.STRETCH_DURATION,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Phase 2: Slight opposite bounce (squash again but less)
                    this.tweens.add({
                        targets: sprite,
                        scaleX: baseScale * anim.BOUNCE_SCALE_X,
                        scaleY: baseScale * anim.BOUNCE_SCALE_Y,
                        duration: anim.BOUNCE_DURATION,
                        ease: 'Cubic.easeInOut',
                        onComplete: () => {
                            // Phase 3: Settle to normal scale
                            this.tweens.add({
                                targets: sprite,
                                scaleX: baseScale,
                                scaleY: baseScale,
                                duration: anim.SETTLE_DURATION,
                                ease: 'Cubic.easeOut'
                            });
                        }
                    });
                }
            });
            
            // Animate level text with same squash & stretch pattern
            // Phase 1: Overshoot stretch
            this.tweens.add({
                targets: levelText,
                scaleX: anim.STRETCH_SCALE_X,
                scaleY: anim.STRETCH_SCALE_Y,
                duration: anim.STRETCH_DURATION,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Phase 2: Slight opposite bounce
                    this.tweens.add({
                        targets: levelText,
                        scaleX: anim.BOUNCE_SCALE_X,
                        scaleY: anim.BOUNCE_SCALE_Y,
                        duration: anim.BOUNCE_DURATION,
                        ease: 'Cubic.easeInOut',
                        onComplete: () => {
                            // Phase 3: Settle to normal scale
                            this.tweens.add({
                                targets: levelText,
                                scaleX: 1.0,
                                scaleY: 1.0,
                                duration: anim.SETTLE_DURATION,
                                ease: 'Cubic.easeOut'
                            });
                        }
                    });
                }
            });
        }

        onDragStart(pointer, gameObject) {
            if (!gameObject.getData('batteryData')) return;
            
            const batteryData = gameObject.getData('batteryData');
            this.draggingBattery = batteryData;
            
            // If dragging from charging slot, immediately stop its contribution to charging
            if (batteryData.inChargingSlot) {
                const slotIndex = batteryData.slotIndex;
                const slot = this.chargingSlotsUI[slotIndex];
                
                // Remove from charging system
                this.chargingSlots[slotIndex] = null;
                
                // Hide charge rate text and filled background
                slot.chargeText.setVisible(false);
                slot.slotFilledBg.setVisible(false);
                
                // Update charging system (may stop charging if this was the last battery)
                this.updateChargingSystem();
            }
            
            // Bring to front with very high depth (above both scenes)
            if (batteryData.draggableBg) {
                batteryData.draggableBg.setDepth(10000);
            }
            batteryData.sprite.setDepth(10001);
            batteryData.levelText.setDepth(10002);
            
            // Remove start overlay on first drag (if user drags instead of clicking spawn)
            if (this.startOverlay) {
                this.removeStartOverlay();
            }
        }

        onDrag(pointer, gameObject, dragX, dragY) {
            if (!gameObject.getData('batteryData')) return;
            
            const batteryData = gameObject.getData('batteryData');
            
            // Move all battery elements together (draggableBg, sprite, and text)
            if (batteryData.draggableBg) {
                batteryData.draggableBg.x = dragX;
                batteryData.draggableBg.y = dragY;
            }
            batteryData.sprite.x = dragX;
            batteryData.sprite.y = dragY;
            batteryData.levelText.setPosition(dragX, dragY + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET);
            
            // Check if battery left original cell (for grid items)
            if (batteryData.inGrid) {
                const cellData = this.gridCells[batteryData.row][batteryData.col];
                const bounds = new Phaser.Geom.Rectangle(
                    cellData.x - this.CELL_SIZE / 2,
                    cellData.y - this.CELL_SIZE / 2,
                    this.CELL_SIZE,
                    this.CELL_SIZE
                );
                
                if (!Phaser.Geom.Rectangle.Contains(bounds, dragX, dragY)) {
                    cellData.filledBg.setVisible(false);
                } else {
                    cellData.filledBg.setVisible(true);
                }
            }
            
            // Note: For charging slots, the slot remains empty during drag
            // Battery only contributes to charging when dropped/placed
        }

        onDragEnd(pointer, gameObject) {
            if (!gameObject.getData('batteryData')) return;
            
            const batteryData = gameObject.getData('batteryData');
            const dropX = batteryData.sprite.x;
            const dropY = batteryData.sprite.y;
            
            // Check if dropped on charging slot
            let droppedOnChargingSlot = false;
            for (let i = 0; i < this.chargingSlotsUI.length; i++) {
                const slot = this.chargingSlotsUI[i];
                const bounds = new Phaser.Geom.Rectangle(
                    slot.x - 50,
                    slot.y - 50,
                    100,
                    100
                );
                
                if (Phaser.Geom.Rectangle.Contains(bounds, dropX, dropY)) {
                    // Handle drop on charging slot
                    this.handleDropOnChargingSlot(i, batteryData);
                    droppedOnChargingSlot = true;
                    break;
                }
            }
            
            if (!droppedOnChargingSlot) {
                // Find which grid cell was dropped on
                let targetCell = null;
                for (let row = 0; row < this.GRID_ROWS; row++) {
                    for (let col = 0; col < this.GRID_COLS; col++) {
                        const cellData = this.gridCells[row][col];
                        const bounds = new Phaser.Geom.Rectangle(
                            cellData.x - this.CELL_SIZE / 2,
                            cellData.y - this.CELL_SIZE / 2,
                            this.CELL_SIZE,
                            this.CELL_SIZE
                        );
                        
                        if (Phaser.Geom.Rectangle.Contains(bounds, dropX, dropY)) {
                            targetCell = { row, col, cellData };
                            break;
                        }
                    }
                    if (targetCell) break;
                }
                
                if (targetCell) {
                    this.handleDrop(batteryData, targetCell);
                } else {
                    // Return to original position
                    this.returnBatteryToPosition(batteryData);
                }
            }
            
            this.draggingBattery = null;
        }

        handleDropOnChargingSlot(slotIndex, batteryData) {
            const targetSlotData = this.chargingSlots[slotIndex];
            
            if (targetSlotData === null) {
                // Empty slot - move battery to slot
                this.moveBatteryToChargingSlot(batteryData, slotIndex);
            } else if (batteryData.inChargingSlot && batteryData.slotIndex === slotIndex) {
                // Same slot - return to position
                this.returnBatteryToPosition(batteryData);
            } else if (targetSlotData.batteryData.level === batteryData.level) {
                // Same level - merge in charging slot
                this.mergeBatteriesInChargingSlot(batteryData, targetSlotData.batteryData, slotIndex);
            } else {
                // Different level - swap
                this.swapBatteryWithChargingSlot(batteryData, targetSlotData.batteryData, slotIndex);
            }
        }

        handleDrop(batteryData, targetCell) {
            const targetBattery = this.grid[targetCell.row][targetCell.col];
            
            if (targetBattery === null) {
                // Empty cell - move battery
                this.moveBattery(batteryData, targetCell.row, targetCell.col);
            } else if (targetBattery === batteryData) {
                // Same cell - return to position
                this.returnBatteryToPosition(batteryData);
            } else if (targetBattery.level === batteryData.level) {
                // Same level - merge
                this.mergeBatteries(batteryData, targetBattery, targetCell.row, targetCell.col);
            } else {
                // Different level - swap
                this.swapBatteries(batteryData, targetBattery);
            }
        }

        moveBattery(batteryData, newRow, newCol) {
            // Clear old position
            if (batteryData.inGrid) {
                this.grid[batteryData.row][batteryData.col] = null;
                this.gridCells[batteryData.row][batteryData.col].filledBg.setVisible(false);
                this.gridCells[batteryData.row][batteryData.col].isEmpty = true;
            } else if (batteryData.inChargingSlot) {
                // Remove from charging slot
                this.chargingSlots[batteryData.slotIndex] = null;
                const slot = this.chargingSlotsUI[batteryData.slotIndex];
                slot.slotFilledBg.setVisible(false);
                slot.chargeText.setVisible(false);
                slot.batterySprite = null;
                slot.batteryLevelText = null;
                this.updateChargingSystem();
            }
            
            // Update position
            batteryData.row = newRow;
            batteryData.col = newCol;
            batteryData.inGrid = true;
            batteryData.inChargingSlot = false;
            this.grid[newRow][newCol] = batteryData;
            
            // Add to batteries array if not already there
            if (!this.batteries.includes(batteryData)) {
                this.batteries.push(batteryData);
            }
            
            const cellData = this.gridCells[newRow][newCol];
            batteryData.originalX = cellData.x;
            batteryData.originalY = cellData.y + CONFIG.CELL.BATTERY_Y_OFFSET;
            
            // Animate to new position
            this.returnBatteryToPosition(batteryData);
            
            // Show filled background
            cellData.filledBg.setVisible(true);
            cellData.isEmpty = false;
        }

        mergeBatteries(draggedBattery, targetBattery, targetRow, targetCol) {
            // Remove merge tutorial animation on first merge
            if (this.mergePointer) {
                this.removeMergeTutorial();
            }
            
            // Remove dragged battery
            this.removeBattery(draggedBattery);
            
            // Remove target battery
            this.removeBattery(targetBattery);
            
            // Create new battery at target position with level + 1
            const newLevel = targetBattery.level + 1;
            this.spawnBatteryInGrid(targetRow, targetCol, newLevel);
            
            // Update highest level
            if (newLevel > this.highestBatteryLevel) {
                this.highestBatteryLevel = newLevel;
                this.updateSpawnButton();
            }
            
            // Merge animation effect
            this.createMergeEffect(this.gridCells[targetRow][targetCol].x, this.gridCells[targetRow][targetCol].y);
        }

        swapBatteries(battery1, battery2) {
            const row1 = battery1.row;
            const col1 = battery1.col;
            const row2 = battery2.row;
            const col2 = battery2.col;
            
            // Swap in grid
            this.grid[row1][col1] = battery2;
            this.grid[row2][col2] = battery1;
            
            // Update positions
            battery1.row = row2;
            battery1.col = col2;
            battery1.originalX = this.gridCells[row2][col2].x;
            battery1.originalY = this.gridCells[row2][col2].y + CONFIG.CELL.BATTERY_Y_OFFSET;
            
            battery2.row = row1;
            battery2.col = col1;
            battery2.originalX = this.gridCells[row1][col1].x;
            battery2.originalY = this.gridCells[row1][col1].y + CONFIG.CELL.BATTERY_Y_OFFSET;
            
            // Animate both
            this.returnBatteryToPosition(battery1);
            this.returnBatteryToPosition(battery2);
        }

        moveBatteryToChargingSlot(batteryData, slotIndex) {
            // Clear old position
            if (batteryData.inGrid) {
                this.removeBattery(batteryData);
            } else if (batteryData.inChargingSlot) {
                // Remove from old charging slot
                this.chargingSlots[batteryData.slotIndex] = null;
                const oldSlot = this.chargingSlotsUI[batteryData.slotIndex];
                oldSlot.slotFilledBg.setVisible(false);
                oldSlot.chargeText.setVisible(false);
                oldSlot.batterySprite = null;
                oldSlot.batteryLevelText = null;
                
                // Destroy old sprites to prevent duplicates
                if (batteryData.sprite) {
                    batteryData.sprite.destroy();
                }
                if (batteryData.levelText) {
                    batteryData.levelText.destroy();
                }
            }
            
            // Add to new charging slot
            this.addBatteryToSlot(slotIndex, batteryData.level);
        }

        swapBatteryWithChargingSlot(battery1, battery2, slotIndex) {
            // battery1 is being dragged, battery2 is in charging slot at slotIndex
            
            if (battery1.inGrid) {
                // Swap grid battery with charging slot battery
                const row1 = battery1.row;
                const col1 = battery1.col;
                
                // Remove battery1 from grid
                this.removeBattery(battery1);
                
                // Remove battery2 from charging slot (destroy old sprites)
                this.chargingSlots[slotIndex] = null;
                const slot = this.chargingSlotsUI[slotIndex];
                slot.slotFilledBg.setVisible(false);
                slot.chargeText.setVisible(false);
                slot.batterySprite = null;
                slot.batteryLevelText = null;
                
                // Destroy battery2's charging slot sprites
                if (battery2.sprite) {
                    battery2.sprite.destroy();
                }
                if (battery2.levelText) {
                    battery2.levelText.destroy();
                }
                
                // Create new sprites for battery2 in grid
                battery2.inChargingSlot = false;
                battery2.inGrid = true;
                battery2.row = row1;
                battery2.col = col1;
                
                // Spawn battery in grid (this creates new sprites with draggableBg)
                const newBattery2 = this.spawnBatteryInGrid(row1, col1, battery2.level);
                
                // Add battery1 to charging slot
                this.addBatteryToSlot(slotIndex, battery1.level);
                
            } else if (battery1.inChargingSlot) {
                // Swap two charging slot batteries
                const slot1Index = battery1.slotIndex;
                const slot2Index = slotIndex;
                
                const slot1 = this.chargingSlotsUI[slot1Index];
                const slot2 = this.chargingSlotsUI[slot2Index];
                
                const level1 = battery1.level;
                const level2 = battery2.level;
                
                // Clear both slots
                this.chargingSlots[slot1Index] = null;
                this.chargingSlots[slot2Index] = null;
                
                slot1.batterySprite.destroy();
                slot1.batteryLevelText.destroy();
                slot1.slotFilledBg.setVisible(false);
                slot1.chargeText.setVisible(false);
                
                slot2.batterySprite.destroy();
                slot2.batteryLevelText.destroy();
                slot2.slotFilledBg.setVisible(false);
                slot2.chargeText.setVisible(false);
                
                // Add swapped batteries
                this.addBatteryToSlot(slot1Index, level2);
                this.addBatteryToSlot(slot2Index, level1);
            }
            
            this.updateChargingSystem();
        }

        mergeBatteriesInChargingSlot(draggedBattery, targetBattery, targetSlotIndex) {
            // Remove merge tutorial animation on first merge
            if (this.mergePointer) {
                this.removeMergeTutorial();
            }
            
            // Remove dragged battery
            if (draggedBattery.inGrid) {
                this.removeBattery(draggedBattery);
            } else if (draggedBattery.inChargingSlot) {
                this.chargingSlots[draggedBattery.slotIndex] = null;
                const slot = this.chargingSlotsUI[draggedBattery.slotIndex];
                
                // Destroy sprites via batteryData references (more reliable)
                if (draggedBattery.sprite) draggedBattery.sprite.destroy();
                if (draggedBattery.levelText) draggedBattery.levelText.destroy();
                if (draggedBattery.draggableBg) draggedBattery.draggableBg.destroy();
                
                slot.slotFilledBg.setVisible(false);
                slot.chargeText.setVisible(false);
                slot.batterySprite = null;
                slot.batteryLevelText = null;
            }
            
            // Remove target battery from charging slot
            this.chargingSlots[targetSlotIndex] = null;
            const targetSlot = this.chargingSlotsUI[targetSlotIndex];
            
            // Destroy target sprites
            if (targetBattery.sprite) targetBattery.sprite.destroy();
            if (targetBattery.levelText) targetBattery.levelText.destroy();
            
            targetSlot.slotFilledBg.setVisible(false);
            targetSlot.chargeText.setVisible(false);
            targetSlot.batterySprite = null;
            targetSlot.batteryLevelText = null;
            
            // Create new battery at target slot with level + 1
            const newLevel = targetBattery.level + 1;
            this.addBatteryToSlot(targetSlotIndex, newLevel);
            
            // Update highest level
            if (newLevel > this.highestBatteryLevel) {
                this.highestBatteryLevel = newLevel;
                this.updateSpawnButton();
            }
            
            // Merge animation effect
            this.createMergeEffect(targetSlot.x, targetSlot.y);
            
            this.updateChargingSystem();
        }

        removeBattery(batteryData) {
            // Remove from grid
            if (batteryData.inGrid) {
                this.grid[batteryData.row][batteryData.col] = null;
                this.gridCells[batteryData.row][batteryData.col].filledBg.setVisible(false);
                this.gridCells[batteryData.row][batteryData.col].isEmpty = true;
            }
            
            // Remove from charging slot
            if (batteryData.inChargingSlot) {
                this.chargingSlots[batteryData.slotIndex] = null;
                const slot = this.chargingSlotsUI[batteryData.slotIndex];
                slot.slotFilledBg.setVisible(false);
                slot.chargeText.setVisible(false);
                slot.batterySprite = null;
                slot.batteryLevelText = null;
                this.updateChargingSystem();
            }
            
            // Remove from batteries array
            const index = this.batteries.indexOf(batteryData);
            if (index > -1) {
                this.batteries.splice(index, 1);
            }
            
            // Destroy all elements
            if (batteryData.draggableBg) {
                batteryData.draggableBg.destroy();
            }
            batteryData.sprite.destroy();
            batteryData.levelText.destroy();
        }

        returnBatteryToPosition(batteryData) {
            if (batteryData.draggableBg) {
                batteryData.draggableBg.setDepth(0);
            }
            batteryData.sprite.setDepth(1);
            batteryData.levelText.setDepth(2);
            
            // If battery is in grid, ensure background is visible
            if (batteryData.inGrid) {
                this.gridCells[batteryData.row][batteryData.col].filledBg.setVisible(true);
                this.gridCells[batteryData.row][batteryData.col].isEmpty = false;
            }
            
            // If battery is in charging slot, re-add to charging system
            if (batteryData.inChargingSlot) {
                const slotIndex = batteryData.slotIndex;
                const slot = this.chargingSlotsUI[slotIndex];
                const chargePerMinute = batteryData.level * 5;
                
                // Re-add to charging slots
                this.chargingSlots[slotIndex] = {
                    level: batteryData.level,
                    chargePerMinute: chargePerMinute,
                    batteryData: batteryData
                };
                
                // Show UI
                slot.chargeText.setText(`${chargePerMinute}`);
                slot.chargeText.setVisible(true);
                slot.slotFilledBg.setVisible(true);
                
                // Update charging system
                this.updateChargingSystem();
            }
            
            // Animate draggable background back to original position (cell center)
            if (batteryData.draggableBg) {
                this.tweens.add({
                    targets: batteryData.draggableBg,
                    x: batteryData.originalX,
                    y: batteryData.originalY - CONFIG.CELL.BATTERY_Y_OFFSET,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            }
            
            // Animate back to original position
            this.tweens.add({
                targets: batteryData.sprite,
                x: batteryData.originalX,
                y: batteryData.originalY,
                duration: 200,
                ease: 'Back.easeOut'
            });
            
            this.tweens.add({
                targets: batteryData.levelText,
                x: batteryData.originalX,
                y: batteryData.originalY + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET,
                duration: 200,
                ease: 'Back.easeOut'
            });
        }
        
        createMergeEffect(x, y) {
            // Particle burst effect
            const circle = this.add.circle(x, y, 50, 0xFFFFFF, 0.8);
            this.tweens.add({
                targets: circle,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 300,
                onComplete: () => circle.destroy()
            });
        }

        updateSpawnButton() {
            // Update spawn button based on highest level
            if (this.highestBatteryLevel >= 9) {
                const newButtonLevel = this.highestBatteryLevel - 7; // 9->2, 10->3, 11->4
                if (newButtonLevel > this.spawnButtonLevel) {
                    this.spawnButtonLevel = newButtonLevel;
                    this.spawnCost = newButtonLevel * 10;
                    this.spawnButtonText.setText(`${this.spawnCost}`);
                    
                    // Update battery icon texture to match new level
                    const batteryIconLevel = getBatteryIconLevel(this.spawnButtonLevel);
                    this.spawnButtonIcon.setTexture(`battery${batteryIconLevel}`);
                }
            }
            
            // Disable button if not enough coins
            if (this.coins < this.spawnCost) {
                this.spawnButtonBg.setTint(0x888888);
                this.spawnButtonBg.disableInteractive();
            } else {
                this.spawnButtonBg.clearTint();
                this.spawnButtonBg.setInteractive({ useHandCursor: true });
            }
        }

        checkLevelUpTimer() {
            if (!this.hasStartedPlaying) return;
            
            const currentTime = this.time.now;
            
            // If button is visible, check if 30 seconds have passed
            if (this.levelUpButtonVisible && this.levelUpButtonShowTime) {
                const elapsedVisible = currentTime - this.levelUpButtonShowTime;
                if (elapsedVisible >= 30000) { // Hide after 30 seconds
                    this.levelUpButton.setVisible(false);
                    this.levelUpButtonVisible = false;
                    this.levelUpButtonBg.setAlpha(0.5);
                    // Stop pulse animation
                    this.tweens.killTweensOf(this.levelUpButton);
                    this.levelUpButton.setScale(1); // Reset scale
                    // Start hidden period
                    this.levelUpTimer = currentTime;
                }
            }
            // If button is hidden, check if it's time to show it
            else if (!this.levelUpButtonVisible && this.levelUpTimer) {
                const elapsed = currentTime - this.levelUpTimer;
                const waitTime = this.firstLevelUpTimer ? 20000 : 30000; // 20s first, then 30s
                
                if (elapsed >= waitTime) {
                    this.levelUpButton.setVisible(true);
                    this.levelUpButtonVisible = true;
                    this.levelUpButtonBg.setAlpha(1);
                    this.levelUpButtonShowTime = currentTime;
                    this.firstLevelUpTimer = false; // After first time, use 30s
                    
                    // Start pulse animation (scale up and down by 10%)
                    this.tweens.add({
                        targets: this.levelUpButton,
                        scaleX: 1.05,
                        scaleY: 1.05,
                        duration: 300,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        }

        levelUpAll() {
            // Log ad loading to console
            console.log('loading ad');
            
            // Upgrade all batteries in grid
            this.batteries.forEach(battery => {
                if (battery.inGrid) {
                    battery.level += 1;
                    battery.levelText.setText(`LVL ${battery.level}`);
                    
                    // Update battery sprite to match new level
                    const batteryIconLevel = getBatteryIconLevel(battery.level);
                    const batteryIcon = `battery${batteryIconLevel}`;
                    battery.sprite.setTexture(batteryIcon);
                    
                    // Update highest level
                    if (battery.level > this.highestBatteryLevel) {
                        this.highestBatteryLevel = battery.level;
                    }
                }
            });
            
            // Upgrade batteries in charging slots
            for (let i = 0; i < 3; i++) {
                if (this.chargingSlots[i] !== null) {
                    const slot = this.chargingSlotsUI[i];
                    const slotData = this.chargingSlots[i];
                    const newLevel = slotData.level + 1;
                    
                    // Update slot data
                    slotData.level = newLevel;
                    slotData.chargePerMinute = newLevel * 5;
                    
                    // Update batteryData if it exists
                    if (slotData.batteryData) {
                        slotData.batteryData.level = newLevel;
                    }
                    
                    // Update battery sprite to match new level
                    const batteryIconLevel = getBatteryIconLevel(newLevel);
                    const batteryIcon = `battery${batteryIconLevel}`;
                    if (slot.batterySprite) {
                        slot.batterySprite.setTexture(batteryIcon);
                    }
                    
                    // Update UI
                    slot.batteryLevelText.setText(`LVL ${newLevel}`);
                    slot.chargeText.setText(`${newLevel * 5}`);
                }
            }
            
            // Update spawn button
            this.updateSpawnButton();
            
            // Hide button and reset timer
            // Stop pulse animation
            this.tweens.killTweensOf(this.levelUpButton);
            this.levelUpButton.setScale(1); // Reset scale
            this.levelUpButton.setVisible(false);
            this.levelUpButtonVisible = false;
            this.levelUpButtonBg.setAlpha(0.5);
            this.levelUpTimer = this.time.now;
        }

        updateCoinDisplay() {
            this.coinText.setText(`${this.coins}`);
            
            // Update coin icon position to stay next to text
            const coinIconX = this.coinText.x + CONFIG.COIN_COUNTER.TEXT_ICON_SPACING + CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2;
            this.coinIcon.setX(coinIconX);
            
            this.updateSpawnButton();
        }
    }

    const config = {
        type: Phaser.AUTO,
        parent: 'game-container',
        backgroundColor: '#EEF5F8',
        scene: [GameScene],
        
        physics: {
            default: 'matter',
            matter: {
                debug: CONFIG.PHYSICS.DEBUG,
                gravity: { y: CONFIG.PHYSICS.GRAVITY_Y },
                enableSleeping: false,
                timing: {
                    timestamp: 0,
                    timeScale: 1
                },
                positionIterations: CONFIG.PHYSICS.ITERATIONS,
                velocityIterations: CONFIG.PHYSICS.ITERATIONS,
                constraintIterations: CONFIG.PHYSICS.ITERATIONS
            }
        },

        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 720,
            height: 1280,
            resolution: window.devicePixelRatio || 1,
        },

        render: {
            antialias: true,
            pixelArt: false,
        },
    };

    // Initialize battery image paths cache, then create game instance
    if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
        console.log('Checking battery image files...');
        initBatteryImagePaths(20).then(() => {
            console.log('Battery images detected:', BATTERY_IMAGE_PATHS);
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            const game = new Phaser.Game(config);
        });
    }
