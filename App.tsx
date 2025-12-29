
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Send, 
  Leaf, 
  MapPin, 
  Search, 
  Loader2,
  X,
  Mic,
  Volume2,
  ChevronRight,
  TrendingUp,
  BookOpen,
  MessageSquare,
  ChevronDown,
  CloudSun,
  Droplets,
  Sprout,
  RefreshCw,
  Navigation,
  Thermometer,
  CloudRain,
  Globe
} from 'lucide-react';
import { analyzeCrop, getDashboardData } from './services/geminiService';
import { Message, MandiData, WeatherData, GroundingSource } from './types';

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'en', label: 'English' }
];

const POPULAR_CITIES = [
  "लखनऊ", "पटना", "इंदौर", "वाराणसी", 
  "नागपुर", "जयपुर", "भोपाल", "पुणे", "अमृतसर", "नाशिक"
];

type Tab = 'chat' | 'mandi' | 'technique';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "नमस्ते किसान भाई! मैं आपका किसान मित्र हूँ। अपनी फसल की फोटो भेजें या बोलकर सवाल पूछें।",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  
  // City State Management
  const [city, setCity] = useState("वाराणसी");
  const [tempCity, setTempCity] = useState("वाराणसी");
  const [citySearchQuery, setCitySearchQuery] = useState("");
  
  // UI Settings
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  
  // Dashboard Data
  const [mandiRates, setMandiRates] = useState<MandiData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dashboardSources, setDashboardSources] = useState<GroundingSource[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current && activeTab === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Handle Voice Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInputText(transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onend = () => setIsRecording(false);
      recognitionRef.current.onerror = () => setIsRecording(false);
    }
  }, []);

  // Fetch Dashboard Data on City/Tab Change
  const fetchDashboardData = async () => {
    setIsDashboardLoading(true);
    try {
      const result = await getDashboardData(city);
      if (result && result.mandi && result.weather) {
        setMandiRates(result.mandi);
        setWeather(result.weather);
        setDashboardSources(result.sources || []);
      } else {
        // Fallback or clear if data is missing
        setMandiRates([
          { crop: 'गेहूं', price: '₹2,450', trend: 'up' },
          { crop: 'टमाटर', price: '₹1,200', trend: 'down' }
        ]);
        setWeather({ temp: '32°C', condition: 'धूप खिली है', humidity: '45%' });
        setDashboardSources([]);
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setIsDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mandi') {
      fetchDashboardData();
    }
  }, [activeTab, city]);

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang.code === 'hi' ? 'hi-IN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    const query = inputText;
    const img = selectedImage;
    setInputText('');
    setSelectedImage(null);

    try {
      const { text, sources } = await analyzeCrop(query, img || undefined, city, selectedLang.label);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
        sources: sources,
        timestamp: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'err',
        role: 'assistant',
        content: "क्षमा करें, तकनीकी समस्या आई। कृपया पुनः प्रयास करें।",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        alert("Speech recognition is not available in your browser.");
      }
    }
  };

  const handleLocationDetection = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        // Simulated result for demonstration
        setCity("पुणे (detected)");
        setIsCityModalOpen(false);
      }, () => {
        alert("Location access denied.");
      });
    }
  };

  const filteredCities = POPULAR_CITIES.filter(c => 
    c.includes(citySearchQuery) || citySearchQuery === ""
  );

  const showCustomCity = citySearchQuery.trim().length > 0 && !POPULAR_CITIES.includes(citySearchQuery.trim());

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 font-['Hind'] shadow-2xl relative overflow-hidden text-gray-900">
      
      {/* HEADER SECTION */}
      <header className="bg-[#14532d] text-white pt-6 pb-4 px-4 shadow-lg z-30 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-green-100/10 p-1.5 rounded-lg border border-white/10">
              <Sprout className="w-5 h-5 text-green-300" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">किसान मित्र</h1>
          </div>
          <button 
            onClick={() => setIsLangModalOpen(true)}
            className="flex items-center bg-[#1a4a2e] rounded-md px-3 py-1.5 border border-green-800 text-xs font-bold hover:bg-green-800 transition shadow-inner"
          >
            <Globe className="w-3 h-3 mr-1.5" />
            <span>{selectedLang.label}</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
        </div>
        
        {/* City Location Banner */}
        <div 
          onClick={() => {
            setTempCity(city);
            setCitySearchQuery("");
            setIsCityModalOpen(true);
          }}
          className="bg-[#0f3d23] rounded-xl p-3 flex items-center justify-between cursor-pointer border border-green-800/30 hover:bg-[#124b2a] transition active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-green-500/20 rounded-full group-hover:scale-110 transition">
              <MapPin className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm font-semibold">{city} का अपडेट</span>
          </div>
          <ChevronRight className="w-4 h-4 text-green-600" />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 bg-white relative no-scrollbar pb-24" ref={scrollRef}>
        {activeTab === 'chat' && (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start animate-fade-in'}`}>
                <div className={`max-w-[88%] relative ${msg.role === 'user' ? 'bg-emerald-700 text-white rounded-2xl rounded-tr-none shadow-lg' : 'bg-white border border-gray-100 shadow-md rounded-2xl rounded-tl-none'} p-4`}>
                  {msg.image && <img src={msg.image} className="rounded-xl mb-3 max-h-64 w-full object-cover shadow-sm border border-gray-100" />}
                  <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</div>
                  
                  {msg.role === 'assistant' && (
                    <div className="mt-4 space-y-4">
                      <button 
                        onClick={() => speakText(msg.content)}
                        className="flex items-center gap-2 text-emerald-700 text-xs font-black bg-emerald-50 px-4 py-2 rounded-full hover:bg-emerald-100 transition border border-emerald-100 active:scale-95"
                      >
                        <Volume2 className="w-4 h-4" /> सुनें
                      </button>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-gray-100">
                          <p className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest">विश्वसनीय स्रोत (Sources):</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition truncate max-w-[140px] font-bold"
                              >
                                {source.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start items-center gap-3 text-emerald-600 font-bold text-xs animate-pulse bg-emerald-50 w-fit p-3 rounded-xl border border-emerald-100">
                <Loader2 className="w-4 h-4 animate-spin" />
                सोच रहा हूँ...
              </div>
            )}
          </div>
        )}

        {activeTab === 'mandi' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-emerald-900">बाज़ार और मौसम</h2>
              <button 
                onClick={fetchDashboardData} 
                disabled={isDashboardLoading}
                className="p-2 text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 active:rotate-180 transition-all duration-300"
              >
                <RefreshCw className={`w-4 h-4 ${isDashboardLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Weather Detail Card */}
            {weather ? (
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border-b-8 border-indigo-800">
                <div className="absolute -right-4 -top-4 opacity-20 transform rotate-12">
                   <CloudRain className="w-32 h-32" />
                </div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-xs font-black opacity-80 uppercase tracking-widest mb-1">आज {city} में</p>
                    <p className="text-5xl font-black">{weather.temp}</p>
                    <p className="text-lg font-bold mt-1">{weather.condition}</p>
                  </div>
                  <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                    <CloudSun className="w-10 h-10" />
                  </div>
                </div>
                <div className="mt-6 flex gap-3 text-xs font-bold relative z-10">
                  <span className="flex items-center gap-1.5 bg-white/30 px-4 py-2 rounded-xl backdrop-blur-md"><Droplets className="w-4 h-4" /> {weather.humidity} उमस</span>
                  <span className="flex items-center gap-1.5 bg-white/30 px-4 py-2 rounded-xl backdrop-blur-md"><Thermometer className="w-4 h-4" /> हवा: मंद</span>
                </div>
              </div>
            ) : isDashboardLoading && (
              <div className="h-40 bg-gray-100 rounded-3xl animate-pulse flex items-center justify-center text-gray-400 font-bold">मौसम लोड हो रहा है...</div>
            )}

            {/* Mandi Rates List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">ताज़ा मंडी भाव</p>
                <span className="text-[10px] text-emerald-600 font-bold">लाइव अपडेट</span>
              </div>
              
              {isDashboardLoading ? (
                [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse"></div>)
              ) : mandiRates.length > 0 ? (
                <>
                  {mandiRates.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-700 font-black border border-amber-100 group-hover:bg-amber-100 transition">
                          {item.crop[0]}
                        </div>
                        <div>
                          <p className="font-bold text-base text-gray-800">{item.crop}</p>
                          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">प्रति क्विंटल (Avg)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-emerald-700">{item.price}</p>
                        <span className={`text-[11px] font-black inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          item.trend === 'up' ? 'text-green-600 bg-green-50' : 
                          item.trend === 'down' ? 'text-red-600 bg-red-50' : 
                          'text-gray-500 bg-gray-50'
                        }`}>
                          {item.trend === 'up' ? '↑ लाभ' : item.trend === 'down' ? '↓ गिरावट' : '• स्थिर'}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {dashboardSources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 px-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">मंडी भाव स्रोत:</p>
                      <div className="flex flex-wrap gap-2">
                        {dashboardSources.map((source, idx) => (
                          <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] text-emerald-600 hover:underline font-bold"
                          >
                            • {source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-10 text-center text-gray-400 text-sm font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  इस शहर के लिए फिलहाल भाव उपलब्ध नहीं हैं।
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'technique' && (
          <div className="space-y-6 pt-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-emerald-900">खेती की आधुनिक तकनीक</h2>
              <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { title: "वर्मीकम्पोस्ट खाद", desc: "केंचुए की मदद से जैविक खाद तैयार करें।", tag: "जैविक", color: "bg-emerald-500" },
                { title: "मल्चिंग तकनीक", desc: "मिट्टी में नमी बनाए रखने का कारगर उपाय।", tag: "सिंचाई", color: "bg-blue-500" },
                { title: "ड्रोन छिड़काव", desc: "कम समय में सटीक कीटनाशक छिड़काव।", tag: "टेक्नोलॉजी", color: "bg-purple-500" },
                { title: "मृदा परीक्षण (Soil Test)", desc: "खेत की मिट्टी की जांच कराएं और सही फसल चुनें।", tag: "स्मार्ट फार्मिंग", color: "bg-amber-500" }
              ].map((item, i) => (
                <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-md hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black text-white px-3 py-1 rounded-full uppercase tracking-widest ${item.color}`}>{item.tag}</span>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition" />
                  </div>
                  <h3 className="font-black text-lg text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FLOATING CHAT INPUT BAR */}
      <footer className="bg-white p-4 border-t border-gray-100 mb-16 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-20">
        {selectedImage && (
          <div className="mb-4 relative inline-block animate-pop-in">
            <img src={selectedImage} className="w-24 h-24 rounded-[30px] border-4 border-emerald-600 shadow-xl object-cover" />
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-lg border-2 border-white hover:bg-red-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 bg-gray-100 rounded-[28px] px-4 py-2 border-2 border-transparent focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-inner">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-emerald-700 bg-white rounded-2xl shadow-md hover:bg-emerald-50 transition active:scale-90"
            title="कैमरा"
          >
            <Camera className="w-6 h-6" />
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if(file) {
              const reader = new FileReader();
              reader.onload = () => setSelectedImage(reader.result as string);
              reader.readAsDataURL(file);
            }
          }} />
          <input 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="बोलें या लिखें..." 
            className="flex-1 bg-transparent border-none outline-none text-base font-bold text-gray-800 placeholder-gray-400 px-1"
          />
          <button 
            onClick={toggleRecording}
            className={`p-3 rounded-2xl transition-all shadow-md ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'text-emerald-700 bg-white hover:bg-emerald-50'}`}
            title="वॉयस टाइपिंग"
          >
            <Mic className="w-6 h-6" />
          </button>
          {(inputText || selectedImage) && (
            <button 
              onClick={handleSend} 
              className="bg-emerald-700 text-white p-3 rounded-2xl shadow-lg hover:bg-emerald-800 animate-fade-in active:scale-90"
            >
              <Send className="w-6 h-6" />
            </button>
          )}
        </div>
      </footer>

      {/* BOTTOM TAB NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 flex justify-around items-center h-16 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] z-40">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'chat' ? 'text-emerald-700 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'chat' ? 'bg-emerald-50 rounded-2xl p-2 shadow-sm' : ''}`}>
             <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">चैट/जांच</span>
        </button>
        <button 
          onClick={() => setActiveTab('mandi')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'mandi' ? 'text-emerald-700 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'mandi' ? 'bg-emerald-50 rounded-2xl p-2 shadow-sm' : ''}`}>
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">मंडी/मौसम</span>
        </button>
        <button 
          onClick={() => setActiveTab('technique')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'technique' ? 'text-emerald-700 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'technique' ? 'bg-emerald-50 rounded-2xl p-2 shadow-sm' : ''}`}>
            <Leaf className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">तकनीक</span>
        </button>
      </nav>

      {/* CITY SELECTION MODAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[50px] p-8 shadow-2xl relative animate-pop-in">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <Search className="w-7 h-7 text-emerald-600" />
                <h3 className="text-2xl font-black text-gray-900">अपना शहर खोजें</h3>
              </div>
              <button 
                onClick={() => setIsCityModalOpen(false)} 
                className="p-2 hover:bg-gray-100 rounded-full transition active:scale-90"
              >
                <X className="w-6 h-6 text-gray-900" />
              </button>
            </div>

            {/* City Search Field */}
            <div className="bg-gray-50 rounded-[25px] flex items-center px-6 py-4.5 mb-8 border-2 border-transparent focus-within:border-emerald-600 focus-within:bg-white transition-all shadow-inner">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input 
                type="text" 
                placeholder="शहर या स्थानीय क्षेत्र का नाम..."
                value={citySearchQuery}
                onChange={(e) => {
                  setCitySearchQuery(e.target.value);
                  setTempCity(e.target.value);
                }}
                autoFocus
                className="bg-transparent border-none outline-none text-gray-700 w-full font-bold text-base"
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 px-1">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">लोकप्रिय शहर</p>
                 <button 
                  onClick={handleLocationDetection}
                  className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase hover:underline"
                 >
                   <Navigation className="w-3 h-3" /> मेरी जगह खोजें
                 </button>
              </div>
              <div className="flex flex-wrap gap-2.5 max-h-48 overflow-y-auto no-scrollbar p-1">
                {filteredCities.map(c => (
                  <button 
                    key={c}
                    onClick={() => {
                      setTempCity(c);
                      setCitySearchQuery(c);
                    }}
                    className={`px-6 py-3 rounded-full text-sm font-black transition-all ${
                      tempCity === c 
                        ? 'bg-emerald-700 text-white shadow-xl scale-105 ring-4 ring-emerald-100' 
                        : 'bg-gray-50 text-gray-900 border border-gray-100 hover:bg-gray-100 active:scale-95'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                
                {showCustomCity && (
                  <button 
                    onClick={() => setTempCity(citySearchQuery)}
                    className={`px-6 py-3 rounded-full text-sm font-black transition-all ${
                      tempCity === citySearchQuery 
                        ? 'bg-emerald-700 text-white shadow-xl scale-105 ring-4 ring-emerald-100' 
                        : 'bg-emerald-50 text-emerald-700 border-2 border-dashed border-emerald-200'
                    }`}
                  >
                    "{citySearchQuery}" चुनें
                  </button>
                )}
                
                {filteredCities.length === 0 && !showCustomCity && (
                  <p className="text-sm text-gray-400 font-bold p-4 w-full text-center">कुछ टाइप करें...</p>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                const finalCity = tempCity.trim();
                if (finalCity) {
                  setCity(finalCity);
                  setIsCityModalOpen(false);
                  setCitySearchQuery("");
                } else {
                  alert("कृपया शहर का नाम दर्ज करें");
                }
              }}
              className="w-full bg-[#15803d] hover:bg-[#166534] text-white py-5 rounded-[25px] text-lg font-black shadow-xl active:scale-95 transition-all mb-2 flex items-center justify-center gap-2"
            >
              शहर अपडेट करें
            </button>
          </div>
        </div>
      )}

      {/* LANGUAGE MODAL */}
      {isLangModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-pop-in">
            <h3 className="text-xl font-black text-gray-900 mb-8 text-center uppercase tracking-widest">भाषा चुनें (Language)</h3>
            <div className="grid grid-cols-1 gap-4">
              {LANGUAGES.map(lang => (
                <button 
                  key={lang.code}
                  onClick={() => { setSelectedLang(lang); setIsLangModalOpen(false); }}
                  className={`flex items-center justify-between p-5 rounded-3xl text-lg font-black border-4 transition-all ${
                    selectedLang.code === lang.code 
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-inner' 
                    : 'bg-white border-gray-100 text-gray-500 hover:border-emerald-200'
                  }`}
                >
                  {lang.label}
                  {selectedLang.code === lang.code && <div className="w-4 h-4 bg-emerald-600 rounded-full shadow-sm"></div>}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsLangModalOpen(false)}
              className="w-full mt-6 py-4 text-gray-400 font-black text-sm uppercase tracking-widest hover:text-gray-600"
            >
              बंद करें
            </button>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-pop-in { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @font-face {
          font-family: 'Hind';
          font-style: normal;
          font-weight: 400;
          src: url('https://fonts.gstatic.com/s/hind/v16/5qh6ler9p_NWhR6S.woff2') format('woff2');
        }
      `}</style>
    </div>
  );
};

export default App;
