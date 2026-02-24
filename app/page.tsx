"use client";

import { useEffect, useRef, useState } from "react";

type KnownUser = { name: string; src: string; hash?: string };

const KNOWN_USERS: KnownUser[] = [
  { name: "nd", src: "/users/nd.JPG" },
  { name: "rinki", src: "/users/rinki.JPG" },
  { name: "jhp", src: "/users/jhp.JPG" },
  { name: "jhapa", src: "/users/jhapa.JPG" },
];

function computeAverageHashFromCanvas(canvas: HTMLCanvasElement) {
  const size = 16;
  const ctx = canvas.getContext("2d")!;
  // resize into tmp canvas
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(canvas, 0, 0, size, size);
  const img = tctx.getImageData(0, 0, size, size).data;
  let sum = 0;
  const vals: number[] = [];
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], g = img[i + 1], b = img[i + 2];
    const gray = Math.round((r + g + b) / 3);
    vals.push(gray);
    sum += gray;
  }
  const avg = sum / vals.length;
  // build bitstring
  const bits = vals.map(v => (v > avg ? "1" : "0")).join("");
  return bits;
}

function hamming(a: string, b: string) {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [known, setKnown] = useState<KnownUser[]>(KNOWN_USERS);
  const [user, setUser] = useState<KnownUser | null>(null);
  const [messages, setMessages] = useState<{ name: string; text: string; ts: number }[]>([]);
  const [text, setText] = useState("");

  // preload known images and compute hashes
  useEffect(() => {
    const load = async () => {
      const out: KnownUser[] = [];
      for (const ku of KNOWN_USERS) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = ku.src;
        await new Promise(res => (img.onload = res));
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 200;
        c.height = img.naturalHeight || 200;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const hash = computeAverageHashFromCanvas(c);
        out.push({ ...ku, hash });
      }
      setKnown(out);
    };
    load();
    const stored = localStorage.getItem("messages:v1");
    if (stored) setMessages(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("messages:v1", JSON.stringify(messages));
  }, [messages]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) {
      alert("Camera access denied or unavailable.");
    }
  }

  function snapshotAndMatch() {
    const v = videoRef.current;
    if (!v) return;
    const c = canvasRef.current ?? document.createElement("canvas");
    c.width = v.videoWidth || 320;
    c.height = v.videoHeight || 240;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const hash = computeAverageHashFromCanvas(c);
    // find best match
    let best: { user: KnownUser; score: number } | null = null;
    for (const k of known) {
      if (!k.hash) continue;
      const s = hamming(hash, k.hash);
      if (!best || s < best.score) best = { user: k, score: s };
    }
    // threshold — smaller is better. 0 is identical. For this simple hash choose 100.
    if (best && best.score <= 100) {
      setUser(best.user);
    } else {
      alert("No matching face found. Try again or upload a photo.");
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 320;
      c.height = img.naturalHeight || 240;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const hash = computeAverageHashFromCanvas(c);
      let best: { user: KnownUser; score: number } | null = null;
      for (const k of known) {
        if (!k.hash) continue;
        const s = hamming(hash, k.hash);
        if (!best || s < best.score) best = { user: k, score: s };
      }
      if (best && best.score <= 100) setUser(best.user);
      else alert("No matching face found in upload.");
    };
    img.src = URL.createObjectURL(f);
  }

  function postMessage() {
    if (!user) return alert("Login first");
    if (!text.trim()) return;
    const m = { name: user.name, text: text.trim(), ts: Date.now() };
    setMessages(prev => [m, ...prev].slice(0, 100));
    setText("");
  }

  function logout() {
    setUser(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-8 font-sans">
      <div className="mx-auto max-w-4xl rounded-xl bg-white/80 p-6 shadow-lg">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Face Login — Messagtor</h1>
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.src} alt={user.name} className="h-10 w-10 rounded-full" />
              <div className="text-sm">
                <div className="font-medium">{user.name}</div>
                <button onClick={logout} className="text-xs text-slate-500">Logout</button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Not logged in</div>
          )}
        </header>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium">Login with Camera</div>
                <button onClick={startCamera} className="rounded bg-sky-600 px-3 py-1 text-white text-sm">Start Camera</button>
              </div>
              <video ref={videoRef} autoPlay className="mt-3 h-48 w-full overflow-hidden rounded bg-black" />
              <div className="mt-3 flex gap-2">
                <button onClick={snapshotAndMatch} className="rounded bg-green-600 px-3 py-1 text-white">Snapshot & Match</button>
                <label className="cursor-pointer rounded bg-gray-100 px-3 py-1 text-sm">
                  Upload Photo
                  <input accept="image/*" onChange={handleUpload} type="file" className="hidden" />
                </label>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-lg font-medium">Known Users</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {known.map(k => (
                  <button key={k.name} onClick={() => setUser(k)} className="flex items-center gap-3 rounded border p-2 text-left hover:bg-slate-50">
                    <img src={k.src} alt={k.name} className="h-12 w-12 rounded-full" />
                    <div>
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-slate-500">Click to login</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="text-lg font-medium">Message Board</div>
              <div className="mt-3">
                <textarea value={text} onChange={e => setText(e.target.value)} className="w-full rounded border p-2" rows={4} placeholder={user ? `Message as ${user.name}` : "Login to leave a message"} />
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={postMessage} className="rounded bg-indigo-600 px-3 py-1 text-white">Post</button>
                  <div className="text-sm text-slate-500">Messages are stored locally in your browser.</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-lg font-medium">Recent Messages</div>
              <div className="mt-3 space-y-3">
                {messages.length === 0 && <div className="text-sm text-slate-500">No messages yet</div>}
                {messages.map(m => (
                  <div key={m.ts} className="flex items-start gap-3">
                    <img src={`/users/${m.name}.svg`} className="h-10 w-10 rounded-full" />
                    <div>
                      <div className="text-sm font-medium">{m.name} <span className="text-xs text-slate-400">· {new Date(m.ts).toLocaleString()}</span></div>
                      <div className="mt-1 text-sm text-slate-700">{m.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  );
}
