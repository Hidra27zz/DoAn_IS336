// Firebase Client-side Service Helper (using compat API)
// Firebase loaded via CDN, no imports needed

// Firestore Operations
export const FirebaseService = {
  // Create document
  async create(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  // Get single document
  async get(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  // Get all documents with optional filters
  async getAll(collectionName, filters = []) {
    try {
      let q = collection(db, collectionName);
      
      if (filters.length > 0) {
        const conditions = filters.map(f => where(f.field, f.op, f.value));
        q = query(q, ...conditions);
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  },

  // Update document
  async update(collectionName, id, data) {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp()
      });
      return { id, ...data };
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  // Delete document
  async delete(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      return { id };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Query with conditions, ordering, and limit
  async query(collectionName, conditions = [], orderByField = null, limitCount = 100) {
    try {
      let q = collection(db, collectionName);
      
      // Add where conditions
      if (conditions.length > 0) {
        const whereConditions = conditions.map(c => where(c.field, c.op, c.value));
        q = query(q, ...whereConditions);
      }
      
      // Add ordering
      if (orderByField) {
        q = query(q, orderBy(orderByField.field, orderByField.direction || 'asc'));
      }
      
      // Add limit
      q = query(q, limit(limitCount));
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error querying documents:', error);
      throw error;
    }
  },

  // Batch operations
  async batch(operations) {
    try {
      const batch = writeBatch(db);
      
      operations.forEach(op => {
        const docRef = op.id 
          ? doc(db, op.collection, op.id)
          : doc(collection(db, op.collection));
          
        if (op.type === 'set') {
          batch.set(docRef, { ...op.data, updated_at: serverTimestamp() });
        }
        if (op.type === 'update') {
          batch.update(docRef, { ...op.data, updated_at: serverTimestamp() });
        }
        if (op.type === 'delete') {
          batch.delete(docRef);
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error in batch operation:', error);
      throw error;
    }
  }
};

// Authentication Operations
export const AuthService = {
  // Sign in
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign up
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Listen to auth state changes
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  }
};

// Export collections for easy access
export { COLLECTIONS };