from flask import Flask, render_template, request, jsonify
from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv

app = Flask(__name__)
load_dotenv()


API_KEY = os.getenv('API_KEY')  
INDEX_ID = os.getenv('INDEX_ID') 

client = TwelveLabs(api_key=API_KEY)

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

if __name__ == '__main__':
    app.run(debug=True)