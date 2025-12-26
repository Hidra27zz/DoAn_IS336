// Firebase Admin SDK Configuration for WMS (Server-side)
// Project: erpproject-609fd
const admin = require('firebase-admin');
const LocalDB = require('../database/local-db');

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
let useLocalDB = false;
let localDB = null;

// Try to initialize Firebase Admin
try {
  if (!admin.apps.length) {
    // Check if service account file exists
    const fs = require('fs');
    const path = require('path');
    
    const possibleFiles = [
      'erpproject-609fd-firebase-adminsdk-fbsvc-4a706a53fe.json',
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
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId
      });
      console.log('✅ Firebase Admin initialized with service account');
      db = admin.firestore();
      initialized = true;
    } else {
      throw new Error('Service account not found');
    }
  }
} catch (error) {
  console.log('⚠️ Firebase Admin initialization failed, will use local database:', error.message);
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
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.create(collectionName, data);
    }
    if (!db) throw new Error('Database not initialized');
    const docRef = await db.collection(collectionName).add({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...data };
  },

  async get(collectionName, id) {
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.get(collectionName, id);
    }
    if (!db) throw new Error('Database not initialized');
    const doc = await db.collection(collectionName).doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async getAll(collectionName, filters = []) {
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.getAll(collectionName, filters);
    }
    if (!db) throw new Error('Database not initialized');
    
    try {
      let query = db.collection(collectionName);
      filters.forEach(f => {
        query = query.where(f.field, f.op, f.value);
      });
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // If Firebase fails, switch to local DB
      console.log('⚠️ Firebase query failed, switching to local database');
      useLocalDB = true;
      if (!localDB) localDB = new LocalDB();
      return await localDB.getAll(collectionName, filters);
    }
  },

  async update(collectionName, id, data) {
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.update(collectionName, id, data);
    }
    if (!db) throw new Error('Database not initialized');
    await db.collection(collectionName).doc(id).update({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id, ...data };
  },

  async delete(collectionName, id) {
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.delete(collectionName, id);
    }
    if (!db) throw new Error('Database not initialized');
    await db.collection(collectionName).doc(id).delete();
    return { id };
  },

  async query(collectionName, conditions = [], orderByField = null, limitCount = 100) {
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.query(collectionName, conditions, orderByField, limitCount);
    }
    if (!db) throw new Error('Database not initialized');
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
    if (useLocalDB) {
      if (!localDB) localDB = new LocalDB();
      return await localDB.batch(operations);
    }
    if (!db) throw new Error('Database not initialized');
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

module.exports = { 
  admin, 
  db, 
  COLLECTIONS, 
  FirebaseDB, 
  firebaseConfig, 
  initialized, 
  useLocalDB,
  setUseLocalDB: (value) => { useLocalDB = value; }
};
