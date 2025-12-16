import { Component, Input, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeometryService } from '../../services/geometry.service';
import { AnimationService } from '../../services/animation.service';
import { SimpleMeasureResult, Pupils, FrameGeometry } from '../../models';

@Component({
    selector: 'app-analysis-preview',
    templateUrl: './analysis-preview.component.html',
    styleUrls: ['./analysis-preview.component.scss'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class AnalysisPreviewComponent implements OnInit, OnChanges {
    @Input() data!: { dataUrl: string; pupils?: Pupils; frameGeom?: FrameGeometry; };
    @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

    public measures?: SimpleMeasureResult;
    public frameWidthMM = 140; // default, editable by user (should come from fiche monture)
    public topGlassYpx = 0;
    public bottomGlassYpx = 0;
    public leftCenterXpx = 0;
    public rightCenterXpx = 0;
    public animUrl?: string;

    constructor(private geom: GeometryService, private anim: AnimationService) { }

    ngOnInit() {
        if (this.data) this.drawPreview();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['data'] && this.data) {
            this.drawPreview();
        }
    }

    async drawPreview() {
        if (!this.canvasRef) return;
        const canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
        const img = new Image();
        img.src = this.data.dataUrl;
        await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        // draw pupils
        if (this.data.pupils) {
            const L = this.data.pupils.left, R = this.data.pupils.right;
            ctx.fillStyle = 'rgba(0,200,0,0.9)';
            ctx.beginPath(); ctx.arc(L.x, L.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(R.x, R.y, 6, 0, Math.PI * 2); ctx.fill();
        }
        // draw frame edges if any
        if (this.data.frameGeom) {
            const fg = this.data.frameGeom;
            ctx.strokeStyle = 'rgba(0,0,255,0.9)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(fg.leftPx, 0); ctx.lineTo(fg.leftPx, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fg.rightPx, 0); ctx.lineTo(fg.rightPx, canvas.height); ctx.stroke();
            // default bottomGlassY ~ 0.75 height if not already set
            if (!this.bottomGlassYpx) {
                this.bottomGlassYpx = Math.round(canvas.height * 0.72);
            }
            // default topGlassY ~ 0.25 height if not already set
            if (!this.topGlassYpx) {
                this.topGlassYpx = Math.round(canvas.height * 0.35); // Approx defaults
            }

            // Draw Top Line (Red)
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, this.topGlassYpx); ctx.lineTo(canvas.width, this.topGlassYpx); ctx.stroke();

            // Draw Bottom Line (Red)
            ctx.beginPath(); ctx.moveTo(0, this.bottomGlassYpx); ctx.lineTo(canvas.width, this.bottomGlassYpx); ctx.stroke();

            // centers approximated as quarter points inside frame if not set
            if (!this.leftCenterXpx) this.leftCenterXpx = fg.leftPx + (fg.rightPx - fg.leftPx) * 0.25;
            if (!this.rightCenterXpx) this.rightCenterXpx = fg.leftPx + (fg.rightPx - fg.leftPx) * 0.75;

            ctx.fillStyle = 'rgba(255,0,255,0.9)';
            ctx.fillRect(this.leftCenterXpx - 4, this.bottomGlassYpx - 4, 8, 8);
            ctx.fillRect(this.rightCenterXpx - 4, this.bottomGlassYpx - 4, 8, 8);
        }
        // compute now measures if we have pupils & frame
        if (this.data.pupils && this.data.frameGeom) {
            this.measures = this.geom.computeMeasures(this.data.pupils, this.data.frameGeom, this.frameWidthMM, this.bottomGlassYpx, this.leftCenterXpx, this.rightCenterXpx, this.topGlassYpx);
        }
    }

    // allow manual adjust of bottomGlassYpx via up/down
    adjustBottomGlass(delta: number) { this.bottomGlassYpx += delta; this.drawPreview(); }

    // allow manual adjust of topGlassYpx via up/down
    adjustTopGlass(delta: number) { this.topGlassYpx += delta; this.drawPreview(); }

    async generateAnimation() {
        // create an offscreen base canvas we can pass to animator
        const base = document.createElement('canvas');
        const c = this.canvasRef.nativeElement as HTMLCanvasElement;
        base.width = c.width; base.height = c.height;
        const ctx = base.getContext('2d')!;
        const img = new Image(); img.src = this.data.dataUrl; await new Promise(r => img.onload = r);
        // recreate composition similar to preview
        ctx.drawImage(img, 0, 0);
        if (this.data.frameGeom && this.leftCenterXpx && this.rightCenterXpx) {
            // optionally draw a frame overlay simple rectangle
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
            ctx.strokeRect(this.data.frameGeom.leftPx, this.bottomGlassYpx - (base.height * 0.28), this.data.frameGeom.widthPx as number, base.height * 0.56);
        }
        const blob = await this.anim.createAnimationFromCanvas(base, 2);
        const url = URL.createObjectURL(blob);
        this.animUrl = url;
        // optional: upload blob to server here
    }
}
