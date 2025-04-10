const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ['websocket', 'polling']
});

let isConnected = false;
let pingInterval;


const messagesContainer = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const roomsList = document.getElementById('rooms-list');
const usersList = document.getElementById('users-list');
const usersCount = document.getElementById('users-count');
const currentRoomDisplay = document.getElementById('current-room');
const newRoomBtn = document.getElementById('new-room-btn');
const newRoomModal = document.getElementById('new-room-modal');
const newRoomForm = document.getElementById('new-room-form');
const closeModalBtn = document.querySelector('.close-modal');
const connectionStatus = document.getElementById('connection-status');
const loadingOverlay = document.getElementById('loading-overlay');


function toggleLoadingSpinner(show, message = 'Подключение к серверу...') {
    const loadingText = loadingOverlay.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = message;
    }
    
    if (show) {
        loadingOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    } else {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
            if (loadingOverlay.classList.contains('hidden')) {
                document.body.style.overflow = ''; 
            }
        }, 300); 
    }
}


let currentRoom = 'общий';
let username = document.querySelector('.username').textContent.trim();


function startPingInterval() {
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (isConnected) {
            socket.emit('ping');
        }
    }, 30000); 
}


function joinRoom(room) {
    
    toggleLoadingSpinner(true, `Переход в комнату ${room}...`);
    
    
    if (currentRoom && isConnected) {
        socket.emit('leave', { room: currentRoom });
        
        
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });
    }
    
    
    if (isConnected) {
        socket.emit('join', { room });
    }
    
    currentRoom = room;
    
    
    currentRoomDisplay.innerHTML = `<i class="fas fa-hashtag"></i> ${room}`;
    
    
    document.querySelector(`.room-item[data-room="${room}"]`)?.classList.add('active');
    
    
    messagesContainer.innerHTML = '';
}


function addMessage(message, isStatus = false) {
    if (isStatus) {
        const statusElement = document.createElement('div');
        statusElement.classList.add('status-message');
        statusElement.textContent = message.msg;
        messagesContainer.appendChild(statusElement);
    } else {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        
        if (message.user === username) {
            messageElement.classList.add('self');
        } else {
            messageElement.classList.add('other');
        }
        
        
        messageElement.innerHTML = `
            <div class="message-info">
                <span class="message-sender">${message.user}</span>
                <span class="message-time">${message.time}</span>
            </div>
            <div class="message-content">${message.text}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
    }
    
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


function updateUsersList(users) {
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.classList.add('user-item');
        userItem.innerHTML = `
            <div class="avatar user-avatar">${user[0].toUpperCase()}</div>
            ${user}
        `;
        usersList.appendChild(userItem);
    });
    
    
    usersCount.textContent = `${users.length} онлайн`;
}


function updateConnectionStatus(status) {
    const statusClasses = {
        'online': { class: 'online', text: 'Онлайн', icon: 'fa-circle' },
        'offline': { class: 'offline', text: 'Оффлайн', icon: 'fa-circle-xmark' },
        'connecting': { class: 'connecting', text: 'Подключение...', icon: 'fa-circle-notch fa-spin' }
    };
    
    const statusInfo = statusClasses[status];
    connectionStatus.className = statusInfo.class;
    connectionStatus.innerHTML = `<i class="fas ${statusInfo.icon}"></i> ${statusInfo.text}`;
}


function reconnectToServer() {
    if (!isConnected) {
        socket.connect();
        updateConnectionStatus('connecting');
    }
}


socket.on('connect', () => {
    console.log('Соединение установлено');
    isConnected = true;
    updateConnectionStatus('online');
    
    
    startPingInterval();
    
    
    if (currentRoom) {
        joinRoom(currentRoom);
    } else {
        
        joinRoom('общий');
    }
    
    
    const disconnectMessage = document.querySelector('.disconnect-message');
    if (disconnectMessage) {
        disconnectMessage.remove();
    }
    
    
    setTimeout(() => {
        toggleLoadingSpinner(false);
    }, 500); 
});

socket.on('connect_error', (error) => {
    console.error('Ошибка соединения:', error);
    isConnected = false;
    updateConnectionStatus('offline');
    
    
    toggleLoadingSpinner(true, 'Ошибка подключения к серверу...');
    
    
    if (!document.querySelector('.disconnect-message')) {
        const statusElement = document.createElement('div');
        statusElement.classList.add('status-message', 'disconnect-message');
        statusElement.textContent = 'Ошибка соединения с сервером. Пытаемся переподключиться...';
        messagesContainer.appendChild(statusElement);
    }
    
    
    setTimeout(reconnectToServer, 5000);
});

socket.on('disconnect', () => {
    console.log('Соединение разорвано');
    isConnected = false;
    updateConnectionStatus('offline');
    
    
    toggleLoadingSpinner(true, 'Соединение потеряно...');
    
    
    clearInterval(pingInterval);
    
    
    if (!document.querySelector('.disconnect-message')) {
        const statusElement = document.createElement('div');
        statusElement.classList.add('status-message', 'disconnect-message');
        statusElement.textContent = 'Соединение с сервером разорвано. Попытка переподключения...';
        messagesContainer.appendChild(statusElement);
    }
});


socket.on('pong', () => {
    console.log('Pong получен от сервера');
});

socket.on('reconnecting', (attemptNumber) => {
    console.log(`Попытка переподключения #${attemptNumber}...`);
    updateConnectionStatus('connecting');
    toggleLoadingSpinner(true, `Попытка переподключения #${attemptNumber}...`);
});

socket.on('reconnect_attempt', () => {
    updateConnectionStatus('connecting');
    toggleLoadingSpinner(true, 'Попытка переподключения...');
});

socket.on('status', (data) => {
    addMessage(data, true);
});

socket.on('message', (message) => {
    addMessage(message);
});

socket.on('room_data', (data) => {
    
    toggleLoadingSpinner(false);
    
    
    messagesContainer.innerHTML = '';
    data.messages.forEach(msg => {
        addMessage(msg);
    });
    
    
    updateUsersList(data.users);
});


messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (message && isConnected) {
        socket.emit('message', { message, room: currentRoom });
        messageInput.value = '';
        messageInput.focus();
    } else if (!isConnected) {
        alert('Нет соединения с сервером. Пожалуйста, дождитесь восстановления соединения.');
    }
});


roomsList.addEventListener('click', (e) => {
    const roomItem = e.target.closest('.room-item');
    if (roomItem && isConnected) {
        const room = roomItem.dataset.room;
        if (room !== currentRoom) {
            joinRoom(room);
        }
    } else if (!isConnected && e.target.closest('.room-item')) {
        alert('Нет соединения с сервером. Пожалуйста, дождитесь восстановления соединения.');
    }
});


document.addEventListener('click', (e) => {
    if (e.target.closest('.disconnect-message') && !isConnected) {
        reconnectToServer();
    }
});


newRoomBtn.addEventListener('click', () => {
    if (isConnected) {
        newRoomModal.classList.add('active');
    } else {
        alert('Нет соединения с сервером. Пожалуйста, дождитесь восстановления соединения.');
    }
});

closeModalBtn.addEventListener('click', () => {
    newRoomModal.classList.remove('active');
});


window.addEventListener('click', (e) => {
    if (e.target === newRoomModal) {
        newRoomModal.classList.remove('active');
    }
});


newRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!isConnected) {
        alert('Нет соединения с сервером. Пожалуйста, дождитесь восстановления соединения.');
        return;
    }
    
    const roomNameInput = document.getElementById('room-name');
    const roomName = roomNameInput.value.trim();
    
    if (roomName) {
        
        const existingRoom = document.querySelector(`.room-item[data-room="${roomName}"]`);
        if (!existingRoom) {
            
            const roomItem = document.createElement('li');
            roomItem.classList.add('room-item');
            roomItem.dataset.room = roomName;
            roomItem.innerHTML = `<i class="fas fa-hashtag"></i> ${roomName}`;
            roomsList.appendChild(roomItem);
            
            
            joinRoom(roomName);
            
            
            newRoomModal.classList.remove('active');
            roomNameInput.value = '';
        } else {
            alert('Комната с таким именем уже существует!');
        }
    }
});


messageInput.addEventListener('focus', () => {
    document.querySelector('.message-input-wrapper').classList.add('focused');
});

messageInput.addEventListener('blur', () => {
    document.querySelector('.message-input-wrapper').classList.remove('focused');
});


function setupMobileKeyboardDetection() {
    
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const chatContainer = document.querySelector('.chat-container');
    
    
    messageInput.addEventListener('focus', () => {
        chatContainer.classList.add('keyboard-open');
        
        setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
            messageInput.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    });
    
    
    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            chatContainer.classList.remove('keyboard-open');
        }, 100);
    });
    
    
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isAndroid) {
        const originalHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            if (currentHeight < originalHeight) {
                
                chatContainer.classList.add('keyboard-open');
                setTimeout(() => messageInput.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                
                chatContainer.classList.remove('keyboard-open');
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', function() {
    
    initDarkMode();
    
    
    if (document.querySelector('.chat-container')) {
        initChat();
    }
    
    
    initForms();
});


function initDarkMode() {
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const icon = this.querySelector('i');
            
            if (document.body.classList.contains('dark-mode')) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
            
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
            
            
            if (window.EmojiMart && document.querySelector('#emoji-picker .em-emoji-picker')) {
                const picker = document.querySelector('#emoji-picker .em-emoji-picker');
                picker.dataset.theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            }
        });
        
        
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            themeToggle.querySelector('i').classList.remove('fa-moon');
            themeToggle.querySelector('i').classList.add('fa-sun');
        }
    }
}


function initForms() {
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function() {
            document.getElementById('loading-overlay').classList.remove('hidden');
        });
        
        
        const passwordToggle = document.querySelector('.password-toggle');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', function() {
                const passwordInput = document.getElementById('password');
                const eyeIcon = this.querySelector('i');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeIcon.classList.remove('fa-eye');
                    eyeIcon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    eyeIcon.classList.remove('fa-eye-slash');
                    eyeIcon.classList.add('fa-eye');
                }
            });
        }
    }
    
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            
            if (password !== confirmPassword) {
                e.preventDefault();
                const flashMessages = document.querySelector('.flash-messages') || document.createElement('div');
                flashMessages.className = 'flash-messages';
                flashMessages.innerHTML = '<div class="flash-message"><i class="fas fa-exclamation-circle"></i> Пароли не совпадают!</div>';
                
                if (!document.querySelector('.flash-messages')) {
                    document.querySelector('.auth-body').insertBefore(flashMessages, document.getElementById('register-form'));
                }
            } else {
                document.getElementById('loading-overlay').classList.remove('hidden');
            }
        });
        
        
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const passwordInput = this.parentElement.querySelector('input');
                const eyeIcon = this.querySelector('i');
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeIcon.classList.remove('fa-eye');
                    eyeIcon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    eyeIcon.classList.remove('fa-eye-slash');
                    eyeIcon.classList.add('fa-eye');
                }
            });
        });
        
        
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                const password = this.value;
                const strengthBar = document.querySelector('.strength-bar');
                const strengthIndicator = document.getElementById('password-strength');
                
                
                let strength = 0;
                if (password.length >= 6) strength += 20;
                if (password.length >= 10) strength += 20;
                if (/[A-Z]/.test(password)) strength += 20;
                if (/[0-9]/.test(password)) strength += 20;
                if (/[^A-Za-z0-9]/.test(password)) strength += 20;
                
                strengthBar.style.width = strength + '%';
                
                if (strength <= 40) {
                    strengthBar.style.backgroundColor = '#ff4d4d';
                } else if (strength <= 80) {
                    strengthBar.style.backgroundColor = '#ffd633';
                } else {
                    strengthBar.style.backgroundColor = '#66cc66';
                }
                
                strengthIndicator.style.display = password ? 'block' : 'none';
            });
        }
    }
}


function initChat() {
    
    window.addEventListener('socketReady', function() {
        console.log('Socket is ready');
        enhanceChat();
    });
    
    
    if (window.socket) {
        enhanceChat();
    }
    
    
    const toggleSidebarBtn = document.querySelector('.toggle-sidebar-btn');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', function() {
            document.querySelector('.chat-container').classList.toggle('sidebar-collapsed');
        });
    }
    
    
    initEmojiPicker();
    
    
    const messagesContainer = document.querySelector('.messages-container');
    const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
    
    if (messagesContainer && scrollBottomBtn) {
        messagesContainer.addEventListener('scroll', function() {
            const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 100;
            scrollBottomBtn.classList.toggle('visible', !isScrolledToBottom);
        });
        
        scrollBottomBtn.addEventListener('click', function() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }
    
    
    const roomSearch = document.getElementById('room-search');
    if (roomSearch) {
        roomSearch.addEventListener('input', function() {
            const searchValue = this.value.toLowerCase();
            const rooms = document.querySelectorAll('#rooms-list .room-item');
            
            rooms.forEach(room => {
                const roomName = room.textContent.trim().toLowerCase();
                room.style.display = roomName.includes(searchValue) ? 'flex' : 'none';
            });
        });
    }
    
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', function() {
            const searchValue = this.value.toLowerCase();
            const users = document.querySelectorAll('#users-list .user-item');
            
            users.forEach(user => {
                const userName = user.textContent.trim().toLowerCase();
                user.style.display = userName.includes(searchValue) ? 'flex' : 'none';
            });
        });
    }
    
    
    setupModals();
}


function initEmojiPicker() {
    const emojiButton = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    
    if (emojiButton && emojiPicker) {
        emojiButton.addEventListener('click', function() {
            emojiPicker.classList.toggle('hidden');
        });
        
        
        if (window.EmojiMart) {
            const picker = new EmojiMart.Picker({
                onEmojiSelect: (emoji) => {
                    const input = document.getElementById('message-input');
                    input.value += emoji.native;
                    input.focus();
                },
                theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light'
            });
            emojiPicker.appendChild(picker);
            
            
            document.addEventListener('click', function(event) {
                if (!emojiPicker.contains(event.target) && !emojiButton.contains(event.target)) {
                    emojiPicker.classList.add('hidden');
                }
            });
        }
    }
}


function enhanceChat() {
    
    const roomItems = document.querySelectorAll('.room-item');
    
    roomItems.forEach(room => {
        room.addEventListener('click', function() {
            
            roomItems.forEach(r => r.classList.remove('active'));
            
            this.classList.add('active');
            
            
            const roomName = this.dataset.room;
            document.getElementById('current-room').innerHTML = `<i class="fas fa-hashtag"></i> ${roomName}`;
            
            
            if (window.innerWidth <= 768) {
                document.querySelector('.chat-container').classList.add('sidebar-collapsed');
            }
        });
    });
    
    
    document.querySelector('#users-list').addEventListener('click', function(e) {
        const userItem = e.target.closest('.user-item');
        if (userItem) {
            openUserProfile(userItem.dataset.username);
        }
    });
    
    
    enhanceMessageDates();
}


function enhanceMessageDates() {
    const messages = document.querySelectorAll('.message');
    
    if (messages.length) {
        let currentDate = null;
        
        messages.forEach(message => {
            const timestamp = message.dataset.timestamp;
            if (timestamp) {
                const messageDate = new Date(parseInt(timestamp));
                const messageDay = messageDate.toDateString();
                
                if (messageDay !== currentDate) {
                    currentDate = messageDay;
                    
                    
                    const today = new Date().toDateString();
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toDateString();
                    
                    let dateLabel = '';
                    if (messageDay === today) {
                        dateLabel = 'Сегодня';
                    } else if (messageDay === yesterdayStr) {
                        dateLabel = 'Вчера';
                    } else {
                        dateLabel = messageDate.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        });
                    }
                    
                    
                    const dateDivider = document.createElement('div');
                    dateDivider.className = 'date-divider';
                    dateDivider.innerHTML = `<span>${dateLabel}</span>`;
                    
                    message.parentNode.insertBefore(dateDivider, message);
                }
            }
        });
    }
}


function setupModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    
    const newRoomBtn = document.getElementById('new-room-btn');
    const newRoomModal = document.getElementById('new-room-modal');
    
    if (newRoomBtn && newRoomModal) {
        newRoomBtn.addEventListener('click', function() {
            newRoomModal.classList.add('active');
        });
    }
    
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    
    window.openUserProfile = function(username) {
        const profileModal = document.getElementById('user-profile-modal');
        
        if (profileModal) {
            const avatar = profileModal.querySelector('.profile-avatar');
            const usernameEl = profileModal.querySelector('.profile-username');
            
            avatar.textContent = username[0].toUpperCase();
            usernameEl.textContent = username;
            
            profileModal.classList.add('active');
        }
    };
}


function addDateDivider(timestamp, container) {
    const date = new Date(timestamp);
    const today = new Date();
    
    let dateText = '';
    
    if (date.toDateString() === today.toDateString()) {
        dateText = 'Сегодня';
    } else {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        
        if (date.toDateString() === yesterday.toDateString()) {
            dateText = 'Вчера';
        } else {
            dateText = date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }
    
    const divider = document.createElement('div');
    divider.className = 'date-divider';
    divider.innerHTML = `<span>${dateText}</span>`;
    
    container.appendChild(divider);
}


document.addEventListener('DOMContentLoaded', () => {
    
    toggleLoadingSpinner(true);
    
    
    if (socket.connected) {
        isConnected = true;
        updateConnectionStatus('online');
        
        setTimeout(() => {
            toggleLoadingSpinner(false);
        }, 1000);
    } else {
        updateConnectionStatus('connecting');
    }
    
    
    document.querySelector(`.room-item[data-room="${currentRoom}"]`)?.classList.add('active');
    
    
    const elementsToAnimate = [
        document.querySelector('.sidebar'),
        document.querySelector('.chat-main')
    ];
    
    let delay = 0;
    elementsToAnimate.forEach(element => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`;
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100);
            
            delay += 0.1;
        }
    });

    
    setupMobileKeyboardDetection();
    
    
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    }
}); 

