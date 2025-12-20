// Firebase SDK Configuration for Client-side
// New Firebase project: erpproject-609fd

const firebaseConfig = {
  apiKey: "AIzaSyBXpq1SOxybbvtrMQsgC1ytnZbWHeN5SFo",
  authDomain: "erpproject-609fd.firebaseapp.com",
  projectId: "erpproject-609fd",
  storageBucket: "erpproject-609fd.firebasestorage.app",
  messagingSenderId: "764709403858",
  appId: "1:764709403858:web:6350a4d3ac75af46ce810b",
  measurementId: "G-LMXV0EQXH4"
};

// Initialize Firebase (check if already initialized)
let app, db, auth, storage, analytics;

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  
  // Initialize Firebase services
  db = firebase.firestore();
  auth = firebase.auth();
  
  // Storage and Analytics are optional
  try {
    storage = firebase.storage();
  } catch (e) {
    console.log('Firebase Storage not available');
  }
  
  try {
    analytics = firebase.analytics();
  } catch (e) {
    console.log('Firebase Analytics not available');
  }
}

// Collection names for consistency
const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  STORAGE_LOCATIONS: 'storage_locations',
  INVENTORY: 'inventory',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  PICKING_WAVES: 'picking_waves',
  PICKING_TASKS: 'picking_tasks',
  WAREHOUSE_MOVEMENTS: 'warehouse_movements',
  AI_CLUSTERS: 'ai_clusters',
  AI_OPTIMIZATIONS: 'ai_optimizations',
  SYSTEM_LOGS: 'system_logs'
};

// Export for module systems (if used)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { firebaseConfig, COLLECTIONS };
}
