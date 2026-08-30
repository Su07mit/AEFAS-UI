from flask import Blueprint, render_template, redirect, url_for, jsonify
from flask_login import login_required, current_user
import json

from db.models import Question

student_bp = Blueprint("student", __name__, url_prefix="/student")


@student_bp.before_request
@login_required
def restrict_to_students():
    if current_user.role != "student":
        return redirect(url_for("index"))


@student_bp.route("/")
def portal():
    total = Question.query.filter_by(user_id=current_user.id).count()
    return render_template("student.html", total=total)


@student_bp.route("/questions")
def my_questions():
    items = (Question.query.filter_by(user_id=current_user.id)
             .order_by(Question.created_at.desc()).limit(100).all())
    return jsonify([{
        "id": i.id, "topic": i.topic, "difficulty": i.difficulty,
        "question_type": i.question_type, "question_text": i.question_text,
        "options": json.loads(i.options) if i.options else None,
        "correct_answer": i.correct_answer,
        "created_at": i.created_at.strftime("%d %b, %H:%M") if i.created_at else "",
    } for i in items])