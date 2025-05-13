/**
 * Brige.Ver.2.0 PWA – GPT-4o Integration
 * ==================================================
 *  - Transcription: gpt-4o-mini-transcribe (fallback: gpt-4o-transcribe)
 *  - Translation:  gpt-4.1-nano
 *  - No TTS for now
 */

// ===== Global Config =====================================
const OPENAI_API_KEY = localStorage.getItem('OPENAI_API_KEY') || '';
const ASR_PRIMARY_MODEL = 'gpt-4o-mini-transcribe';
const ASR_FALLBACK_MODEL = 'gpt-4o-transcribe';
const TRANSLATE_MODEL   = 'gpt-4.1-nano';

const CHUNK_MS = 3000;          // audio chunk length
const SYSTEM_PROMPT = `You are a simultaneous interpreter. Translate Japanese <-> English in real-time, preserving meaning and tone.`;
const SLIDING_CONTEXT = 6;      // last N messages for context

// ===== UI Elements =======================================
const startJapaneseBtn = document.getElementById('startJapaneseBtn');
const startEnglishBtn  = document.getElementById('startEnglishBtn');
const stopBtn          = document.getElementById('stopBtn');
const myCaptionEl      = document.getElementById('myCaption');
const translationEl    = document.getElementById('translation');
const loadingOverlay   = document.getElementById('loadingOverlay');

const settingsBtn   = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput   = document.getElementById('apiKeyInput');
const saveKeyBtn    = document.getElementById('saveKeyBtn');

let mediaStream   = null;
let mediaRecorder = null;
let chunks        = [];
let currentLang   = 'ja';
let history       = []; // {role, content}
let isRecording   = false;
let isProcessing  = false;

// ====== helpers ==========================================
function showLoading(b){loadingOverlay.style.display=b?'flex':'none';}
function updateCaption(text,isTrans){(isTrans?translationEl:myCaptionEl).textContent=text;}
function addHistory(role,content){history.push({role,content});if(history.length>12)history.shift();}

// ===== UI Feedback Functions ============================
function showRecordingIndicator(show) {
  if (show) {
    document.body.classList.add('recording');
    const langBtn = currentLang === 'ja' ? startJapaneseBtn : startEnglishBtn;
    langBtn.classList.add('active');
  } else {
    document.body.classList.remove('recording');
    startJapaneseBtn.classList.remove('active');
    startEnglishBtn.classList.remove('active');
  }
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'error-message';
  errorEl.textContent = message;
  document.body.appendChild(errorEl);
  setTimeout(() => errorEl.classList.add('show'), 10);
  setTimeout(() => {
    errorEl.classList.remove('show');
    setTimeout(() => errorEl.remove(), 300);
  }, 3000);
}

// ===== Settings Modal ====================================
settingsBtn.onclick = () => {
  apiKeyInput.value = localStorage.getItem('OPENAI_API_KEY') || '';
  settingsModal.showModal();
};

saveKeyBtn.onclick = () => {
  const newApiKey = apiKeyInput.value.trim();
  if (newApiKey) {
    localStorage.setItem('OPENAI_API_KEY', newApiKey);
    settingsModal.close();
  } else {
    showError('APIキーを入力してください');
  }
};

// ===== Recording =========================================
async function startRecording(lang) {
  if (isRecording) {
    stopRecording();
    return;
  }
  
  const apiKey = localStorage.getItem('OPENAI_API_KEY');
  if (!apiKey) {
    showError('APIキーを設定してください');
    settingsModal.showModal();
    return;
  }
  
  try {
    currentLang = lang;
    isRecording = true;
    showRecordingIndicator(true);
    
    mediaStream = await navigator.mediaDevices.getUserMedia({audio: true});
    mediaRecorder = new MediaRecorder(mediaStream, {mimeType: 'audio/webm;codecs=opus'});

    mediaRecorder.ondataavailable = async e => {
      chunks.push(e.data);
      if (chunks.length * CHUNK_MS >= CHUNK_MS && !isProcessing) {
        isProcessing = true;
        const blob = new Blob(chunks, {type: 'audio/webm;codecs=opus'});
        chunks = [];
        try {
          const transcript = await transcribe(blob, lang);
          if (transcript) {
            updateCaption(transcript, false);
            addHistory('user', transcript);
            const translation = await translate();
            if (translation) {
              updateCaption(translation, true);
              addHistory('assistant', translation);
            }
          }
        } catch (error) {
          console.error('処理エラー:', error);
          showError('音声処理中にエラーが発生しました');
        } finally {
          isProcessing = false;
        }
      }
    };
    
    mediaRecorder.start(CHUNK_MS);
    showLoading(false);
  } catch (error) {
    console.error('録音開始エラー:', error);
    showError('マイクへのアクセスが許可されていません');
    isRecording = false;
    showRecordingIndicator(false);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
  }
  chunks = [];
  isRecording = false;
  showRecordingIndicator(false);
}

// ===== OpenAI API Calls ==================================
async function transcribe(blob, lang) {
  showLoading(true);
  const fd = new FormData();
  fd.append('model', ASR_PRIMARY_MODEL);
  fd.append('language', lang === 'ja' ? 'ja' : 'en');
  fd.append('file', blob, 'audio.webm');

  try {
    let res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('OPENAI_API_KEY')}`
      },
      body: fd
    });
    
    if (!res.ok) {
      console.warn('primary ASR failed, fallback');
      fd.set('model', ASR_FALLBACK_MODEL);
      res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('OPENAI_API_KEY')}`
        },
        body: fd
      });
    }
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(errorText);
      throw new Error(`API エラー: ${res.status}`);
    }
    
    const data = await res.json();
    showLoading(false);
    return data.text || '';
  } catch (error) {
    showLoading(false);
    console.error('文字起こしエラー:', error);
    showError('文字起こし中にエラーが発生しました');
    return '';
  }
}

async function translate() {
  showLoading(true);
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-SLIDING_CONTEXT)
    ];
    
    // オフライン状態をチェック
    if (!navigator.onLine) {
      throw new Error('オフラインです。インターネット接続を確認してください。');
    }
    
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        messages,
        stream: false
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: { message: `APIエラー: ${res.status}` } }));
      
      // オフラインエラーの特別処理
      if (errorData.error === 'offline') {
        throw new Error(errorData.message || 'ネットワーク接続がありません');
      }
      
      throw new Error(errorData.error?.message || `APIエラー: ${res.status}`);
    }
    
    const data = await res.json();
    showLoading(false);
    return data.choices[0].message.content.trim();
  } catch (error) {
    showLoading(false);
    console.error('翻訳エラー:', error);
    showError(error.message || '翻訳中にエラーが発生しました');
    return '';
  }
}

// ===== Event Bindings ====================================
startJapaneseBtn.onclick = () => startRecording('ja');
startEnglishBtn.onclick = () => startRecording('en');
stopBtn.onclick = () => stopRecording();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isRecording) stopRecording();
});

// ===== Service Worker Registration =======================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').then(
      function(registration) {
        console.log('Service Worker登録成功:', registration.scope);
      },
      function(error) {
        console.log('Service Worker登録失敗:', error);
      }
    );
  });
}

// ===== Application Init ==================================
window.addEventListener('load', function() {
  // APIキーがすでに設定されているか確認
  if (!localStorage.getItem('OPENAI_API_KEY')) {
    setTimeout(() => {
      settingsModal.showModal();
    }, 1000);
  }
  
  // UIのスタイルを追加（録音中のインジケーター）
  const style = document.createElement('style');
  style.textContent = `
    .recording .caption.self {
      border: 2px solid #ff3333;
    }
    .control-btn.active {
      background: #9c0000;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    .error-message {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background: #ff3333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      transition: transform 0.3s ease-out;
      font-size: 1.2rem;
      font-weight: 500;
      min-width: 280px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .error-message.show {
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
});