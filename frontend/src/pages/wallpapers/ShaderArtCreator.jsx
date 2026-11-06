import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import wallpaperService from '../../services/wallpaperService';
import { Sparkles, Download, UploadCloud, RefreshCw, Sliders, Palette, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const THEMES = [
  { name: 'Sunset Neon', c1: '#ff007f', c2: '#ffaa00', c3: '#00f0ff' },
  { name: 'Cosmic Purple', c1: '#7b2cb0', c2: '#3c096c', c3: '#e0aaff' },
  { name: 'Ocean Breeze', c1: '#00f0ff', c2: '#0072ff', c3: '#00ffd0' },
  { name: 'Forest Jade', c1: '#1b4332', c2: '#52b788', c3: '#d8f3dc' },
  { name: 'Monochrome Cyber', c1: '#111111', c2: '#555555', c3: '#ffffff' }
];

const VERTEX_SHADER_SOURCE = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_speed;
  uniform float u_scale;
  uniform float u_complexity;
  uniform float u_distortion;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * u_speed * 0.3;
    
    // Swirling distortion logic
    for(float i = 1.0; i < 6.0; i++) {
      if (i > u_complexity) break;
      p.x += sin(p.y + t + i * 0.8) * u_distortion;
      p.y += cos(p.x + t + i * 0.6) * u_distortion;
    }
    
    float len = length(p * u_scale);
    float val = sin(len - t) * 0.5 + 0.5;
    
    vec3 col = mix(u_color1, u_color2, val);
    col = mix(col, u_color3, sin(val * 3.14159) * 0.5 + 0.5);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

const hexToVec3 = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : [0.5, 0.5, 0.5];
};

export const ShaderArtCreator = ({ showToast }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Shader parameters
  const [speed, setSpeed] = useState(1.0);
  const [scale, setScale] = useState(3.0);
  const [complexity, setComplexity] = useState(3.0);
  const [distortion, setDistortion] = useState(0.5);
  
  // Custom palette colors
  const [color1, setColor1] = useState(THEMES[0].c1);
  const [color2, setColor2] = useState(THEMES[0].c2);
  const [color3, setColor3] = useState(THEMES[0].c3);

  // Form states for publishing
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [title, setTitle] = useState('Generative Plasma Swirl');
  const [category, setCategory] = useState('Minimalist');
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [tagsString, setTagsString] = useState('plasma, fluid, swirl');

  const animationRef = useRef(null);
  const glRef = useRef(null);
  const uniformsRef = useRef({});
  const timeRef = useRef(0);

  const initWebGL = (canvas) => {
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return null;
    }

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VERTEX_SHADER_SOURCE);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS compile error:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FRAGMENT_SHADER_SOURCE);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS compile error:', gl.getShaderInfoLog(fs));
    }

    // Link program
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    gl.useProgram(program);

    // Quad Buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Cache Uniform Locations
    uniformsRef.current = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      speed: gl.getUniformLocation(program, 'u_speed'),
      scale: gl.getUniformLocation(program, 'u_scale'),
      complexity: gl.getUniformLocation(program, 'u_complexity'),
      distortion: gl.getUniformLocation(program, 'u_distortion'),
      color1: gl.getUniformLocation(program, 'u_color1'),
      color2: gl.getUniformLocation(program, 'u_color2'),
      color3: gl.getUniformLocation(program, 'u_color3')
    };

    glRef.current = gl;
    return gl;
  };

  const renderFrame = (gl, time) => {
    if (!gl || !canvasRef.current) return;
    const canvas = canvasRef.current;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Pass parameters to shaders
    gl.uniform1f(uniformsRef.current.time, time);
    gl.uniform2f(uniformsRef.current.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniformsRef.current.speed, speed);
    gl.uniform1f(uniformsRef.current.scale, scale);
    gl.uniform1f(uniformsRef.current.complexity, complexity);
    gl.uniform1f(uniformsRef.current.distortion, distortion);
    gl.uniform3fv(uniformsRef.current.color1, hexToVec3(color1));
    gl.uniform3fv(uniformsRef.current.color2, hexToVec3(color2));
    gl.uniform3fv(uniformsRef.current.color3, hexToVec3(color3));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = initWebGL(canvas);
    if (!gl) return;

    // Handle initial resize
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    let lastTime = 0;
    const loop = (timestamp) => {
      const delta = (timestamp - lastTime) * 0.001;
      lastTime = timestamp;
      
      // Update running time based on speed factor
      timeRef.current += delta;
      renderFrame(gl, timeRef.current);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [speed, scale, complexity, distortion, color1, color2, color3]);

  const handleRandomize = () => {
    setSpeed(Number((Math.random() * 1.5 + 0.3).toFixed(2)));
    setScale(Number((Math.random() * 6.0 + 1.5).toFixed(2)));
    setComplexity(Math.floor(Math.random() * 4 + 2));
    setDistortion(Number((Math.random() * 0.9 + 0.1).toFixed(2)));
    
    // Choose a random theme or randomize colors
    if (Math.random() > 0.4) {
      const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
      setColor1(randomTheme.c1);
      setColor2(randomTheme.c2);
      setColor3(randomTheme.c3);
    } else {
      const randomHex = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      setColor1(randomHex());
      setColor2(randomHex());
      setColor3(randomHex());
    }
  };

  const getHighResBlob = async () => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const gl = glRef.current;
      if (!canvas || !gl) {
        resolve(null);
        return;
      }

      // Temporarily resize to 1080p
      const prevW = canvas.width;
      const prevH = canvas.height;
      canvas.width = 1920;
      canvas.height = 1080;

      // Render one frame at high-res
      renderFrame(gl, timeRef.current);

      canvas.toBlob((blob) => {
        // Restore canvas size
        canvas.width = prevW;
        canvas.height = prevH;
        // Re-render
        renderFrame(gl, timeRef.current);
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleDownload = async () => {
    try {
      if (showToast) showToast('Rendering high-res generative frame...', 'info');
      const blob = await getHighResBlob();
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generative-art-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      if (showToast) showToast('Generative art downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Download failed.', 'error');
    }
  };

  const handlePublishSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      if (showToast) showToast('Please sign in to publish artworks.', 'error');
      return;
    }
    
    setIsPublishing(true);
    try {
      const blob = await getHighResBlob();
      if (!blob) throw new Error('Could not capture frame');
      
      const file = new File([blob], `generative-${Date.now()}.png`, { type: 'image/png' });
      
      // Step 1: Upload to Cloudinary/disk
      const uploadResult = await wallpaperService.uploadFile(file);
      const { url, publicId } = uploadResult;
      
      const hexToRgb = (hexStr) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
      };

      // Construct colors array for DB
      const dbColors = [color1, color2, color3].map(hex => ({
        hex,
        ...hexToRgb(hex)
      }));

      const parsedTags = [
        'generative',
        'shader',
        'digital-art',
        ...tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      ];
      const uniqueTags = [...new Set(parsedTags)];

      // Step 2: Upload metadata
      await wallpaperService.uploadWallpaper({
        title,
        category,
        imageUrl: url,
        filename: publicId,
        colors: dbColors,
        tags: uniqueTags,
        isLive: false
      });

      if (showToast) showToast('Artwork published to FeeloWall!', 'success');
      setShowPublishModal(false);
      navigate('/');
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || error.message || 'Publish failed.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', height: 'calc(100vh - 65px)', background: 'var(--bg-main)', overflow: 'hidden' }}>
      
      {/* Visual Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
        
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: '8px',
            padding: '0.5rem 0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
            fontSize: '0.82rem'
          }}
        >
          <ArrowLeft size={16} />
          <span>Gallery</span>
        </button>

        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        
        {/* Canvas overlays */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', pointerEvents: 'none', background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.8rem 1.2rem', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 0.15rem 0', color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>Generative WebGL Fluid</h4>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Resolution: Live viewport scaled</p>
        </div>
      </div>

      {/* Editor Controls Sidebar */}
      <div style={{ background: 'var(--bg-dropdown)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '2rem', gap: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}>Shader Art Creator</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Tune mathematical parameters to compile dynamic fluid wallpapers inside your browser.
          </p>
        </div>

        {/* Sliders Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sliders size={14} />
            <span>Parameters</span>
          </h4>

          {[
            { key: 'speed', label: 'Speed', min: 0.1, max: 3.0, step: 0.05, value: speed, setter: setSpeed },
            { key: 'scale', label: 'Scale (Zoom)', min: 0.5, max: 10.0, step: 0.1, value: scale, setter: setScale },
            { key: 'complexity', label: 'Complexity', min: 1, max: 5, step: 1, value: complexity, setter: setComplexity },
            { key: 'distortion', label: 'Swirl Distortion', min: 0.0, max: 2.0, step: 0.05, value: distortion, setter: setDistortion }
          ].map((slider) => (
            <div key={slider.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>{slider.label}</span>
                <span style={{ color: 'var(--text-main)' }}>{slider.value}</span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={slider.value}
                onChange={(e) => slider.setter(Number(e.target.value))}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer', height: '4px' }}
              />
            </div>
          ))}
        </div>

        {/* Color Palette Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Palette size={14} />
            <span>Color Palette</span>
          </h4>

          {/* Quick presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {THEMES.map((theme) => {
              const isActive = color1 === theme.c1 && color2 === theme.c2 && color3 === theme.c3;
              return (
                <button
                  key={theme.name}
                  onClick={() => {
                    setColor1(theme.c1);
                    setColor2(theme.c2);
                    setColor3(theme.c3);
                  }}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.72rem',
                    borderRadius: '6px',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                    background: isActive ? 'rgba(235,94,40,0.1)' : 'var(--bg-pill)',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {theme.name}
                </button>
              );
            })}
          </div>

          {/* Custom Pickers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem' }}>
            {[
              { label: 'Color 1', val: color1, set: setColor1 },
              { label: 'Color 2', val: color2, set: setColor2 },
              { label: 'Color 3', val: color3, set: setColor3 }
            ].map((col, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{col.label}</span>
                <div style={{ position: 'relative', width: '100%', height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden', cursor: 'pointer', background: col.val }}>
                  <input
                    type="color"
                    value={col.val}
                    onChange={(e) => col.set(e.target.value)}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: 'auto' }}>
          <button
            onClick={handleRandomize}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '42px', width: '100%' }}
          >
            <RefreshCw size={16} />
            <span>Randomize Parameters</span>
          </button>

          <button
            onClick={handleDownload}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '42px', width: '100%', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}
          >
            <Download size={16} />
            <span>Download 1080p PNG</span>
          </button>

          <button
            onClick={() => {
              if (!user) {
                if (showToast) showToast('Please sign in to publish your artwork to the gallery.', 'error');
                return;
              }
              const canvas = canvasRef.current;
              if (canvas) {
                try {
                  setPreviewDataUrl(canvas.toDataURL('image/png'));
                } catch (e) {
                  console.error('Canvas capture failed:', e);
                }
              }
              setShowPublishModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', height: '44px', width: '100%' }}
          >
            <UploadCloud size={16} />
            <span>Publish to Gallery</span>
          </button>
        </div>
      </div>

      {/* Publish Dialog Modal */}
      {showPublishModal && (
        <div className="modal-overlay active" onClick={() => setShowPublishModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '2rem', borderRadius: '16px', background: 'var(--bg-dropdown)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <UploadCloud size={22} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Publish artwork</h3>
            </div>
            <p style={{ margin: '0 0 1.2rem 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Publish your math-generated aesthetic creation directly to the community gallery.
            </p>

            {/* Thumbnail Preview Area */}
            {previewDataUrl && (
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.2rem', marginBottom: '1.2rem', padding: '0.8rem', background: 'var(--bg-form-input)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ width: '120px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                  <img src={previewDataUrl} alt="Thumbnail Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                    Extracted Palette
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {[color1, color2, color3].map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: c,
                          border: '1.5px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handlePublishSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title input */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Artwork Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neon Plasma Pulse"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: 'var(--bg-form-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                />
              </div>

              {/* Category selector */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: 'var(--bg-form-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  <option value="Nature">Nature</option>
                  <option value="Minimalist">Minimalist</option>
                  <option value="Space">Space</option>
                  <option value="Anime">Anime</option>
                  <option value="Architecture">Architecture</option>
                </select>
              </div>

              {/* Custom tags input */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Tags (comma-separated)</label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Auto: generative, shader, digital-art</span>
                </div>
                <input
                  type="text"
                  value={tagsString}
                  onChange={(e) => setTagsString(e.target.value)}
                  placeholder="e.g. fluid, wave, purple, cyber"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', background: 'var(--bg-form-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="btn btn-outline"
                  style={{ flex: 1, height: '40px', fontSize: '0.88rem' }}
                  disabled={isPublishing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.88rem' }}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="spinner" size={14} />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Publish</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShaderArtCreator;
