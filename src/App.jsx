import React, { useState, useEffect, useRef } from 'react';
import shaka from 'shaka-player';
import 'shaka-player/dist/controls.css';

/* ==================== PARSER M3U (DENGAN DRM) - TIDAK DIUBAH ==================== */
function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const channels = [];
  let cur = {
    name: '',
    group: '',
    logo: '',
    url: '',
    licenseUrl: '',
    drmScheme: 'com.widevine.alpha'
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
      const licenseType = line.match(/license_type=([^ ]*)/);
      if (licenseType) cur.drmScheme = licenseType[1];

      const licenseKey = line.match(/license_key=([^ ]*)/);
      if (licenseKey) cur.licenseUrl = licenseKey[1];

    } else if (line.startsWith('#')) {
      continue;
    } else {
      cur.url = line;
      channels.push({ ...cur });
      cur = {
        name: '', group: '', logo: '', url: '',
        licenseUrl: '', drmScheme: 'com.widevine.alpha'
      };
    }
  }
  return channels;
}

/* ==================== PLAYER COMPONENT (TIDAK DIUBAH) ==================== */
function Player({ channel }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!channel) return;
    setError(null);

    const video = videoRef.current;
    if (!video) return;

    // Hentikan player sebelumnya
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    video.removeAttribute('src');
    video.load();

    const url = channel.url;
    const isHLS = url.endsWith('.m3u8') || url.includes('m3u8');
    const hasDRM = !!channel.licenseUrl;

    // HLS tanpa DRM → native
    if (isHLS && !hasDRM) {
      video.src = url;
      video.play().catch(e => {
        if (e.name !== 'AbortError') setError('Cannot play stream.');
      });
    }
    // DRM atau bukan HLS → Shaka Player
    else {
      shaka.polyfill.installAll();
      if (shaka.Player.isBrowserSupported()) {
        const player = new shaka.Player(video);
        playerRef.current = player;

        if (hasDRM) {
          player.configure({
            drm: {
              servers: {
                [channel.drmScheme || 'com.widevine.alpha']: channel.licenseUrl
              }
            }
          });
        }

        player.load(url)
          .then(() => {
            video.play().catch(e => {
              if (e.name !== 'AbortError') setError('Autoplay blocked.');
            });
          })
          .catch(err => {
            console.error('Shaka error, fallback native:', err);
            video.src = url;
            video.play().catch(e => setError('Cannot play stream.'));
          });
      } else {
        video.src = url;
        video.play().catch(e => setError('Cannot play stream.'));
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [channel]);

  if (!channel) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', background: '#000' }}
        controls
        autoPlay
      />
      <div className="badge" style={{
        position: 'absolute',
        top: 14,
        left: 60,
        zIndex: 10,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 12px',
        color: 'var(--text-primary)',
        fontSize: '0.8rem',
      }}>
        {channel.name}
      </div>
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(239,68,68,0.9)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: '0.8rem',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ==================== APP UTAMA (UI SIDEBAR, FUNGSI PLAYER TETAP) ==================== */
function App() {
  const [channels, setChannels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gravity_channels')) || []; }
    catch { return []; }
  });
  const [currentChannel, setCurrentChannel] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [librarySidebarOpen, setLibrarySidebarOpen] = useState(true);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formConfig, setFormConfig] = useState({
    name: '',
    group: '',
    logo: '',
    url: '',
    licenseUrl: '',
    drmScheme: 'com.widevine.alpha'
  });

  const [m3u, setM3u] = useState('');
  const fileRef = useRef(null);

  // Simpan ke localStorage
  useEffect(() => {
    localStorage.setItem('gravity_channels', JSON.stringify(channels));
  }, [channels]);

  const play = (ch) => {
    setCurrentChannel(ch);
    if (window.innerWidth <= 768) setLibrarySidebarOpen(false);
  };

  /* Tambah single stream */
  const addSingle = (e) => {
    e.preventDefault();
    if (!formConfig.url.trim()) return;
    const ch = {
      name: formConfig.name.trim() || 'Unnamed',
      group: formConfig.group.trim(),
      logo: formConfig.logo.trim(),
      url: formConfig.url.trim(),
      licenseUrl: formConfig.licenseUrl.trim(),
      drmScheme: formConfig.drmScheme || 'com.widevine.alpha'
    };
    setChannels(prev => [...prev, ch]);
    if (!currentChannel) setCurrentChannel(ch);
    resetForm();
    setSettingsPanelOpen(false);
  };

  const handleSaveToLibrary = () => {
    if (!formConfig.url.trim()) return;
    
    if (editingId) {
      setChannels(prev => prev.map(ch =>
        ch.url === editingId ? { ...formConfig, url: editingId } : ch
      ));
      setEditingId(null);
    } else {
      const ch = {
        name: formConfig.name.trim() || 'Unnamed',
        group: formConfig.group.trim(),
        logo: formConfig.logo.trim(),
        url: formConfig.url.trim(),
        licenseUrl: formConfig.licenseUrl.trim(),
        drmScheme: formConfig.drmScheme || 'com.widevine.alpha'
      };
      setChannels(prev => [...prev, ch]);
      if (!currentChannel) setCurrentChannel(ch);
    }
    resetForm();
    setSettingsPanelOpen(false);
  };

  const resetForm = () => {
    setFormConfig({
      name: '',
      group: '',
      logo: '',
      url: '',
      licenseUrl: '',
      drmScheme: 'com.widevine.alpha'
    });
  };

  const handleEdit = (ch) => {
    setFormConfig({ ...ch });
    setEditingId(ch.url);
    setSettingsPanelOpen(true);
  };

  const handleDelete = (ch) => {
    if (window.confirm(`Delete "${ch.name}"?`)) {
      setChannels(prev => prev.filter(item => item.url !== ch.url));
      if (currentChannel?.url === ch.url) setCurrentChannel(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm(`Delete all ${channels.length} channels?`)) {
      setChannels([]);
      setCurrentChannel(null);
    }
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
    setSettingsPanelOpen(false);
  };

  const toggle = (group) => setExpandedGroup(expandedGroup === group ? null : group);

  // Grouping & filtering
  const filtered = searchQuery
    ? channels.filter(ch => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  const grouped = filtered.reduce((acc, ch) => {
    const g = ch.group || 'Uncategorized';
    if (!acc[g]) acc[g] = [];
    acc[g].push(ch);
    return acc;
  }, {});
  const groups = Object.keys(grouped).sort();

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ====== SIDEBAR KIRI (LIBRARY) ====== */}
      <div style={{
        width: librarySidebarOpen ? '320px' : '0px',
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setSettingsPanelOpen(true)}>
              + Add
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setLibrarySidebarOpen(false)}>
              ✕
            </button>
          </div>
        </div>

        {/* Search & Clear */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
              marginBottom: '8px'
            }}
          />
          {channels.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={handleClearAll}
              style={{
                width: '100%',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                padding: '4px'
              }}
            >
              Clear All ({channels.length})
            </button>
          )}
        </div>

        {/* Library list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {groups.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>{searchQuery ? 'No channels found' : 'No channels yet'}</p>
              <p style={{ fontSize: '0.7rem', marginTop: 6 }}>Click "+ Add" to import</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group} style={{ marginBottom: 2 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => toggle(group)}
                  style={{
                    width: '100%',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    padding: '12px 12px',
                    background: expandedGroup === group ? 'var(--accent-glow)' : 'transparent',
                    color: expandedGroup === group ? 'var(--accent-light)' : 'var(--text-primary)',
                  }}
                >
                  <span>{group}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    {expandedGroup === group ? '▼' : '▶'} {grouped[group].length}
                  </span>
                </button>
                {expandedGroup === group && (
                  <div style={{ paddingLeft: 12 }}>
                    {grouped[group].map((ch, i) => {
                      const active = currentChannel?.url === ch.url;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => play(ch)}
                            style={{
                              flex: 1,
                              justifyContent: 'flex-start',
                              fontSize: '0.78rem',
                              padding: '9px 10px',
                              background: active ? 'rgba(139,92,246,0.2)' : 'transparent',
                              color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {active && '● '}{ch.name}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleEdit(ch)}
                            style={{ padding: '4px 6px', fontSize: '0.7rem', opacity: 0.6 }}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDelete(ch)}
                            style={{ padding: '4px 6px', fontSize: '0.7rem', opacity: 0.6, color: 'var(--danger)' }}
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ====== PLAYER AREA & SETTINGS PANEL ====== */}
      <div style={{ flex: 1, height: '100dvh', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Tombol buka Library Sidebar */}
        {!librarySidebarOpen && (
          <button
            onClick={() => setLibrarySidebarOpen(true)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 30,
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            ☰ Channels
          </button>
        )}

        {/* Settings Panel (Drawer) */}
        {settingsPanelOpen && (
          <>
            <div
              onClick={() => setSettingsPanelOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 40,
              }}
            />
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '360px',
              maxWidth: '90vw',
              background: 'var(--bg-secondary)',
              zIndex: 50,
              boxShadow: '5px 0 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  {editingId ? 'Edit Stream' : 'Add Stream'}
                </h2>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => { setSettingsPanelOpen(false); setEditingId(null); resetForm(); }}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {/* Form single stream */}
                <form onSubmit={addSingle} style={{ marginBottom: 20 }}>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      placeholder="Channel name"
                      value={formConfig.name}
                      onChange={e => setFormConfig(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Group</label>
                    <input
                      placeholder="e.g. Sports, News"
                      value={formConfig.group}
                      onChange={e => setFormConfig(prev => ({ ...prev, group: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Logo URL</label>
                    <input
                      placeholder="https://..."
                      value={formConfig.logo}
                      onChange={e => setFormConfig(prev => ({ ...prev, logo: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Manifest URL *</label>
                    <input
                      placeholder="https://..."
                      required
                      value={formConfig.url}
                      onChange={e => setFormConfig(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>License URL (DRM)</label>
                    <input
                      placeholder="https://..."
                      value={formConfig.licenseUrl}
                      onChange={e => setFormConfig(prev => ({ ...prev, licenseUrl: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>DRM Scheme</label>
                    <select
                      value={formConfig.drmScheme}
                      onChange={e => setFormConfig(prev => ({ ...prev, drmScheme: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="com.widevine.alpha">Widevine</option>
                      <option value="com.microsoft.playready">PlayReady</option>
                      <option value="com.apple.fps.1_0">FairPlay</option>
                      <option value="org.w3.clearkey">ClearKey</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      Play Now
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleSaveToLibrary}>
                      {editingId ? 'Update' : 'Save to Library'}
                    </button>
                  </div>
                </form>

                {/* Import M3U */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <p style={{ fontSize: '0.75rem', marginBottom: 8, color: 'var(--text-muted)' }}>
                    or import M3U playlist
                  </p>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginBottom: 8 }}
                    onClick={() => fileRef.current?.click()}
                  >
                    Load M3U File
                  </button>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,.txt"
                    ref={fileRef}
                    style={{ display: 'none' }}
                    onChange={handleFile}
                  />
                  <textarea
                    placeholder="#EXTM3U ..."
                    value={m3u}
                    onChange={e => setM3u(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 100,
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      fontSize: '0.8rem',
                      resize: 'vertical',
                      marginBottom: 8
                    }}
                  />
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={importM3U}>
                    Import to Library
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Player */}
        {currentChannel ? (
          <Player channel={currentChannel} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 12 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
            <p>Select a channel from the list</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;