// Local File-based Database that mimics Firebase API
const fs = require('fs').promises;
const path = require('path');

class LocalDB {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.ensureDataDir();
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  getFilePath(collectionName) {
    return path.join(this.dataDir, `${collectionName}.json`);
  }

  async readCollection(collectionName) {
    try {
      const filePath = this.getFilePath(collectionName);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return empty array
      return [];
    }
  }

  async writeCollection(collectionName, data) {
    const filePath = this.getFilePath(collectionName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  generateId() {
    return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async create(collectionName, data) {
    const collection = await this.readCollection(collectionName);
    const id = this.generateId();
    const newDoc = {
      id,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    collection.push(newDoc);
    await this.writeCollection(collectionName, collection);
    return newDoc;
  }

  async get(collectionName, id) {
    const collection = await this.readCollection(collectionName);
    return collection.find(doc => doc.id === id) || null;
  }

  async getAll(collectionName, filters = []) {
    const collection = await this.readCollection(collectionName);
    
    if (filters.length === 0) {
      return collection;
    }

    return collection.filter(doc => {
      return filters.every(filter => {
        const { field, op, value } = filter;
        const docValue = doc[field];
        
        switch (op) {
          case '==':
            return docValue === value;
          case '!=':
            return docValue !== value;
          case '>':
            return docValue > value;
          case '>=':
            return docValue >= value;
          case '<':
            return docValue < value;
          case '<=':
            return docValue <= value;
          case 'array-contains':
            return Array.isArray(docValue) && docValue.includes(value);
          default:
            return true;
        }
      });
    });
  }

  async update(collectionName, id, data) {
    const collection = await this.readCollection(collectionName);
    const index = collection.findIndex(doc => doc.id === id);
    
    if (index === -1) {
      throw new Error(`Document with id ${id} not found in ${collectionName}`);
    }

    collection[index] = {
      ...collection[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    await this.writeCollection(collectionName, collection);
    return collection[index];
  }

  async delete(collectionName, id) {
    const collection = await this.readCollection(collectionName);
    const filteredCollection = collection.filter(doc => doc.id !== id);
    
    if (collection.length === filteredCollection.length) {
      throw new Error(`Document with id ${id} not found in ${collectionName}`);
    }

    await this.writeCollection(collectionName, filteredCollection);
    return { id };
  }

  async query(collectionName, conditions = [], orderByField = null, limitCount = 100) {
    let results = await this.getAll(collectionName, conditions);
    
    if (orderByField) {
      results.sort((a, b) => {
        const aVal = a[orderByField.field];
        const bVal = b[orderByField.field];
        
        if (orderByField.direction === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    return results.slice(0, limitCount);
  }

  async batch(operations) {
    // Process all operations
    for (const op of operations) {
      if (op.type === 'set') {
        if (op.id) {
          await this.update(op.collection, op.id, op.data);
        } else {
          await this.create(op.collection, op.data);
        }
      } else if (op.type === 'update') {
        await this.update(op.collection, op.id, op.data);
      } else if (op.type === 'delete') {
        await this.delete(op.collection, op.id);
      }
    }
  }
}

module.exports = LocalDB;