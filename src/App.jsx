import { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';
import 'shaka-player/dist/controls.css';

/* ==================== PARSER M3U (DENGAN DRM) ==================== */
function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const channels = [];
  let cur = {
    name: '',
    group: '',
    logo: '',
    url: '',
    licenseUrl: '',
    drmScheme: 'com.widevine.alpha' // default Widevine
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const comma = line.lastIndexOf(',');
      cur.name = comma !== -1 ? line.slice(comma + 1).trim() : 'Unknown';

      const nm = line.match(/tvg-name="([^"]*)"/);
      if (nm) cur.name = nm[1];
      const gr = line.match(/group-title="([^"]*)"/);
      if (gr) cur.group = gr[1];
      const lg = line.match(/tvg-logo="([^"]*)"/);
      if (lg) cur.logo = lg[1];

    } else if (line.startsWith('#KODIPROP:')) {
      // Ekstrak lisensi DRM
      const licenseType = line.match(/license_type=([^ ]*)/);
      if (licenseType) cur.drmScheme = licenseType[1];

      const licenseKey = line.match(/license_key=([^ ]*)/);
      if (licenseKey) cur.licenseUrl = licenseKey[1];

    } else if (line.startsWith('#') || line.startsWith('#')) {
      // Komentar lain diabaikan
      continue;
    } else {
      // URL stream
      cur.url = line;
      channels.push({ ...cur });
      // Reset untuk channel berikutnya
      cur = {
        name: '', group: '', logo: '', url: '',
        licenseUrl: '', drmScheme: 'com.widevine.alpha'
      };
    }
  }
  return channels;
}

/* ==================== APP ==================== */
function App() {
  const [channels, setChannels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gravity_channels')) || []; }
    catch { return []; }
  });
  const [currentChannel, setCurrentChannel] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [playerError, setPlayerError] = useState(null);

  // Form single
  const [fName, setFName] = useState('');
  const [fGroup, setFGroup] = useState('');
  const [fLogo, setFLogo] = useState('');
  const [fUrl, setFUrl] = useState('');

  // Import M3U
  const [m3u, setM3u] = useState('');
  const fileRef = useRef(null);

  // Player
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  /* Simpan ke localStorage */
  useEffect(() => {
    localStorage.setItem('gravity_channels', JSON.stringify(channels));
  }, [channels]);

  /* Inisialisasi player */
  useEffect(() => {
    if (!currentChannel) return;
    setPlayerError(null);

    const video = videoRef.current;
    if (!video) return;

    // Hentikan player sebelumnya
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const url = currentChannel.url;
    const isHLS = url.endsWith('.m3u8') || url.includes('m3u8');
    const hasDRM = !!currentChannel.licenseUrl;

    // Jika ada DRM atau bukan HLS, gunakan Shaka untuk menangani DRM
    if (hasDRM || !isHLS) {
      shaka.polyfill.installAll();
      if (shaka.Player.isBrowserSupported()) {
        const player = new shaka.Player(video);
        playerRef.current = player;

        // Konfigurasi DRM jika ada
        if (hasDRM) {
          player.configure({
            drm: {
              servers: {
                [currentChannel.drmScheme]: currentChannel.licenseUrl
              }
            }
          });
        }

        player.load(url).catch(err => {
          console.error('Shaka error, trying native', err);
          player.destroy();
          playerRef.current = null;
          // Fallback native
          video.src = url;
          video.play().catch(e => setPlayerError('Cannot play stream.'));
        });
      } else {
        video.src = url;
        video.play().catch(e => setPlayerError('Browser not supported.'));
      }
    } else {
      // HLS tanpa DRM, pakai native
      video.src = url;
      video.play().catch(err => setPlayerError('Cannot play stream.'));
    }

    // Cleanup saat unmount atau ganti channel
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      video.src = '';
    };
  }, [currentChannel]);

  const play = (ch) => {
    setCurrentChannel(ch);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  /* Tambah single stream */
  const addSingle = (e) => {
    e.preventDefault();
    if (!fUrl.trim()) return;
    const ch = {
      name: fName.trim() || 'Unnamed',
      group: fGroup.trim(),
      logo: fLogo.trim(),
      url: fUrl.trim(),
      licenseUrl: '',
      drmScheme: 'com.widevine.alpha'
    };
    setChannels(prev => [...prev, ch]);
    if (!currentChannel) setCurrentChannel(ch);
    setFName(''); setFGroup(''); setFLogo(''); setFUrl('');
    setShowAdd(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setM3u(ev.target.result);
    r.readAsText(file);
  };

  const importM3U = () => {
    if (!m3u.trim()) return;
    const parsed = parseM3U(m3u);
    if (parsed.length === 0) { alert('No valid channels'); return; }
    setChannels(prev => [...prev, ...parsed]);
    if (!currentChannel && parsed.length > 0) setCurrentChannel(parsed[0]);
    setM3u('');
    setShowAdd(false);
  };

  const toggle = (group) => setExpandedGroup(expandedGroup === group ? null : group);

  const grouped = channels.reduce((acc, ch) => {
    const g = ch.group || 'Uncategorized';
    if (!acc[g]) acc[g] = [];
    acc[g].push(ch);
    return acc;
  }, {});
  const groups = Object.keys(grouped).sort();

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* SIDEBAR */}
      <div style={{
        width: sidebarOpen ? '320px' : '0px',
        maxWidth: '85vw',
        height: '100dvh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.3s ease',
        flexShrink: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.1em' }}>CHANNELS</h2>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '← Back' : '+ Add'}
          </button>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
          {showAdd ? (
            <div>
              <form onSubmit={addSingle} style={{ marginBottom: 20 }}>
                <div className="form-group"><label>Name</label><input placeholder="Channel" value={fName} onChange={e => setFName(e.target.value)} /></div>
                <div className="form-group"><label>Group</label><input placeholder="Sports" value={fGroup} onChange={e => setFGroup(e.target.value)} /></div>
                <div className="form-group"><label>Manifest URL</label><input placeholder="https://..." required value={fUrl} onChange={e => setFUrl(e.target.value)} /></div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Add Stream</button>
              </form>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <p style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--text-muted)' }}>or import M3U playlist</p>
                <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={() => fileRef.current?.click()}>Load M3U File</button>
                <input type="file" accept=".m3u,.m3u8,.txt" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
                <textarea placeholder="#EXTM3U ..." value={m3u} onChange={e => setM3u(e.target.value)} style={{ width: '100%', minHeight: 100, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, fontSize: '0.8rem', resize: 'vertical' }} />
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={importM3U}>Import to Library</button>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No channels yet</p>
              <p style={{ fontSize: '0.7rem', marginTop: 6 }}>Click "+ Add" to import</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group} style={{ marginBottom: 2 }}>
                <button className="btn btn-ghost" onClick={() => toggle(group)} style={{
                  width: '100%', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.82rem',
                  padding: '12px 12px', background: expandedGroup === group ? 'var(--accent-glow)' : 'transparent',
                  color: expandedGroup === group ? 'var(--accent-light)' : 'var(--text-primary)',
                }}>
                  <span>{group}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{expandedGroup === group ? '▼' : '▶'} {grouped[group].length}</span>
                </button>
                {expandedGroup === group && (
                  <div style={{ paddingLeft: 12 }}>
                    {grouped[group].map((ch, i) => {
                      const active = currentChannel?.url === ch.url;
                      return (
                        <button key={i} className="btn btn-ghost" onClick={() => play(ch)} style={{
                          width: '100%', justifyContent: 'flex-start', fontSize: '0.78rem', padding: '9px 10px',
                          background: active ? 'rgba(139,92,246,0.2)' : 'transparent',
                          color: active ? 'var(--accent-light)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400,
                        }}>
                          {active && '● '}{ch.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* PLAYER AREA */}
      <div style={{ flex: 1, height: '100dvh', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          position: 'absolute', top: 12, left: 12, zIndex: 30,
          background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-primary)', cursor: 'pointer',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {currentChannel ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', background: '#000' }} controls autoPlay />
            <div className="badge" style={{ position: 'absolute', top: 14, left: 60, zIndex: 10 }}>
              {currentChannel.name}
            </div>
            {playerError && (
              <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(239,68,68,0.9)', color: 'white', padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
                {playerError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 12 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
            <p>Select a channel</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;