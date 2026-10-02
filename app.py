"""
Video to Image Converter - Web App
Flask backend for extracting frames from video files and packaging them as a ZIP download.
"""

import os
import uuid
import shutil
import zipfile
import cv2
from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.exceptions import HTTPException

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB upload limit

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "temp_uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"mp4", "webm", "mov", "avi", "mkv", "flv", "wmv"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors as JSON
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    # Handle non-HTTP exceptions
    return jsonify({"error": str(e)}), 500


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/extract", methods=["POST"])
def extract_frames():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Parse options
    extract_mode = request.form.get("mode", "all")  # "all" or "interval"
    interval_seconds = float(request.form.get("interval", 1))
    output_format = request.form.get("format", "jpg").lower()  # "jpg" or "png"
    quality = int(request.form.get("quality", 85))

    if output_format not in ("jpg", "png"):
        output_format = "jpg"

    # Create a unique working directory
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(UPLOAD_FOLDER, job_id)
    frames_dir = os.path.join(job_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    # Save uploaded video
    video_path = os.path.join(job_dir, file.filename)
    file.save(video_path)

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            shutil.rmtree(job_dir, ignore_errors=True)
            return jsonify({"error": "Could not open video file"}), 400

        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        # Determine frame skip
        if extract_mode == "interval":
            frame_skip = max(1, int(fps * interval_seconds))
        else:
            frame_skip = 1

        frame_index = 0
        saved_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_index % frame_skip == 0:
                ext = "jpg" if output_format == "jpg" else "png"
                filename = f"frame_{saved_count:05d}.{ext}"
                filepath = os.path.join(frames_dir, filename)

                if output_format == "jpg":
                    cv2.imwrite(filepath, frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
                else:
                    cv2.imwrite(filepath, frame, [cv2.IMWRITE_PNG_COMPRESSION, 3])

                saved_count += 1

            frame_index += 1

        cap.release()

        if saved_count == 0:
            shutil.rmtree(job_dir, ignore_errors=True)
            return jsonify({"error": "No frames could be extracted from the video"}), 400

        # Create ZIP
        zip_path = os.path.join(job_dir, "frames.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for fname in sorted(os.listdir(frames_dir)):
                zipf.write(os.path.join(frames_dir, fname), fname)

        zip_size = os.path.getsize(zip_path)

        return jsonify({
            "success": True,
            "job_id": job_id,
            "frame_count": saved_count,
            "total_video_frames": total_frames,
            "fps": round(fps, 2),
            "duration": round(duration, 2),
            "zip_size": zip_size,
            "format": output_format,
        })

    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/download/<job_id>")
def download_zip(job_id):
    zip_path = os.path.join(UPLOAD_FOLDER, job_id, "frames.zip")
    if not os.path.exists(zip_path):
        return jsonify({"error": "File not found or expired"}), 404

    return send_file(
        zip_path,
        mimetype="application/zip",
        as_attachment=True,
        download_name="extracted_frames.zip",
    )


@app.route("/api/preview/<job_id>/<int:frame_index>")
def preview_frame(job_id, frame_index):
    """Serve a single frame image for preview."""
    frames_dir = os.path.join(UPLOAD_FOLDER, job_id, "frames")
    if not os.path.isdir(frames_dir):
        return jsonify({"error": "Job not found"}), 404

    files = sorted(os.listdir(frames_dir))
    if frame_index < 0 or frame_index >= len(files):
        return jsonify({"error": "Frame index out of range"}), 404

    filepath = os.path.join(frames_dir, files[frame_index])
    ext = files[frame_index].rsplit(".", 1)[-1].lower()
    mime = "image/jpeg" if ext == "jpg" else "image/png"
    return send_file(filepath, mimetype=mime)


@app.route("/api/cleanup/<job_id>", methods=["DELETE"])
def cleanup(job_id):
    """Clean up temp files for a job."""
    job_dir = os.path.join(UPLOAD_FOLDER, job_id)
    if os.path.isdir(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
