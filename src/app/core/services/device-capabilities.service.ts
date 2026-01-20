import { Injectable, signal } from '@angular/core';
import { IDeviceCapabilities } from '@app/models';

@Injectable({ providedIn: 'root' })
export class DeviceCapabilitiesService {
  readonly #capabilities = signal<IDeviceCapabilities>({
    hasCamera: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    supportsCameraCapture: false,
  });

  readonly #initialized = signal(false);

  readonly capabilities = this.#capabilities.asReadonly();
  readonly initialized = this.#initialized.asReadonly();

  readonly hasCamera = () => this.#capabilities().hasCamera;
  readonly isMobile = () => this.#capabilities().isMobile;
  readonly isTablet = () => this.#capabilities().isTablet;
  readonly isDesktop = () => this.#capabilities().isDesktop;
  readonly supportsCameraCapture = () => this.#capabilities().supportsCameraCapture;

  /**
   * Initializes device capabilities detection.
   * Should be called once at app startup.
   */
  async initialize(): Promise<void> {
    if (this.#initialized()) return;

    const deviceType = this.#detectDeviceType();
    const hasCamera = await this.#detectCamera();

    this.#capabilities.set({
      hasCamera,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      supportsCameraCapture: hasCamera,
    });

    this.#initialized.set(true);
  }

  /**
   * Detects device type based on user agent and screen characteristics.
   * @returns Device type: 'mobile', 'tablet', or 'desktop'
   */
  #detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();

    const mobileRegex = /android.*mobile|iphone|ipod|blackberry|iemobile|opera mini|mobile/;
    if (mobileRegex.test(userAgent)) {
      return 'mobile';
    }

    const tabletRegex = /ipad|android(?!.*mobile)|tablet/;
    if (tabletRegex.test(userAgent)) {
      return 'tablet';
    }

    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const screenWidth = window.innerWidth;

    if (hasTouchScreen && screenWidth >= 768 && screenWidth <= 1024) {
      return 'tablet';
    }

    return 'desktop';
  }

  /**
   * Detects if device has a camera using MediaDevices API.
   * @returns True if camera is available
   */
  async #detectCamera(): Promise<boolean> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return false;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((device) => device.kind === 'videoinput');
    } catch {
      return false;
    }
  }

  /**
   * Requests camera access and returns the media stream.
   * @param facingMode Camera facing mode ('user' for front, 'environment' for back)
   * @returns MediaStream if successful, null if denied or unavailable
   */
  async requestCameraAccess(
    facingMode: 'user' | 'environment' = 'environment',
  ): Promise<MediaStream | null> {
    if (!this.hasCamera()) {
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      return stream;
    } catch {
      return null;
    }
  }

  /**
   * Stops all tracks of a media stream.
   * @param stream MediaStream to stop
   */
  stopMediaStream(stream: MediaStream | null): void {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }
}
