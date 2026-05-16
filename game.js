import { database, ref, onValue, update, get } from './firebase-config.js';

// Game State
const gameState = {
    currentUser: null,
    userId: null,
    players: {},
    avatarCache: {}, // Cache for loaded avatar images
    canvas: null,
    ctx: null,
    camera: { x: 0, y: 0 },
    keys: {},
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    selectedUser: null, // For login selection
    positionInitialized: false // To prevent resets
};

// Constants - Colors from provided palette
const COLORS = {
    snow: '#faf9f7',
    raisin: '#262626',
    carmine: '#f04e3a',
    saffron: '#f4c82b',
    verdigris: '#3bb9ab',
    blue: '#086fb6'
};

const PLAYER_SIZE = 70;
const MOVE_SPEED = 4;
const SPAWN_RADIUS = 150;

// Initialize game
function init() {
    setupUserSelection();
    setupModal();
}

// Setup User Selection UI
function setupUserSelection() {
    const userListContainer = document.getElementById('user-list');
    const errorMsg = document.getElementById('error-msg');
    
    // Listen to Firebase for all users to populate the selection list
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        
        // If already logged in, don't update selection list
        if (gameState.userId) return;

        if (!users) {
            userListContainer.innerHTML = '<div class="loading-users">لا يوجد مستخدمون متصلون حالياً.</div>';
            return;
        }

        const onlineUsers = Object.entries(users).filter(([_, data]) => data.status === 'in-voice');

        if (onlineUsers.length === 0) {
            userListContainer.innerHTML = '<div class="loading-users">لا يوجد مستخدمون في قنوات الصوت حالياً. انضم لقناة في ديسكورد لتظهر هنا!</div>';
            return;
        }

        userListContainer.innerHTML = '';
        onlineUsers.forEach(([userId, userData]) => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            
            const avatarHtml = userData.avatar 
                ? `<img src="${userData.avatar}" alt="${userData.username}">`
                : `<div class="placeholder-avatar">${userData.username.charAt(0).toUpperCase()}</div>`;

            userItem.innerHTML = `
                <div class="avatar-circle">
                    ${avatarHtml}
                </div>
                <div class="name">${userData.username}</div>
                <div class="channel">${userData.channelName || 'قناة صوتية'}</div>
            `;

            userItem.addEventListener('click', () => {
                showConfirmModal({ userId, ...userData });
            });

            userListContainer.appendChild(userItem);
        });
    });
}

// Modal handling
function setupModal() {
    const modal = document.getElementById('confirm-modal');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        gameState.selectedUser = null;
    });

    confirmBtn.addEventListener('click', () => {
        if (gameState.selectedUser) {
            startGame(gameState.selectedUser);
            modal.classList.remove('active');
        }
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            gameState.selectedUser = null;
        }
    });
}

function showConfirmModal(userData) {
    gameState.selectedUser = userData;
    const modal = document.getElementById('confirm-modal');
    const nameElem = document.getElementById('confirm-name');
    const channelElem = document.getElementById('confirm-channel');
    const avatarImg = document.getElementById('confirm-avatar');

    nameElem.textContent = userData.username;
    channelElem.textContent = userData.channelName || 'قناة صوتية';
    avatarImg.src = userData.avatar || '';
    
    modal.classList.add('active');
}

// Start the game
function startGame(userData) {
    gameState.currentUser = userData.username;
    gameState.userId = userData.userId;

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    document.getElementById('current-user').textContent = userData.username;
    document.getElementById('channel-name').textContent = userData.channelName || 'قناة غير معروفة';

    gameState.canvas = document.getElementById('game-canvas');
    gameState.ctx = gameState.canvas.getContext('2d');
    resizeCanvas();

    setupControls();
    setupLogout();
    listenToPlayers();
    
    // Position will be initialized via listenToPlayers or the explicit call
    // But we'll wait a bit for listenToPlayers to get the current state
    setTimeout(() => {
        if (!gameState.positionInitialized) {
            initializePlayerPosition();
        }
    }, 500);
    
    gameLoop();
}

function resizeCanvas() {
    if (!gameState.canvas) return;
    gameState.canvas.width = window.innerWidth;
    gameState.canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);

function setupControls() {
    window.addEventListener('keydown', (e) => {
        gameState.keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
        gameState.keys[e.key.toLowerCase()] = false;
    });

    const canvas = gameState.canvas;
    canvas.addEventListener('mousedown', (e) => {
        gameState.isDragging = true;
        gameState.dragStart = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (gameState.isDragging) {
            const dx = e.clientX - gameState.dragStart.x;
            const dy = e.clientY - gameState.dragStart.y;
            gameState.camera.x += dx;
            gameState.camera.y += dy;
            gameState.dragStart = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('mouseup', () => gameState.isDragging = false);
    canvas.addEventListener('mouseleave', () => gameState.isDragging = false);
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        window.location.reload();
    });
}

function initializePlayerPosition() {
    if (gameState.positionInitialized) return;
    
    const player = gameState.players[gameState.userId];
    
    // Check if we have a non-zero position in player object
    const hasValidPos = player && (player.x !== 0 || player.y !== 0);
    
    if (!hasValidPos) {
        const spawnX = (Math.random() - 0.5) * SPAWN_RADIUS;
        const spawnY = (Math.random() - 0.5) * SPAWN_RADIUS;
        
        if (player) {
            player.x = spawnX;
            player.y = spawnY;
        } else {
            // Create a dummy local player if not loaded yet
            gameState.players[gameState.userId] = {
                userId: gameState.userId,
                username: gameState.currentUser,
                x: spawnX,
                y: spawnY
            };
        }
        updatePlayerPosition(spawnX, spawnY);
    }
    
    gameState.positionInitialized = true;
}

function listenToPlayers() {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        if (users) {
            for (const [userId, userData] of Object.entries(users)) {
                const isCurrentUser = userId === gameState.userId;
                
                if (userData.status === 'in-voice') {
                    // If player doesn't exist locally, create them
                    if (!gameState.players[userId]) {
                        gameState.players[userId] = {
                            userId,
                            username: userData.username,
                            channelName: userData.channelName,
                            avatar: userData.avatar,
                            x: userData.x || 0,
                            y: userData.y || 0
                        };
                        
                        if (isCurrentUser && (userData.x !== undefined && userData.x !== null)) {
                            gameState.positionInitialized = true;
                        }
                    } else {
                        // Update existing player info
                        const player = gameState.players[userId];
                        player.username = userData.username;
                        player.channelName = userData.channelName;
                        player.avatar = userData.avatar;
                        
                        // ONLY update position if NOT the current user
                        // OR if the current user hasn't been initialized locally yet
                        if (!isCurrentUser) {
                            player.x = userData.x || 0;
                            player.y = userData.y || 0;
                        } else if (!gameState.positionInitialized) {
                            if (userData.x !== undefined && userData.x !== null && (userData.x !== 0 || userData.y !== 0)) {
                                player.x = userData.x;
                                player.y = userData.y;
                                gameState.positionInitialized = true;
                            }
                        }
                    }
                    
                    // Preload avatar if not in cache
                    if (userData.avatar && !gameState.avatarCache[userId]) {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.src = userData.avatar;
                        img.onload = () => {
                            gameState.avatarCache[userId] = img;
                        };
                        img.onerror = () => {
                            gameState.avatarCache[userId] = 'failed';
                        };
                    }
                } else if (!isCurrentUser) {
                    // Player is offline, remove them (but never remove current user)
                    delete gameState.players[userId];
                }
            }

            // Cleanup any players who are no longer in the snapshot at all
            Object.keys(gameState.players).forEach(id => {
                const isCurrentUser = id === gameState.userId;
                if (!isCurrentUser && (!users[id] || users[id].status !== 'in-voice')) {
                    delete gameState.players[id];
                }
            });

            const playerCount = Object.keys(gameState.players).length;
            const countElem = document.getElementById('player-count');
            if (countElem) {
                countElem.textContent = `${playerCount} مستخدم${playerCount > 10 ? '' : (playerCount > 2 ? 'ين' : '')}`;
            }
        }
    });
}

function updatePlayerPosition(x, y) {
    if (!gameState.userId) return;
    const updates = {};
    updates[`users/${gameState.userId}/x`] = x;
    updates[`users/${gameState.userId}/y`] = y;
    update(ref(database), updates);
}

function handleMovement() {
    const player = gameState.players[gameState.userId];
    if (!player) return;

    let dx = 0;
    let dy = 0;

    if (gameState.keys['w'] || gameState.keys['arrowup']) dy -= MOVE_SPEED;
    if (gameState.keys['s'] || gameState.keys['arrowdown']) dy += MOVE_SPEED;
    if (gameState.keys['a'] || gameState.keys['arrowleft']) dx -= MOVE_SPEED;
    if (gameState.keys['d'] || gameState.keys['arrowright']) dx += MOVE_SPEED;

    if (dx !== 0 || dy !== 0) {
        player.x += dx;
        player.y += dy;
        updatePlayerPosition(player.x, player.y);
    }
}

function gameLoop() {
    handleMovement();
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    if (!ctx) return;

    ctx.fillStyle = COLORS.snow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawConnections();
    drawPlayers();
}

function drawGrid() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    const gridSize = 60;

    ctx.strokeStyle = 'rgba(38, 38, 38, 0.04)';
    ctx.lineWidth = 1;

    const startX = (gameState.camera.x % gridSize);
    const startY = (gameState.camera.y % gridSize);

    for (let x = startX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawConnections() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const channelGroups = {};
    for (const player of Object.values(gameState.players)) {
        if (!channelGroups[player.channelName]) {
            channelGroups[player.channelName] = [];
        }
        channelGroups[player.channelName].push(player);
    }

    ctx.strokeStyle = 'rgba(8, 111, 182, 0.15)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;

    for (const players of Object.values(channelGroups)) {
        if (players.length > 1) {
            for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                    const p1 = players[i];
                    const p2 = players[j];
                    ctx.beginPath();
                    ctx.moveTo(centerX + p1.x + gameState.camera.x, centerY + p1.y + gameState.camera.y);
                    ctx.lineTo(centerX + p2.x + gameState.camera.x, centerY + p2.y + gameState.camera.y);
                    ctx.stroke();
                }
            }
        }
    }
    ctx.setLineDash([]);
}

function drawPlayers() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (const player of Object.values(gameState.players)) {
        const screenX = centerX + player.x + gameState.camera.x;
        const screenY = centerY + player.y + gameState.camera.y;
        const isCurrentUser = player.userId === gameState.userId;

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.arc(screenX, screenY, (PLAYER_SIZE / 2) + 4, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentUser ? COLORS.blue : '#ffffff';
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(screenX, screenY, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();

        const img = gameState.avatarCache[player.userId];
        if (img && img !== 'failed') {
            try {
                ctx.drawImage(img, screenX - PLAYER_SIZE / 2, screenY - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
            } catch (e) {
                ctx.fillStyle = isCurrentUser ? COLORS.blue : COLORS.verdigris;
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px Rubik';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(player.username.charAt(0).toUpperCase(), screenX, screenY);
            }
        } else {
            ctx.fillStyle = isCurrentUser ? COLORS.blue : COLORS.verdigris;
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Rubik';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(player.username.charAt(0).toUpperCase(), screenX, screenY);
        }
        ctx.restore();

        ctx.fillStyle = COLORS.raisin;
        ctx.font = '500 14px Rubik';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, screenX, screenY + PLAYER_SIZE / 2 + 25);
        
        if (isCurrentUser) {
            ctx.fillStyle = COLORS.blue;
            ctx.font = '700 10px Rubik';
            ctx.fillText('أنت', screenX, screenY - PLAYER_SIZE / 2 - 15);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
