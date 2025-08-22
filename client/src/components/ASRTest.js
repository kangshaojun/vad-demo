import React, { useState, useRef, useEffect } from 'react';
import './ASRTest.css';

const ASRTest = () => {
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [vadReady, setVadReady] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const vadRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const initVAD = async () => {
      try {
        // 等待全局vad对象可用
        if (window.vad && window.vad.MicVAD) {
          setVadReady(true);
        } else {
          // 如果还没加载完成，等待一下
          setTimeout(initVAD, 100);
        }
      } catch (error) {
        console.error('VAD初始化失败:', error);
      }
    };

    initVAD();
  }, []);

  const startListening = async () => {
    if (!vadReady || !window.vad) {
      alert('VAD库还未加载完成，请稍后再试');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsListening(true);

      vadRef.current = await window.vad.MicVAD.new({
        onSpeechStart: () => {
          console.log('检测到语音开始');
          startRecording();
        },
        onSpeechEnd: (audio) => {
          console.log('检测到语音结束');
          
          // 直接使用VAD提供的音频数据，这样更可靠
          if (audio && audio.length > 0) {
            console.log('VAD提供的音频数据长度:', audio.length);
            convertFloat32ArrayToBlob(audio);
          } else {
            console.error('VAD没有提供音频数据');
          }
          
          // 同时停止我们的录制（作为备用）
          if (isRecording) {
            setTimeout(() => {
              stopRecording();
            }, 200);
          }
        }
      });

      vadRef.current.start();
    } catch (error) {
      console.error('启动VAD失败:', error);
      alert('启动语音检测失败，请检查麦克风权限');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current = null;
    }
    
    if (isRecording) {
      stopRecording();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const convertFloat32ArrayToBlob = (float32Array) => {
    console.log('转换VAD音频数据为blob...');
    // 将Float32Array转换为WAV格式
    const sampleRate = 16000;
    const numChannels = 1;
    const buffer = new ArrayBuffer(44 + float32Array.length * 2);
    const view = new DataView(buffer);
    
    // WAV文件头
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + float32Array.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, float32Array.length * 2, true);
    
    // 音频数据
    let offset = 44;
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    const audioBlob = new Blob([buffer], { type: 'audio/wav' });
    console.log('VAD音频blob大小:', audioBlob.size);
    uploadAudio(audioBlob);
  };

  const startRecording = () => {
    if (!streamRef.current || isRecording) return;
    
    console.log('开始录制音频...');
    setIsRecording(true);
    audioChunksRef.current = [];
    
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log('录制到音频数据，大小:', event.data.size);
        audioChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('录制完成，音频blob大小:', audioBlob.size);
      if (audioBlob.size > 0) {
        uploadAudio(audioBlob);
      } else {
        console.error('录制的音频为空');
      }
    };
    
    mediaRecorderRef.current.start(100); // 每100ms收集一次数据
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('停止录制音频...');
      setIsRecording(false);
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAudio = async (audioBlob) => {
    console.log('开始上传音频到后端...');
    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      console.log('发送POST请求到/transcribe');
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('后端响应状态:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('转录结果:', result);
        setTranscription(prev => prev + (prev ? ' ' : '') + result.text);
      } else {
        const errorText = await response.text();
        console.error('识别失败，状态码:', response.status, '错误信息:', errorText);
      }
    } catch (error) {
      console.error('转录请求失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearTranscription = () => {
    setTranscription('');
  };

  return (
    <div className="asr-container">
      <div className="control-panel">
        <button 
          className={`record-button ${isListening ? 'listening' : ''}`} 
          onClick={isListening ? stopListening : startListening}
          disabled={!vadReady}
        >
          {!vadReady ? '初始化中...' : (isListening ? '停止监听' : '开始监听')}
        </button>
        <button 
          className="clear-button"
          onClick={clearTranscription} 
          disabled={!transcription}
        >
          清空结果
        </button>
      </div>
      
      <div className="status-panel">
        <div className={`status-indicator ${isListening ? 'active' : ''}`}>
          {isListening ? '正在监听语音...' : '未监听'}
        </div>
        <div className={`recording-indicator ${isRecording ? 'recording' : ''}`}>
          {isRecording ? '🔴 正在录制' : '⚪ 待机中'}
        </div>
        {loading && <div className="loading-indicator">🔄 转换中...</div>}
      </div>
      
      {vadReady && (
        <div className="vad-status">
          ✅ VAD已就绪
        </div>
      )}
      
      {transcription && (
        <div className="transcription-result">
          <h3>识别结果</h3>
          <div className="result-text">{transcription}</div>
        </div>
      )}
      
      <div className="instructions">
        <h4>使用说明：</h4>
        <ul>
          <li>等待VAD初始化完成</li>
          <li>点击"开始监听"开启语音活动检测</li>
          <li>当检测到说话时会自动开始录制</li>
          <li>停止说话后会自动停止录制并转换为文字</li>
          <li>转换结果会自动显示在下方</li>
        </ul>
      </div>
    </div>
  );
};

export default ASRTest;
