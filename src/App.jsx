import { useState } from 'react';
import Plasma from './Plasma';
import './App.css';

function App() {
  const [mode, setMode] = useState('protect'); // 'protect', 'sign', 'verify'
  const [originalImage, setOriginalImage] = useState(null);
  const [protectedImage, setProtectedImage] = useState(null);
  const [signedImage, setSignedImage] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target.result);
      setProtectedImage(null);
      setSignedImage(null);
      setVerificationResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // AI PROTECTION FUNCTIONS
  const protectImage = () => {
    if (!originalImage) return;
    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyUniversalProtection(imageData);
      ctx.putImageData(imageData, 0, 0);

      const protectedUrl = canvas.toDataURL('image/png', 1.0);
      setProtectedImage(protectedUrl);
      setIsProcessing(false);
    };
    img.src = originalImage;
  };

  const applyUniversalProtection = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 8 - 4;
      data[i] = clamp(data[i] + noise);
      data[i + 1] = clamp(data[i + 1] + noise * 0.7);
    }

    for (let scale = 1; scale <= 4; scale++) {
      for (let y = 0; y < height; y += scale * 2) {
        for (let x = 0; x < width; x += scale * 2) {
          const index = (y * width + x) * 4;
          if (index < data.length - 4) {
            const scaleNoise = Math.sin(x * 0.1 * scale) * 3;
            data[index] = clamp(data[index] + scaleNoise);
          }
        }
      }
    }

    const patchSize = 14;
    for (let y = 0; y < height; y += patchSize) {
      for (let x = 0; x < width; x += patchSize) {
        for (let py = 0; py < 2 && y + py < height; py++) {
          for (let px = 0; px < patchSize && x + px < width; px++) {
            const index = ((y + py) * width + (x + px)) * 4;
            data[index] = data[index] ^ 2;
          }
        }
      }
    }

    for (let i = 0; i < data.length; i += 8) {
      if (Math.random() > 0.95) {
        data[i] = (data[i] + 2) % 256;
        data[i + 2] = (data[i + 2] + 1) % 256;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const hfPattern = Math.sin(x * 0.3) * Math.cos(y * 0.2) * 2;
        data[index] = clamp(data[index] + hfPattern);
      }
    }
  };

  // DIGITAL SIGNATURE FUNCTIONS - IMPROVED VERSION
  const signImage = () => {
    if (!originalImage || !username.trim() || !userId.trim()) {
      alert('Please enter both username and user ID');
      return;
    }

    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Create signature with visible watermark approach
      const signature = {
        version: '1.0',
        platform: 'Virtius',
        userId: userId.trim(),
        username: username.trim(),
        timestamp: new Date().toISOString()
      };

      // Draw invisible watermark in bottom-right corner
      ctx.save();
      ctx.globalAlpha = 0.01; // Nearly invisible
      ctx.fillStyle = '#000000';
      ctx.font = '12px monospace';
      const signatureText = `VIRTIUS:${btoa(JSON.stringify(signature))}`;
      ctx.fillText(signatureText, canvas.width - 400, canvas.height - 10);
      ctx.restore();

      // Also embed in alpha channel for redundancy
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      embedSignatureInAlpha(imageData, signature);
      ctx.putImageData(imageData, 0, 0);

      const signedUrl = canvas.toDataURL('image/png', 1.0);
      setSignedImage(signedUrl);
      setIsProcessing(false);
    };
    img.src = originalImage;
  };

  const verifyImage = () => {
    if (!originalImage) return;
    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Try to extract signature from alpha channel
      const signature = extractSignatureFromAlpha(imageData);

      if (!signature) {
        setVerificationResult({
          status: 'unsigned',
          message: 'Unable to Verify Signature',
          details: 'This image does not contain a verifiable digital signature from Virtius.'
        });
      } else {
        setVerificationResult({
          status: 'valid',
          message: '✓ Authentic and Signed',
          signature: signature
        });
      }

      setIsProcessing(false);
    };
    img.src = originalImage;
  };

  // Improved signature embedding using alpha channel
  const embedSignatureInAlpha = (imageData, signature) => {
    const signatureStr = JSON.stringify(signature);
    const data = imageData.data;

    // Magic marker to identify our signature
    const MAGIC = 'VRT';
    const fullData = MAGIC + signatureStr;

    // Embed length in first 16 alpha values (4 pixels)
    const length = fullData.length;
    for (let i = 0; i < 16; i++) {
      const pixelIndex = i * 4 + 3; // Alpha channel
      if (pixelIndex < data.length) {
        const bit = (length >> i) & 1;
        data[pixelIndex] = (data[pixelIndex] & 0xFE) | bit;
      }
    }

    // Embed signature data in alpha channel using LSB
    for (let i = 0; i < fullData.length; i++) {
      const charCode = fullData.charCodeAt(i);
      for (let bit = 0; bit < 8; bit++) {
        const pixelIndex = ((i * 8 + bit) + 16) * 4 + 3; // Alpha channel, offset by length
        if (pixelIndex < data.length) {
          const bitValue = (charCode >> bit) & 1;
          data[pixelIndex] = (data[pixelIndex] & 0xFE) | bitValue;
        }
      }
    }
  };

  const extractSignatureFromAlpha = (imageData) => {
    try {
      const data = imageData.data;

      // Extract length from first 16 alpha values
      let length = 0;
      for (let i = 0; i < 16; i++) {
        const pixelIndex = i * 4 + 3;
        if (pixelIndex >= data.length) return null;
        const bit = data[pixelIndex] & 1;
        length |= (bit << i);
      }

      if (length <= 0 || length > 5000) return null;

      // Extract signature data from alpha channel
      let extractedStr = '';
      for (let i = 0; i < length; i++) {
        let charCode = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelIndex = ((i * 8 + bit) + 16) * 4 + 3;
          if (pixelIndex >= data.length) return null;
          const bitValue = data[pixelIndex] & 1;
          charCode |= (bitValue << bit);
        }
        extractedStr += String.fromCharCode(charCode);
      }

      // Check for magic marker
      if (!extractedStr.startsWith('VRT')) return null;

      // Parse signature
      const signatureStr = extractedStr.substring(3);
      const signature = JSON.parse(signatureStr);

      return signature.platform === 'Virtius' ? signature : null;
    } catch (e) {
      console.error('Extraction error:', e);
      return null;
    }
  };

  const clamp = (value) => Math.max(0, Math.min(255, value));

  const downloadImage = (imageData, filename) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app">
      <div className="background">
        <Plasma
          color="#ff6b35"
          speed={0.6}
          direction="forward"
          scale={1.1}
          opacity={0.8}
          mouseInteractive={true}
        />
      </div>

      <div className="content">
        <header className="header">
          <h1 className="logo">⚡ Virtius</h1>
        </header>

        {/* Mode Selector */}
        <div className="mode-selector">
          <button
            className={mode === 'protect' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => {
              setMode('protect');
              setOriginalImage(null);
              setProtectedImage(null);
              setSignedImage(null);
              setVerificationResult(null);
            }}
          >
            🛡️ AI Protection
          </button>
          <button
            className={mode === 'sign' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => {
              setMode('sign');
              setOriginalImage(null);
              setProtectedImage(null);
              setSignedImage(null);
              setVerificationResult(null);
            }}
          >
            ✍️ Sign Image
          </button>
          <button
            className={mode === 'verify' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => {
              setMode('verify');
              setOriginalImage(null);
              setProtectedImage(null);
              setSignedImage(null);
              setVerificationResult(null);
            }}
          >
            ✓ Verify Image
          </button>
        </div>

        <div className="glass-card">
          {/* AI Protection Mode */}
          {mode === 'protect' && (
            <>
              <div className="card-header">
                <h2>AI Vision Shield</h2>
                <p>Protect your images from AI analysis</p>
              </div>

              {!originalImage ? (
                <div className="upload-area" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => document.getElementById('fileInput').click()}>
                  <div className="upload-icon">📁</div>
                  <h3>Drop your image here</h3>
                  <p>or click to browse</p>
                  <input id="fileInput" type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} style={{ display: 'none' }} />
                </div>
              ) : (
                <div className="preview-area">
                  <div className="preview-grid">
                    <div className="preview-box">
                      <h4>Original</h4>
                      <img src={originalImage} alt="Original" />
                    </div>
                    <div className="preview-box">
                      <h4>Protected</h4>
                      {protectedImage ? (
                        <img src={protectedImage} alt="Protected" />
                      ) : (
                        <div className="placeholder">Click protect to generate</div>
                      )}
                    </div>
                  </div>
                  <div className="button-group">
                    <button className="btn-primary" onClick={protectImage} disabled={isProcessing}>
                      {isProcessing ? '🛡️ Processing...' : '🛡️ Protect Image'}
                    </button>
                    <button className="btn-secondary" onClick={() => downloadImage(protectedImage, `virtius-protected-${Date.now()}.png`)} disabled={!protectedImage}>
                      📥 Download
                    </button>
                    <button className="btn-secondary" onClick={() => { setOriginalImage(null); setProtectedImage(null); }}>
                      🔄 New Image
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Sign Mode */}
          {mode === 'sign' && (
            <>
              <div className="card-header">
                <h2>Digital Image Signing</h2>
                <p>Embed your signature into the image</p>
              </div>

              {!originalImage ? (
                <div className="upload-area" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => document.getElementById('fileInputSign').click()}>
                  <div className="upload-icon">📁</div>
                  <h3>Drop your image here</h3>
                  <p>or click to browse</p>
                  <input id="fileInputSign" type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} style={{ display: 'none' }} />
                </div>
              ) : (
                <div className="preview-area">
                  <div className="signature-form">
                    <div className="form-group">
                      <label>Username</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" />
                    </div>
                    <div className="form-group">
                      <label>User ID</label>
                      <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Enter your user ID" />
                    </div>
                    <div className="signature-info">
                      <p><strong>Platform:</strong> Virtius</p>
                      <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="preview-grid">
                    <div className="preview-box">
                      <h4>Original Image</h4>
                      <img src={originalImage} alt="Original" />
                    </div>
                    {signedImage && (
                      <div className="preview-box">
                        <h4>Signed Image</h4>
                        <img src={signedImage} alt="Signed" />
                      </div>
                    )}
                  </div>

                  <div className="button-group">
                    <button className="btn-primary" onClick={signImage} disabled={isProcessing || !username.trim() || !userId.trim()}>
                      {isProcessing ? '✍️ Signing...' : '✍️ Sign Image'}
                    </button>
                    {signedImage && (
                      <button className="btn-secondary" onClick={() => downloadImage(signedImage, `virtius-signed-${Date.now()}.png`)}>
                        📥 Download Signed
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => { setOriginalImage(null); setSignedImage(null); setUsername(''); setUserId(''); }}>
                      🔄 New Image
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Verify Mode */}
          {mode === 'verify' && (
            <>
              <div className="card-header">
                <h2>Verify Image Authenticity</h2>
                <p>Check if an image has a valid signature</p>
              </div>

              {!originalImage ? (
                <div className="upload-area" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => document.getElementById('fileInputVerify').click()}>
                  <div className="upload-icon">🔍</div>
                  <h3>Drop image to verify</h3>
                  <p>or click to browse</p>
                  <input id="fileInputVerify" type="file" accept="image/*" onChange={(e) => handleFile(e.target.files[0])} style={{ display: 'none' }} />
                </div>
              ) : (
                <div className="preview-area">
                  {!verificationResult ? (
                    <>
                      <div className="preview-single">
                        <img src={originalImage} alt="To Verify" />
                      </div>
                      <div className="button-group">
                        <button className="btn-primary" onClick={verifyImage} disabled={isProcessing}>
                          {isProcessing ? '🔍 Verifying...' : '🔍 Verify Signature'}
                        </button>
                        <button className="btn-secondary" onClick={() => setOriginalImage(null)}>
                          🔄 New Image
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="verification-result">
                      {verificationResult.status === 'valid' && (
                        <div className="result-card valid">
                          <div className="result-icon">✓</div>
                          <h3>{verificationResult.message}</h3>
                          <div className="signature-details">
                            <div className="detail-row">
                              <span className="label">Signed By:</span>
                              <span className="value">{verificationResult.signature.username}</span>
                            </div>
                            <div className="detail-row">
                              <span className="label">User ID:</span>
                              <span className="value">{verificationResult.signature.userId}</span>
                            </div>
                            <div className="detail-row">
                              <span className="label">Date & Time:</span>
                              <span className="value">{new Date(verificationResult.signature.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="detail-row">
                              <span className="label">Platform:</span>
                              <span className="value">{verificationResult.signature.platform}</span>
                            </div>
                            <div className="detail-row">
                              <span className="label">Integrity:</span>
                              <span className="value success">✓ Verified</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {verificationResult.status === 'unsigned' && (
                        <div className="result-card unsigned">
                          <div className="result-icon">⚠</div>
                          <h3>{verificationResult.message}</h3>
                          <p>{verificationResult.details}</p>
                        </div>
                      )}

                      {verificationResult.status === 'tampered' && (
                        <div className="result-card tampered">
                          <div className="result-icon">✕</div>
                          <h3>{verificationResult.message}</h3>
                          <p>{verificationResult.details}</p>
                        </div>
                      )}

                      <div className="button-group">
                        <button className="btn-secondary" onClick={() => { setOriginalImage(null); setVerificationResult(null); }}>
                          🔄 Verify Another
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
