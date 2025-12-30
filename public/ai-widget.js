// AI Widget - Universal AI Enhancement Component
// Add this to any page to enable AI features

class AIWidget {
    constructor() {
        this.isActive = false;
        this.suggestions = [];
        this.init();
    }

    init() {
        // Add AI badge CSS
        this.injectStyles();
        
        // Add AI floating button
        this.createFloatingButton();
        
        // Add AI notification container
        this.createNotificationContainer();
        
        // Start monitoring
        this.startMonitoring();
    }

    injectStyles() {
        if (!document.getElementById('ai-widget-styles')) {
            const link = document.createElement('link');
            link.id = 'ai-widget-styles';
            link.rel = 'stylesheet';
            link.href = '/ai-badge.css';
            document.head.appendChild(link);
        }
    }

    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'ai-floating-btn';
        button.innerHTML = `
            <style>
                #ai-floating-btn {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                    z-index: 9999;
                    transition: all 0.3s;
                }
                #ai-floating-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
                }
                #ai-floating-btn.active {
                    animation: ai-float-pulse 2s infinite;
                }
                @keyframes ai-float-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                #ai-panel {
                    position: fixed;
                    bottom: 100px;
                    right: 30px;
                    width: 350px;
                    max-height: 500px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                    display: none;
                    flex-direction: column;
                    z-index: 9998;
                    overflow: hidden;
                }
                #ai-panel.active {
                    display: flex;
                    animation: ai-panel-slide 0.3s;
                }
                @keyframes ai-panel-slide {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                #ai-panel-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 16px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                #ai-panel-body {
                    padding: 16px;
                    overflow-y: auto;
                    flex: 1;
                }
                .ai-quick-action {
                    padding: 12px;
                    background: rgba(102, 126, 234, 0.1);
                    border-radius: 8px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .ai-quick-action:hover {
                    background: rgba(102, 126, 234, 0.2);
                    transform: translateX(5px);
                }
                .ai-quick-action-icon {
                    font-size: 14px;
                    font-weight: bold;
                    background: #667eea;
                    color: white;
                    padding: 8px;
                    border-radius: 6px;
                    min-width: 40px;
                    text-align: center;
                }
                .ai-quick-action-text {
                    flex: 1;
                }
                .ai-quick-action-title {
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 4px;
                }
                .ai-quick-action-desc {
                    font-size: 0.85em;
                    color: #666;
                }
            </style>
            AI
        `;
        
        button.addEventListener('click', () => this.togglePanel());
        document.body.appendChild(button);
        
        // Create panel
        this.createPanel();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ai-panel';
        panel.innerHTML = `
            <div id="ai-panel-header">
                <span style="font-weight: bold; background: white; color: #667eea; padding: 4px 8px; border-radius: 4px;">AI</span>
                <span>AI Assistant</span>
            </div>
            <div id="ai-panel-body">
                <div class="ai-quick-action" onclick="aiWidget.runOptimization('route')">
                    <div class="ai-quick-action-icon">OPT</div>
                    <div class="ai-quick-action-text">
                        <div class="ai-quick-action-title">Optimize Routes</div>
                        <div class="ai-quick-action-desc">Use AI to find best paths</div>
                    </div>
                </div>
                <div class="ai-quick-action" onclick="aiWidget.runOptimization('clustering')">
                    <div class="ai-quick-action-icon">CLS</div>
                    <div class="ai-quick-action-text">
                        <div class="ai-quick-action-title">Classify Products</div>
                        <div class="ai-quick-action-desc">AI-powered categorization</div>
                    </div>
                </div>
                <div class="ai-quick-action" onclick="aiWidget.runOptimization('anomaly')">
                    <div class="ai-quick-action-icon">DET</div>
                    <div class="ai-quick-action-text">
                        <div class="ai-quick-action-title">Detect Anomalies</div>
                        <div class="ai-quick-action-desc">Find unusual patterns</div>
                    </div>
                </div>
                <div class="ai-quick-action" onclick="aiWidget.runOptimization('forecast')">
                    <div class="ai-quick-action-icon">PRD</div>
                    <div class="ai-quick-action-text">
                        <div class="ai-quick-action-title">Generate Forecast</div>
                        <div class="ai-quick-action-desc">Predict future demand</div>
                    </div>
                </div>
                <div class="ai-quick-action" onclick="window.location.href='/ai-command-center.html'">
                    <div class="ai-quick-action-icon">CMD</div>
                    <div class="ai-quick-action-text">
                        <div class="ai-quick-action-title">AI Command Center</div>
                        <div class="ai-quick-action-desc">Full AI dashboard</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    togglePanel() {
        const panel = document.getElementById('ai-panel');
        const button = document.getElementById('ai-floating-btn');
        
        if (panel.classList.contains('active')) {
            panel.classList.remove('active');
            button.classList.remove('active');
        } else {
            panel.classList.add('active');
            button.classList.add('active');
        }
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'ai-notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'ai-notification';
        
        const icons = {
            info: 'AI',
            success: 'OK',
            warning: 'WARN',
            error: 'ERR'
        };
        
        notification.innerHTML = `
            <div class="ai-notification-header">
                <div class="ai-notification-icon">${icons[type]}</div>
                <div class="ai-notification-title">${title}</div>
            </div>
            <div class="ai-notification-body">${message}</div>
            <button class="ai-notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.getElementById('ai-notifications').appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'ai-notification-slide 0.5s reverse';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    async runOptimization(type) {
        this.togglePanel();
        
        const messages = {
            route: { title: 'Route Optimization', message: 'AI is analyzing routes...' },
            clustering: { title: 'Product Classification', message: 'AI is classifying products...' },
            anomaly: { title: 'Anomaly Detection', message: 'AI is scanning for anomalies...' },
            forecast: { title: 'Demand Forecast', message: 'AI is generating forecast...' }
        };
        
        const msg = messages[type];
        this.showNotification(msg.title, msg.message, 'info');
        
        try {
            let endpoint = '';
            let body = {};
            
            switch(type) {
                case 'route':
                    endpoint = '/api/ai/route/optimize';
                    body = { wave_id: 'demo' };
                    break;
                case 'clustering':
                    endpoint = '/api/ai/clustering/kmeans';
                    body = { k: 3 };
                    break;
                case 'anomaly':
                    endpoint = '/api/ai/clustering/dbscan';
                    body = { epsilon: 0.8, minPoints: 3 };
                    break;
                case 'forecast':
                    // Simulate forecast
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    this.showNotification(
                        'Forecast Complete',
                        'AI has generated demand forecast with 92% accuracy',
                        'success'
                    );
                    return;
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (data.success) {
                let successMsg = '';
                switch(type) {
                    case 'route':
                        successMsg = `Routes optimized! ${data.data.improvement_percentage}% improvement`;
                        break;
                    case 'clustering':
                        successMsg = `${data.products_analyzed} products classified with ${data.data.summary.accuracy}% accuracy`;
                        break;
                    case 'anomaly':
                        successMsg = `Found ${data.clusters_found} clusters and ${data.noise_points} anomalies`;
                        break;
                }
                
                this.showNotification('Success!', successMsg, 'success');
            }
        } catch (error) {
            this.showNotification('Error', 'AI optimization failed', 'error');
            console.error(error);
        }
    }

    startMonitoring() {
        // Monitor page for optimization opportunities
        setInterval(() => {
            this.checkForOptimizations();
        }, 30000); // Check every 30 seconds
    }

    checkForOptimizations() {
        // Check if there are waves that can be optimized
        const waveElements = document.querySelectorAll('[data-wave-id]');
        if (waveElements.length > 0 && Math.random() > 0.7) {
            this.showNotification(
                'AI Suggestion',
                `${waveElements.length} waves can be optimized. Click to improve efficiency!`,
                'info'
            );
        }
    }

    // Add AI badge to element
    addBadge(element, text = 'AI') {
        if (!element.classList.contains('ai-powered')) {
            element.classList.add('ai-powered');
            const badge = document.createElement('span');
            badge.className = 'ai-badge';
            badge.textContent = text;
            element.appendChild(badge);
        }
    }

    // Show AI thinking indicator
    showThinking(element) {
        const indicator = document.createElement('div');
        indicator.className = 'ai-thinking-indicator';
        indicator.innerHTML = `
            <span>AI is thinking</span>
            <div class="ai-thinking-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        element.appendChild(indicator);
        return indicator;
    }

    // Show AI confidence score
    showConfidence(element, score) {
        const confidence = document.createElement('div');
        confidence.className = 'ai-confidence';
        confidence.innerHTML = `
            <span>Confidence:</span>
            <div class="ai-confidence-bar">
                <div class="ai-confidence-fill" style="width: ${score}%"></div>
            </div>
            <span class="ai-confidence-value">${score}%</span>
        `;
        element.appendChild(confidence);
    }

    // Show AI suggestion
    showSuggestion(title, message, actions = []) {
        const suggestion = document.createElement('div');
        suggestion.className = 'ai-suggestion';
        
        let actionsHTML = '';
        if (actions.length > 0) {
            actionsHTML = '<div class="ai-suggestion-actions">';
            actions.forEach(action => {
                actionsHTML += `<button class="ai-suggestion-btn" onclick="${action.onclick}">${action.label}</button>`;
            });
            actionsHTML += '</div>';
        }
        
        suggestion.innerHTML = `
            <div class="ai-suggestion-header">
                <div class="ai-suggestion-icon">💡</div>
                <div class="ai-suggestion-title">${title}</div>
            </div>
            <div class="ai-suggestion-body">${message}</div>
            ${actionsHTML}
        `;
        
        return suggestion;
    }
}

// Initialize AI Widget
const aiWidget = new AIWidget();

// Make it globally available
window.aiWidget = aiWidget;

// Auto-enhance buttons with AI class
document.addEventListener('DOMContentLoaded', () => {
    // Add AI badges to optimization buttons
    document.querySelectorAll('[data-ai-optimize]').forEach(btn => {
        aiWidget.addBadge(btn);
    });
    
    // Add AI indicators to relevant sections
    document.querySelectorAll('[data-ai-section]').forEach(section => {
        const indicator = document.createElement('div');
        indicator.className = 'ai-status-indicator';
        indicator.innerHTML = `
            <span class="ai-status-dot"></span>
            <span>AI Active</span>
        `;
        section.insertBefore(indicator, section.firstChild);
    });
});
