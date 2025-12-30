// AI Assistant Widget - Tự động nhúng vào mọi trang
// Thêm script này vào tất cả các trang HTML để có AI assistant

(function() {
  'use strict';

  // Define global fallback functions immediately
  window.toggleAI = window.toggleAI || function() {
    console.log('toggleAI called before widget loaded');
    const widget = document.getElementById('ai-assistant-widget');
    if (widget) {
      widget.classList.toggle('minimized');
    }
  };

  window.refreshAI = window.refreshAI || function() {
    console.log('refreshAI called before widget loaded');
  };

  window.initAI = window.initAI || function() {
    console.log('initAI called before widget loaded');
  };

  // Tạo container cho AI widget
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'ai-widget-container';
  
  // Load AI widget HTML
  fetch('/ai-assistant-widget.html')
    .then(response => response.text())
    .then(html => {
      // Extract body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const widgetHTML = doc.body.innerHTML;
      
      widgetContainer.innerHTML = widgetHTML;
      document.body.appendChild(widgetContainer);
      
      // Execute scripts
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
      });
      
      // Load styles
      const styles = doc.querySelectorAll('style');
      styles.forEach(style => {
        const newStyle = document.createElement('style');
        newStyle.textContent = style.textContent;
        document.head.appendChild(newStyle);
      });
      
      console.log('AI widget loaded successfully');
    })
    .catch(error => {
      console.error('Failed to load AI widget:', error);
    });
})();
