let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let speechSynthesis = window.speechSynthesis;

// UI Elements
const voiceGuideBtn = document.getElementById('voiceGuideBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const historyBtn = document.getElementById('historyBtn');
const feedbackBtn = document.getElementById('feedbackBtn');

// Initialize app with voice guide
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('firstTime') === null) {
        playVoiceGuide();
        localStorage.setItem('firstTime', 'false');
    }
});

// Voice Guide System
function playVoiceGuide() {
    const guideText = "Welcome to the Translation Assistant. To translate, speak or type your text, select languages, and click translate. Use the microphone button to speak, and the speaker button to listen to translations.";
    speak(guideText, 'en');
}

function speak(text, lang) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
}

// Enhanced Translate function with history
translateBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    if (!text) {
        speak("Please enter some text to translate", 'en');
        return;
    }

    try {
        speak("Translating your text, please wait", 'en');
        
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                source_lang: sourceLanguage.value,
                target_lang: targetLanguage.value
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        translatedText.textContent = data.translated_text;
        pronunciation.textContent = `Pronunciation: ${data.pronunciation}`;
        resultContainer.classList.remove('hidden');
        
        // Save to history
        saveToHistory(text, data.translated_text);
        
        speak("Translation complete. Click the listen button to hear it", 'en');
    } catch (error) {
        speak("Translation error occurred", 'en');
        console.error(error);
    }
});

// Enhanced Listen function with voice feedback
listenBtn.addEventListener('click', async () => {
    const text = translatedText.textContent;
    if (!text) {
        speak("No translation available to speak", 'en');
        return;
    }

    try {
        speak("Playing translation", 'en');
        
        const response = await fetch('/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                lang: targetLanguage.value
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
    } catch (error) {
        speak("Speech synthesis error occurred", 'en');
        console.error(error);
    }
});

// Enhanced Record function with voice feedback
recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        // Start recording
        try {
            speak("Recording started. Speak now.", 'en');
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                speak("Processing your speech", 'en');
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.wav');
                formData.append('lang', sourceLanguage.value);

                try {
                    const response = await fetch('/speech-to-text', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();

                    if (data.error) {
                        throw new Error(data.error);
                    }

                    sourceText.value = data.text;
                    speak("Speech recognized. Click translate to continue.", 'en');
                } catch (error) {
                    speak("Sorry, I couldn't understand that. Please try again.", 'en');
                    console.error(error);
                }
            };

            mediaRecorder.start();
            isRecording = true;
            recordBtn.textContent = 'Stop Recording';
            recordBtn.classList.add('danger');
        } catch (error) {
            speak("Could not access microphone. Please check permissions.", 'en');
            console.error(error);
        }
    } else {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.textContent = 'Record';
        recordBtn.classList.remove('danger');
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
});

// Swap languages with voice confirmation
swapBtn.addEventListener('click', () => {
    const temp = sourceLanguage.value;
    sourceLanguage.value = targetLanguage.value;
    targetLanguage.value = temp;

    if (translatedText.textContent) {
        const tempText = sourceText.value;
        sourceText.value = translatedText.textContent;
        translatedText.textContent = tempText;
    }
    
    speak(`Languages swapped. Now translating from ${sourceLanguage.value} to ${targetLanguage.value}`, 'en');
});

// New Feature: Voice Guide Button
voiceGuideBtn.addEventListener('click', () => {
    playVoiceGuide();
});

// New Feature: Translation Analysis
analyzeBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    if (!text) {
        speak("Please enter some text to analyze", 'en');
        return;
    }

    try {
        speak("Analyzing your text", 'en');
        
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                lang: sourceLanguage.value
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Display analysis results
        const analysisResult = `Your text is ${data.sentiment} with ${data.complexity} complexity.`;
        document.getElementById('analysisResult').textContent = analysisResult;
        speak(analysisResult, 'en');
        
    } catch (error) {
        speak("Analysis error occurred", 'en');
        console.error(error);
    }
});

// New Feature: Translation History
function saveToHistory(original, translated) {
    let history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
    history.unshift({
        original,
        translated,
        timestamp: new Date().toISOString(),
        fromLang: sourceLanguage.value,
        toLang: targetLanguage.value
    });
    
    // Keep only last 50 items
    if (history.length > 50) {
        history = history.slice(0, 50);
    }
    
    localStorage.setItem('translationHistory', JSON.stringify(history));
}

historyBtn.addEventListener('click', () => {
    const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
    displayHistory(history);
    speak("Showing your translation history", 'en');
});

function displayHistory(history) {
    // Implement history display logic
}

// New Feature: Feedback System
feedbackBtn.addEventListener('click', () => {
    speak("Please tell us how we can improve", 'en');
    // Implement feedback recording or input system
});

// Accessibility Features
document.addEventListener('keydown', (e) => {
    // Shortcut keys for important functions
    if (e.altKey && e.key === 't') {
        translateBtn.click(); // Alt+T for translate
    }
    if (e.altKey && e.key === 'l') {
        listenBtn.click(); // Alt+L for listen
    }
    if (e.altKey && e.key === 'r') {
        recordBtn.click(); // Alt+R for record
    }
});

// Auto-detect language feature
document.getElementById('autoDetect').addEventListener('change', function() {
    if (this.checked) {
        sourceLanguage.disabled = true;
        speak("Language auto-detection enabled", 'en');
    } else {
        sourceLanguage.disabled = false;
        speak("Language auto-detection disabled", 'en');
    }
});