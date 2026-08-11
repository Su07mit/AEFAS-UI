from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="teacher")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Question(db.Model):
    __tablename__ = "questions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    discipline = db.Column(db.String(100))
    category = db.Column(db.String(100))
    topic = db.Column(db.String(200))
    difficulty = db.Column(db.String(20))
    question_type = db.Column(db.String(30))
    question_text = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text)          # JSON-encoded
    correct_answer = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")   # pending / approved / discarded
    moodle_pushed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class MoodleConfig(db.Model):
    __tablename__ = "moodle_configs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    moodle_url = db.Column(db.String(255))
    moodle_token = db.Column(db.String(255))
    default_course_id = db.Column(db.Integer)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExportLog(db.Model):
    __tablename__ = "export_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    question_ids = db.Column(db.Text)
    export_format = db.Column(db.String(10))
    course_id = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default="success")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)