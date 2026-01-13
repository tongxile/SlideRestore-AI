
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertCircle, Loader2, Play, X, CheckSquare, Square, Wand2 } from 'lucide-react';
import { SlideData, ProcessingStatus, ElementType } from './types';
import { analyzeSlideImage } from './services/geminiService';
import { generatePptx } from './services/pptxService';

declare const pdfjsLib: any;

interface PdfPagePreview {
  index: number;
  thumbnail: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPagePreview[]>([]);
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>([]);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', progress: 0, message: '' });
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }, []);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setSlides([]);
      setIsDone(false);
      setPdfPages([]);
      setSelectedPageIndices([]);
      setShowSelectionDialog(true);
      await loadPdfThumbnails(selectedFile);
    }
  };

  const loadPdfThumbnails = async (file: File) => {
    try {
      setIsParsingPdf(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport }).promise;
        
        const preview = { index: i, thumbnail: canvas.toDataURL('image/jpeg', 0.6) };
        setPdfPages(prev => [...prev, preview]);
        setSelectedPageIndices(prev => [...prev, i]);
      }
      setIsParsingPdf(false);
    } catch (error: any) {
      setIsParsingPdf(false);
      setShowSelectionDialog(false);
      setStatus({ step: 'error', progress: 0, message: `Failed to load PDF: ${error.message}` });
    }
  };

  const startConversion = async () => {
    if (!file || selectedPageIndices.length === 0) return;
    setShowSelectionDialog(false);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const processedSlides: SlideData[] = [];
      const sortedIndices = [...selectedPageIndices].sort((a, b) => a - b);

      for (let i = 0; i < sortedIndices.length; i++) {
        const pageNum = sortedIndices[i];
        setStatus({ 
          step: 'analyzing', 
          progress: Math.round((i / sortedIndices.length) * 100), 
          message: `Semantic Reconstruction Slide ${pageNum}...` 
        });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport }).promise;
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);

        const { backgroundColor, elements } = await analyzeSlideImage(base64Image);

        processedSlides.push({
          pageNumber: pageNum,
          elements,
          backgroundColor,
          thumbnail: base64Image
        });
        setSlides([...processedSlides]);
      }

      setStatus({ step: 'reconstructing', progress: 95, message: 'Applying Chroma-Key Filters...' });
      const pptxBlob = await generatePptx(processedSlides);
      const url = URL.createObjectURL(pptxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.pdf', '_restored_pro.pptx');
      a.click();
      setStatus({ step: 'done', progress: 100, message: 'High-Fidelity Restoration Done!' });
      setIsDone(true);
    } catch (error: any) {
      console.error(error);
      setStatus({ step: 'error', progress: 0, message: `Error: ${error.message}` });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
          <Wand2 className="text-white w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">SlideRestore AI <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full uppercase ml-2 tracking-widest font-black">Pro</span></h1>
        <p className="text-slate-600 max-w-lg font-medium">Deep-vision reconstruction with Chroma-Key "Koutu" background removal and cohesive asset preservation.</p>
      </header>

      <main className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-300 border border-slate-100 overflow-hidden relative min-h-[500px]">
        {showSelectionDialog && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  Select Slides to Restore
                  {isParsingPdf && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                </h2>
                <p className="text-slate-500 text-sm">Automatic "Koutu" (cutout) and text erasure enabled</p>
              </div>
              <button onClick={() => { setShowSelectionDialog(false); setFile(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 bg-slate-50/30">
              {pdfPages.map((page) => (
                <div key={page.index} onClick={() => setSelectedPageIndices(prev => prev.includes(page.index) ? prev.filter(i => i !== page.index) : [...prev, page.index])} 
                  className={`relative aspect-video rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${selectedPageIndices.includes(page.index) ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-xl scale-[0.98]' : 'border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                  <img src={page.thumbnail} className="w-full h-full object-cover" alt={`Page ${page.index}`} />
                  <div className={`absolute inset-0 flex items-center justify-center ${selectedPageIndices.includes(page.index) ? 'bg-indigo-600/10' : 'bg-transparent'}`}>
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedPageIndices.includes(page.index) ? 'bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg' : 'bg-white/90 border-slate-300'}`}>
                      {selectedPageIndices.includes(page.index) && <CheckCircle className="w-5 h-5" />}
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-bold backdrop-blur-md">P.{page.index}</div>
                </div>
              ))}
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between">
              <div className="flex gap-4">
                <button onClick={() => setSelectedPageIndices(pdfPages.map(p => p.index))} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2"><CheckSquare className="w-4 h-4"/> Select All</button>
                <button onClick={() => setSelectedPageIndices([])} className="text-xs font-bold text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2"><Square className="w-4 h-4"/> Clear Selection</button>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-sm font-bold text-slate-700">{selectedPageIndices.length} slides targeted</span>
                <button disabled={selectedPageIndices.length === 0 || isParsingPdf} onClick={startConversion} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 px-12 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center gap-2">
                  <Play className="w-5 h-5 fill-current" /> Execute Restoration
                </button>
              </div>
            </div>
          </div>
        )}

        {status.step === 'idle' && !isDone && !showSelectionDialog && (
          <div className="p-8 h-full flex items-center justify-center min-h-[500px]">
            <div className="w-full border-4 border-dashed border-slate-200 rounded-[3rem] p-24 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 group transition-all" onClick={() => document.getElementById('file-upload')?.click()}>
              <input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              <div className="w-28 h-28 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 group-hover:scale-110 transition-transform shadow-sm border border-indigo-100"><Upload className="w-12 h-12" /></div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Restore Your Slide Deck</h3>
              <p className="text-slate-500 text-center max-w-sm text-lg leading-relaxed font-medium">Automatic background removal, text erasure, and semantic asset grouping.</p>
            </div>
          </div>
        )}

        {(status.step !== 'idle' || isDone) && !showSelectionDialog && (
          <div className="p-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                {status.step === 'error' ? <AlertCircle className="text-rose-500 w-10 h-10" /> : status.step === 'done' ? <CheckCircle className="text-emerald-500 w-10 h-10" /> : <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />}
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{status.message}</h3>
              </div>
              <div className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full font-mono text-lg font-black border-2 border-indigo-100 shadow-sm">{status.progress}%</div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-5 mb-14 overflow-hidden border border-slate-200 shadow-inner">
              <div className={`h-full transition-all duration-1000 rounded-full shadow-lg ${status.step === 'error' ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${status.progress}%` }}></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {slides.map((slide, idx) => (
                <div key={idx} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-md hover:shadow-2xl transition-all group border-b-8 border-b-indigo-50">
                  <div className="aspect-video relative overflow-hidden bg-slate-100">
                    <img src={slide.thumbnail} className="w-full h-full object-contain opacity-30 grayscale group-hover:opacity-10 transition-opacity duration-700" alt="Analysis" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 backdrop-blur-sm bg-white/30">
                       <div className="w-16 h-16 bg-emerald-500 text-white rounded-[1.2rem] flex items-center justify-center mb-5 shadow-xl border-4 border-white rotate-3 group-hover:rotate-0 transition-transform">
                          <CheckCircle className="w-8 h-8" />
                       </div>
                       <h4 className="font-black text-slate-900 text-base mb-1 tracking-tight">Slide {slide.pageNumber} Restored</h4>
                       <p className="text-[11px] text-slate-700 font-bold bg-white/90 px-3 py-1.5 rounded-full shadow-sm border border-slate-200 uppercase tracking-widest">Koutu + OCR Active</p>
                    </div>
                  </div>
                  <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-black text-slate-400">
                    <div className="flex gap-4">
                      <span className="text-indigo-600">{slide.elements.filter(e => e.type === 'text').length} EDITABLE BOXES</span>
                      <span className="text-slate-500">{slide.elements.filter(e => e.type !== 'text').length} ASSET GROUPS</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {status.step === 'analyzing' && (
                <div className="aspect-video rounded-[2rem] border-4 border-dashed border-indigo-100 flex flex-col items-center justify-center bg-indigo-50/20 text-indigo-400 animate-pulse">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-100/50 flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  </div>
                  <p className="text-[12px] font-black uppercase tracking-[0.3em]">Deep Reconstruction...</p>
                </div>
              )}
            </div>

            {isDone && (
              <div className="mt-24 p-16 bg-indigo-50/50 rounded-[4rem] border-4 border-white text-center animate-in zoom-in-95 duration-700 shadow-2xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
                <div className="w-28 h-28 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-200 border-8 border-white">
                   <Download className="w-14 h-14" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Success!</h3>
                <p className="text-slate-600 mb-12 max-w-lg mx-auto text-xl leading-relaxed font-medium">Your editable PowerPoint deck has been generated with high-fidelity asset preservation and background cleaning.</p>
                <div className="flex justify-center gap-8">
                   <button onClick={() => window.location.reload()} className="bg-slate-900 hover:bg-slate-800 text-white font-black py-5 px-16 rounded-[2rem] transition-all shadow-2xl shadow-slate-400 hover:scale-105 active:scale-95 text-lg">Process New PDF</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="mt-20 text-slate-400 text-xs flex flex-col items-center gap-3">
        <p className="font-black tracking-[0.4em] uppercase text-[10px] text-slate-400 opacity-60">High-Fidelity Restoration Technology</p>
        <p className="opacity-50 font-bold">Automatic Semantic Cutout (Koutu) & Layering Engine</p>
      </footer>
    </div>
  );
}
