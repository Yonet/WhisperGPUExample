import { App } from './App';
import './index.css';

const container = document.getElementById('app') as HTMLDivElement;
if (!container) {
    throw new Error('App container not found');
}

const app = new App(container);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    app.destroy();
});
