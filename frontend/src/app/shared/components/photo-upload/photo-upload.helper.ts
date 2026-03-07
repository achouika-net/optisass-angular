export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validate if a file is a valid image
 */
export const isValidImageType = (file: File): boolean => {
  return file.type.startsWith('image/');
};

/**
 * Validate if a file size is within the limit
 */
export const isValidFileSize = (file: File, maxSize: number = MAX_FILE_SIZE_BYTES): boolean => {
  return file.size <= maxSize;
};

/**
 * Compress an image to a maximum dimension and quality
 */
export const compressImage = (dataUrl: string, maxWidth = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
};

/**
 * Load a file or blob and convert it to a data URL
 */
export const loadFileAsDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Capture a frame from a video element as a blob
 */
export const captureVideoFrame = (video: HTMLVideoElement, quality = 0.9): Promise<Blob | null> => {
  return new Promise((resolve) => {
    if (!video || video.videoWidth === 0) {
      resolve(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      resolve(null);
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
};

/**
 * Stop all tracks in a media stream
 */
export const stopMediaStream = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
};
