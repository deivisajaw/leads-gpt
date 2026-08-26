import {
    Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChild,
    ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core'; 

@Component({
    selector: 'app-video-modal',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    templateUrl: './video-modal.component.html',
    styleUrls: ['./video-modal.component.css']
})
export class VideoModalComponent implements OnChanges {
    @Input() showModal = false;
    @Input() videoUrl = '';
    @Output() close = new EventEmitter<void>();
    @Output() ctaClick = new EventEmitter<void>();

    @ViewChild('welcomeVideo') videoPlayer!: ElementRef<HTMLVideoElement>;
    isPlaying = false;

    ngOnChanges(changes: SimpleChanges): void {
     
        if (changes['showModal'] && !changes['showModal'].currentValue) {
            if (this.videoPlayer && this.videoPlayer.nativeElement) {
                this.videoPlayer.nativeElement.pause();
            }
            this.isPlaying = false;
        }
    }

    playVideo() {
        if (this.videoPlayer && this.videoPlayer.nativeElement) {
            this.videoPlayer.nativeElement.play();
            this.isPlaying = true;
        }
    }

    closeModal() {
        this.close.emit();
    }

    onCtaClick() {
        this.ctaClick.emit();
    }
}