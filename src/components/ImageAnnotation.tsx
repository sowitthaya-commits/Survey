'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Undo, Circle, Type, Eye, Check, Edit3, Image as ImageIcon, RotateCw, Square } from 'lucide-react';

interface ImageAnnotationProps {
  imageSrc: string; // Base64 string of original image
  onSave: (annotatedImageSrc: string) => void;
  onCancel?: () => void;
}

type Shape = 
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: 'circle'; cx: number; cy: number; r: number; color: string; width: number }
  | { type: 'rect'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };

export default function ImageAnnotation({ imageSrc, onSave, onCancel }: ImageAnnotationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<'line' | 'circle' | 'rect' | 'text'>('line');
  const [color, setColor] = useState('#ef4444'); // default red
  const [lineWidth, setLineWidth] = useState(3);
  const [textSize, setTextSize] = useState(18);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      setImgElement(img);
      setShapes([]); // Reset annotations for new image
    };
  }, [imageSrc]);

  // Handle canvas resize and drawing
  useEffect(() => {
    if (!canvasRef.current || !imgElement || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerWidth = containerRef.current.clientWidth;
    const scale = containerWidth / imgElement.width;
    
    canvas.width = containerWidth;
    canvas.height = imgElement.height * scale;

    draw(ctx, canvas.width, canvas.height);
  }, [imgElement, shapes, isDrawing, currentPos, tool, color, lineWidth, textSize]);

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!imgElement) return;

    ctx.clearRect(0, 0, width, height);
    
    // Draw background image
    ctx.drawImage(imgElement, 0, 0, width, height);

    // Draw completed shapes
    shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;

      if (shape.type === 'line') {
        ctx.lineWidth = shape.width || 3;
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
      } else if (shape.type === 'circle') {
        ctx.lineWidth = shape.width || 3;
        ctx.beginPath();
        ctx.arc(shape.cx, shape.cy, shape.r, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape.type === 'rect') {
        ctx.lineWidth = shape.width || 3;
        ctx.beginPath();
        ctx.rect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
        ctx.stroke();
      } else if (shape.type === 'text') {
        ctx.font = `bold ${shape.size}px sans-serif`;
        ctx.fillText(shape.text, shape.x, shape.y);
      }
    });

    // Draw active drawing shape (preview)
    if (isDrawing) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lineWidth;

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
      } else if (tool === 'circle') {
        const r = Math.sqrt(
          Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2)
        );
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.beginPath();
        ctx.rect(startPos.x, startPos.y, currentPos.x - startPos.x, currentPos.y - startPos.y);
        ctx.stroke();
      }
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    return { x, y };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const coords = getCoordinates(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentPos(coords);

    if (tool === 'text') {
      const text = prompt('พิมพ์ระยะทาง หรือข้อความประกอบ:');
      if (text) {
        setShapes([
          ...shapes,
          {
            type: 'text',
            x: coords.x,
            y: coords.y,
            text,
            color,
            size: textSize,
          },
        ]);
      }
      setIsDrawing(false);
    }
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const coords = getCoordinates(e);
    setCurrentPos(coords);
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'line') {
      const dist = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
      if (dist > 5) {
        setShapes([
          ...shapes,
          {
            type: 'line',
            x1: startPos.x,
            y1: startPos.y,
            x2: currentPos.x,
            y2: currentPos.y,
            color,
            width: lineWidth,
          },
        ]);
      }
    } else if (tool === 'circle') {
      const r = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
      if (r > 5) {
        setShapes([
          ...shapes,
          {
            type: 'circle',
            cx: startPos.x,
            cy: startPos.y,
            r,
            color,
            width: lineWidth,
          },
        ]);
      }
    } else if (tool === 'rect') {
      const dist = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
      if (dist > 5) {
        setShapes([
          ...shapes,
          {
            type: 'rect',
            x1: startPos.x,
            y1: startPos.y,
            x2: currentPos.x,
            y2: currentPos.y,
            color,
            width: lineWidth,
          },
        ]);
      }
    }
  };

  const handleUndo = () => {
    setShapes(shapes.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm('ต้องการล้างสิ่งที่วาดทั้งหมดใช่หรือไม่?')) {
      setShapes([]);
    }
  };

  const handleRotate = () => {
    if (!imgElement) return;
    if (!confirm('การหมุนรูปภาพจะลบลายเส้นที่เคยวาดออกทั้งหมด คุณต้องการดำเนินการต่อใช่หรือไม่?')) return;

    // Rotate 90 degrees clockwise using canvas
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.height;
    canvas.height = imgElement.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(imgElement, -imgElement.width / 2, -imgElement.height / 2);

    const rotatedBase64 = canvas.toDataURL('image/jpeg', 0.95);
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = rotatedBase64;
    newImg.onload = () => {
      setImgElement(newImg);
      setShapes([]); // Reset shapes since dimensions rotated
    };
  };

  const handleFinish = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden shadow-md max-w-full">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTool('line')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'line' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-650 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            เส้น
          </button>
          <button
            type="button"
            onClick={() => setTool('circle')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'circle' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-655 hover:text-slate-900'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
            วงกลม
          </button>
          <button
            type="button"
            onClick={() => setTool('rect')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'rect' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-655 hover:text-slate-900'
            }`}
            title="วาดกรอบสี่เหลี่ยม"
          >
            <Square className="w-3.5 h-3.5" />
            กล่อง
          </button>
          <button
            type="button"
            onClick={() => setTool('text')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
              tool === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-655 hover:text-slate-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            ข้อความ
          </button>
        </div>

        {/* Basic Edit: Rotate */}
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={handleRotate}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 transition"
            title="หมุนรูปภาพ 90 องศา"
          >
            <RotateCw className="w-3.5 h-3.5" />
            หมุนรูปภาพ
          </button>
        </div>

        {/* Customization controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border transition-all ${
                  color === c ? 'ring-2 ring-slate-400 scale-110 border-white' : 'border-transparent'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">ขนาด:</span>
            {tool === 'text' ? (
              <select
                value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none"
              >
                <option value={12}>เล็ก (12px)</option>
                <option value={16}>ปกติ (16px)</option>
                <option value={20}>กลาง (20px)</option>
                <option value={26}>ใหญ่ (26px)</option>
              </select>
            ) : (
              <select
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none"
              >
                <option value={2}>บาง (2px)</option>
                <option value={3}>ปกติ (3px)</option>
                <option value={5}>หนา (5px)</option>
              </select>
            )}
          </div>
        </div>

        {/* Undo/Clear */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={shapes.length === 0}
            className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition"
            title="ย้อนกลับ"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={shapes.length === 0}
            className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-650 disabled:opacity-40 disabled:hover:bg-transparent transition"
            title="ล้างทั้งหมด"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div 
        ref={containerRef} 
        className="w-full bg-slate-900 flex items-center justify-center relative overflow-hidden"
        style={{ minHeight: '300px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="cursor-crosshair block max-w-full touch-none"
        />
        {!imgElement && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <ImageIcon className="w-12 h-12 mb-2 animate-pulse" />
            <p className="text-sm">กำลังประมวลผลรูปภาพ...</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3.5 flex justify-end gap-2.5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="button"
          onClick={handleFinish}
          disabled={!imgElement}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-sm font-semibold text-white rounded-lg flex items-center gap-1.5 transition shadow-sm"
        >
          <Check className="w-4 h-4" />
          บันทึกรูปภาพ
        </button>
      </div>
    </div>
  );
}
