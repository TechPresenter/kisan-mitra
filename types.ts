
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  sources?: GroundingSource[];
  timestamp: Date;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface MandiData {
  crop: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
}

export interface WeatherData {
  temp: string;
  condition: string;
  humidity: string;
}
