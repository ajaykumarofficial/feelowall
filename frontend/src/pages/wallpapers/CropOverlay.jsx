import React, { useRef, useState, useEffect } from 'react';

/**
 * CropOverlay
 * Renders a visual, interactive crop box overlay on top of the image container.
 * Supports mouse & touch drag events to reposition the crop box inside boundaries.
 */
export const CropOverlay = ({
  imageRef,
  targetRatio,
  cropOffset,
  onChange
}) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [renderedRect, setRenderedRect] = useState(null);
  const dragStartRef = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });

  if (!targetRatio || !imageRef.current) return null;

  const img = imageRef.current;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  
  if (!naturalWidth || !naturalHeight) return null;

  const imageRatio = naturalWidth / naturalHeight;

  // Calculate crop dimensions relative to image size (from 0.0 to 1.0)
  let wCrop = 1.0;
  let hCrop = 1.0;

  if (imageRatio > targetRatio) {
    wCrop = targetRatio / imageRatio;
    hCrop = 1.0;
  } else {
    wCrop = 1.0;
    hCrop = imageRatio / targetRatio;
  }

  // Calculate percentages for CSS absolute positioning
  const cropLeftPercent = cropOffset.x * 100;
  const cropTopPercent = cropOffset.y * 100;
  const cropWidthPercent = wCrop * 100;
  const cropHeightPercent = hCrop * 100;

  // Keep track of the actual rendered dimensions of the image
  useEffect(() => {
    if (!imageRef.current) return;

    const updateRect = () => {
      if (!imageRef.current) return;
      const parent = imageRef.current.parentElement;
      if (!parent) return;
      
      const parentRect = parent.getBoundingClientRect();
      const cW = parentRect.width;
      const cH = parentRect.height;

      if (cW === 0 || cH === 0) return;

      const containerRatio = cW / cH;

      let rW, rH;
      if (imageRatio > containerRatio) {
        rW = cW;
        rH = cW / imageRatio;
      } else {
        rH = cH;
        rW = cH * imageRatio;
      }

      const rLeft = (cW - rW) / 2;
      const rTop = (cH - rH) / 2;

      setRenderedRect({ left: rLeft, top: rTop, width: rW, height: rH });
    };

    updateRect();

    const parent = imageRef.current.parentElement;
    const resizeObserver = new ResizeObserver(() => {
      updateRect();
    });
    
    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageRef, imageRatio]);

  const handleDragStart = (clientX, clientY) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      cropX: cropOffset.x,
      cropY: cropOffset.y
    };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const deltaCropX = rect.width > 0 ? deltaX / rect.width : 0;
      const deltaCropY = rect.height > 0 ? deltaY / rect.height : 0;

      let newCropX = dragStartRef.current.cropX + deltaCropX;
      let newCropY = dragStartRef.current.cropY + deltaCropY;

      // Constrain coordinates to image boundaries
      newCropX = Math.max(0, Math.min(1.0 - wCrop, newCropX));
      newCropY = Math.max(0, Math.min(1.0 - hCrop, newCropY));

      onChange({ x: newCropX, y: newCropY });
    };

    const handleTouchMove = (e) => {
      if (e.touches.length !== 1 || !containerRef.current) return;
      if (e.cancelable) e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.touches[0].clientX - dragStartRef.current.x;
      const deltaY = e.touches[0].clientY - dragStartRef.current.y;

      const deltaCropX = rect.width > 0 ? deltaX / rect.width : 0;
      const deltaCropY = rect.height > 0 ? deltaY / rect.height : 0;

      let newCropX = dragStartRef.current.cropX + deltaCropX;
      let newCropY = dragStartRef.current.cropY + deltaCropY;

      newCropX = Math.max(0, Math.min(1.0 - wCrop, newCropX));
      newCropY = Math.max(0, Math.min(1.0 - hCrop, newCropY));

      onChange({ x: newCropX, y: newCropY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    window.addEventListener('touchcancel', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isDragging, wCrop, hCrop, onChange]);

  if (!renderedRect) return null;

  return (
    <div
      ref={containerRef}
      className="crop-overlay-container"
      style={{
        position: 'absolute',
        left: `${renderedRect.left}px`,
        top: `${renderedRect.top}px`,
        width: `${renderedRect.width}px`,
        height: `${renderedRect.height}px`,
        overflow: 'hidden',
        pointerEvents: 'auto',
        userSelect: 'none',
        zIndex: 10
      }}
    >
      {/* Dimmed crop mask areas */}
      <div
        className="crop-mask"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${cropTopPercent}%`,
        }}
      />
      <div
        className="crop-mask"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${100 - cropTopPercent - cropHeightPercent}%`,
        }}
      />
      <div
        className="crop-mask"
        style={{
          position: 'absolute',
          top: `${cropTopPercent}%`,
          bottom: `${100 - cropTopPercent - cropHeightPercent}%`,
          left: 0,
          width: `${cropLeftPercent}%`,
        }}
      />
      <div
        className="crop-mask"
        style={{
          position: 'absolute',
          top: `${cropTopPercent}%`,
          bottom: `${100 - cropTopPercent - cropHeightPercent}%`,
          right: 0,
          width: `${100 - cropLeftPercent - cropWidthPercent}%`,
        }}
      />

      {/* Draggable crop target box */}
      <div
        className={`crop-box ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: 'absolute',
          left: `${cropLeftPercent}%`,
          top: `${cropTopPercent}%`,
          width: `${cropWidthPercent}%`,
          height: `${cropHeightPercent}%`,
          cursor: 'move',
          boxSizing: 'border-box'
        }}
      >
        {/* Rule of Thirds Helper Lines */}
        <div className="crop-grid-line line-v1" />
        <div className="crop-grid-line line-v2" />
        <div className="crop-grid-line line-h1" />
        <div className="crop-grid-line line-h2" />

        {/* Premium Styled Corner Handles */}
        <div className="crop-corner corner-tl" />
        <div className="crop-corner corner-tr" />
        <div className="crop-corner corner-bl" />
        <div className="crop-corner corner-br" />
      </div>
    </div>
  );
};

export default CropOverlay;
