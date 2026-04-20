import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VirtualTryonService } from './virtual-tryon.service';
import * as faceapi from 'face-api.js';
import * as THREE from 'three';

@Component({
    selector: 'app-virtual-mirror',
    templateUrl: './virtual-mirror.component.html',
    styleUrls: ['./virtual-mirror.component.scss'],
})
export class VirtualMirrorComponent implements OnInit {
    @ViewChild('video') videoRef: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvasRef: ElementRef<HTMLCanvasElement>;

    isLoading = false;
    isCameraActive = false;
    tryonResult: any = null;
    confidenceScore: number = 0;
    faceDetected = false;
    selectedProductId: string;
    productList: any[] = [];

    private stream: MediaStream;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private modelsLoaded = false;

    constructor(
        private tryonService: VirtualTryonService,
        private route: ActivatedRoute,
    ) { }

    async ngOnInit() {
        await this.loadFaceApiModels();
        this.loadProductList();
        this.initializeThreeJs();
    }

    /**
     * Load TensorFlow.js face detection models
     */
    private async loadFaceApiModels() {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
                faceapi.nets.faceExpressionNet.loadFromUri('/assets/models'),
                faceapi.nets.faceAgeGenderNet.loadFromUri('/assets/models'),
            ]);
            this.modelsLoaded = true;
        } catch (error) {
            console.error('Failed to load face detection models:', error);
        }
    }

    /**
     * Initialize Three.js scene for 3D rendering
     */
    private initializeThreeJs() {
        const canvas = this.canvasRef?.nativeElement;
        if (!canvas) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            1000,
        );

        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setClearColor(0x000000, 0);

        this.camera.position.z = 5;

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }

    /**
     * Activate camera and start face detection
     */
    async activateCamera() {
        if (!this.modelsLoaded) {
            alert('Face detection models are still loading. Please wait.');
            return;
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });

            const video = this.videoRef.nativeElement;
            video.srcObject = this.stream;
            video.onloadedmetadata = () => {
                video.play();
                this.isCameraActive = true;
                this.startFaceDetection();
            };
        } catch (error) {
            console.error('Failed to access camera:', error);
            alert('Camera access denied. Please check your browser permissions.');
        }
    }

    /**
     * Start continuous face detection
     */
    private async startFaceDetection() {
        const video = this.videoRef.nativeElement;
        const canvas = this.canvasRef.nativeElement;

        const detect = async () => {
            if (!this.isCameraActive) return;

            try {
                const detections = await faceapi
                    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceExpressions()
                    .withFaceDescriptors()
                    .withAgeAndGender();

                // Update face detection status
                this.faceDetected = detections.length > 0;

                if (detections.length > 0 && this.selectedProductId) {
                    const detection = detections[0];

                    // Draw face detection overlay
                    this.drawFaceDetectionOverlay(canvas, detection);

                    // Render 3D glasses on face
                    this.render3DModel(detection, video);
                }
            } catch (error) {
                console.error('Face detection error:', error);
            }

            requestAnimationFrame(detect);
        };

        detect();
    }

    /**
     * Draw face detection landmarks on canvas
     */
    private drawFaceDetectionOverlay(canvas: HTMLCanvasElement, detection: any) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw face box
        const box = detection.detection.box;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw landmarks
        const landmarks = detection.landmarks;
        ctx.fillStyle = '#00ff00';
        landmarks.positions.forEach((point: any) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    /**
     * Render 3D glasses model on detected face
     */
    private render3DModel(detection: any, video: HTMLVideoElement) {
        // Position glasses based on face landmarks
        const leftEye = detection.landmarks.getLeftEye()[3];
        const rightEye = detection.landmarks.getRightEye()[0];
        const noseBridge = detection.landmarks.getNose()[0];

        const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2),
        );

        const scale = eyeDistance / 150; // Calibration factor

        // Create glasses geometry (simple cube for demo)
        const glassesGeometry = new THREE.BoxGeometry(scale * 2, scale * 0.8, scale * 0.1);
        const glassesMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            shininess: 100,
        });

        const glasses = new THREE.Mesh(glassesGeometry, glassesMaterial);

        // Position glasses at face center
        glasses.position.x = (leftEye.x + rightEye.x) / 2 - 640; // Normalize to center
        glasses.position.y = -(noseBridge.y - 360); // Normalize and flip Y
        glasses.position.z = 0;

        // Clear previous glasses
        this.scene.children = this.scene.children.filter((child) => !(child instanceof THREE.Mesh));

        // Add new glasses
        this.scene.add(glasses);

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Capture and save try-on result
     */
    async captureTryon() {
        if (!this.selectedProductId || !this.faceDetected) {
            alert('Please select a product and ensure your face is detected');
            return;
        }

        this.isLoading = true;

        try {
            const video = this.videoRef.nativeElement;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            const cameraImage = tempCanvas.toDataURL('image/jpeg');

            // Detect face for detailed data
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();

            if (detections.length === 0) {
                alert('No face detected. Please try again.');
                return;
            }

            const detection = detections[0];

            // Send to backend
            const result = await this.tryonService.createTryon({
                productId: this.selectedProductId,
                cameraImage: cameraImage,
                faceDetectionData: {
                    faceBox: detection.detection.box,
                    landmarks: detection.landmarks.positions,
                    expressions: detection.expressions,
                    age: detection.age,
                    gender: detection.gender,
                },
                centreId: 'AUTO', // Will be set by backend
            });

            this.tryonResult = result;
            this.confidenceScore = result.confidenceScore;
            this.stopCamera();
        } catch (error) {
            console.error('Failed to create try-on:', error);
            alert('Failed to create try-on. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load product list
     */
    private loadProductList() {
        this.tryonService.getProducts().subscribe(
            (products) => {
                this.productList = products.filter(
                    (p) => p.type === 'GLASSES' || p.type === 'SUNGLASSES',
                );
            },
            (error) => {
                console.error('Failed to load products:', error);
            },
        );
    }

    /**
     * Stop camera
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
        }
        this.isCameraActive = false;
    }

    ngOnDestroy() {
        this.stopCamera();
    }
}
