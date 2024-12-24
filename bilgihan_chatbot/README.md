# Bilgihan Chatbot

Bilgihan Chatbot, Flask tabanlı bir web uygulaması olup, Google'ın Gemini-Pro AI modelini kullanarak kullanıcılara akıllı sohbet deneyimi sunan bir chatbot sistemidir.

## Özellikler

- 🔐 Kullanıcı Kimlik Doğrulama Sistemi (Kayıt, Giriş, Çıkış)
- 💬 Gerçek zamanlı AI destekli sohbet
- 📝 Sohbet geçmişi kaydetme ve görüntüleme
- 💾 Önemli yanıtları kaydetme ve yönetme
- 🎯 Kategori bazlı yanıt üretme

## Kullanılan Teknolojiler

- Python 3.x
- Flask Framework
- SQLAlchemy
- Google Gemini AI API
- SQLite Veritabanı
- HTML/CSS/JavaScript

## Kurulum ve Çalıştırma

1. Projeyi bilgisayarınıza indirin
2. Gerekli paketleri yükleyin:
```bash
pip install -r requirements.txt
```
3. Uygulamayı çalıştırın:
```bash
python bilgihan_chatbot.py
```

## Kullanım

1. Tarayıcınızda `http://localhost:5000` adresine gidin
2. Yeni bir hesap oluşturun veya mevcut hesabınızla giriş yapın
3. Ana sayfada chatbot ile sohbet edebilirsiniz
4. Önemli yanıtları kaydedebilir ve daha sonra görüntüleyebilirsiniz

## Proje Yapısı

- `bilgihan_chatbot.py`: Ana uygulama dosyası
- `static/`: Statik dosyalar (CSS, JS, resimler)
- `templates/`: HTML şablonları
- `instance/`: SQLite veritabanı dosyası
