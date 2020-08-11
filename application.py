import os

from flask import Flask, flash, jsonify, request, redirect, session, render_template, url_for, send_file
from flask_session import Session
from tempfile import mkdtemp

# Configure application
app = Flask(__name__)

# Ensure responses aren't cached
@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_FILE_DIR"] = mkdtemp()
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


@app.route('/')
def index():
    """Show main page"""
    return render_template("index.html")


@app.route('/api/replace',  methods=["POST"])
def replace():
    """Log replacement edits"""
    
    data = request.get_json()
    edits = data["edits"]

    with open("edit.txt", "w") as f:
        for edit in edits:
            print(edit)
            editline = f'{edit[0]}, {edit[0]}\n'
            f.write(editline)

    return jsonify({'res': "Success!"})