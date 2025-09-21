const fetch = require('node-fetch');

async function testClientProgressAPI() {
  const testTokens = [
    'hCOtswIFRGBi3dZ0QGyQMKMeZTDUI0vn',
    'D6IS0rHTUmKKGud0F95ZHPET8I7bhDTo'
  ];

  for (const token of testTokens) {
    try {
      console.log(`\n🧪 Testing token: ${token}`);
      console.log(`📍 URL: http://localhost:3001/api/client-progress/${token}`);
      
      const response = await fetch(`http://localhost:3001/api/client-progress/${token}`);
      const data = await response.json();
      
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Response:`, JSON.stringify(data, null, 2));
      
      if (response.ok) {
        console.log('✅ API call successful');
        if (data.project) {
          console.log(`🏠 Project: ${data.project.name}`);
          console.log(`👤 Client: ${data.project.client.name}`);
          console.log(`🏢 Rooms: ${data.project.rooms.length}`);
          console.log(`🏗️  Floors: ${data.project.floors.length}`);
        }
      } else {
        console.log(`❌ API call failed: ${data.error}`);
      }
      
    } catch (error) {
      console.error(`💥 Error testing token ${token}:`, error.message);
    }
  }
}

testClientProgressAPI();