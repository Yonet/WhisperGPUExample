export interface ProgressProps {
    file?: string;
    text?: string;
    progress?: number;
    percentage?: number;
    total?: number;
}

function formatBytes(size: number): string {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return +((size / Math.pow(1024, i)).toFixed(2)) * 1 + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

export class Progress {
    private element: HTMLDivElement;
    private props: ProgressProps;

    constructor(props: ProgressProps) {
        this.props = props;
        this.element = this.createElement();
    }

    private createElement(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = 'progress-bar-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        const percentage = this.props.percentage || this.props.progress || 0;
        progressBar.style.width = `${percentage}%`;

        const displayText = this.props.text || this.props.file || '';
        const text = `${displayText} (${percentage.toFixed(2)}%${
            isNaN(this.props.total ?? NaN) ? '' : ` of ${formatBytes(this.props.total!)}`
        })`;
        progressBar.textContent = text;

        container.appendChild(progressBar);
        return container;
    }

    update(props: Partial<ProgressProps>): void {
        this.props = { ...this.props, ...props };
        const progressBar = this.element.firstChild as HTMLDivElement;
        if (progressBar) {
            const percentage = this.props.percentage || this.props.progress || 0;
            progressBar.style.width = `${percentage}%`;
            const displayText = this.props.text || this.props.file || '';
            const text = `${displayText} (${percentage.toFixed(2)}%${
                isNaN(this.props.total ?? NaN) ? '' : ` of ${formatBytes(this.props.total!)}`
            })`;
            progressBar.textContent = text;
        }
    }

    getElement(): HTMLDivElement {
        return this.element;
    }

    remove(): void {
        this.element.remove();
    }
}
