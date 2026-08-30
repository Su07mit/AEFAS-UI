import json
from flask import Blueprint, render_template, request, jsonify, Response, redirect, url_for
from flask_login import login_required, current_user

from db.models import db, Question, ExportLog

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@dashboard_bp.before_request
@login_required
def restrict_to_staff():
    if current_user.role == "student":
        return redirect(url_for("student.portal"))


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
    if "difficulty" in data and data["difficulty"]:
        question.difficulty = data["difficulty"]
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


def gift_escape(text):
    """GIFT format treats ~ = { } # : as syntax characters — escape them."""
    text = text or ""
    for ch in ["~", "=", "{", "}", "#", ":"]:
        text = text.replace(ch, "\\" + ch)
    return text


def questions_to_gift(items):
    """Convert Question rows to Moodle GIFT format. `options` is expected to be
    a JSON list of {"text": ..., "is_correct": bool}, but older/legacy rows may
    have a different shape — fall back gracefully instead of crashing."""
    lines = []
    for item in items:
        title = f"{item.topic or item.discipline} - {item.id}".replace("~", "-")
        lines.append(f"// {item.discipline} | {item.category} | {item.difficulty}")
        header = f"::{title}::{gift_escape(item.question_text)}"

        if item.question_type == "true_false":
            answer = "TRUE" if (item.correct_answer or "").strip().lower() in ("true", "t", "1") else "FALSE"
            lines.append(f"{header} {{{answer}}}")
        elif item.question_type == "multiple_choice":
            try:
                raw_options = json.loads(item.options) if item.options else []
            except (ValueError, TypeError):
                raw_options = []

            # Normalise: accept the expected [{"text":.., "is_correct":..}, ...]
            # shape, but also tolerate a legacy plain list of strings by
            # matching against the stored correct_answer.
            options = []
            for o in raw_options:
                if isinstance(o, dict):
                    options.append({"text": o.get("text", ""), "is_correct": bool(o.get("is_correct"))})
                else:
                    text = str(o)
                    options.append({"text": text, "is_correct": text.strip() == (item.correct_answer or "").strip()})

            if options and not any(o["is_correct"] for o in options):
                options[0]["is_correct"] = True

            if not options:
                # Nothing usable — fall back rather than emit a broken block.
                lines.append(f"{header} {{={gift_escape(item.correct_answer or '')}}}")
            else:
                body = "{\n" + "".join(
                    f"{'=' if o['is_correct'] else '~'}{gift_escape(o['text'])}\n" for o in options
                ) + "}"
                lines.append(f"{header} {body}")
        elif item.question_type in ("short_answer", "numerical"):
            lines.append(f"{header} {{={gift_escape(item.correct_answer or '')}}}")
        else:
            lines.append(f"{header} {{}}")
        lines.append("")
    return "\n".join(lines)