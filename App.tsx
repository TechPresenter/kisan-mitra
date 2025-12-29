
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
  Globe,
  Settings,
  LogOut,
  Moon,
  Sun,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Bell,
  ArrowLeft,
  FileText,
  Lock,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { analyzeCrop, getDashboardData } from './services/geminiService';
import { Message, MandiData, WeatherData, GroundingSource, User } from './types';

// Helper to decode Google JWT locally
const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Parsing Error:", e);
    return null;
  }
};

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'pa', label: 'पੰਜਾਬी' },
  { code: 'en', label: 'English' }
];

const POPULAR_CITIES = [
  "लखनऊ", "पटना", "इंदौर", "वाराणसी", 
  "नागपुर", "जयपुर", "भोपाल", "पुणे", "अमृतसर", "नाशिक"
];

const GOOGLE_CLIENT_ID = "479886343078-qp955ghf2ucbks61bvo26lem1affjk4h.apps.googleusercontent.com";

type Tab = 'chat' | 'mandi' | 'technique' | 'settings';
type SettingsView = 'main' | 'terms' | 'privacy' | 'notifications';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('isLoggedIn') === 'true');
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Login Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authStep, setAuthStep] = useState<'initial' | 'email-details'>('initial');
  const [authLoading, setAuthLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');

  // Navigation Sub-states
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  // App Functional States
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
  const [pushEnabled, setPushEnabled] = useState(true);
  
  // City/Mandi States
  const [city, setCity] = useState("वाराणसी");
  const [tempCity, setTempCity] = useState("वाराणसी");
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [mandiRates, setMandiRates] = useState<MandiData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dashboardSources, setDashboardSources] = useState<GroundingSource[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [isLoggedIn, user]);

  // --- GOOGLE LOGIN INITIALIZATION ---
  const handleGoogleCredentialResponse = (response: any) => {
    setAuthLoading(true);
    const payload = parseJwt(response.credential);
    if (payload) {
      const userData: User = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        isVerified: true,
      };
      setUser(userData);
      setIsLoggedIn(true);
      console.log("Google Login Success for:", userData.name);
    } else {
      console.error("Login failure: could not decode JWT");
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    let checkInterval: number;
    
    const initializeGoogle = () => {
      const google = (window as any).google;
      if (google && google.accounts && google.accounts.id) {
        clearInterval(checkInterval);
        
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            itp_support: true,
            ux_mode: 'popup',
            cancel_on_tap_outside: true,
          });

          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = "";
            google.accounts.id.renderButton(googleBtnRef.current, {
              type: 'standard',
              theme: theme === 'dark' ? 'filled_black' : 'outline',
              size: 'large',
              width: 320,
              text: 'signin_with',
              shape: 'pill',
            });
          }
          
          // Optional: Prompt One Tap login
          google.accounts.id.prompt((notification: any) => {
             if (notification.isNotDisplayed()) {
               console.log("One-tap hint:", notification.getNotDisplayedReason());
             }
          });
        } catch (err) {
          console.error("Google Auth Init Error:", err);
        }
      }
    };

    if (!isLoggedIn) {
      checkInterval = window.setInterval(initializeGoogle, 800);
      initializeGoogle(); // Run once immediately
    }

    return () => clearInterval(checkInterval);
  }, [isLoggedIn, theme, authStep]);

  // --- SPEECH RECOGNITION ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = selectedLang.code === 'hi' ? 'hi-IN' : 'en-US';
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInputText(transcript);
        setIsRecording(false);
      };
      recognitionRef.current.onend = () => setIsRecording(false);
      recognitionRef.current.onerror = () => setIsRecording(false);
    }
  }, [selectedLang]);

  // --- DASHBOARD ---
  const fetchDashboardData = async () => {
    if (!isLoggedIn) return;
    setIsDashboardLoading(true);
    try {
      const result = await getDashboardData(city);
      if (result && result.mandi && result.weather) {
        setMandiRates(result.mandi);
        setWeather(result.weather);
        setDashboardSources(result.sources || []);
      } else {
        setMandiRates([
          { crop: 'गेहूं', price: '₹2,450', trend: 'up' },
          { crop: 'टमाटर', price: '₹1,200', trend: 'down' },
          { crop: 'चावल', price: '₹3,100', trend: 'stable' }
        ]);
        setWeather({ temp: '32°C', condition: 'धूप खिली है', humidity: '45%' });
        setDashboardSources([]);
      }
    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      setIsDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mandi') fetchDashboardData();
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
        id: 'error',
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
        alert("माफ़ करें, आपका ब्राउज़र वॉइस टाइपिंग को सपोर्ट नहीं करता।");
      }
    }
  };

  // --- EMAIL AUTH ---
  const handleEmailContinue = () => {
    if (!authEmail || !authEmail.includes('@')) {
      alert('कृपया सही ईमेल पता दर्ज करें।');
      return;
    }
    setAuthStep('email-details');
  };

  const completeEmailLogin = () => {
    if (!authName.trim()) {
      alert('कृपया अपना नाम दर्ज करें।');
      return;
    }
    setAuthLoading(true);
    setTimeout(() => {
      const userData: User = { 
        name: authName, 
        email: authEmail, 
        isVerified: true,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(authName)}&background=random&color=fff`
      };
      setUser(userData);
      setIsLoggedIn(true);
      setAuthLoading(false);
    }, 1200);
  };

  const confirmLogout = () => {
    const google = (window as any).google;
    if (google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    setIsLoggedIn(false);
    setUser(null);
    setAuthStep('initial');
    setAuthEmail('');
    setAuthName('');
    setActiveTab('chat');
    setSettingsView('main');
    setShowLogoutConfirm(false);
    localStorage.clear();
  };

  const handleLocationDetection = () => {
    if (!navigator.geolocation) {
      alert("माफ़ करें, आपका ब्राउज़र स्थान सेवा को सपोर्ट नहीं करता।");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestCity = "लखनऊ";
        setCity(nearestCity);
        setTempCity(nearestCity);
        setIsCityModalOpen(false);
      },
      (error) => {
        alert("स्थान प्राप्त करने में विफल।");
      }
    );
  };

  const filteredCities = POPULAR_CITIES.filter(c => 
    c.includes(citySearchQuery) || citySearchQuery === ""
  );

  // --- RENDER LOGIN ---
  if (!isLoggedIn) {
    return (
      <div className={`flex flex-col h-screen max-w-md mx-auto transition-colors duration-500 font-['Hind'] ${theme === 'dark' ? 'bg-[#042f24] text-white' : 'bg-emerald-900 text-white'}`}>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pb-12">
          <div className="bg-white/10 p-6 rounded-[40px] mb-8 border border-white/20 animate-pop-in shadow-2xl">
            <Sprout className="w-16 h-16 text-green-300" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">किसान मित्र</h1>
          <p className="text-emerald-100/70 mb-12 text-lg">खेती की हर समस्या का समाधान</p>
          
          <div className="w-full space-y-4 flex flex-col items-center">
            {authStep === 'initial' ? (
              <>
                {/* Real Google Button Container */}
                <div 
                  ref={googleBtnRef} 
                  id="google-signin-btn"
                  className="w-full flex justify-center mb-2 overflow-hidden rounded-full shadow-md transition-transform active:scale-95"
                  style={{ minHeight: '44px' }}
                ></div>
                
                {authLoading && <Loader2 className="w-6 h-6 animate-spin text-white mb-2" />}

                <div className="flex items-center gap-4 py-2 w-full">
                  <div className="flex-1 h-px bg-white/10"></div>
                  <span className="text-[10px] font-black text-emerald-100/40 uppercase tracking-widest">अथवा</span>
                  <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <div className="space-y-4 w-full">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-4.5 w-5 h-5 text-emerald-100/30 group-focus-within:text-emerald-300 transition-colors" />
                    <input 
                      type="email" 
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="ईमेल से लॉगिन करें"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4.5 pl-12 pr-4 text-white placeholder-emerald-100/30 outline-none focus:border-green-400 focus:bg-white/10 transition"
                    />
                  </div>
                  <button 
                    onClick={handleEmailContinue}
                    className="w-full bg-emerald-700/50 border border-white/20 text-white py-4.5 rounded-[24px] font-black hover:bg-emerald-700 transition active:scale-95 shadow-lg"
                  >
                    ईमेल से आगे बढ़ें
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6 animate-fade-in text-left w-full">
                <button 
                  onClick={() => setAuthStep('initial')}
                  className="flex items-center gap-1 text-emerald-200 font-bold mb-4 hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" /> वापस
                </button>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-black text-emerald-200/60 uppercase mb-2 block tracking-wider px-1">आपका शुभ नाम</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-4.5 w-5 h-5 text-emerald-100/30" />
                      <input 
                        type="text" 
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="नाम दर्ज करें"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4.5 pl-12 pr-4 text-white placeholder-emerald-100/30 outline-none focus:border-green-400 transition shadow-inner"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={completeEmailLogin}
                    disabled={authLoading}
                    className="w-full bg-green-500 text-emerald-950 py-5 rounded-[24px] font-black shadow-xl hover:bg-green-400 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "शुरू करें"}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <p className="mt-8 text-xs text-emerald-100/50 max-w-[280px] leading-relaxed">
            लॉगिन करके आप हमारे <span className="underline decoration-dotted underline-offset-4 cursor-pointer">नियमों</span> और <span className="underline decoration-dotted underline-offset-4 cursor-pointer">निजता नीति</span> से सहमत होते हैं।
          </p>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto transition-all duration-500 shadow-2xl relative overflow-hidden font-['Hind'] ${theme === 'dark' ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* GLOBAL HEADER */}
      <header className={`${theme === 'dark' ? 'bg-[#064e3b]' : 'bg-[#14532d]'} text-white pt-6 pb-4 px-4 shadow-lg z-30 transition-all duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-green-100/10 p-1.5 rounded-xl border border-white/10">
              <Sprout className="w-5 h-5 text-green-300" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">किसान मित्र</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition active:scale-90"
              title="बदलें लाइट/डार्क मोड"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5 text-emerald-200" />}
            </button>
            <button 
              onClick={() => setIsLangModalOpen(true)}
              className="flex items-center bg-[#1a4a2e] rounded-xl px-3 py-2 border border-green-800 text-xs font-bold hover:bg-green-800 transition shadow-inner"
            >
              <Globe className="w-3.5 h-3.5 mr-2" />
              <span>{selectedLang.label}</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
        
        {/* City Location Bar */}
        <div 
          onClick={() => {
            setTempCity(city);
            setCitySearchQuery("");
            setIsCityModalOpen(true);
          }}
          className={`${theme === 'dark' ? 'bg-black/20' : 'bg-[#0f3d23]'} rounded-2xl p-3.5 flex items-center justify-between cursor-pointer border border-green-800/30 hover:bg-[#124b2a] transition active:scale-95 group shadow-sm`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-green-500/20 rounded-full group-hover:scale-110 transition duration-300">
              <MapPin className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm font-semibold">{city} (बदलें)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-green-600" />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 overflow-y-auto p-4 relative no-scrollbar pb-24 transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-950' : 'bg-white'}`} ref={scrollRef}>
        
        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start animate-fade-in'}`}>
                <div className={`max-w-[88%] relative ${
                  msg.role === 'user' 
                    ? 'bg-emerald-700 text-white rounded-2xl rounded-tr-none shadow-lg' 
                    : (theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100') + ' shadow-md rounded-2xl rounded-tl-none'
                } p-4 shadow-sm`}>
                  {msg.image && <img src={msg.image} className="rounded-xl mb-3 max-h-64 w-full object-cover shadow-sm border border-gray-100" />}
                  <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</div>
                  
                  {msg.role === 'assistant' && (
                    <div className="mt-4 space-y-4">
                      <button 
                        onClick={() => speakText(msg.content)}
                        className={`flex items-center gap-2 text-xs font-black px-4 py-2 rounded-full transition border active:scale-95 shadow-sm ${
                          theme === 'dark' ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" /> सुनें
                      </button>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className={`pt-3 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                          <p className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest">विश्वसनीय स्रोत:</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition truncate max-w-[140px] font-bold ${
                                  theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                } shadow-sm`}
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
              <div className={`flex justify-start items-center gap-3 font-bold text-xs animate-pulse w-fit p-4 rounded-2xl border ${
                theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                सोच रहा हूँ...
              </div>
            )}
          </div>
        )}

        {/* MANDI TAB */}
        {activeTab === 'mandi' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>बाज़ार और मौसम</h2>
              <button 
                onClick={fetchDashboardData} 
                disabled={isDashboardLoading}
                className={`p-2.5 rounded-full hover:bg-emerald-100 active:rotate-180 transition-all duration-500 ${
                  theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <RefreshCw className={`w-4.5 h-4.5 ${isDashboardLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Weather Card */}
            {weather ? (
              <div className={`p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden border-b-8 transition-all ${
                theme === 'dark' ? 'bg-indigo-950 border-indigo-900' : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-indigo-800'
              }`}>
                <div className="absolute -right-4 -top-4 opacity-10 transform rotate-12">
                   <CloudRain className="w-40 h-40" />
                </div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-xs font-black opacity-80 uppercase tracking-widest mb-1.5">आज {city} में</p>
                    <p className="text-6xl font-black tracking-tighter">{weather.temp}</p>
                    <p className="text-lg font-bold mt-1 text-blue-100">{weather.condition}</p>
                  </div>
                  <div className="bg-white/20 p-4 rounded-[24px] backdrop-blur-md border border-white/20">
                    <CloudSun className="w-10 h-10" />
                  </div>
                </div>
                <div className="mt-8 flex gap-3 text-xs font-bold relative z-10">
                  <span className="flex items-center gap-1.5 bg-white/30 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-sm"><Droplets className="w-4 h-4" /> {weather.humidity} उमस</span>
                  <span className="flex items-center gap-1.5 bg-white/30 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-sm"><Thermometer className="w-4 h-4" /> हवा: मंद</span>
                </div>
              </div>
            ) : isDashboardLoading && (
              <div className={`h-40 rounded-[32px] animate-pulse flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>मौसम लोड हो रहा है...</div>
            )}

            {/* Mandi Rates */}
            <div className="space-y-3.5">
              <div className="flex justify-between items-center px-1">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">ताज़ा मंडी भाव</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-emerald-600 font-bold">लाइव अपडेट</span>
                </div>
              </div>
              
              {isDashboardLoading ? (
                [1, 2, 3].map(i => <div key={i} className={`h-24 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}></div>)
              ) : mandiRates.length > 0 ? (
                mandiRates.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-5 rounded-3xl border shadow-sm hover:shadow-md transition-all group ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black border transition-colors ${
                        theme === 'dark' ? 'bg-amber-900/20 text-amber-500 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {item.crop[0]}
                      </div>
                      <div>
                        <p className={`font-bold text-lg leading-tight ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{item.crop}</p>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">प्रति क्विंटल</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl text-emerald-600">{item.price}</p>
                      <span className={`text-[11px] font-black inline-flex items-center gap-1 px-3 py-1 rounded-full mt-1.5 ${
                        item.trend === 'up' ? 'text-green-600 bg-green-50 border border-green-100' : 
                        item.trend === 'down' ? 'text-red-600 bg-red-50 border border-red-100' : 
                        'text-gray-500 bg-gray-50 border border-gray-100'
                      }`}>
                        {item.trend === 'up' ? '↑ वृद्धि' : item.trend === 'down' ? '↓ गिरावट' : '• स्थिर'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`p-12 text-center text-sm font-bold rounded-3xl border-2 border-dashed ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                  अभी मंडी भाव उपलब्ध नहीं हैं।
                </div>
              )}

              {dashboardSources.length > 0 && (
                <div className={`mt-6 pt-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
                  <p className="text-[10px] font-black text-emerald-600 uppercase mb-2 tracking-widest px-1">जानकारी के स्रोत:</p>
                  <div className="flex flex-wrap gap-2">
                    {dashboardSources.map((source, idx) => (
                      <a 
                        key={idx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition truncate max-w-[140px] font-bold shadow-sm ${
                          theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TECHNIQUE TAB */}
        {activeTab === 'technique' && (
          <div className="space-y-6 pt-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>खेती की आधुनिक तकनीक</h2>
              <div className={`p-2.5 rounded-xl shadow-sm ${theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <BookOpen className="w-5.5 h-5.5" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4.5 pb-10">
              {[
                { title: "वर्मीकम्पोस्ट खाद", desc: "केंचुए की मदद से घर पर जैविक खाद तैयार करें।", tag: "जैविक", color: "bg-emerald-500" },
                { title: "मल्चिंग तकनीक", desc: "खेत की नमी बचाने और खरपतवार रोकने का तरीका।", tag: "सिंचाई", color: "bg-blue-500" },
                { title: "ड्रोन का छिड़काव", desc: "सटीक मात्रा में खाद और कीटनाशक का आधुनिक छिड़काव।", tag: "टेक्नोलॉजी", color: "bg-purple-500" },
                { title: "मिट्टी परीक्षण", desc: "अपनी मिट्टी की सेहत जानें और सही फसल चुनें।", tag: "स्मार्ट फार्मिंग", color: "bg-amber-500" }
              ].map((item, i) => (
                <div key={i} className={`p-6 rounded-[32px] border shadow-md hover:border-emerald-500 transition-all cursor-pointer group relative overflow-hidden ${
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 hover:bg-emerald-50'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-black text-white px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-sm ${item.color}`}>{item.tag}</span>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <h3 className={`font-black text-lg mb-1.5 leading-tight ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{item.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS/PROFILE TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fade-in pb-10">
            {settingsView === 'main' ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>प्रोफाइल एवं सेटिंग्स</h2>
                  <Settings className="text-emerald-500 w-6 h-6" />
                </div>

                {/* Profile Card */}
                <div className={`p-6 rounded-[36px] border flex items-center gap-5 transition-all shadow-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700 shadow-inner border-2 border-emerald-100 shrink-0 overflow-hidden">
                    {user?.picture ? (
                      <img src={user.picture} className="w-full h-full object-cover" alt="profile" />
                    ) : (
                      <UserIcon className="w-10 h-10" />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className={`font-black text-xl truncate tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user?.name}</h3>
                    <p className="text-xs text-gray-500 font-bold truncate mt-0.5">{user?.email}</p>
                    {user?.isVerified && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-green-600 bg-green-50 px-3 py-1.5 rounded-full mt-3 font-black border border-green-100 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> सत्यापित किसान
                      </span>
                    )}
                  </div>
                </div>

                {/* Settings Actions */}
                <div className="space-y-3 pt-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 px-1">एप्लीकेशन सेटिंग्स</p>
                  
                  <div className={`p-5 rounded-[24px] flex items-center justify-between transition-all ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                      </div>
                      <span className="font-bold text-sm">डार्क मोड (Dark Mode)</span>
                    </div>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`w-14 h-7.5 rounded-full transition-all relative ${theme === 'dark' ? 'bg-emerald-600' : 'bg-gray-200 shadow-inner'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-0.75 transition-all shadow-md ${theme === 'dark' ? 'left-7.25' : 'left-0.75'}`}></div>
                    </button>
                  </div>

                  <div 
                    onClick={() => setSettingsView('notifications')}
                    className={`p-5 rounded-[24px] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                        <Bell className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">नोटिफिकेशन सेटिंग्स</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-bold">{pushEnabled ? 'चालू' : 'बंद'}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>

                  <div 
                    onClick={() => setIsLangModalOpen(true)}
                    className={`p-5 rounded-[24px] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">भाषा (Language)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-bold">{selectedLang.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 px-1">सहायता एवं कानूनी</p>
                  
                  <div 
                    onClick={() => setSettingsView('terms')}
                    className={`p-5 rounded-[24px] flex items-center justify-between cursor-pointer transition-all ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">नियम एवं शर्तें (Terms)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>

                  <div 
                    onClick={() => setSettingsView('privacy')}
                    className={`p-5 rounded-[24px] flex items-center justify-between cursor-pointer transition-all ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-100 shadow-sm'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                        <Lock className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">निजता नीति (Privacy)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>

                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center gap-4 p-5 rounded-[30px] bg-red-50 text-red-600 active:scale-95 transition-all mt-10 shadow-sm border border-red-100 mb-6 font-black uppercase tracking-widest text-sm"
                >
                  <LogOut className="w-6 h-6" />
                  लॉगआउट करें
                </button>
                
                <div className="text-center space-y-1.5 opacity-40 py-6 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">किसान मित्र</p>
                  <p className="text-[10px] font-bold">Made with ❤️ in India | v2.6.0</p>
                </div>
              </>
            ) : settingsView === 'notifications' ? (
              <div className="space-y-6 animate-fade-in">
                <button onClick={() => setSettingsView('main')} className="flex items-center gap-1.5 text-emerald-600 font-black uppercase text-xs mb-6 hover:underline">
                  <ChevronLeft className="w-4 h-4" /> वापस
                </button>
                <div className="space-y-1.5 mb-8">
                  <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>नोटिफिकेशन सेटिंग्स</h2>
                  <p className="text-sm text-gray-500 font-bold leading-relaxed">खेती और मंडी के जरूरी अपडेट्स के लिए सूचनाएं चालू रखें।</p>
                </div>
                
                <div className={`p-7 rounded-[32px] border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-md'} space-y-8`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-black text-base">पुश सूचनाएं (Push Notifications)</h4>
                      <p className="text-xs text-gray-500">मंडी भाव और मौसम अलर्ट्स के लिए</p>
                    </div>
                    <button 
                      onClick={() => setPushEnabled(!pushEnabled)}
                      className={`w-14 h-7.5 rounded-full transition-all relative ${pushEnabled ? 'bg-emerald-600 shadow-inner' : 'bg-gray-200 shadow-inner'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-0.75 transition-all shadow-md ${pushEnabled ? 'left-7.25' : 'left-0.75'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
            ) : settingsView === 'terms' ? (
              <div className="space-y-6 animate-fade-in pb-10">
                <button onClick={() => setSettingsView('main')} className="flex items-center gap-1.5 text-emerald-600 font-black uppercase text-xs mb-6 hover:underline">
                  <ChevronLeft className="w-4 h-4" /> वापस
                </button>
                <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>नियम एवं शर्तें</h2>
                <div className={`space-y-5 text-[15px] font-medium leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="font-black text-emerald-600 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl inline-block">अंतिम अपडेट: 15 मई 2024</p>
                  <p>1. <strong>सहमति:</strong> "किसान मित्र" एप्लीकेशन का उपयोग करके आप इन निर्धारित शर्तों से पूरी तरह सहमत होते हैं।</p>
                  <p>2. <strong>सूचना की सत्यता:</strong> ऐप में दिखाए गए मंडी भाव और मौसम के आंकड़े केवल अनुमानित हैं। वास्तविक जानकारी के लिए अपने क्षेत्र की कृषि मंडी से संपर्क करें।</p>
                  <p>3. <strong>फसल सलाह:</strong> AI द्वारा दी गई बीमारियों की पहचान और उपचार एक सामान्य मार्गदर्शन है। किसी भी बड़े रासायनिक छिड़काव से पहले कृषि विशेषज्ञ की सलाह लें।</p>
                  <p>4. <strong>खाता उपयोग:</strong> आपका ईमेल और प्रोफाइल डाटा केवल बेहतर अनुभव के लिए सुरक्षित रखा जाता है।</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in pb-10">
                <button onClick={() => setSettingsView('main')} className="flex items-center gap-1.5 text-emerald-600 font-black uppercase text-xs mb-6 hover:underline">
                  <ChevronLeft className="w-4 h-4" /> वापस
                </button>
                <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>निजता नीति (Privacy Policy)</h2>
                <div className={`space-y-5 text-[15px] font-medium leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="font-black text-emerald-600 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl inline-block">अंतिम अपडेट: 15 मई 2024</p>
                  <p>हम आपकी निजता को गंभीरता से लेते हैं। किसान मित्र द्वारा एकत्रित डाटा निम्नलिखित है:</p>
                  <ul className="list-disc pl-6 space-y-3">
                    <li>आपकी लोकेशन (सटीक मंडी भाव और मौसम के लिए)</li>
                    <li>अपलोड की गई फसल की फोटो (बीमारी की जांच के लिए)</li>
                    <li>आपका ईमेल और नाम (प्रोफाइल सुरक्षित रखने के लिए)</li>
                  </ul>
                  <p><strong>डेटा सुरक्षा:</strong> आपका सारा डेटा एन्क्रिप्टेड सर्वर पर सुरक्षित रहता. है। हम आपकी निजी जानकारी किसी तीसरे पक्ष को कभी नहीं बेचते।</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER INPUT (Chat only) */}
      {activeTab === 'chat' && (
        <footer className={`p-4 border-t mb-16 shadow-[0_-12px_30px_rgba(0,0,0,0.06)] z-20 transition-colors ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          {selectedImage && (
            <div className="mb-4 relative inline-block animate-pop-in">
              <img src={selectedImage} className="w-24 h-24 rounded-[32px] border-4 border-emerald-600 shadow-xl object-cover" />
              <button 
                onClick={() => setSelectedImage(null)} 
                className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-lg border-2 border-white hover:bg-red-700 transition active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className={`flex items-center gap-3 rounded-[32px] px-5 py-2.5 border-2 transition-all shadow-inner ${
            theme === 'dark' ? 'bg-gray-800 border-transparent focus-within:border-emerald-600' : 'bg-gray-100 border-transparent focus-within:border-emerald-500 focus-within:bg-white'
          }`}>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-2xl shadow-md transition active:scale-90 ${theme === 'dark' ? 'bg-gray-700 text-emerald-400' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
              title="फोटो लें"
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
              placeholder="सवाल पूछें या फोटो भेजें..." 
              className={`flex-1 bg-transparent border-none outline-none text-base font-bold placeholder-gray-400 px-1 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}
            />
            <button 
              onClick={toggleRecording}
              className={`p-3 rounded-2xl transition-all shadow-md ${isRecording ? 'bg-red-600 text-white animate-pulse' : (theme === 'dark' ? 'bg-gray-700 text-emerald-400' : 'bg-white text-emerald-700 hover:bg-emerald-50')}`}
              title="बोलकर टाइप करें"
            >
              <Mic className="w-6 h-6" />
            </button>
            {(inputText || selectedImage) && (
              <button 
                onClick={handleSend} 
                className="bg-emerald-700 text-white p-3.5 rounded-2xl shadow-lg hover:bg-emerald-800 animate-fade-in active:scale-90"
              >
                <Send className="w-6 h-6" />
              </button>
            )}
          </div>
        </footer>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t flex justify-around items-center h-18 shadow-[0_-4px_30px_rgba(0,0,0,0.1)] z-40 transition-colors ${
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
      }`}>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'chat' ? 'text-emerald-500 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'chat' ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50') + ' rounded-[20px] p-2.5 shadow-sm' : ''}`}>
             <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">सलाह</span>
        </button>
        <button 
          onClick={() => setActiveTab('mandi')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'mandi' ? 'text-emerald-500 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'mandi' ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50') + ' rounded-[20px] p-2.5 shadow-sm' : ''}`}>
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">मंडी</span>
        </button>
        <button 
          onClick={() => setActiveTab('technique')}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'technique' ? 'text-emerald-500 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'technique' ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50') + ' rounded-[20px] p-2.5 shadow-sm' : ''}`}>
            <Leaf className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">तकनीक</span>
        </button>
        <button 
          onClick={() => {
            setActiveTab('settings');
            setSettingsView('main');
          }}
          className={`flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${activeTab === 'settings' ? 'text-emerald-500 scale-110' : 'text-gray-400'}`}
        >
          <div className={`${activeTab === 'settings' ? (theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50') + ' rounded-[20px] p-2.5 shadow-sm' : ''}`}>
            <Settings className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">प्रोफाइल</span>
        </button>
      </nav>

      {/* LOGOUT CONFIRM MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className={`w-full max-w-xs rounded-[40px] p-8 shadow-2xl text-center animate-pop-in ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <LogOut className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black mb-2">लॉगआउट?</h3>
            <p className="text-sm text-gray-500 font-bold mb-8">क्या आप सच में ऐप से बाहर निकलना चाहते हैं?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmLogout}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition"
              >
                हाँ, लॉगआउट करें
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-gray-100 text-gray-800 py-4 rounded-2xl font-black active:scale-95 transition"
              >
                नहीं, वापस चलें
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CITY MODAL */}
      {isCityModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className={`w-full max-w-sm rounded-[48px] p-9 shadow-2xl relative animate-pop-in border border-white/10 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Search className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">शहर चुनें</h3>
              </div>
              <button 
                onClick={() => setIsCityModalOpen(false)} 
                className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className={`rounded-[28px] flex items-center px-6 py-5 mb-8 border-2 transition-all shadow-inner ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700 focus-within:border-emerald-600' : 'bg-gray-50 border-transparent focus-within:border-emerald-600 focus-within:bg-white'
            }`}>
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input 
                type="text" 
                placeholder="खोजें..."
                value={citySearchQuery}
                onChange={(e) => {
                  setCitySearchQuery(e.target.value);
                  setTempCity(e.target.value);
                }}
                autoFocus
                className="bg-transparent border-none outline-none text-base font-bold w-full"
              />
            </div>

            <div className="mb-10">
              <div className="flex items-center justify-between mb-5 px-1">
                 <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em]">लोकप्रिय विकल्प</p>
                 <button 
                  onClick={handleLocationDetection}
                  className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase hover:bg-emerald-50 px-3 py-1.5 rounded-full transition"
                 >
                   <Navigation className="w-3.5 h-3.5" /> पास की जगह
                 </button>
              </div>
              <div className="flex flex-wrap gap-3 max-h-56 overflow-y-auto no-scrollbar p-1">
                {filteredCities.map(c => (
                  <button 
                    key={c}
                    onClick={() => {
                      setTempCity(c);
                      setCitySearchQuery(c);
                    }}
                    className={`px-5 py-3 rounded-2xl text-sm font-black transition-all ${
                      tempCity === c 
                        ? 'bg-emerald-700 text-white shadow-xl scale-105 ring-4 ring-emerald-100' 
                        : (theme === 'dark' ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-50 text-gray-900 border border-gray-100 shadow-sm') + ' hover:opacity-80 active:scale-95'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                if (tempCity.trim()) {
                  setCity(tempCity.trim());
                  setIsCityModalOpen(false);
                  setCitySearchQuery("");
                }
              }}
              className="w-full bg-[#15803d] hover:bg-[#166534] text-white py-5 rounded-[28px] text-lg font-black shadow-xl active:scale-95 transition-all mb-2 flex items-center justify-center gap-2"
            >
              शहर अपडेट करें
            </button>
          </div>
        </div>
      )}

      {isLangModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className={`w-full max-sm rounded-[48px] p-9 shadow-2xl animate-pop-in border border-white/10 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
            <h3 className="text-xl font-black mb-10 text-center uppercase tracking-widest text-emerald-600 dark:text-emerald-400">भाषा का चयन (Language)</h3>
            <div className="grid grid-cols-1 gap-4.5">
              {LANGUAGES.map(lang => (
                <button 
                  key={lang.code}
                  onClick={() => { setSelectedLang(lang); setIsLangModalOpen(false); }}
                  className={`flex items-center justify-between p-6 rounded-[28px] text-lg font-black border-4 transition-all ${
                    selectedLang.code === lang.code 
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-inner scale-105 ring-8 ring-emerald-500/5' 
                    : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-white border-gray-100 text-gray-500') + ' hover:border-emerald-200'
                  }`}
                >
                  {lang.label}
                  {selectedLang.code === lang.code && <div className="w-5 h-5 bg-emerald-600 rounded-full shadow-lg border-4 border-emerald-100"></div>}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsLangModalOpen(false)}
              className="w-full mt-10 py-5 text-gray-400 font-black text-sm uppercase tracking-[0.3em] hover:text-emerald-600 transition-colors"
            >
              वापस जाएँ (Close)
            </button>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-pop-in { animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @font-face {
          font-family: 'Hind';
          font-style: normal;
          font-weight: 400;
          src: url('https://fonts.gstatic.com/s/hind/v16/5qh6ler9p_NWhR6S.woff2') format('woff2');
        }
        #google-signin-btn > div {
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};

export default App;
