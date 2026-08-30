from app import app
from db.models import db

with app.app_context():
    # Drop all tables (careful - this deletes data!)
    # db.drop_all()
    
    # Create all tables
    db.create_all()
    print("Database tables created successfully!")