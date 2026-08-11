import json
from flask import Blueprint, render_template, request, jsonify, Response
from flask_login import login_required, current_user

from db.models import db, Question, ExportLog

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@dashboard_bp.route("/")
@login_required
def home():
    total = Question.query.filter_by(user_id=current_user.id).count()
    pending = Question.query.filter_by(user_id=current_user.id, status="pending").count()
    approved = Question.query.filter_by(user_id=current_user.id, status="approved").count()
    return render_template("dashboard.html", total=total, pending=pending, approved=approved)


@dashboard_bp.route("/questions")
@login_required
def questions():
    status = request.args.get("status", "pending")
    q = Question.query.filter_by(user_id=current_user.id)
    if status != "all":
        q = q.filter_by(status=status)
    items = q.order_by(Question.created_at.desc()).all()
    return jsonify([{
        "id": i.id, "discipline": i.discipline, "category": i.category, "topic": i.topic,
        "difficulty": i.difficulty, "question_type": i.question_type,
        "question_text": i.question_text,
        "options": json.loads(i.options) if i.options else None,
        "correct_answer": i.correct_answer, "status": i.status, "moodle_pushed": i.moodle_pushed,
    } for i in items])


@dashboard_bp.route("/questions/<int:question_id>", methods=["PATCH"])
@login_required
def update_question(question_id):
    question = Question.query.filter_by(id=question_id, user_id=current_user.id).first_or_404()
    data = request.json or {}
    if "question_text" in data:
        question.question_text = data["question_text"]
    if "status" in data and data["status"] in ("pending", "approved", "discarded"):
        question.status = data["status"]
    db.session.commit()
    return jsonify({"message": "updated"})


@dashboard_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@login_required
def delete_question(question_id):
    question = Question.query.filter_by(id=question_id, user_id=current_user.id).first_or_404()
    db.session.delete(question)
    db.session.commit()
    return jsonify({"message": "deleted"})


@dashboard_bp.route("/export/gift")
@login_required
def export_gift():
    ids = request.args.get("ids", "")
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    items = (Question.query.filter(Question.id.in_(id_list), Question.user_id == current_user.id).all()
             if id_list else
             Question.query.filter_by(user_id=current_user.id, status="approved").all())

    gift_text = questions_to_gift(items)
    db.session.add(ExportLog(user_id=current_user.id,
                              question_ids=json.dumps([i.id for i in items]),
                              export_format="gift"))
    db.session.commit()

    return Response(gift_text, mimetype="text/plain",
                     headers={"Content-Disposition": "attachment; filename=aefas_export.gift"})


def questions_to_gift(items):
    """Convert Question rows to Moodle GIFT format. Assumes `options` is a
    JSON list of {"text": ..., "is_correct": bool} — check this matches
    what rag/generator.py actually produces."""
    lines = []
    for item in items:
        title = f"{item.topic or item.discipline} - {item.id}".replace("~", "-")
        lines.append(f"// {item.discipline} | {item.category} | {item.difficulty}")
        header = f"::{title}::{item.question_text}"

        if item.question_type == "true_false":
            answer = "TRUE" if (item.correct_answer or "").strip().lower() in ("true", "t", "1") else "FALSE"
            lines.append(f"{header} {{{answer}}}")
        elif item.question_type == "multiple_choice":
            options = json.loads(item.options) if item.options else []
            body = "{\n" + "".join(
                f"{'=' if o.get('is_correct') else '~'}{o.get('text', '')}\n" for o in options
            ) + "}"
            lines.append(f"{header} {body}")
        elif item.question_type in ("short_answer", "numerical"):
            lines.append(f"{header} {{={item.correct_answer or ''}}}")
        else:
            lines.append(f"{header} {{}}")
        lines.append("")
    return "\n".join(lines)