from flask import Flask, render_template, request, jsonify, send_file
from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv
import uuid
from functools import wraps
import requests

app = Flask(__name__)
load_dotenv()


API_KEY = os.getenv('API_KEY')
INDEX_ID = os.getenv('INDEX_ID')
BASE_URL = "https://api.twelvelabs.io/v1.2"
REPORTS_DIR = os.path.join('static', 'reports')

os.makedirs(REPORTS_DIR, exist_ok=True)

client = TwelveLabs(api_key=API_KEY)


def get_video_url(video_id):
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    response = requests.get(
        f"{BASE_URL}/indexes/{INDEX_ID}/videos/{video_id}",
        headers=headers
    )
    response.raise_for_status()
    data = response.json()
    return data.get('hls', {}).get('video_url')


def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            app.logger.error(f"Error: {str(e)}")
            return jsonify({
                'error': 'An error occurred processing your request',
                'details': str(e)
            }), 500
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
@handle_errors
def search():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    query = data.get('query')
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400

    try:
        search_results = client.search.query(
            index_id=INDEX_ID,
            query_text=query,
            options=["visual"]
        )
        
        # Format the response with video URLs
        formatted_results = []
        for clip in search_results.data:
            # Get video URL for each result
            try:
                headers = {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
                url_response = requests.get(
                    f"{BASE_URL}/indexes/{INDEX_ID}/videos/{clip.video_id}",
                    headers=headers
                )
                video_url = url_response.json().get('hls', {}).get('video_url')
            except:
                video_url = None
                
            formatted_results.append({
                'video_id': clip.video_id,
                'score': round(clip.score, 2),
                'confidence': 'High' if clip.score > 0.7 else 'Medium',
                'start': clip.start,
                'end': clip.end,
                'video_url': video_url
            })
        
        return jsonify(formatted_results)
        
    except Exception as e:
        app.logger.error(f"Search Error: {str(e)}")
        return jsonify({'error': 'Search failed', 'details': str(e)}), 500

@app.route('/analyze/<video_id>')
@handle_errors
def analyze(video_id):
    """Handle video analysis requests"""
    try:
        app.logger.info(f"Starting analysis for video: {video_id}")
        
        try:
            # 1. Get video URL
            headers = {
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            }
            url_response = requests.get(
                f"{BASE_URL}/indexes/{INDEX_ID}/videos/{video_id}",
                headers=headers
            )
            url_data = url_response.json()
            video_url = url_data.get('hls', {}).get('video_url')
            
            # 2. Generate analysis
            analysis_response = client.generate.text(
                video_id=video_id,
                prompt="Provide a detailed analysis of the key events, actions, and notable elements in this video."
            )
            
            # Extract and clean analysis text
            analysis_text = str(analysis_response.data) if hasattr(analysis_response, 'data') else ''
            analysis_text = analysis_text.strip().strip('"\'')
            
            response_data = {
                'video_url': video_url,
                'analysis': analysis_text or "No analysis available."
            }
            
            app.logger.info("Analysis completed successfully")
            return jsonify(response_data)
            
        except Exception as e:
            app.logger.error(f"Error in analysis: {str(e)}")
            raise
            
    except Exception as e:
        app.logger.error(f"Analysis Error: {str(e)}")
        return jsonify({
            'error': 'Analysis failed',
            'details': str(e)
        }), 500
    

@app.route('/generate-report', methods=['POST'])
@handle_errors
def generate_report():
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    try:
        analysis_text = request.json.get('analysis')
        if not analysis_text:
            return jsonify({'error': 'Analysis text is required'}), 400
        
        report_id = str(uuid.uuid4())[:8]
        filename = f"report_{report_id}.txt"
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(analysis_text)
        
        return jsonify({
            'success': True,
            'report_url': f'/download-report/{filename}'
        })
        
    except Exception as e:
        app.logger.error(f"Report Generation Error: {str(e)}")
        return jsonify({'error': 'Failed to generate report', 'details': str(e)}), 500

@app.route('/download-report/<filename>')
@handle_errors
def download_report(filename):
    try:
        filepath = os.path.join(REPORTS_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'Report not found'}), 404
            
        return send_file(
            filepath,
            as_attachment=True,
            download_name=f"video_analysis_report_{filename}"
        )
        
    except Exception as e:
        app.logger.error(f"Download Error: {str(e)}")
        return jsonify({'error': 'Failed to download report', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)