import React from 'react';
import './App.css';
import ASRTest from './components/ASRTest';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>语音转文字应用</h1>
      </header>
      <main>
        <ASRTest />
      </main>
      <footer>
        <p>语音识别演示 © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
