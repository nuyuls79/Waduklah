import React, { useState, useEffect, useRef } from 'react';
import Player from './components/Player';
import StreamConfig from './components/StreamConfig';
import Library from './components/Library';
import ConfirmModal from './components/ConfirmModal';
import { parseM3U } from './utils/m3uParser';

// Helper localStorage
const loadLibraryFromStorage = () => {
  try {
    const saved = localStorage.getItem('gravity_library');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to parse library:', e);
    return [];
  }
};

const loadCollapsedFromStorage = () => {
  try {
    const saved = localStorage.getItem('gravity_collapsed_groups');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
};

const loadPrefsFromStorage = () => {
  try {
    const saved = localStorage.getItem('gravity_prefs');
    return saved ? JSON.parse(saved) : { sortMode: 'alphabetical', viewMode: 'grid', gridSize: 'medium' };
  } catch (e) {
    return { sortMode: 'alphabetical', viewMode: 'grid', gridSize: 'medium' };
  }
};

function App() {
  const [activeConfig, setActiveConfig] = useState(null);
  const [library, setLibrary] = useState(loadLibraryFromStorage);
  const [editingId, setEditingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedFromStorage);
  const [prefs, setPrefs] = useState(loadPrefsFromStorage);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // State untuk sidebar Library (kiri) dan panel Settings (kanan? di atas player)
  const [librarySidebarOpen, setLibrarySidebarOpen] = useState(true); // sidebar daftar channel
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);  // panel import/tambah

  const isFirstRender = useRef(true);

  const [formConfig, setFormConfig] = useState({
    name: 'New Stream',
    manifestUrl: '',
    group: '',
    logo: '',
    drmScheme: '',
    clearKeys: '',
    licenseUrl: '',
    userAgent: '',
    referrer: '',
    authorization: ''
  });

  // Save to localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem('gravity_library', JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    localStorage.setItem('gravity_collapsed_groups', JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    localStorage.setItem('gravity_prefs', JSON.stringify(prefs));
  }, [prefs]);

  // Group library
  const groupedLibrary = library.reduce((acc, item) => {
    const group = item.group || 'Uncategorized';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const sortedGroups = prefs.sortMode === 'alphabetical'
    ? Object.keys(groupedLibrary).sort((a, b) => a.localeCompare(b))
    : Object.keys(groupedLibrary);

  const toggleGroup = (group) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handlePlay = (e) => {
    if (e) e.preventDefault();
    setActiveConfig({ ...formConfig });
    // Bisa langsung memutar, player ada di kanan
  };

  const handleSaveToLibrary = () => {
    if (editingId) {
      setLibrary(prev => prev.map(item =>
        item.id === editingId ? { ...formConfig, id: editingId } : item
      ));
      setEditingId(null);
    } else {
      const newItem = { ...formConfig, id: crypto.randomUUID(), addedAt: Date.now() };
      setLibrary(prev => [...prev, newItem]);
    }
    // Reset form
    setFormConfig({
      name: 'New Stream',
      manifestUrl: '',
      group: '',
      logo: '',
      drmScheme: '',
      clearKeys: '',
      licenseUrl: '',
      userAgent: '',
      referrer: '',
      authorization: ''
    });
    // Tutup panel settings setelah save
    setSettingsPanelOpen(false);
  };

  const handleImportM3U = (content) => {
    const playlists = parseM3U(content);
    if (playlists.length > 0) {
      const withTimestamp = playlists.map(p => ({ ...p, addedAt: Date.now() }));
      setLibrary(prev => [...prev, ...withTimestamp]);
    }
    setSettingsPanelOpen(false);
  };

  const handlePlayFromLibrary = (item) => {
    setActiveConfig(item);
  };

  const handleDelete = (id) => {
    const item = library.find(i => i.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Channel',
      message: `Are you sure you want to delete "${item?.name || 'this channel'}"?`,
      onConfirm: () => {
        setLibrary(prev => prev.filter(item => item.id !== id));
        if (editingId === id) setEditingId(null);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleClearAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Library',
      message: `Are you sure you want to delete all ${library.length} streams?`,
      onConfirm: () => {
        setLibrary([]);
        setEditingId(null);
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleEdit = (item) => {
    setFormConfig({ ...item });
    setEditingId(item.id);
    // Buka panel settings untuk mengedit
    setSettingsPanelOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormConfig({
      name: 'New Stream',
      manifestUrl: '',
      group: '',
      logo: '',
      drmScheme: '',
      clearKeys: '',
      licenseUrl: '',
      userAgent: '',
      referrer: '',
      authorization: ''
    });
    setSettingsPanelOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ====== SIDEBAR KIRI (LIBRARY) ====== */}
      <div style={{
        width: librarySidebarOpen ? '320px' : '0px',
        maxWidth: '85vw',
        height: '100dvh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
        transition: 'width 0.3s ease',
        flexShrink: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header sidebar */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.1em' }}>CHANNELS</h2>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            onClick={() => setLibrarySidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Library list (scroll) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <Library
            groupedItems={groupedLibrary}
            sortedGroups={sortedGroups}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            onPlay={handlePlayFromLibrary}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClearAll={handleClearAll}
            totalCount={library.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            prefs={prefs}
            onPrefsChange={setPrefs}
          />
        </div>
      </div>

      {/* ====== PLAYER AREA & SETTINGS PANEL ====== */}
      <div style={{ flex: 1, height: '100dvh', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Hamburger untuk buka Settings Panel */}
        <button
          onClick={() => setSettingsPanelOpen(true)}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 30,
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Tombol untuk membuka Library Sidebar (jika tertutup) */}
        {!librarySidebarOpen && (
          <button
            onClick={() => setLibrarySidebarOpen(true)}
            style={{
              position: 'absolute',
              top: 12,
              left: 60,
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
            {/* Overlay */}
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
            {/* Panel */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '340px',
              maxWidth: '90vw',
              background: 'var(--bg-secondary)',
              zIndex: 50,
              boxShadow: '5px 0 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Header panel */}
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
                  onClick={() => { setSettingsPanelOpen(false); if (editingId) handleCancelEdit(); }}
                >
                  ✕
                </button>
              </div>

              {/* Konten StreamConfig */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <StreamConfig
                  config={formConfig}
                  onConfigChange={setFormConfig}
                  onSubmit={(e) => { handlePlay(e); }}
                  onSaveToLibrary={handleSaveToLibrary}
                  onImportM3U={handleImportM3U}
                  isEditing={!!editingId}
                  onCancelEdit={handleCancelEdit}
                />
              </div>
            </div>
          </>
        )}

        {/* Player */}
        {activeConfig ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Player
              manifestUrl={activeConfig.manifestUrl}
              drmScheme={activeConfig.drmScheme}
              clearKeys={activeConfig.clearKeys}
              licenseUrl={activeConfig.licenseUrl}
              userAgent={activeConfig.userAgent}
              referrer={activeConfig.referrer}
              authorization={activeConfig.authorization}
              autoPlay={true}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48, opacity: 0.3, marginBottom: 12 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
            <p>Select a channel from the list</p>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />
    </div>
  );
}

export default App;