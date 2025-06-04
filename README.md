# Universal Translator

A web-based Universal Translator app that allows you to translate text or speech between multiple languages, listen to translations, and convert speech to text.

## Features

- Translate text between many languages
- Speech-to-text: Record your voice and convert it to text
- Text-to-speech: Listen to translations in the target language
- Swap source and target languages easily
- Modern, responsive UI

## Demo

![Screenshot](static/demo-screenshot.png) <!-- Add a screenshot if available -->

## Technologies Used

- Python (Flask)
- JavaScript (Fetch API, MediaRecorder)
- [googletrans](https://pypi.org/project/googletrans/) for translation
- [gTTS](https://pypi.org/project/gTTS/) for text-to-speech
- [SpeechRecognition](https://pypi.org/project/SpeechRecognition/) for speech-to-text

## Getting Started

### Prerequisites

- Python 3.7+
- pip

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/universal-translator.git
    cd universal-translator/translator-app
    ```

2. Install dependencies:
    ```sh
    pip install -r requirements.txt
    ```

3. Run the Flask app:
    ```sh
    python app.py
    ```


## Usage

- Select source and target languages.
- Enter text or use the "Record" button to input speech.
- Click "Translate" to see the translation.
- Use "Listen" to hear the translated text.
- Swap languages with the ⇄ button.

