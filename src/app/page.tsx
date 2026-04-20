"use client";

import { useState, useRef, useCallback } from "react";
import { UploadCloud, Download, AlertTriangle, Edit2, Check } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as htmlToImage from "html-to-image";

interface DataPoint {
  label: string;
  value: number;
}

interface ChartData {
  chartType: "bar" | "line" | "scatter" | "other";
  title: string;
  xLabel: string;
  yLabel: string;
  dataPoints: DataPoint[];
  confidence: number;
}

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      // Allow if it's explicitly an image, or if the type is empty (common macOS floating screenshot bug)
      if (file.type.startsWith("image/") || file.type === "") {
        processFile(file);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setOriginalImage(base64);
      analyzeImage(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (imageBase64: string, mimeType: string) => {
    setLoading(true);
    setError(null);
    setChartData(null);
    setIsEditing(false);

    try {
      const res = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze image");
      }

      const data: ChartData = await res.json();
      setChartData(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(chartRef.current, { backgroundColor: '#ffffff' });
      const link = document.createElement("a");
      link.download = "fixed-chart.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image", err);
    }
  };

  const updateDataPoint = (index: number, key: keyof DataPoint, value: string | number) => {
    if (!chartData) return;
    const newPoints = [...chartData.dataPoints];
    newPoints[index] = { ...newPoints[index], [key]: key === 'value' ? Number(value) : value };
    setChartData({ ...chartData, dataPoints: newPoints });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-8">
      <header className="max-w-5xl mx-auto mb-12 text-center mt-12">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-blue-600">fix-my-graph</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">Drop a deceptive chart below to automatically restore its 0-axis and maximize truth.</p>
      </header>

      <main className="max-w-7xl mx-auto">
        {!originalImage && !loading && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-4 border-dashed border-gray-300 rounded-3xl p-24 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm bg-white"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <UploadCloud className="mx-auto h-20 w-20 text-gray-400 mb-6" />
            <p className="text-2xl font-medium text-gray-600">Drag & drop a screenshot here</p>
            <p className="text-md text-gray-500 mt-2">or click to browse</p>
            <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl shadow-sm border border-gray-200">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
            <p className="text-2xl font-medium text-gray-600 animate-pulse">Extracting chart data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl flex items-center mb-8 border border-red-200 shadow-sm">
            <AlertTriangle className="h-8 w-8 mr-4 flex-shrink-0" />
            <p className="text-lg">{error}</p>
            <button className="ml-auto font-medium underline" onClick={() => { setOriginalImage(null); setError(null); }}>Try again</button>
          </div>
        )}

        {chartData && originalImage && (
          <div className="flex flex-col xl:flex-row gap-8">
            <div className="w-full xl:w-1/2 flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                Original Chart
                <span className="ml-3 text-sm font-normal px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full">Deceptive</span>
              </h2>
              <div className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden p-6 flex items-center justify-center min-h-[500px]">
                <img src={originalImage} alt="Original" className="w-full h-auto object-contain max-h-[600px] rounded-xl" />
              </div>
              
              {chartData.confidence < 0.8 && (
                <div className="bg-yellow-50 text-yellow-800 p-5 rounded-2xl flex items-center border border-yellow-200 shadow-sm">
                  <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0" />
                  AI confidence is low ({Math.round(chartData.confidence * 100)}%). Please verify the data points manually.
                </div>
              )}
            </div>

            <div className="w-full xl:w-1/2 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-green-600 flex items-center">
                  Fixed Chart
                  <span className="ml-3 text-sm font-normal px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full">Zero-Axis</span>
                </h2>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsEditing(!isEditing)} 
                    className="flex items-center px-4 py-2 font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition-colors shadow-sm"
                  >
                    {isEditing ? <Check className="h-4 w-4 mr-2" /> : <Edit2 className="h-4 w-4 mr-2" />}
                    {isEditing ? "Done Editing" : "Edit Data"}
                  </button>
                  <button 
                    onClick={downloadImage} 
                    className="flex items-center px-4 py-2 font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="bg-white p-8 rounded-3xl shadow-md border border-gray-200 flex-1 min-h-[500px]">
                  <h3 className="font-semibold text-lg mb-6 text-gray-800">Edit Data Points</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4 border-b pb-2">
                      <div className="w-1/2 font-semibold text-gray-600">Label ({chartData.xLabel})</div>
                      <div className="w-1/2 font-semibold text-gray-600">Value ({chartData.yLabel})</div>
                    </div>
                    {chartData.dataPoints.map((dp, i) => (
                      <div key={i} className="flex gap-4">
                        <input 
                          className="w-1/2 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                          value={dp.label} 
                          onChange={(e) => updateDataPoint(i, 'label', e.target.value)} 
                        />
                        <input 
                          type="number"
                          className="w-1/2 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                          value={dp.value} 
                          onChange={(e) => updateDataPoint(i, 'value', e.target.value)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  ref={chartRef} 
                  className="bg-white p-8 rounded-3xl shadow-md border border-gray-200 flex-1 min-h-[500px] flex flex-col"
                >
                  <h3 className="text-center font-bold text-2xl mb-8 text-gray-800">{chartData.title}</h3>
                  <div className="flex-1 w-full h-full relative">
                    <ResponsiveContainer width="100%" height={450}>
                      {chartData.chartType === 'scatter' ? (
                        <LineChart data={chartData.dataPoints} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" label={{ value: chartData.xLabel, position: 'insideBottom', offset: -20 }} tick={{ fill: '#6b7280' }} tickMargin={10} />
                          <YAxis domain={[0, 'auto']} label={{ value: chartData.yLabel, angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fill: '#6b7280' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Line type="monotone" dataKey="value" stroke="none" dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                        </LineChart>
                      ) : chartData.chartType === 'line' ? (
                        <LineChart data={chartData.dataPoints} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" label={{ value: chartData.xLabel, position: 'insideBottom', offset: -20 }} tick={{ fill: '#6b7280' }} tickMargin={10} />
                          <YAxis domain={[0, 'auto']} label={{ value: chartData.yLabel, angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fill: '#6b7280' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                        </LineChart>
                      ) : (
                        <BarChart data={chartData.dataPoints} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" label={{ value: chartData.xLabel, position: 'insideBottom', offset: -20 }} tick={{ fill: '#6b7280' }} tickMargin={10} />
                          <YAxis domain={[0, 'auto']} label={{ value: chartData.yLabel, angle: -90, position: 'insideLeft', offset: 10 }} tick={{ fill: '#6b7280' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f3f4f6' }} />
                          <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center mt-4">
                 <button className="text-gray-500 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => { setOriginalImage(null); setChartData(null); }}>Start over</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
