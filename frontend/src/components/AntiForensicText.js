import React, { useEffect, useRef } from 'react';

/**
 * AntiForensicText Component
 * Renders text inside a canvas element to prevent readable text nodes in the DOM,
 * protecting against DOM-scraping browser extensions and automated crawlers.
 */
const AntiForensicText = ({ text = '', maxWidth = 420, textColor = '#e5e7eb', fontSize = '14px', fontFamily = "Inter, system-ui, -apple-system, sans-serif" }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set font style for measurement
    ctx.font = `${fontSize} ${fontFamily}`;
    
    // Word wrapping algorithm
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      // Handle explicit newlines in message text
      if (words[i].includes('\n')) {
        const parts = words[i].split('\n');
        for (let j = 0; j < parts.length; j++) {
          const testLine = currentLine + parts[j] + ' ';
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine.trim());
            currentLine = parts[j] + ' ';
          } else {
            currentLine = testLine;
          }
          
          if (j < parts.length - 1) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
        }
      } else {
        const testLine = currentLine + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine !== '') {
          lines.push(currentLine.trim());
          currentLine = words[i] + ' ';
        } else {
          currentLine = testLine;
        }
      }
    }
    lines.push(currentLine.trim());

    // Filter empty lines
    const finalLines = lines.filter(line => line.length > 0);

    // Measure maximum line width to size the canvas exactly
    let longestLineWidth = 0;
    finalLines.forEach((line) => {
      const metrics = ctx.measureText(line);
      if (metrics.width > longestLineWidth) {
        longestLineWidth = metrics.width;
      }
    });

    const parsedFontSize = parseInt(fontSize, 10) || 14;
    const lineHeight = parsedFontSize * 1.45;
    
    // Calculate sizing with high-DPI scaling
    const paddingX = 4;
    const paddingY = 4;
    const canvasWidth = Math.ceil(longestLineWidth) + (paddingX * 2);
    const canvasHeight = Math.ceil(finalLines.length * lineHeight) + (paddingY * 2);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Size styling to match calculated bounds
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Scale canvas context to render sharp graphics on high-DPI screens
    ctx.scale(dpr, dpr);
    
    // Clear and draw text
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.textBaseline = 'top';
    ctx.font = `${fontSize} ${fontFamily}`;
    ctx.fillStyle = textColor;

    // Apply anti-aliasing optimizations
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    finalLines.forEach((line, index) => {
      const yOffset = paddingY + (index * lineHeight);
      ctx.fillText(line, paddingX, yOffset);
    });
  }, [text, maxWidth, textColor, fontSize, fontFamily]);

  return (
    <canvas 
      ref={canvasRef} 
      className="max-w-full block select-none pointer-events-none" 
      style={{ display: 'block' }}
    />
  );
};

export default AntiForensicText;
