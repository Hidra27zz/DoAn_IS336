// Inventory Reservation Service
const { getDatabase } = require('../config/database');

class InventoryReservationService {
  constructor() {
    this.reservationTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
  }

  /**
   * Reserve inventory for picking tasks
   * @param {Array} tasks - Array of picking tasks
   * @returns {Object} Reservation result
   */
  async reserveInventory(tasks) {
    const db = await getDatabase();
    const reservations = [];
    const failures = [];

    try {
      await db.run('BEGIN TRANSACTION');

      for (const task of tasks) {
        try {
          // Check current inventory
          const inventory = await db.get(`
            SELECT quantity, reserved_quantity 
            FROM inventory 
            WHERE product_reference = ? AND location_code = ?
          `, [task.product_reference, task.location_code]);

          if (!inventory) {
            failures.push({
              task_id: task.id,
              product_reference: task.product_reference,
              location_code: task.location_code,
              error: 'Inventory record not found'
            });
            continue;
          }

          const available = inventory.quantity - inventory.reserved_quantity;
          
          if (available < task.quantity_to_pick) {
            failures.push({
              task_id: task.id,
              product_reference: task.product_reference,
              location_code: task.location_code,
              required: task.quantity_to_pick,
              available: available,
              error: 'Insufficient inventory'
            });
            continue;
          }

          // Reserve inventory
          await db.run(`
            UPDATE inventory 
            SET reserved_quantity = reserved_quantity + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_reference = ? AND location_code = ?
          `, [task.quantity_to_pick, task.product_reference, task.location_code]);

          reservations.push({
            task_id: task.id,
            product_reference: task.product_reference,
            location_code: task.location_code,
            quantity_reserved: task.quantity_to_pick,
            reserved_at: new Date().toISOString()
          });

        } catch (taskError) {
          failures.push({
            task_id: task.id,
            product_reference: task.product_reference,
            location_code: task.location_code,
            error: taskError.message
          });
        }
      }

      if (failures.length > 0) {
        await db.run('ROLLBACK');
        return {
          success: false,
          reservations: [],
          failures: failures,
          message: 'Some inventory reservations failed'
        };
      }

      await db.run('COMMIT');

      return {
        success: true,
        reservations: reservations,
        failures: [],
        message: 'All inventory reserved successfully'
      };

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Release inventory reservations
   * @param {Array} reservations - Array of reservations to release
   * @returns {Object} Release result
   */
  async releaseReservations(reservations) {
    const db = await getDatabase();
    const released = [];
    const failures = [];

    try {
      await db.run('BEGIN TRANSACTION');

      for (const reservation of reservations) {
        try {
          // Release reservation
          const result = await db.run(`
            UPDATE inventory 
            SET reserved_quantity = reserved_quantity - ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_reference = ? AND location_code = ? AND reserved_quantity >= ?
          `, [
            reservation.quantity_reserved,
            reservation.product_reference,
            reservation.location_code,
            reservation.quantity_reserved
          ]);

          if (result.changes === 0) {
            failures.push({
              ...reservation,
              error: 'Reservation not found or insufficient reserved quantity'
            });
          } else {
            released.push({
              ...reservation,
              released_at: new Date().toISOString()
            });
          }

        } catch (reservationError) {
          failures.push({
            ...reservation,
            error: reservationError.message
          });
        }
      }

      await db.run('COMMIT');

      return {
        success: failures.length === 0,
        released: released,
        failures: failures,
        message: failures.length === 0 ? 'All reservations released' : 'Some reservations failed to release'
      };

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get expired reservations (for cleanup)
   * @returns {Array} Expired reservations
   */
  async getExpiredReservations() {
    const db = await getDatabase();
    
    // This would require a reservations table to track reservation timestamps
    // For now, we'll return empty array as this is a future enhancement
    return [];
  }

  /**
   * Cleanup expired reservations
   * @returns {Object} Cleanup result
   */
  async cleanupExpiredReservations() {
    const expiredReservations = await this.getExpiredReservations();
    
    if (expiredReservations.length === 0) {
      return {
        success: true,
        cleaned: 0,
        message: 'No expired reservations found'
      };
    }

    const result = await this.releaseReservations(expiredReservations);
    
    return {
      success: result.success,
      cleaned: result.released.length,
      failures: result.failures.length,
      message: `Cleaned ${result.released.length} expired reservations`
    };
  }

  /**
   * Check inventory availability for multiple products
   * @param {Array} requirements - Array of {product_reference, location_code, quantity}
   * @returns {Object} Availability check result
   */
  async checkAvailability(requirements) {
    const db = await getDatabase();
    const available = [];
    const unavailable = [];

    for (const req of requirements) {
      try {
        const inventory = await db.get(`
          SELECT 
            quantity, 
            reserved_quantity,
            (quantity - reserved_quantity) as available_quantity
          FROM inventory 
          WHERE product_reference = ? AND location_code = ?
        `, [req.product_reference, req.location_code]);

        if (!inventory) {
          unavailable.push({
            ...req,
            available_quantity: 0,
            reason: 'Product not found at location'
          });
        } else if (inventory.available_quantity < req.quantity) {
          unavailable.push({
            ...req,
            available_quantity: inventory.available_quantity,
            reason: 'Insufficient quantity'
          });
        } else {
          available.push({
            ...req,
            available_quantity: inventory.available_quantity,
            total_quantity: inventory.quantity,
            reserved_quantity: inventory.reserved_quantity
          });
        }

      } catch (error) {
        unavailable.push({
          ...req,
          available_quantity: 0,
          reason: error.message
        });
      }
    }

    return {
      success: unavailable.length === 0,
      available: available,
      unavailable: unavailable,
      total_checked: requirements.length
    };
  }

  /**
   * Get inventory reservation summary
   * @returns {Object} Reservation summary
   */
  async getReservationSummary() {
    const db = await getDatabase();

    try {
      const summary = await db.get(`
        SELECT 
          COUNT(*) as total_locations,
          SUM(quantity) as total_quantity,
          SUM(reserved_quantity) as total_reserved,
          SUM(quantity - reserved_quantity) as total_available,
          AVG(CASE WHEN quantity > 0 THEN (reserved_quantity * 100.0 / quantity) ELSE 0 END) as avg_reservation_percentage
        FROM inventory
        WHERE quantity > 0
      `);

      const topReserved = await db.all(`
        SELECT 
          i.product_reference,
          i.location_code,
          i.quantity,
          i.reserved_quantity,
          (i.reserved_quantity * 100.0 / i.quantity) as reservation_percentage,
          p.description
        FROM inventory i
        LEFT JOIN products p ON i.product_reference = p.reference
        WHERE i.reserved_quantity > 0
        ORDER BY i.reserved_quantity DESC
        LIMIT 10
      `);

      return {
        success: true,
        summary: {
          total_locations: summary.total_locations || 0,
          total_quantity: summary.total_quantity || 0,
          total_reserved: summary.total_reserved || 0,
          total_available: summary.total_available || 0,
          average_reservation_percentage: Math.round((summary.avg_reservation_percentage || 0) * 100) / 100
        },
        top_reserved_items: topReserved
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InventoryReservationService;