document.addEventListener('DOMContentLoaded', function() {
    const sourceLanguage = document.getElementById('sourceLanguage');
    const targetLanguage = document.getElementById('targetLanguage');
    const sourceText = document.getElementById('sourceText');
    const translateBtn = document.getElementById('translateBtn');
    const listenBtn = document.getElementById('listenBtn');
    const recordBtn = document.getElementById('recordBtn');
    const swapBtn = document.getElementById('swapLanguages');
    const resultContainer = document.getElementById('resultContainer');
    const translatedText = document.getElementById('translatedText');
    const pronunciation = document.getElementById('pronunciation');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // Translate text
    translateBtn.addEventListener('click', async () => {
        const text = sourceText.value.trim();
        if (!text) {
            alert('Please enter some text to translate');
            return;
        }

        try {
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
        } catch (error) {
            alert('Translation error: ' + error.message);
            console.error(error);
        }
    });

    // Listen to translation
    listenBtn.addEventListener('click', async () => {
        const text = translatedText.textContent;
        if (!text) {
            alert('No translation available to speak');
            return;
        }

        try {
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
            alert('Speech synthesis error: ' + error.message);
            console.error(error);
        }
    });

    // Record audio
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
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
                    } catch (error) {
                        alert('Speech recognition error: ' + error.message);
                        console.error(error);
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordBtn.textContent = 'Stop Recording';
                recordBtn.classList.add('danger');
            } catch (error) {
                alert('Could not access microphone: ' + error.message);
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

    // Swap languages
    swapBtn.addEventListener('click', () => {
        const temp = sourceLanguage.value;
        sourceLanguage.value = targetLanguage.value;
        targetLanguage.value = temp;

        if (translatedText.textContent) {
            const tempText = sourceText.value;
            sourceText.value = translatedText.textContent;
            translatedText.textContent = tempText;
        }
    });
});
