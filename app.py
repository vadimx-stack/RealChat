import os
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import datetime
import json


load_dotenv()


app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'секретный_ключ_по_умолчанию')
socketio = SocketIO(app, cors_allowed_origins="*")


login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


users = {}
rooms = {
    'общий': {'messages': [], 'users': []}
}


class User(UserMixin):
    def __init__(self, id, username, password):
        self.id = id
        self.username = username
        self.password = password

@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user_id = None
        for uid, user in users.items():
            if user.username == username:
                user_id = uid
                break
                
        if user_id and check_password_hash(users[user_id].password, password):
            login_user(users[user_id])
            return redirect(url_for('chat'))
        
        flash('Неверные учетные данные!')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        
        for user in users.values():
            if user.username == username:
                flash('Имя пользователя уже занято!')
                return render_template('register.html')
        
        
        user_id = str(len(users) + 1)
        hashed_password = generate_password_hash(password)
        users[user_id] = User(user_id, username, hashed_password)
        
        login_user(users[user_id])
        return redirect(url_for('chat'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route('/chat')
@login_required
def chat():
    return render_template('chat.html', username=current_user.username, rooms=rooms.keys())


@socketio.on('connect')
@login_required
def handle_connect():
    emit('status', {'msg': f"{current_user.username} присоединился к чату!"}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        emit('status', {'msg': f"{current_user.username} покинул чат!"}, broadcast=True)

@socketio.on('join')
def handle_join(data):
    if not current_user.is_authenticated:
        return
        
    room = data['room']
    if room not in rooms:
        rooms[room] = {'messages': [], 'users': []}
    
    join_room(room)
    if current_user.username not in rooms[room]['users']:
        rooms[room]['users'].append(current_user.username)
    
    emit('room_data', {
        'room': room,
        'users': rooms[room]['users'],
        'messages': rooms[room]['messages']
    }, to=room)
    
    emit('status', {
        'msg': f"{current_user.username} присоединился к комнате {room}",
        'room': room
    }, to=room)

@socketio.on('leave')
def handle_leave(data):
    if not current_user.is_authenticated:
        return
        
    room = data['room']
    leave_room(room)
    
    if room in rooms and current_user.username in rooms[room]['users']:
        rooms[room]['users'].remove(current_user.username)
    
    emit('status', {
        'msg': f"{current_user.username} покинул комнату {room}",
        'room': room
    }, to=room)

@socketio.on('message')
def handle_message(data):
    if not current_user.is_authenticated:
        return
        
    room = data['room']
    message = {
        'user': current_user.username,
        'text': data['message'],
        'time': datetime.datetime.now().strftime('%H:%M')
    }
    
    
    rooms[room]['messages'].append(message)
    
    
    emit('message', message, to=room)

@socketio.on('ping')
def handle_ping():
    emit('pong')

if __name__ == '__main__':
    
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)

