from bilgihan_chatbot import app, db

with app.app_context():
    db.create_all()
    print("Database tables created successfully!")
