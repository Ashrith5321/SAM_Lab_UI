import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 9-Motor Controller UI (WebSerial)
 * ---------------------------------
 * Works with Chrome/Edge on desktop (Web Serial API).
 * Click "Connect" → select your Arduino port → press and hold a motor button.
 * Commands sent to Arduino: "ON <index> <speed>" and "OFF <index>".
 */

export default function MotorGrid() {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [speed, setSpeed] = useState(200); // 0–255
  const [log, setLog] = useState([]);
  const readerRef = useRef(null);
  const enc = useMemo(() => new TextEncoder(), []); 

  // Detect browser WebSerial support
  useEffect(() => {
    setIsSupported("serial" in navigator);
  }, []);

  const logLine = (text) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${text}`, ...prev.slice(0, 200)]);

  async function connect() {
    try {
      // Ask user to select the serial port
      const p = await navigator.serial.requestPort();
      await p.open({ baudRate: 115200 });
      setPort(p);
      const w = p.writable.getWriter();
      setWriter(w);
      setIsConnected(true);
      logLine("Connected to Arduino.");

      // Optional: Read feedback from Arduino
      const textDecoder = new TextDecoderStream();
      p.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) logLine(`RX: ${value.trim()}`);
          }
        } catch {}
      })();
    } catch (err) {
      logLine(`Connect error: ${err.message}`);
    }
  }

  async function disconnect() {
    try {
      await sendLine("OFF ALL");
    } catch {}
    try {
      readerRef.current?.releaseLock();
      await port?.close();
      await writer?.releaseLock();
    } catch {}
    setWriter(null);
    setPort(null);
    setIsConnected(false);
    logLine("Disconnected.");
  }

  async function sendLine(line) {
    if (!writer) throw new Error("Not connected");
    logLine(`TX: ${line}`);
    await writer.write(enc.encode(line + "\n"));
  }

  function handleDown(i) {
    sendLine(`ON ${i} ${speed}`).catch(() => {});
  }

  function handleUp(i) {
    sendLine(`OFF ${i}`).catch(() => {});
  }

  // Reusable button for each motor
  const MotorButton = ({ idx }) => (
    <button
      onMouseDown={() => handleDown(idx)}
      onMouseUp={() => handleUp(idx)}
      onMouseLeave={() => handleUp(idx)}
      onTouchStart={(e) => {
        e.preventDefault();
        handleDown(idx);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleUp(idx);
      }}
      disabled={!isConnected}
      className={`motor-btn ${isConnected ? "active" : "disabled"}`}
    >
      Motor {idx}
    </button>
  );

  return (
    <div className="container">
      <h1>🔩 9-Motor Controller</h1>
      <p className="subtitle">Connect via WebSerial and press a motor button to spin.</p>

      {!isSupported && (
        <p className="warning">
          ❌ WebSerial not supported. Use Chrome/Edge on desktop.
        </p>
      )}

      <div className="controls">
        {!isConnected ? (
          <button onClick={connect} className="connect-btn">
            Connect
          </button>
        ) : (
          <button onClick={disconnect} className="disconnect-btn">
            Disconnect
          </button>
        )}
        <button
          onClick={() => sendLine("OFF ALL").catch(() => {})}
          disabled={!isConnected}
          className="stop-btn"
        >
          Stop All
        </button>
      </div>

      <div className="speed-slider">
        <label>Speed: {speed}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={speed}
          onChange={(e) => setSpeed(parseInt(e.target.value))}
        />
      </div>

      <div className="grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <MotorButton key={i} idx={i + 1} />
        ))}
      </div>

      <h3>Serial Log</h3>
      <pre className="log">{log.join("\n") || "(no messages yet)"}</pre>
    </div>
  );
}
