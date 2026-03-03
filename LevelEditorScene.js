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
        
        // Parking and road dimensions (from config, can be adjusted)
        this.parkingWidth = CONFIG.EDITOR.PARKING_WIDTH;
        this.parkingHeight = CONFIG.EDITOR.PARKING_HEIGHT;
        this.roadWidth = CONFIG.EDITOR.ROAD_WIDTH;
        
        // Colors and transparency
        this.parkingColor = CONFIG.EDITOR.PARKING_COLOR;
        this.parkingAlpha = CONFIG.EDITOR.PARKING_ALPHA;
        this.roadColor = CONFIG.EDITOR.ROAD_COLOR;
        this.roadFillColor = CONFIG.EDITOR.ROAD_FILL_COLOR;
        this.roadFillAlpha = CONFIG.EDITOR.ROAD_FILL_ALPHA;
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
        
        // Draw parking area and road rectangles
        this.createParkingAndRoad();
        
        // Create UI controls at bottom
        this.createControls();
        
        // Create rotation input panel (hidden by default)
        this.createRotationPanel();
        
        // Setup click handler for deselection
        this.input.on('pointerdown', this.onPointerDown, this);
    }

    createParkingAndRoad() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        const editorHeight = sceneHeight * 0.5;
        
        // Center position for parking area (in editor area)
        const centerX = sceneWidth / 2;
        const centerY = editorHeight / 2 + 30; // Slightly below center to account for title
        
        // Road dimensions: inner edge touches parking, extends outward by roadWidth
        // Road center line is at parking edge + roadWidth/2
        const roadCenterWidth = this.parkingWidth + this.roadWidth;
        const roadCenterHeight = this.parkingHeight + this.roadWidth;
        
        // Draw road as thick stroke
        // The road width extends roadWidth/2 on both sides of center line
        // So inner edge is at parking edge, outer edge extends outward
        const roadGraphics = this.add.graphics();
        roadGraphics.lineStyle(this.roadWidth, this.roadFillColor, this.roadFillAlpha);
        roadGraphics.strokeRect(
            centerX - roadCenterWidth / 2,
            centerY - roadCenterHeight / 2,
            roadCenterWidth,
            roadCenterHeight
        );
        roadGraphics.setDepth(1);
        
        // Draw road center line (for reference)
        const roadCenterGraphics = this.add.graphics();
        roadCenterGraphics.lineStyle(2, this.roadColor, 1);
        roadCenterGraphics.strokeRect(
            centerX - roadCenterWidth / 2,
            centerY - roadCenterHeight / 2,
            roadCenterWidth,
            roadCenterHeight
        );
        roadCenterGraphics.setDepth(2);
        
        // Draw parking area rectangle
        const parkingRect = this.add.rectangle(
            centerX,
            centerY,
            this.parkingWidth,
            this.parkingHeight,
            this.parkingColor,
            this.parkingAlpha
        );
        parkingRect.setStrokeStyle(CONFIG.EDITOR.PARKING_BORDER_WIDTH, CONFIG.EDITOR.PARKING_BORDER_COLOR);
        parkingRect.setDepth(3);
        
        // Store references
        this.parkingRect = parkingRect;
        this.roadGraphics = roadGraphics;
        this.roadCenterGraphics = roadCenterGraphics;
        this.parkingCenterX = centerX;
        this.parkingCenterY = centerY;
    }
    
    redrawParkingAndRoad() {
        // Destroy existing graphics
        if (this.roadGraphics) this.roadGraphics.destroy();
        if (this.roadCenterGraphics) this.roadCenterGraphics.destroy();
        if (this.parkingRect) this.parkingRect.destroy();
        
        // Redraw with updated dimensions
        this.createParkingAndRoad();
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
        
        // Dimension controls (left side below editor area)
        this.createDimensionControls();
    }
    
    createDimensionControls() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        const startY = sceneHeight * 0.5 + 280; // Moved down to avoid overlap with rotation panel (at +180)
        const labelX = 60;
        const inputX = 170;
        const lineHeight = 45;
        
        // Title
        this.add.text(labelX, startY - 30, 'PARKING & ROAD:', {
            fontSize: '16px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000',
            fontStyle: 'bold'
        });
        
        // Parking Width control
        this.add.text(labelX, startY, 'Parking Width:', {
            fontSize: '14px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000'
        });
        
        const parkingWidthInput = this.createInput(inputX, startY, this.parkingWidth, (value) => {
            this.parkingWidth = Math.max(100, Math.min(700, value));
            this.redrawParkingAndRoad();
        });
        
        // Parking Height control
        this.add.text(labelX, startY + lineHeight, 'Parking Height:', {
            fontSize: '14px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000'
        });
        
        const parkingHeightInput = this.createInput(inputX, startY + lineHeight, this.parkingHeight, (value) => {
            this.parkingHeight = Math.max(100, Math.min(500, value));
            this.redrawParkingAndRoad();
        });
        
        // Road Width control
        this.add.text(labelX, startY + lineHeight * 2, 'Road Width:', {
            fontSize: '14px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000'
        });
        
        const roadWidthInput = this.createInput(inputX, startY + lineHeight * 2, this.roadWidth, (value) => {
            this.roadWidth = Math.max(5, Math.min(100, value));
            this.redrawParkingAndRoad();
        });
    }
    
    createInput(x, y, defaultValue, onChange) {
        // Create HTML input element
        const input = document.createElement('input');
        input.type = 'number';
        input.value = defaultValue;
        input.style.position = 'absolute';
        input.style.left = '0px';
        input.style.top = '0px';
        input.style.width = '80px';
        input.style.height = '30px';
        input.style.fontSize = '14px';
        input.style.padding = '5px';
        input.style.border = '2px solid #333';
        input.style.borderRadius = '4px';
        
        // Add to game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(input);
            
            // Position relative to game
            const updatePosition = () => {
                const canvas = this.game.canvas;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / this.cameras.main.width;
                const scaleY = canvas.height / this.cameras.main.height;
                input.style.left = (rect.left + x * rect.width / this.cameras.main.width) + 'px';
                input.style.top = (rect.top + y * rect.height / this.cameras.main.height) + 'px';
            };
            updatePosition();
            
            // Update position on resize
            window.addEventListener('resize', updatePosition);
            
            // Handle value changes
            input.addEventListener('change', () => {
                const value = parseInt(input.value) || defaultValue;
                input.value = value;
                onChange(value);
            });
            
            // Store reference to destroy later
            if (!this.inputElements) this.inputElements = [];
            this.inputElements.push(input);
        }
        
        return input;
    }

    createRotationPanel() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Panel background
        this.rotationPanel = this.add.container(sceneWidth / 2, sceneHeight * 0.5 + 180);
        this.rotationPanel.setVisible(false);
        this.rotationPanel.setDepth(20); // Above cars (depth 10)
        
        const panelBg = this.add.rectangle(0, 0, 280, 80, 0xFFFFFF);
        panelBg.setStrokeStyle(3, 0x333333);
        this.rotationPanel.add(panelBg);
        
        // Rotation label
        const rotationLabel = this.add.text(-100, 0, 'Rotation (degrees):', {
            fontSize: '16px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#000000'
        }).setOrigin(0, 0.5);
        this.rotationPanel.add(rotationLabel);
        
        // Create HTML input for rotation
        this.rotationInput = document.createElement('input');
        this.rotationInput.type = 'number';
        this.rotationInput.value = '0';
        this.rotationInput.style.position = 'absolute';
        this.rotationInput.style.width = '80px';
        this.rotationInput.style.height = '30px';
        this.rotationInput.style.fontSize = '16px';
        this.rotationInput.style.padding = '5px';
        this.rotationInput.style.border = '2px solid #333';
        this.rotationInput.style.borderRadius = '4px';
        this.rotationInput.style.textAlign = 'center';
        
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.appendChild(this.rotationInput);
            
            // Will be positioned when panel is shown
            this.rotationInput.style.display = 'none';
            
            // Handle value changes
            this.rotationInput.addEventListener('change', () => {
                const value = parseFloat(this.rotationInput.value) || 0;
                this.setCarRotation(value);
            });
            
            // Store reference
            if (!this.inputElements) this.inputElements = [];
            this.inputElements.push(this.rotationInput);
        }
    }
    
    updateRotationInputPosition() {
        if (!this.rotationInput || !this.rotationPanel.visible) return;
        
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Position input at panel center
        const panelX = sceneWidth / 2 + 60;
        const panelY = sceneHeight * 0.5 + 180;
        
        this.rotationInput.style.left = (rect.left + panelX * rect.width / sceneWidth) + 'px';
        this.rotationInput.style.top = (rect.top + panelY * rect.height / sceneHeight - 15) + 'px';
        this.rotationInput.style.display = 'block';
    }

    spawnCar() {
        const centerX = this.editorBounds.width / 2;
        const centerY = this.editorBounds.height / 2;
        
        // Create car sprite
        const carSprite = this.add.sprite(centerX, centerY, this.selectedCarType);
        carSprite.setOrigin(0.5);
        carSprite.setInteractive({ useHandCursor: true, draggable: true });
        carSprite.setScale(0.3); // Adjust scale as needed
        carSprite.setDepth(10); // Above parking (depth 3) and road (depth 1-2)
        
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
        this.updateRotationInputPosition();
        
        console.log('Selected car:', carData);
    }

    deselectCar() {
        if (this.selectedCar) {
            this.selectedCar.sprite.clearTint();
            this.selectedCar = null;
            this.rotationPanel.setVisible(false);
            if (this.rotationInput) {
                this.rotationInput.style.display = 'none';
            }
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
        if (this.rotationInput) {
            this.rotationInput.style.display = 'none';
        }
        
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
        if (this.rotationInput) {
            this.rotationInput.value = Math.round(normalizedRotation);
        }
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
            parking: {
                width: this.parkingWidth,
                height: this.parkingHeight,
                color: this.parkingColor,
                alpha: this.parkingAlpha,
                borderColor: CONFIG.EDITOR.PARKING_BORDER_COLOR,
                borderWidth: CONFIG.EDITOR.PARKING_BORDER_WIDTH
            },
            road: {
                width: this.roadWidth,
                color: this.roadColor,
                fillColor: this.roadFillColor,
                fillAlpha: this.roadFillAlpha
            },
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
    
    shutdown() {
        // Clean up HTML input elements
        if (this.inputElements) {
            this.inputElements.forEach(input => {
                if (input && input.parentElement) {
                    input.parentElement.removeChild(input);
                }
            });
            this.inputElements = [];
        }
    }
}
