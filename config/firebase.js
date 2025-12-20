// Firebase Admin SDK Configuration for WMS (Server-side)
// Project: erpproject-609fd
const admin = require('firebase-admin');

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBXpq1SOxybbvtrMQsgC1ytnZbWHeN5SFo",
  authDomain: "erpproject-609fd.firebaseapp.com",
  projectId: "erpproject-609fd",
  storageBucket: "erpproject-609fd.firebasestorage.app",
  messagingSenderId: "764709403858",
  appId: "1:764709403858:web:6350a4d3ac75af46ce810b",
  measurementId: "G-LMXV0EQXH4"
};

let db = null;
let initialized = false;

// Try to initialize Firebase Admin
try {
  if (!admin.apps.length) {
    // Check if service account file exists
    const fs = require('fs');
    const path = require('path');
    
    // Look for service account file with new project ID
    const possibleFiles = [
      'erpproject-609fd-firebase-adminsdk.json',
      'serviceAccountKey.json',
      'firebase-adminsdk.json'
    ];
    
    let serviceAccountPath = null;
    for (const file of possibleFiles) {
      const fullPath = path.join(__dirname, '..', file);
      if (fs.existsSync(fullPath)) {
        serviceAccountPath = fullPath;
        break;
      }
    }
    
    if (serviceAccountPath) {
      // Initialize with service account
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      // Initialize with just project ID (for environments with ADC)
      admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
      console.log('⚠️ Firebase Admin initialized without service account (limited functionality)');
    }
  }
  
  db = admin.firestore();
  initialized = true;
} catch (error) {
  console.log('⚠️ Firebase Admin initialization failed:', error.message);
  initialized = false;
}

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

const FirebaseDB = {
  async create(collectionName, data) {
    if (!db) throw new Error('Firebase not initialized');
    const docRef = await db.collection(collectionName).add({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...data };
  },

  async get(collectionName, id) {
    if (!db) throw new Error('Firebase not initialized');
    const doc = await db.collection(collectionName).doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async getAll(collectionName, filters = []) {
    if (!db) throw new Error('Firebase not initialized');
    let query = db.collection(collectionName);
    filters.forEach(f => {
      query = query.where(f.field, f.op, f.value);
    });
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async update(collectionName, id, data) {
    if (!db) throw new Error('Firebase not initialized');
    await db.collection(collectionName).doc(id).update({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id, ...data };
  },

  async delete(collectionName, id) {
    if (!db) throw new Error('Firebase not initialized');
    await db.collection(collectionName).doc(id).delete();
    return { id };
  },

  async query(collectionName, conditions = [], orderByField = null, limitCount = 100) {
    if (!db) throw new Error('Firebase not initialized');
    let query = db.collection(collectionName);
    conditions.forEach(c => {
      query = query.where(c.field, c.op, c.value);
    });
    if (orderByField) {
      query = query.orderBy(orderByField.field, orderByField.direction || 'asc');
    }
    query = query.limit(limitCount);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async batch(operations) {
    if (!db) throw new Error('Firebase not initialized');
    const batch = db.batch();
    operations.forEach(op => {
      const docRef = op.id 
        ? db.collection(op.collection).doc(op.id)
        : db.collection(op.collection).doc();
      if (op.type === 'set') {
        batch.set(docRef, { ...op.data, updated_at: admin.firestore.FieldValue.serverTimestamp() });
      }
      if (op.type === 'update') {
        batch.update(docRef, { ...op.data, updated_at: admin.firestore.FieldValue.serverTimestamp() });
      }
      if (op.type === 'delete') {
        batch.delete(docRef);
      }
    });
    await batch.commit();
  }
};

module.exports = { admin, db, COLLECTIONS, FirebaseDB, firebaseConfig, initialized };
