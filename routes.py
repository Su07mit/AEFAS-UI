from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from db.models import db, User
import jwt
import datetime
import os

auth_routes = Blueprint('auth_routes', __name__)

# We'll pass the google object as a parameter
def init_auth_routes(app, google):
    
    @app.route('/api/auth/google')
    def google_auth():
        """Redirect to Google OAuth"""
        redirect_uri = url_for('google_callback', _external=True)
        return google.authorize_redirect(redirect_uri)
    
    @app.route('/api/auth/google/callback')
    def google_callback():
        """Handle Google OAuth callback"""
        try:
            # Get token from Google
            token = google.authorize_access_token()
            
            # Get user info
            user_info = google.get('userinfo').json()
            
            if not user_info or 'email' not in user_info:
                return jsonify({'error': 'Failed to get user info'}), 401
            
            # Check if user exists
            user = User.query.filter_by(email=user_info['email']).first()
            if not user:
                # Create new user
                user = User(
                    email=user_info['email'],
                    name=user_info.get('name', user_info['email'].split('@')[0]),
                    profile_pic=user_info.get('picture', ''),
                    provider='google',
                    is_active=True
                )
                db.session.add(user)
                db.session.commit()
            
            # Generate JWT token
            token = jwt.encode({
                'user_id': user.id,
                'email': user.email,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }, app.config['JWT_SECRET_KEY'], algorithm='HS256')
            
            # Store in session
            session['user_id'] = user.id
            session['token'] = token
            
            # Redirect to dashboard with token
            return redirect(f'/dashboard?token={token}')
            
        except Exception as e:
            print(f"Error in Google callback: {str(e)}")
            return jsonify({'error': str(e)}), 401
    
    return app