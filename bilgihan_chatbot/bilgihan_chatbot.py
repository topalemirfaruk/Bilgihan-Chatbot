# Gerekli kütüphaneleri içe aktar
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, Length
from datetime import datetime
import os
from dotenv import load_dotenv
import google.generativeai as genai
import json

# .env dosyasını yükle
load_dotenv()

# Gemini AI modelini yapılandır
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel(model_name="gemini-pro", generation_config={
    "temperature": 0.9,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
})

# Flask uygulamasını oluştur
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'gizli-anahtar-buraya')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Veritabanı ve giriş yöneticisini başlat
db = SQLAlchemy(app)

# Login manager ayarları
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# API istekleri için özel unauthorized handler
@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Unauthorized', 'message': 'Bu işlem için giriş yapmanız gerekiyor'}), 401
    return redirect(url_for('login'))

# Varsayılan model ve yapılandırma
chat = model.start_chat(history=[])

# Kullanıcı modeli
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Sohbet modeli
class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    messages = db.relationship('Message', backref='chat', lazy=True)

# Mesaj modeli
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_bot = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Kaydedilen yanıt modeli
class SavedResponse(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    title = db.Column(db.String(100))

# Kullanıcı yükleyici
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Giriş formu
class LoginForm(FlaskForm):
    username = StringField('Kullanıcı Adı', validators=[DataRequired()])
    password = PasswordField('Şifre', validators=[DataRequired()])
    submit = SubmitField('Giriş Yap')

# Kayıt formu
class RegisterForm(FlaskForm):
    username = StringField('Kullanıcı Adı', validators=[DataRequired(), Length(min=4, max=20)])
    email = StringField('E-posta', validators=[DataRequired(), Email()])
    password = PasswordField('Şifre', validators=[DataRequired(), Length(min=6)])
    submit = SubmitField('Kayıt Ol')

# Ana sayfa
@app.route('/')
def index():
    return render_template('index.html')

# Giriş işlemi
@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            return redirect(url_for('index'))
        flash('Geçersiz kullanıcı adı veya şifre', 'danger')
    return render_template('login.html', form=form)

# Kayıt işlemi
@app.route('/register', methods=['GET', 'POST'])
def register():
    form = RegisterForm()
    if form.validate_on_submit():
        if User.query.filter_by(username=form.username.data).first():
            flash('Bu kullanıcı adı zaten kullanılıyor', 'danger')
            return render_template('register.html', form=form)
            
        if User.query.filter_by(email=form.email.data).first():
            flash('Bu e-posta adresi zaten kayıtlı', 'danger')
            return render_template('register.html', form=form)
            
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        
        flash('Kayıt başarılı! Lütfen giriş yapın.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html', form=form)

# Çıkış işlemi
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# Sohbet yanıtı al
@app.route('/api/chat', methods=['POST'])
@login_required
def get_response():
    try:
        print("API endpoint'e istek geldi")  # Debug log
        user_message = request.form.get('message')
        category = request.form.get('category', 'health')
        chat_id = request.form.get('chat_id')
        
        print(f"Gelen veriler: message={user_message}, category={category}, chat_id={chat_id}")  # Debug log
        
        try:
            # Get or create chat
            if not chat_id:
                chat = Chat(user_id=current_user.id, title=f"Sohbet {datetime.now().strftime('%Y-%m-%d %H:%M')}")
                db.session.add(chat)
                db.session.commit()
                chat_id = chat.id
                print(f"Yeni sohbet oluşturuldu: {chat_id}")  # Debug log
            else:
                chat = Chat.query.get(chat_id)
                if not chat or chat.user_id != current_user.id:
                    return jsonify({'error': 'Geçersiz sohbet ID'}), 400
            
            # Save user message
            user_msg = Message(chat_id=chat_id, content=user_message, is_bot=False)
            db.session.add(user_msg)
            print("Kullanıcı mesajı kaydedildi")  # Debug log
            
            # Get AI response
            try:
                ai_response = generate_response(user_message, category)
                print(f"AI yanıtı alındı: {ai_response[:100]}...")  # Debug log
            except Exception as e:
                print(f"AI yanıtı alınırken hata: {str(e)}")  # Debug log
                return jsonify({'error': str(e)}), 500
            
            # Save AI response
            ai_msg = Message(chat_id=chat_id, content=ai_response, is_bot=True)
            db.session.add(ai_msg)
            print("AI yanıtı kaydedildi")  # Debug log
            
            # Commit all changes
            db.session.commit()
            print("Veritabanı değişiklikleri kaydedildi")  # Debug log
            
            return jsonify({
                'response': ai_response,
                'chat_id': chat_id
            }), 200, {'Content-Type': 'application/json'}
            
        except Exception as e:
            db.session.rollback()
            print(f"Veritabanı işlemi sırasında hata: {str(e)}")  # Debug log
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        print(f"Genel bir hata oluştu: {str(e)}")  # Debug log
        return jsonify({'error': 'Sunucu hatası'}), 500

# Sohbet geçmişi
@app.route('/api/chat-history')
@login_required
def get_chat_history():
    try:
        user_chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).all()
        chats_data = []
        for chat in user_chats:
            messages = Message.query.filter_by(chat_id=chat.id).order_by(Message.created_at).all()
            messages_data = [{
                'content': msg.content,
                'is_bot': msg.is_bot,
                'created_at': msg.created_at.strftime('%Y-%m-%d %H:%M:%S')
            } for msg in messages]
            
            chats_data.append({
                'id': chat.id,
                'title': chat.title,
                'created_at': chat.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'messages': messages_data
            })
        
        return jsonify({'chats': chats_data}), 200
    except Exception as e:
        print(f"Sohbet geçmişi alınırken hata: {str(e)}")
        return jsonify({'error': 'Server error', 'message': 'Sohbet geçmişi alınırken bir hata oluştu'}), 500

# Kaydedilen yanıtlar API'si
@app.route('/api/saved-responses', methods=['GET', 'POST', 'DELETE'])
@login_required
def saved_responses():
    if request.method == 'GET':
        # Handle deletion if ID is provided
        response_id = request.args.get('id')
        if response_id:
            response = SavedResponse.query.get(response_id)
            if response and response.user_id == current_user.id:
                db.session.delete(response)
                db.session.commit()
                return jsonify({'message': 'Yanıt başarıyla silindi'}), 200, {'Content-Type': 'application/json'}
            return jsonify({'error': 'Yanıt bulunamadı'}), 404, {'Content-Type': 'application/json'}
        
        # Get all saved responses for current user
        responses = SavedResponse.query.filter_by(user_id=current_user.id).order_by(SavedResponse.created_at.desc()).all()
        return jsonify([{
            'id': r.id,
            'content': r.content,
            'title': r.title,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for r in responses]), 200, {'Content-Type': 'application/json'}
    
    elif request.method == 'POST':
        try:
            content = request.form.get('content')
            if not content:
                return jsonify({'error': 'İçerik boş olamaz'}), 400, {'Content-Type': 'application/json'}
            
            # Create title from first 50 characters of content
            title = content[:50] + ('...' if len(content) > 50 else '')
            
            saved_response = SavedResponse(
                user_id=current_user.id,
                content=content,
                title=title
            )
            db.session.add(saved_response)
            db.session.commit()
            
            return jsonify({
                'message': 'Yanıt başarıyla kaydedildi',
                'response': {
                    'id': saved_response.id,
                    'content': saved_response.content,
                    'title': saved_response.title,
                    'created_at': saved_response.created_at.strftime('%Y-%m-%d %H:%M:%S')
                }
            }), 201, {'Content-Type': 'application/json'}
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500, {'Content-Type': 'application/json'}

def generate_response(user_input, category):
    try:
        print(f"API Anahtarı: {os.getenv('GEMINI_API_KEY')}")  # Debug için
        print(f"Kullanıcı Girişi: {user_input}")  # Debug için
        print(f"Kategori: {category}")  # Debug için

        # Kategori kelimeleri
        category_keywords = {
            'health': {
                'keywords': ['sağlık', 'hastalık', 'tedavi', 'doktor', 'hastane', 'ilaç', 'ağrı', 
                           'semptom', 'teşhis', 'hasta', 'grip', 'baş ağrısı', 'mide', 'bağırsak', 
                           'beslenme', 'egzersiz', 'uyku', 'stres', 'bağışıklık', 'diyet', 'vitamin'],
                'context': """Sen bir sağlık asistanısın. SADECE sağlık, beslenme, egzersiz, uyku ve genel sağlık konularında bilgi verebilirsin.
                    Kesinlikle diğer konularda yanıt VERME. Her zaman "doktora başvurun" önerisini ekle."""
            },
            'science': {
                'keywords': ['fizik', 'kimya', 'biyoloji', 'astronomi', 'matematik', 'bilim', 'araştırma',
                           'deney', 'laboratuvar', 'element', 'atom', 'molekül', 'gezegen', 'yıldız',
                           'formül', 'teori', 'hipotez', 'bilimsel', 'araştırma'],
                'context': """Sen bir bilim danışmanısın. SADECE temel bilimler konularında bilgi verebilirsin.
                    Tıbbi veya sağlık konularında asla tavsiye verme."""
            },
            'technology': {
                'keywords': ['bilgisayar', 'yazılım', 'donanım', 'internet', 'mobil', 'teknoloji',
                           'uygulama', 'web', 'site', 'programlama', 'kod', 'network', 'ağ', 'server',
                           'veritabanı', 'algoritma', 'framework', 'library', 'api', 'html', 'css', 'javascript'],
                'context': """Sen bir teknoloji danışmanısın. SADECE teknoloji konularında bilgi verebilirsin.
                    Sağlık veya tıbbi konularda kesinlikle tavsiye verme."""
            },
            'ai': {
                'keywords': ['yapay zeka', 'robot', 'makine öğrenmesi', 'derin öğrenme', 'chatbot', 
                           'otomasyon', 'neural network', 'ai', 'robotik', 'nlp', 'görüntü işleme', 
                           'ses tanıma', 'yapay sinir ağları'],
                'context': """Sen bir yapay zeka uzmanısın. SADECE yapay zeka ve ilgili konularda bilgi verebilirsin.
                    Sağlık veya tıbbi konularda kesinlikle tavsiye verme."""
            }
        }

        # Kullanıcının sorusundaki kelimeleri kontrol et
        user_input_lower = user_input.lower()
        matches = {cat: 0 for cat in category_keywords.keys()}
        
        # Her kategori için eşleşme sayısını hesapla
        for cat, data in category_keywords.items():
            for keyword in data['keywords']:
                if keyword in user_input_lower:
                    matches[cat] += 1

        # En çok eşleşen kategoriyi bul
        detected_category = max(matches.items(), key=lambda x: x[1])
        
        # Eğer eşleşme varsa ve mevcut kategoriden farklıysa
        if detected_category[1] > 0 and detected_category[0] != category:
            category_names = {
                'health': 'Sağlık',
                'science': 'Bilim',
                'technology': 'Teknoloji',
                'ai': 'Yapay Zeka'
            }
            category_emojis = {
                'health': '🏥',
                'science': '🔬',
                'technology': '💻',
                'ai': '🤖'
            }
            return f"Bu soru {category_names[detected_category[0]]} kategorisi ile ilgili görünüyor.\n\n" + \
                   f"{category_emojis[detected_category[0]]} Lütfen bu soruyu '{category_names[detected_category[0]]}' " + \
                   f"kategorisinde sorun. Böylece daha doğru ve kapsamlı bir yanıt alabilirsiniz."

        # Eğer doğru kategorideyse, yanıt üret
        context = category_keywords[category]['context']
        full_prompt = f"{context}\n\nKullanıcı Sorusu: {user_input}\n\nLütfen bu bağlamda yanıt ver:"
        print(f"Tam Prompt: {full_prompt}")  # Debug için

        response = model.generate_content(full_prompt)
        print(f"API Yanıtı: {response}")  # Debug için

        return response.text

    except Exception as e:
        print(f"Hata oluştu: {str(e)}")
        print(f"Hata detayları: {type(e).__name__}")  # Debug için
        import traceback
        print(f"Hata stack: {traceback.format_exc()}")  # Debug için
        return "Üzgünüm, şu anda yanıt üretemiyorum. Lütfen daha sonra tekrar deneyin."

# Ana program başlangıcı
if __name__ == '__main__':
    # Veritabanını oluştur
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
