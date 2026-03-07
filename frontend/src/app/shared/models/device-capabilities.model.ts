export interface IDeviceCapabilities {
  readonly hasCamera: boolean;
  readonly isMobile: boolean;
  readonly isTablet: boolean;
  readonly isDesktop: boolean;
  readonly supportsCameraCapture: boolean;
}
