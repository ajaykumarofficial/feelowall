import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, X, Sliders, Volume2, VolumeX, Sparkles, Clock, Music } from 'lucide-react';
import AmbientEffects from './AmbientEffects';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LOFI_TRACKS = [
  { name: 'Ambient Lo-fi Chill', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { name: 'Dreamy Space Lounge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { name: 'Relaxing Rain Beat', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' }
];

export const SlideshowMode = ({ wallpapers = [], onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalTime, setIntervalTime] = useState(10); // in seconds
  const [ambientEffect, setAmbientEffect] = useState('none');
  
  // Audio settings
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const audioRef = useRef(null);

  // Auto-hiding control overlay
  const [controlsVisible, setControlsVisible] = useState(true);
  const hoverTimerRef = useRef(null);

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
      }
    }, 3500);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove(); // Trigger initially
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [isPlaying]);

  // Slideshow Timer
  useEffect(() => {
    if (!isPlaying || wallpapers.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % wallpapers.length);
    }, intervalTime * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, intervalTime, wallpapers.length]);

  // Sync music playing state with audio element
  useEffect(() => {
    if (!audioRef.current) return;
    if (musicPlaying) {
      audioRef.current.play().catch(err => console.error('Audio play blocked:', err));
    } else {
      audioRef.current.pause();
    }
  }, [musicPlaying, trackIndex]);

  if (!wallpapers || wallpapers.length === 0) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <h3>No Wallpapers for Slideshow</h3>
        <button onClick={onClose} className="btn btn-primary mt-3">Go Back</button>
      </div>
    );
  }

  const currentWp = wallpapers[currentIndex];
  const imageUrl = currentWp.imageUrl.startsWith('/uploads')
    ? `${BACKEND_URL}${currentWp.imageUrl}`
    : currentWp.imageUrl;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % wallpapers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + wallpapers.length) % wallpapers.length);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: 9990,
        overflow: 'hidden',
        cursor: controlsVisible ? 'default' : 'none'
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Background Ambient Audio Element */}
      <audio
        ref={audioRef}
        src={LOFI_TRACKS[trackIndex].url}
        loop
      />

      {/* Screen Saver Wallpaper Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        >
          <img
            src={imageUrl}
            alt={currentWp.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Fullscreen particle overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
        <AmbientEffects type={ambientEffect} />
      </div>

      {/* Subtle bottom vignette to ensure readability */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '180px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))',
          pointerEvents: 'none',
          zIndex: 3
        }}
      />

      {/* Controls HUD Overlay */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              bottom: '30px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: '850px',
              background: 'rgba(10, 10, 12, 0.45)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '1.2rem 2rem',
              borderRadius: '16px',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header: Title / Author / Exit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                  {currentWp.title}
                </h3>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                  by {currentWp.uploadedBy} • {currentIndex + 1} of {wallpapers.length}
                </span>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                title="Exit Slideshow"
              >
                <X size={16} />
              </button>
            </div>

            {/* Bottom Panel: Controls grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '2rem' }}>
              
              {/* Left Settings: Rotation Time & Particle overlays */}
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {/* Interval Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Clock size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <input
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={intervalTime}
                    onChange={(e) => setIntervalTime(Number(e.target.value))}
                    style={{ width: '90px', accentColor: 'var(--accent)', cursor: 'pointer', height: '4px' }}
                    title="Wallpaper change interval"
                  />
                  <span style={{ color: '#fff', fontSize: '0.78rem', minWidth: '25px', fontWeight: 'bold' }}>{intervalTime}s</span>
                </div>

                {/* Particle effect option */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={15} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <select
                    value={ambientEffect}
                    onChange={(e) => setAmbientEffect(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.78rem',
                      padding: '0.2rem 0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="none" style={{ background: '#121214' }}>No Effect</option>
                    <option value="rain" style={{ background: '#121214' }}>🌧️ Rain</option>
                    <option value="snow" style={{ background: '#121214' }}>❄️ Snow</option>
                    <option value="starfield" style={{ background: '#121214' }}>🌌 Starfield</option>
                    <option value="parallax" style={{ background: '#121214' }}>✨ Parallax</option>
                  </select>
                </div>
              </div>

              {/* Center Controls: Prev/Play/Next */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={handlePrev}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8 }}
                  title="Previous Wallpaper"
                >
                  <SkipBack size={20} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(235,94,40,0.3)'
                  }}
                  title={isPlaying ? 'Pause Slideshow' : 'Start Slideshow'}
                >
                  {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" style={{ marginLeft: '2px' }} />}
                </button>

                <button
                  onClick={handleNext}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8 }}
                  title="Next Wallpaper"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              {/* Right Music Settings */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Music size={15} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <select
                    value={trackIndex}
                    onChange={(e) => {
                      setTrackIndex(Number(e.target.value));
                      setMusicPlaying(true);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.78rem',
                      padding: '0.2rem 0.5rem',
                      maxWidth: '120px',
                      cursor: 'pointer'
                    }}
                  >
                    {LOFI_TRACKS.map((t, idx) => (
                      <option key={idx} value={idx} style={{ background: '#121214' }}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setMusicPlaying(!musicPlaying)}
                  style={{
                    background: musicPlaying ? 'rgba(235,94,40,0.15)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: musicPlaying ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={musicPlaying ? 'Mute Music' : 'Play Music'}
                >
                  {musicPlaying ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SlideshowMode;
