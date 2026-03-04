// Parking Jam Scene - Top section with cars getting charged and moving out
class ParkingJamScene extends Phaser.Scene {
    constructor() {
        super('ParkingJamScene');
    }

    init(data) {
        // Level data passed from GameScene
        this.levelData = data.levelData || null;
        
        // Cars in parking lot
        this.cars = [];                     // Array of car objects {sprite, chargeRequired, currentCharge, canMove}
        this.chargingBatteries = [];        // Array of batteries in charging slots (passed from merge scene)
        this.chargingInterval = null;       // Interval for charging
        this.chargingRate = 0;              // Total charging rate (sum of battery values)
        
        // Charging animation
        this.chargingEffects = [];          // Visual charging effects
    }

    preload() {
        // Load vehicle sprites
        this.load.image('car', 'graphics/vehicles/car_1x2.png');
        
        // Load charging effect
        this.load.image('bolt', 'graphics/bolt_64.png');
    }

    create() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // This scene occupies the top half
        const parkingHeight = sceneHeight * 0.5;
        
        // Background for parking area
        this.add.rectangle(sceneWidth / 2, parkingHeight / 2, sceneWidth, parkingHeight, 0xE8F4F8);
        
        // Title
        this.add.text(sceneWidth / 2, 20, 'PARKING JAM', {
            fontSize: '24px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#333333',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Load level if provided
        if (this.levelData && this.levelData.cars) {
            this.loadLevel(this.levelData);
        } else {
            // Show message if no level data
            this.add.text(sceneWidth / 2, parkingHeight / 2, 'No level data loaded\nUse Level Editor to create levels', {
                fontSize: '20px',
                fontFamily: CONFIG.FONT_FAMILY,
                color: '#666666',
                align: 'center'
            }).setOrigin(0.5);
        }
        
        // Button to open level editor
        this.createEditorButton();
    }

    loadLevel(levelData) {
        console.log('Loading level:', levelData);
        
        // Spawn cars from level data
        for (let carData of levelData.cars) {
            this.spawnCar(carData);
        }
        
        // Determine which cars can move initially
        this.updateMovableCars();
        
        // Start charging system
        this.startCharging();
    }

    spawnCar(carData) {
        const carSprite = this.add.sprite(carData.x, carData.y, carData.type);
        carSprite.setOrigin(0.5);
        carSprite.setAngle(carData.rotation);
        carSprite.setScale(0.3); // Adjust as needed
        carSprite.setDepth(10);
        
        // Car object with charging state
        const car = {
            sprite: carSprite,
            type: carData.type,
            chargeRequired: carData.chargeRequired || 100,
            currentCharge: 0,
            canMove: false,
            isCharging: false,
            isMovingOut: false
        };
        
        this.cars.push(car);
        
        // Create charge bar above car
        this.createChargeBar(car);
        
        return car;
    }

    createChargeBar(car) {
        const barWidth = 60;
        const barHeight = 8;
        const offsetY = -40; // Above the car
        
        // Background bar
        const barBg = this.add.rectangle(
            car.sprite.x,
            car.sprite.y + offsetY,
            barWidth,
            barHeight,
            0x888888
        );
        barBg.setOrigin(0, 0.5);
        barBg.setDepth(15);
        
        // Charge bar (green)
        const chargeBar = this.add.rectangle(
            car.sprite.x,
            car.sprite.y + offsetY,
            0,
            barHeight,
            0x4CAF50
        );
        chargeBar.setOrigin(0, 0.5);
        chargeBar.setDepth(16);
        
        // Store references
        car.chargeBarBg = barBg;
        car.chargeBar = chargeBar;
    }

    updateChargeBar(car) {
        if (!car.chargeBar) return;
        
        const barWidth = 60;
        const progress = Math.min(car.currentCharge / car.chargeRequired, 1);
        car.chargeBar.width = barWidth * progress;
    }

    updateMovableCars() {
        // Simple logic: determine which cars can move based on collision detection
        // For now, we'll assume the first uncharged car can move
        // A more sophisticated version would check actual collision/blocking
        
        // Reset all canMove flags
        for (let car of this.cars) {
            car.canMove = false;
        }
        
        // Find first car that isn't moving out and isn't fully charged
        for (let car of this.cars) {
            if (!car.isMovingOut) {
                car.canMove = true;
                break; // Only one car can be charged/moved at a time
            }
        }
    }

    startCharging() {
        // Start charging cycle
        this.chargingInterval = this.time.addEvent({
            delay: 1000, // 1 second interval
            callback: this.chargeCycle,
            callbackScope: this,
            loop: true
        });
    }

    chargeCycle() {
        // Calculate charging rate from batteries in slots
        // This would be received from the merge scene
        // For now, use a default rate
        this.chargingRate = this.calculateChargingRate();
        
        if (this.chargingRate === 0) return; // No batteries in slots
        
        // Find the car that can be charged
        const carToCharge = this.cars.find(car => car.canMove && !car.isMovingOut);
        
        if (!carToCharge) return;
        
        // Charge the car
        carToCharge.currentCharge += this.chargingRate;
        carToCharge.isCharging = true;
        
        // Update charge bar
        this.updateChargeBar(carToCharge);
        
        // Show charging effect
        this.showChargingEffect(carToCharge);
        
        console.log(`Charging car: ${carToCharge.currentCharge}/${carToCharge.chargeRequired}`);
        
        // Check if car is fully charged
        if (carToCharge.currentCharge >= carToCharge.chargeRequired) {
            this.moveOutCar(carToCharge);
        }
    }

    calculateChargingRate() {
        // Get charging rate from batteries
        // This would communicate with GameScene/MergeScene
        // For now, return a default rate for testing
        
        // Access the GameScene to get battery values
        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.chargingSlots) {
            let totalRate = 0;
            for (let battery of gameScene.chargingSlots) {
                if (battery !== null) {
                    totalRate += battery.level; // Battery level = charge units
                }
            }
            return totalRate;
        }
        
        return 0; // No batteries
    }

    showChargingEffect(car) {
        // Create bolt effect near the car
        const bolt = this.add.sprite(car.sprite.x + 30, car.sprite.y, 'bolt');
        bolt.setScale(0.5);
        bolt.setDepth(20);
        bolt.setAlpha(0.8);
        
        // Animate bolt
        this.tweens.add({
            targets: bolt,
            y: car.sprite.y - 20,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                bolt.destroy();
            }
        });
    }

    moveOutCar(car) {
        console.log('Car fully charged! Moving out...');
        
        car.isCharging = false;
        car.isMovingOut = true;
        
        // Hide charge bar
        if (car.chargeBar) car.chargeBar.setVisible(false);
        if (car.chargeBarBg) car.chargeBarBg.setVisible(false);
        
        // Animate car moving out (to the right)
        const sceneWidth = this.cameras.main.width;
        
        this.tweens.add({
            targets: car.sprite,
            x: sceneWidth + 100, // Move off screen
            duration: 2000,
            ease: 'Power1',
            onComplete: () => {
                // Remove car
                car.sprite.destroy();
                if (car.chargeBar) car.chargeBar.destroy();
                if (car.chargeBarBg) car.chargeBarBg.destroy();
                
                // Remove from array
                const index = this.cars.indexOf(car);
                if (index > -1) {
                    this.cars.splice(index, 1);
                }
                
                // Update which cars can move next
                this.updateMovableCars();
                
                // Check win condition
                if (this.cars.length === 0) {
                    this.winLevel();
                }
            }
        });
    }

    winLevel() {
        console.log('Level complete!');
        
        // Show win message
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        const winText = this.add.text(sceneWidth / 2, sceneHeight * 0.25, 'LEVEL COMPLETE!', {
            fontSize: '48px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#4CAF50',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        winText.setDepth(100);
        
        // Stop charging
        if (this.chargingInterval) {
            this.chargingInterval.remove();
        }
    }

    createEditorButton() {
        const sceneWidth = this.cameras.main.width;
        
        // Button to open level editor (top-right corner)
        const editorButton = this.add.rectangle(sceneWidth - 80, 50, 140, 40, 0xFF9800);
        editorButton.setStrokeStyle(2, 0xE65100);
        editorButton.setInteractive({ useHandCursor: true });
        editorButton.setDepth(50);
        
        const editorButtonText = this.add.text(sceneWidth - 80, 50, 'LEVEL EDITOR', {
            fontSize: '14px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        editorButtonText.setDepth(51);
        
        editorButton.on('pointerdown', () => {
            // Switch to level editor
            this.scene.stop('ParkingJamScene');
            this.scene.stop('GameScene');
            this.scene.start('LevelEditorScene');
        });
    }

    update() {
        // Update logic if needed
    }

    // Method to receive batteries from GameScene
    updateChargingSlots(batteries) {
        this.chargingBatteries = batteries;
    }
}
