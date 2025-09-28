
export interface GeolocationPosition {
  latitude: number;
  longitude: number;
}

export interface ProductRecord {
  id: string;
  imageUrl: string;
  name: string;
  price: number;
  date: string;
  location: GeolocationPosition | null;
}

export interface OcrResult {
  productName: string;
  price: number;
}
