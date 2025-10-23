/**
 * Image handling utilities for the editor
 * Based on requirements 1.7
 */

/**
 * Convert a File or Blob to base64 data URL
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Validate if a file is a supported image type
 */
export function isValidImageFile(file: File): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  return supportedTypes.includes(file.type);
}

/**
 * Get image dimensions from a file
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Resize image if it's too large
 */
export function resizeImageIfNeeded(
  file: File, 
  maxWidth: number = 800, 
  maxHeight: number = 600,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img;
      
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = calculateResizedDimensions(
        naturalWidth, 
        naturalHeight, 
        maxWidth, 
        maxHeight
      );
      
      // If image is already small enough, use original
      if (width >= naturalWidth && height >= naturalHeight) {
        fileToBase64(file).then(resolve).catch(reject);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64
      const dataUrl = canvas.toDataURL(file.type, quality);
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate resized dimensions maintaining aspect ratio
 */
function calculateResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Scale down if too wide
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  // Scale down if too tall
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Extract images from clipboard data
 */
export function extractImagesFromClipboard(clipboardData: DataTransfer): File[] {
  const images: File[] = [];
  
  if (clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (isValidImageFile(file)) {
        images.push(file);
      }
    }
  }
  
  return images;
}

/**
 * Generate a unique ID for an image
 */
export function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Image data interface for storage
 */
export interface ImageData {
  id: string;
  dataUrl: string;
  originalName?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: Date;
}

/**
 * Create image data object from file
 */
export async function createImageData(file: File): Promise<ImageData> {
  const [dataUrl, dimensions] = await Promise.all([
    resizeImageIfNeeded(file),
    getImageDimensions(file).catch(() => ({ width: 0, height: 0 }))
  ]);
  
  return {
    id: generateImageId(),
    dataUrl,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    width: dimensions.width,
    height: dimensions.height,
    createdAt: new Date()
  };
}