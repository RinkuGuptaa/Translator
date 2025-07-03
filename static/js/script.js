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
    const helpBtn = document.getElementById('helpBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let isTranslating = false;
    let isGeneratingSpeech = false;
    
    // Character counter
    const charCounter = document.createElement('div');
    charCounter.className = 'char-counter';
    sourceText.parentNode.insertBefore(charCounter, sourceText.nextSibling);
    
    // Update character counter
    function updateCharCounter() {
        const count = sourceText.value.length;
        charCounter.textContent = `${count}/5000 characters`;
        charCounter.style.color = count > 5000 ? '#ea4335' : '#6c757d';
    }
    
    sourceText.addEventListener('input', updateCharCounter);
    updateCharCounter();

    // Show/hide loading states
    function setLoadingState(element, isLoading, originalText) {
        if (isLoading) {
            element.disabled = true;
            element.dataset.originalText = originalText;
            element.innerHTML = '<span class="loading-spinner"></span> Loading...';
        } else {
            element.disabled = false;
            element.innerHTML = element.dataset.originalText || originalText;
        }
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Translate text with enhanced error handling
    async function translateText() {
        const text = sourceText.value.trim();
        if (!text) {
            showNotification('Please enter some text to translate', 'warning');
            sourceText.focus();
            return;
        }
        
        if (text.length > 5000) {
            showNotification('Text too long. Maximum 5000 characters allowed.', 'error');
            return;
        }
        
        if (isTranslating) return;
        isTranslating = true;
        setLoadingState(translateBtn, true, 'Translate');

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
            pronunciation.textContent = data.detected_lang ? 
                `Detected: ${data.detected_lang.toUpperCase()} | Pronunciation: ${data.pronunciation}` :
                `Pronunciation: ${data.pronunciation}`;
            resultContainer.classList.remove('hidden');
            
            // Enable copy button
            if (copyBtn) {
                copyBtn.style.display = 'inline-flex';
            }
            
            showNotification('Translation completed successfully!', 'success');
        } catch (error) {
            showNotification(`Translation error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            isTranslating = false;
            setLoadingState(translateBtn, false, 'Translate');
        }
    }
    
    translateBtn.addEventListener('click', translateText);

    // Listen to translation with enhanced error handling
    async function speakTranslation() {
        const text = translatedText.textContent;
        if (!text) {
            showNotification('No translation available to speak', 'warning');
            return;
        }
        
        if (text.length > 1000) {
            showNotification('Text too long for speech synthesis. Maximum 1000 characters.', 'error');
            return;
        }
        
        if (isGeneratingSpeech) return;
        isGeneratingSpeech = true;
        setLoadingState(listenBtn, true, 'Listen');

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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate speech');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onplay = () => showNotification('Playing audio...', 'info');
            audio.onended = () => URL.revokeObjectURL(audioUrl);
            audio.onerror = () => showNotification('Audio playback failed', 'error');
            
            await audio.play();
        } catch (error) {
            showNotification(`Speech synthesis error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            isGeneratingSpeech = false;
            setLoadingState(listenBtn, false, 'Listen');
        }
    }
    
    listenBtn.addEventListener('click', speakTranslation);

    // Record audio with enhanced error handling
    async function toggleRecording() {
        if (!isRecording) {
            try {
                // Check microphone permissions
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    setLoadingState(recordBtn, true, 'Record');
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    
                    // Check file size
                    if (audioBlob.size > 10 * 1024 * 1024) {
                        showNotification('Recording too long. Maximum 10MB allowed.', 'error');
                        setLoadingState(recordBtn, false, 'Record');
                        return;
                    }
                    
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.wav');
                    formData.append('lang', sourceLanguage.value === 'auto' ? 'en' : sourceLanguage.value);

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
                        updateCharCounter();
                        showNotification('Speech recognized successfully!', 'success');
                    } catch (error) {
                        showNotification(`Speech recognition error: ${error.message}`, 'error');
                        console.error(error);
                    } finally {
                        setLoadingState(recordBtn, false, 'Record');
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordBtn.textContent = '⏹️ Stop Recording';
                recordBtn.classList.add('recording');
                showNotification('Recording started. Speak clearly...', 'info');
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    showNotification('Microphone access denied. Please allow microphone permissions.', 'error');
                } else {
                    showNotification(`Could not access microphone: ${error.message}`, 'error');
                }
                console.error(error);
            }
        } else {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            isRecording = false;
            recordBtn.textContent = '🎤 Record';
            recordBtn.classList.remove('recording');
            showNotification('Recording stopped. Processing...', 'info');
        }
    }
    
    recordBtn.addEventListener('click', toggleRecording);

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
