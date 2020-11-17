import os


from flask import Flask, flash, jsonify, request, redirect, session, render_template, url_for, send_file
from flask_session import Session
from alignment import find_beep, sync_audio
from tempfile import mkdtemp
import numpy as np
import webbrowser
from threading import Timer
import datetime

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


@app.route('/api/peaks', methods=["POST", "GET"])
def peaks():
    """Find peaks in audio file"""

    # Retrieve audio file
    audio1 = request.files["audio1"]
    audio2 = request.files["audio2"]
    audio1.save("temp1.wav")
    audio2.save("temp2.wav")

    # Find sync point
    sync_points = sync_audio("temp1.wav", "temp2.wav")
    sync_point1 = sync_points['sync_point1'][0]
    sync_length1 = sync_points['sync_point1'][1]
    sync_point2 = sync_points['sync_point2'][0]
    sync_length2 = sync_points['sync_point2'][1]
    
    return jsonify({'sync_point1': sync_point1, 'sync_length1': sync_length1,
                    'sync_point2': sync_point2, 'sync_length2': sync_length2})


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


def open_browser():
    """Open web aplication automatically"""
    webbrowser.open_new('http://127.0.0.1:3000/')
    

if __name__ == "__main__":
      Timer(1, open_browser).start()
      app.run(host="0.0.0.0", port=3000)
