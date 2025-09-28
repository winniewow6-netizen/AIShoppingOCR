// Fix: Replaced placeholder content with a functional React component.
// This new `App` component provides the main UI and logic for the application,
// connecting the Gemini services and the HistoryTable component.
// It includes state management, event handlers, and a default export,
// which resolves the module loading error in `index.tsx` and other compilation errors.
import React, { useState, useRef, useEffect } from 'react';
import { HistoryTable } from './components/HistoryTable';
import { ProductRecord, OcrResult, GeolocationPosition } from './types';
import { extractProductInfoFromImage, analyzeShoppingHistory } from './services/geminiService';

const App: React.FC = () => {
    const [records, setRecords] = useState<ProductRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<ProductRecord[]>([]);
    const [isLoadingOcr, setIsLoadingOcr] = useState(false);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [analysisResult, setAnalysisResult] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [analysisQuery, setAnalysisQuery] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [userLocation, setUserLocation] = useState<GeolocationPosition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        try {
            const storedRecords = localStorage.getItem('shoppingHistory');
            if (storedRecords) {
                setRecords(JSON.parse(storedRecords));
            }
        } catch (e) {
            console.error("Failed to load records from localStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('shoppingHistory', JSON.stringify(records));
        } catch (e) {
            console.error("Failed to save records to localStorage", e);
            setError("Could not save new records. Your browser's storage might be full.");
        }
    }, [records]);

    useEffect(() => {
        let tempRecords = [...records];

        if (searchTerm) {
            tempRecords = tempRecords.filter(record =>
                record.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (dateFilter) {
            tempRecords = tempRecords.filter(record =>
                new Date(record.date).toISOString().split('T')[0] === dateFilter
            );
        }

        setFilteredRecords(tempRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, [records, searchTerm, dateFilter]);

    const resizeImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400;
                    const MAX_HEIGHT = 400;
                    let width = img.width;
                    let height = img.height;
    
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        return reject(new Error('Could not get canvas context'));
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const resetAddForm = () => {
        setOcrResult(null);
        setImagePreview(null);
        setUserLocation(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        resetAddForm();
        setIsLoadingOcr(true);
        setError(null);
    
        try {
            const resizedDataUrl = await resizeImage(file);
            setImagePreview(resizedDataUrl);
    
            const base64 = resizedDataUrl.split(',')[1];
            const mimeType = 'image/jpeg';
            const result = await extractProductInfoFromImage(base64, mimeType);
            setOcrResult(result);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during image processing.');
            resetAddForm();
        } finally {
            setIsLoadingOcr(false);
        }
    };

    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (err) => {
                    console.warn(`ERROR(${err.code}): ${err.message}`);
                    setError("Could not get location. Please ensure location services are enabled.");
                }
            );
        } else {
            setError("Geolocation is not supported by this browser.");
        }
    };

    const handleAddRecord = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!ocrResult || !imagePreview) return;

        const formData = new FormData(e.currentTarget);
        const newRecord: ProductRecord = {
            id: `${new Date().toISOString()}-${Math.random()}`,
            imageUrl: imagePreview,
            name: formData.get('productName') as string,
            price: parseFloat(formData.get('price') as string),
            date: new Date().toISOString(),
            location: userLocation,
        };

        setRecords(prev => [newRecord, ...prev]);
        resetAddForm();
    };

    const handleDeleteRecord = (id: string) => {
        setRecords(records.filter(record => record.id !== id));
    };

    const handleAnalyze = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!analysisQuery.trim()) return;

        setIsLoadingAnalysis(true);
        setAnalysisResult('');
        setError(null);
        try {
            const result = await analyzeShoppingHistory(analysisQuery, records);
            setAnalysisResult(result);
        } catch (err: any) {
            setError(err.message || "An unknown error occurred during analysis.");
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    return (
        <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">🛍️ Shopping History Analyzer</h1>
                    <p className="text-gray-600 mt-1">Keep track of your purchases and gain insights with AI.</p>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <section className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Add New Record</h2>
                        <div className="space-y-4">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                                ref={fileInputRef}
                                disabled={isLoadingOcr}
                            />
                            {isLoadingOcr && <p className="text-sm text-blue-600">Analyzing image with Gemini...</p>}
                            {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
                            {imagePreview && (
                                <img src={imagePreview} alt="Preview" className="mt-4 rounded-lg shadow-sm max-h-60 w-auto mx-auto" />
                            )}
                            {ocrResult && (
                                <form onSubmit={handleAddRecord} className="mt-4 space-y-4">
                                    <div>
                                        <label htmlFor="productName" className="block text-sm font-medium text-gray-700">Product Name</label>
                                        <input
                                            type="text"
                                            name="productName"
                                            id="productName"
                                            defaultValue={ocrResult.productName}
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
                                        <input
                                            type="number"
                                            name="price"
                                            id="price"
                                            defaultValue={ocrResult.price}
                                            step="0.01"
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!!userLocation}
                                        >
                                            {userLocation ? 'Location Added!' : 'Add Current Location'}
                                        </button>
                                        {userLocation && <span className="text-xs text-gray-500">({userLocation.latitude.toFixed(2)}, {userLocation.longitude.toFixed(2)})</span>}
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                       <button
                                            type="submit"
                                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            Add Record
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetAddForm}
                                            className="text-sm font-medium text-gray-600 hover:text-gray-900"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </section>
                    
                    <section className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4">Ask Gemini About Your History</h2>
                        <form onSubmit={handleAnalyze} className="space-y-4">
                            <textarea
                                value={analysisQuery}
                                onChange={(e) => setAnalysisQuery(e.target.value)}
                                placeholder="e.g., How much did I spend on snacks last week?"
                                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                rows={3}
                                disabled={isLoadingAnalysis}
                            />
                            <button
                                type="submit"
                                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoadingAnalysis || records.length === 0}
                            >
                                {isLoadingAnalysis ? 'Analyzing...' : 'Analyze'}
                            </button>
                        </form>
                        {isLoadingAnalysis && <p className="text-sm text-blue-600 mt-4">Getting insights from Gemini...</p>}
                        {analysisResult && (
                             <div className="mt-4 p-4 bg-gray-100 rounded-md">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{analysisResult}</p>
                            </div>
                        )}
                    </section>
                </div>
                
                <div className="lg:col-span-2">
                    <section className="bg-white p-6 rounded-lg shadow-md min-h-full">
                        <h2 className="text-xl font-semibold mb-4">Shopping History</h2>
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <input
                                type="text"
                                placeholder="Search by product name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="flex-grow mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                             <input
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                className="mt-1 block w-full md:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <HistoryTable records={filteredRecords} onDelete={handleDeleteRecord} />
                    </section>
                </div>
            </main>
        </div>
    );
}

export default App;