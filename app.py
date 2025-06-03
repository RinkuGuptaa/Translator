from flask import Flask, render_template, request, jsonify, send_file
from gtts import gTTS
import speech_recognition as sr
from googletrans import Translator
import os
from io import BytesIO
import tempfile

app = Flask(__name__, static_folder='static')

# Initialize translator
translator = Translator()

# Supported languages
LANGUAGES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French', 
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh-cn': 'Chinese',
    'ja': 'Japanese',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'bn': 'Bengali',
    'as-IN': 'Assamese'
}

@app.route('/')
def home():
    return render_template('index.html', languages=LANGUAGES)

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.json
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        translation = translator.translate(text, src=source_lang, dest=target_lang)
        
        return jsonify({
            'original_text': text,
            'translated_text': translation.text,
            'pronunciation': translation.pronunciation or translation.text,
            'source_lang': source_lang,
            'target_lang': target_lang
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        lang = data.get('lang', 'en')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        tts = gTTS(text=text, lang=lang, slow=False)
        audio_bytes = BytesIO()
        tts.write_to_fp(audio_bytes)
        audio_bytes.seek(0)
        
        return send_file(
            audio_bytes,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name='speech.mp3'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        lang = request.form.get('lang', 'en')
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            audio_file.save(tmp.name)
            
            recognizer = sr.Recognizer()
            with sr.AudioFile(tmp.name) as source:
                audio = recognizer.record(source)
                text = recognizer.recognize_google(audio, language=lang)
            
            os.unlink(tmp.name)
            
            return jsonify({'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

