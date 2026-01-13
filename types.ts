
export enum ElementType {
  TEXT = 'text',
  IMAGE = 'image',
  FORMULA = 'formula',
  CHART = 'chart',
  SHAPE = 'shape'
}

export interface SlideElement {
  type: ElementType;
  content: string;
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
  width: number; // 0 to 100 percentage
  height: number; // 0 to 100 percentage
  fontSize?: number;
  fontColor?: string;
  isBold?: boolean;
}

export interface SlideData {
  pageNumber: number;
  elements: SlideElement[];
  thumbnail: string;
  backgroundColor?: string;
}

export interface ProcessingStatus {
  step: 'idle' | 'parsing' | 'analyzing' | 'reconstructing' | 'done' | 'error';
  progress: number;
  message: string;
}
