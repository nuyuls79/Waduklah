import React, { useState, useEffect, useRef } from 'react';
import Player from './components/Player';
import StreamConfig from './components/StreamConfig';
import Library from './components/Library';
import ConfirmModal from './components/ConfirmModal';
import { parseM3U } from './utils/m3uParser';

// Helper to load from localStorage
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
  const [view, setView] = useState('library');
  const [editingId, setEditingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedFromStorage);
  const [prefs, setPrefs] = useState(loadPrefsFromStorage);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    setCollapsedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const collapseAll = () => {
    const allCollapsed = {};
    sortedGroups.forEach(g => allCollapsed[g] = true);
    setCollapsedGroups(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  const handlePlay = (e) => {
    if (e) e.preventDefault();
    setActiveConfig({ ...formConfig });
    setView('player');
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
  };

  const handleImportM3U = (content) => {
    const playlists = parseM3U(content);
    if (playlists.length > 0) {
      const withTimestamp = playlists.map(p => ({ ...p, addedAt: Date.now() }));
      setLibrary(prev => [...prev, ...withTimestamp]);
      setView('library');
    }
  };

  const handlePlayFromLibrary = (item) => {
    setActiveConfig(item);
    setView('player');
  };

  const handleDelete = (id) => {
    const item = library.find(i => i.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Channel',
      message: `Are you sure you want to delete "${item?.name || 'this channel'}"? This action cannot be undone.`,
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
      message: `Are you sure you want to delete all ${library.length} streams? This action cannot be undone.`,
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
  };

  // ====================================================================
  // INI BAGIAN RETURN YANG DIUBAH KE SIDEBAR
  // ====================================================================
  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      
      {/* SIDEBAR KIRI */}
      {sidebarOpen && (
        <div style={{
          width: '320px',
          maxWidth: '85vw',
          height: '100dvh',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          flexShrink: 0,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h1 style={{ cursor: 'pointer', marginBottom: '4px' }} onClick={() => { setView('library'); }}>
              Gravity
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Network Stream Player</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {view === 'library' ? (
              <Library
                groupedItems={groupedLibrary}
                sortedGroups={sortedGroups}
                collapsedGroups={collapsedGroups}
                onToggleGroup={toggleGroup}
                onToggleAll={() => {
                  const allCollapsed = sortedGroups.every(g => collapsedGroups[g]);
                  if (allCollapsed) {
                    setCollapsedGroups({});
                  } else {
                    const all = {};
                    sortedGroups.forEach(g => all[g] = true);
                    setCollapsedGroups(all);
                  }
                }}
                allCollapsed={sortedGroups.length > 0 && sortedGroups.every(g => collapsedGroups[g])}
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
            ) : (
              <StreamConfig
                config={formConfig}
                onConfigChange={setFormConfig}
                onSubmit={(e) => { handlePlay(e); }}
                onSaveToLibrary={() => { handleSaveToLibrary(); }}
                onImportM3U={(content) => { handleImportM3U(content); }}
                isEditing={!!editingId}
                onCancelEdit={handleCancelEdit}
              />
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
            <button
              onClick={() => setView('library')}
              style={{
                flex: 1,
                padding: '8px',
                background: view === 'library' ? 'var(--accent-glow)' : 'transparent',
                color: view === 'library' ? 'var(--accent-light)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Library
            </button>
            <button
              onClick={() => setView('player')}
              style={{
                flex: 1,
                padding: '8px',
                background: view === 'player' ? 'var(--accent-glow)' : 'transparent',
                color: view === 'player' ? 'var(--accent-light)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Player {activeConfig && '●'}
            </button>
          </div>
        </div>
      )}

      {/* PLAYER AREA */}
      <div style={{ flex: 1, height: '100dvh', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Tombol buka/tutup sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
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
          {sidebarOpen ? '✕' : '☰'}
        </button>

        {activeConfig ? (
          <div style={{ width: '100%', height: '100%' }}>
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
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', maxWidth: '300px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📡</div>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'none', letterSpacing: 0 }}>
              No stream playing
            </h2>
            <p style={{ fontSize: '0.875rem' }}>
              Select a channel from the sidebar
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
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