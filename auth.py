from flask import Blueprint, request, jsonify, session, redirect, url_for
from db.models import db, User
import jwt
import datetime
from functools import wraps
import os

auth_bp = Blueprint('auth', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            token = token.split(' ')[1]  # Bearer <token>
            data = jwt.decode(token, os.environ.get('JWT_SECRET_KEY', 'your-secret-key'), algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': f'Authentication error: {str(e)}'}), 401
        return f(current_user, *args, **kwargs)
    return decorated