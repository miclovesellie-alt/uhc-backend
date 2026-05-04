const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://uhc-backend.onrender.com/api/auth/signup', {
      name: 'test',
      email: 'test1234567@test.com',
      password: 'password123',
      category: 'student',
      country: 'US'
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response ? err.response.data : err.message);
  }
}

test();
