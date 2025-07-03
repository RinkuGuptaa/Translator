from flask import Flask, render_template, request, jsonify, send_file
from gtts import gTTS
import speech_recognition as sr
from googletrans import Translator, LANGUAGES as GOOGLE_LANGUAGES
import os
from io import BytesIO
import tempfile
import logging
from werkzeug.utils import secure_filename
import traceback

app = Flask(__name__, static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize translator with error handling
try:
    translator = Translator()
except Exception as e:
    logger.error(f"Failed to initialize translator: {e}")
    translator = None

# Extended supported languages with more options
LANGUAGES = {
    'auto': 'Auto Detect',
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French', 
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'hi': 'Hindi',
    'ar': 'Arabic',
    'bn': 'Bengali',
    'ur': 'Urdu',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'or': 'Odia',
    'pa': 'Punjabi',
    'as': 'Assamese',
    'ne': 'Nepali',
    'si': 'Sinhala',
    'my': 'Myanmar',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'ms': 'Malay',
    'tl': 'Filipino',
    'sw': 'Swahili',
    'am': 'Amharic',
    'yo': 'Yoruba',
    'ig': 'Igbo',
    'ha': 'Hausa'
}

@app.route('/')
def home():
    return render_template('index.html', languages=LANGUAGES)

@app.route('/translate', methods=['POST'])
def translate():
    try:
        if not translator:
            return jsonify({'error': 'Translation service unavailable'}), 503
            
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        text = data.get('text', '').strip()
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en')
        
        if not text:
            return jsonify({'error': 'No text provided for translation'}), 400
            
        if len(text) > 5000:
            return jsonify({'error': 'Text too long. Maximum 5000 characters allowed.'}), 400
            
        if source_lang == target_lang and source_lang != 'auto':
            return jsonify({
                'original_text': text,
                'translated_text': text,
                'pronunciation': text,
                'source_lang': source_lang,
                'target_lang': target_lang,
                'detected_lang': source_lang
            })
        
        logger.info(f"Translating from {source_lang} to {target_lang}: {text[:50]}...")
        translation = translator.translate(text, src=source_lang, dest=target_lang)
        
        return jsonify({
            'original_text': text,
            'translated_text': translation.text,
            'pronunciation': translation.pronunciation or translation.text,
            'source_lang': source_lang,
            'target_lang': target_lang,
            'detected_lang': translation.src,
            'confidence': getattr(translation.extra_data, 'confidence', None)
        })
    except Exception as e:
        logger.error(f"Translation error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': f'Translation failed: {str(e)}'}), 500

@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
            
        text = data.get('text', '').strip()
        lang = data.get('lang', 'en')
        slow = data.get('slow', False)
        
        if not text:
            return jsonify({'error': 'No text provided for speech synthesis'}), 400
            
        if len(text) > 1000:
            return jsonify({'error': 'Text too long for speech synthesis. Maximum 1000 characters.'}), 400
        
        # Remove 'auto' if it's selected as target language
        if lang == 'auto':
            lang = 'en'
            
        logger.info(f"Generating speech for text: {text[:50]}... in language: {lang}")
        
        tts = gTTS(text=text, lang=lang, slow=slow)
        audio_bytes = BytesIO()
        tts.write_to_fp(audio_bytes)
        audio_bytes.seek(0)
        
        return send_file(
            audio_bytes,
            mimetype='audio/mpeg',
            as_attachment=False,
            download_name='speech.mp3'
        )
    except Exception as e:
        logger.error(f"Text-to-speech error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': f'Speech synthesis failed: {str(e)}'}), 500

@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        lang = request.form.get('lang', 'en')
        
        # Check file size
        if len(audio_file.read()) > 10 * 1024 * 1024:  # 10MB limit
            return jsonify({'error': 'Audio file too large. Maximum 10MB allowed.'}), 400
        audio_file.seek(0)  # Reset file pointer
        
        # Remove 'auto' if selected for speech recognition
        if lang == 'auto':
            lang = 'en'
            
        logger.info(f"Processing speech-to-text for language: {lang}")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            audio_file.save(tmp.name)
            
            recognizer = sr.Recognizer()
            recognizer.energy_threshold = 300
            recognizer.dynamic_energy_threshold = True
            
            with sr.AudioFile(tmp.name) as source:
                # Adjust for ambient noise
                recognizer.adjust_for_ambient_noise(source, duration=1)
                audio = recognizer.record(source)
                
                try:
                    text = recognizer.recognize_google(audio, language=lang)
                    logger.info(f"Recognized text: {text}")
                except sr.UnknownValueError:
                    os.unlink(tmp.name)
                    return jsonify({'error': 'Could not understand the audio. Please speak clearly.'}), 400
                except sr.RequestError as e:
                    os.unlink(tmp.name)
                    return jsonify({'error': f'Speech recognition service error: {str(e)}'}), 500
            
            os.unlink(tmp.name)
            
            return jsonify({
                'text': text,
                'language': lang,
                'confidence': 'high'  # Google API doesn't provide confidence scores
            })
    except Exception as e:
        logger.error(f"Speech-to-text error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': f'Speech recognition failed: {str(e)}'}), 500

@app.route('/help')
def help_page():
    """Provide user help and instructions"""
    help_data = {
        'features': {
            'translation': 'Translate text between multiple languages with automatic language detection',
            'speech_to_text': 'Convert spoken words to text using your microphone',
            'text_to_speech': 'Convert translated text to speech for pronunciation help',
            'language_swap': 'Quickly swap source and target languages',
            'keyboard_shortcuts': 'Use Ctrl+Enter to translate, Ctrl+Space to record'
        },
        'supported_languages': list(LANGUAGES.values()),
        'usage_tips': [
            'For best speech recognition, speak clearly and avoid background noise',
            'Use "Auto Detect" to automatically identify the source language',
            'Text limit: 5000 characters for translation, 1000 for speech synthesis',
            'Audio file limit: 10MB for speech recognition',
            'Click the swap button (⇄) to quickly exchange languages'
        ],
        'troubleshooting': {
            'microphone_issues': 'Allow microphone permissions in your browser settings',
            'translation_errors': 'Check your internet connection and try again',
            'audio_playback': 'Ensure your browser supports audio playback',
            'slow_performance': 'Try shorter text segments for faster processing'
        }
    }
    return jsonify(help_data)

@app.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    status = {
        'status': 'healthy',
        'translator_available': translator is not None,
        'supported_languages_count': len(LANGUAGES),
        'version': '2.0.0'
    }
    return jsonify(status)

@app.route('/languages')
def get_languages():
    """Get list of supported languages"""
    return jsonify(LANGUAGES)

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size allowed is 16MB.'}), 413

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

