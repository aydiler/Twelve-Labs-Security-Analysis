from flask import Flask, render_template, request, jsonify, send_file
from twelvelabs import TwelveLabs
from report_generator import ReportGenerator
import os
from dotenv import load_dotenv
import uuid
import requests
from functools import wraps

# Initialize Flask app and environment
app = Flask(__name__)
load_dotenv()

API_KEY = os.getenv('API_KEY')
INDEX_ID = os.getenv('INDEX_ID')
BASE_URL = "https://api.twelvelabs.io/v1.2"
REPORTS_DIR = os.path.join('static', 'reports')

# Initialize Twelve Labs client
client = TwelveLabs(api_key=API_KEY)

report_generator = ReportGenerator()

# Ensure reports directory exists
os.makedirs(REPORTS_DIR, exist_ok=True)

# Error handling decorator
def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function

def make_api_request(method, endpoint, headers=None, json=None):

    headers = headers or {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}/{endpoint}"
    response = requests.request(method, url, headers=headers, json=json)
    response.raise_for_status()
    return response.json()

def get_video_url(video_id):

    try:
        data = make_api_request('GET', f"indexes/{INDEX_ID}/videos/{video_id}")
        return data.get('hls', {}).get('video_url')
    except Exception as e:
        print(f"Failed to get video URL: {str(e)}")
        return None

def get_video_analysis(video_id):

    try:
        data = make_api_request('POST', "generate", json={
            "video_id": video_id,
            "prompt": "Provide a detailed analysis of the key events, actions, and notable elements in this video.",
            "temperature": 0.2
        })
        return data.get('data')
    except Exception as e:
        print(f"Failed to get analysis: {str(e)}")
        return None

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
@handle_errors
def search():
    query = request.json.get('query')
    results = client.search.query(
        index_id=INDEX_ID,
        query_text=query,
        options=["visual"]
    )
    
    formatted_results = [{
        'video_id': clip.video_id,
        'score': round(clip.score, 2),
        'confidence': clip.confidence,
        'start': clip.start,
        'end': clip.end
    } for clip in results.data]
    
    return jsonify(formatted_results)

@app.route('/analyze/<video_id>')
@handle_errors
def analyze(video_id):
    # Get video URL and analysis
    video_url = get_video_url(video_id)
    analysis = get_video_analysis(video_id)

    if not analysis:
        raise Exception("Failed to generate analysis")

    # Prepare response
    response_data = {'analysis': analysis}
    if video_url:
        response_data['video_url'] = video_url

    return jsonify(response_data)

@app.route('/generate-report', methods=['POST'])
@handle_errors
def generate_report():
    # Extract data
    analysis_text = request.json.get('analysis', '')
    report_id = str(uuid.uuid4())[:24]
    output_filename = f"report_{report_id}.pdf"
    file_path = os.path.join(REPORTS_DIR, output_filename)
    
    # Generate report
    report_generator.generate_report(
        report_id=report_id,
        report_text=analysis_text,
        output_filename=file_path
    )
    
    return jsonify({
        'success': True,
        'report_url': f'/download-report/{output_filename}'
    })

@app.route('/download-report/<filename>')
@handle_errors
def download_report(filename):
    return send_file(
        os.path.join(REPORTS_DIR, filename),
        as_attachment=True,
        download_name="surveillance_analysis_report.pdf"
    )

if __name__ == '__main__':
    app.run(debug=True)