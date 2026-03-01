// Merge Scene - Bottom Section with 3x3 Grid
class MergeScene extends Phaser.Scene {
    constructor() {
        super('MergeScene');
    }

    init() {
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
        this.mergeTutorialShown = false;    // Track if merge tutorial has been shown
        this.mergeOverlay = null;           // Reference to merge tutorial overlay
        
        // Grid layout constants (can be overridden by CONFIG.CELL)
        this.CELL_SIZE = CONFIG.CELL.SIZE;
        this.CELL_GAP = CONFIG.CELL.GAP;
        this.CELL_RADIUS = CONFIG.CELL.RADIUS;
        this.GRID_COLS = 3;
        this.GRID_ROWS = 3;
    }

    preload() {
        // Load battery images with extension fallback (from pre-initialized cache)
        loadBatteryImagesFromCache(this, 20);
        
        this.load.image('coin', 'graphics/coin.svg');
        this.load.image('point', 'graphics/point.png');
        this.load.image('button', 'graphics/Button.png');
    }

    create() {
        // Get scene dimensions (portrait: bottom half)
        const sceneHeight = this.cameras.main.height;
        const sceneWidth = this.cameras.main.width;
        
        // Background for merge section
        this.add.rectangle(sceneWidth / 2, sceneHeight / 2, sceneWidth, sceneHeight, 0xEEF5F8);
        
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
        
        // Setup input handlers
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);
    }

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
        spawnBg.setDisplaySize(CONFIG.BUTTON.SPAWN_WIDTH, CONFIG.BUTTON.SPAWN_HEIGHT);
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
        
        // Create overlay in MergeScene (bottom half)
        this.startOverlay = this.add.rectangle(
            sceneWidth / 2,
            sceneHeight / 2,
            sceneWidth,
            sceneHeight,
            0x000000,
            0.6
        );
        
        // Create overlay in VehicleScene (top half)
        const vehicleScene = this.scene.get('VehicleScene');
        this.startOverlayVehicle = vehicleScene.add.rectangle(
            sceneWidth / 2,
            sceneHeight / 2,
            sceneWidth,
            sceneHeight,
            0x000000,
            0.6
        );
        this.startOverlayVehicle.setDepth(100);
        
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
            if (this.startOverlayVehicle) {
                this.startOverlayVehicle.destroy();
            }
            this.startOverlay = null;
            this.hasStartedPlaying = true;
            
            // Start level-up timer (20 seconds for first appearance)
            this.levelUpTimer = this.time.now;
            this.firstLevelUpTimer = true;
        }
    }
    
    checkAndShowMergeTutorial() {
        // Show merge tutorial when second battery is spawned
        if (!this.mergeTutorialShown && this.batteries.length === 2 && !this.mergeOverlay) {
            this.mergeTutorialShown = true;
            this.createMergeTutorial();
        }
    }
    
    createMergeTutorial() {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        // Create overlay in MergeScene (bottom half)
        this.mergeOverlay = this.add.rectangle(
            sceneWidth / 2,
            sceneHeight / 2,
            sceneWidth,
            sceneHeight,
            0x000000,
            0.6
        );
        
        // Create overlay in VehicleScene (top half)
        const vehicleScene = this.scene.get('VehicleScene');
        this.mergeOverlayVehicle = vehicleScene.add.rectangle(
            sceneWidth / 2,
            sceneHeight / 2,
            sceneWidth,
            sceneHeight,
            0x000000,
            0.6
        );
        this.mergeOverlayVehicle.setDepth(100);
        
        // Get positions of first two cells (0,0) and (0,1)
        const cell1X = this.gridStartX;
        const cell1Y = this.gridStartY;
        const cell2X = this.gridStartX + (this.CELL_SIZE + this.CELL_GAP);
        const cell2Y = this.gridStartY;
        
        // Create pointer positioned below the first cell center
        const pointerStartY = cell1Y + CONFIG.MERGE_TUTORIAL.POINTER_OFFSET_Y;
        const mergePointer = this.add.image(
            cell1X,
            pointerStartY,
            'point'
        );
        mergePointer.setScale(CONFIG.POINTER.SCALE);
        mergePointer.setTint(CONFIG.POINTER.TINT);
        mergePointer.setOrigin(0.5, 0);  // Origin at top center
        
        // Animate pointer from cell 1 to cell 2 horizontally
        this.tweens.add({
            targets: mergePointer,
            x: cell2X,
            duration: CONFIG.MERGE_TUTORIAL.ANIMATION_DURATION,
            ease: CONFIG.MERGE_TUTORIAL.ANIMATION_EASE,
            yoyo: true,
            repeat: CONFIG.MERGE_TUTORIAL.ANIMATION_REPEAT
        });
        
        // Set depths
        this.mergeOverlay.setDepth(100);
        // Set depth for grid cells
        this.gridCells.forEach(row => row.forEach(cellData => {
            cellData.cell.setDepth(101);
            cellData.filledBg.setDepth(101);
        }));
        this.batteries.forEach(battery => battery.sprite.setDepth(101));
        mergePointer.setDepth(102);
        
        this.mergePointer = mergePointer;
    }
    
    removeMergeTutorial() {
        if (this.mergeOverlay) {
            this.mergeOverlay.destroy();
            this.mergePointer.destroy();
            if (this.mergeOverlayVehicle) {
                this.mergeOverlayVehicle.destroy();
            }
            this.mergeOverlay = null;
            
            // Reset depths
            this.gridCells.forEach(row => row.forEach(cellData => {
                cellData.cell.setDepth(0);
                cellData.filledBg.setDepth(0);
            }));
            this.batteries.forEach(battery => battery.sprite.setDepth(10));
        }
    }

    spawnBattery() {
        // Check if player can afford
        if (this.coins < this.spawnCost) {
            this.showMessage('Not enough coins!');
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
        
        return batteryData;
    }

    onDragStart(pointer, gameObject) {
        if (!gameObject.getData('batteryData')) return;
        
        const batteryData = gameObject.getData('batteryData');
        this.draggingBattery = batteryData;
        
        // Bring to front with very high depth (above both scenes)
        batteryData.draggableBg.setDepth(10000);
        batteryData.sprite.setDepth(10001);
        batteryData.levelText.setDepth(10002);
        
        // Remove start overlay on first drag
        if (this.startOverlay) {
            this.removeStartOverlay();
        }
        
        // Remove merge tutorial overlay on first drag
        if (this.mergeOverlay) {
            this.removeMergeTutorial();
        }
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        if (!gameObject.getData('batteryData')) return;
        
        const batteryData = gameObject.getData('batteryData');
        
        // Move all battery elements together (draggableBg, sprite, and text)
        batteryData.draggableBg.x = dragX;
        batteryData.draggableBg.y = dragY;
        batteryData.sprite.x = dragX;
        batteryData.sprite.y = dragY;
        batteryData.levelText.setPosition(dragX, dragY + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET);
        
        // Check if battery left original cell
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
    }

    onDragEnd(pointer, gameObject) {
        if (!gameObject.getData('batteryData')) return;
        
        const batteryData = gameObject.getData('batteryData');
        const dropX = batteryData.sprite.x;
        const dropY = batteryData.sprite.y;
        
        // Find which cell was dropped on
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
        
        this.draggingBattery = null;
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
        }
        
        // Update position
        batteryData.row = newRow;
        batteryData.col = newCol;
        this.grid[newRow][newCol] = batteryData;
        
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

    removeBattery(batteryData) {
        // Remove from grid
        if (batteryData.inGrid) {
            this.grid[batteryData.row][batteryData.col] = null;
            this.gridCells[batteryData.row][batteryData.col].filledBg.setVisible(false);
            this.gridCells[batteryData.row][batteryData.col].isEmpty = true;
        }
        
        // Remove from batteries array
        const index = this.batteries.indexOf(batteryData);
        if (index > -1) {
            this.batteries.splice(index, 1);
        }
        
        // Destroy all elements
        batteryData.draggableBg.destroy();
        batteryData.sprite.destroy();
        batteryData.levelText.destroy();
    }

    returnBatteryToPosition(batteryData) {
        batteryData.draggableBg.setDepth(0);
        batteryData.sprite.setDepth(1);
        batteryData.levelText.setDepth(2);
        
        // If battery is in grid, ensure background is visible
        if (batteryData.inGrid) {
            this.gridCells[batteryData.row][batteryData.col].filledBg.setVisible(true);
            this.gridCells[batteryData.row][batteryData.col].isEmpty = false;
        }
        
        // Animate draggable background back to original position (cell center)
        this.tweens.add({
            targets: batteryData.draggableBg,
            x: batteryData.originalX,
            y: batteryData.originalY - CONFIG.CELL.BATTERY_Y_OFFSET,
            duration: 200,
            ease: 'Back.easeOut'
        });
        
        // Animate battery sprite back to original position
        this.tweens.add({
            targets: batteryData.sprite,
            x: batteryData.originalX,
            y: batteryData.originalY,
            duration: 200,
            ease: 'Back.easeOut'
        });
        
        // Animate level text back to original position
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
        // Level 9 -> button level 2 (20 coins)
        // Level 10 -> button level 3 (30 coins)
        // Level 11 -> button level 4 (40 coins)
        // etc.
        
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
            this.spawnButtonBg.setFillStyle(0x888888);
            this.spawnButtonBg.disableInteractive();
        } else {
            this.spawnButtonBg.setFillStyle(CONFIG.BUTTON.SPAWN_COLOR);
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
        
        // Update spawn button
        this.updateSpawnButton();
        
        // Hide button and reset timer
        this.levelUpButton.setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonBg.setAlpha(0.5);
        this.levelUpTimer = this.time.now;
        
        // TODO: Also upgrade batteries in charging slots (Section 2)
        // This will be handled when we integrate with VehicleScene
    }

    updateCoinDisplay() {
        this.coinText.setText(`${this.coins}`);
        
        // Update coin icon position to stay next to text
        const coinIconX = this.coinText.x + CONFIG.COIN_COUNTER.TEXT_ICON_SPACING + CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2;
        this.coinIcon.setX(coinIconX);
        
        this.updateSpawnButton();
    }

    showMessage(text) {
        const sceneWidth = this.cameras.main.width;
        const sceneHeight = this.cameras.main.height;
        
        const messageBg = this.add.rectangle(sceneWidth / 2, sceneHeight / 2, 300, 100, 0x000000, 0.8);
        messageBg.setDepth(200);
        
        const messageText = this.add.text(sceneWidth / 2, sceneHeight / 2, text, {
            fontSize: '24px',
            fontFamily: CONFIG.FONT_FAMILY,
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5).setDepth(201);
        
        this.time.delayedCall(2000, () => {
            messageBg.destroy();
            messageText.destroy();
        });
    }

    // Method to get battery data for charging slots (will be called from VehicleScene)
    getBatteryForCharging(level) {
        // Find a battery of the requested level in the grid
        for (let battery of this.batteries) {
            if (battery.inGrid && battery.level === level) {
                return battery;
            }
        }
        return null;
    }

    update() {
        // Update loop if needed
    }
}
