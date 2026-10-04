// API测试脚本
async function testAPI() {
  const testImageUrl = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500";
  
  console.log('Testing API...');
  
  try {
    const response = await fetch('http://localhost:3001/api/analyze-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: testImageUrl,
        analysisType: 'description'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    
    const result = await response.text();
    console.log('Response:', result);
    
    if (response.ok) {
      console.log('✅ API working correctly');
    } else {
      console.log('❌ API error');
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

testAPI();
