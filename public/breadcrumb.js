// Breadcrumb Component
// Displays navigation path and provides easy navigation

class BreadcrumbManager {
  constructor(containerId = 'breadcrumb-container') {
    this.containerId = containerId;
    this.init();
  }

  init() {
    this.render();
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const breadcrumb = this.getBreadcrumb();
    if (breadcrumb.length <= 1) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = this.generateHTML(breadcrumb);
  }

  getBreadcrumb() {
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    
    const breadcrumbMap = {
      // Main pages
      'index.html': [
        { name: 'Home', url: '/', current: true }
      ],
      
      // Warehouse hierarchy
      'warehouse-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'Warehouse Management', url: 'warehouse-dashboard.html', current: true }
      ],
      'warehouse-2d-storage.html': [
        { name: 'Home', url: '/' },
        { name: 'Warehouse', url: 'warehouse-dashboard.html' },
        { name: '2D Storage Map', url: 'warehouse-2d-storage.html', current: true }
      ],
      'warehouse-svg-layout.html': [
        { name: 'Home', url: '/' },
        { name: 'Warehouse', url: 'warehouse-dashboard.html' },
        { name: 'SVG Layout', url: 'warehouse-svg-layout.html', current: true }
      ],
      'warehouse-3d-viewer.html': [
        { name: 'Home', url: '/' },
        { name: 'Warehouse', url: 'warehouse-dashboard.html' },
        { name: '3D Viewer', url: 'warehouse-3d-viewer.html', current: true }
      ],
      
      // AI hierarchy
      'ai-warehouse-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'AI Optimization', url: 'ai-warehouse-dashboard.html', current: true }
      ],
      'ai-route-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'AI Optimization', url: 'ai-warehouse-dashboard.html' },
        { name: 'Route Optimization', url: 'ai-route-dashboard.html', current: true }
      ],
      'ai-slotting-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'AI Optimization', url: 'ai-warehouse-dashboard.html' },
        { name: 'Slotting Optimization', url: 'ai-slotting-dashboard.html', current: true }
      ],
      'ai-optimization-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'AI Optimization', url: 'ai-warehouse-dashboard.html' },
        { name: 'Optimization Dashboard', url: 'ai-optimization-dashboard.html', current: true }
      ],
      'ai-demo.html': [
        { name: 'Home', url: '/' },
        { name: 'AI Optimization', url: 'ai-warehouse-dashboard.html' },
        { name: 'AI Demo', url: 'ai-demo.html', current: true }
      ],
      
      // Research hierarchy
      'main-research.html': [
        { name: 'Home', url: '/' },
        { name: 'Research', url: 'main-research.html', current: true }
      ],
      'research-dashboard.html': [
        { name: 'Home', url: '/' },
        { name: 'Research', url: 'main-research.html' },
        { name: 'Dashboard', url: 'research-dashboard.html', current: true }
      ]
    };

    return breadcrumbMap[currentFile] || [{ name: 'Home', url: '/', current: true }];
  }

  generateHTML(breadcrumb) {
    const items = breadcrumb.map((item, index) => {
      const isLast = index === breadcrumb.length - 1;
      const separator = index > 0 ? '<span class="breadcrumb-separator">›</span>' : '';
      
      if (isLast || item.current) {
        return `${separator}<span class="breadcrumb-current">${item.name}</span>`;
      } else {
        return `${separator}<a href="${item.url}" class="breadcrumb-link">${item.name}</a>`;
      }
    }).join('');

    return `
      <nav class="breadcrumb-nav">
        ${items}
      </nav>
    `;
  }

  // Add CSS styles
  addStyles() {
    if (document.getElementById('breadcrumb-styles')) return;

    const style = document.createElement('style');
    style.id = 'breadcrumb-styles';
    style.textContent = `
      .breadcrumb-nav {
        padding: 8px 0;
        font-size: 0.85em;
        color: #666;
        margin-bottom: 10px;
      }
      
      .breadcrumb-link {
        color: #007bff;
        text-decoration: none;
        transition: color 0.2s;
      }
      
      .breadcrumb-link:hover {
        color: #0056b3;
        text-decoration: underline;
      }
      
      .breadcrumb-current {
        color: #333;
        font-weight: 500;
      }
      
      .breadcrumb-separator {
        margin: 0 8px;
        color: #999;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  const breadcrumbManager = new BreadcrumbManager();
  breadcrumbManager.addStyles();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BreadcrumbManager };
}