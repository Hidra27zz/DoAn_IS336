// Navigation Helper Functions
// Manages page navigation and back button functionality

class NavigationManager {
  constructor() {
    this.init();
  }

  init() {
    // Store current page when navigating
    this.storePreviousPage();
    
    // Add navigation event listeners
    this.setupNavigationTracking();
  }

  storePreviousPage() {
    // Store the referrer as previous page if it exists and is from same origin
    if (document.referrer && document.referrer.includes(window.location.origin)) {
      const referrerPath = new URL(document.referrer).pathname;
      const currentPath = window.location.pathname;
      
      // Don't store if it's the same page
      if (referrerPath !== currentPath) {
        localStorage.setItem('previousPage', document.referrer);
      }
    }
  }

  setupNavigationTracking() {
    // Track clicks on navigation links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href], button[onclick*="location"]');
      if (link) {
        // Store current page before navigation
        localStorage.setItem('previousPage', window.location.href);
      }
    });
  }

  goBack() {
    // Priority 1: Browser history (if we have referrer and history)
    if (window.history.length > 1 && document.referrer && 
        document.referrer.includes(window.location.origin)) {
      window.history.back();
      return;
    }

    // Priority 2: Stored previous page
    const previousPage = localStorage.getItem('previousPage');
    if (previousPage && previousPage !== window.location.href) {
      const previousUrl = new URL(previousPage);
      // Make sure it's from same origin
      if (previousUrl.origin === window.location.origin) {
        window.location.href = previousPage;
        return;
      }
    }

    // Priority 3: Smart fallback based on current page
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop();
    let fallbackPage = '/';

    // Define navigation hierarchy for RESTful URLs
    const navigationMap = {
      // RESTful URL mappings
      '/products': '/dashboard',
      '/locations': '/dashboard', 
      '/inventory': '/dashboard',
      '/orders': '/dashboard',
      '/waves': '/dashboard',
      '/picking': '/dashboard',
      '/analytics': '/dashboard',
      
      // AI pages
      '/ai': '/dashboard',
      '/ai/comparison': '/ai',
      '/ai/slotting': '/ai',
      '/ai/routes': '/ai',
      
      // Warehouse visualization
      '/warehouse/2d': '/dashboard',
      '/warehouse/3d': '/dashboard',
      '/warehouse/layout': '/dashboard',
      '/warehouse/svg': '/dashboard',
      
      // Research & Demo
      '/research': '/dashboard',
      '/demo': '/dashboard',
      '/timeline': '/dashboard',
      
      // Legacy HTML file mappings (for backward compatibility)
      'warehouse-2d-storage.html': '/dashboard',
      'warehouse-svg-layout.html': '/dashboard', 
      'warehouse-3d-viewer.html': '/dashboard',
      'warehouse-3d-advanced.html': '/dashboard',
      'warehouse-layout-analysis.html': '/dashboard',
      'ai-route-dashboard.html': '/ai',
      'ai-slotting-dashboard.html': '/ai',
      'ai-optimization-dashboard.html': '/ai',
      'ai-demo.html': '/demo',
      'research-dashboard.html': '/research',
      'timeline-demo.html': '/timeline',
      'warehouse-dashboard.html': '/dashboard',
      'ai-warehouse-dashboard.html': '/ai'
    };

    // Check both current path and filename
    fallbackPage = navigationMap[currentPath] || navigationMap[currentFile] || '/';
    window.location.href = fallbackPage;
  }

  // Navigate to a page and store current page
  navigateTo(url) {
    localStorage.setItem('previousPage', window.location.href);
    window.location.href = url;
  }

  // Get breadcrumb path for RESTful URLs
  getBreadcrumb() {
    const currentPath = window.location.pathname;
    const breadcrumb = [{ name: 'Home', url: '/' }];

    const breadcrumbMap = {
      // Main sections
      '/dashboard': [
        { name: 'Dashboard', url: '/dashboard' }
      ],
      
      // WMS Core modules
      '/products': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Product Management', url: '/products' }
      ],
      '/locations': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Location Management', url: '/locations' }
      ],
      '/inventory': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Inventory Management', url: '/inventory' }
      ],
      '/orders': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Order Management', url: '/orders' }
      ],
      '/waves': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Wave Planning', url: '/waves' }
      ],
      '/picking': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Picking Operations', url: '/picking' }
      ],
      '/analytics': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Analytics', url: '/analytics' }
      ],
      
      // AI modules
      '/ai': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'AI Optimization', url: '/ai' }
      ],
      '/ai/comparison': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'AI Optimization', url: '/ai' },
        { name: 'AI vs Traditional', url: '/ai/comparison' }
      ],
      '/ai/slotting': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'AI Optimization', url: '/ai' },
        { name: 'Slotting AI', url: '/ai/slotting' }
      ],
      '/ai/routes': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'AI Optimization', url: '/ai' },
        { name: 'Route AI', url: '/ai/routes' }
      ],
      
      // Warehouse visualization
      '/warehouse/2d': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: '2D Storage Map', url: '/warehouse/2d' }
      ],
      '/warehouse/3d': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: '3D Warehouse Viewer', url: '/warehouse/3d' }
      ],
      '/warehouse/layout': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Layout Analysis', url: '/warehouse/layout' }
      ],
      '/warehouse/svg': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'SVG Layout', url: '/warehouse/svg' }
      ],
      
      // Research & Demo
      '/research': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Research', url: '/research' }
      ],
      '/demo': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'AI Demo', url: '/demo' }
      ],
      '/timeline': [
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Timeline Demo', url: '/timeline' }
      ]
    };

    const pageBreadcrumb = breadcrumbMap[currentPath] || [];
    return breadcrumb.concat(pageBreadcrumb);
  }
}

// Global navigation instance
const navigation = new NavigationManager();

// Global goBack function
function goBack() {
  navigation.goBack();
}

// Global navigate function
function navigateTo(url) {
  navigation.navigateTo(url);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NavigationManager, goBack, navigateTo };
}