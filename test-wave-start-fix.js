// Test script to verify wave start fix
const { getDatabase } = require('./config/database');

async function testWaveStartFix() {
  console.log('🧪 Testing Wave Start Fix...');
  
  const db = await getDatabase();
  
  try {
    // Test the fixed logic for wave 33168
    const waveId = '33168';
    
    console.log(`\n1. Testing wave lookup for ID: ${waveId}`);
    
    // Simulate the fixed logic
    let wave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE wave_number = ?
      LIMIT 1
    `, [waveId]);
    
    console.log('   By wave_number:', wave);
    
    if (!wave) {
      wave = await db.get(`
        SELECT wave_number, status FROM picking_tasks 
        WHERE id = ?
        LIMIT 1
      `, [waveId]);
      console.log('   By task id:', wave);
    }
    
    console.log(`   Final result: Wave ${wave.wave_number} has status '${wave.status}'`);
    
    // Check if wave can be started
    if (wave.status === 'in_progress') {
      console.log('   ❌ ERROR: Wave is already in progress (this was the bug!)');
    } else if (wave.status === 'completed') {
      console.log('   ❌ ERROR: Wave is already completed');
    } else if (wave.status === 'pending' || wave.status === 'created') {
      console.log('   ✅ SUCCESS: Wave can be started');
    } else {
      console.log(`   ⚠️  UNKNOWN: Wave has status '${wave.status}'`);
    }
    
    // Test the old logic to show the difference
    console.log('\n2. Testing old logic (for comparison):');
    const oldWave = await db.get(`
      SELECT wave_number, status FROM picking_tasks 
      WHERE id = ? OR wave_number = ?
      LIMIT 1
    `, [waveId, waveId]);
    
    console.log('   Old logic result:', oldWave);
    
    if (oldWave.status === 'in_progress') {
      console.log('   ❌ OLD BUG: Would return "Wave is already in progress" error');
    }
    
    // Show all records that match the ID
    console.log('\n3. All records matching ID 33168:');
    const allMatches = await db.all(`
      SELECT id, wave_number, status, 'by_id' as match_type FROM picking_tasks WHERE id = ?
      UNION ALL
      SELECT MIN(id) as id, wave_number, status, 'by_wave_number' as match_type FROM picking_tasks WHERE wave_number = ? GROUP BY wave_number
    `, [waveId, waveId]);
    
    console.table(allMatches);
    
    console.log('\n✅ Wave start fix test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWaveStartFix().catch(console.error);