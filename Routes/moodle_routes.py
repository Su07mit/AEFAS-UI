from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from db.models import db, MoodleConfig, Question
from services.moodle_client import MoodleClient
from Routes.dashboard_routes import questions_to_gift

moodle_bp = Blueprint("moodle", __name__, url_prefix="/dashboard/moodle")


@moodle_bp.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    config = MoodleConfig.query.filter_by(user_id=current_user.id).first()
    if request.method == "POST":
        data = request.json or {}
        if not config:
            config = MoodleConfig(user_id=current_user.id)
            db.session.add(config)
        config.moodle_url = data.get("moodle_url", "").rstrip("/")
        config.moodle_token = data.get("moodle_token", "")
        config.default_course_id = data.get("default_course_id") or None
        db.session.commit()
        return jsonify({"message": "saved"})
    return jsonify({
        "moodle_url": config.moodle_url if config else "",
        "moodle_token": bool(config and config.moodle_token),
        "default_course_id": config.default_course_id if config else None,
    })


@moodle_bp.route("/test", methods=["POST"])
@login_required
def test_connection():
    config = MoodleConfig.query.filter_by(user_id=current_user.id).first()
    if not config or not config.moodle_url or not config.moodle_token:
        return jsonify({"ok": False, "error": "Moodle URL and token not configured."}), 400
    return jsonify(MoodleClient(config.moodle_url, config.moodle_token).test_connection())


@moodle_bp.route("/courses")
@login_required
def courses():
    config = MoodleConfig.query.filter_by(user_id=current_user.id).first()
    if not config or not config.moodle_url or not config.moodle_token:
        return jsonify({"ok": False, "error": "Moodle not configured."}), 400
    return jsonify(MoodleClient(config.moodle_url, config.moodle_token).get_courses())


@moodle_bp.route("/push", methods=["POST"])
@login_required
def push_questions():
    config = MoodleConfig.query.filter_by(user_id=current_user.id).first()
    if not config or not config.moodle_url or not config.moodle_token:
        return jsonify({"ok": False, "error": "Moodle not configured."}), 400

    data = request.json or {}
    ids = data.get("question_ids", [])
    course_id = data.get("course_id") or config.default_course_id
    if not course_id:
        return jsonify({"ok": False, "error": "No course selected."}), 400

    items = Question.query.filter(Question.id.in_(ids), Question.user_id == current_user.id).all()
    if not items:
        return jsonify({"ok": False, "error": "No matching questions found."}), 400

    gift_text = questions_to_gift(items)
    client = MoodleClient(config.moodle_url, config.moodle_token)
    result = client.upload_gift_to_course(course_id, gift_text, filename="aefas_export.gift")

    if result.get("ok"):
        for item in items:
            item.moodle_pushed = True
        db.session.commit()
    return jsonify(result)