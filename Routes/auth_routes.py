from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user

from db.models import db, User

auth_bp = Blueprint("auth", __name__)


def redirect_for_role(user):
    if user.role == "student":
        return redirect(url_for("student.portal"))
    return redirect(url_for("index"))


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect_for_role(current_user)
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        role = request.form.get("role", "student").strip().lower()
        if role not in ("student", "teacher"):
            role = "student"

        if not username or not email or not password:
            flash("All fields are required.", "error")
            return redirect(url_for("auth.register"))
        if password != confirm:
            flash("Passwords do not match.", "error")
            return redirect(url_for("auth.register"))
        if User.query.filter((User.username == username) | (User.email == email)).first():
            flash("Username or email already in use.", "error")
            return redirect(url_for("auth.register"))

        user = User(username=username, email=email, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return redirect_for_role(user)
    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect_for_role(current_user)
    if request.method == "POST":
        identifier = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier.lower())
        ).first()
        if user and user.check_password(password):
            login_user(user, remember=bool(request.form.get("remember")))
            next_url = request.args.get("next")
            if next_url:
                return redirect(next_url)
            return redirect_for_role(user)
        flash("Invalid username or password.", "error")
        return redirect(url_for("auth.login"))
    return render_template("login.html")


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))