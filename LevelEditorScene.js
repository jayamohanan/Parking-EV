// Level Editor Scene - Design parking jam levels
class LevelEditorScene extends Phaser.Scene {
    constructor() {
        super('LevelEditorScene');
    }

    init() {
        this.cars = [];               // Array of placed cars {sprite, type, x, y, rotation}
        this.selectedCar = null;      // Currently selected car
        this.selectedCarType = 'car'; // Current car type from dropdown
        this.isDragging = false;
        this.editorBounds = null;     // Top half area bounds
    }

    preload() {
        // Load all vehicle sprites from graphics/vehicles folder
        this.load.image('car', 'graphics/vehicles/car.png');
        // Add more vehicle types as they become available
    }

    create() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Top half is the editor area (parking lot)
        const editorHeight = sceneHeight * 0.5;
        
        // Background for editor area
        this.add.rectangle(sceneWidth / 2, editorHeight / 2, sceneWidth, editorHeight, 0xCCCCCC);
        
        // Store editor bounds
        this.editorBounds = {
            x: 0,
            y: 0,
            width: sceneWidth,
            height: editorHeight
        };
        
        // Title
        this.add.text(sceneWidth / 2, 20, 'PARKING JAM LEVEL EDITOR', {
            fontSize: '28px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Create UI controls at bottom
        this.createControls();
        
        // Create rotation input panel (hidden by default)
        this.createRotationPanel();
        
        // Setup click handler for deselection
        this.input.on('pointerdown', this.onPointerDown, this);
    }

    createControls() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        const controlY = sceneHeight * 0.5 + 50; // Just below the editor area
        
        // Create dropdown area for car selection
        const dropdownBg = this.add.rectangle(100, controlY, 180, 50, 0x4CAF50);
        dropdownBg.setStrokeStyle(3, 0x2E7D32);
        dropdownBg.setInteractive({ useHandCursor: true });
        
        this.carTypeText = this.add.text(100, controlY, 'Car: car', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Note: In a full implementation, this would open actual dropdown
        // For now, it's a simple label showing the selected car type
        
        // Spawn Car button
        const spawnButton = this.add.rectangle(300, controlY, 150, 50, 0x2196F3);
        spawnButton.setStrokeStyle(3, 0x1565C0);
        spawnButton.setInteractive({ useHandCursor: true });
        
        const spawnButtonText = this.add.text(300, controlY, 'SPAWN CAR', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        spawnButton.on('pointerdown', () => this.spawnCar());
        
        // Copy Level Data button
        const copyButton = this.add.rectangle(sceneWidth - 120, controlY, 200, 50, 0xFF9800);
        copyButton.setStrokeStyle(3, 0xE65100);
        copyButton.setInteractive({ useHandCursor: true });
        
        const copyButtonText = this.add.text(sceneWidth - 120, controlY, 'COPY LEVEL DATA', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        copyButton.on('pointerdown', () => this.copyLevelData());
        
        // Delete Selected button
        const deleteButton = this.add.rectangle(sceneWidth - 120, controlY + 70, 200, 50, 0xF44336);
        deleteButton.setStrokeStyle(3, 0xC62828);
        deleteButton.setInteractive({ useHandCursor: true });
        
        const deleteButtonText = this.add.text(sceneWidth - 120, controlY + 70, 'DELETE SELECTED', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        deleteButton.on('pointerdown', () => this.deleteSelectedCar());
        
        // Back to Game button
        const backButton = this.add.rectangle(sceneWidth / 2, sceneHeight - 40, 180, 50, 0x607D8B);
        backButton.setStrokeStyle(3, 0x37474F);
        backButton.setInteractive({ useHandCursor: true });
        
        const backButtonText = this.add.text(sceneWidth / 2, sceneHeight - 40, 'BACK TO GAME', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        backButton.on('pointerdown', () => {
            this.scene.stop('LevelEditorScene');
            this.scene.start('GameScene');
        });
    }

    createRotationPanel() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Panel background
        this.rotationPanel = this.add.container(sceneWidth / 2, sceneHeight * 0.5 + 180);
        this.rotationPanel.setVisible(false);
        
        const panelBg = this.add.rectangle(0, 0, 280, 100, 0xFFFFFF);
        panelBg.setStrokeStyle(3, 0x333333);
        this.rotationPanel.add(panelBg);
        
        // Rotation label
        const rotationLabel = this.add.text(-120, -20, 'Rotation:', {
            fontSize: '18px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000'
        }).setOrigin(0, 0.5);
        this.rotationPanel.add(rotationLabel);
        
        // Rotation value display
        this.rotationValueText = this.add.text(0, -20, '0°', {
            fontSize: '20px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rotationPanel.add(this.rotationValueText);
        
        // Rotation buttons
        const rotateLeftBtn = this.add.rectangle(-80, 25, 60, 40, 0x2196F3);
        rotateLeftBtn.setStrokeStyle(2, 0x1565C0);
        rotateLeftBtn.setInteractive({ useHandCursor: true });
        this.rotationPanel.add(rotateLeftBtn);
        
        const rotateLeftText = this.add.text(-80, 25, '-15°', {
            fontSize: '16px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rotationPanel.add(rotateLeftText);
        
        const rotateRightBtn = this.add.rectangle(80, 25, 60, 40, 0x2196F3);
        rotateRightBtn.setStrokeStyle(2, 0x1565C0);
        rotateRightBtn.setInteractive({ useHandCursor: true });
        this.rotationPanel.add(rotateRightBtn);
        
        const rotateRightText = this.add.text(80, 25, '+15°', {
            fontSize: '16px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rotationPanel.add(rotateRightText);
        
        // Reset rotation button
        const resetBtn = this.add.rectangle(0, 25, 60, 40, 0x4CAF50);
        resetBtn.setStrokeStyle(2, 0x2E7D32);
        resetBtn.setInteractive({ useHandCursor: true });
        this.rotationPanel.add(resetBtn);
        
        const resetText = this.add.text(0, 25, '0°', {
            fontSize: '16px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rotationPanel.add(resetText);
        
        // Rotation button handlers
        rotateLeftBtn.on('pointerdown', () => this.rotateCar(-15));
        rotateRightBtn.on('pointerdown', () => this.rotateCar(15));
        resetBtn.on('pointerdown', () => this.setCarRotation(0));
    }

    spawnCar() {
        const centerX = this.editorBounds.width / 2;
        const centerY = this.editorBounds.height / 2;
        
        // Create car sprite
        const carSprite = this.add.sprite(centerX, centerY, this.selectedCarType);
        carSprite.setOrigin(0.5);
        carSprite.setInteractive({ useHandCursor: true, draggable: true });
        carSprite.setScale(0.3); // Adjust scale as needed
        
        // Store car data
        const carData = {
            sprite: carSprite,
            type: this.selectedCarType,
            x: centerX,
            y: centerY,
            rotation: 0
        };
        
        this.cars.push(carData);
        
        // Setup drag handlers
        carSprite.on('drag', (pointer, dragX, dragY) => {
            // Constrain to editor bounds
            const constrainedX = Phaser.Math.Clamp(dragX, 0, this.editorBounds.width);
            const constrainedY = Phaser.Math.Clamp(dragY, 0, this.editorBounds.height);
            
            carSprite.x = constrainedX;
            carSprite.y = constrainedY;
            carData.x = constrainedX;
            carData.y = constrainedY;
        });
        
        carSprite.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) return;
            this.selectCar(carData);
        });
        
        // Auto-select the newly spawned car
        this.selectCar(carData);
        
        console.log('Spawned car at:', centerX, centerY);
    }

    selectCar(carData) {
        // Deselect previous
        if (this.selectedCar) {
            this.selectedCar.sprite.clearTint();
        }
        
        // Select new car
        this.selectedCar = carData;
        this.selectedCar.sprite.setTint(0x88FF88); // Green tint for selected
        
        // Show rotation panel
        this.rotationPanel.setVisible(true);
        this.updateRotationDisplay();
        
        console.log('Selected car:', carData);
    }

    deselectCar() {
        if (this.selectedCar) {
            this.selectedCar.sprite.clearTint();
            this.selectedCar = null;
            this.rotationPanel.setVisible(false);
        }
    }

    deleteSelectedCar() {
        if (!this.selectedCar) return;
        
        // Remove from array
        const index = this.cars.indexOf(this.selectedCar);
        if (index > -1) {
            this.cars.splice(index, 1);
        }
        
        // Destroy sprite
        this.selectedCar.sprite.destroy();
        
        // Deselect
        this.selectedCar = null;
        this.rotationPanel.setVisible(false);
        
        console.log('Deleted car. Remaining cars:', this.cars.length);
    }

    rotateCar(degrees) {
        if (!this.selectedCar) return;
        
        this.selectedCar.rotation += degrees;
        this.selectedCar.rotation = this.selectedCar.rotation % 360;
        this.selectedCar.sprite.angle = this.selectedCar.rotation;
        
        this.updateRotationDisplay();
    }

    setCarRotation(degrees) {
        if (!this.selectedCar) return;
        
        this.selectedCar.rotation = degrees;
        this.selectedCar.sprite.angle = degrees;
        
        this.updateRotationDisplay();
    }

    updateRotationDisplay() {
        if (!this.selectedCar) return;
        
        const normalizedRotation = ((this.selectedCar.rotation % 360) + 360) % 360;
        this.rotationValueText.setText(`${Math.round(normalizedRotation)}°`);
    }

    onPointerDown(pointer) {
        // Check if clicked outside of any car or UI element
        // This will deselect the current car
        if (!pointer.leftButtonDown()) return;
        
        // Don't deselect if clicking on a car (handled by car's own handler)
        let clickedOnCar = false;
        for (let carData of this.cars) {
            if (carData.sprite.getBounds().contains(pointer.x, pointer.y)) {
                clickedOnCar = true;
                break;
            }
        }
        
        // Deselect if clicked on empty space in editor area
        if (!clickedOnCar && pointer.y < this.editorBounds.height) {
            this.deselectCar();
        }
    }

    copyLevelData() {
        // Generate level data JSON
        const levelData = {
            cars: this.cars.map(carData => ({
                type: carData.type,
                x: Math.round(carData.x),
                y: Math.round(carData.y),
                rotation: Math.round(carData.rotation),
                chargeRequired: 100 // Default charge required
            }))
        };
        
        const jsonString = JSON.stringify(levelData, null, 2);
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(jsonString).then(() => {
                console.log('Level data copied to clipboard!');
                this.showCopyConfirmation();
            }).catch(err => {
                console.error('Failed to copy:', err);
                // Fallback: show data in console
                console.log('Level data:');
                console.log(jsonString);
                alert('Copy failed. Check console for level data.');
            });
        } else {
            // Fallback for browsers without clipboard API
            console.log('Level data:');
            console.log(jsonString);
            alert('Clipboard not available. Check console for level data.');
        }
    }

    showCopyConfirmation() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Show temporary confirmation message
        const confirmText = this.add.text(sceneWidth / 2, sceneHeight * 0.5 - 100, 'COPIED!', {
            fontSize: '48px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#4CAF50',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Fade out and destroy
        this.tweens.add({
            targets: confirmText,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                confirmText.destroy();
            }
        });
    }

    update() {
        // Update logic if needed
    }
}
