from flask import Flask, render_template, request, jsonify, send_file
from twelvelabs import TwelveLabs
from report_generator import ReportGenerator
import os
from dotenv import load_dotenv
import uuid

app = Flask(__name__)
load_dotenv()

API_KEY = os.getenv('API_KEY')
INDEX_ID = os.getenv('INDEX_ID')

client = TwelveLabs(api_key=API_KEY)
report_generator = ReportGenerator()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    query = request.json.get('query')
    try:
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
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze/<video_id>')
def analyze(video_id):
    try:
        analysis = client.generate.text(
            video_id=video_id,
            prompt="Provide a concise analysis of the key events in this video.",
            temperature=0.2
        )
        return jsonify({'analysis': analysis.data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-report', methods=['POST'])
def generate_report():
    try:
        data = request.json
        analysis_text = data.get('analysis', '')
        report_id = str(uuid.uuid4())[:24]
        
        output_filename = f"report_{report_id}.pdf"
        file_path = os.path.join('static', 'reports', output_filename)
        
        os.makedirs(os.path.join('static', 'reports'), exist_ok=True)
        
        report_generator.generate_report(
            report_id=report_id,
            report_text=analysis_text,
            output_filename=file_path
        )
        
        return jsonify({
            'success': True,
            'report_url': f'/download-report/{output_filename}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-report/<filename>')
def download_report(filename):
    try:
        return send_file(
            os.path.join('static', 'reports', filename),
            as_attachment=True,
            download_name="surveillance_analysis_report.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)